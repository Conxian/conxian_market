/**
 * Bounded replay/idempotency consumption for x402 payment claims.
 *
 * The x402 v2 wire codec (`x402_v2_wire.ts`) parses payment claims but, by
 * design, performs NO replay consumption — an opaque signature or a `success`
 * field is an unverified claim. This module is the missing consumption gate: a
 * caller that has *independently* verified a payment claim must consume its
 * identifier here before acting, so the same claim cannot be replayed.
 *
 * Fail-closed: `consume` reports `replay: true` for any identifier already seen
 * inside the window, and callers MUST treat that as a rejection. This guard is
 * process-local and in-memory only; durable, shared replay protection is a
 * provider/deployment concern (Market #176 / Business #1390).
 */
import { createHash } from "node:crypto";

export const REPLAY_GUARD_PROFILE = "conxian-x402-replay-guard/1" as const;

/** Default retention window for a consumed claim identifier (24 hours). */
export const DEFAULT_REPLAY_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Default bounded capacity so a hostile caller cannot exhaust memory. */
export const DEFAULT_REPLAY_MAX_ENTRIES = 10_000;
/** Upper bound on a claim identifier's length before hashing. */
export const REPLAY_MAX_IDENTIFIER_BYTES = 512;

export interface ReplayConsumptionResult {
  /** Stable key derived from the claim identifier (never the raw identifier). */
  key: string;
  /** True when this identifier was already consumed inside the window. */
  replay: boolean;
  /** Epoch ms of the first consumption (this call when replay is false). */
  firstSeenAt: number;
  /** Epoch ms when this entry expires. */
  expiresAt: number;
}

export interface ReplayGuardOptions {
  /** Retention window in ms. Defaults to {@link DEFAULT_REPLAY_WINDOW_MS}. */
  windowMs?: number;
  /** Maximum tracked identifiers. Defaults to {@link DEFAULT_REPLAY_MAX_ENTRIES}. */
  maxEntries?: number;
  /** Injectable clock for deterministic tests. */
  now?: () => number;
}

interface Entry {
  firstSeenAt: number;
  expiresAt: number;
}

/** Deterministic key for a claim identifier; raw identifiers are never retained. */
export function replayKeyFor(identifier: string): string {
  if (typeof identifier !== "string" || !identifier.trim() ||
      Buffer.byteLength(identifier, "utf8") > REPLAY_MAX_IDENTIFIER_BYTES) {
    throw new Error("replay guard requires a bounded non-empty claim identifier");
  }
  return `x402replay_${createHash("sha256").update(identifier, "utf8").digest("hex")}`;
}

export class ReplayGuard {
  private readonly entries = new Map<string, Entry>();
  private readonly windowMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(options: ReplayGuardOptions = {}) {
    this.windowMs = options.windowMs ?? DEFAULT_REPLAY_WINDOW_MS;
    this.maxEntries = options.maxEntries ?? DEFAULT_REPLAY_MAX_ENTRIES;
    this.now = options.now ?? Date.now;
    if (!(this.windowMs > 0) || !Number.isFinite(this.windowMs)) {
      throw new Error("replay guard windowMs must be a positive finite number");
    }
    if (!Number.isInteger(this.maxEntries) || this.maxEntries < 1) {
      throw new Error("replay guard maxEntries must be a positive integer");
    }
  }

  /**
   * Record and test a claim identifier. Returns `replay: true` when the same
   * identifier was already consumed inside the window; a first consumption is
   * recorded and returns `replay: false`. Never verifies the payment itself.
   */
  consume(identifier: string): ReplayConsumptionResult {
    const key = replayKeyFor(identifier);
    const at = this.now();
    const existing = this.entries.get(key);
    if (existing && existing.expiresAt > at) {
      return { key, replay: true, firstSeenAt: existing.firstSeenAt, expiresAt: existing.expiresAt };
    }
    this.prune(at);
    const entry: Entry = { firstSeenAt: at, expiresAt: at + this.windowMs };
    this.entries.set(key, entry);
    this.evictOverflow();
    return { key, replay: false, firstSeenAt: entry.firstSeenAt, expiresAt: entry.expiresAt };
  }

  /** Number of unexpired entries currently tracked. */
  get size(): number {
    this.prune(this.now());
    return this.entries.size;
  }

  private prune(at: number): void {
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= at) this.entries.delete(key);
    }
  }

  private evictOverflow(): void {
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.entries.delete(oldest.value);
    }
  }
}
