/** Read-only registration discovery. No signing or production authority is inferred. */
import { z } from "zod";

export type RegistrationOwner = "gateway" | "nexus";
export const REGISTRATION_MAX_BYTES = 32_768;
const adapter = z.object({
  adapter_id: z.string().min(1).max(64).refine((value) => !/[^a-z0-9_-]/u.test(value)),
  runtime_state: z.literal("registered"),
  health: z.literal("not-observed"),
  production_support: z.literal("not-evidenced"),
  qualified_operations: z.array(z.never()).max(0),
}).strict();
const fields = {
  schema_version: z.literal(1),
  manifest_kind: z.literal("adapter_registration"),
  trust_root: z.literal("bitcoin-l1"),
  scope: z.literal("universal-chain"),
  native_conxian_token: z.literal(false),
  adapters: z.array(adapter).max(256).refine(
    (rows) => new Set(rows.map((row) => row.adapter_id)).size === rows.length,
  ),
};
const schemas = {
  gateway: z.object({ ...fields, repository: z.literal("Conxian/conxian-gateway"),
    version: z.string().min(1).max(128), source: z.literal("runtime-adapter-map") }).strict(),
  nexus: z.object({ ...fields, repository: z.literal("Conxian/conxian-nexus") }).strict(),
};

export interface RegistrationDiagnostic {
  owner: RegistrationOwner;
  state: "registered" | "unavailable";
  code: "registration_observed" | "invalid_configuration" | "request_failed" | "request_timeout" | "http_rejected" | "invalid_manifest";
  adapterIds: string[];
  qualifiedOperationCount: 0;
  productionQualified: false;
}

/** Checks the diagnostic wire contract only; it cannot authenticate provider assertions. */
export function validateRegistrationManifest(value: unknown, owner: RegistrationOwner): string[] {
  if (!Object.hasOwn(schemas, owner)) throw new Error("Incompatible registration manifest.");
  const parsed = schemas[owner]?.safeParse(value);
  if (!parsed?.success) throw new Error("Incompatible registration manifest.");
  return parsed.data.adapters.map((row) => row.adapter_id).sort();
}

function target(owner: RegistrationOwner, baseUrl: string): URL {
  if (typeof baseUrl !== "string" || /[\u0000-\u0020\u007f]/u.test(baseUrl)) throw new Error();
  const url = new URL(baseUrl);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error();
  // Only documented API roots are accepted; no guessed paths or cross-origin discovery.
  const path = url.pathname.replace(/\/+$/u, "");
  const allowed = owner === "gateway" ? ["", "/api/v1", "/api/v1/agent"] : ["", "/v1"];
  if (!allowed.includes(path)) throw new Error();
  url.pathname = `${path || (owner === "gateway" ? "/api/v1" : "/v1")}/capabilities`;
  return url;
}

async function boundedJson(response: Response): Promise<unknown> {
  if (response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json" || !response.body) {
    await response.body?.cancel();
    throw new Error();
  }
  const declared = response.headers.get("content-length");
  if (declared !== null && (!/^\d+$/u.test(declared) || Number(declared) > REGISTRATION_MAX_BYTES)) {
    await response.body.cancel();
    throw new Error();
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let text = "";
  let bytes = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > REGISTRATION_MAX_BYTES) throw new Error();
      text += decoder.decode(next.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode()) as unknown;
  } catch {
    await reader.cancel().catch(() => {});
    throw new Error();
  } finally {
    reader.releaseLock();
  }
}

export async function readRegistrationDiagnostic(config: {
  owner: RegistrationOwner;
  baseUrl: string;
  apiToken: string;
  timeoutMs?: number;
}, fetchImpl: typeof fetch = fetch): Promise<RegistrationDiagnostic> {
  const result = (code: RegistrationDiagnostic["code"], adapterIds: string[] = []): RegistrationDiagnostic => ({
    owner: config.owner, code, state: code === "registration_observed" ? "registered" : "unavailable",
    adapterIds, qualifiedOperationCount: 0, productionQualified: false,
  });
  let url: URL;
  const timeout = config.timeoutMs ?? 5_000;
  try {
    if (!Object.hasOwn(schemas, config.owner) || typeof config.apiToken !== "string" || !config.apiToken.trim() ||
        /[^\x21-\x7e]/u.test(config.apiToken) || config.apiToken.length > 8_192 ||
        !Number.isInteger(timeout) || timeout < 1 || timeout > 10_000) throw new Error();
    url = target(config.owner, config.baseUrl);
  } catch { return result("invalid_configuration"); }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const request: RequestInit & { cache: "no-store" } = { method: "GET", cache: "no-store", redirect: "error",
      signal: controller.signal, headers: { Accept: "application/json", Authorization: `Bearer ${config.apiToken}` } };
    const response = await fetchImpl(url, request);
    if (!response.ok) {
      await response.body?.cancel();
      return result("http_rejected");
    }
    try {
      return result("registration_observed", validateRegistrationManifest(await boundedJson(response), config.owner));
    } catch { return result(controller.signal.aborted ? "request_timeout" : "invalid_manifest"); }
  } catch { return result(controller.signal.aborted ? "request_timeout" : "request_failed"); }
  finally { clearTimeout(timer); }
}
