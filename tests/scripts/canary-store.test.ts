/** @vitest-environment node */
import { mkdtemp, readFile, rm, utimes } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadStoreModule(storeDir: string) {
  process.env.LINEJAM_CANARY_STORE_DIR = storeDir;
  vi.resetModules();
  return import('@/scripts/canary/store.mjs');
}

describe('canary store helpers', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    delete process.env.LINEJAM_CANARY_STORE_DIR;
    await Promise.all(
      tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
    );
  });

  it('persists deliveries and reports existence', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'linejam-canary-store-'));
    tempDirs.push(dir);
    const store = await loadStoreModule(dir);

    expect(await store.deliveryExists('evt/1', 3)).toBe(false);

    const file = await store.persistDelivery('evt/1', 3, { ok: true });
    expect(file).toContain(path.join(dir, 'deliveries'));
    expect(file.endsWith('evt-1-3.json')).toBe(true);
    expect(await store.deliveryExists('evt/1', 3)).toBe(true);

    const payload = JSON.parse(await readFile(file, 'utf8'));
    expect(payload).toEqual({ ok: true });
  });

  it('lists pending smoke deliveries in received order', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'linejam-canary-store-'));
    tempDirs.push(dir);
    const store = await loadStoreModule(dir);

    await store.persistDelivery('evt-done', 0, {
      deliveryId: 'evt-done',
      eventName: 'error.new_class',
      receivedAt: '2026-04-08T00:00:03.000Z',
      smoke: { status: 'succeeded', queued: false },
    });
    await store.persistDelivery('evt-2', 0, {
      deliveryId: 'evt-2',
      eventName: 'incident.opened',
      service: 'linejam',
      sequence: 0,
      receivedAt: '2026-04-08T00:00:02.000Z',
      smoke: { status: 'pending', queued: true },
    });
    await store.persistDelivery('evt-1', 3, {
      deliveryId: 'evt-1',
      eventName: 'error.new_class',
      service: 'linejam',
      sequence: 3,
      receivedAt: '2026-04-08T00:00:01.000Z',
      smoke: { status: 'pending', queued: true },
    });

    await expect(store.listPendingSmokeDeliveries()).resolves.toEqual([
      expect.objectContaining({
        deliveryId: 'evt-1',
        eventName: 'error.new_class',
        sequence: 3,
      }),
      expect.objectContaining({
        deliveryId: 'evt-2',
        eventName: 'incident.opened',
        sequence: 0,
      }),
    ]);
  });

  it('writes JSON payloads and summaries with sanitized file names', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'linejam-canary-store-'));
    tempDirs.push(dir);
    const store = await loadStoreModule(dir);

    const jsonPath = await store.persistJson('contexts', 'evt:abc/123', {
      status: 'ok',
    });
    const summaryPath = await store.persistSummary('evt:abc/123', '# Summary');

    expect(jsonPath).toContain(path.join(dir, 'contexts'));
    expect(summaryPath).toContain(path.join(dir, 'summaries'));
    expect(path.basename(jsonPath)).toContain('evt-abc-123');
    expect(path.basename(summaryPath)).toContain('evt-abc-123');

    expect(JSON.parse(await readFile(jsonPath, 'utf8'))).toEqual({
      status: 'ok',
    });
    expect(await readFile(summaryPath, 'utf8')).toBe('# Summary');
  });

  it('persists fingerprints and reports existence', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'linejam-canary-store-'));
    tempDirs.push(dir);
    const store = await loadStoreModule(dir);

    expect(await store.fingerprintExists('abc/123')).toBe(false);

    const file = await store.persistFingerprint('abc/123', {
      deliveryId: 'evt-1',
    });

    expect(file).toContain(path.join(dir, 'fingerprints'));
    expect(path.basename(file)).toBe('abc-123.json');
    expect(await store.fingerprintExists('abc/123')).toBe(true);
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({
      deliveryId: 'evt-1',
    });
  });

  it('generates unique fallback keys when delivery metadata is missing', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'linejam-canary-store-'));
    tempDirs.push(dir);
    const store = await loadStoreModule(dir);

    const first = await store.persistDelivery('', undefined, { ok: true });
    const second = await store.persistDelivery('', undefined, { ok: true });

    expect(path.basename(first)).toMatch(/^missing-0-/);
    expect(path.basename(second)).toMatch(/^missing-0-/);
    expect(first).not.toBe(second);
    expect(await store.deliveryExists('', undefined)).toBe(false);
  });

  it('prunes stale responder artifacts after the retention window', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'linejam-canary-store-'));
    tempDirs.push(dir);
    const store = await loadStoreModule(dir);

    const staleDelivery = await store.persistDelivery('evt-old', 1, {
      stale: true,
    });
    const freshSummary = await store.persistSummary('evt-fresh', '# Fresh');

    const staleDate = new Date('2024-01-01T00:00:00.000Z');
    const freshDate = new Date('2026-04-08T00:00:00.000Z');

    await utimes(staleDelivery, staleDate, staleDate);
    await utimes(freshSummary, freshDate, freshDate);

    const result = await store.pruneExpiredArtifacts({
      now: new Date('2026-04-08T00:00:00.000Z').getTime(),
      retentionDays: 30,
    });

    expect(result.deletedFiles).toEqual([staleDelivery]);
    await expect(readFile(staleDelivery, 'utf8')).rejects.toThrow();
    await expect(readFile(freshSummary, 'utf8')).resolves.toBe('# Fresh');
  });
});
