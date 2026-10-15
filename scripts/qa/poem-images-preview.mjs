// Synthetic-only acceptance through a deployed frontend and the real room API.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api.js';

const origin = new URL(process.env.IMAGE_PREVIEW_URL);
assert.match(origin.hostname, /^linejam-images-\d+\.[a-z0-9-]+\.workers\.dev$/);
const issuer = 'https://linejam-preview.mistystep.io';
const client = new ConvexHttpClient(`${issuer}/backend`, { logger: false });
const directory = 'target/worker-images';
await mkdir(directory, { recursive: true });
const checks = [];
const request = (path, options) =>
  fetch(new URL(path, origin), {
    ...options,
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
  });
const post = (guestToken) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ guestToken }),
});
async function png(path, status, name, options) {
  const response = await request(path, options);
  assert.equal(response.status, status, name);
  assert.equal(response.headers.get('content-type'), 'image/png', name);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.deepEqual(
    bytes.subarray(0, 8),
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    name
  );
  checks.push({
    name,
    status,
    bytes: bytes.length,
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
  await writeFile(`${directory}/${name}.png`, bytes);
  return bytes;
}
async function denied(path, name, options) {
  const response = await request(path, options);
  assert.equal(response.status, 404, name);
  assert.equal(await response.text(), 'Poem not found or unavailable.', name);
  checks.push({ name, status: 404 });
}
async function guest() {
  const response = await fetch(`${issuer}/api/guest/session`, {
    signal: AbortSignal.timeout(30_000),
    redirect: 'error',
  });
  assert.equal(response.status, 200, 'synthetic preview guest issuer');
  const session = await response.json();
  assert.ok(session.token, 'issuer returned a guest credential');
  return session.token;
}
const host = await guest();
const writer = await guest();
const spectator = await guest();
let room;
let poemId;
try {
  room = await client.mutation(api.rooms.createRoom, {
    displayName: 'Image Host',
    guestToken: host,
  });
  await client.mutation(api.rooms.joinRoom, {
    code: room.code,
    displayName: 'Image Writer',
    guestToken: writer,
  });
  await client.mutation(api.game.startGame, {
    code: room.code,
    guestToken: host,
  });
  for (let round = 0; round < 9; round++) {
    for (const guestToken of [host, writer]) {
      const assignment = await client.query(api.game.getCurrentAssignment, {
        roomCode: room.code,
        guestToken,
      });
      assert.equal(assignment?.lineIndex, round);
      await client.mutation(api.game.submitLine, {
        poemId: assignment.poemId,
        lineIndex: round,
        text: Array(assignment.targetWordCount).fill('moon').join(' '),
        guestToken,
      });
    }
  }
  const reveal = await client.query(api.game.getRevealPhaseState, {
    roomCode: room.code,
    guestToken: host,
  });
  poemId = reveal.myPoem?._id;
  assert.ok(poemId, 'host has a real assigned poem');
  await client.mutation(api.game.revealPoem, { poemId, guestToken: host });
  const path = `/poem/${poemId}`;
  const unknown = '/poem/k970000000000000000000000000000a';
  await denied(`${unknown}/card`, 'unknown-get');
  await denied(`${unknown}/card`, 'unknown-post', post());
  const fallback = await png(`${unknown}/opengraph-image`, 404, 'unknown-og');
  await denied(`${path}/card`, 'private-get');
  await denied(`${path}/card`, 'spectator-post', post(spectator));
  await denied(`${path}/card`, 'anonymous-post', post());
  await denied(`${path}/card`, 'tampered-post', post('invalid-token'));
  const privateOg = await png(`${path}/opengraph-image`, 404, 'private-og');
  assert.deepEqual(privateOg, fallback, 'private OG has no poem text');
  const light = await png(`${path}/card`, 200, 'owned-light', post(host));
  const dark = await png(
    `${path}/card?mode=dark`,
    200,
    'owned-dark',
    post(host)
  );
  assert.notDeepEqual(light, dark, 'both color modes render');
  const share = await client.mutation(api.shares.preparePublicPoemShare, {
    poemId,
    guestToken: host,
  });
  await client.mutation(api.shares.activatePublicPoemShare, {
    poemId,
    slug: share.slug,
    nonce: share.nonce,
    guestToken: host,
  });
  const publicCard = await png(`${path}/card`, 200, 'public-card');
  assert.deepEqual(
    publicCard,
    light,
    'public and owned full-card rendering agree'
  );
  const publicOg = await png(`${path}/opengraph-image`, 200, 'public-og');
  assert.notDeepEqual(
    publicOg,
    fallback,
    'public OG contains the real preview'
  );
  await client.mutation(api.shares.disablePublicPoemShare, {
    poemId,
    guestToken: host,
  });
  await denied(`${path}/card`, 'revoked-get');
  assert.deepEqual(
    await png(`${path}/opengraph-image`, 404, 'revoked-og'),
    fallback,
    'revocation removes preview text'
  );
  await png('/opengraph-image', 200, 'site-og');
  const deployment = await (await request('/api/deployment')).json();
  assert.equal(deployment.deployment?.id, process.env.EXPECTED_SHA);
  await writeFile(
    `${directory}/receipt.json`,
    JSON.stringify(
      {
        source: process.env.EXPECTED_SHA,
        origin: origin.origin,
        backend: issuer,
        checks,
      },
      null,
      2
    )
  );
  console.log(
    JSON.stringify(
      { source: process.env.EXPECTED_SHA, checks, passed: true },
      null,
      2
    )
  );
} finally {
  if (poemId)
    await client.mutation(api.shares.disablePublicPoemShare, {
      poemId,
      guestToken: host,
    });
  if (room)
    await client.mutation(api.rooms.closeRoom, {
      roomCode: room.code,
      guestToken: host,
    });
}
