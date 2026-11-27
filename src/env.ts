import type { ArchiveDO } from './archive.ts';
import type { RoomDO } from './room.ts';

export interface Env {
  ASSETS: Fetcher;
  ROOM: DurableObjectNamespace<RoomDO>;
  ARCHIVE: DurableObjectNamespace<ArchiveDO>;
  LEGACY_VAULT: DurableObjectNamespace;
  GUEST_TOKEN_SECRET?: string;
  LINEJAM_ADMIN_KEY?: string;
  LINEJAM_ENVIRONMENT?: string;
  RETENTION_GC_ENABLED?: string;
}
