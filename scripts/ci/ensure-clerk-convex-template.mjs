#!/usr/bin/env node

import { fileURLToPath } from 'node:url';

export const CLERK_API_BASE_URL = 'https://api.clerk.com/v1';
export const CONVEX_JWT_TEMPLATE_NAME = 'convex';
export const CONVEX_JWT_TEMPLATE_CLAIMS = {
  aud: 'convex',
};

/**
 * @typedef {{ log: (...args: unknown[]) => void }} TemplateLogger
 */

export function isLiveClerkKey(publishableKey = '') {
  return publishableKey.trim().startsWith('pk_live_');
}

export function normalizeTemplateList(result) {
  if (Array.isArray(result)) {
    return result;
  }
  return Array.isArray(result?.data) ? result.data : [];
}

/**
 * @param {{
 *   secretKey: string;
 *   path: string;
 *   method?: string;
 *   body?: unknown;
 *   fetchImpl?: typeof fetch;
 * }} options
 */
export async function clerkRequest({
  secretKey,
  path,
  method = 'GET',
  body,
  fetchImpl = fetch,
}) {
  const response = await fetchImpl(`${CLERK_API_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  const parsed = text ? safeParseJson(text) : null;

  if (!response.ok) {
    const error = new Error(
      extractClerkErrorMessage(parsed) ||
        `Clerk API ${path} returned ${response.status} ${response.statusText}`.trim()
    );
    error.status = response.status;
    error.errors = Array.isArray(parsed?.errors) ? parsed.errors : [];
    throw error;
  }

  return parsed;
}

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractClerkErrorMessage(parsed) {
  if (!Array.isArray(parsed?.errors) || parsed.errors.length === 0) {
    return undefined;
  }

  return parsed.errors
    .map((entry) => entry?.long_message || entry?.message)
    .find(Boolean);
}

function isIdentifierExistsError(error) {
  return Array.isArray(error?.errors)
    ? error.errors.some((entry) => entry?.code === 'form_identifier_exists')
    : false;
}

/**
 * @param {{
 *   secretKey?: string;
 *   publishableKey?: string;
 *   allowLiveMutation?: boolean;
 *   checkOnly?: boolean;
 *   fetchImpl?: typeof fetch;
 *   logger?: TemplateLogger;
 * }} options
 */
export async function ensureClerkConvexTemplate({
  secretKey,
  publishableKey,
  allowLiveMutation = false,
  checkOnly = false,
  fetchImpl = fetch,
  logger = console,
}) {
  if (!secretKey?.trim() || !publishableKey?.trim()) {
    return {
      status: 'skipped',
      reason: 'missing-clerk-env',
    };
  }

  const normalizedSecretKey = secretKey.trim();
  const templates = normalizeTemplateList(
    await clerkRequest({
      secretKey: normalizedSecretKey,
      path: '/jwt_templates',
      fetchImpl,
    })
  );
  const existing = templates.find(
    (template) => template.name === CONVEX_JWT_TEMPLATE_NAME
  );

  if (existing) {
    return {
      status: 'present',
      templateId: existing.id,
    };
  }

  if (checkOnly) {
    throw new Error(
      'Clerk JWT template "convex" is missing. Run scripts/ci/ensure-clerk-convex-template.mjs to create it for local/dev Clerk instances, or configure it in Clerk before running authenticated smoke.'
    );
  }

  if (isLiveClerkKey(publishableKey) && !allowLiveMutation) {
    throw new Error(
      'Clerk JWT template "convex" is missing for a live key. Re-run with LINEJAM_ALLOW_LIVE_CLERK_TEMPLATE_CREATE=1 to bootstrap it via CLI.'
    );
  }

  try {
    const created = await clerkRequest({
      secretKey: normalizedSecretKey,
      path: '/jwt_templates',
      method: 'POST',
      body: {
        name: CONVEX_JWT_TEMPLATE_NAME,
        claims: CONVEX_JWT_TEMPLATE_CLAIMS,
      },
      fetchImpl,
    });

    logger.log('Created Clerk JWT template "convex" for Convex auth.');

    return {
      status: 'created',
      templateId: created.id,
    };
  } catch (error) {
    if (!isIdentifierExistsError(error)) {
      throw error;
    }

    const retryTemplates = normalizeTemplateList(
      await clerkRequest({
        secretKey: normalizedSecretKey,
        path: '/jwt_templates',
        fetchImpl,
      })
    );
    const retryMatch = retryTemplates.find(
      (template) => template.name === CONVEX_JWT_TEMPLATE_NAME
    );

    if (!retryMatch) {
      throw error;
    }

    return {
      status: 'present',
      templateId: retryMatch.id,
    };
  }
}

async function main() {
  const allowLiveMutation =
    process.argv.includes('--allow-live-mutation') ||
    process.env.LINEJAM_ALLOW_LIVE_CLERK_TEMPLATE_CREATE === '1';
  const checkOnly = process.argv.includes('--check-only');

  await ensureClerkConvexTemplate({
    secretKey: process.env.CLERK_SECRET_KEY,
    publishableKey:
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
      process.env.CLERK_PUBLISHABLE_KEY,
    allowLiveMutation,
    checkOnly,
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error?.message || error);
    process.exit(1);
  });
}
