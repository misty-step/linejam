# AI Spend Controls and OpenRouter Guardrails

**Owner:** Linejam production on-call, with the FinOps owner accountable for the
OpenRouter workspace/key limit. **Scope:** AI player and ghostwriter generation.

This is a defense-in-depth control. The application reserves a shared daily
claim and estimated-cost budget before any OpenRouter request, while OpenRouter
holds the provider-side credit ceiling that still applies if an application
counter is bypassed or a new call path is introduced.

## Control layers

| Layer       | Control                                                                                                             | When it acts                                                          | Safe behavior                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Provider    | OpenRouter credit limit on the dedicated Linejam production API key (or workspace, if the key is workspace-managed) | Provider billing boundary                                             | OpenRouter rejects requests after the approved ceiling                |
| Application | AI_DAILY_CALL_BUDGET plus AI_DAILY_COST_BUDGET_USD and AI_ESTIMATED_COST_PER_GENERATION_USD                         | Atomic Convex claim, before a provider call                           | The cell receives a deterministic fallback; the game continues        |
| Emergency   | AI_PROVIDER_ENABLED                                                                                                 | Every claim and again immediately before each bot/ghost provider call | New provider calls stop; active games receive deterministic fallbacks |

The one-shot release-note generator also honors AI_PROVIDER_ENABLED before its OpenRouter request. It has no Convex daily-counter context, so the provider-side key limit remains its spend ceiling; release automation must use the same dedicated limited key.

The application cost ceiling is an estimate, not a substitute for the provider
limit. Keep the OpenRouter limit at or below the approved incident-loss budget,
and keep the application ceiling lower still so normal traffic degrades before
the provider boundary is reached.

## Provider-side setup (operator action)

1. The FinOps owner opens the OpenRouter dashboard for the Linejam workspace and
   selects the dedicated production API key. Never use a shared personal key.
2. Set the key/workspace **credit limit** (the provider's spend/limit field) to
   the approved monthly or incident budget. The limit must be a hard provider
   limit, not an alert-only notification. Record the non-secret key name,
   workspace, limit, timestamp, and operator in the change ticket.
3. Read the dashboard back after saving and attach a screenshot or provider
   receipt showing the key/workspace identifier and limit. Redact the key value,
   token, and any request credentials.
4. Confirm the Convex OPENROUTER_API_KEY is the dedicated key without printing
   its value. A provider limit is only evidence when the deployed key and the
   limited key are the same named key.

This lane does not mutate provider settings or production environments. The
FinOps/on-call owner must perform and evidence this dashboard action.

## Application configuration

Set these on the target Convex deployment using the normal authenticated
operator workflow (values are examples; choose the approved ceilings):

```text
AI_PROVIDER_ENABLED=1
AI_DAILY_CALL_BUDGET=250
AI_DAILY_COST_BUDGET_USD=1
AI_ESTIMATED_COST_PER_GENERATION_USD=0.002
```

AI_DAILY_CALL_BUDGET counts atomic generation claims shared by bots and
ghostwriters. AI_DAILY_COST_BUDGET_USD stops a claim when the next estimated
generation would cross the daily dollar ceiling. The estimated per-generation
value must be a conservative estimate for the configured model and retry
policy. Both controls are UTC-day counters and reset on the next UTC day.

### Kill-switch truth table

AI_PROVIDER_ENABLED is read at runtime, so changing it does not require a code
deploy. The parser is intentionally fail-closed for explicit values:

| Value                    | State                                 | Result                                                                                            |
| ------------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------------- |
| unset or blank           | enabled (backward-compatible default) | Normal provider calls remain eligible, subject to the daily budgets                               |
| 1, true, or yes          | enabled                               | Normal provider calls remain eligible, subject to the daily budgets                               |
| 0, false, or no          | disabled                              | No new OpenRouter calls; deterministic fallbacks are committed                                    |
| any other explicit value | invalid/disabled                      | No new OpenRouter calls; a structured warning is logged and deterministic fallbacks are committed |

The switch is checked both while atomically claiming a cell and immediately
before the OpenRouter call. A toggle therefore stops new spend even when a
previously scheduled action is still running. It does not remove existing
lines or interrupt an in-flight HTTP request; the bounded timeout/retry path
and deterministic safety net complete that cell.

## Incident and recovery checklist

1. On a spend alert, capture the alert, current AI usage counters, and the
   OpenRouter dashboard readback before changing settings.
2. Set AI_PROVIDER_ENABLED=0 on the affected Convex deployment. Verify new
   bot/ghost attempts create fallback lines and OpenRouter request volume stops
   within one scheduled-action interval.
3. Preserve the non-secret evidence: timestamp, operator, deployment, key name,
   provider limit, app budget counters, structured switch warning, and affected
   room/game IDs. Do not record API-key values or poem content.
4. Diagnose the traffic source and confirm the provider-side credit limit remains
   in place. Lower the application daily budgets if the normal ceiling was too
   permissive.
5. Restore with AI_PROVIDER_ENABLED=1 only after the provider limit and app
   ceilings are read back. Run one controlled non-production generation, then
   verify successful generation metrics and no new fallback-rate incident.

The kill switch is reversible, but restoring it does not bypass either daily
budget. Existing active games remain playable throughout the stop: fallback
lines preserve exact word counts and the normal lifecycle/safety-net machinery
continues to advance rounds.
