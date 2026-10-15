import { convexToJson, jsonToConvex, type JSONValue } from "convex/values";
import type { Runtime } from "./runtime.js";
import type { Document } from "./store.js";

/**
 * Snapshot import/export in the Convex snapshot layout (`_tables` numbers plus
 * one JSON document per line per table), and canonical per-table checksums
 * that can be computed identically from a Convex export ZIP.
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

const EXPORT_PAGE_LIMIT = 1000;

export function exportPage(
  runtime: Runtime,
  table: string,
  after: string | null,
  limit: number,
): { documents: JSONValue[]; next: string | null } {
  const bounded = Math.max(1, Math.min(EXPORT_PAGE_LIMIT, Math.floor(limit)));
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

/** Replace all data: forget every document and adopt the snapshot's table numbers. */
export function beginImport(runtime: Runtime, tables: Readonly<Record<string, number>>) {
  if (!runtime.writesFrozen) throw new Error("Freeze writes before importing a snapshot");
  for (const [name, number] of Object.entries(tables)) {
    if (name.startsWith("_") || !Number.isSafeInteger(number) || number < 1) {
      throw new Error(`Invalid snapshot table ${name}=${number}`);
    }
  }
  runtime.store.clearAll();
  runtime.store.adoptTableNumbers(new Map(Object.entries(tables)));
}

export async function importDocuments(
  runtime: Runtime,
  table: string,
  documents: readonly JSONValue[],
) {
  if (!runtime.writesFrozen) throw new Error("Freeze writes before importing a snapshot");
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
