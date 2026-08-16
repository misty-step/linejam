export function resolveDeploymentId(value?: string | null): string | undefined {
  if (value === null || value === undefined) return undefined;

  return value.trim() || undefined;
}
