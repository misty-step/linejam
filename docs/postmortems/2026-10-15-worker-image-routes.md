# Postmortem: poem image routes did not load on Cloudflare Workers

- Incident confirmed: 2026-10-15.
- Repair: [PR #569](https://github.com/misty-step/linejam/pull/569).
- Owner: Linejam image routes and the CI merge gate.
- Recovery receipt: PR #569 owns the reviewed source and production probe results.

## Impact and discovery

The backend migration's isolated browser walk found that “Save as image”
failed. Read-only production probes reproduced HTTP 500 for unknown-poem
GET and POST `/poem/[id]/card`, and GET `/poem/[id]/opengraph-image`.
The route should reject an unavailable poem without rendering its text.
Valid players also could not download a private poem PNG, and shared poem
links had no working OG image.

The discovery lane reported no production POST `/card` requests in its
14-day observability window. This is a low-volume broken capability, not
proof that no player was affected. The exact incident start and historical
request count were not independently established in this repair.

## Cause

These App Router modules declared `runtime = 'edge'`. OpenNext Cloudflare
serves them through Next's Node server bundle; loading an edge-only module
failed in `interopDefault` / `loadComponentsImpl`, before the handler or its
authorization check ran. Site and recap OG routes shared the same defect.

The shared font loader also used `fetch(new URL(..., import.meta.url))`,
which relies on Next's edge asset bundling. Merely removing the runtime
exports would leave image rendering broken. All four font-loader consumers
must run in Node and read identical font bytes through the Worker's ASSETS
binding. Local Next dev/build/start read those same files from `public/fonts`.

This is a frontend packaging failure, not caused by the backend migration.
Production already exhibited it on master `30405f1`. The production Worker
cutover landed on October 12 in #549; that is a possible exposure boundary,
not an observed start time.

## Why CI missed it

The existing story walk exercises local Next, where edge routes and their
asset URLs work. Handler tests inject image/font dependencies. Neither
loads the deployed OpenNext bundle in workerd, so both could pass while
production could not load the route.

## Structural regression check

`pnpm build:cf && pnpm test:worker-images` now builds OpenNext and runs the
configured Worker entry under workerd. It checks actual unknown-poem
GET/POST rejection and PNG signature/dimensions for poem, site and recap OG
routes. `Worker Images` is a fail-closed `merge-gate` dependency, including
on release-PR dispatches. It requires no cloud credentials or hosted data.

Red-to-green proof on Node 22.23.2 / OpenNext 1.20.6:

- With the original runtime/font sources restored, the build succeeds but
  this new check fails: `500 !== 404`, with the same `interopDefault` stack.
- With the repair restored, GET/POST cards return 404, unavailable poem OG
  returns a 404 branded PNG, and site/recap OG render PNGs at 1200×630.
- The renderer, font files, colors and participant/public-query access
  rules are unchanged. Unavailable poem OG keeps the text-free brand image
  but explicitly returns 404.

## Isolated deployed proof

[Preview run 38781492498](https://github.com/misty-step/linejam/actions/runs/38781492498)
passed on source `07c3b37a9461fe47706c0e06d5482f877e941c4d` using a temporary
frontend and the migration lane's synthetic-only backend. A real two-player,
nine-round game produced an owned light PNG (44,937 bytes, 1200×944), dark
PNG (45,465 bytes), and public OG (18,067 bytes, 1200×630). Spectator,
anonymous and tampered credentials returned 404. Private and revoked OG
bytes matched the unknown-poem branded fallback exactly; public and owned
full-card bytes matched each other. The PNGs were visually inspected: all
nine lines and both authors fit in both themes.

The workflow revoked its share, closed its own room and deleted only its
temporary Worker. A fresh request confirmed that Worker returned 404.
The temporary deployment helpers were removed after evidence capture;
the permanent workerd check remains. No production data or runtime secrets
entered this preview, and no Clerk sign-in or candidate guest-issuer parity
is claimed. Final production source/probe readbacks belong on PR #569;
preview success alone is not a claim that production recovered.
