export type DeploymentIdInput = string | null | undefined | false;

export function resolveDeploymentId(
  value: DeploymentIdInput
): string | undefined {
  if (!value) return undefined;

  return value.trim() || undefined;
}
