import { describe, it, expect } from "vitest";
import {
  MPP_BRIDGE_PROFILE,
  MPP_AUTH_SCHEME,
  MPP_INTENTS,
  mppIntentToProduct,
  parseMppChallengeHeader,
  encodeMppChallengeHeader,
  decodeMppRequest,
  parseMppCredential,
  encodeMppCredentialHeader,
  parseMppReceipt,
  encodeMppReceiptHeader,
  buildMppReceipt,
  MppBridge,
  type MppChallenge,
  type MppCredential,
  type MppReceipt,
} from "../src/mpp_bridge.js";
import { ReplayGuard } from "../src/replay_guard.js";
import type { JobCard } from "../src/core_types.js";

// Synthetic fixtures follow the MPP wire contract (mpp.dev). No real payment,
// wallet, or settlement is represented. The base64url `request` below decodes
// to { amount: "100000", currency: "usd", recipient: "0xtest-recipient" }.
const REQUEST = Buffer.from(
  JSON.stringify({ amount: "100000", currency: "usd", recipient: "0xtest-recipient" }),
  "utf8",
).toString("base64url");

const job: Pick<JobCard, "id" | "title" | "description" | "bountySat" | "deadline"> = {
  id: "job-mpp-1",
  title: "Translate a document",
  description: "EN→FR",
  bountySat: 100000n,
  deadline: 4_102_444_800_000, // far future
};

function challenge(overrides: Partial<MppChallenge> = {}): MppChallenge {
  return {
    id: "qB3wErTyU7iOpAsD9fGhJk",
    realm: "mpp.dev",
    method: "tempo",
    intent: "charge",
    request: REQUEST,
    ...overrides,
  };
}

function credential(ch: MppChallenge, overrides: Partial<MppCredential> = {}): MppCredential {
  return {
    challenge: {
      id: ch.id,
      realm: ch.realm,
      method: ch.method,
      intent: ch.intent,
      request: ch.request,
      ...(ch.expires !== undefined ? { expires: ch.expires } : {}),
      ...(ch.opaque !== undefined ? { opaque: ch.opaque } : {}),
    },
    source: "did:pkh:eip155:4217:0x1234567890abcdef1234567890abcdef12345678",
    payload: { hash: "0xabc123", type: "hash" },
    ...overrides,
  };
}

describe("MPP wire codecs (bounded, canonical)", () => {
  it("exposes a stable profile id and the three intents", () => {
    expect(MPP_BRIDGE_PROFILE).toBe("conxian-mpp-bridge/1");
    expect(MPP_AUTH_SCHEME).toBe("Payment");
    expect(MPP_INTENTS).toEqual(["charge", "session", "subscription"]);
  });

  it("round-trips a challenge header with the Payment scheme and quoted params", () => {
    const ch = challenge({ description: "Weather data", expires: "2027-01-15T12:05:00Z" });
    const header = encodeMppChallengeHeader(ch);
    expect(header.startsWith("Payment ")).toBe(true);
    expect(parseMppChallengeHeader(header)).toEqual(ch);
  });

  it("parses a challenge header without the scheme prefix", () => {
    const ch = challenge();
    const withoutScheme = encodeMppChallengeHeader(ch).slice("Payment ".length);
    expect(parseMppChallengeHeader(withoutScheme)).toEqual(ch);
  });

  it("decodes the request parameter to structured fields", () => {
    expect(decodeMppRequest(challenge())).toEqual({
      amount: "100000",
      currency: "usd",
      recipient: "0xtest-recipient",
    });
  });

  it("round-trips a credential header", () => {
    const ch = challenge();
    const cred = credential(ch);
    expect(parseMppCredential(encodeMppCredentialHeader(cred))).toEqual(cred);
  });

  it("round-trips a receipt header and builds a success receipt", () => {
    const receipt = buildMppReceipt("0x789abc", "tempo", {
      now: () => 1_700_000_000_000,
      subscriptionId: "sub_1",
    });
    expect(receipt).toEqual({
      method: "tempo",
      reference: "0x789abc",
      status: "success",
      timestamp: new Date(1_700_000_000_000).toISOString(),
      subscriptionId: "sub_1",
    } satisfies MppReceipt);
    expect(parseMppReceipt(encodeMppReceiptHeader(receipt))).toEqual(receipt);
  });

  it("rejects malformed or oversized wire values (fail-closed)", () => {
    expect(() => parseMppChallengeHeader("Payment id=\"x\"")).toThrow();
    expect(() => parseMppChallengeHeader("Payment id=\"a\", realm=\"b\", method=\"c\", intent=\"bogus\", request=\"AAAA\"")).toThrow();
    expect(() => parseMppCredential("Payment not-base64!!")).toThrow();
    expect(() => parseMppReceipt("not-json")).toThrow();
    // A challenge whose request is valid base64url but not the request shape.
    const bad = Buffer.from(JSON.stringify({ nope: true }), "utf8").toString("base64url");
    expect(() => decodeMppRequest(challenge({ request: bad }))).toThrow();
  });
});

describe("MPP intent → ADR-007 product", () => {
  it("maps charge/session to rail and subscription to matched job (fail-closed)", () => {
    expect(mppIntentToProduct("charge")).toBe("rail");
    expect(mppIntentToProduct("session")).toBe("rail");
    expect(mppIntentToProduct("subscription")).toBe("matched_job");
  });
});

describe("MppBridge.authorize (fail-closed)", () => {
  const ctx = { job, agentProviderDid: "did:conxian:agent-1" };

  it("authorizes a well-formed charge credential", () => {
    const ch = challenge();
    const bridge = new MppBridge();
    const result = bridge.authorize(ch, credential(ch), ctx);
    expect(result.authorized).toBe(true);
    expect(result.product).toBe("rail");
    expect(result.demand.amount).toBe("100000");
  });

  it("prices a subscription at the matched-job product", () => {
    const ch = challenge({ intent: "subscription" });
    const result = new MppBridge().authorize(ch, credential(ch), ctx);
    expect(result.authorized).toBe(true);
    expect(result.product).toBe("matched_job");
  });

  it("denies a credential that does not echo the challenge", () => {
    const ch = challenge();
    const tampered = credential(ch);
    tampered.challenge.id = "different-id";
    const result = new MppBridge().authorize(ch, tampered, ctx);
    expect(result.authorized).toBe(false);
    expect(result.reason).toMatch(/echo/i);
  });

  it("denies an amount that does not match the job bounty", () => {
    const ch = challenge();
    const wrong = challenge({
      request: Buffer.from(JSON.stringify({ amount: "1", currency: "usd", recipient: "0x" }), "utf8").toString("base64url"),
    });
    const result = new MppBridge().authorize(wrong, credential(wrong), ctx);
    expect(result.authorized).toBe(false);
    expect(result.reason).toMatch(/amount/i);
  });

  it("denies an expired challenge", () => {
    const ch = challenge({ expires: "2020-01-01T00:00:00Z" });
    const result = new MppBridge({ now: () => Date.parse("2026-01-01T00:00:00Z") }).authorize(ch, credential(ch), ctx);
    expect(result.authorized).toBe(false);
    expect(result.reason).toMatch(/expired/i);
  });

  it("rejects a replayed challenge id (single-use)", () => {
    const ch = challenge();
    const bridge = new MppBridge();
    expect(bridge.authorize(ch, credential(ch), ctx).authorized).toBe(true);
    const second = bridge.authorize(ch, credential(ch), ctx);
    expect(second.authorized).toBe(false);
    expect(second.reason).toMatch(/consumed|replay/i);
  });

  it("does not burn the challenge id when the credential is invalid", () => {
    const ch = challenge();
    const guard = new ReplayGuard();
    const bridge = new MppBridge({ replayGuard: guard });
    const bad = credential(ch);
    bad.payload = {}; // no hash → falls back to source; still needs a non-empty ref
    bad.source = "";
    expect(bridge.authorize(ch, bad, ctx).authorized).toBe(false);
    // A subsequent valid credential for the same challenge must still succeed.
    expect(bridge.authorize(ch, credential(ch), ctx).authorized).toBe(true);
  });
});
