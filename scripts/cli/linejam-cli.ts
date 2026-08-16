#!/usr/bin/env npx tsx
/**
 * linejam-cli — terminal face over the same core scripts/lib/linejamClient.ts
 * exposes to the MCP server. Every subcommand is a thin argv-to-client-call
 * translation; no game logic lives here.
 *
 * Identity: pass an existing guest token via --guest-token / LINEJAM_GUEST_TOKEN
 * to keep acting as the same player across commands (a room membership is
 * tied to a guest identity). Omit it and `room create`/`room join` will mint
 * a fresh one and print it — capture it for follow-up commands.
 *
 * Usage:
 *   linejam-cli room create <displayName> [--guest-token TOKEN]
 *   linejam-cli room join <code> <displayName> [--guest-token TOKEN]
 *   linejam-cli room state <code> --guest-token TOKEN
 *   linejam-cli game start <code> --guest-token TOKEN
 *   linejam-cli game assignment <code> --guest-token TOKEN
 *   linejam-cli game submit-line <poemId> <lineIndex> <text> --guest-token TOKEN
 *   linejam-cli poems list <roomCode> --guest-token TOKEN
 *   linejam-cli poems get <poemId> --guest-token TOKEN
 *   linejam-cli favorites toggle <poemId> --guest-token TOKEN
 *   linejam-cli favorites list --guest-token TOKEN
 */

import {
  createLinejamClient,
  mintGuestToken,
  type LinejamClient,
  type LinejamClientResult,
} from '../lib/linejamClient';
import type { Id } from '@/convex/_generated/dataModel';

export type CliFlags = {
  positionals: string[];
  guestToken?: string;
};

export function parseFlags(argv: string[]): CliFlags {
  const positionals: string[] = [];
  let guestToken = process.env.LINEJAM_GUEST_TOKEN;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--guest-token') {
      guestToken = argv[++i];
    } else {
      positionals.push(argv[i]);
    }
  }
  return { positionals, guestToken };
}

async function resolveGuestToken(guestToken: string | undefined) {
  if (guestToken) return guestToken;
  const identity = await mintGuestToken();
  process.stderr.write(
    `(no --guest-token given — minted a fresh guest identity: ${identity.guestId}\n` +
      ` re-use it for follow-up commands: --guest-token ${identity.guestToken}\n)\n`
  );
  return identity.guestToken;
}

function toPoemId(poemId: string): Id<'poems'> {
  // SAFETY: Convex document ID branding is runtime-opaque and validated by the backend; the CLI ensures the positional argument is present.
  return poemId as Id<'poems'>;
}

export interface CliSuccessResult {
  ok: boolean;
}

export type CliOutput =
  | LinejamClientResult
  | CliSuccessResult
  | string
  | number
  | boolean
  | null
  | undefined;

function printJson(value: CliOutput) {
  process.stdout.write(JSON.stringify(value, null, 2) + '\n');
}

function printHelp() {
  process.stdout.write(
    `linejam-cli — terminal face over the Linejam Convex core\n\n` +
      `  room create <displayName>\n` +
      `  room join <code> <displayName>\n` +
      `  room state <code>\n` +
      `  game start <code>\n` +
      `  game assignment <code>\n` +
      `  game submit-line <poemId> <lineIndex> <text>\n` +
      `  poems list <roomCode>\n` +
      `  poems get <poemId>\n` +
      `  favorites toggle <poemId>\n` +
      `  favorites list\n\n` +
      `Identity: --guest-token TOKEN or LINEJAM_GUEST_TOKEN env var.\n` +
      `Deployment: NEXT_PUBLIC_CONVEX_URL env var (source .env.local for dev).\n`
  );
}

export async function run(argv: string[], injectedClient?: LinejamClient) {
  const [group, action, ...rest] = argv;
  if (!group || group === '--help' || group === '-h') {
    printHelp();
    return;
  }

  const { positionals, guestToken: rawToken } = parseFlags(rest);
  const client = injectedClient ?? createLinejamClient();

  if (group === 'room' && action === 'create') {
    const [displayName] = positionals;
    if (!displayName) throw new Error('usage: room create <displayName>');
    const guestToken = await resolveGuestToken(rawToken);
    printJson(await client.createRoom({ displayName, guestToken }));
    return;
  }

  if (group === 'room' && action === 'join') {
    const [code, displayName] = positionals;
    if (!code || !displayName)
      throw new Error('usage: room join <code> <displayName>');
    const guestToken = await resolveGuestToken(rawToken);
    printJson(await client.joinRoom({ code, displayName, guestToken }));
    return;
  }

  if (group === 'room' && action === 'state') {
    const [code] = positionals;
    if (!code) throw new Error('usage: room state <code>');
    if (!rawToken) throw new Error('room state requires --guest-token');
    printJson(await client.getRoomState({ code, guestToken: rawToken }));
    return;
  }

  if (group === 'game' && action === 'start') {
    const [code] = positionals;
    if (!code) throw new Error('usage: game start <code>');
    if (!rawToken) throw new Error('game start requires --guest-token');
    printJson(await client.startGame({ code, guestToken: rawToken }));
    return;
  }

  if (group === 'game' && action === 'assignment') {
    const [roomCode] = positionals;
    if (!roomCode) throw new Error('usage: game assignment <code>');
    if (!rawToken) throw new Error('game assignment requires --guest-token');
    printJson(
      await client.getCurrentAssignment({ roomCode, guestToken: rawToken })
    );
    return;
  }

  if (group === 'game' && action === 'submit-line') {
    const [poemId, lineIndexRaw, ...textParts] = positionals;
    const text = textParts.join(' ');
    if (!poemId || lineIndexRaw === undefined || !text)
      throw new Error('usage: game submit-line <poemId> <lineIndex> <text...>');
    if (!rawToken) throw new Error('game submit-line requires --guest-token');
    printJson(
      await client.submitLine({
        poemId: toPoemId(poemId),
        lineIndex: Number(lineIndexRaw),
        text,
        guestToken: rawToken,
      })
    );
    return;
  }

  if (group === 'poems' && action === 'list') {
    const [roomCode] = positionals;
    if (!roomCode) throw new Error('usage: poems list <roomCode>');
    if (!rawToken) throw new Error('poems list requires --guest-token');
    printJson(await client.getPoemsForRoom({ roomCode, guestToken: rawToken }));
    return;
  }

  if (group === 'poems' && action === 'get') {
    const [poemId] = positionals;
    if (!poemId) throw new Error('usage: poems get <poemId>');
    if (!rawToken) throw new Error('poems get requires --guest-token');
    printJson(
      await client.getPoemDetail({
        poemId: toPoemId(poemId),
        guestToken: rawToken,
      })
    );
    return;
  }

  if (group === 'favorites' && action === 'toggle') {
    const [poemId] = positionals;
    if (!poemId) throw new Error('usage: favorites toggle <poemId>');
    if (!rawToken) throw new Error('favorites toggle requires --guest-token');
    await client.toggleFavorite({
      poemId: toPoemId(poemId),
      guestToken: rawToken,
    });
    printJson({ ok: true });
    return;
  }

  if (group === 'favorites' && action === 'list') {
    if (!rawToken) throw new Error('favorites list requires --guest-token');
    printJson(await client.getMyFavorites({ guestToken: rawToken }));
    return;
  }

  printHelp();
  process.exitCode = 1;
}

async function main() {
  await run(process.argv.slice(2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(
      `error: ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  });
}
