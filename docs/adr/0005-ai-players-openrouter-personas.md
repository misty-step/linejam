# ADR-0005: AI Players via OpenRouter with Persona System

## Status

Accepted

## Context

Linejam needed AI players to:

- Fill games when not enough humans are available
- Add variety with distinct poetic "voices"
- Maintain game flow (AI never misses their turn)

Design questions:

- Which LLM provider? (OpenAI, Anthropic, Google, etc.)
- How to handle failures gracefully?
- How to make AI lines fit word count constraints?
- How to give AI players distinct personalities?

## Decision

### Provider: OpenRouter

OpenRouter is a meta-provider routing to multiple models (Gemini, Claude, GPT, etc.) with:

- Single API key for all models
- Automatic failover between providers
- Cost tracking across models

Currently configured to use Gemini models for cost/speed balance.

### Architecture

```
convex/ai.ts           - AI turn scheduling and orchestration
convex/lib/ai/
  llm.ts              - Public interface (re-exports)
  providers/
    openrouter.ts     - API client, retry logic, timeout handling
    types.ts          - Shared types
  personas.ts         - AI personality definitions
  fallbacks.ts        - Deterministic fallback lines
  wordCountGuard.ts   - Post-hoc word count validation
```

### Persona System

6 distinct AI personas with unique prompts:

- **Basho**: Haiku master, nature imagery, contemplative
- **Emily**: Emily Dickinson style, dashes, mortality themes
- **e.e.**: e.e. cummings style, lowercase, playful grammar
- **Gremlin**: Absurdist, mundane objects with reverence
- **Caffeine**: Overcaffeinated, breathless enthusiasm
- **Oracle**: Deadpan prophecies, flat cosmic observations

Random persona assigned at AI player creation using crypto-secure selection.

### Failure Handling

Three-tier resilience:

1. **Retry**: 3 attempts with 10s timeout each
2. **Word count validation**: If LLM returns wrong word count, retry
3. **Fallback**: Deterministic word-bank lines if all retries fail

Fallback lines are pre-written poetry fragments matching each word count (1-5 words).

## Consequences

**Positive:**

- AI players never block game progress (fallback guarantees output)
- Distinct voices make poems more interesting
- OpenRouter flexibility: can switch models without code changes
- Testable: personas and fallbacks are pure functions

**Negative:**

- External API dependency (OpenRouter downtime affects AI turns)
- API key management required in Convex environment
- Prompt engineering is fragile (models may not follow word count strictly)

**Why Not Alternatives:**

- **Direct provider APIs**: Would need multiple API integrations
- **Local models**: Convex functions can't run local inference
- **No AI players**: Reduces game accessibility for small groups
