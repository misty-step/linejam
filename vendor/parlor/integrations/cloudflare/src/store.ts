import { convexToJson, jsonToConvex, type Value } from "convex/values";
import { decodeId, MAX_TABLE_NUMBER, newId } from "./ids.js";
import { encodeKey, encodeValue, keySuccessor } from "./keys.js";
import {
  isSystemTable,
  tableOrDefault,
  type IndexModel,
  type SchemaModel,
  SCHEDULED_FUNCTIONS_TABLE,
} from "./schema.js";
import { validateValue, ValidationError } from "./validators.js";
import { utf8Length } from "./utf8.js";

export type SqlValue = string | number | null;
export type SqlRow = Readonly<Record<string, SqlValue>>;

/** Synchronous SQLite access, as provided by a SQLite-backed Durable Object. */
export interface SqlDriver {
  exec(query: string, ...bindings: SqlValue[]): SqlRow[];
  /** Run `callback` atomically; a thrown error rolls every statement back. */
  transaction<T>(callback: () => T): T;
}

export type Document = Record<string, Value> & {
  readonly _id: string;
  readonly _creationTime: number;
};
export type Order = "asc" | "desc";

/** Half-open key interval `[low, high)` over one index; `high: null` is unbounded. */
export interface KeyInterval {
  readonly index: string;
  readonly low: string;
  readonly high: string | null;
}

export class ReadSet {
  readonly intervals: KeyInterval[] = [];

  add(interval: KeyInterval) {
    if (this.intervals.length < 4096) {
      this.intervals.push(interval);
      return;
    }
    // Bound memory for pathological readers: widen to whole indexes.
    this.intervals.splice(0, this.intervals.length, ...wholeIndexes(this.intervals), {
      index: interval.index,
      low: "",
      high: null,
    });
  }

  overlaps(changes: ReadonlyMap<string, readonly string[]>): boolean {
    for (const interval of this.intervals) {
      const keys = changes.get(interval.index);
      if (keys === undefined) continue;
      for (const key of keys) {
        if (key >= interval.low && (interval.high === null || key < interval.high)) return true;
      }
    }
    return false;
  }
}

function wholeIndexes(intervals: readonly KeyInterval[]): KeyInterval[] {
  return [...new Set(intervals.map((interval) => interval.index))].map((index) => ({
    index,
    low: "",
    high: null,
  }));
}

export interface CommitResult {
  readonly ts: bigint;
  /** Every old and new index key touched by the commit, by index name. */
  readonly changes: ReadonlyMap<string, readonly string[]>;
  readonly tables: ReadonlySet<string>;
  /** The whole database was replaced, so every read set is invalid. */
  readonly replaced: boolean;
}

export const FROZEN_MESSAGE = "This backend is temporarily read-only for maintenance.";

/** A write reached the database while it was frozen; nothing was committed. */
export class FrozenError extends Error {
  constructor() {
    super(FROZEN_MESSAGE);
    this.name = "FrozenError";
  }
}

const FROZEN_KEY = "writes_frozen";
const MAX_DOCUMENT_BYTES = 1 << 20;
const SCAN_PAGE = 128;
const FIRST_USER_TABLE = 10_001;
const SYSTEM_TABLE_NUMBERS: Readonly<Record<string, number>> = { [SCHEDULED_FUNCTIONS_TABLE]: 539 };
/** Convex table names: a letter, then letters, digits or underscores, at most 64 characters. */
const USER_TABLE_NAME = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

export function getField(
  document: Readonly<Record<string, Value | undefined>>,
  path: string,
): Value | undefined {
  let current: Value | undefined = document;
  for (const part of path.split(".")) {
    if (current === null || current === undefined || typeof current !== "object") return undefined;
    if (Array.isArray(current) || current instanceof ArrayBuffer) return undefined;
    current = (current as Record<string, Value | undefined>)[part];
  }
  return current;
}

export function indexKey(index: IndexModel, document: Document): string {
  let key = "";
  for (const field of index.keyFields) key += encodeValue(getField(document, field));
  return key;
}

function serialize(document: Document): string {
  return JSON.stringify(convexToJson(document));
}

function deserialize(json: string): Document {
  return jsonToConvex(JSON.parse(json) as never) as Document;
}

function nextFloat(value: number): number {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value);
  view.setBigUint64(0, view.getBigUint64(0) + 1n);
  return view.getFloat64(0);
}

/**
 * The number a new table gets beside the numbers already `taken`: its fixed
 * system number, or one past the highest in use (user tables start at
 * FIRST_USER_TABLE). Throws when no encodable number is left.
 */
function allocateTableNumber(name: string, taken: Iterable<number>): number {
  const system = SYSTEM_TABLE_NUMBERS[name];
  if (system !== undefined) return system;
  if (isSystemTable(name)) throw new Error(`Unknown system table ${name}`);
  let highest = FIRST_USER_TABLE - 1;
  for (const number of taken) if (number > highest) highest = number;
  if (highest >= MAX_TABLE_NUMBER) throw new Error(`No table number is left for table ${name}`);
  return highest + 1;
}

export class Store {
  private readonly numbersByName = new Map<string, number>();
  private readonly namesByNumber = new Map<number, string>();
  private currentTs: bigint;
  private lastCreationTime: number;

  constructor(
    readonly driver: SqlDriver,
    readonly schema: SchemaModel,
  ) {
    driver.exec(
      "CREATE TABLE IF NOT EXISTS cvx_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID",
    );
    driver.exec(
      "CREATE TABLE IF NOT EXISTS cvx_tables (name TEXT PRIMARY KEY, number INTEGER NOT NULL UNIQUE) WITHOUT ROWID",
    );
    driver.exec(
      "CREATE TABLE IF NOT EXISTS cvx_documents (id TEXT PRIMARY KEY, table_name TEXT NOT NULL, creation_time REAL NOT NULL, json TEXT NOT NULL) WITHOUT ROWID",
    );
    driver.exec(
      "CREATE INDEX IF NOT EXISTS cvx_documents_by_table ON cvx_documents (table_name, id)",
    );
    driver.exec(
      "CREATE TABLE IF NOT EXISTS cvx_index (index_name TEXT NOT NULL, key TEXT NOT NULL, id TEXT NOT NULL, PRIMARY KEY (index_name, key)) WITHOUT ROWID",
    );
    // Mutation receipts make client retries after a reconnect exactly-once.
    driver.exec(
      "CREATE TABLE IF NOT EXISTS cvx_receipts (session_id TEXT NOT NULL, request_id INTEGER NOT NULL, ts TEXT NOT NULL, result TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (session_id, request_id)) WITHOUT ROWID",
    );
    driver.exec("CREATE INDEX IF NOT EXISTS cvx_receipts_by_age ON cvx_receipts (created_at)");
    this.loadTables();
    this.currentTs = BigInt(this.meta("ts") ?? "0");
    const latest = driver.exec("SELECT MAX(creation_time) AS latest FROM cvx_documents")[0]?.[
      "latest"
    ];
    this.lastCreationTime = typeof latest === "number" ? latest : 0;
    driver.transaction(() => {
      for (const name of schema.tables.keys()) this.ensureTable(name);
      this.reindexChangedIndexes();
    });
  }

  private loadTables() {
    this.numbersByName.clear();
    this.namesByNumber.clear();
    for (const row of this.driver.exec("SELECT name, number FROM cvx_tables")) {
      const name = String(row["name"]);
      const number = Number(row["number"]);
      this.numbersByName.set(name, number);
      this.namesByNumber.set(number, name);
    }
  }

  meta(key: string): string | null {
    const value = this.driver.exec("SELECT value FROM cvx_meta WHERE key = ?", key)[0]?.["value"];
    return typeof value === "string" ? value : null;
  }

  setMeta(key: string, value: string | null) {
    if (value === null) this.driver.exec("DELETE FROM cvx_meta WHERE key = ?", key);
    else this.driver.exec("INSERT OR REPLACE INTO cvx_meta (key, value) VALUES (?, ?)", key, value);
  }

  /**
   * While frozen, `commit` refuses every write that is not an admitted
   * snapshot import, whichever function, scheduler or cron produced it.
   */
  get writesFrozen(): boolean {
    return this.meta(FROZEN_KEY) === "1";
  }

  setWritesFrozen(frozen: boolean) {
    this.setMeta(FROZEN_KEY, frozen ? "1" : null);
  }

  /**
   * Rebuild the stored keys of any index whose definition changed since the
   * last start, so a schema deploy never serves a stale or partial index.
   */
  private reindexChangedIndexes() {
    const fingerprint = (fields: readonly string[]) => JSON.stringify(fields);
    const stored = new Map<string, string>();
    for (const row of this.driver.exec(
      "SELECT key, value FROM cvx_meta WHERE key LIKE 'index:%'",
    )) {
      stored.set(String(row["key"]).slice("index:".length), String(row["value"]));
    }
    const wanted = new Map<string, IndexModel>();
    for (const table of this.schema.tables.values()) {
      for (const index of table.indexes) wanted.set(index.name, index);
    }
    for (const [name] of stored) {
      if (!wanted.has(name)) {
        this.driver.exec("DELETE FROM cvx_index WHERE index_name = ?", name);
        this.setMeta(`index:${name}`, null);
      }
    }
    for (const [name, index] of wanted) {
      if (stored.get(name) === fingerprint(index.keyFields)) continue;
      this.driver.exec("DELETE FROM cvx_index WHERE index_name = ?", name);
      for (const row of this.driver.exec(
        "SELECT id, json FROM cvx_documents WHERE table_name = ?",
        index.table,
      )) {
        const document = deserialize(String(row["json"]));
        this.driver.exec(
          "INSERT INTO cvx_index (index_name, key, id) VALUES (?, ?, ?)",
          name,
          indexKey(index, document),
          String(row["id"]),
        );
      }
      this.setMeta(`index:${name}`, fingerprint(index.keyFields));
    }
  }

  ensureTable(name: string): number {
    const existing = this.numbersByName.get(name);
    if (existing !== undefined) return existing;
    const number = allocateTableNumber(name, this.namesByNumber.keys());
    this.insertTable(name, number);
    return number;
  }

  private insertTable(name: string, number: number) {
    this.driver.exec("INSERT INTO cvx_tables (name, number) VALUES (?, ?)", name, number);
    this.numbersByName.set(name, number);
    this.namesByNumber.set(number, name);
  }

  tableName(number: number): string | undefined {
    return this.namesByNumber.get(number);
  }

  tableNumbers(): ReadonlyMap<string, number> {
    return this.numbersByName;
  }

  /** Table of a well-formed ID, or null when it cannot belong to any table. */
  tableOfId(id: string): string | null {
    const decoded = decodeId(id);
    if (decoded === null) return null;
    return this.namesByNumber.get(decoded.tableNumber) ?? null;
  }

  get ts(): bigint {
    return this.currentTs;
  }

  readDocument(id: string): Document | null {
    const json = this.driver.exec("SELECT json FROM cvx_documents WHERE id = ?", id)[0]?.["json"];
    return typeof json === "string" ? deserialize(json) : null;
  }

  /** One page of `[low, high)` in key order, resuming strictly after `after`. */
  scanPage(
    index: string,
    low: string,
    high: string | null,
    order: Order,
    after: string | null,
    limit: number,
  ): { key: string; id: string; json: string }[] {
    const clauses = ["i.index_name = ?"];
    const bindings: SqlValue[] = [index];
    if (order === "asc") {
      clauses.push(after === null ? "i.key >= ?" : "i.key > ?");
      bindings.push(after ?? low);
      if (high !== null) {
        clauses.push("i.key < ?");
        bindings.push(high);
      }
    } else {
      clauses.push("i.key >= ?");
      bindings.push(low);
      if (after !== null) {
        clauses.push("i.key < ?");
        bindings.push(after);
      } else if (high !== null) {
        clauses.push("i.key < ?");
        bindings.push(high);
      }
    }
    bindings.push(limit);
    return this.driver
      .exec(
        `SELECT i.key AS key, i.id AS id, d.json AS json FROM cvx_index i JOIN cvx_documents d ON d.id = i.id WHERE ${clauses.join(
          " AND ",
        )} ORDER BY i.key ${order === "asc" ? "ASC" : "DESC"} LIMIT ?`,
        ...bindings,
      )
      .map((row) => ({
        key: String(row["key"]),
        id: String(row["id"]),
        json: String(row["json"]),
      }));
  }

  countTable(table: string): number {
    const count = this.driver.exec(
      "SELECT COUNT(*) AS count FROM cvx_documents WHERE table_name = ?",
      table,
    )[0]?.["count"];
    return typeof count === "number" ? count : 0;
  }

  nextCreationTime(): number {
    const now = Date.now();
    this.lastCreationTime = now > this.lastCreationTime ? now : nextFloat(this.lastCreationTime);
    return this.lastCreationTime;
  }

  mintId(table: string): string {
    return newId(this.ensureTable(table));
  }

  /**
   * Atomically apply a transaction's writes, maintain every index, advance
   * the commit timestamp and run `receipt` (a mutation receipt) in the same
   * SQLite transaction. Refused with `FrozenError` while writes are frozen,
   * unless `admitWhileFrozen` marks an operator snapshot import.
   */
  commit(
    writes: ReadonlyMap<string, Document | null>,
    options: { readonly receipt?: (ts: bigint) => void; readonly admitWhileFrozen?: true } = {},
  ): CommitResult {
    const result = this.driver.transaction(() => {
      if (options.admitWhileFrozen !== true && this.writesFrozen) throw new FrozenError();
      const changes = new Map<string, string[]>();
      const tables = new Set<string>();
      const touch = (index: string, key: string) => {
        const keys = changes.get(index);
        if (keys === undefined) changes.set(index, [key]);
        else keys.push(key);
      };
      for (const [id, next] of writes) {
        const previousRow = this.driver.exec(
          "SELECT table_name, json FROM cvx_documents WHERE id = ?",
          id,
        )[0];
        const previous =
          previousRow === undefined ? null : deserialize(String(previousRow["json"]));
        // Inserted and deleted within one transaction: nothing to commit.
        if (previous === null && next === null) continue;
        const table =
          next !== null ? this.tableOfId(id) : String(previousRow?.["table_name"] ?? "");
        if (table === null || table === "") throw new Error(`Write to unknown document ${id}`);
        tables.add(table);
        for (const index of tableOrDefault(this.schema, table).indexes) {
          if (previous !== null) {
            const key = indexKey(index, previous);
            this.driver.exec(
              "DELETE FROM cvx_index WHERE index_name = ? AND key = ?",
              index.name,
              key,
            );
            touch(index.name, key);
          }
          if (next !== null) {
            const key = indexKey(index, next);
            this.driver.exec(
              "INSERT INTO cvx_index (index_name, key, id) VALUES (?, ?, ?)",
              index.name,
              key,
              id,
            );
            touch(index.name, key);
          }
        }
        if (next === null) {
          this.driver.exec("DELETE FROM cvx_documents WHERE id = ?", id);
        } else {
          this.driver.exec(
            "INSERT OR REPLACE INTO cvx_documents (id, table_name, creation_time, json) VALUES (?, ?, ?, ?)",
            id,
            table,
            next._creationTime,
            serialize(next),
          );
        }
      }
      const ts = this.writeNextTs();
      options.receipt?.(ts);
      return { ts, changes, tables, replaced: false };
    });
    this.currentTs = result.ts;
    return result;
  }

  /** Persist the next commit timestamp; the caller's transaction commits it. */
  private writeNextTs(): bigint {
    const wallClock = BigInt(Date.now()) * 1_000_000n;
    const ts = wallClock > this.currentTs ? wallClock : this.currentTs + 1n;
    this.setMeta("ts", ts.toString());
    return ts;
  }

  /**
   * Replace the whole database with an empty one that uses a snapshot's user
   * table numbers, ready for `importDocuments`. The complete resulting table
   * mapping, schema tables included, is validated against the ID format
   * before anything changes. The replacement and `within` (the caller's own
   * bookkeeping, such as the import-pending mark) commit as one SQLite
   * transaction, so a rejected snapshot or any failed write leaves every
   * document, index entry, mapping, receipt and meta key as it was.
   */
  replaceAll(numbers: ReadonlyMap<string, number>, within?: (ts: bigint) => void): CommitResult {
    const mapping = this.planReplacement(numbers);
    let ts: bigint;
    try {
      ts = this.driver.transaction(() => {
        this.driver.exec("DELETE FROM cvx_index");
        this.driver.exec("DELETE FROM cvx_documents");
        this.driver.exec("DELETE FROM cvx_tables");
        this.driver.exec("DELETE FROM cvx_receipts");
        for (const [name, number] of mapping) {
          this.driver.exec("INSERT INTO cvx_tables (name, number) VALUES (?, ?)", name, number);
        }
        const next = this.writeNextTs();
        within?.(next);
        return next;
      });
    } finally {
      // The in-memory mapping always mirrors what SQLite holds now, whether
      // the replacement committed or rolled back.
      this.loadTables();
    }
    this.currentTs = ts;
    return { ts, changes: new Map(), tables: new Set(this.numbersByName.keys()), replaced: true };
  }

  /**
   * The table mapping a replacement would leave: the snapshot's numbers, plus
   * a number for every schema table the snapshot lacks. Throws, before
   * anything changes, when a name or number is invalid, shared or reserved,
   * or when a number does not fit an ID.
   */
  private planReplacement(numbers: ReadonlyMap<string, number>): Map<string, number> {
    const reserved = new Set(Object.values(SYSTEM_TABLE_NUMBERS));
    const owners = new Map<number, string>();
    for (const [name, number] of numbers) {
      if (!USER_TABLE_NAME.test(name)) {
        throw new Error(`Invalid snapshot table name ${JSON.stringify(name)}`);
      }
      if (
        !Number.isSafeInteger(number) ||
        number < 1 ||
        number > MAX_TABLE_NUMBER ||
        reserved.has(number)
      ) {
        throw new Error(`Invalid table number ${String(number)} for snapshot table ${name}`);
      }
      const owner = owners.get(number);
      if (owner !== undefined) {
        throw new Error(`Snapshot tables ${owner} and ${name} share table number ${number}`);
      }
      owners.set(number, name);
    }
    const mapping = new Map(numbers);
    for (const name of this.schema.tables.keys()) {
      if (!mapping.has(name)) mapping.set(name, allocateTableNumber(name, mapping.values()));
    }
    return mapping;
  }

  /** Insert documents verbatim (IDs and creation times preserved); admitted while frozen. */
  importDocuments(table: string, documents: readonly Document[]): CommitResult {
    const writes = new Map<string, Document | null>();
    for (const document of documents) {
      if (this.tableOfId(document._id) !== table) {
        throw new Error(`Imported ID ${document._id} does not belong to table ${table}`);
      }
      writes.set(document._id, document);
    }
    const result = this.commit(writes, { admitWhileFrozen: true });
    for (const document of documents) {
      if (document._creationTime > this.lastCreationTime)
        this.lastCreationTime = document._creationTime;
    }
    return result;
  }
}

export function validateDocument(store: Store, table: string, document: Document) {
  if (!store.schema.validate) return;
  const documentType = store.schema.tables.get(table)?.documentType;
  if (documentType === null || documentType === undefined) return;
  const { _id: _ignoredId, _creationTime: _ignoredTime, ...fields } = document;
  try {
    validateValue(documentType, fields, (number) => store.tableName(number));
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error;
    throw new Error(
      `Failed to insert or update a document in table "${table}" because it does not match the schema: ${error.message}`,
      { cause: error },
    );
  }
}

/** Pending writes layered over the committed store, with read tracking. */
export class Transaction {
  readonly writes = new Map<string, Document | null>();
  readonly reads = new ReadSet();

  constructor(
    readonly store: Store,
    readonly writable: boolean,
  ) {}

  private requireWritable() {
    if (!this.writable) throw new Error("Writes are not allowed in queries");
  }

  private resolveTable(id: string, expected: string | undefined, operation: string): string | null {
    if (typeof id !== "string")
      throw new Error(`Invalid argument \`id\` for \`db.${operation}\`: expected string`);
    if (decodeId(id) === null) {
      throw new Error(
        `Invalid argument \`id\` for \`db.${operation}\`: Unable to decode ID: ${id}`,
      );
    }
    const table = this.store.tableOfId(id);
    if (expected !== undefined && expected !== table) {
      throw new Error(
        `Invalid argument \`id\` for \`db.${operation}\`: expected ID for table "${expected}" but got ID for table "${table ?? "unknown"}"`,
      );
    }
    return table;
  }

  private requireTable(id: string, expected: string | undefined, operation: string): string {
    const table = this.resolveTable(id, expected, operation);
    if (table === null)
      throw new Error(
        `Invalid argument \`id\` for \`db.${operation}\`: unknown table for ID ${id}`,
      );
    return table;
  }

  get(id: string, expectedTable?: string): Document | null {
    const table = this.resolveTable(id, expectedTable, "get");
    // A well-formed ID of a table this deployment never had cannot exist.
    if (table === null) return null;
    if (this.writes.has(id)) return structuredCloneDocument(this.writes.get(id) ?? null);
    const key = encodeKey([id]);
    this.reads.add({ index: `${table}.by_id`, low: key, high: keySuccessor(key) });
    return this.store.readDocument(id);
  }

  insert(table: string, value: Record<string, Value>): string {
    this.requireWritable();
    if (isSystemTable(table) && table !== SCHEDULED_FUNCTIONS_TABLE) {
      throw new Error(`Unknown system table ${table}`);
    }
    for (const field of Object.keys(value)) {
      if (field.startsWith("_")) {
        throw new Error(`Field name ${field} starts with a '_', which is reserved.`);
      }
    }
    const document = {
      ...value,
      _id: this.store.mintId(table),
      _creationTime: this.store.nextCreationTime(),
    } as Document;
    this.checkSize(document);
    validateDocument(this.store, table, document);
    this.writes.set(document._id, document);
    return document._id;
  }

  patch(id: string, value: Record<string, Value | undefined>, expectedTable?: string) {
    this.requireWritable();
    const table = this.requireTable(id, expectedTable, "patch");
    const current = this.get(id, table);
    if (current === null) throw new Error(`Update on nonexistent document ID ${id}`);
    const next: Record<string, Value> = { ...current };
    for (const [field, fieldValue] of Object.entries(value)) {
      if (field === "_id" || field === "_creationTime") {
        if (fieldValue !== undefined && fieldValue !== current[field]) {
          throw new Error(`Provided \`${field}\` field value does not match the document`);
        }
        continue;
      }
      if (field.startsWith("_"))
        throw new Error(`Field name ${field} starts with a '_', which is reserved.`);
      if (fieldValue === undefined) delete next[field];
      else next[field] = fieldValue;
    }
    this.store.ensureTable(table);
    const document = next as Document;
    this.checkSize(document);
    validateDocument(this.store, table, document);
    this.writes.set(id, document);
  }

  replace(id: string, value: Record<string, Value>, expectedTable?: string) {
    this.requireWritable();
    const table = this.requireTable(id, expectedTable, "replace");
    const current = this.get(id, table);
    if (current === null) throw new Error(`Replace on nonexistent document ID ${id}`);
    const next: Record<string, Value> = {};
    for (const [field, fieldValue] of Object.entries(value)) {
      if (field === "_id" || field === "_creationTime") {
        if (fieldValue !== current[field]) {
          throw new Error(`Provided \`${field}\` field value does not match the document`);
        }
        continue;
      }
      if (field.startsWith("_"))
        throw new Error(`Field name ${field} starts with a '_', which is reserved.`);
      next[field] = fieldValue;
    }
    const document = {
      ...next,
      _id: current._id,
      _creationTime: current._creationTime,
    } as Document;
    this.checkSize(document);
    validateDocument(this.store, table, document);
    this.writes.set(id, document);
  }

  delete(id: string, expectedTable?: string) {
    this.requireWritable();
    const table = this.requireTable(id, expectedTable, "delete");
    if (this.get(id, table) === null) throw new Error(`Delete on nonexistent document ID ${id}`);
    this.writes.set(id, null);
  }

  private checkSize(document: Document) {
    if (utf8Length(serialize(document)) > MAX_DOCUMENT_BYTES) {
      throw new Error(`Document ${document._id} is too large (limit ${MAX_DOCUMENT_BYTES} bytes)`);
    }
  }

  /** Iterate `[low, high)` of one index in order, merging pending writes. */
  scan(index: IndexModel, low: string, high: string | null, order: Order): IndexScan {
    return new IndexScan(this, index, low, high, order);
  }

  count(table: string): number {
    let total = this.store.countTable(table);
    for (const [id, next] of this.writes) {
      if (this.store.tableOfId(id) !== table) continue;
      const committed = this.store.readDocument(id) !== null;
      if (committed && next === null) total -= 1;
      if (!committed && next !== null) total += 1;
    }
    this.reads.add({ index: `${table}.by_creation_time`, low: "", high: null });
    return total;
  }
}

function structuredCloneDocument(document: Document | null): Document | null {
  return document === null ? null : (jsonToConvex(convexToJson(document)) as Document);
}

/** A lazily paged, overlay-merged index scan that records what it read. */
export class IndexScan {
  private readonly overlay: { key: string; document: Document }[];
  private overlayPosition = 0;
  private page: { key: string; id: string; json: string }[] = [];
  private pagePosition = 0;
  private baseAfter: string | null = null;
  private baseDone = false;
  private last: string | null = null;
  private closed = false;

  constructor(
    private readonly transaction: Transaction,
    readonly index: IndexModel,
    private readonly low: string,
    private readonly high: string | null,
    private readonly order: Order,
  ) {
    const inRange = (key: string) => key >= low && (high === null || key < high);
    this.overlay = [];
    for (const [id, document] of transaction.writes) {
      if (document === null || transaction.store.tableOfId(id) !== index.table) continue;
      const key = indexKey(index, document);
      if (inRange(key)) this.overlay.push({ key, document });
    }
    this.overlay.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    if (order === "desc") this.overlay.reverse();
  }

  private fillPage() {
    while (this.pagePosition >= this.page.length && !this.baseDone) {
      const rows = this.transaction.store.scanPage(
        this.index.name,
        this.low,
        this.high,
        this.order,
        this.baseAfter,
        SCAN_PAGE,
      );
      const last = rows.at(-1);
      if (last !== undefined) this.baseAfter = last.key;
      if (rows.length < SCAN_PAGE) this.baseDone = true;
      // Skip committed rows that this transaction has rewritten or deleted;
      // their pending versions come from the overlay instead.
      this.page = rows.filter((row) => !this.transaction.writes.has(row.id));
      this.pagePosition = 0;
    }
  }

  /** Key of the last row returned, if any. */
  get lastKey(): string | null {
    return this.last;
  }

  /** Next `{ key, document }` in order, or null when the range is exhausted. */
  next(): { key: string; document: Document } | null {
    if (this.closed) throw new Error("This query is closed and can't emit any more values.");
    this.fillPage();
    const base = this.page[this.pagePosition];
    const pending = this.overlay[this.overlayPosition];
    let pick: "base" | "pending" | null = null;
    if (base !== undefined && pending !== undefined) {
      const baseFirst = this.order === "asc" ? base.key < pending.key : base.key > pending.key;
      pick = baseFirst ? "base" : "pending";
    } else if (base !== undefined) {
      pick = "base";
    } else if (pending !== undefined) {
      pick = "pending";
    }
    if (pick === null) {
      this.finish(true);
      return null;
    }
    if (pick === "base" && base !== undefined) {
      this.pagePosition += 1;
      this.last = base.key;
      return { key: base.key, document: deserialize(base.json) };
    }
    this.overlayPosition += 1;
    const chosen = pending as { key: string; document: Document };
    this.last = chosen.key;
    return { key: chosen.key, document: structuredCloneDocument(chosen.document) as Document };
  }

  /** Record the interval actually read; `exhausted` covers the whole range. */
  finish(exhausted: boolean) {
    if (this.closed) return;
    this.closed = true;
    if (exhausted) {
      this.transaction.reads.add({ index: this.index.name, low: this.low, high: this.high });
    } else if (this.last === null) {
      // Closed before reading anything: nothing in the range was observed.
    } else if (this.order === "asc") {
      this.transaction.reads.add({
        index: this.index.name,
        low: this.low,
        high: keySuccessor(this.last),
      });
    } else {
      this.transaction.reads.add({ index: this.index.name, low: this.last, high: this.high });
    }
  }
}
