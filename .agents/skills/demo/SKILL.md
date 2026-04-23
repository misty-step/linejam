---
name: demo
description: |
  Generate Linejam demo and evidence artifacts from the existing Playwright
  evidence path. Primary flows are `pnpm test:e2e:evidence` and
  `pnpm evidence:guest-flow`, which package screenshots, WebM, GIF, summary,
  and manifest for guest-flow walkthroughs. Optional upload path uses a draft
  GitHub release when the user explicitly asks for shareable PR evidence.
  Use when: "make a demo", "record walkthrough", "PR evidence", "upload
  screenshots", "guest-flow evidence", "demo this feature", "create a
  walkthrough".
  Trigger: /demo.
argument-hint: '[feature|evidence-dir] [--base-url <url>] [upload]'
---

# /demo (linejam)

Generate demo artifacts from Linejam's existing evidence harness. This repo
already has a concrete path; do not scaffold a second one.

## Execution Stance

You are the executive orchestrator.

- Keep shot selection, evidence sufficiency, and final artifact approval on the
  lead model.
- Delegate planning, capture, and critique to separate focused subagents when
  the request is broader than the standard guest-flow evidence run.
- Use a cold reviewer for final quality judgment.

## Standard Path

The default Linejam demo path is:

```bash
pnpm test:e2e:evidence
pnpm evidence:guest-flow
```

`pnpm test:e2e:evidence` runs the authoritative Playwright evidence spec.
`pnpm evidence:guest-flow` packages the resulting screenshots, WebM, GIF,
`qa-summary.md`, and `manifest.json`.

Use the `LINEJAM_BASE_URL` environment variable when you need a deployed target:

```bash
LINEJAM_BASE_URL=https://www.linejam.app pnpm evidence:guest-flow
```

If the user asks for a feature-specific demo rather than the stock guest flow,
plan a shot list first, then capture against the same evidence machinery.

## Workflow

1. **Choose scope.**
   - Default: guest-flow evidence.
   - Feature-specific: name the route, component, or interaction delta.
2. **Capture.**
   - Local/stable app path: `pnpm test:e2e:evidence` then
     `pnpm evidence:guest-flow`.
   - Remote target: set `LINEJAM_BASE_URL` or pass the base URL through the
     relevant env for the evidence run.
3. **Critique cold.**
   - Confirm the artifact bundle contains the expected screenshots, WebM, GIF,
     summary, and manifest.
   - Validate that the summary's result is `PASS` or `PASS_WITH_ERRORS` with
     explained runtime errors; unreviewed broken capture is not demo evidence.
4. **Upload only when asked.**
   - If the user wants a shareable bundle, follow
     `references/pr-evidence-upload.md` and create a draft release.

## Repo-Specific Anchors

- `tests/e2e/guest-flow.evidence.spec.ts` — authoritative evidence spec.
- `scripts/evidence/guest-flow.mjs` — packaging wrapper and summary generation.
- `docs/testing.md` — evidence commands and environment contract.
- `.github/workflows/ci.yml` → `qa-evidence` job — hosted advisory artifact path.

## Gotchas

- **Do not scaffold a second demo path.** This repo already has one.
- **Default-state evidence proves nothing.** Show the changed flow or the
  canonical guest flow end-to-end.
- **Hosted `qa-evidence` is advisory.** It is useful artifact capture, not the
  merge gate.
- **Do not invent a second upload convention.** If uploading, use the draft
  release path already documented in `references/pr-evidence-upload.md`.
