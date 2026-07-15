export function resolveDeploymentId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;

  return value.trim() || undefined;
}
