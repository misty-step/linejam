import { convexToJson, jsonToConvex, type JSONValue } from "convex/values";
import type { Runtime } from "./runtime.js";
import type { Document } from "./store.js";

/**
 * Snapshot import/export in the Convex snapshot layout (`_tables` numbers plus
 * one JSON document per line per table), and canonical per-table checksums
 * that can be computed identically from a Convex export ZIP.
 *
 * An import is a maintenance state: `beginImport` (writes frozen) replaces
 * the database and marks the import pending, `importDocuments` loads pages,
 * and `commitImport` clears the mark only when every table's count and
 * checksum equal the snapshot's. Writes cannot be unfrozen while an import
 * is pending, so a partial or mismatched import never accepts writes.
 */

/** JSON with object keys sorted; stable across Convex and this backend. */
export function canonicalJson(value: JSONValue): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalJson((value as Record<string, JSONValue>)[key] ?? null)}`,
      )
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * SHA-256 over the concatenated SHA-256 digests of each document's canonical
 * JSON, in `_id` order. Documents are re-encoded first so number formatting
 * (`3.0` versus `3`) never changes the result.
 */
export async function documentsChecksum(documents: readonly JSONValue[]): Promise<string> {
  const lines = documents
    .map((document) => canonicalJson(convexToJson(jsonToConvex(document))))
    .map((line) => ({ line, id: String((JSON.parse(line) as { _id?: unknown })._id) }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const encoder = new TextEncoder();
  const digests = new Uint8Array(lines.length * 32);
  let offset = 0;
  for (const { line } of lines) {
    digests.set(
      new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(line))),
      offset,
    );
    offset += 32;
  }
  return hex(await crypto.subtle.digest("SHA-256", digests));
}

export interface TableStats {
  readonly number: number;
  readonly count: number;
  readonly sha256: string;
}

/** Count and checksum a table must have; tables absent on one side are empty. */
export interface ExpectedTable {
  readonly count: number;
  readonly sha256: string;
}

export interface TableMismatch {
  readonly table: string;
  readonly expected: ExpectedTable;
  readonly actual: ExpectedTable;
}

const EXPORT_PAGE_LIMIT = 1000;
/** `documentsChecksum([])`: the SHA-256 of no bytes. */
const EMPTY_TABLE: ExpectedTable = {
  count: 0,
  sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
};
const IMPORT_PENDING_KEY = "import_pending";

/** Refused import or freeze transitions; the admin API reports these as 409. */
export class MaintenanceStateError extends Error {
  override readonly name = "MaintenanceStateError";
}

export function importPending(runtime: Runtime): boolean {
  return runtime.store.meta(IMPORT_PENDING_KEY) !== null;
}

/**
 * Freeze or unfreeze every write path (call with the database lock held).
 * Unfreezing is refused while an import is pending.
 */
export function setWritesFrozen(runtime: Runtime, frozen: boolean) {
  if (!frozen && importPending(runtime)) {
    throw new MaintenanceStateError(
      "An import is pending; commit it with matching checksums before unfreezing writes",
    );
  }
  runtime.store.setWritesFrozen(frozen);
}

/**
 * One page of a table's documents in `_id` order, with the commit timestamp
 * it was read at. An export is consistent only when every page reports the
 * same `ts` while `writesFrozen` holds (call with the database lock held).
 */
export function exportPage(
  runtime: Runtime,
  table: string,
  after: string | null,
  limit: number,
): { documents: JSONValue[]; next: string | null; ts: string; writesFrozen: boolean } {
  const requested = Number.isFinite(limit) ? Math.floor(limit) : EXPORT_PAGE_LIMIT;
  const bounded = Math.max(1, Math.min(EXPORT_PAGE_LIMIT, requested));
  const rows = runtime.store.driver.exec(
    "SELECT id, json FROM cvx_documents WHERE table_name = ? AND id > ? ORDER BY id LIMIT ?",
    table,
    after ?? "",
    bounded,
  );
  const documents = rows.map((row) => JSON.parse(String(row["json"])) as JSONValue);
  const last = rows.at(-1);
  return {
    documents,
    next: rows.length === bounded && last !== undefined ? String(last["id"]) : null,
    ts: runtime.store.ts.toString(),
    writesFrozen: runtime.writesFrozen,
  };
}

/** Counts and canonical checksums for every user table (lock held by caller). */
export async function tableStats(runtime: Runtime): Promise<Record<string, TableStats>> {
  const stats: Record<string, TableStats> = {};
  for (const [table, number] of runtime.store.tableNumbers()) {
    if (table.startsWith("_")) continue;
    const documents: JSONValue[] = [];
    let after: string | null = null;
    for (;;) {
      const page = exportPage(runtime, table, after, EXPORT_PAGE_LIMIT);
      documents.push(...page.documents);
      if (page.next === null) break;
      after = page.next;
    }
    stats[table] = { number, count: documents.length, sha256: await documentsChecksum(documents) };
  }
  return stats;
}

function requireFrozen(runtime: Runtime) {
  if (!runtime.writesFrozen) {
    throw new MaintenanceStateError("Freeze writes before importing a snapshot");
  }
}

/**
 * Replace all data with an empty database that uses the snapshot's table
 * numbers, and mark the import pending, in one SQLite transaction: if any
 * part fails, data, mappings, receipts, timestamp and maintenance state are
 * all unchanged and nothing is notified. Validation and the replacement
 * happen before this returns; the returned promise refreshes every live
 * subscription (removed rows included) and must be awaited with the
 * database lock held.
 */
export function beginImport(
  runtime: Runtime,
  tables: Readonly<Record<string, number>>,
): Promise<void> {
  requireFrozen(runtime);
  const commit = runtime.store.replaceAll(new Map(Object.entries(tables)), (ts) =>
    runtime.store.setMeta(IMPORT_PENDING_KEY, ts.toString()),
  );
  return runtime.notifyLocked(commit);
}

export async function importDocuments(
  runtime: Runtime,
  table: string,
  documents: readonly JSONValue[],
) {
  requireFrozen(runtime);
  if (!importPending(runtime)) {
    throw new MaintenanceStateError("Begin an import before loading documents");
  }
  const decoded = documents.map((document) => {
    const value = jsonToConvex(document) as Document;
    if (typeof value._id !== "string" || typeof value._creationTime !== "number") {
      throw new Error(`Snapshot document in ${table} is missing _id or _creationTime`);
    }
    return value;
  });
  const commit = runtime.store.importDocuments(table, decoded);
  await runtime.notifyLocked(commit);
  return decoded.length;
}

/**
 * Finish a pending import when every user table's count and checksum equal
 * `expected` (the snapshot's own stats). On any mismatch the import stays
 * pending, so writes stay frozen. Call with the database lock held.
 */
export async function commitImport(
  runtime: Runtime,
  expected: Readonly<Record<string, ExpectedTable>>,
): Promise<{ readonly mismatches: TableMismatch[]; readonly tables: Record<string, TableStats> }> {
  requireFrozen(runtime);
  if (!importPending(runtime)) throw new MaintenanceStateError("No import is pending");
  const tables = await tableStats(runtime);
  const mismatches: TableMismatch[] = [];
  for (const table of [...new Set([...Object.keys(tables), ...Object.keys(expected)])].sort()) {
    const have = tables[table] ?? EMPTY_TABLE;
    const want = expected[table] ?? EMPTY_TABLE;
    if (have.count !== want.count || have.sha256 !== want.sha256) {
      mismatches.push({
        table,
        expected: { count: want.count, sha256: want.sha256 },
        actual: { count: have.count, sha256: have.sha256 },
      });
    }
  }
  if (mismatches.length === 0) runtime.store.setMeta(IMPORT_PENDING_KEY, null);
  return { mismatches, tables };
}
