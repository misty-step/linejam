#!/usr/bin/env npx tsx
/**
 * linejam-mcp — stdio JSON-RPC 2.0 MCP server, the agent-facing face over
 * the same core scripts/lib/linejamClient.ts the CLI wraps. One
 * request-per-line on stdin, one response-per-line on stdout (the fleet's
 * stdio MCP convention — see glass/canary/powder-mcp for the Rust
 * equivalent of this same shape).
 *
 * Handles: initialize, tools/list, tools/call. Every tool call is a thin
 * translation into a linejamClient method; no game logic lives here.
 */

import * as readline from 'node:readline';
import { createLinejamClient, mintGuestToken } from '../lib/linejamClient';
import type { Id } from '@/convex/_generated/dataModel';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number | string | null;
  method: string;
  params?: Record<string, unknown>;
}

interface ToolDef {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
}

const guestTokenProp = {
  type: 'string',
  description:
    'Guest identity token from a prior linejam_create_room/linejam_join_room/linejam_mint_guest call. Required for every tool except linejam_mint_guest.',
};

export const TOOLS: ToolDef[] = [
  {
    name: 'linejam_mint_guest',
    description:
      'Mint a fresh guest identity (guestId + guestToken) without joining a room yet. Use when you need an identity before creating or joining.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'linejam_create_room',
    description:
      'Create a new room and join it as host. Returns a 4-letter room code to share with other players.',
    inputSchema: {
      type: 'object',
      properties: {
        displayName: {
          type: 'string',
          description: 'Name shown to other players',
        },
        guestToken: guestTokenProp,
      },
      required: ['displayName', 'guestToken'],
    },
  },
  {
    name: 'linejam_join_room',
    description: 'Join an existing room by its 4-letter code.',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: '4-letter room code' },
        displayName: { type: 'string' },
        guestToken: guestTokenProp,
      },
      required: ['code', 'displayName', 'guestToken'],
    },
  },
  {
    name: 'linejam_room_state',
    description:
      'Full room snapshot: status, player list, and whether the caller is host. Caller must already be a participant.',
    inputSchema: {
      type: 'object',
      properties: { code: { type: 'string' }, guestToken: guestTokenProp },
      required: ['code', 'guestToken'],
    },
  },
  {
    name: 'linejam_start_game',
    description:
      'Start the game once >=2 players are in the lobby. Host-only for the first game; any participant may start a rematch.',
    inputSchema: {
      type: 'object',
      properties: { code: { type: 'string' }, guestToken: guestTokenProp },
      required: ['code', 'guestToken'],
    },
  },
  {
    name: 'linejam_current_assignment',
    description:
      'What the caller is assigned to do right now: which poem, which line index, the target word count, and the previous line to build on.',
    inputSchema: {
      type: 'object',
      properties: { roomCode: { type: 'string' }, guestToken: guestTokenProp },
      required: ['roomCode', 'guestToken'],
    },
  },
  {
    name: 'linejam_submit_line',
    description:
      "Submit the caller's line for their current assignment. The core creative verb of the game.",
    inputSchema: {
      type: 'object',
      properties: {
        poemId: { type: 'string' },
        lineIndex: { type: 'number' },
        text: { type: 'string' },
        guestToken: guestTokenProp,
      },
      required: ['poemId', 'lineIndex', 'text', 'guestToken'],
    },
  },
  {
    name: 'linejam_list_poems',
    description:
      "All poems for the room's current game, each with a one-line preview.",
    inputSchema: {
      type: 'object',
      properties: { roomCode: { type: 'string' }, guestToken: guestTokenProp },
      required: ['roomCode', 'guestToken'],
    },
  },
  {
    name: 'linejam_get_poem',
    description:
      "A single poem's full text, line by line, with authors resolved.",
    inputSchema: {
      type: 'object',
      properties: { poemId: { type: 'string' }, guestToken: guestTokenProp },
      required: ['poemId', 'guestToken'],
    },
  },
  {
    name: 'linejam_toggle_favorite',
    description: 'Toggle whether the caller has favorited a poem.',
    inputSchema: {
      type: 'object',
      properties: { poemId: { type: 'string' }, guestToken: guestTokenProp },
      required: ['poemId', 'guestToken'],
    },
  },
  {
    name: 'linejam_list_favorites',
    description: 'Every poem the caller has favorited, newest first.',
    inputSchema: {
      type: 'object',
      properties: { guestToken: guestTokenProp },
      required: ['guestToken'],
    },
  },
];

/** Dispatches one tool call. `injectedClient` is optional so tests can pass
 * a mock without the real ConvexHttpClient (the network/system boundary)
 * ever loading; production calls build the real client lazily, and never at
 * all for linejam_mint_guest (which needs no Convex deployment). */
export async function callTool(
  name: string,
  args: Record<string, unknown>,
  injectedClient?: ReturnType<typeof createLinejamClient>
) {
  if (name === 'linejam_mint_guest') {
    return mintGuestToken();
  }

  const client = injectedClient ?? createLinejamClient();

  switch (name) {
    case 'linejam_create_room':
      return client.createRoom(
        args as { displayName: string; guestToken?: string }
      );
    case 'linejam_join_room':
      return client.joinRoom(
        args as { code: string; displayName: string; guestToken?: string }
      );
    case 'linejam_room_state':
      return client.getRoomState(args as { code: string; guestToken?: string });
    case 'linejam_start_game':
      return client.startGame(args as { code: string; guestToken?: string });
    case 'linejam_current_assignment':
      return client.getCurrentAssignment(
        args as { roomCode: string; guestToken?: string }
      );
    case 'linejam_submit_line':
      return client.submitLine(
        args as {
          poemId: Id<'poems'>;
          lineIndex: number;
          text: string;
          guestToken?: string;
        }
      );
    case 'linejam_list_poems':
      return client.getPoemsForRoom(
        args as { roomCode: string; guestToken?: string }
      );
    case 'linejam_get_poem':
      return client.getPoemDetail(
        args as { poemId: Id<'poems'>; guestToken?: string }
      );
    case 'linejam_toggle_favorite':
      return client.toggleFavorite(
        args as { poemId: Id<'poems'>; guestToken?: string }
      );
    case 'linejam_list_favorites':
      return client.getMyFavorites(args as { guestToken?: string });
    default:
      throw new Error(`unknown tool: ${name}`);
  }
}

function reply(id: JsonRpcRequest['id'], result: unknown) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
}

function replyError(id: JsonRpcRequest['id'], message: string) {
  process.stdout.write(
    JSON.stringify({
      jsonrpc: '2.0',
      id,
      error: { code: -32000, message },
    }) + '\n'
  );
}

export async function handleRequest(request: JsonRpcRequest) {
  const { id, method, params } = request;

  if (method === 'initialize') {
    reply(id, {
      protocolVersion: '2024-11-05',
      serverInfo: { name: 'linejam-mcp', version: '0.1.0' },
      capabilities: { tools: {} },
    });
    return;
  }

  if (method === 'tools/list') {
    reply(id, { tools: TOOLS });
    return;
  }

  if (method === 'tools/call') {
    const name = params?.name as string | undefined;
    const args = (params?.arguments as Record<string, unknown>) ?? {};
    if (!name) {
      replyError(id, 'tools/call requires params.name');
      return;
    }
    try {
      const result = await callTool(name, args);
      reply(id, {
        content: [{ type: 'text', text: JSON.stringify(result) }],
      });
    } catch (error) {
      replyError(id, error instanceof Error ? error.message : String(error));
    }
    return;
  }

  replyError(id, `unknown method: ${method}`);
}

function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    terminal: false,
  });
  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let request: JsonRpcRequest;
    try {
      request = JSON.parse(trimmed);
    } catch {
      replyError(null, 'invalid JSON-RPC request');
      return;
    }
    handleRequest(request).catch((error) => {
      replyError(
        request.id ?? null,
        error instanceof Error ? error.message : String(error)
      );
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
