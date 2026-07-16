#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_HEALTH_URL = 'http://localhost:3000/api/health';
const REQUIRED_ENV = [
  'GUEST_TOKEN_SECRET',
  'NEXT_PUBLIC_CONVEX_URL',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
  'NEXT_PUBLIC_CANARY_ENDPOINT',
  'NEXT_PUBLIC_CANARY_API_KEY',
];
const PLACEHOLDER_CANARY_KEYS = new Set([
  'example_canary_server_key',
  'example_canary_write_key',
]);

/** @typedef {{ name: string, status: 'pass'|'warn'|'fail'|'skip', message: string }} CheckResult */
/** @typedef {Record<string, string | undefined>} Env */

function value(env, name) {
  return typeof env[name] === 'string' ? env[name].trim() : '';
}

function configuredUrl(raw, name, acceptedHost) {
  if (!raw) return { status: 'fail', name, message: name + ' is not set' };
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('protocol');
    if (!acceptedHost(url.hostname)) throw new Error('host');
    return { status: 'pass', name, message: 'configured ' + url.origin };
  } catch {
    return { status: 'fail', name, message: name + ' must be a valid configured URL' };
  }
}

export function readDotEnv(filePath = path.join(process.cwd(), '.env.local')) {
  let contents;
  try { contents = readFileSync(filePath, 'utf8'); } catch { return {}; }
  const parsed = {};
  for (const line of contents.split(/\\r?\\n/u)) {
    const match = line.match(/^\\s*(?:export\\s+)?([A-Za-z_][A-Za-z0-9_]*)\\s*=\\s*(.*?)\\s*$/u);
    if (!match) continue;
    let parsedValue = match[2];
    if ((parsedValue.startsWith('"') && parsedValue.endsWith('"')) || (parsedValue.startsWith("'") && parsedValue.endsWith("'"))) parsedValue = parsedValue.slice(1, -1);
    parsed[match[1]] = parsedValue;
  }
  return parsed;
}

export function loadEnvironment({ env = process.env, envFile } = {}) {
  return { ...readDotEnv(envFile), ...env };
}

/** @param {Env} [env] */
export function checkRequiredEnv(env = process.env) {
  const missing = REQUIRED_ENV.filter((name) => !value(env, name));
  return missing.length === 0
    ? { status: 'pass', message: 'all required values present' }
    : { status: 'fail', message: 'missing required values: ' + missing.join(', ') };
}

/** @param {Env} [env] */
export function checkConvexConfig(env = process.env) {
  return configuredUrl(
    value(env, 'NEXT_PUBLIC_CONVEX_URL'),
    'Convex',
    (hostname) => hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.convex.cloud')
  );
}

function clerkOrigin(publishableKey) {
  if (!/^pk_(?:test|live)_/u.test(publishableKey)) return null;
  const encoded = publishableKey.split('_').at(-1);
  if (!encoded) return null;
  try {
    const decoded = Buffer.from(encoded, 'base64url').toString('utf8').replace(/\$+$/u, '');
    const url = new URL(decoded.startsWith('http') ? decoded : 'https://' + decoded);
    if (url.protocol !== 'https:' || !url.hostname.includes('.')) return null;
    return url.origin;
  } catch { return null; }
}

/** @param {Env} [env] */
export function checkClerkConfig(env = process.env) {
  const publishableKey = value(env, 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY');
  const secretKey = value(env, 'CLERK_SECRET_KEY');
  if (!publishableKey || !secretKey) {
    const missing = [!publishableKey && 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', !secretKey && 'CLERK_SECRET_KEY'].filter(Boolean);
    return { status: 'fail', message: 'missing Clerk values: ' + missing.join(', ') };
  }
  if (!/^sk_(?:test|live)_/u.test(secretKey)) return { status: 'fail', message: 'CLERK_SECRET_KEY has an invalid format' };
  const origin = clerkOrigin(publishableKey);
  return origin
    ? { status: 'pass', message: 'configured ' + origin }
    : { status: 'fail', message: 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY does not identify a Clerk Frontend API' };
}

/** @param {Env} [env] */
export function checkCanaryConfig(env = process.env) {
  const endpoint = configuredUrl(value(env, 'NEXT_PUBLIC_CANARY_ENDPOINT'), 'Canary', (hostname) => hostname.length > 0);
  if (endpoint.status === 'fail') return endpoint;
  const apiKey = value(env, 'NEXT_PUBLIC_CANARY_API_KEY');
  if (!apiKey) return { status: 'fail', name: 'Canary', message: 'NEXT_PUBLIC_CANARY_API_KEY is not set' };
  if (PLACEHOLDER_CANARY_KEYS.has(apiKey)) return { status: 'fail', name: 'Canary', message: 'NEXT_PUBLIC_CANARY_API_KEY is still the .env.example placeholder' };
  return endpoint;
}

function timeoutSignal(timeoutMs) {
  return typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(timeoutMs) : undefined;
}

/** @param {{ url?: string, fetchImpl?: typeof fetch, timeoutMs?: number }} [options] */
export async function checkCanaryReachable({ url, fetchImpl = globalThis.fetch, timeoutMs = 3_000 } = {}) {
  if (!url) return { name: 'Canary reachability', status: 'skip', message: 'no endpoint configured' };
  const statusUrl = new URL('/api/v1/status', url).toString();
  try {
    const response = await fetchImpl(statusUrl, { headers: { accept: 'application/json' }, signal: timeoutSignal(timeoutMs) });
    return response.ok
      ? { name: 'Canary reachability', status: 'pass', message: 'reachable' }
      : { name: 'Canary reachability', status: 'warn', message: 'HTTP ' + response.status + ' from configured endpoint' };
  } catch { return { name: 'Canary reachability', status: 'warn', message: 'configured endpoint is unreachable' }; }
}

/** @param {{ url?: string, fetchImpl?: typeof fetch, timeoutMs?: number }} [options] */
export async function checkAppHealth({ url = DEFAULT_HEALTH_URL, fetchImpl = globalThis.fetch, timeoutMs = 3_000 } = {}) {
  let response;
  try {
    response = await fetchImpl(url, { headers: { accept: 'application/json' }, signal: timeoutSignal(timeoutMs) });
  } catch {
    return { name: 'app health', status: 'warn', message: 'no app response at ' + url + ' (start pnpm dev and run pnpm run doctor again)' };
  }
  if (!response.ok) return { name: 'app health', status: 'fail', message: 'HTTP ' + response.status + ' from ' + url };
  let body;
  try { body = await response.json(); } catch { return { name: 'app health', status: 'fail', message: 'app health response was not valid JSON' }; }
  return body?.status === 'ok'
    ? { name: 'app health', status: 'pass', message: 'healthy at ' + url }
    : { name: 'app health', status: 'fail', message: 'app health reported status ' + String(body?.status ?? 'missing') };
}

/** @param {{ env?: Env, fetchImpl?: typeof fetch, healthUrl?: string }} [options] */
export async function runDoctor({ env = loadEnvironment(), fetchImpl = globalThis.fetch, healthUrl = value(env, 'LINEJAM_DOCTOR_HEALTH_URL') || DEFAULT_HEALTH_URL } = {}) {
  const canary = checkCanaryConfig(env);
  const results = [
    { name: 'required env', ...checkRequiredEnv(env) },
    { name: 'Convex', ...checkConvexConfig(env) },
    { name: 'Clerk', ...checkClerkConfig(env) },
    canary,
  ];
  if (canary.status === 'pass') results.push(await checkCanaryReachable({ url: value(env, 'NEXT_PUBLIC_CANARY_ENDPOINT'), fetchImpl }));
  results.push(await checkAppHealth({ url: healthUrl, fetchImpl }));
  return results;
}

async function main() {
  const results = await runDoctor();
  const icons = { pass: '✔', warn: '⚠', fail: '✖', skip: '·' };
  for (const result of results) console.log(icons[result.status] + ' ' + result.name + ': ' + result.message);
  const failures = results.filter((result) => result.status === 'fail');
  if (failures.length > 0) {
    console.error('\ndoctor failed ' + failures.length + ' check(s). Fix the reported configuration and run pnpm run doctor again.');
    process.exitCode = 1;
    return;
  }
  const warnings = results.filter((result) => result.status === 'warn');
  console.log(warnings.length > 0 ? '\ndoctor passed with ' + warnings.length + ' warning(s).' : '\ndoctor: all checks green.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('doctor failed: ' + (error instanceof Error ? error.message : String(error)));
    process.exitCode = 1;
  });
}
