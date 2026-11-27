# Contributing

Shared standard: [Constitution](https://foundations.mistystep.io/) and [Way of working](https://foundations.mistystep.io/way-of-working).

Linejam uses `master` as the base branch and Conventional Commits for commit
messages.

## Setup

```bash
pnpm install
pnpm dev
```

This runs the real game on `http://127.0.0.1:8787` — workerd with SQLite
Durable Objects — without cloud credentials or a dotenv file. The first run
generates a local-only secret in `.dev.vars`. Ctrl-C stops it.

## Starting work

Work from a current request and check the affected code before implementation.
Check existing branches, pull requests, and active sessions for overlap. Use a
focused branch and describe the result and verification evidence in its pull
request.

Product behavior starts in [`PRODUCT.md`](PRODUCT.md) and visual changes in
[`DESIGN.md`](DESIGN.md); both, and `folio/assets/**`, change only through a
Folio change. Update [`SPEC.md`](SPEC.md) in the same PR as a behavior change.

## Checks

```bash
pnpm verify --fast   # build, types, formatting, all tests
pnpm verify          # the same, then the headed two-player browser walkthrough
```

A change is accepted when it is verified on the real running application
(`pnpm verify`), not by tests alone. See [docs/testing.md](docs/testing.md).
Pure documentation changes need affected formatting and link resolution, not a
full application run.

## Rules of the codebase

- One runtime: the Worker and its Durable Objects. No framework server, no
  second backend, no third-party SDK in the browser, no external requests.
- A rule lives once, in `shared/rules.ts`, and every face uses it.
- Colors, radii, type stacks and motion come only from
  `folio/assets/tokens.json`. The stylesheet has no literals for them, and a
  test enforces that.
- Copy passes the Delete Test and the Self-Reference Test (`DESIGN.md`
  `[D1-5]`).
- No fallbacks that hide a failure. Fail visibly.
