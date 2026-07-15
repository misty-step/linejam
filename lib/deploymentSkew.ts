export const DEPLOYMENT_STALE_EVENT = 'linejam:deployment-stale';

export function isUnrecognizedServerActionError(error: unknown) {
  if (!(error instanceof Error)) return false;

  const nextErrorCode = (error as Error & { __NEXT_ERROR_CODE?: unknown })
    .__NEXT_ERROR_CODE;
  return (
    nextErrorCode === 'E715' ||
    error.name === 'UnrecognizedActionError' ||
    (error.message.startsWith('Server Action "') &&
      error.message.includes('was not found on the server.'))
  );
}

export function notifyDeploymentStale() {
  window.dispatchEvent(new Event(DEPLOYMENT_STALE_EVENT));
}
