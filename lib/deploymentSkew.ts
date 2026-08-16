export const DEPLOYMENT_STALE_EVENT = 'linejam:deployment-stale';

export function isUnrecognizedServerActionError(
  error:
    | Error
    | { name?: string; message?: string; __NEXT_ERROR_CODE?: string }
    | null
    | undefined
) {
  if (!(error instanceof Error)) return false;

  const nextErrorCode =
    '__NEXT_ERROR_CODE' in error ? error.__NEXT_ERROR_CODE : undefined;
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
