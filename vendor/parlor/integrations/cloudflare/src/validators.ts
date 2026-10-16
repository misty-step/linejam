import { convexToJson, jsonToConvex, type JSONValue, type Value } from "convex/values";
import { decodeId } from "./ids.js";

/** JSON form of a Convex validator, as produced by `validator.json`. */
export type ValidatorJson =
  | { readonly type: "null" | "number" | "bigint" | "boolean" | "string" | "bytes" | "any" }
  | { readonly type: "literal"; readonly value: JSONValue }
  | { readonly type: "id"; readonly tableName: string }
  | { readonly type: "array"; readonly value: ValidatorJson }
  | { readonly type: "record"; readonly keys: ValidatorJson; readonly values: FieldJson }
  | { readonly type: "object"; readonly value: Readonly<Record<string, FieldJson>> }
  | { readonly type: "union"; readonly value: readonly ValidatorJson[] };

export interface FieldJson {
  readonly fieldType: ValidatorJson;
  readonly optional: boolean;
}

/** Resolves an ID's table name; IDs of unknown tables never validate. */
export type TableNameResolver = (tableNumber: number) => string | undefined;

export class ValidationError extends Error {
  override readonly name = "ValidationError";
}

function show(value: Value | undefined): string {
  if (value === undefined) return "undefined";
  try {
    return JSON.stringify(convexToJson(value));
  } catch {
    return typeof value === "object" ? "[unserializable]" : JSON.stringify(value);
  }
}

export function printValidator(validator: ValidatorJson): string {
  switch (validator.type) {
    case "null":
    case "number":
    case "bigint":
    case "boolean":
    case "string":
    case "bytes":
    case "any":
      return `v.${validator.type === "bigint" ? "int64" : validator.type === "number" ? "float64" : validator.type}()`;
    case "literal":
      return `v.literal(${JSON.stringify(validator.value)})`;
    case "id":
      return `v.id("${validator.tableName}")`;
    case "array":
      return `v.array(${printValidator(validator.value)})`;
    case "record":
      return `v.record(${printValidator(validator.keys)}, ${printValidator(validator.values.fieldType)})`;
    case "union":
      return `v.union(${validator.value.map(printValidator).join(", ")})`;
    case "object":
      return `v.object({${Object.entries(validator.value)
        .map(
          ([key, field]) =>
            `${key}: ${field.optional ? `v.optional(${printValidator(field.fieldType)})` : printValidator(field.fieldType)}`,
        )
        .join(", ")}})`;
    default:
      return JSON.stringify(validator);
  }
}

function isPlainObject(value: unknown): value is Record<string, Value | undefined> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  if (value instanceof ArrayBuffer) return false;
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === null || prototype === Object.prototype;
}

function mismatch(validator: ValidatorJson, value: Value | undefined, path: string): never {
  throw new ValidationError(
    `Value does not match validator.\nPath: ${path || "."}\nValue: ${show(value)}\nValidator: ${printValidator(validator)}`,
  );
}

function sameLiteral(expected: Value, actual: Value | undefined): boolean {
  if (typeof expected === "number" && typeof actual === "number") {
    return Object.is(expected, actual) || expected === actual;
  }
  return expected === actual;
}

export function validateValue(
  validator: ValidatorJson,
  value: Value | undefined,
  resolveTable: TableNameResolver,
  path = "",
): void {
  switch (validator.type) {
    case "any":
      if (value === undefined) mismatch(validator, value, path);
      return;
    case "null":
      if (value !== null) mismatch(validator, value, path);
      return;
    case "number":
      if (typeof value !== "number") mismatch(validator, value, path);
      return;
    case "bigint":
      if (typeof value !== "bigint") mismatch(validator, value, path);
      return;
    case "boolean":
      if (typeof value !== "boolean") mismatch(validator, value, path);
      return;
    case "string":
      if (typeof value !== "string") mismatch(validator, value, path);
      return;
    case "bytes":
      if (!(value instanceof ArrayBuffer)) mismatch(validator, value, path);
      return;
    case "literal":
      if (!sameLiteral(jsonToConvex(validator.value), value)) mismatch(validator, value, path);
      return;
    case "id": {
      const decoded = typeof value === "string" ? decodeId(value) : null;
      if (decoded === null || resolveTable(decoded.tableNumber) !== validator.tableName) {
        mismatch(validator, value, path);
      }
      return;
    }
    case "array":
      if (!Array.isArray(value)) mismatch(validator, value, path);
      value.forEach((element, index) => {
        validateValue(validator.value, element, resolveTable, `${path}[${index}]`);
      });
      return;
    case "record":
      if (!isPlainObject(value)) mismatch(validator, value, path);
      for (const [key, element] of Object.entries(value)) {
        validateValue(validator.keys, key, resolveTable, `${path}.${key}`);
        validateValue(validator.values.fieldType, element, resolveTable, `${path}.${key}`);
      }
      return;
    case "object": {
      if (!isPlainObject(value)) mismatch(validator, value, path);
      for (const [key, field] of Object.entries(validator.value)) {
        const element = value[key];
        if (element === undefined) {
          if (!field.optional) {
            throw new ValidationError(
              `Object is missing the required field \`${key}\`. Consider wrapping the field validator in \`v.optional(...)\` if this is expected.\n\nObject: ${show(value)}\nValidator: ${printValidator(validator)}`,
            );
          }
          continue;
        }
        validateValue(field.fieldType, element, resolveTable, `${path}.${key}`);
      }
      for (const key of Object.keys(value)) {
        if (!Object.hasOwn(validator.value, key) && value[key] !== undefined) {
          throw new ValidationError(
            `Object contains extra field \`${key}\` that is not in the validator.\nPath: ${path || "."}\nObject: ${show(value)}\nValidator: ${printValidator(validator)}`,
          );
        }
      }
      return;
    }
    case "union": {
      for (const member of validator.value) {
        try {
          validateValue(member, value, resolveTable, path);
          return;
        } catch (error) {
          if (!(error instanceof ValidationError)) throw error;
        }
      }
      mismatch(validator, value, path);
    }
  }
}
