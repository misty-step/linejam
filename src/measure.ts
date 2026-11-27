// Anonymous product measurement: a structured Workers log line and nothing
// else. Fields are an allow-list of bounded values — never a name, guest
// credential or id, room code, poem text, URL or query string.

export type MeasureEvent =
  | 'game_created'
  | 'game_joined'
  | 'join_rejected'
  | 'game_started'
  | 'line_submitted'
  | 'game_completed'
  | 'game_ended'
  | 'artifact_action';

type Fields = {
  writers?: number;
  round?: number;
  reason?: string;
  action?: 'favorite' | 'unfavorite' | 'share' | 'revoke' | 'recap_share' | 'recap_revoke';
};

const REASONS = new Set(['room_not_found', 'room_closed', 'room_full', 'pen_name_required', 'invalid_emblem', 'invalid_code']);

export function measurement(event: MeasureEvent, fields: Fields = {}): Record<string, string | number> {
  const out: Record<string, string | number> = { app: 'linejam', event };
  if (typeof fields.writers === 'number') out.writers = fields.writers;
  if (typeof fields.round === 'number') out.round = fields.round;
  if (fields.reason) out.reason = REASONS.has(fields.reason) ? fields.reason : 'other';
  if (fields.action) out.action = fields.action;
  return out;
}

export function measure(event: MeasureEvent, fields: Fields = {}): void {
  try {
    console.log(JSON.stringify(measurement(event, fields)));
  } catch {
    // An unavailable sink never blocks play.
  }
}
