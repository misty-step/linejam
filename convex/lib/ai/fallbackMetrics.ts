export const AI_GENERATION_WINDOW_MS = 60 * 60 * 1000;

export type AiFallbackReason =
  | 'budget_exhaustion'
  | 'provider_error'
  | 'invalid_output'
  | 'missing_configuration';

export type AiFallbackCheckIn = {
  operation: 'aiFallbackRate';
  status: 'alive' | 'ok' | 'error';
  failureCode?: AiFallbackReason;
  totalGenerations: number;
  fallbackGenerations: number;
  fallbackRatePercent: number;
  thresholdPercent: number;
};

export function aiGenerationBucket(now = Date.now()): number {
  return Math.floor(now / AI_GENERATION_WINDOW_MS) * AI_GENERATION_WINDOW_MS;
}

export function planAiFallbackCheckIn({
  totalGenerations,
  fallbackGenerations,
  fallbackReason,
  thresholdPercent,
  minimumGenerations,
}: {
  totalGenerations: number;
  fallbackGenerations: number;
  fallbackReason: AiFallbackReason | null;
  thresholdPercent: number;
  minimumGenerations: number;
}): AiFallbackCheckIn {
  const fallbackRatePercent =
    totalGenerations === 0
      ? 0
      : Number(((fallbackGenerations / totalGenerations) * 100).toFixed(1));
  const enoughSamples = totalGenerations >= minimumGenerations;
  const breached = enoughSamples && fallbackRatePercent > thresholdPercent;
  const report = {
    operation: 'aiFallbackRate' as const,
    totalGenerations,
    fallbackGenerations,
    fallbackRatePercent,
    ...(fallbackReason ? { failureCode: fallbackReason } : {}),
    thresholdPercent,
  };

  return {
    ...report,
    status: breached ? 'error' : enoughSamples ? 'ok' : 'alive',
  };
}
