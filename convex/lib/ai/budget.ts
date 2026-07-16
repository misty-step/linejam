/**
 * Shared AI provider safety configuration.
 *
 * All machine-written lines reserve budget in convex/ai.ts before they can
 * reach OpenRouter. This module owns the environment parsing so bot and
 * ghostwriter paths cannot drift.
 */

export type AiBudgetConfig = {
  providerEnabled: boolean;
  providerSwitchState: 'enabled_default' | 'enabled' | 'disabled' | 'invalid';
  dailyCallBudget: number;
  dailyCostBudgetMicros: number;
  estimatedCostPerGenerationMicros: number;
};

const DEFAULT_DAILY_CALL_BUDGET = 250;
const DEFAULT_DAILY_COST_BUDGET_MICROS = 1_000_000;
const DEFAULT_ESTIMATED_COST_PER_GENERATION_MICROS = 2_000;

function nonNegativeInteger(
  value: string | undefined,
  fallback: number
): number {
  const raw = value?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function usdToMicros(value: string | undefined, fallback: number): number {
  const raw = value?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.round(parsed * 1_000_000);
}

function readProviderSwitchState(
  value: string | undefined
): AiBudgetConfig['providerSwitchState'] {
  const raw = value?.trim();
  // Truth table: unset/blank => enabled for backward compatibility; 1/true/yes
  // => enabled; 0/false/no => disabled; any other explicit value => invalid
  // and disabled. A typo must never silently re-enable provider spending.
  if (!raw) return 'enabled_default';
  if (/^(1|true|yes)$/i.test(raw)) return 'enabled';
  if (/^(0|false|no)$/i.test(raw)) return 'disabled';
  return 'invalid';
}

export function getAiBudgetConfig(
  env: Readonly<Record<string, string | undefined>> = process.env
): AiBudgetConfig {
  const providerSwitchState = readProviderSwitchState(env.AI_PROVIDER_ENABLED);
  return {
    providerEnabled:
      providerSwitchState === 'enabled_default' ||
      providerSwitchState === 'enabled',
    providerSwitchState,
    dailyCallBudget: nonNegativeInteger(
      env.AI_DAILY_CALL_BUDGET,
      DEFAULT_DAILY_CALL_BUDGET
    ),
    dailyCostBudgetMicros: usdToMicros(
      env.AI_DAILY_COST_BUDGET_USD,
      DEFAULT_DAILY_COST_BUDGET_MICROS
    ),
    estimatedCostPerGenerationMicros: usdToMicros(
      env.AI_ESTIMATED_COST_PER_GENERATION_USD,
      DEFAULT_ESTIMATED_COST_PER_GENERATION_MICROS
    ),
  };
}

export function isAiProviderEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env
): boolean {
  return getAiBudgetConfig(env).providerEnabled;
}
