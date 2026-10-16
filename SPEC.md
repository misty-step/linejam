# Linejam behavior

The existing player stories remain in `USER_STORIES.md` pending the in-flight
canonical-spec consolidation. This slice specifies the previously missing
operational story without copying those stories.

## Abandonment sweep health

As the operator, I want unattended-game cleanup failures and absent runs to
reach the existing owned alert intake, without stopping people from playing.

- The existing minute-by-minute sweep closes unattended games atomically per
  bounded page, preserving partial-line privacy and active participants.
- One native Sentry check-in covers an entire sweep: it starts before the first
  page, succeeds only after every continuation page commits, and fails if any
  page fails. An interrupted run must never report success.
- Sentry detects a failed, timed-out, or missed production sweep and routes the
  incident through the existing scheduled-job alert and canonical owned intake.
  A normal successful sweep recovers the monitor.
- Reporting contains only the monitor identity, environment, source release,
  generated check-in identity, status and elapsed time; no player or game data.
- Disabled or unavailable telemetry must not prevent cleanup or gameplay.
  Nonproduction runs must not seed a production monitor environment.
- Retention remains unchanged; this story does not authorize enabling deletion.
