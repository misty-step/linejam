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
  /** Sentry DSN secret. Unbound = error forwarding is a no-op ([L1-8.7]). */
  SENTRY_DSN?: string;
  /** Accepted as a second name for the same DSN ([L1-8.4]). */
  NEXT_PUBLIC_SENTRY_DSN?: string;
}
