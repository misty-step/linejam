import type {
  DocumentByName,
  TableNamesInDataModel,
  DataModelFromSchemaDefinition,
  GenericMutationCtx,
  GenericQueryCtx,
} from "convex/server";

import schema from "./schema.js";

export type ParlorDataModel = DataModelFromSchemaDefinition<typeof schema>;

/** A consumer may retain historical rooms that predate Parlor adoption. */
export type StoredRoom = Omit<ParlorDataModel["rooms"]["document"], "hostPlayerId"> & {
  readonly hostPlayerId?: ParlorDataModel["rooms"]["document"]["hostPlayerId"];
};

type ParlorStorageDataModel = Omit<ParlorDataModel, "rooms"> & {
  rooms: Omit<ParlorDataModel["rooms"], "document"> & { document: StoredRoom };
};
export type ParlorDoc<TableName extends TableNamesInDataModel<ParlorDataModel>> = DocumentByName<
  ParlorDataModel,
  TableName
>;

// Select database operations, not whole database interfaces, so applications can
// extend the schema without making game-owned tables part of Parlor's contract.
export type ParlorQueryCtx = {
  readonly auth: GenericQueryCtx<ParlorStorageDataModel>["auth"];
  readonly db: Pick<GenericQueryCtx<ParlorStorageDataModel>["db"], "get" | "query">;
};
export type ParlorMutationCtx = {
  readonly auth: GenericMutationCtx<ParlorStorageDataModel>["auth"];
  readonly db: Pick<
    GenericMutationCtx<ParlorStorageDataModel>["db"],
    "get" | "query" | "insert" | "patch" | "replace" | "delete"
  >;
};
export type ParlorCtx = ParlorQueryCtx | ParlorMutationCtx;
