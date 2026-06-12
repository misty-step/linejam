# Restore doc truth and clear tracked junk

Priority: P2 · Status: ready · Estimate: S

## Goal

A cold agent reading the repo's top-level docs gets only true, current
claims, and the tree carries no stale artifacts.

## Oracle

- [ ] `TASK_COMPLETE` removed from the tree and ignored going forward.
- [ ] `vision.md` removed (superseded by `project.md`, which migrated from
      it on 2026-02-23) — deletion called out in the session report for
      ratification.
- [ ] `project.md` "Active Focus" names current work (backlog.d IDs), not
      the stale February GitHub issue numbers (#149/#148/#134/#133).
- [ ] README deployment section points at `Dockerfile.responder` /
      `fly.responder.toml` for the hosted responder path.
- [ ] `.codex/config.toml` formatting diff committed; `git status` clean.

## Notes

Cold-agent audit: everything else checked out — documented commands all
exist, Dagger contract matches docs, ARCHITECTURE.md redirect intentional.
`components/archive/` is NOT dead (used by app/me/poems/page.tsx:30);
leave it alone.
