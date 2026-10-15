import { Base64, type JSONValue } from "convex/values";
import { AuthenticationError, type TokenVerifier } from "./auth.js";
import {
  canonicalizeUdfPath,
  type FunctionOutcome,
  type Runtime,
  type UserIdentity,
} from "./runtime.js";
import { ReadSet, type CommitResult } from "./store.js";
import { exceedsUtf8Bytes } from "./utf8.js";

/**
 * Server side of the Convex client sync protocol (`/api/<version>/sync`), as
 * spoken by `convex/browser` and `convex/react`. Every transition is built
 * while holding the database lock, so each one reflects a single committed
 * timestamp and arrives in the order the client requires.
 */

export interface SocketLike {
  send(message: string): void;
  close(code?: number, reason?: string): void;
}

interface Version {
  readonly querySet: number;
  readonly identity: number;
  readonly ts: bigint;
}

interface Subscription {
  readonly udfPath: string;
  readonly args: JSONValue;
  result: string;
  reads: ReadSet;
  journal: string | null;
}

type Modification =
  | {
      type: "QueryUpdated";
      queryId: number;
      value: JSONValue;
      logLines: string[];
      journal: string | null;
    }
  | {
      type: "QueryFailed";
      queryId: number;
      errorMessage: string;
      logLines: string[];
      journal: string | null;
      errorData?: JSONValue;
    }
  | { type: "QueryRemoved"; queryId: number };

const MAX_QUERIES = 512;
const MAX_MESSAGE_BYTES = 1 << 20;
/** Actions one connection may have running at once; more are refused, not queued. */
const MAX_CONCURRENT_ACTIONS = 32;

/**
 * A client frame as a WebSocket delivers it: text, or binary data. Workers
 * deliver binary frames as Blobs by default; other hosts use ArrayBuffers.
 */
export type ClientFrame = string | ArrayBuffer | Blob;

/** Whether a frame is over `limit` bytes, judged before it is decoded. */
function frameExceeds(frame: ClientFrame, limit: number): boolean {
  if (typeof frame === "string") return exceedsUtf8Bytes(frame, limit);
  return (frame instanceof Blob ? frame.size : frame.byteLength) > limit;
}

async function frameText(frame: ClientFrame): Promise<string> {
  if (typeof frame === "string") return frame;
  return new TextDecoder().decode(frame instanceof Blob ? await frame.arrayBuffer() : frame);
}

export function encodeTs(ts: bigint): string {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, BigInt.asUintN(64, ts), true);
  return Base64.fromByteArray(bytes);
}

function modificationFor(
  queryId: number,
  outcome: FunctionOutcome,
  journal: string | null,
): Modification {
  if (outcome.success) {
    return { type: "QueryUpdated", queryId, value: outcome.value, logLines: [], journal };
  }
  return outcome.data === undefined
    ? { type: "QueryFailed", queryId, errorMessage: outcome.message, logLines: [], journal }
    : {
        type: "QueryFailed",
        queryId,
        errorMessage: outcome.message,
        logLines: [],
        journal,
        errorData: outcome.data,
      };
}

export class SyncSession {
  private sessionId: string | null = null;
  private sent: Version = { querySet: 0, identity: 0, ts: 0n };
  private querySetVersion = 0;
  private identityVersion = 0;
  private identity: UserIdentity | null = null;
  private identityExpiresAt: number | null = null;
  private expiryNotified = -1;
  private readonly subscriptions = new Map<number, Subscription>();
  private queue: Promise<void> = Promise.resolve();
  private actionsRunning = 0;
  private closed = false;
  private readonly unsubscribe: () => void;

  constructor(
    private readonly runtime: Runtime,
    private readonly verifier: TokenVerifier | null,
    private readonly socket: SocketLike,
  ) {
    this.unsubscribe = runtime.onCommit((commit) => this.refreshLocked(commit, false));
  }

  /**
   * Process one client frame. Frames are handled strictly in order, except
   * that an action runs alongside later frames once admitted, as on Convex.
   */
  receive(frame: ClientFrame) {
    if (this.closed) return;
    if (frameExceeds(frame, MAX_MESSAGE_BYTES)) {
      this.fatal("Message too large");
      return;
    }
    this.queue = this.queue
      .then(async () => this.handle(await frameText(frame)))
      .catch((error: unknown) => {
        console.error("parlor-cloudflare: sync message failed", error);
        this.fatal("Internal server error");
      });
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.unsubscribe();
    this.subscriptions.clear();
  }

  ping() {
    this.send({ type: "Ping" });
  }

  private send(message: unknown) {
    if (this.closed) return;
    try {
      this.socket.send(JSON.stringify(message));
    } catch {
      this.close();
    }
  }

  private fatal(error: string) {
    this.send({ type: "FatalError", error });
    try {
      this.socket.close(1011, error.slice(0, 120));
    } catch {
      // Already closed.
    }
    this.close();
  }

  private currentIdentity(): UserIdentity | null {
    if (this.identityExpiresAt !== null && Date.now() >= this.identityExpiresAt) return null;
    return this.identity;
  }

  private async handle(frame: string) {
    let message: Record<string, unknown>;
    try {
      message = JSON.parse(frame) as Record<string, unknown>;
    } catch {
      this.fatal("Invalid message");
      return;
    }
    switch (message["type"]) {
      case "Connect":
        if (typeof message["sessionId"] !== "string") {
          this.fatal("Invalid Connect message");
          return;
        }
        this.sessionId = message["sessionId"];
        return;
      case "ModifyQuerySet":
        await this.runtime.exclusive(() => this.modifyQuerySetLocked(message));
        return;
      case "Authenticate":
        await this.authenticate(message);
        return;
      case "Mutation":
        await this.mutation(message);
        return;
      case "Action":
        this.action(message);
        return;
      case "Event":
        return;
      default:
        this.fatal(`Unknown message type ${String(message["type"])}`);
    }
  }

  private transition(modifications: Modification[]) {
    const end: Version = {
      querySet: this.querySetVersion,
      identity: this.identityVersion,
      ts: this.runtime.store.ts,
    };
    this.send({
      type: "Transition",
      startVersion: {
        querySet: this.sent.querySet,
        identity: this.sent.identity,
        ts: encodeTs(this.sent.ts),
      },
      endVersion: { querySet: end.querySet, identity: end.identity, ts: encodeTs(end.ts) },
      modifications,
    });
    this.sent = end;
  }

  private async evaluateLocked(
    queryId: number,
    subscription: Subscription,
  ): Promise<Modification | null> {
    const { outcome, reads, journal } = await this.runtime.queryLocked(
      subscription.udfPath,
      subscription.args,
      this.currentIdentity(),
      "public",
      subscription.journal,
    );
    subscription.reads = reads;
    subscription.journal = journal ?? subscription.journal;
    const result = JSON.stringify([outcome, subscription.journal]);
    if (result === subscription.result) return null;
    subscription.result = result;
    return modificationFor(queryId, outcome, subscription.journal);
  }

  private async modifyQuerySetLocked(message: Record<string, unknown>) {
    const baseVersion = message["baseVersion"];
    const newVersion = message["newVersion"];
    const modifications = message["modifications"];
    if (
      baseVersion !== this.querySetVersion ||
      typeof newVersion !== "number" ||
      !Array.isArray(modifications)
    ) {
      this.fatal(
        `Base version ${String(baseVersion)} passed up doesn't match the current version ${this.querySetVersion}`,
      );
      return;
    }
    const output: Modification[] = [];
    for (const raw of modifications as Record<string, unknown>[]) {
      const queryId = Number(raw["queryId"]);
      if (raw["type"] === "Remove") {
        if (this.subscriptions.delete(queryId)) output.push({ type: "QueryRemoved", queryId });
        continue;
      }
      if (
        raw["type"] !== "Add" ||
        typeof raw["udfPath"] !== "string" ||
        !Array.isArray(raw["args"])
      ) {
        this.fatal("Invalid query set modification");
        return;
      }
      if (this.subscriptions.size >= MAX_QUERIES) {
        this.fatal(`Too many subscribed queries (limit ${MAX_QUERIES})`);
        return;
      }
      const subscription: Subscription = {
        udfPath: canonicalizeUdfPath(raw["udfPath"]),
        args: (raw["args"] as JSONValue[])[0] ?? {},
        result: "",
        reads: new ReadSet(),
        journal: typeof raw["journal"] === "string" ? raw["journal"] : null,
      };
      this.subscriptions.set(queryId, subscription);
      const modification = await this.evaluateLocked(queryId, subscription);
      if (modification !== null) output.push(modification);
    }
    this.querySetVersion = newVersion;
    this.transition(output);
  }

  private async authenticate(message: Record<string, unknown>) {
    const baseVersion = Number(message["baseVersion"]);
    let identity: UserIdentity | null = null;
    let expiresAt: number | null = null;
    if (message["tokenType"] === "User") {
      try {
        if (this.verifier === null || !this.verifier.enabled) {
          throw new AuthenticationError(
            "No auth provider found matching the given token. Check your auth.config.ts.",
          );
        }
        const verified = await this.verifier.verify(
          typeof message["value"] === "string" ? message["value"] : "",
        );
        identity = verified.identity;
        expiresAt = verified.expiresAt;
      } catch (error) {
        const reason =
          error instanceof AuthenticationError ? error.message : "Could not verify token";
        this.send({ type: "AuthError", error: reason, baseVersion, authUpdateAttempted: true });
        return;
      }
    } else if (message["tokenType"] === "Admin") {
      this.send({
        type: "AuthError",
        error: "Admin authentication is not supported",
        baseVersion,
        authUpdateAttempted: true,
      });
      return;
    }
    await this.runtime.exclusive(async () => {
      if (baseVersion !== this.identityVersion) {
        this.fatal(
          `Authentication base version ${baseVersion} doesn't match ${this.identityVersion}`,
        );
        return;
      }
      const changed = JSON.stringify(identity) !== JSON.stringify(this.currentIdentity());
      this.identity = identity;
      this.identityExpiresAt = expiresAt;
      this.identityVersion = baseVersion + 1;
      const output: Modification[] = [];
      if (changed) {
        for (const [queryId, subscription] of this.subscriptions) {
          const modification = await this.evaluateLocked(queryId, subscription);
          if (modification !== null) output.push(modification);
        }
      }
      this.transition(output);
    });
  }

  private async mutation(message: Record<string, unknown>) {
    const requestId = Number(message["requestId"]);
    const udfPath = typeof message["udfPath"] === "string" ? message["udfPath"] : "";
    const args = (message["args"] as JSONValue[] | undefined)?.[0] ?? {};
    if (this.sessionId === null) {
      this.fatal("Mutation before Connect");
      return;
    }
    const sessionId = this.sessionId;
    await this.runtime.exclusive(async () => {
      const result = await this.runtime.mutationLocked(udfPath, args, this.currentIdentity(), {
        receipt: { sessionId, requestId },
      });
      if (result.outcome.success) {
        this.send({
          type: "MutationResponse",
          requestId,
          success: true,
          result: result.outcome.value,
          ts: encodeTs(result.ts),
          logLines: [],
        });
      } else {
        this.send({
          type: "MutationResponse",
          requestId,
          success: false,
          result: result.outcome.message,
          logLines: [],
          ...(result.outcome.data === undefined ? {} : { errorData: result.outcome.data }),
        });
        return;
      }
      if (result.commit !== null) {
        // Refresh every session, this one included; then make sure this
        // client sees a transition at or after its mutation's timestamp.
        await this.runtime.notifyLocked(result.commit);
      }
      if (this.sent.ts < result.ts || this.sent.ts < this.runtime.store.ts) this.transition([]);
    });
  }

  /**
   * Start an action without holding up later frames. The identity is the
   * one in force when the frame was processed, as if the action ran then.
   */
  private action(message: Record<string, unknown>) {
    const requestId = Number(message["requestId"]);
    const udfPath = typeof message["udfPath"] === "string" ? message["udfPath"] : "";
    const args = (message["args"] as JSONValue[] | undefined)?.[0] ?? {};
    if (this.actionsRunning >= MAX_CONCURRENT_ACTIONS) {
      this.send({
        type: "ActionResponse",
        requestId,
        success: false,
        result: `Too many concurrent actions on this connection (limit ${MAX_CONCURRENT_ACTIONS})`,
        logLines: [],
      });
      return;
    }
    const identity = this.currentIdentity();
    this.actionsRunning += 1;
    void this.runtime
      .action(udfPath, args, identity)
      .then((outcome) =>
        this.send(
          outcome.success
            ? {
                type: "ActionResponse",
                requestId,
                success: true,
                result: outcome.value,
                logLines: [],
              }
            : {
                type: "ActionResponse",
                requestId,
                success: false,
                result: outcome.message,
                logLines: [],
                ...(outcome.data === undefined ? {} : { errorData: outcome.data }),
              },
        ),
      )
      .catch((error: unknown) => {
        console.error("parlor-cloudflare: action failed", error);
        this.fatal("Internal server error");
      })
      .finally(() => {
        this.actionsRunning -= 1;
      });
  }

  /** Re-run invalidated subscriptions after a commit (lock held). */
  private async refreshLocked(commit: CommitResult, force: boolean) {
    if (this.closed) return;
    const output: Modification[] = [];
    for (const [queryId, subscription] of this.subscriptions) {
      // A replaced database invalidates every read, removed rows included.
      if (!commit.replaced && !subscription.reads.overlaps(commit.changes)) continue;
      const modification = await this.evaluateLocked(queryId, subscription);
      if (modification !== null) output.push(modification);
    }
    if (output.length > 0 || force) this.transition(output);
  }

  /** Expire identities whose token lapsed so the client refreshes them. */
  checkIdentityExpiry(now = Date.now()) {
    if (this.identityExpiresAt === null || this.identity === null || now < this.identityExpiresAt)
      return;
    if (this.expiryNotified === this.identityVersion) return;
    this.expiryNotified = this.identityVersion;
    this.send({
      type: "AuthError",
      error: "Token expired",
      baseVersion: this.identityVersion - 1,
      authUpdateAttempted: false,
    });
  }
}
