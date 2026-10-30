/** Bounded x402 v2 transport codecs. Parsing never verifies or settles a payment. */
import { z } from "zod";

export const X402_V2_WIRE_PROFILE = "conxian-x402-v2-wire/1" as const;
export const X402_V2_MAX_BYTES = 16_384;
export const X402_V2_HEADERS = {
  required: "PAYMENT-REQUIRED", signature: "PAYMENT-SIGNATURE", response: "PAYMENT-RESPONSE",
} as const;
const text = z.string().min(1).max(2048);
const atomicAmount = z.string().min(1).max(256).refine((value) => !/[^0-9]/u.test(value));
// Upstream normalizes null optional wire fields to absence across implementations.
const optional = <T extends z.ZodTypeAny>(schema: T) => schema.nullish().transform((value) => value ?? undefined);
const metadataText = z.string().min(1).max(32).refine((value) => !/[^\x20-\x7e]/u.test(value));
const iconUrl = text.refine((value) => {
  try {
    const url = new URL(value);
    return /^https?:\/\//u.test(value) && (url.protocol === "https:" || url.protocol === "http:") && !/\s/u.test(value);
  } catch { return false; }
});
const record = z.record(z.unknown());
// Only server advertisements use this envelope. Client/settlement extensions
// retain their scheme-specific shapes and are never interpreted as authority.
const advertisedExtensions = z.record(z.object({ info: record, schema: record }).passthrough());
const network = z.string().max(41).regex(/^[-a-z0-9]{3,8}:[-_a-zA-Z0-9]{1,32}$/u)
  .refine((value) => !/[\s\u0000-\u001f\u007f]/u.test(value));
const resource = z.object({
  url: text,
  description: optional(z.string().max(2048)),
  mimeType: optional(z.string().max(2048)), serviceName: optional(metadataText),
  tags: optional(z.array(metadataText).max(5)), iconUrl: optional(iconUrl),
}).strict();
export const X402V2RequirementsSchema = z.object({
  scheme: text,
  network,
  amount: atomicAmount,
  asset: text,
  payTo: text,
  maxTimeoutSeconds: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  extra: optional(record),
}).strict();
export const X402V2RequiredSchema = z.object({
  x402Version: z.literal(2),
  error: optional(z.string().max(2048)),
  resource,
  accepts: z.array(X402V2RequirementsSchema).min(1).max(32),
  extensions: optional(advertisedExtensions),
}).strict();
export const X402V2PayloadSchema = z.object({
  x402Version: z.literal(2),
  resource: optional(resource),
  accepted: X402V2RequirementsSchema,
  payload: record,
  extensions: optional(record),
}).strict();
export const X402V2SettlementSchema = z.object({
  success: z.boolean(),
  errorReason: optional(text),
  errorMessage: optional(z.string().max(2048)),
  transaction: z.string().max(2048),
  network,
  payer: optional(text),
  amount: optional(atomicAmount),
  extensions: optional(record),
  extra: optional(record),
}).strict().superRefine((value, context) => {
  if (value.errorReason === "settlement_pending" && (value.success || !value.transaction.trim())) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Pending settlement requires an unsuccessful result and broadcast identifier." });
  }
});
export type X402V2Required = z.infer<typeof X402V2RequiredSchema>;
export type X402V2Payload = z.infer<typeof X402V2PayloadSchema>;
export type X402V2Settlement = z.infer<typeof X402V2SettlementSchema>;
type Kind = keyof typeof X402_V2_HEADERS;
const schemas = { required: X402V2RequiredSchema, signature: X402V2PayloadSchema, response: X402V2SettlementSchema };
type WireTypes = { required: X402V2Required; signature: X402V2Payload; response: X402V2Settlement };

function invalid(): never { throw new Error("Incompatible or oversized x402 v2 wire value."); }

function jsonText(value: unknown): string {
  try {
    const json = JSON.stringify(value, (_key, item: unknown) => {
      if (item === undefined || typeof item === "function" || typeof item === "symbol" ||
          typeof item === "bigint" || (typeof item === "number" && !Number.isFinite(item))) invalid();
      return item;
    });
    if (!json || Buffer.byteLength(json, "utf8") > X402_V2_MAX_BYTES) invalid();
    return json;
  } catch { return invalid(); }
}

/** Scheme payloads and extension data stay opaque; this is wire-shape conformance only. */
export function parseX402V2<K extends Kind>(kind: K, value: unknown): WireTypes[K] {
  try {
    if (!Object.hasOwn(schemas, kind)) invalid();
    const parsed = schemas[kind].safeParse(JSON.parse(jsonText(value)) as unknown);
    if (!parsed.success) invalid();
    // Only normalized optional fields can be undefined: jsonText already
    // rejected non-JSON input, including undefined inside opaque records.
    return JSON.parse(JSON.stringify(parsed.data)) as WireTypes[K];
  } catch { return invalid(); }
}

export function encodeX402V2Header<K extends Kind>(kind: K, value: WireTypes[K]): string {
  return Buffer.from(jsonText(parseX402V2(kind, value)), "utf8").toString("base64");
}

export function decodeX402V2Header<K extends Kind>(kind: K, value: string): WireTypes[K] {
  try {
    if (typeof value !== "string" || !value.length || value.length > Math.ceil(X402_V2_MAX_BYTES / 3) * 4 ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value)) invalid();
    const bytes = Buffer.from(value, "base64");
    if (bytes.length > X402_V2_MAX_BYTES || bytes.toString("base64") !== value) invalid();
    return parseX402V2(kind, JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown);
  } catch { return invalid(); }
}

/** MCP payment-required tool result, not a JSON-RPC protocol error or execution grant. */
export function x402V2McpRequired(value: X402V2Required) {
  const structuredContent = parseX402V2("required", value);
  return { isError: true as const, structuredContent,
    content: [{ type: "text" as const, text: jsonText(structuredContent) }] };
}

/** Request metadata only. A facilitator must verify its exact resource and payment terms. */
export function x402V2McpPayment(value: X402V2Payload) {
  return { "x402/payment": parseX402V2("signature", value) };
}
