# Doc-truth sweep: retire orphaned vision.md, de-date stale sections, add ops runbook notes

Priority: P2 · Status: ready · Estimate: S

## Goal

A cold agent gets one un-contradicted answer to "what is the north star, what
runs when I push, and how do I roll back" — no stale or competing docs.

## Oracle

- [ ] `docs/vision.md` (self-declared "canonical" but contradicted by `project.md`,
      which says it was removed) is retired or demoted to a one-line pointer to
      `project.md`; `grep -ri "canonical" docs/` yields no competing
      product-vision doc.
- [ ] CLAUDE.md "Recent Features (Dec 2025)" and "Known Issues (None currently
      tracked)" frozen boilerplate are removed or derived from `backlog.d/`.
- [ ] The "Patterns to Follow" code snippets exist in exactly one file
      (AGENTS.md or CLAUDE.md); `project.md` references rather than restates them.
- [ ] A short release/rollback runbook captures the operational gotchas that
      currently live only in agent memory: Landmark has no pnpm on PATH (don't add
      pnpm-exec to `.releaserc.js`); Vercel promote-back + Convex
      forward-redeploy-of-prior-SHA + a Convex export/restore drill.

## Notes

From the agent-readiness and ops lanes. The AGENTS.md gate-contract drift (it
claimed `ci:prepush` shells to `ci:dagger:all`) was already fixed during this
groom, along with an AGENTS.md → `project.md` north-star pointer. Remaining:
`docs/vision.md:3` still says "Status: canonical" while `project.md` says it was
removed; CLAUDE.md carries frozen "(Dec 2025)" / "Known Issues (None)" sections;
the Patterns snippets are triplicated (`project.md:43`, `CLAUDE.md:278`,
`AGENTS.md:43`); rollback is one prose sentence (`docs/deployment.md:354`) with no
command and no Convex data export/restore drill. (Deleting `docs/vision.md` is a
proposal pending ratification — demote-to-pointer is the non-destructive default.)
