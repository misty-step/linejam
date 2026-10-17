// Closed transport vocabulary: no entered code or arbitrary exception message.
export const JOIN_FAILURE_CODES = [
  'INVALID_DISPLAY_NAME',
  'INVALID_ROOM_CODE',
  'ROOM_JOIN_RATE_LIMIT',
  'ROOM_NOT_OPEN',
  'ROOM_DATA_INVALID',
  'ROOM_FULL',
  'REQUEST_FAILED',
] as const;

export type JoinFailureCode = (typeof JOIN_FAILURE_CODES)[number];
