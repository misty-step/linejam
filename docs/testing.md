# Testing

`pnpm verify` is the acceptance bar. It needs no cloud credentials and refuses
them: child processes run without `CLOUDFLARE_*` variables, the only secrets
are generated `local-…` values in `.dev.vars`, and the walkthrough refuses any
target that is not loopback.

## Suites

| Command                                 | Runs in                                   | Covers                                                                                                                                                                                                                                            |
| --------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm exec vitest run --project worker` | workerd (Miniflare), real DO SQLite       | room codes, capacity, entry, the 9-round matrix, word validation, immutable/idempotent lines, spectators, presence, host succession, hibernation, reading circle, archive privacy, sharing, retention, import, identity, routes, canonical assets |
| `pnpm exec vitest run --project faces`  | Node, against a live `wrangler dev`       | the CLI and MCP server as child processes (full games, rejections, protocol errors), the legacy import end to end, stylesheet/token/copy rules, the one-runtime check                                                                             |
| `xvfb-run -a node e2e/walkthrough.mjs`  | headed Google Chrome, live `wrangler dev` | the real two-player journey, 9 viewport × mode runs, plus the HTTP-fallback scenario                                                                                                                                                              |

`pnpm test` builds first, then runs both vitest projects.

## The walkthrough

Two real browser contexts (Host and Guest) and a third signed-out reader:

create room → 1-player start disabled → QR decoded and followed by the guest →
2-player start → nine rounds (over-count refused in the browser and by the
server, draft survives refresh, calm waiting, only the preceding line visible
on screen and on the socket) → reading circle (rail, whole poem, bylines) →
heart → share with disclosure → the live link read by a signed-out reader →
revoke → the link answers 404 → next poem → recap → Play again → theme toggle
persistence → destructive confirmation with Escape → `/changelog` 404.

Each of the nine runs fails on any console, page or CSP error, any failed or
unexpected 4xx/5xx request, any external request, any horizontal overflow
(also at 200% text), any phone touch target under 44×44, any input under 16px,
any token or canonical-asset mismatch.

`e2e/out/walkthrough.json` is the machine-readable result; screenshots and two
`.mp4` recordings sit beside it.

Chrome on Linux has no native share sheet, so the phone runs exercise the copy
fallback of "native share with a copy fallback". A physical phone and the
native sheet are outside what this run proves.

## What a local pass is not

Not a deployment, not the live gate on `linejam.mistystep.io` (`PRODUCT.md`
`[V-4]`), and not a run of the legacy import against production data.
