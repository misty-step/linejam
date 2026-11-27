#!/usr/bin/env node
// linejam-mcp — a Model Context Protocol server over stdio (JSON-RPC 2.0, one
// message per line). Every tool is one call to the same Worker HTTP API the
// browser and the CLI use, with the caller's guest credential.
//
//   A rejected game action  → a tool result with isError: true.
//   A malformed request     → a JSON-RPC protocol error.
//   initialize / tools/list → no network call; discovery creates nothing.
import { createInterface } from 'node:readline';
import { EMBLEMS, isEmblem } from '../shared/rules.ts';
import { Linejam, Rejection, baseUrl } from './client.ts';

const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const SERVER = { name: 'linejam-mcp', version: '1.0.0' };

type Json = Record<string, unknown>;
type Property = { type: 'string' | 'integer'; description: string; enum?: readonly string[] };

interface Tool {
  name: string;
  description: string;
  properties: Record<string, Property>;
  required: string[];
  run(client: Linejam, args: Record<string, any>): Promise<unknown>;
}

const guestToken: Property = { type: 'string', description: 'Guest credential from linejam_mint_guest' };
const code: Property = { type: 'string', description: '4-character room code' };
const penName: Property = { type: 'string', description: 'Name shown to the room' };
const emblem: Property = { type: 'string', description: 'Cast emblem', enum: EMBLEMS };
const poemId: Property = { type: 'string', description: 'Poem identifier' };

const TOOLS: Tool[] = [
  {
    name: 'linejam_mint_guest',
    description: 'Mint a guest identity. Returns the guestToken every other tool requires. Treat it as a credential.',
    properties: {},
    required: [],
    run: (client) => client.mintGuest(),
  },
  {
    name: 'linejam_create_room',
    description: 'Create a room and become its host.',
    properties: { guestToken, penName, emblem },
    required: ['guestToken', 'penName'],
    run: (client, a) => client.createRoom(a.penName, a.emblem ?? EMBLEMS[0]),
  },
  {
    name: 'linejam_join_room',
    description: 'Join an existing room by its 4-character code.',
    properties: { guestToken, code, penName, emblem },
    required: ['guestToken', 'code', 'penName'],
    run: (client, a) => client.joinRoom(a.code, a.penName, a.emblem ?? EMBLEMS[0]),
  },
  {
    name: 'linejam_room_state',
    description: "The caller's view of a room: phase, roster, presence and (while writing) their assignment.",
    properties: { guestToken, code },
    required: ['guestToken', 'code'],
    run: (client, a) => client.roomState(a.code),
  },
  {
    name: 'linejam_start_game',
    description: 'Start a game. Host only; needs at least 2 present players.',
    properties: { guestToken, code },
    required: ['guestToken', 'code'],
    run: (client, a) => client.startGame(a.code),
  },
  {
    name: 'linejam_current_assignment',
    description:
      "The caller's line to write this round: poemId, lineIndex, target word count and only the preceding line.",
    properties: { guestToken, code },
    required: ['guestToken', 'code'],
    run: (client, a) => client.assignment(a.code),
  },
  {
    name: 'linejam_submit_line',
    description: 'Submit the line for the current assignment. The word count must equal the round target exactly.',
    properties: {
      guestToken,
      code,
      poemId,
      lineIndex: { type: 'integer', description: '0-based line index from the assignment' },
      text: { type: 'string', description: 'The line' },
    },
    required: ['guestToken', 'code', 'poemId', 'lineIndex', 'text'],
    run: (client, a) => client.submitLine(a.code, a.poemId, a.lineIndex, a.text),
  },
  {
    name: 'linejam_reveal_poem',
    description: 'Reveal the next poem in the reading circle. The assigned reader has authority while present.',
    properties: { guestToken, code, poemId },
    required: ['guestToken', 'code', 'poemId'],
    run: (client, a) => client.revealPoem(a.code, a.poemId),
  },
  {
    name: 'linejam_list_poems',
    description: 'Completed poems the caller wrote on: favorites first, then newest.',
    properties: { guestToken },
    required: ['guestToken'],
    run: (client) => client.listPoems(),
  },
  {
    name: 'linejam_get_poem',
    description: 'One completed poem the caller took part in, with its nine lines and bylines.',
    properties: { guestToken, poemId },
    required: ['guestToken', 'poemId'],
    run: (client, a) => client.getPoem(a.poemId),
  },
  {
    name: 'linejam_toggle_favorite',
    description: 'Toggle whether the caller has favorited a poem. Private; never publishes.',
    properties: { guestToken, poemId },
    required: ['guestToken', 'poemId'],
    run: (client, a) => client.toggleFavorite(a.poemId),
  },
  {
    name: 'linejam_list_favorites',
    description: 'Every poem the caller has favorited, newest first.',
    properties: { guestToken },
    required: ['guestToken'],
    run: (client) => client.listFavorites(),
  },
];

class ProtocolError extends Error {
  readonly code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

function send(message: Json): void {
  process.stdout.write(JSON.stringify(message) + '\n');
}

function validate(tool: Tool, args: unknown): Record<string, any> {
  if (typeof args !== 'object' || args === null || Array.isArray(args)) {
    throw new ProtocolError(-32602, 'arguments must be an object');
  }
  const given = args as Record<string, unknown>;
  for (const name of tool.required) {
    if (given[name] === undefined) throw new ProtocolError(-32602, `Missing required argument: ${name}`);
  }
  for (const [name, value] of Object.entries(given)) {
    const property = tool.properties[name];
    if (!property) throw new ProtocolError(-32602, `Unknown argument: ${name}`);
    const ok = property.type === 'integer' ? Number.isInteger(value) : typeof value === 'string';
    if (!ok)
      throw new ProtocolError(
        -32602,
        `Argument ${name} must be ${property.type === 'integer' ? 'an integer' : 'a string'}`
      );
  }
  if (given.emblem !== undefined && !isEmblem(given.emblem))
    throw new ProtocolError(-32602, `Unknown emblem: ${String(given.emblem)}`);
  return given;
}

async function handle(method: string, params: unknown): Promise<Json> {
  switch (method) {
    case 'initialize': {
      const requested = (params as { protocolVersion?: unknown } | undefined)?.protocolVersion;
      const protocolVersion =
        typeof requested === 'string' && PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSIONS[0]!;
      return { protocolVersion, capabilities: { tools: {} }, serverInfo: SERVER };
    }
    case 'ping':
      return {};
    case 'tools/list':
      return {
        tools: TOOLS.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: {
            type: 'object',
            properties: tool.properties,
            required: tool.required,
            additionalProperties: false,
          },
        })),
      };
    case 'tools/call': {
      const { name, arguments: args } = (params ?? {}) as { name?: unknown; arguments?: unknown };
      const tool = TOOLS.find((t) => t.name === name);
      if (!tool) throw new ProtocolError(-32602, `Unknown tool: ${String(name)}`);
      const given = validate(tool, args ?? {});
      try {
        const client = new Linejam(baseUrl(), typeof given.guestToken === 'string' ? given.guestToken : null);
        const result = await tool.run(client, given);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (error) {
        if (!(error instanceof Rejection)) throw error;
        // The game said no: that is a tool error, not a successful action.
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: { code: error.code, message: error.message, status: error.status } }),
            },
          ],
        };
      }
    }
    default:
      throw new ProtocolError(-32601, `Method not found: ${method}`);
  }
}

const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
let chain: Promise<void> = Promise.resolve();

lines.on('line', (line) => {
  if (!line.trim()) return;
  // One message at a time, in order.
  chain = chain.then(async () => {
    let message: Json;
    try {
      message = JSON.parse(line) as Json;
    } catch {
      send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
      return;
    }
    const id = message.id as string | number | null | undefined;
    if (
      typeof message !== 'object' ||
      message === null ||
      message.jsonrpc !== '2.0' ||
      typeof message.method !== 'string'
    ) {
      send({ jsonrpc: '2.0', id: id ?? null, error: { code: -32600, message: 'Invalid Request' } });
      return;
    }
    // Notifications get no response.
    if (id === undefined) return;
    try {
      send({ jsonrpc: '2.0', id, result: await handle(message.method, message.params) });
    } catch (error) {
      if (error instanceof ProtocolError)
        send({ jsonrpc: '2.0', id, error: { code: error.code, message: error.message } });
      else send({ jsonrpc: '2.0', id, error: { code: -32603, message: 'Internal error' } });
    }
  });
});

lines.on('close', () => void chain.then(() => process.exit(0)));
