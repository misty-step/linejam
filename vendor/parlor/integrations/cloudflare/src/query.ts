import { compareValues, jsonToConvex, type JSONValue, type Value } from "convex/values";
import { encodeValue, keySuccessor, prefixEnd } from "./keys.js";
import { tableOrDefault, type IndexModel } from "./schema.js";
import { getField, type Document, type IndexScan, type Order, type Transaction } from "./store.js";

type RangeType = "Eq" | "Gt" | "Gte" | "Lt" | "Lte";

export interface RangeExpression {
  readonly type: RangeType;
  readonly fieldPath: string;
  readonly value: JSONValue;
}

export type FilterExpression = Readonly<Record<string, unknown>>;

export type QueryOperator = { readonly filter: FilterExpression } | { readonly limit: number };

export interface SerializedQuery {
  readonly source:
    | { readonly type: "FullTableScan"; readonly tableName: string; readonly order: Order | null }
    | {
        readonly type: "IndexRange";
        readonly indexName: string;
        readonly range: readonly RangeExpression[];
        readonly order: Order | null;
      }
    | { readonly type: "Search"; readonly indexName: string };
  readonly operators: readonly QueryOperator[];
}

function literal(value: unknown): Value | undefined {
  if (typeof value === "object" && value !== null && "$undefined" in value) return undefined;
  return jsonToConvex(value as JSONValue);
}

function isTrue(value: Value | undefined): boolean {
  return value === true;
}

function numeric(
  operator: string,
  left: Value | undefined,
  right: Value | undefined,
  apply: (a: number, b: number) => number,
  applyBig: (a: bigint, b: bigint) => bigint,
): Value {
  if (typeof left === "number" && typeof right === "number") return apply(left, right);
  if (typeof left === "bigint" && typeof right === "bigint") return applyBig(left, right);
  throw new Error(`Invalid operands for ${operator}`);
}

/** Evaluate a serialized filter expression with Convex value semantics. */
export function evaluate(expression: unknown, document: Document): Value | undefined {
  if (typeof expression !== "object" || expression === null)
    throw new Error("Invalid filter expression");
  const node = expression as Record<string, unknown>;
  const pair = (key: string): [Value | undefined, Value | undefined] => {
    const operands = node[key] as unknown[];
    return [evaluate(operands[0], document), evaluate(operands[1], document)];
  };
  if ("$field" in node) return getField(document, String(node["$field"]));
  if ("$literal" in node) return literal(node["$literal"]);
  if ("$eq" in node) return compareValues(...pair("$eq")) === 0;
  if ("$neq" in node) return compareValues(...pair("$neq")) !== 0;
  if ("$lt" in node) return compareValues(...pair("$lt")) < 0;
  if ("$lte" in node) return compareValues(...pair("$lte")) <= 0;
  if ("$gt" in node) return compareValues(...pair("$gt")) > 0;
  if ("$gte" in node) return compareValues(...pair("$gte")) >= 0;
  if ("$and" in node)
    return (node["$and"] as unknown[]).every((child) => isTrue(evaluate(child, document)));
  if ("$or" in node)
    return (node["$or"] as unknown[]).some((child) => isTrue(evaluate(child, document)));
  if ("$not" in node) return !isTrue(evaluate(node["$not"], document));
  if ("$add" in node)
    return numeric(
      "add",
      ...pair("$add"),
      (a, b) => a + b,
      (a, b) => a + b,
    );
  if ("$sub" in node)
    return numeric(
      "sub",
      ...pair("$sub"),
      (a, b) => a - b,
      (a, b) => a - b,
    );
  if ("$mul" in node)
    return numeric(
      "mul",
      ...pair("$mul"),
      (a, b) => a * b,
      (a, b) => a * b,
    );
  if ("$div" in node)
    return numeric(
      "div",
      ...pair("$div"),
      (a, b) => a / b,
      (a, b) => a / b,
    );
  if ("$mod" in node)
    return numeric(
      "mod",
      ...pair("$mod"),
      (a, b) => a % b,
      (a, b) => a % b,
    );
  if ("$neg" in node) {
    const value = evaluate(node["$neg"], document);
    if (typeof value === "number") return -value;
    if (typeof value === "bigint") return -value;
    throw new Error("Invalid operand for neg");
  }
  throw new Error(`Unsupported filter expression ${JSON.stringify(expression)}`);
}

export interface Plan {
  readonly index: IndexModel;
  readonly low: string;
  readonly high: string | null;
  readonly order: Order;
  /** Filter and limit stages, in the order the query applied them. */
  readonly operators: readonly QueryOperator[];
}

/**
 * One execution of a query's operator pipeline. Stages apply in order, as
 * Convex does: `limit(1).filter(f)` keeps the first document only if it
 * matches `f`, while `filter(f).limit(1)` keeps the first match.
 */
class Pipeline {
  private readonly passed: number[];

  constructor(private readonly operators: readonly QueryOperator[]) {
    this.passed = operators.map(() => 0);
  }

  /** True once a limit stage is full, so no later document can pass. */
  get exhausted(): boolean {
    return this.operators.some(
      (operator, stage) => "limit" in operator && (this.passed[stage] ?? 0) >= operator.limit,
    );
  }

  /** Run one document through every stage; true when it reaches the output. */
  admit(document: Document): boolean {
    for (const [stage, operator] of this.operators.entries()) {
      if ("filter" in operator) {
        if (!isTrue(evaluate(operator.filter, document))) return false;
        continue;
      }
      const passed = this.passed[stage] ?? 0;
      if (passed >= operator.limit) return false;
      this.passed[stage] = passed + 1;
    }
    return true;
  }
}

/** Validate and translate an index range into a half-open key interval. */
export function planRange(
  index: IndexModel,
  range: readonly RangeExpression[],
): { low: string; high: string | null } {
  // Keys are concatenated field encodings; values never sit in an array (see encodeValue).
  let prefix = "";
  let lower: { value: Value | undefined; inclusive: boolean } | null = null;
  let upper: { value: Value | undefined; inclusive: boolean } | null = null;
  let state: "eq" | "lower" | "upper" | "done" = "eq";
  let field = 0;
  for (const expression of range) {
    const value = literal(expression.value);
    const expected = index.fields[field];
    const isLower = expression.type === "Gt" || expression.type === "Gte";
    const isUpper = expression.type === "Lt" || expression.type === "Lte";
    if (state === "done")
      throw new Error(
        "Incorrect operator used in `withIndex`: cannot chain more operators after both `.gt` and `.lt`",
      );
    if (expression.type === "Eq") {
      if (state !== "eq" || expression.fieldPath !== expected) {
        throw new Error(
          `Incorrect field used in \`withIndex\`, expected "${expected ?? ""}", got "${expression.fieldPath}"`,
        );
      }
      prefix += encodeValue(value);
      field += 1;
      continue;
    }
    if (state === "eq") {
      if (expression.fieldPath !== expected) {
        throw new Error(
          `Incorrect field used in \`withIndex\`, expected "${expected ?? ""}", got "${expression.fieldPath}"`,
        );
      }
      field += 1;
    } else if (
      expression.fieldPath !== index.fields[field - 1] ||
      (state === "lower" && isLower) ||
      (state === "upper" && isUpper)
    ) {
      throw new Error(
        "Incorrect field used in `withIndex`: `.gt` and `.lt` must operate on the same field",
      );
    }
    if (isLower) {
      lower = { value, inclusive: expression.type === "Gte" };
      state = state === "eq" ? "lower" : "done";
    } else {
      upper = { value, inclusive: expression.type === "Lte" };
      state = state === "eq" ? "upper" : "done";
    }
  }
  let low = prefix;
  let high = prefixEnd(prefix);
  if (lower !== null) {
    const bound = prefix + encodeValue(lower.value);
    low = lower.inclusive ? bound : (prefixEnd(bound) ?? bound);
  }
  if (upper !== null) {
    const bound = prefix + encodeValue(upper.value);
    high = upper.inclusive ? prefixEnd(bound) : bound;
  }
  return { low, high };
}

export function plan(transaction: Transaction, query: SerializedQuery): Plan {
  const operators = query.operators;
  for (const operator of operators) {
    if ("limit" in operator && (!Number.isSafeInteger(operator.limit) || operator.limit < 0)) {
      throw new Error(`limit must be a non-negative integer, got ${String(operator.limit)}`);
    }
  }
  const { source } = query;
  if (source.type === "Search") throw new Error("Search indexes are not supported by this backend");
  if (source.type === "FullTableScan") {
    const index = tableOrDefault(transaction.store.schema, source.tableName).indexes.find(
      (candidate) => candidate.name.endsWith(".by_creation_time"),
    );
    if (index === undefined) throw new Error(`Unknown table ${source.tableName}`);
    return { index, low: "", high: null, order: source.order ?? "asc", operators };
  }
  const [table] = source.indexName.split(".");
  const index = tableOrDefault(transaction.store.schema, table ?? "").indexes.find(
    (candidate) => candidate.name === source.indexName,
  );
  if (index === undefined) {
    const indexName = source.indexName.slice((table ?? "").length + 1);
    throw new Error(
      `Index ${indexName} not found on table ${table ?? ""}; it must be declared in the schema.`,
    );
  }
  const { low, high } = planRange(index, source.range);
  return { index, low, high, order: source.order ?? "asc", operators };
}

/** Streaming query execution backing `queryStream` / `queryStreamNext`. */
export class QueryStream {
  private readonly scan: IndexScan;
  private readonly pipeline: Pipeline;

  constructor(queryPlan: Plan, transaction: Transaction) {
    this.scan = transaction.scan(queryPlan.index, queryPlan.low, queryPlan.high, queryPlan.order);
    this.pipeline = new Pipeline(queryPlan.operators);
  }

  next(): Document | null {
    for (;;) {
      if (this.pipeline.exhausted) {
        this.scan.finish(false);
        return null;
      }
      const row = this.scan.next();
      if (row === null) return null;
      if (this.pipeline.admit(row.document)) {
        // Record the read interval now: callers may never ask for more.
        if (this.pipeline.exhausted) this.scan.finish(false);
        return row.document;
      }
    }
  }

  close() {
    this.scan.finish(false);
  }
}

const CURSOR_PREFIX = "cvx1:";
const END_CURSOR = `${CURSOR_PREFIX}end`;

export interface PageResult {
  readonly page: Document[];
  readonly isDone: boolean;
  readonly continueCursor: string;
  readonly splitCursor: string | null;
  readonly pageStatus: "SplitRecommended" | "SplitRequired" | null;
}

/** A resume key, `null` for the start, or `{ end: true }` past the last page. */
function parseCursor(
  cursor: string | null,
  queryPlan: Plan,
): string | null | { readonly end: true } {
  if (cursor === null) return null;
  if (cursor === END_CURSOR) return { end: true };
  if (!cursor.startsWith(CURSOR_PREFIX)) throw new Error("Invalid pagination cursor");
  const [index, key] = cursor.slice(CURSOR_PREFIX.length).split("|");
  if (index !== queryPlan.index.name || key === undefined || !/^[0-9a-f]*$/.test(key)) {
    throw new Error("This pagination cursor belongs to a different query");
  }
  return key;
}

function cursorFor(queryPlan: Plan, key: string): string {
  return `${CURSOR_PREFIX}${queryPlan.index.name}|${key}`;
}

/**
 * `paginate()` over one plan: the page after `cursor`, up to `pageSize`
 * documents, or exactly the documents through `endCursor` when it is set (a
 * pinned page, as reactive pagination re-runs it). Like Convex, each page
 * runs the operator pipeline afresh from its cursor, so a `limit()` stage
 * bounds each page and ends pagination once it is full.
 */
export function paginate(
  transaction: Transaction,
  queryPlan: Plan,
  options: {
    readonly cursor: string | null;
    readonly endCursor: string | null;
    readonly pageSize: number;
    readonly maximumRowsRead: number | null;
  },
): PageResult {
  const start = parseCursor(options.cursor, queryPlan);
  if (typeof start === "object" && start !== null) {
    return {
      page: [],
      isDone: true,
      continueCursor: END_CURSOR,
      splitCursor: null,
      pageStatus: null,
    };
  }
  const end = parseCursor(options.endCursor, queryPlan);
  const ascending = queryPlan.order === "asc";
  let low = queryPlan.low;
  let high = queryPlan.high;
  if (typeof start === "string") {
    if (ascending) low = maxKey(low, keySuccessor(start));
    else high = minKey(high, start);
  }
  if (typeof end === "string") {
    if (ascending) high = minKey(high, keySuccessor(end));
    else low = maxKey(low, end);
  }
  const pageSize = Math.max(1, Math.floor(options.pageSize));
  const scan = transaction.scan(queryPlan.index, low, high, queryPlan.order);
  const pipeline = new Pipeline(queryPlan.operators);
  const page: Document[] = [];
  let rowsRead = 0;
  for (;;) {
    if (pipeline.exhausted) {
      // A full limit stage ends the query: no later row can reach the page.
      scan.finish(false);
      return {
        page,
        isDone: true,
        continueCursor: END_CURSOR,
        splitCursor: null,
        pageStatus: null,
      };
    }
    if (end === null && page.length >= pageSize) {
      // Peek one row so a page that ends exactly at the range end is done.
      const pageEnd = lastKeyOf(scan);
      if (scan.next() === null) break;
      scan.finish(false);
      return {
        page,
        isDone: false,
        continueCursor: cursorFor(queryPlan, pageEnd),
        splitCursor: null,
        pageStatus: null,
      };
    }
    const row = scan.next();
    if (row === null) break;
    rowsRead += 1;
    if (pipeline.admit(row.document)) page.push(row.document);
    if (options.maximumRowsRead !== null && rowsRead >= options.maximumRowsRead) {
      scan.finish(false);
      return {
        page,
        isDone: false,
        continueCursor: cursorFor(queryPlan, row.key),
        splitCursor: null,
        pageStatus: "SplitRequired",
      };
    }
  }
  if (typeof end === "string") {
    return {
      page,
      isDone: false,
      continueCursor: options.endCursor ?? END_CURSOR,
      splitCursor: null,
      pageStatus: null,
    };
  }
  return { page, isDone: true, continueCursor: END_CURSOR, splitCursor: null, pageStatus: null };
}

function lastKeyOf(scan: IndexScan): string {
  const key = scan.lastKey;
  if (key === null) throw new Error("Pagination stopped before reading a row");
  return key;
}

function maxKey(a: string, b: string): string {
  return a > b ? a : b;
}

function minKey(a: string | null, b: string): string {
  return a === null || b < a ? b : a;
}
