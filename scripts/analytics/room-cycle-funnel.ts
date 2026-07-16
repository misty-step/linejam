#!/usr/bin/env tsx
import { readFile } from 'node:fs/promises';
import {
  buildRoomCycleFunnelReport,
  type RoomCycleFunnelInput,
} from '../../lib/analytics/roomCycleFunnel';

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
  const input = JSON.parse(await readFile(inputPath, 'utf8')) as Omit<
    RoomCycleFunnelInput,
    'from' | 'to'
  >;
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
