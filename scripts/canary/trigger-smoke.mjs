import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isCanaryAutomationEvent } from './events.mjs';
import { getSmokeClerkKeyError } from './smoke-auth.mjs';
import { ensureClerkConvexTemplate } from '../ci/ensure-clerk-convex-template.mjs';

const DEFAULT_SMOKE_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_SMOKE_KILL_GRACE_MS = 5_000;
const DEFAULT_AGENTIC_QA_TIMEOUT_MS = 15 * 60 * 1000;
const DEFAULT_SMOKE_RUNNER = 'dagger';
const MAX_CAPTURE_BYTES = 64 * 1024;
const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SMOKE_ENV_KEYS = [
  'CANARY_ENDPOINT',
  'CI',
  'CLERK_JWT_ISSUER_DOMAIN',
  'CLERK_SECRET_KEY',
  'FORCE_COLOR',
  'GUEST_TOKEN_SECRET',
  'HOME',
  'LINEJAM_ALLOWED_SMOKE_HOSTS',
  'LINEJAM_ALLOWED_SMOKE_HOST_PATTERN',
  'LINEJAM_ALLOWED_SMOKE_ORIGINS',
  'LINEJAM_AGENTIC_QA_AFTER_SMOKE',
  'LINEJAM_AGENTIC_QA_MISSION',
  'LINEJAM_ENFORCE_SMOKE_URL_ALLOWLIST',
  'LINEJAM_PROMPTFOO_CRITIC',
  'NEXT_PUBLIC_CANARY_API_KEY',
  'NEXT_PUBLIC_CANARY_ENDPOINT',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_CONVEX_URL',
  'NO_COLOR',
  'PATH',
  'PLAYWRIGHT_CLERK_TEST_EMAIL',
  'PLAYWRIGHT_REQUIRE_AUTH_SMOKE',
  'SHELL',
  'STAGEHAND_MODEL',
  'STAGEHAND_MODEL_API_KEY',
  'TEMP',
  'TERM',
  'TMP',
  'TMPDIR',
];
const SMOKE_RUNNER_COMMANDS = Object.freeze({
  dagger: ['pnpm', ['ci:dagger:smoke']],
  playwright: ['pnpm', ['test:e2e:smoke']],
});
const DEFAULT_AGENTIC_QA_MISSION = 'guest-host-signed-in-join';

function getSmokeTimeoutMs() {
  const parsed = Number.parseInt(
    process.env.CANARY_SMOKE_TIMEOUT_MS || String(DEFAULT_SMOKE_TIMEOUT_MS),
    10
  );

  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_SMOKE_TIMEOUT_MS;
}

function getSmokeKillGraceMs() {
  const parsed = Number.parseInt(
    process.env.CANARY_SMOKE_KILL_GRACE_MS ||
      String(DEFAULT_SMOKE_KILL_GRACE_MS),
    10
  );

  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_SMOKE_KILL_GRACE_MS;
}

function getAgenticQaTimeoutMs() {
  const parsed = Number.parseInt(
    process.env.LINEJAM_AGENTIC_QA_TIMEOUT_MS ||
      String(DEFAULT_AGENTIC_QA_TIMEOUT_MS),
    10
  );

  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_AGENTIC_QA_TIMEOUT_MS;
}

export function shouldTriggerSmoke(eventName) {
  return isCanaryAutomationEvent(eventName);
}

export function resolveSmokeRunner(
  value = process.env.LINEJAM_SMOKE_RUNNER || DEFAULT_SMOKE_RUNNER
) {
  const runner = value.trim().toLowerCase();

  if (runner in SMOKE_RUNNER_COMMANDS) {
    return runner;
  }

  throw new Error(
    `Unsupported LINEJAM_SMOKE_RUNNER: ${runner}. Expected one of ${Object.keys(
      SMOKE_RUNNER_COMMANDS
    ).join(', ')}`
  );
}

function resolveSmokeCommand(runner) {
  return SMOKE_RUNNER_COMMANDS[runner];
}

function buildSmokeEnv(baseUrl) {
  const nextEnv = {
    PLAYWRIGHT_BASE_URL: baseUrl,
  };

  for (const key of SMOKE_ENV_KEYS) {
    const value = process.env[key];
    if (value) {
      nextEnv[key] = value;
    }
  }

  return nextEnv;
}

function agenticQaEnabled() {
  return ['1', 'true', 'TRUE', 'yes', 'YES'].includes(
    process.env.LINEJAM_AGENTIC_QA_AFTER_SMOKE || ''
  );
}

function resolveAgenticQaMission(
  value = process.env.LINEJAM_AGENTIC_QA_MISSION || DEFAULT_AGENTIC_QA_MISSION
) {
  return value.trim() || DEFAULT_AGENTIC_QA_MISSION;
}

function allowlistEnforced() {
  return ['1', 'true', 'TRUE', 'yes', 'YES'].includes(
    process.env.LINEJAM_ENFORCE_SMOKE_URL_ALLOWLIST || ''
  );
}

function validateSmokeBaseUrl(baseUrl) {
  if (!allowlistEnforced()) {
    return null;
  }

  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch {
    return `PLAYWRIGHT_BASE_URL is not a valid URL: ${baseUrl}`;
  }

  const allowedOrigins = (process.env.LINEJAM_ALLOWED_SMOKE_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const allowedHosts = (process.env.LINEJAM_ALLOWED_SMOKE_HOSTS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const hostPattern = process.env.LINEJAM_ALLOWED_SMOKE_HOST_PATTERN?.trim();

  const matchesOrigin = allowedOrigins.includes(parsed.origin);
  const matchesHost = allowedHosts.includes(parsed.hostname);
  const matchesPattern = hostPattern
    ? new RegExp(hostPattern, 'i').test(parsed.hostname)
    : false;

  if (matchesOrigin || matchesHost || matchesPattern) {
    return null;
  }

  return (
    `Refusing to run smoke against untrusted origin ${parsed.origin}. ` +
    'Configure LINEJAM_ALLOWED_SMOKE_ORIGINS, LINEJAM_ALLOWED_SMOKE_HOSTS, or LINEJAM_ALLOWED_SMOKE_HOST_PATTERN.'
  );
}

function validateSmokeAuthConfiguration(baseUrl) {
  return getSmokeClerkKeyError(baseUrl);
}

async function validateClerkTemplateForSmoke() {
  if (process.env.PLAYWRIGHT_REQUIRE_AUTH_SMOKE !== '1') {
    return null;
  }

  const publishableKey =
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ||
    process.env.CLERK_PUBLISHABLE_KEY?.trim() ||
    '';
  const secretKey = process.env.CLERK_SECRET_KEY?.trim() || '';

  try {
    await ensureClerkConvexTemplate({
      secretKey,
      publishableKey,
      checkOnly: true,
    });
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

function appendLimitedOutput(buffer, chunk) {
  const next = Buffer.from(chunk);
  const combined = Buffer.concat([buffer, next]);

  if (combined.length <= MAX_CAPTURE_BYTES) {
    return {
      output: combined,
      truncated: false,
    };
  }

  return {
    output: combined.subarray(combined.length - MAX_CAPTURE_BYTES),
    truncated: true,
  };
}

export async function runAgenticQa({
  baseUrl = process.env.PLAYWRIGHT_BASE_URL,
  mission = resolveAgenticQaMission(),
  deliveryId,
  eventName,
  spawnProcess = spawn,
  timeoutMs = getAgenticQaTimeoutMs(),
} = {}) {
  if (!baseUrl) {
    return {
      ok: false,
      skipped: true,
      reason: 'PLAYWRIGHT_BASE_URL is not configured',
      eventName,
      deliveryId,
      mission,
    };
  }

  return new Promise((resolve) => {
    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    let settled = false;
    let timedOut = false;
    let timeoutHandle;
    let killGraceHandle;
    const timeoutReason = `agentic QA timed out after ${timeoutMs}ms`;
    const child = spawnProcess(
      'pnpm',
      ['qa:agentic:preview', '--mission', mission, '--base-url', baseUrl],
      {
        cwd: REPO_ROOT,
        env: buildSmokeEnv(baseUrl),
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    child.stdout.on('data', (chunk) => {
      stdout = appendLimitedOutput(stdout, chunk).output;
    });
    child.stderr.on('data', (chunk) => {
      stderr = appendLimitedOutput(stderr, chunk).output;
    });
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutHandle);
      clearTimeout(killGraceHandle);
      resolve(result);
    };
    child.on('error', (error) => {
      finish({
        ok: false,
        skipped: false,
        code: null,
        reason: error instanceof Error ? error.message : String(error),
        timedOut,
        eventName,
        deliveryId,
        mission,
      });
    });
    child.on('close', (code) => {
      const parsed = extractJsonPayload(stdout.toString('utf8'));

      finish({
        ok: code === 0 && !timedOut,
        skipped: false,
        code,
        reason: timedOut ? timeoutReason : undefined,
        timedOut,
        eventName,
        deliveryId,
        mission,
        stdout: stdout.toString('utf8'),
        stderr: stderr.toString('utf8'),
        manifest: parsed?.manifest,
        criticSummary: parsed?.criticSummary,
        runDir: parsed?.runDir,
      });
    });

    timeoutHandle = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');

      killGraceHandle = setTimeout(() => {
        child.kill('SIGKILL');
        finish({
          ok: false,
          skipped: false,
          code: null,
          reason: timeoutReason,
          timedOut: true,
          eventName,
          deliveryId,
          mission,
          stdout: stdout.toString('utf8'),
          stderr: stderr.toString('utf8'),
        });
      }, getSmokeKillGraceMs());
    }, timeoutMs);
  });
}

function extractJsonPayload(output) {
  const starts = [];
  for (
    let index = output.indexOf('{');
    index !== -1;
    index = output.indexOf('{', index + 1)
  ) {
    starts.push(index);
  }

  for (const start of starts.reverse()) {
    try {
      return JSON.parse(output.slice(start));
    } catch {
      // Keep looking for the final JSON object after advisory tool logs.
    }
  }

  return null;
}

async function maybeAttachAgenticQa({
  baseUrl,
  deliveryId,
  eventName,
  result,
  spawnProcess,
}) {
  if (!agenticQaEnabled()) {
    return result;
  }

  if (!result.ok || result.skipped) {
    return {
      ...result,
      agenticQa: {
        ok: false,
        skipped: true,
        reason: 'deterministic smoke did not pass',
      },
    };
  }

  return {
    ...result,
    agenticQa: await runAgenticQa({
      baseUrl,
      deliveryId,
      eventName,
      spawnProcess,
    }),
  };
}

export async function runSmoke({
  baseUrl = process.env.PLAYWRIGHT_BASE_URL,
  eventName,
  deliveryId,
  runner = process.env.LINEJAM_SMOKE_RUNNER,
  timeoutMs = getSmokeTimeoutMs(),
  spawnProcess = spawn,
}) {
  if (!baseUrl) {
    return {
      ok: false,
      skipped: true,
      reason: 'PLAYWRIGHT_BASE_URL is not configured',
      eventName,
      deliveryId,
    };
  }

  const baseUrlValidationError = validateSmokeBaseUrl(baseUrl);
  if (baseUrlValidationError) {
    return {
      ok: false,
      skipped: false,
      reason: baseUrlValidationError,
      eventName,
      deliveryId,
    };
  }

  const authValidationError = validateSmokeAuthConfiguration(baseUrl);
  if (authValidationError) {
    return {
      ok: false,
      skipped: false,
      reason: authValidationError,
      eventName,
      deliveryId,
    };
  }

  const clerkTemplateValidationError = await validateClerkTemplateForSmoke();
  if (clerkTemplateValidationError) {
    return {
      ok: false,
      skipped: false,
      reason: clerkTemplateValidationError,
      eventName,
      deliveryId,
    };
  }

  let resolvedRunner;
  let smokeCommand;
  let smokeArgs;

  try {
    resolvedRunner = resolveSmokeRunner(runner || DEFAULT_SMOKE_RUNNER);
    [smokeCommand, smokeArgs] = resolveSmokeCommand(resolvedRunner);
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      reason: error instanceof Error ? error.message : String(error),
      eventName,
      deliveryId,
    };
  }

  return new Promise((resolve) => {
    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    let stdoutTruncated = false;
    let stderrTruncated = false;
    const startedAt = new Date().toISOString();
    let settled = false;
    let timedOut = false;
    const timeoutReason = `smoke run timed out after ${timeoutMs}ms`;

    const child = spawnProcess(smokeCommand, smokeArgs, {
      cwd: REPO_ROOT,
      env: buildSmokeEnv(baseUrl),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let timeoutHandle;
    let killGraceHandle;

    const finish = async (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutHandle);
      clearTimeout(killGraceHandle);
      const enrichedResult = await maybeAttachAgenticQa({
        baseUrl,
        deliveryId,
        eventName,
        result,
        spawnProcess,
      });
      resolve({
        ...enrichedResult,
        eventName,
        deliveryId,
        baseUrl,
        runner: resolvedRunner,
        startedAt,
        finishedAt: new Date().toISOString(),
        stdout: stdout.toString('utf8'),
        stderr: stderr.toString('utf8'),
        stdoutTruncated,
        stderrTruncated,
      });
    };

    timeoutHandle = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');

      killGraceHandle = setTimeout(() => {
        child.kill('SIGKILL');
        finish({
          ok: false,
          skipped: false,
          code: null,
          timedOut: true,
          reason: timeoutReason,
        });
      }, getSmokeKillGraceMs());
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      const next = appendLimitedOutput(stdout, chunk);
      stdout = next.output;
      stdoutTruncated ||= next.truncated;
    });
    child.stderr.on('data', (chunk) => {
      const next = appendLimitedOutput(stderr, chunk);
      stderr = next.output;
      stderrTruncated ||= next.truncated;
    });
    child.on('error', (error) => {
      finish({
        ok: false,
        skipped: false,
        code: null,
        timedOut: false,
        reason: error instanceof Error ? error.message : String(error),
      });
    });

    child.on('close', (code) => {
      if (timedOut) {
        finish({
          ok: false,
          skipped: false,
          code,
          timedOut: true,
          reason: timeoutReason,
        });
        return;
      }

      finish({
        ok: code === 0,
        skipped: false,
        code,
        timedOut: false,
      });
    });
  });
}

export async function runCli({
  args = process.argv.slice(2),
  run = runSmoke,
  writeOut = (text) => process.stdout.write(text),
  writeErr = (...values) => console.error(...values),
  exit = (code) => {
    process.exit(code);
  },
} = {}) {
  const eventName = args[0] || 'manual';
  const deliveryId = args[1] || 'manual';

  try {
    const result = await run({ eventName, deliveryId });
    writeOut(`${JSON.stringify(result, null, 2)}\n`);
    exit(result.ok || result.skipped ? 0 : 1);
    return result;
  } catch (error) {
    writeErr('Smoke trigger failed', error);
    exit(1);
    return null;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void runCli();
}
