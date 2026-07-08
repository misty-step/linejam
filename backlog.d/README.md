# backlog.d — Retired

**Powder is the authoritative work ledger for Linejam.** This directory is a
retired seed/archive. When the two disagree, Powder wins.

## Query the live backlog

```bash
source ~/.secrets  # loads POWDER_API_BASE_URL, POWDER_API_KEY
powder list-cards --repo linejam          # all cards
powder list-ready --repo linejam          # claimable cards only
powder get-card linejam-NNN              # one card with goal + oracle + activity
```

## Why the seed files were removed

Items 000–029 were imported into Powder and truthed-up against the live
codebase. Most are `done`; the open residuals (027 blocked on a product
decision, 029 pending aesthetic evaluation, 905 Canary hermetic tests) live
as Powder cards with their acceptance oracles intact. The seed markdown was
stale — it said `ready` for shipped work — and keeping it in parallel with
Powder created a dual-source-of-truth problem.
