---
name: play-linejam
description: Play a complete multiplayer Linejam game in real browsers against a local Worker. Use when complete rendered multiplayer acceptance is commissioned; for routine changes use verify-linejam.
---

# Play Linejam

The complete rendered multiplayer journey is automated in
`e2e/walkthrough.mjs`: Host and Guest in two concurrent headed Chrome
contexts, plus a signed-out reader for the shared link.

```bash
xvfb-run -a node e2e/walkthrough.mjs                    # all nine runs
xvfb-run -a node e2e/walkthrough.mjs --only desktop-light
```

It starts its own `wrangler dev` on loopback with throwaway storage and stops
it afterwards. It refuses any non-loopback target.

## To play by hand

```bash
pnpm dev    # http://127.0.0.1:8787
```

Use two browser profiles (or a normal and a private window): each is a
different guest. One creates a room; the other opens the join link or scans
the QR. Play nine rounds, read the poems, heart one, share it, open the link
signed out, revoke it.

## What a pass may claim

Only what was observed: the screens reached, the lines accepted, the reveal,
the share and its revocation, and `e2e/out/walkthrough.json`. It is not a
deployment check and not physical-phone qualification.
