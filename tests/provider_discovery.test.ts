import { describe, it, expect, vi } from "vitest";
import { readRegistrationDiagnostic, validateRegistrationManifest, REGISTRATION_MAX_BYTES } from "../src/provider_discovery.js";

const row = { adapter_id: "bitcoin", runtime_state: "registered", health: "not-observed",
  production_support: "not-evidenced", qualified_operations: [] };
const base = { schema_version: 1, manifest_kind: "adapter_registration", trust_root: "bitcoin-l1",
  scope: "universal-chain", native_conxian_token: false, adapters: [row] };
const manifests = {
  gateway: { ...base, repository: "Conxian/conxian-gateway", version: "0.1.5", source: "runtime-adapter-map" },
  nexus: { ...base, repository: "Conxian/conxian-nexus" },
};
const config = { owner: "gateway" as const, baseUrl: "https://gateway.example.invalid", apiToken: "test-only-diagnostic-token" };
const response = (body: unknown) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
const fetcher = (value: Response) => vi.fn<typeof fetch>(async () => value);

describe("diagnostic provider registration contract", () => {
  for (const owner of ["gateway", "nexus"] as const) {
    it(`${owner} accepts exact registrations without inferring operation support`, async () => {
      const fetchImpl = fetcher(response(manifests[owner]));
      const result = await readRegistrationDiagnostic({ ...config, owner }, fetchImpl);
      expect(result).toEqual({ owner, state: "registered", code: "registration_observed",
        adapterIds: ["bitcoin"], qualifiedOperationCount: 0, productionQualified: false });
      const [url, init] = fetchImpl.mock.calls[0];
      expect(String(url)).toBe(`https://gateway.example.invalid/${owner === "gateway" ? "api/v1" : "v1"}/capabilities`);
      expect(init).toMatchObject({ method: "GET", redirect: "error", cache: "no-store",
        headers: { Authorization: `Bearer ${config.apiToken}` } });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });
    it(`${owner} rejects the other owner and preserves an empty adapter list`, () => {
      expect(() => validateRegistrationManifest(manifests[owner === "gateway" ? "nexus" : "gateway"], owner)).toThrow();
      expect(validateRegistrationManifest({ ...manifests[owner], adapters: [] }, owner)).toEqual([]);
    });
  }
  for (const change of [
    { schema_version: 2 }, { trust_root: "ethereum" }, { native_conxian_token: true },
    { production_qualified: true }, { manifest_kind: "operation_capability" },
    { adapters: [row, row] }, { adapters: [{ ...row, health: "healthy" }] },
    { adapters: [{ ...row, qualified_operations: ["sign"] }] },
    { adapters: [{ ...row, production_support: "production-supported" }] },
    { adapters: [{ ...row, adapter_id: "bitcoin\n" }] },
    { adapters: [{ ...row, unexpected: true }] },
    { adapters: Array.from({ length: 257 }, (_, i) => ({ ...row, adapter_id: `adapter-${i}` })) },
  ]) {
    it(`rejects incompatible claims: ${JSON.stringify(change).slice(0, 80)}`, async () => {
      const result = await readRegistrationDiagnostic(config, fetcher(response({ ...manifests.gateway, ...change })));
      expect(result.code).toBe("invalid_manifest");
      expect(result.adapterIds).toEqual([]);
      expect(result.productionQualified).toBe(false);
    });
  }
  for (const baseUrl of ["http://example.invalid", "https://user:secret@example.invalid", "https://example.invalid?secret=x",
    "https://example.invalid/#secret", "https://example.invalid/other", "https://example.invalid/\napi/v1", "file:///tmp/a"]) {
    it(`rejects an unsafe or undocumented target before fetching: ${JSON.stringify(baseUrl)}`, async () => {
      const fetchImpl = fetcher(response(manifests.gateway));
      expect((await readRegistrationDiagnostic({ ...config, baseUrl }, fetchImpl)).code).toBe("invalid_configuration");
      expect(fetchImpl).not.toHaveBeenCalled();
    });
  }
  for (const override of [{ apiToken: "" }, { apiToken: "a\nb" }, { apiToken: "a b" },
    { timeoutMs: 0 }, { timeoutMs: 10001 }, { timeoutMs: 1.5 }]) {
    it(`rejects invalid diagnostic settings: ${JSON.stringify(override)}`, async () => {
      const fetchImpl = fetcher(response(manifests.gateway));
      expect((await readRegistrationDiagnostic({ ...config, ...override }, fetchImpl)).code).toBe("invalid_configuration");
      expect(fetchImpl).not.toHaveBeenCalled();
    });
  }
  it("accepts a managed API root without appending duplicate prefixes", async () => {
    const fetchImpl = fetcher(response(manifests.gateway));
    await readRegistrationDiagnostic({ ...config, baseUrl: "https://example.invalid/api/v1/agent/" }, fetchImpl);
    expect(String(fetchImpl.mock.calls[0][0])).toBe("https://example.invalid/api/v1/agent/capabilities");
  });
  it("redacts rejected responses and network failures", async () => {
    const rejected = await readRegistrationDiagnostic(config, fetcher(new Response(config.apiToken, { status: 401 })));
    const failed = await readRegistrationDiagnostic(config, vi.fn(async () => { throw new Error(config.apiToken); }));
    expect(rejected.code).toBe("http_rejected");
    expect(failed.code).toBe("request_failed");
    expect(JSON.stringify([rejected, failed])).not.toContain(config.apiToken);
  });
  it("keeps a response redirect unavailable", async () => {
    const result = await readRegistrationDiagnostic(config, fetcher(new Response(null, { status: 302, headers: { location: "https://other.invalid" } })));
    expect(result.code).toBe("http_rejected");
  });
  for (const bad of [new Response("{}"), new Response("not json", { headers: { "content-type": "application/json" } }),
    new Response(new Uint8Array([0xc3, 0x28]), { headers: { "content-type": "application/json" } }),
    new Response("{}", { headers: { "content-type": "application/json", "content-length": `${REGISTRATION_MAX_BYTES + 1}` } }),
    new Response("x".repeat(REGISTRATION_MAX_BYTES + 1), { headers: { "content-type": "application/json" } })]) {
    it("rejects incompatible, malformed, oversized and non-UTF8 bodies", async () => {
      expect((await readRegistrationDiagnostic(config, fetcher(bad))).code).toBe("invalid_manifest");
    });
  }
  it("keeps the deadline active until the response body finishes", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => new Response(new ReadableStream({
      start(controller) { init?.signal?.addEventListener("abort", () => controller.error(new Error("deadline"))); },
    }), { headers: { "content-type": "application/json" } }));
    const result = await readRegistrationDiagnostic({ ...config, timeoutMs: 10 }, fetchImpl);
    expect(result.code).toBe("request_timeout");
  });
  it("times out request headers and returns no provider error text", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error(config.apiToken)));
    }));
    expect((await readRegistrationDiagnostic({ ...config, timeoutMs: 10 }, fetchImpl)).code).toBe("request_timeout");
  });
});
