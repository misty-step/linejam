import { makeFunctionReference } from 'convex/server';
import { ConvexError, v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import {
  internalAction,
  internalMutation,
  internalQuery,
} from './_generated/server';

const SENTRY_BASE_URL = 'https://sentry.io/api/0';
const GITHUB_BASE_URL = 'https://api.github.com';
const MAX_ATTEMPTS = 10;
const LEASE_MS = 2 * 60 * 1000;
const BRIDGE_FETCH_TIMEOUT_MS = 5_000;
const MAX_RETRY_MS = 60 * 60 * 1000;
const FIXED_LABELS = ['p1', 'source/sentry', 'domain/infra'] as const;
export const BRIDGE_RUNTIMES = ['convex', 'github-actions'] as const;

export const BRIDGE_OPERATIONS = [
  'sweepAbandonedGames',
  'finishAbandonedGame',
  'previewSmoke',
  'productionSmoke',
] as const;

export const BRIDGE_FAILURE_CODES = ['unexpected_error'] as const;

const blockedCodeValidator = v.union(
  v.literal('configuration_invalid'),
  v.literal('invalid_tags'),
  v.literal('sentry_auth'),
  v.literal('sentry_missing'),
  v.literal('github_auth'),
  v.literal('github_forbidden'),
  v.literal('github_invalid'),
  v.literal('marker_conflict'),
  v.literal('link_conflict'),
  v.literal('attempts_exhausted')
);

type BlockedCode =
  | 'configuration_invalid'
  | 'invalid_tags'
  | 'sentry_auth'
  | 'sentry_missing'
  | 'github_auth'
  | 'github_forbidden'
  | 'github_invalid'
  | 'marker_conflict'
  | 'link_conflict'
  | 'attempts_exhausted';

type Operation = (typeof BRIDGE_OPERATIONS)[number];
type FailureCode = (typeof BRIDGE_FAILURE_CODES)[number];
type Runtime = (typeof BRIDGE_RUNTIMES)[number];
type Environment = 'preview' | 'production';

type ValidatedTags = {
  runtime: Runtime;
  environment: Environment;
  release: string;
  level: 'error';
  operation: Operation;
  failureCode: FailureCode;
};

type ClaimedReceipt = Pick<
  Doc<'sentryGithubReceipts'>,
  | '_id'
  | 'dedupKey'
  | 'projectId'
  | 'sentryIssueId'
  | 'sentryEventId'
  | 'attempts'
  | 'githubIssueNumber'
>;

type BridgeConfig = {
  sentryToken: string;
  sentryOrganization: string;
  githubToken: string;
  integrationId: string;
  owner: string;
  repo: string;
};

const workerRef = makeFunctionReference<
  'action',
  { receiptId: Id<'sentryGithubReceipts'> },
  null
>('sentryGithub:processReceipt');

const claimRef = makeFunctionReference<
  'mutation',
  { receiptId: Id<'sentryGithubReceipts'>; leaseId: string; now: number },
  ClaimedReceipt | null
>('sentryGithub:claimReceipt');

const saveTagsRef = makeFunctionReference<
  'mutation',
  {
    receiptId: Id<'sentryGithubReceipts'>;
    leaseId: string;
    tags: ValidatedTags;
    now: number;
  },
  boolean
>('sentryGithub:saveValidatedTags');

const saveGithubIssueRef = makeFunctionReference<
  'mutation',
  {
    receiptId: Id<'sentryGithubReceipts'>;
    leaseId: string;
    githubIssueNumber: number;
    now: number;
  },
  boolean
>('sentryGithub:saveGithubIssue');

const finishRef = makeFunctionReference<
  'mutation',
  { receiptId: Id<'sentryGithubReceipts'>; leaseId: string; now: number },
  boolean
>('sentryGithub:finishReceipt');

const retryRef = makeFunctionReference<
  'mutation',
  {
    receiptId: Id<'sentryGithubReceipts'>;
    leaseId: string;
    delayMs: number;
    now: number;
  },
  boolean
>('sentryGithub:retryReceipt');

const blockRef = makeFunctionReference<
  'mutation',
  {
    receiptId: Id<'sentryGithubReceipts'>;
    leaseId: string;
    blockedCode: BlockedCode;
    now: number;
  },
  boolean
>('sentryGithub:blockReceipt');

class BridgeFailure extends Error {
  constructor(
    readonly code: BlockedCode,
    readonly retryable: boolean,
    readonly retryAfterMs?: number
  ) {
    super(code);
    this.name = 'BridgeFailure';
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new BridgeFailure('configuration_invalid', false);
  return value;
}

function getConfig(): BridgeConfig {
  const sentryOrganization = requiredEnv('SENTRY_ORG');
  const integrationId = requiredEnv('SENTRY_GITHUB_INTEGRATION_ID');
  const owner = requiredEnv('GITHUB_REPOSITORY_OWNER');
  const repo = requiredEnv('GITHUB_REPOSITORY_NAME');
  if (
    sentryOrganization !== 'misty-step' ||
    integrationId !== '338522' ||
    owner !== 'misty-step' ||
    repo !== 'linejam'
  ) {
    throw new BridgeFailure('configuration_invalid', false);
  }
  return {
    sentryToken: requiredEnv('SENTRY_EVENT_WRITE_TOKEN'),
    sentryOrganization,
    githubToken: requiredEnv('GITHUB_ISSUES_TOKEN'),
    integrationId,
    owner,
    repo,
  };
}

function parseRetryAfter(
  value: string | null,
  now: number
): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(MAX_RETRY_MS, Math.ceil(seconds * 1000));
  }
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return undefined;
  return Math.min(MAX_RETRY_MS, Math.max(0, date - now));
}

function providerFailure(
  provider: 'sentry' | 'github' | 'link',
  response: Response,
  now: number
): BridgeFailure {
  if (response.status === 429) {
    return new BridgeFailure(
      'attempts_exhausted',
      true,
      parseRetryAfter(response.headers.get('Retry-After'), now)
    );
  }
  if (response.status >= 500) {
    return new BridgeFailure('attempts_exhausted', true);
  }
  if (provider === 'sentry') {
    if (response.status === 401 || response.status === 403) {
      return new BridgeFailure('sentry_auth', false);
    }
    if (response.status === 404) {
      return new BridgeFailure('sentry_missing', false);
    }
    return new BridgeFailure('invalid_tags', false);
  }
  if (provider === 'github') {
    if (response.status === 401) return new BridgeFailure('github_auth', false);
    if (response.status === 403)
      return new BridgeFailure('github_forbidden', false);
    return new BridgeFailure('github_invalid', false);
  }
  if (response.status === 401 || response.status === 403) {
    return new BridgeFailure('sentry_auth', false);
  }
  if (response.status === 404)
    return new BridgeFailure('sentry_missing', false);
  return new BridgeFailure('link_conflict', false);
}

async function safeFetch(
  input: string,
  init: RequestInit,
  provider: 'sentry' | 'github' | 'link'
): Promise<Response> {
  try {
    const response = await fetch(input, {
      ...init,
      redirect: 'error',
      signal: AbortSignal.timeout(BRIDGE_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) throw providerFailure(provider, response, Date.now());
    return response;
  } catch (error) {
    if (error instanceof BridgeFailure) throw error;
    throw new BridgeFailure('attempts_exhausted', true);
  }
}
type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | readonly JsonValue[];

interface JsonObject {
  readonly [key: string]: JsonValue | undefined;
}

interface SentryEventTag {
  key: string;
  value: string;
}

interface SentryEventResponse {
  eventId: string;
  issueId: string;
  tags: readonly SentryEventTag[];
}

export interface GithubIssueContent {
  title: string;
  body: string;
  labels: readonly string[];
}

interface GithubSearchIssueItem {
  number: number;
  body: string;
}

interface GithubSearchResponse {
  items: readonly GithubSearchIssueItem[];
}

interface GithubIssueResponse {
  number: number;
}

interface SentryChoiceItem {
  value: string;
}

type SentryChoice = string | readonly string[] | SentryChoiceItem;

interface SentryLinkIssueField {
  name: string;
  choices?: readonly SentryChoice[];
}

interface SentryLinkedIssue {
  key: string;
}

interface SentryIntegrationLinkConfig {
  linkIssueConfig: readonly SentryLinkIssueField[];
  linkedIssues?: readonly SentryLinkedIssue[];
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return value !== null && !Array.isArray(value) && Object(value) === value;
}

function isJsonString(value: JsonValue | undefined): value is string {
  return Object.prototype.toString.call(value) === '[object String]';
}

function isPositiveInteger(value: JsonValue | undefined): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function parseSentryEvent(value: JsonValue): SentryEventResponse | null {
  if (
    !isJsonObject(value) ||
    !isJsonString(value.eventID) ||
    !isJsonString(value.groupID) ||
    !Array.isArray(value.tags)
  ) {
    return null;
  }
  const tags: SentryEventTag[] = [];
  for (const candidate of value.tags) {
    if (
      !isJsonObject(candidate) ||
      !isJsonString(candidate.key) ||
      !isJsonString(candidate.value)
    ) {
      return null;
    }
    tags.push({ key: candidate.key, value: candidate.value });
  }
  return { eventId: value.eventID, issueId: value.groupID, tags };
}

function parseGithubSearchResponse(
  value: JsonValue
): GithubSearchResponse | null {
  if (!isJsonObject(value) || !Array.isArray(value.items)) return null;
  const items: GithubSearchIssueItem[] = [];
  for (const candidate of value.items) {
    if (
      !isJsonObject(candidate) ||
      !isPositiveInteger(candidate.number) ||
      !isJsonString(candidate.body)
    ) {
      return null;
    }
    items.push({ number: candidate.number, body: candidate.body });
  }
  return { items };
}

function parseGithubIssueResponse(
  value: JsonValue
): GithubIssueResponse | null {
  if (!isJsonObject(value) || !isPositiveInteger(value.number)) return null;
  return { number: value.number };
}

function parseSentryChoice(value: JsonValue): SentryChoice | null {
  if (isJsonString(value)) return value;
  if (Array.isArray(value)) {
    const parts: string[] = [];
    for (const part of value) {
      if (!isJsonString(part)) return null;
      parts.push(part);
    }
    return parts;
  }
  if (!isJsonObject(value) || !isJsonString(value.value)) return null;
  return { value: value.value };
}

function parseSentryIntegrationLinkConfig(
  value: JsonValue
): SentryIntegrationLinkConfig | null {
  if (!isJsonObject(value) || !Array.isArray(value.linkIssueConfig)) {
    return null;
  }
  const linkIssueConfig: SentryLinkIssueField[] = [];
  for (const candidate of value.linkIssueConfig) {
    if (!isJsonObject(candidate) || !isJsonString(candidate.name)) {
      return null;
    }
    const field: SentryLinkIssueField = { name: candidate.name };
    if (candidate.choices !== undefined) {
      if (!Array.isArray(candidate.choices)) return null;
      const choices: SentryChoice[] = [];
      for (const choiceValue of candidate.choices) {
        const choice = parseSentryChoice(choiceValue);
        if (choice === null) return null;
        choices.push(choice);
      }
      field.choices = choices;
    }
    linkIssueConfig.push(field);
  }

  const config: SentryIntegrationLinkConfig = { linkIssueConfig };
  if (value.linkedIssues !== undefined) {
    if (!Array.isArray(value.linkedIssues)) return null;
    const linkedIssues: SentryLinkedIssue[] = [];
    for (const candidate of value.linkedIssues) {
      if (!isJsonObject(candidate) || !isJsonString(candidate.key)) {
        return null;
      }
      linkedIssues.push({ key: candidate.key });
    }
    config.linkedIssues = linkedIssues;
  }
  return config;
}

function includesClosed<T extends string>(
  values: readonly T[],
  value: string
): value is T {
  return values.some((v) => v === value);
}

export function validateBridgeTags(
  values: Record<keyof ValidatedTags, string>
): ValidatedTags | null {
  if (
    !includesClosed(BRIDGE_RUNTIMES, values.runtime) ||
    (values.environment !== 'preview' && values.environment !== 'production') ||
    !/^[0-9a-f]{40}$/.test(values.release) ||
    values.level !== 'error' ||
    !includesClosed(BRIDGE_OPERATIONS, values.operation) ||
    !includesClosed(BRIDGE_FAILURE_CODES, values.failureCode)
  ) {
    return null;
  }
  return {
    runtime: values.runtime,
    environment: values.environment,
    release: values.release,
    level: values.level,
    operation: values.operation,
    failureCode: values.failureCode,
  };
}

async function fetchTags(
  receipt: ClaimedReceipt,
  config: BridgeConfig
): Promise<ValidatedTags> {
  const response = await safeFetch(
    `${SENTRY_BASE_URL}/organizations/${encodeURIComponent(config.sentryOrganization)}/issues/${encodeURIComponent(receipt.sentryIssueId)}/events/${encodeURIComponent(receipt.sentryEventId)}/`,
    {
      headers: {
        Authorization: `Bearer ${config.sentryToken}`,
        Accept: 'application/json',
      },
    },
    'sentry'
  );
  const raw: JsonValue = await response.json();
  const event = parseSentryEvent(raw);
  if (
    event === null ||
    event.eventId !== receipt.sentryEventId ||
    event.issueId !== receipt.sentryIssueId
  ) {
    throw new BridgeFailure('invalid_tags', false);
  }
  const tagFields: ReadonlyArray<readonly [keyof ValidatedTags, string]> = [
    ['runtime', 'runtime'],
    ['environment', 'environment'],
    ['release', 'release'],
    ['level', 'level'],
    ['operation', 'operation'],
    ['failureCode', 'failure_code'],
  ];
  const tagValues: Partial<Record<keyof ValidatedTags, string>> = {};
  for (const tag of event.tags) {
    const entry = tagFields.find(([, providerKey]) => providerKey === tag.key);
    if (entry === undefined) continue;
    const [field] = entry;
    if (tagValues[field] !== undefined) {
      throw new BridgeFailure('invalid_tags', false);
    }
    tagValues[field] = tag.value;
  }
  if (
    !tagValues.runtime ||
    !tagValues.environment ||
    !tagValues.release ||
    !tagValues.level ||
    !tagValues.operation ||
    !tagValues.failureCode
  ) {
    throw new BridgeFailure('invalid_tags', false);
  }
  const tags = validateBridgeTags({
    runtime: tagValues.runtime,
    environment: tagValues.environment,
    release: tagValues.release,
    level: tagValues.level,
    operation: tagValues.operation,
    failureCode: tagValues.failureCode,
  });
  if (!tags) throw new BridgeFailure('invalid_tags', false);
  return tags;
}

export function githubDedupMarker(dedupKey: string): string {
  return `<!-- linejam-sentry-dedup:${dedupKey} -->`;
}

export function githubIssueContent(
  receipt: Pick<
    ClaimedReceipt,
    'dedupKey' | 'sentryIssueId' | 'sentryEventId' | 'projectId'
  >,
  tags: ValidatedTags
): GithubIssueContent {
  return {
    title: `[${tags.runtime === 'convex' ? 'Convex' : 'GitHub Actions'}/${tags.environment}] ${tags.operation}: ${tags.failureCode}`,
    body: [
      'A closed, privacy-safe Linejam failure was reported by Sentry.',
      '',
      `- Runtime: ${tags.runtime}`,
      `- Environment: ${tags.environment}`,
      `- Release: ${tags.release}`,
      `- Level: ${tags.level}`,
      `- Operation: ${tags.operation}`,
      `- Failure code: ${tags.failureCode}`,
      `- Sentry project ID: ${receipt.projectId}`,
      `- Sentry issue ID: ${receipt.sentryIssueId}`,
      `- Sentry event ID: ${receipt.sentryEventId}`,
      '',
      githubDedupMarker(receipt.dedupKey),
    ].join('\n'),
    labels: FIXED_LABELS,
  };
}

async function recoverGithubIssue(
  dedupKey: string,
  config: BridgeConfig
): Promise<number | null> {
  const marker = githubDedupMarker(dedupKey);
  const query = `repo:${config.owner}/${config.repo} is:issue in:body "${marker}"`;
  const response = await safeFetch(
    `${GITHUB_BASE_URL}/search/issues?q=${encodeURIComponent(query)}&per_page=10`,
    {
      headers: {
        Authorization: `Bearer ${config.githubToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    },
    'github'
  );
  const raw: JsonValue = await response.json();
  const data = parseGithubSearchResponse(raw);
  if (data === null) {
    throw new BridgeFailure('github_invalid', false);
  }
  const matches: number[] = [];
  for (const item of data.items) {
    if (item.body.includes(marker)) {
      matches.push(item.number);
    }
  }
  if (matches.length > 1) throw new BridgeFailure('marker_conflict', false);
  return matches[0] ?? null;
}

async function verifyGithubLabelPrerequisites(
  config: BridgeConfig
): Promise<void> {
  await Promise.all(
    FIXED_LABELS.map((label) =>
      safeFetch(
        `${GITHUB_BASE_URL}/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/labels/${encodeURIComponent(label)}`,
        {
          headers: {
            Authorization: `Bearer ${config.githubToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        },
        'github'
      )
    )
  );
}

async function createGithubIssue(
  receipt: ClaimedReceipt,
  tags: ValidatedTags,
  config: BridgeConfig
): Promise<number> {
  const content = githubIssueContent(receipt, tags);
  const response = await safeFetch(
    `${GITHUB_BASE_URL}/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/issues`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.githubToken}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify(content),
    },
    'github'
  );
  const raw: JsonValue = await response.json();
  const data = parseGithubIssueResponse(raw);
  if (data === null) {
    throw new BridgeFailure('github_invalid', false);
  }
  return data.number;
}

function choiceContainsRepository(
  choices: readonly SentryChoice[] | undefined,
  repository: string
): boolean {
  if (!Array.isArray(choices)) return false;
  return choices.some((choice) => {
    if (!choice) return false;
    if (isJsonString(choice)) return choice === repository;
    if (Array.isArray(choice)) {
      return choice.some((part) => part === repository);
    }
    return choice.value === repository;
  });
}

function inspectLinkConfig(
  config: SentryIntegrationLinkConfig | null | undefined,
  repository: string,
  issueNumber: number
): 'ready' | 'linked' | 'conflict' | 'invalid' {
  if (!config || !Array.isArray(config.linkIssueConfig)) {
    return 'invalid';
  }
  let hasRepository = false;
  let hasExternalIssue = false;
  for (const field of config.linkIssueConfig) {
    if (!field || !field.name) continue;
    if (field.name === 'repo') {
      hasRepository = choiceContainsRepository(field.choices, repository);
    } else if (field.name === 'externalIssue') {
      hasExternalIssue = true;
    }
  }
  if (!hasRepository || !hasExternalIssue) return 'invalid';
  if (config.linkedIssues === undefined) return 'ready';
  if (!Array.isArray(config.linkedIssues)) return 'invalid';
  if (config.linkedIssues.length === 0) return 'ready';
  const expected = `${repository}#${issueNumber}`;
  for (const link of config.linkedIssues) {
    if (!link || !link.key) continue;
    if (
      link.key === expected ||
      link.key === `#${issueNumber}` ||
      link.key === String(issueNumber)
    ) {
      return 'linked';
    }
  }
  return 'conflict';
}

async function linkGithubIssue(
  receipt: ClaimedReceipt,
  githubIssueNumber: number,
  config: BridgeConfig
): Promise<void> {
  const endpoint = `${SENTRY_BASE_URL}/issues/${encodeURIComponent(receipt.sentryIssueId)}/integrations/${encodeURIComponent(config.integrationId)}/`;
  const headers = {
    Authorization: `Bearer ${config.sentryToken}`,
    Accept: 'application/json',
  };
  const configResponse = await safeFetch(
    `${endpoint}?action=link`,
    { headers },
    'link'
  );
  const raw: JsonValue = await configResponse.json();
  const liveConfig = parseSentryIntegrationLinkConfig(raw);
  const repository = `${config.owner}/${config.repo}`;
  const state = inspectLinkConfig(liveConfig, repository, githubIssueNumber);
  if (state === 'linked') return;
  if (state === 'conflict') throw new BridgeFailure('link_conflict', false);
  if (state === 'invalid') {
    throw new BridgeFailure('configuration_invalid', false);
  }

  await safeFetch(
    endpoint,
    {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repo: repository,
        externalIssue: String(githubIssueNumber),
      }),
    },
    'link'
  );
}

export function retryDelayMs(attempt: number, random = Math.random()): number {
  const base = Math.min(
    MAX_RETRY_MS,
    1000 * 2 ** Math.min(Math.max(attempt - 1, 0), 11)
  );
  const boundedRandom = Math.max(0, Math.min(1, random));
  return Math.floor(base / 2 + (base / 2) * boundedRandom);
}

export const acceptWebhook = internalMutation({
  args: {
    dedupKey: v.string(),
    installationUuid: v.string(),
    projectId: v.string(),
    sentryIssueId: v.string(),
    sentryEventId: v.string(),
    now: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (
      !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
        args.installationUuid
      ) ||
      !/^\d{1,32}$/.test(args.projectId) ||
      !/^\d{1,32}$/.test(args.sentryIssueId) ||
      !/^[0-9a-f]{32}$/.test(args.sentryEventId) ||
      args.dedupKey !==
        `v1:${args.installationUuid}:${args.projectId}:${args.sentryIssueId}`
    ) {
      throw new ConvexError('invalid_receipt');
    }
    const existing = await ctx.db
      .query('sentryGithubReceipts')
      .withIndex('by_dedupKey', (q) => q.eq('dedupKey', args.dedupKey))
      .unique();
    if (existing) return { receiptId: existing._id, inserted: false };

    const now = args.now ?? Date.now();
    const receiptId = await ctx.db.insert('sentryGithubReceipts', {
      dedupKey: args.dedupKey,
      installationUuid: args.installationUuid,
      projectId: args.projectId,
      sentryIssueId: args.sentryIssueId,
      sentryEventId: args.sentryEventId,
      state: 'pending',
      attempts: 0,
      createdAt: now,
      updatedAt: now,
      nextAttemptAt: now,
    });
    await ctx.scheduler.runAfter(0, workerRef, { receiptId });
    return { receiptId, inserted: true };
  },
});

export const claimReceipt = internalMutation({
  args: {
    receiptId: v.id('sentryGithubReceipts'),
    leaseId: v.string(),
    now: v.number(),
  },
  handler: async (ctx, args): Promise<ClaimedReceipt | null> => {
    const receipt = await ctx.db.get(args.receiptId);
    if (
      !receipt ||
      receipt.state !== 'pending' ||
      receipt.nextAttemptAt > args.now
    ) {
      return null;
    }
    await ctx.db.patch(receipt._id, {
      state: 'leased',
      leaseId: args.leaseId,
      leaseExpiresAt: args.now + LEASE_MS,
      attempts: receipt.attempts + 1,
      updatedAt: args.now,
    });
    return {
      _id: receipt._id,
      dedupKey: receipt.dedupKey,
      projectId: receipt.projectId,
      sentryIssueId: receipt.sentryIssueId,
      sentryEventId: receipt.sentryEventId,
      attempts: receipt.attempts + 1,
      githubIssueNumber: receipt.githubIssueNumber,
    };
  },
});

export const saveValidatedTags = internalMutation({
  args: {
    receiptId: v.id('sentryGithubReceipts'),
    leaseId: v.string(),
    tags: v.object({
      runtime: v.union(...BRIDGE_RUNTIMES.map((value) => v.literal(value))),
      environment: v.union(v.literal('preview'), v.literal('production')),
      release: v.string(),
      level: v.literal('error'),
      operation: v.union(...BRIDGE_OPERATIONS.map((value) => v.literal(value))),
      failureCode: v.literal('unexpected_error'),
    }),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const receipt = await ctx.db.get(args.receiptId);
    if (
      !receipt ||
      receipt.state !== 'leased' ||
      receipt.leaseId !== args.leaseId ||
      !validateBridgeTags(args.tags)
    ) {
      return false;
    }
    await ctx.db.patch(receipt._id, { ...args.tags, updatedAt: args.now });
    return true;
  },
});

export const saveGithubIssue = internalMutation({
  args: {
    receiptId: v.id('sentryGithubReceipts'),
    leaseId: v.string(),
    githubIssueNumber: v.number(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const receipt = await ctx.db.get(args.receiptId);
    if (
      !receipt ||
      receipt.state !== 'leased' ||
      receipt.leaseId !== args.leaseId ||
      !Number.isSafeInteger(args.githubIssueNumber) ||
      args.githubIssueNumber <= 0
    ) {
      return false;
    }
    await ctx.db.patch(receipt._id, {
      githubIssueNumber: args.githubIssueNumber,
      updatedAt: args.now,
    });
    return true;
  },
});

export const finishReceipt = internalMutation({
  args: {
    receiptId: v.id('sentryGithubReceipts'),
    leaseId: v.string(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const receipt = await ctx.db.get(args.receiptId);
    if (
      !receipt ||
      receipt.state !== 'leased' ||
      receipt.leaseId !== args.leaseId
    ) {
      return false;
    }
    await ctx.db.patch(receipt._id, {
      state: 'linked',
      leaseId: undefined,
      leaseExpiresAt: undefined,
      nextAttemptAt: args.now,
      blockedCode: undefined,
      linkedAt: args.now,
      updatedAt: args.now,
    });
    return true;
  },
});

export const retryReceipt = internalMutation({
  args: {
    receiptId: v.id('sentryGithubReceipts'),
    leaseId: v.string(),
    delayMs: v.number(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const receipt = await ctx.db.get(args.receiptId);
    if (
      !receipt ||
      receipt.state !== 'leased' ||
      receipt.leaseId !== args.leaseId
    ) {
      return false;
    }
    const delayMs = Math.max(
      0,
      Math.min(MAX_RETRY_MS, Math.floor(args.delayMs))
    );
    await ctx.db.patch(receipt._id, {
      state: 'pending',
      leaseId: undefined,
      leaseExpiresAt: undefined,
      nextAttemptAt: args.now + delayMs,
      updatedAt: args.now,
    });
    await ctx.scheduler.runAfter(delayMs, workerRef, {
      receiptId: receipt._id,
    });
    return true;
  },
});

export const blockReceipt = internalMutation({
  args: {
    receiptId: v.id('sentryGithubReceipts'),
    leaseId: v.string(),
    blockedCode: blockedCodeValidator,
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const receipt = await ctx.db.get(args.receiptId);
    if (
      !receipt ||
      receipt.state !== 'leased' ||
      receipt.leaseId !== args.leaseId
    ) {
      return false;
    }
    await ctx.db.patch(receipt._id, {
      state: 'blocked',
      blockedCode: args.blockedCode,
      leaseId: undefined,
      leaseExpiresAt: undefined,
      nextAttemptAt: args.now,
      updatedAt: args.now,
    });
    return true;
  },
});

export const processReceipt = internalAction({
  args: { receiptId: v.id('sentryGithubReceipts') },
  handler: async (ctx, args) => {
    const leaseId = crypto.randomUUID();
    const receipt = await ctx.runMutation(claimRef, {
      receiptId: args.receiptId,
      leaseId,
      now: Date.now(),
    });
    if (!receipt) return null;

    try {
      const config = getConfig();
      const tags = await fetchTags(receipt, config);
      if (
        !(await ctx.runMutation(saveTagsRef, {
          receiptId: receipt._id,
          leaseId,
          tags,
          now: Date.now(),
        }))
      ) {
        return null;
      }

      let githubIssueNumber: number;
      if (receipt.githubIssueNumber !== undefined) {
        githubIssueNumber = receipt.githubIssueNumber;
      } else {
        const recoveredIssueNumber = await recoverGithubIssue(
          receipt.dedupKey,
          config
        );
        if (recoveredIssueNumber === null) {
          await verifyGithubLabelPrerequisites(config);
          githubIssueNumber = await createGithubIssue(receipt, tags, config);
        } else {
          githubIssueNumber = recoveredIssueNumber;
        }
        if (
          !(await ctx.runMutation(saveGithubIssueRef, {
            receiptId: receipt._id,
            leaseId,
            githubIssueNumber,
            now: Date.now(),
          }))
        ) {
          return null;
        }
      }

      await linkGithubIssue(receipt, githubIssueNumber, config);
      await ctx.runMutation(finishRef, {
        receiptId: receipt._id,
        leaseId,
        now: Date.now(),
      });
    } catch (error) {
      const failure =
        error instanceof BridgeFailure
          ? error
          : new BridgeFailure('attempts_exhausted', true);
      if (failure.retryable && receipt.attempts < MAX_ATTEMPTS) {
        const delayMs = failure.retryAfterMs ?? retryDelayMs(receipt.attempts);
        await ctx.runMutation(retryRef, {
          receiptId: receipt._id,
          leaseId,
          delayMs,
          now: Date.now(),
        });
      } else {
        await ctx.runMutation(blockRef, {
          receiptId: receipt._id,
          leaseId,
          blockedCode: failure.retryable ? 'attempts_exhausted' : failure.code,
          now: Date.now(),
        });
      }
    }
    return null;
  },
});

export const recoverExpiredLeases = internalMutation({
  args: { now: v.optional(v.number()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const limit = Math.max(1, Math.min(100, Math.floor(args.limit ?? 25)));
    const expired = await ctx.db
      .query('sentryGithubReceipts')
      .withIndex('by_state_leaseExpiresAt', (q) =>
        q.eq('state', 'leased').lt('leaseExpiresAt', now)
      )
      .take(limit);
    for (const receipt of expired) {
      await ctx.db.patch(receipt._id, {
        state: 'pending',
        leaseId: undefined,
        leaseExpiresAt: undefined,
        nextAttemptAt: now,
        updatedAt: now,
      });
      await ctx.scheduler.runAfter(0, workerRef, { receiptId: receipt._id });
    }
    return { recovered: expired.length };
  },
});

export const replayReceipt = internalMutation({
  args: { receiptId: v.id('sentryGithubReceipts') },
  handler: async (ctx, args) => {
    const receipt = await ctx.db.get(args.receiptId);
    if (!receipt || receipt.state === 'linked' || receipt.state === 'leased') {
      return false;
    }
    const now = Date.now();
    await ctx.db.patch(receipt._id, {
      state: 'pending',
      blockedCode: undefined,
      nextAttemptAt: now,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, workerRef, { receiptId: receipt._id });
    return true;
  },
});

export const getReceiptByDedupKey = internalQuery({
  args: { dedupKey: v.string() },
  handler: (ctx, args) =>
    ctx.db
      .query('sentryGithubReceipts')
      .withIndex('by_dedupKey', (q) => q.eq('dedupKey', args.dedupKey))
      .unique(),
});
