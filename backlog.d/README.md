# backlog.d

`backlog.d/` is the source of truth for planned work in this repository.

## Ordering

- Lower numbers are higher priority.
- `Status: ready` means the item is shaped enough to build now.
- `Status: blocked` means the item depends on another item landing first.
- `Status: in-progress` means one agent owns it right now.
- `Status: done` means the item moved to `backlog.d/_done/`.

## Authoring Rules

- Keep one outcome per file.
- Prefer product outcomes over mechanism-only tasks.
- Every item must include a concrete oracle with commands or observable outcomes.
- If an item grows beyond one coherent delivery unit, split it.

## Claiming

Use `scripts/lib/claims.sh` before starting a `ready` item:

```bash
source scripts/lib/claims.sh
claim_acquire 001-harden-guest-first-room-flow
```

Release the claim when the work is done or abandoned:

```bash
source scripts/lib/claims.sh
claim_release 001-harden-guest-first-room-flow
```
