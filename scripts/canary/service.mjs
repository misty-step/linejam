export const SERVICE_PATHS = [
  ['service'],
  ['error', 'service'],
  ['incident', 'service'],
  ['incident', 'error', 'service'],
  ['incident', 'target', 'service'],
  ['target', 'service'],
  ['check', 'service'],
];

export function readStringAtPath(payload, path) {
  let current = payload;

  for (const key of path) {
    if (!current || typeof current !== 'object') {
      return undefined;
    }

    current = current[key];
  }

  return typeof current === 'string' && current.trim().length > 0
    ? current.trim()
    : undefined;
}

export function resolveService(payload) {
  for (const path of SERVICE_PATHS) {
    const service = readStringAtPath(payload, path);
    if (service) return service;
  }

  return undefined;
}
