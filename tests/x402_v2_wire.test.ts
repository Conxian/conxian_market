import { describe, it, expect } from "vitest";
import { X402_V2_MAX_BYTES, X402_V2_HEADERS, parseX402V2, encodeX402V2Header, decodeX402V2Header,
  x402V2McpRequired, x402V2McpPayment } from "../src/x402_v2_wire.js";
import type { X402V2Required, X402V2Payload } from "../src/x402_v2_wire.js";

// Synthetic wire fixtures follow the Foundation's v2 core/HTTP/MCP field contracts.
// No payment, issuer, actual wallet or registry deployment is represented here.
const requirements = { scheme: "exact", network: "eip155:84532", amount: "10000", asset: "test-asset",
  payTo: "test-payee", maxTimeoutSeconds: 60, extra: { name: "Test Asset", version: "2" } };
const required: X402V2Required = { x402Version: 2, resource: { url: "https://example.invalid/resource", description: "測試" },
  accepts: [requirements], extensions: { test: { enabled: true } } };
const payload: X402V2Payload = { x402Version: 2, resource: required.resource, accepted: requirements,
  payload: { signature: "test-only-opaque-value", authorization: { nonce: "test-nonce" } } };

describe("explicit x402 v2 wire profile", () => {
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
