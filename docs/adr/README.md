# Architecture Decision Records

This directory captures significant architectural decisions.

## When to Write an ADR

Write one when you're making a decision that:

- Is hard to reverse
- Affects multiple parts of the system
- Future developers will wonder "why did we do this?"

## Format

Copy `000-template.md` and number sequentially (001, 002, ...).

## Index

| ADR                                                    | Title                                         | Status   |
| ------------------------------------------------------ | --------------------------------------------- | -------- |
| [000](./000-template.md)                               | Template                                      | N/A      |
| [0001](./0001-hybrid-auth-signed-guest-tokens.md)      | Hybrid Auth with Signed Guest Tokens          | Accepted |
| [0002](./0002-assignment-matrix-derangement.md)        | Assignment Matrix with Derangement Constraint | Accepted |
| [0003](./0003-game-state-via-query-not-pointer.md)     | Game State via Query, Not Mutable Pointer     | Accepted |
| [0004](./0004-reader-assignment-derangement-module.md) | Reader Assignment as Deep Module              | Accepted |
| [0005](./0005-ai-players-openrouter-personas.md)       | AI Players via OpenRouter with Persona System | Accepted |
| [0006](./0006-theme-system-css-variables.md)           | Theme System via CSS Custom Properties        | Accepted |
| [0007](./0007-parallel-database-writes.md)             | Parallel Database Writes for Performance      | Accepted |
| [0008](./0008-pen-names-write-time-capture.md)         | Pen Names via Write-Time Capture              | Accepted |

<!-- Add new ADRs here -->
