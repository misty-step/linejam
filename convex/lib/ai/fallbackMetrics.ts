export const AI_GENERATION_WINDOW_MS = 60 * 60 * 1000;

export type AiFallbackReason =
  | 'budget_exhaustion'
  | 'provider_error'
  | 'invalid_output'
  | 'missing_configuration';

export type AiFallbackCheckIn = {
  status: 'alive' | 'ok' | 'error';
  summary: string;
  context: {
    totalGenerations: number;
    fallbackGenerations: number;
    fallbackRatePercent: number;
    fallbackReason?: AiFallbackReason;
    thresholdPercent: number;
  };
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
  const context: AiFallbackCheckIn['context'] = {
    totalGenerations,
    fallbackGenerations,
    fallbackRatePercent,
    ...(fallbackReason ? { fallbackReason } : {}),
    thresholdPercent,
  };

  if (breached) {
    return {
      status: 'error',
      summary:
        `AI fallback rate is ${fallbackRatePercent.toFixed(1)}% ` +
        `(${fallbackGenerations}/${totalGenerations}) in the current hour.`,
      context,
    };
  }

  if (!enoughSamples) {
    return {
      status: 'alive',
      summary:
        `AI fallback sample is ${fallbackGenerations}/${totalGenerations}; ` +
        `waiting for ${minimumGenerations} generations.`,
      context,
    };
  }

  return {
    status: 'ok',
    summary:
      `AI fallback rate is ${fallbackRatePercent.toFixed(1)}% ` +
      `(${fallbackGenerations}/${totalGenerations}) in the current hour.`,
    context,
  };
}
