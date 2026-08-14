export const CANARY_AUTOMATION_EVENT_TYPES = Object.freeze([
  'error.new_class',
  'error.regression',
  'incident.opened',
  'incident.updated',
  'incident.resolved',
  'health_check.down',
  'health_check.degraded',
  'health_check.recovered',
  'health_check.tls_expiring',
]);

const CANARY_AUTOMATION_EVENT_TYPE_SET = new Set(
  CANARY_AUTOMATION_EVENT_TYPES
);

export const CANARY_AUTOMATION_EVENT_TYPES_JSON = JSON.stringify(
  CANARY_AUTOMATION_EVENT_TYPES
);

export const CANARY_AUTOMATION_EVENT_TYPES_QUERY =
  CANARY_AUTOMATION_EVENT_TYPES.join(',');

export function isCanaryAutomationEvent(eventName) {
  return CANARY_AUTOMATION_EVENT_TYPE_SET.has(eventName);
}
