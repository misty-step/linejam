# linejam-920 MCP Registration Proof

Card: `linejam-920`

This transcript proves the documented Codex MCP registration path using a
temporary server name, then removes that temporary registration. Secret values
are not printed.

## Commands

```bash
codex mcp add linejam-920-proof-20260707 -- bash -lc 'cd /Users/phaedrus/Development/linejam && set -a && [ -f .env.local ] && . ./.env.local; set +a; exec pnpm agent:mcp'
codex mcp get linejam-920-proof-20260707
node --input-type=module <<'NODE'
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

const child = spawn(
  'bash',
  [
    '-lc',
    'cd /Users/phaedrus/Development/linejam && set -a && [ -f .env.local ] && . ./.env.local; set +a; exec pnpm agent:mcp',
  ],
  { stdio: ['pipe', 'pipe', 'pipe'] }
);
const rl = createInterface({ input: child.stdout });
const responses = new Map();
rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    const msg = JSON.parse(trimmed);
    responses.set(msg.id, msg);
  } catch {
    // Ignore package-manager startup lines. MCP responses are JSON-RPC.
  }
});

function send(id, method, params) {
  child.stdin.write(
    JSON.stringify({
      jsonrpc: '2.0',
      id,
      method,
      ...(params ? { params } : {}),
    }) + '\n'
  );
}

async function waitFor(id) {
  const start = Date.now();
  while (!responses.has(id)) {
    if (Date.now() - start > 15000) {
      throw new Error(`timed out waiting for response ${id}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return responses.get(id);
}

send(1, 'initialize', {});
const init = await waitFor(1);
send(2, 'tools/list', {});
const list = await waitFor(2);
send(3, 'tools/call', {
  name: 'linejam_mint_guest',
  arguments: {},
});
const mint = await waitFor(3);
child.stdin.end();
child.kill('SIGTERM');

const tools = list.result.tools.map((tool) => tool.name);
const mintPayload = JSON.parse(mint.result.content[0].text);
console.log(
  JSON.stringify(
    {
      initialize: init.result.serverInfo,
      toolCount: tools.length,
      hasMintGuest: tools.includes('linejam_mint_guest'),
      firstTools: tools.slice(0, 4),
      mintedGuestIdShape:
        typeof mintPayload.guestId === 'string' &&
        mintPayload.guestId.length > 20,
      mintedGuestTokenShape:
        typeof mintPayload.guestToken === 'string' &&
        mintPayload.guestToken.includes('.'),
    },
    null,
    2
  )
);
NODE
codex mcp remove linejam-920-proof-20260707
```

## Result

```text
Added global MCP server 'linejam-920-proof-20260707'.
linejam-920-proof-20260707
  enabled: true
  transport: stdio
  command: bash
  args: -lc cd /Users/phaedrus/Development/linejam && set -a && [ -f .env.local ] && . ./.env.local; set +a; exec pnpm agent:mcp
  cwd: -
  env: -
  remove: codex mcp remove linejam-920-proof-20260707
{
  "initialize": {
    "name": "linejam-mcp",
    "version": "0.1.0"
  },
  "toolCount": 11,
  "hasMintGuest": true,
  "firstTools": [
    "linejam_mint_guest",
    "linejam_create_room",
    "linejam_join_room",
    "linejam_room_state"
  ],
  "mintedGuestIdShape": true,
  "mintedGuestTokenShape": true
}
Removed global MCP server 'linejam-920-proof-20260707'.
```
