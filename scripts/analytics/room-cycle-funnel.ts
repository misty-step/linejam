#!/usr/bin/env tsx
import { readFile } from 'node:fs/promises';
import {
  buildRoomCycleFunnelReport,
  type RoomCycleFunnelInput,
} from '../../lib/analytics/roomCycleFunnel';
type FunnelProjectionPayload = Omit<RoomCycleFunnelInput, 'from' | 'to'>;

function parseFunnelProjection(raw: string): FunnelProjectionPayload {
  const parsed = JSON.parse(raw);
  if (
    !parsed ||
    Array.isArray(parsed) ||
    Object.prototype.toString.call(parsed) !== '[object Object]'
  ) {
    throw new Error('Funnel projection must be a JSON object');
  }
  const rooms = Array.isArray(parsed.rooms) ? parsed.rooms : [];
  const events = Array.isArray(parsed.events) ? parsed.events : [];
  return { rooms, events };
}

function readFlag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}
async function main() {
  const inputPath = readFlag('--input');
  const from = readFlag('--from');
  const to = readFlag('--to');
  if (!inputPath || !from || !to) {
    console.error(
      'Usage: pnpm analytics:room-cycle -- --input <projection.json> --from <ISO> --to <ISO>'
    );
    process.exitCode = 2;
    return;
  }
  const fromTimestamp = Date.parse(from);
  const toTimestamp = Date.parse(to);
  if (
    !Number.isFinite(fromTimestamp) ||
    !Number.isFinite(toTimestamp) ||
    toTimestamp <= fromTimestamp
  ) {
    console.error(
      'Invalid funnel window: provide finite ISO timestamps with --to after --from'
    );
    process.exitCode = 2;
    return;
  }
  const input = parseFunnelProjection(await readFile(inputPath, 'utf8'));
  const report = buildRoomCycleFunnelReport({
    ...input,
    from: fromTimestamp,
    to: toTimestamp,
  });
  process.stdout.write(
    JSON.stringify(report, null, 2) + String.fromCharCode(10)
  );
}

void main();
