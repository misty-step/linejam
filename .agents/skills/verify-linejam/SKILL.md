---
name: verify-linejam
description: Verify a Linejam change on the real running application — build, types, tests inside workerd, and the headed two-player browser walkthrough against live wrangler dev. Use for every change before handoff.
---

# Verify Linejam

Linejam is one Cloudflare Worker with Durable Objects (SQLite). Verification
runs entirely on this machine with zero cloud credentials.

```bash
pnpm install
pnpm verify          # full: build → typecheck → format → tests → walkthrough
pnpm verify --fast   # everything except the browser walkthrough
```

A step that fails stops the run with a nonzero exit. Report the command, its
exit code and what you saw; never report a skipped step as passed.

## What each step proves

- **build** (`node scripts/build.mjs`): every file under `folio/assets/` matches
  `folio/assets/checksums.json`; `dist/public` is regenerated from sources.
- **tests** (`pnpm exec vitest run`): project `worker` runs inside workerd with
  real Durable Object SQLite; project `faces` drives the CLI and MCP server
  against a live `wrangler dev`.
- **walkthrough** (`xvfb-run -a node e2e/walkthrough.mjs`): headed Google
  Chrome, two concurrent players and a signed-out reader, nine viewport × mode
  runs. It needs Chrome, `ffmpeg` and `xvfb` (or a display). Output:
  `e2e/out/walkthrough.json`, screenshots, two `.mp4` files.

Run one configuration while iterating:

```bash
xvfb-run -a node e2e/walkthrough.mjs --only phone-dark
```

## Limits

- Local verification refuses cloud credentials and non-loopback targets. It is
  not a deploy and not the live gate on `linejam.mistystep.io`.
- Chrome on Linux has no native share sheet; phone runs exercise the copy
  fallback.
- The legacy import is verified against `tests/fixtures/legacy-export`, not
  production data.

## Do not

- Edit `PRODUCT.md`, `DESIGN.md` or `folio/assets/**` to make a check pass.
- Weaken an assertion in `e2e/walkthrough.mjs` without saying so in the PR.
- Commit `.dev.vars`, tokens, or share links.
