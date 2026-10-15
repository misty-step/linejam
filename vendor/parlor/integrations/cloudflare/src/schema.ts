import type { ValidatorJson } from "./validators.js";

/** A queryable database index, including the implicit system indexes. */
export interface IndexModel {
  /** `table.indexDescriptor`, the name used by serialized queries. */
  readonly name: string;
  readonly table: string;
  /** Declared fields, without the implicit `_creationTime` and `_id` suffix. */
  readonly fields: readonly string[];
  /** Every field that makes up the stored key, in order. */
  readonly keyFields: readonly string[];
}

export interface TableModel {
  readonly name: string;
  readonly documentType: ValidatorJson | null;
  readonly indexes: readonly IndexModel[];
}

export interface SchemaModel {
  readonly validate: boolean;
  readonly tables: ReadonlyMap<string, TableModel>;
}

interface ExportedTable {
  readonly tableName: string;
  readonly indexes: readonly {
    readonly indexDescriptor: string;
    readonly fields: readonly string[];
  }[];
  readonly searchIndexes?: readonly unknown[];
  readonly vectorIndexes?: readonly unknown[];
  readonly documentType: ValidatorJson | null;
}

interface ExportedSchema {
  readonly tables: readonly ExportedTable[];
  readonly schemaValidation: boolean;
}

/** A Convex `SchemaDefinition` from `defineSchema()`; its `export()` is Convex-internal. */
export type ConvexSchemaDefinition = object;

function exportSchema(schema: ConvexSchemaDefinition): ExportedSchema {
  const exporter = (schema as { export?: unknown }).export;
  if (typeof exporter !== "function")
    throw new Error("Expected a SchemaDefinition from defineSchema()");
  return JSON.parse((exporter as () => string).call(schema)) as ExportedSchema;
}

export const SCHEDULED_FUNCTIONS_TABLE = "_scheduled_functions";
const SYSTEM_TABLES = new Map<string, ExportedTable>([
  [
    SCHEDULED_FUNCTIONS_TABLE,
    {
      tableName: SCHEDULED_FUNCTIONS_TABLE,
      indexes: [{ indexDescriptor: "by_state_time", fields: ["state.kind", "scheduledTime"] }],
      documentType: null,
    },
  ],
]);

function tableModel(table: ExportedTable): TableModel {
  const indexes: IndexModel[] = [
    {
      name: `${table.tableName}.by_id`,
      table: table.tableName,
      fields: ["_id"],
      keyFields: ["_id"],
    },
    {
      name: `${table.tableName}.by_creation_time`,
      table: table.tableName,
      fields: ["_creationTime"],
      keyFields: ["_creationTime", "_id"],
    },
  ];
  for (const index of table.indexes) {
    if (index.indexDescriptor === "by_id" || index.indexDescriptor === "by_creation_time") {
      throw new Error(
        `Index name ${index.indexDescriptor} is reserved in table ${table.tableName}`,
      );
    }
    indexes.push({
      name: `${table.tableName}.${index.indexDescriptor}`,
      table: table.tableName,
      fields: index.fields,
      keyFields: [...index.fields, "_creationTime", "_id"],
    });
  }
  return { name: table.tableName, documentType: table.documentType, indexes };
}

export function schemaModel(schema: ConvexSchemaDefinition | null): SchemaModel {
  const exported: ExportedSchema =
    schema === null ? { tables: [], schemaValidation: false } : exportSchema(schema);
  const tables = new Map<string, TableModel>();
  for (const table of [...exported.tables, ...SYSTEM_TABLES.values()]) {
    if ((table.searchIndexes?.length ?? 0) > 0 || (table.vectorIndexes?.length ?? 0) > 0) {
      throw new Error(`Search and vector indexes are not supported (table ${table.tableName})`);
    }
    tables.set(table.tableName, tableModel(table));
  }
  return { validate: exported.schemaValidation, tables };
}

/** Tables without a schema entry still get the implicit system indexes. */
export function tableOrDefault(schema: SchemaModel, table: string): TableModel {
  return (
    schema.tables.get(table) ?? tableModel({ tableName: table, indexes: [], documentType: null })
  );
}

export function isSystemTable(table: string): boolean {
  return table.startsWith("_");
}
