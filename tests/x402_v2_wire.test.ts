import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { X402_V2_MAX_BYTES, X402_V2_HEADERS, parseX402V2, encodeX402V2Header, decodeX402V2Header,
  x402V2McpRequired, x402V2McpPayment } from "../src/x402_v2_wire.js";
import type { X402V2Required, X402V2Payload } from "../src/x402_v2_wire.js";

// Synthetic wire fixtures follow the Foundation's v2 core/HTTP/MCP field contracts.
// No payment, issuer, actual wallet or registry deployment is represented here.
const requirements = { scheme: "exact", network: "eip155:84532", amount: "10000", asset: "test-asset",
  payTo: "test-payee", maxTimeoutSeconds: 60, extra: { name: "Test Asset", version: "2" } };
const required: X402V2Required = { x402Version: 2, resource: { url: "https://example.invalid/resource", description: "測試" },
  accepts: [requirements], extensions: { test: { info: { enabled: true }, schema: { type: "object" } } } };
const payload: X402V2Payload = { x402Version: 2, resource: required.resource, accepted: requirements,
  payload: { signature: "test-only-opaque-value", authorization: { nonce: "test-nonce" } } };

describe("explicit x402 v2 wire profile", () => {
  const fixtures = JSON.parse(readFileSync(new URL("./fixtures/x402_v2_wire.json", import.meta.url), "utf8")) as {
    upstreamRevision: string;
    cases: { kind: "required" | "signature" | "response"; value: unknown }[];
  };
  for (const [index, fixture] of fixtures.cases.entries()) {
    it(`round-trips source-pinned synthetic ${fixture.kind} fixture ${index}`, () => {
      const parsed = parseX402V2(fixture.kind, fixture.value);
      expect(parsed).toEqual(fixture.value);
      expect(decodeX402V2Header(fixture.kind, encodeX402V2Header(fixture.kind, parsed))).toEqual(fixture.value);
    });
  }
  it("accepts omitted payment resource metadata without adding authorization", () => {
    const { resource: _resource, ...withoutResource } = payload;
    expect(parseX402V2("signature", withoutResource)).toEqual(withoutResource);
    expect(x402V2McpPayment(withoutResource)).toEqual({ "x402/payment": withoutResource });
  });
  it("normalizes explicit null optional wire fields and can re-encode the result", () => {
    const value = { ...payload, resource: null, extensions: null, accepted: { ...requirements, extra: null } };
    const { extra: _extra, ...accepted } = requirements;
    const expected = { x402Version: 2, accepted, payload: payload.payload };
    const parsed = parseX402V2("signature", value);
    expect(parsed).toEqual(expected);
    expect(decodeX402V2Header("signature", encodeX402V2Header("signature", parsed))).toEqual(expected);
    const requiredWithNulls = { ...required, error: null, extensions: null,
      resource: { url: required.resource.url, description: null, mimeType: null, serviceName: null, tags: null, iconUrl: null } };
    expect(parseX402V2("required", requiredWithNulls)).toEqual({ x402Version: 2,
      resource: { url: required.resource.url }, accepts: [requirements] });
  });
  for (const metadata of [
    { serviceName: "x".repeat(33) }, { serviceName: "non-ASCII-測試" }, { serviceName: "newline\n" },
    { tags: ["1", "2", "3", "4", "5", "6"] }, { tags: [""] }, { tags: ["測試"] },
    { tags: ["newline\n"] }, { tags: ["x".repeat(33)] },
    { iconUrl: "/icon.png" }, { iconUrl: "https:example.invalid/icon.png" },
    { iconUrl: "javascript:alert(1)" }, { iconUrl: "https://example.invalid/icon with spaces" },
  ]) {
    it(`rejects invalid resource discovery metadata ${JSON.stringify(metadata).slice(0, 80)}`, () => {
      expect(() => parseX402V2("required", { ...required, resource: { ...required.resource, ...metadata } })).toThrow("Incompatible");
    });
  }
  for (const extension of [true, [], {}, { info: {} }, { schema: {} }, { info: "text", schema: {} }, { info: {}, schema: [] }]) {
    it(`rejects malformed server extension envelope ${JSON.stringify(extension)}`, () => {
      expect(() => parseX402V2("required", { ...required, extensions: { test: extension } })).toThrow("Incompatible");
    });
  }
  it("preserves opaque client and settlement extensions without treating them as advertised schemas", () => {
    const extensions = { test: { result: "unverified", data: [1, null, true] } };
    expect(parseX402V2("signature", { ...payload, extensions }).extensions).toEqual(extensions);
    expect(parseX402V2("response", { success: false, errorReason: "rejected", errorMessage: "Synthetic refusal",
      transaction: "", network: "eip155:84532", extensions }).extensions).toEqual(extensions);
  });
  for (const change of [{ transaction: "" }, { transaction: "   " }, { success: true }]) {
    it(`rejects an inconsistent pending settlement ${JSON.stringify(change)}`, () => {
      expect(() => parseX402V2("response", { success: false, errorReason: "settlement_pending",
        transaction: "test-broadcast-identifier", network: "eip155:84532", ...change })).toThrow("Incompatible");
    });
  }
  for (const amount of [123, "-1", "1.5", "1e3", "1\n", ""]) {
    it(`rejects a non-atomic settlement amount ${JSON.stringify(amount)}`, () => {
      expect(() => parseX402V2("response", { success: true, transaction: "test-transaction", network: "eip155:84532", amount })).toThrow("Incompatible");
    });
  }
  it("rejects facilitator sidechannel fields on the buyer wire", () => {
    expect(() => parseX402V2("response", { success: true, transaction: "test-transaction", network: "eip155:84532",
      extensionResponses: { internal: true } })).toThrow("Incompatible");
  });
  for (const [kind, value] of [["required", required], ["signature", payload],
    ["response", { success: true, transaction: "test-transaction", network: "eip155:84532" }],
    ["response", { success: false, errorReason: "rejected", transaction: "", network: "eip155:84532" }]] as const) {
    it(`${kind} preserves the wire value across the HTTP base64 transport`, () => {
      const encoded = encodeX402V2Header(kind, value);
      expect(decodeX402V2Header(kind, encoded)).toEqual(value);
      expect(encoded).not.toContain("\n");
    });
  }
  it("uses the three standard v2 HTTP header names", () => {
    expect(X402_V2_HEADERS).toEqual({ required: "PAYMENT-REQUIRED", signature: "PAYMENT-SIGNATURE", response: "PAYMENT-RESPONSE" });
  });
  it("carries MCP demand data as a tool error with matching text and structured data", () => {
    const result = x402V2McpRequired(required);
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual(required);
    expect(JSON.parse(result.content[0].text)).toEqual(required);
    expect(result).not.toHaveProperty("authorized");
    expect(result).not.toHaveProperty("jsonrpc");
  });
  it("places the opaque MCP payment payload under request _meta's x402/payment key", () => {
    expect(x402V2McpPayment(payload)).toEqual({ "x402/payment": payload });
    expect(x402V2McpPayment(payload)).not.toHaveProperty("authorized");
  });
  it("keeps signature and settlement fields as unverified claims", () => {
    expect(parseX402V2("signature", payload).payload.signature).toBe("test-only-opaque-value");
    expect(parseX402V2("signature", payload)).not.toHaveProperty("paymentVerified");
    expect(parseX402V2("response", { success: true, transaction: "anything", network: "eip155:84532" }).success).toBe(true);
  });
  for (const change of [{ x402Version: 1 }, { x402Version: "2" }, { accepts: [] }, { authorized: true },
    { resource: undefined }, { accepts: [{ ...requirements, network: "ethereum" }] },
    { accepts: [{ ...requirements, network: "eip155:84532\n" }] },
    { accepts: [{ ...requirements, amount: 10000 }] }, { accepts: [{ ...requirements, amount: "1e4" }] },
    { accepts: [{ ...requirements, amount: "100\n" }] }, { accepts: [{ ...requirements, amount: "-1" }] },
    { accepts: [{ ...requirements, maxTimeoutSeconds: 0 }] },
    { accepts: [{ ...requirements, maxTimeoutSeconds: 0.5 }] },
    { accepts: [{ ...requirements, extra: { bad: Infinity } }] }]) {
    it(`rejects incompatible requirements ${JSON.stringify(change).slice(0, 90)}`, () => {
      expect(() => parseX402V2("required", { ...required, ...change })).toThrow("Incompatible");
    });
  }
  it("accepts atomic amounts beyond the JavaScript safe-integer range as strings", () => {
    const value = { ...required, accepts: [{ ...requirements, amount: "900719925474099312345" }] };
    expect(decodeX402V2Header("required", encodeX402V2Header("required", value))).toEqual(value);
  });
  it("does not silently convert the legacy sats/payment-pointer facade to v2", () => {
    expect(() => parseX402V2("required", { scheme: "x402", currency: "sats", amount: "10000",
      paymentPointer: "$example.invalid/job/test", resourceId: "test" })).toThrow();
  });
  for (const encoded of ["", "!!!", "e30", "e30=\n", "e31=", "77+9", "wyg=", Buffer.from("not JSON").toString("base64")]) {
    it(`rejects malformed/corrupted or incompatible HTTP header ${JSON.stringify(encoded)}`, () => {
      expect(() => decodeX402V2Header("required", encoded)).toThrow("Incompatible");
    });
  }
  it("bounds object and header bytes without echoing private payloads in errors", () => {
    const privateText = "synthetic-sensitive-value".repeat(X402_V2_MAX_BYTES);
    expect(() => encodeX402V2Header("signature", { ...payload, payload: { signature: privateText } })).toThrow("Incompatible");
    try { decodeX402V2Header("required", privateText); }
    catch (error) { expect(String(error)).not.toContain("synthetic-sensitive-value"); }
  });
  it("rejects non-JSON extension values and cycles rather than dropping data", () => {
    for (const value of [undefined, 1n, () => true, Symbol("test")]) {
      expect(() => parseX402V2("required", { ...required, extensions: { bad: value } })).toThrow();
    }
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => parseX402V2("required", { ...required, extensions: cyclic })).toThrow();
  });
});
