import {
  access,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

const ROOT_DIR = path.resolve(
  process.env.LINEJAM_CANARY_STORE_DIR || '.canary'
);
const PRUNABLE_SUBDIRECTORIES = [
  'agentic',
  'contexts',
  'deliveries',
  'fingerprints',
  'smoke',
  'summaries',
];

function sanitizeSegment(value) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '-');
}

export function agenticArtifactDir(
  deliveryId,
  storeDir = process.env.LINEJAM_CANARY_STORE_DIR || '.canary'
) {
  const normalizedDeliveryId = sanitizeSegment(String(deliveryId || 'manual'));
  return path.join(storeDir, 'agentic', normalizedDeliveryId);
}

async function ensureSubdirectory(name) {
  const dir = path.join(ROOT_DIR, name);
  await mkdir(dir, { recursive: true });
  return dir;
}

function buildDeliveryKey(deliveryId, sequence) {
  const normalizedDeliveryId = sanitizeSegment((deliveryId || '').trim());
  const normalizedSequence = sanitizeSegment(String(sequence ?? 0));

  if (!normalizedDeliveryId) {
    return `missing-${normalizedSequence}-${randomUUID()}`;
  }

  return `${normalizedDeliveryId}-${normalizedSequence}`;
}

export async function deliveryExists(deliveryId, sequence) {
  const file = await deliveryPath(deliveryId, sequence);

  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

export async function deliveryPath(deliveryId, sequence) {
  const dir = await ensureSubdirectory('deliveries');
  return path.join(dir, `${buildDeliveryKey(deliveryId, sequence)}.json`);
}

export async function persistDelivery(deliveryId, sequence, payload) {
  const file = await deliveryPath(deliveryId, sequence);
  await writeFile(file, JSON.stringify(payload, null, 2));
  return file;
}

export async function listPendingSmokeDeliveries() {
  const dir = await ensureSubdirectory('deliveries');
  const entries = await readdir(dir);
  const pending = [];

  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;

    const file = path.join(dir, entry);
    let payload;
    try {
      payload = JSON.parse(await readFile(file, 'utf8'));
    } catch {
      continue;
    }

    if (
      payload?.smoke?.status !== 'pending' ||
      payload?.smoke?.queued !== true ||
      typeof payload?.deliveryId !== 'string' ||
      typeof payload?.eventName !== 'string'
    ) {
      continue;
    }

    pending.push({
      deliveryId: payload.deliveryId,
      eventName: payload.eventName,
      service:
        typeof payload.service === 'string' && payload.service.length > 0
          ? payload.service
          : 'unknown',
      sequence:
        typeof payload.sequence === 'number' &&
        Number.isFinite(payload.sequence)
          ? payload.sequence
          : 0,
      deliveryRecord: payload,
    });
  }

  pending.sort((left, right) =>
    String(left.deliveryRecord?.receivedAt || '').localeCompare(
      String(right.deliveryRecord?.receivedAt || '')
    )
  );

  return pending;
}

export async function fingerprintPath(fingerprint) {
  const dir = await ensureSubdirectory('fingerprints');
  return path.join(dir, `${sanitizeSegment(fingerprint)}.json`);
}

export async function fingerprintExists(fingerprint) {
  const file = await fingerprintPath(fingerprint);

  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

export async function persistFingerprint(fingerprint, payload) {
  const file = await fingerprintPath(fingerprint);
  await writeFile(file, JSON.stringify(payload, null, 2));
  return file;
}

export async function persistJson(kind, name, payload) {
  const dir = await ensureSubdirectory(kind);
  const filename = `${new Date().toISOString().replaceAll(':', '-')}-${sanitizeSegment(name)}.json`;
  const file = path.join(dir, filename);
  await writeFile(file, JSON.stringify(payload, null, 2));
  return file;
}

export async function persistSummary(name, body) {
  const dir = await ensureSubdirectory('summaries');
  const filename = `${new Date().toISOString().replaceAll(':', '-')}-${sanitizeSegment(name)}.md`;
  const file = path.join(dir, filename);
  await writeFile(file, body);
  return file;
}

function getRetentionDays() {
  const parsed = Number.parseInt(
    process.env.LINEJAM_CANARY_RETENTION_DAYS || '14',
    10
  );

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 14;
}

export async function pruneExpiredArtifacts({
  now = Date.now(),
  retentionDays = getRetentionDays(),
} = {}) {
  if (retentionDays === 0) {
    return { deletedFiles: [], cutoffTimestamp: null };
  }

  const cutoffTimestamp = now - retentionDays * 24 * 60 * 60 * 1000;
  const deletedFiles = [];

  for (const subdirectory of PRUNABLE_SUBDIRECTORIES) {
    const dir = path.join(ROOT_DIR, subdirectory);

    let entries;
    try {
      entries = await readdir(dir);
    } catch {
      continue;
    }

    for (const entry of entries) {
      const file = path.join(dir, entry);

      let metadata;
      try {
        metadata = await stat(file);
      } catch {
        continue;
      }

      if (metadata.mtimeMs >= cutoffTimestamp) {
        continue;
      }

      if (metadata.isDirectory()) {
        await rm(file, { recursive: true, force: true });
        deletedFiles.push(file);
      } else if (metadata.isFile()) {
        await unlink(file);
        deletedFiles.push(file);
      }
    }
  }

  return { deletedFiles, cutoffTimestamp };
}
