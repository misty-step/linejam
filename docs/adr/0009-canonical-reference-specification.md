# ADR-0009: One Repository Reference Specification

## Status

Accepted for the project-context pilot; integration follows independent review.

## Context

Capabilities and stories jointly define the program. A short separate story
catalog omitted implemented behavior, and another capabilities file would make
three descriptions drift. Cross-agent planning already has external owners.

## Decision

Use [SPEC.md](../../SPEC.md) for implementation-agnostic stories and observable
acceptance, updated with the behavior-changing PR. It replaces USER_STORIES.md;
the old path is a reference only. Feature files remain implementation maps.

The shared project-context interface reads `## Capability: <name>` and
`### US-<digits> [live|next|later] <title>`. QA reads that same file, selects only
live stories, and rejects malformed/duplicate stories or empty checkpoints.
Existing IDs and numbered walk checkpoints are preserved. Detailed acceptance
is not falsely certified by the narrower automated walk.

Powder owns priorities, questions and decisions in flight; Kanban owns active
work; GitHub owns PRs, CI and inbound issues; Glass owns health. README owns
application/docs/marketing URLs. Architecture and decision records stay here.

## Consequences

A rebuildable specification lives beside the code without synchronizing a second
capabilities database. The tradeoff is that people must update prose in the same
PR, and statuses describe implementation, not deployment or verified health.
Planning and open bugs remain fresh owner reads rather than copied backlog.

More than 3,000 whitespace-separated words is an advisory decomposition signal
for project-context, not a limit or an excuse to omit real behavior. A large spec
can stay accurate while its capabilities are evaluated for decomposition.

## Alternatives considered

- Powder capability fields: easier planning joins, but separates behavior from
  code changes and duplicates story acceptance.
- Separate capability and story documents: less migration now, more drift later.
- Keep an old-format copy for QA: synchronizes two catalogs and conceals parser
  incompatibility; migrating the consumer is smaller and fail-closed.
