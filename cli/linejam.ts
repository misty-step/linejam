#!/usr/bin/env node
// linejam — the command-line face. A thin argv-to-HTTP adapter over the same
// Worker API the browser uses.
//
//   Success:   the result as JSON on stdout, exit 0.
//   Rejection: {"error":{code,message,status}} on stderr, nothing on stdout, exit 1.
//   Usage:     the same shape on stderr, exit 2.
//   A minted guest credential is reported on stderr only — never on stdout.
import { EMBLEMS, isEmblem } from '../shared/rules.ts';
import { Linejam, Rejection, baseUrl } from './client.ts';

const USAGE = `linejam <group> <action> [args] [--guest-token TOKEN] [--emblem ID]

  guest mint
  room create <penName>
  room join <code> <penName>
  room state <code>
  game start <code>
  game assignment <code>
  game submit-line <code> <poemId> <lineIndex> <text...>
  game reveal <code> <poemId>
  poems list
  poems get <poemId>
  favorites toggle <poemId>
  favorites list

Target:   LINEJAM_URL (for example http://127.0.0.1:8787)
Identity: --guest-token TOKEN or LINEJAM_GUEST_TOKEN. \`room create\` and \`room join\`
          mint a guest when none is given and report it on stderr.
Emblems:  ${EMBLEMS.join(', ')}
`;

class Usage extends Error {}

function parse(argv: string[]): { words: string[]; token: string | null; emblem: string } {
  const words: string[] = [];
  let token = process.env.LINEJAM_GUEST_TOKEN ?? null;
  let emblem: string = EMBLEMS[0];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--guest-token' || arg === '--emblem') {
      const value = argv[++i];
      if (!value) throw new Usage(`${arg} needs a value`);
      if (arg === '--guest-token') token = value;
      else emblem = value;
    } else words.push(arg);
  }
  if (!isEmblem(emblem)) throw new Usage(`Unknown emblem "${emblem}". Emblems: ${EMBLEMS.join(', ')}`);
  return { words, token, emblem };
}

async function run(argv: string[]): Promise<unknown> {
  const { words, token, emblem } = parse(argv);
  const [group, action, ...rest] = words;
  const need = (count: number, shape: string) => {
    if (rest.length < count) throw new Usage(`usage: linejam ${shape}`);
  };
  let client = new Linejam(baseUrl(), token);
  const identified = () => {
    if (!token) throw new Usage(`${group} ${action} needs --guest-token or LINEJAM_GUEST_TOKEN`);
  };
  const mintIfNeeded = async () => {
    if (token) return;
    const minted = await client.mintGuest();
    // The credential goes to stderr, apart from the shareable result on stdout.
    process.stderr.write(JSON.stringify({ minted }) + '\n');
    client = client.as(minted.guestToken);
  };

  switch (`${group} ${action}`) {
    case 'guest mint': {
      const minted = await client.mintGuest();
      process.stderr.write(JSON.stringify({ minted }) + '\n');
      return { guestId: minted.guestId };
    }
    case 'room create':
      need(1, 'room create <penName>');
      await mintIfNeeded();
      return client.createRoom(rest.join(' '), emblem);
    case 'room join':
      need(2, 'room join <code> <penName>');
      await mintIfNeeded();
      return client.joinRoom(rest[0]!, rest.slice(1).join(' '), emblem);
    case 'room state':
      need(1, 'room state <code>');
      identified();
      return client.roomState(rest[0]!);
    case 'game start':
      need(1, 'game start <code>');
      identified();
      return client.startGame(rest[0]!);
    case 'game assignment':
      need(1, 'game assignment <code>');
      identified();
      return client.assignment(rest[0]!);
    case 'game submit-line': {
      need(4, 'game submit-line <code> <poemId> <lineIndex> <text...>');
      identified();
      const lineIndex = Number(rest[2]);
      if (!Number.isInteger(lineIndex)) throw new Usage('lineIndex must be an integer');
      return client.submitLine(rest[0]!, rest[1]!, lineIndex, rest.slice(3).join(' '));
    }
    case 'game reveal':
      need(2, 'game reveal <code> <poemId>');
      identified();
      return client.revealPoem(rest[0]!, rest[1]!);
    case 'poems list':
      identified();
      return client.listPoems();
    case 'poems get':
      need(1, 'poems get <poemId>');
      identified();
      return client.getPoem(rest[0]!);
    case 'favorites toggle':
      need(1, 'favorites toggle <poemId>');
      identified();
      return client.toggleFavorite(rest[0]!);
    case 'favorites list':
      identified();
      return client.listFavorites();
    default:
      throw new Usage(`Unknown command "${words.join(' ')}"`);
  }
}

const argv = process.argv.slice(2);
if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
  process.stdout.write(USAGE);
  process.exit(0);
}

try {
  const result = await run(argv);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
} catch (error) {
  if (error instanceof Rejection) {
    process.stderr.write(
      JSON.stringify({ error: { code: error.code, message: error.message, status: error.status } }) + '\n'
    );
    process.exit(1);
  }
  if (error instanceof Usage) {
    process.stderr.write(JSON.stringify({ error: { code: 'usage', message: error.message, status: 0 } }) + '\n');
    process.exit(2);
  }
  throw error;
}
