export const DEFAULT_STAGEHAND_MODEL = 'openai/gpt-4.1-mini';

export const STAGEHAND_PROVIDER_ENV_KEYS = Object.freeze([
  'ANTHROPIC_API_KEY',
  'CEREBRAS_API_KEY',
  'GOOGLE_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'GROQ_API_KEY',
  'OPENAI_API_KEY',
]);

export const AGENTIC_SMOKE_ENV_KEYS = Object.freeze([
  ...STAGEHAND_PROVIDER_ENV_KEYS,
  'LINEJAM_AGENTIC_HEADFUL',
  'LINEJAM_AGENTIC_MISSION',
  'LINEJAM_AGENTIC_MODE',
  'LINEJAM_AGENTIC_OUT_DIR',
  'LINEJAM_STAGEHAND_MODEL',
]);

export function resolveStagehandModel(env = process.env) {
  return env.LINEJAM_STAGEHAND_MODEL?.trim() || DEFAULT_STAGEHAND_MODEL;
}

export function requiredStagehandProviderEnvKeys(model) {
  const normalized = String(model).trim().toLowerCase();

  if (
    normalized.startsWith('gpt-') ||
    normalized.startsWith('o1') ||
    normalized.startsWith('o3') ||
    normalized.startsWith('o4') ||
    normalized.startsWith('openai/')
  ) {
    return ['OPENAI_API_KEY'];
  }

  if (normalized.startsWith('claude') || normalized.startsWith('anthropic/')) {
    return ['ANTHROPIC_API_KEY'];
  }

  if (normalized.startsWith('gemini') || normalized.startsWith('google/')) {
    return ['GOOGLE_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY'];
  }

  if (normalized.startsWith('groq') || normalized.includes('groq-')) {
    return ['GROQ_API_KEY'];
  }

  if (normalized.startsWith('cerebras') || normalized.includes('cerebras-')) {
    return ['CEREBRAS_API_KEY'];
  }

  return STAGEHAND_PROVIDER_ENV_KEYS;
}

export function assertStagehandModelEnvironment({
  env = process.env,
  model = resolveStagehandModel(env),
} = {}) {
  const requiredKeys = requiredStagehandProviderEnvKeys(model);
  if (requiredKeys.some((key) => env[key]?.trim())) {
    return;
  }

  throw new Error(
    `Stagehand model ${model} requires ${requiredKeys.join(
      ' or '
    )}. Set LINEJAM_AGENTIC_MODE=deterministic only for harness debugging.`
  );
}
