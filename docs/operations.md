# Operations

Nothing here is run by `pnpm verify`. Each operation below changes a live
system and needs its own explicit authority.

## Secrets and variables

| Name                   | Kind   | Purpose                                                                                    |
| ---------------------- | ------ | ------------------------------------------------------------------------------------------ |
| `GUEST_TOKEN_SECRET`   | secret | Signs guest credentials. At least 32 characters. Without it the Worker answers `503`.      |
| `LINEJAM_ADMIN_KEY`    | secret | Enables `POST /api/admin/import`. Unset (or under 32 characters) means the route is `401`. |
| `RETENTION_GC_ENABLED` | var    | `"1"` lets the daily sweep delete eligible poems. Production ships `"0"`: report only.     |
| `LINEJAM_ENVIRONMENT`  | var    | Reported by `/api/health`.                                                                 |

Bind secrets with `wrangler secret put <NAME> --env production`. Keep
`GUEST_TOKEN_SECRET` at its existing production value: it is what makes guest
credentials issued before the recompile keep working. Never rotate it as part
of a normal release.

## Deploy

```sh
pnpm deploy:production   # wrangler deploy --env production
```

`wrangler` runs `scripts/build.mjs` first; a folio checksum mismatch stops the
deploy. After activation, read back `GET https://linejam.mistystep.io/api/health`
(`{"status":"ok","environment":"production"}`) and walk a real player entry
(`PRODUCT.md` `[V-4]`). `.github/workflows/health-monitor.yml` polls the same
route.

## The legacy data object

Before the recompile, production data lived in one SQLite Durable Object of
class `LinejamBackend`. The recompiled Worker still exports that class
(`src/legacy-vault.ts`) and keeps its migration tag, with no route into it, for
one reason: dropping either would make the deploy delete that object and all
player data in it. Removing the class later (a `deleted_classes` migration) is a
separate, irreversible decision to take only after the import below is
confirmed.

## Importing pre-recompile data

1. With the _old_ Worker version still serving, freeze its backend and export
   every table through its admin route, as its ADR-0011 rollback procedure
   describes. Save one JSONL file per table (`users`, `games`, `poems`, `lines`,
   `favorites`, `shares`), one document per line.
2. Plan: `node scripts/import-legacy.mjs <dir> --dry-run`.
3. Deploy the recompiled Worker and bind `LINEJAM_ADMIN_KEY`.
4. Import: `LINEJAM_ADMIN_KEY=… node scripts/import-legacy.mjs <dir> --url https://linejam.mistystep.io`.
5. Re-run step 4: it must report zero new rows.

What the import does:

- only **completed** games with nine lines in every poem become archive
  entries; abandoned and in-progress games are never imported;
- poem and game identifiers are preserved, as are write-time bylines;
- active share slugs keep working at their original
  `/poem/<id>?share=<slug>` address; revoked ones stay revoked;
- favorites are carried for guests; participation by signed-in accounts is
  kept under an `account:` principal that no guest credential can claim.

The import is verified against a synthetic export fixture
(`tests/fixtures/legacy-export`). It has not been run against production data.

## Retention

See [architecture](architecture.md#archive). Enabling deletion in production is
setting `RETENTION_GC_ENABLED` to `"1"` — an explicit operator decision. The
sweep logs `{"event":"retention_sweep","eligible":…,"deleted":…,"dryRun":…}`.

## Measurement

The Worker logs anonymous events (`game_created`, `game_joined`,
`join_rejected`, `game_started`, `line_submitted`, `game_completed`,
`game_ended`, `artifact_action`) as structured lines with an allow-list of
bounded fields. No names, credentials, ids, room codes, poem text or URLs are
ever logged. There is no third-party analytics or error SDK in the browser;
the UI makes zero external requests.
