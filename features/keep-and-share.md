# Keep and share (US-003)

Private archive, favorites, explicit reversible sharing, retention, measurement.

- Archive: `src/archive.ts` — `list`, `poem`, `recap`, `setFavorite`, `beginShare`, `confirmShare`, `cancelShare`, `revokeShare`, `sweep`
- Share pages: `page()` in `src/worker.ts` (404 before HTML for an inactive link)
- UI: `shareControl`, `archive`, `poemPage`, `recapPage` in `web/src/views.ts`; `share()` in `web/src/main.ts`
- Measurement: `src/measure.ts`
- Legacy import: `scripts/import-legacy.mjs`, `ArchiveDO.importLegacy`
- Tests: `tests/worker/archive.test.ts`, `tests/faces/import.test.ts`
- Walkthrough: heart → share → signed-out reader → revoke → 404
