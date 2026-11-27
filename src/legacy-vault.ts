import { DurableObject } from 'cloudflare:workers';

/**
 * The pre-recompile backend lived in one SQLite Durable Object of this class
 * name. The clean-room Worker has no code path into it: no route, no RPC, no
 * alarm. The class is still exported, and its migration tag kept, for one
 * reason — removing either would make the next deploy delete that object and
 * every guest history, accepted poem and published link inside it.
 *
 * Its data moves to `ArchiveDO` through the operator import
 * (`scripts/import-legacy.mjs`). Deleting the class afterwards is a separate,
 * explicit and irreversible operator decision.
 */
export class LinejamBackend extends DurableObject {
  override fetch(): Response {
    return new Response('Gone', { status: 410 });
  }
}
