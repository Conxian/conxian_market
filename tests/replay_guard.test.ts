import { describe, expect, it } from "vitest";
import {
  DEFAULT_REPLAY_WINDOW_MS,
  ReplayGuard,
  replayKeyFor,
} from "../src/replay_guard.js";

describe("ReplayGuard", () => {
  it("treats the first consumption as fresh and the second as a replay", () => {
    const guard = new ReplayGuard();
    const first = guard.consume("invoice:abc123");
    expect(first.replay).toBe(false);
    const second = guard.consume("invoice:abc123");
    expect(second.replay).toBe(true);
    expect(second.firstSeenAt).toBe(first.firstSeenAt);
  });

  it("keys distinct identifiers independently", () => {
    const guard = new ReplayGuard();
    expect(guard.consume("a").replay).toBe(false);
    expect(guard.consume("b").replay).toBe(false);
    expect(guard.size).toBe(2);
  });

  it("releases the identifier after the retention window elapses", () => {
    let now = 1_000;
    const guard = new ReplayGuard({ windowMs: 100, now: () => now });
    expect(guard.consume("claim").replay).toBe(false);
    now += 99;
    expect(guard.consume("claim").replay).toBe(true);
    now += 2;
    expect(guard.consume("claim").replay).toBe(false);
  });

  it("prunes expired entries from the tracked size", () => {
    let now = 0;
    const guard = new ReplayGuard({ windowMs: 50, now: () => now });
    guard.consume("x");
    guard.consume("y");
    expect(guard.size).toBe(2);
    now = 51;
    expect(guard.size).toBe(0);
  });

  it("evicts the oldest entry when capacity is exceeded", () => {
    const guard = new ReplayGuard({ maxEntries: 2 });
    expect(guard.consume("one").replay).toBe(false);
    expect(guard.consume("two").replay).toBe(false);
    expect(guard.consume("three").replay).toBe(false);
    expect(guard.size).toBe(2);
    // "one" was evicted, so it is treated as fresh again.
    expect(guard.consume("one").replay).toBe(false);
  });

  it("never retains the raw identifier in the derived key", () => {
    const key = replayKeyFor("super-secret-invoice-id");
    expect(key.startsWith("x402replay_")).toBe(true);
    expect(key).not.toContain("super-secret-invoice-id");
  });

  it("rejects an empty or oversized identifier", () => {
    expect(() => replayKeyFor("")).toThrow();
    expect(() => replayKeyFor("   ")).toThrow();
    expect(() => replayKeyFor("z".repeat(513))).toThrow();
  });

  it("rejects non-positive windows and capacities", () => {
    expect(() => new ReplayGuard({ windowMs: 0 })).toThrow();
    expect(() => new ReplayGuard({ windowMs: Number.POSITIVE_INFINITY })).toThrow();
    expect(() => new ReplayGuard({ maxEntries: 0 })).toThrow();
  });

  it("defaults the window to 24 hours", () => {
    const guard = new ReplayGuard();
    const result = guard.consume("k");
    expect(result.expiresAt - result.firstSeenAt).toBe(DEFAULT_REPLAY_WINDOW_MS);
  });
});
