// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Conxian Labs (Pty) Ltd
//
// Part of the @conxian/market-sdk revenue moat. This file is licensed
// AGPL-3.0-or-later, NOT MIT: see LICENSING.md. Running a modified version
// of this file as a network service obliges you to offer the corresponding
// source to your users (AGPL-3.0 section 13), or to obtain a commercial
// licence from Conxian Labs.
/**
 * MPP (Machine Payments Protocol) bridge — bounded codecs plus a fail-closed
 * adapter onto the existing x402 escrow gate (market #371).
 *
 * MPP standardises HTTP 402 as the `Payment` HTTP authentication scheme:
 * a server issues a `WWW-Authenticate: Payment …` Challenge, the client answers
 * with an `Authorization: Payment …` Credential, and the server returns a
 * `Payment-Receipt` header. It is a backwards-compatible superset of x402 that
 * adds card rails and three intents (`charge`, `session`, `subscription`).
 *
 * This bridge **parses and validates wire shape only** — it never verifies a
 * signature, moves funds, or settles. A `charge`/`session` intent maps to a raw
 * rail call (ADR-005 dynamic fee); a `subscription` intent is priced
 * fail-closed at the matched-job take until the D-6 decision (#1343) lands.
 * Authorization reuses `verifyPaymentReceipt` and a `ReplayGuard`.
 *
 * Refs: docs/adr/ADR_008_MPP_BRIDGE.md, docs/research/X402_MPP_ECOSYSTEM_2026.md
 */

import { z } from "zod";
import type { JobCard, SettlementRail } from "./core_types.js";
import {
  jobCardToDemand,
  verifyPaymentReceipt,
  type X402PaymentDemand,
  type X402PaymentReceipt,
} from "./x402_facade.js";
import { ReplayGuard } from "./replay_guard.js";
import type { FeeProduct } from "./fee_product.js";

export const MPP_BRIDGE_PROFILE = "conxian-mpp-bridge/1" as const;
/** Wire fields this bridge understands. */
export const MPP_HEADERS = {
  challenge: "WWW-Authenticate",
  credential: "Authorization",
  credentialAlternate: "Payment-Authorization",
  receipt: "Payment-Receipt",
} as const;
export const MPP_AUTH_SCHEME = "Payment" as const;
export const MPP_MAX_BYTES = 16_384;

/** The three MPP intents. */
export type MppIntent = "charge" | "session" | "subscription";
export const MPP_INTENTS = ["charge", "session", "subscription"] as const;

/**
 * Intent → ADR-007 product. `charge`/`session` are raw rail calls; a
 * `subscription` is priced fail-closed at the matched-job take until #1343
 * (D-6 recurring revenue) decides the recurring surface's rate.
 */
export function mppIntentToProduct(intent: MppIntent): FeeProduct {
  return intent === "subscription" ? "matched_job" : "rail";
}

// ── bounded, canonical base64url JSON ────────────────────────────────────────

const text = z.string().min(1).max(2048);
const boundedText = z.string().min(1).max(4096);
const base64url = z
  .string()
  .min(1)
  .max(Math.ceil(MPP_MAX_BYTES / 3) * 4)
  .regex(/^[A-Za-z0-9_-]+$/u);
const optional = <T extends z.ZodTypeAny>(schema: T) =>
  schema.nullish().transform((value) => value ?? undefined);
const record = z.record(z.string(), z.unknown());

function invalid(): never {
  throw new Error("Incompatible or oversized MPP wire value.");
}

/** Recursive RFC-8785-style key ordering; the closest stable JSON we can emit. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) out[key] = canonicalize(source[key]);
    return out;
  }
  return value;
}

function jsonText(value: unknown): string {
  try {
    const json = JSON.stringify(value, (_key, item: unknown) => {
      if (
        item === undefined ||
        typeof item === "function" ||
        typeof item === "symbol" ||
        typeof item === "bigint" ||
        (typeof item === "number" && !Number.isFinite(item))
      )
        invalid();
      return item;
    });
    if (!json || Buffer.byteLength(json, "utf8") > MPP_MAX_BYTES) invalid();
    return json;
  } catch {
    return invalid();
  }
}

function b64urlEncodeJson(value: unknown): string {
  return Buffer.from(jsonText(canonicalize(value)), "utf8").toString("base64url");
}

function b64urlDecodeJson(value: string): unknown {
  try {
    if (typeof value !== "string" || !value.length || !/^[A-Za-z0-9_-]+$/u.test(value)) invalid();
    const bytes = Buffer.from(value, "base64url");
    if (bytes.length > MPP_MAX_BYTES || bytes.toString("base64url") !== value) invalid();
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch {
    return invalid();
  }
}

// ── Challenge ────────────────────────────────────────────────────────────────

/** Decoded `request` object common fields (method-specific fields pass through). */
export const MppRequestSchema = z
  .object({
    amount: z.string().min(1).max(256).regex(/^[0-9]+$/u),
    currency: text,
    recipient: text,
  })
  .passthrough();
export type MppRequest = z.infer<typeof MppRequestSchema>;

export interface MppChallenge {
  id: string;
  realm: string;
  method: string;
  intent: MppIntent;
  /** Base64url JCS JSON of {@link MppRequest}, kept in wire form. */
  request: string;
  description?: string;
  digest?: string;
  expires?: string;
  header?: string;
  opaque?: string;
}

const challengeFieldsSchema = z
  .object({
    id: text,
    realm: text,
    method: text,
    intent: z.enum(MPP_INTENTS),
    request: base64url,
    description: optional(boundedText),
    digest: optional(boundedText),
    expires: optional(text),
    header: optional(text),
    opaque: optional(base64url),
  })
  .strict();

/** Parse the raw string value of a `WWW-Authenticate: Payment …` header. */
export function parseMppChallengeHeader(value: string): MppChallenge {
  try {
    if (typeof value !== "string") invalid();
    const trimmed = value.trim();
    const schemePrefix = `${MPP_AUTH_SCHEME} `;
    const body = trimmed.startsWith(schemePrefix) ? trimmed.slice(schemePrefix.length) : trimmed;
    const params: Record<string, string> = {};
    const pattern = /([A-Za-z][A-Za-z0-9-]*)\s*=\s*"([^"]*)"/gu;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(body)) !== null) params[match[1]] = match[2];
    const parsed = challengeFieldsSchema.safeParse(params);
    if (!parsed.success) invalid();
    return parsed.data as MppChallenge;
  } catch {
    return invalid();
  }
}

/** Encode a challenge into a `WWW-Authenticate: Payment …` header value. */
export function encodeMppChallengeHeader(challenge: MppChallenge): string {
  const parsed = challengeFieldsSchema.safeParse(challenge);
  if (!parsed.success) invalid();
  const order: Array<keyof MppChallenge> = [
    "id",
    "realm",
    "method",
    "intent",
    "request",
    "description",
    "digest",
    "expires",
    "header",
    "opaque",
  ];
  const parts = order
    .filter((key) => parsed.data[key] !== undefined)
    .map((key) => `${key}="${String(parsed.data[key])}"`);
  return `${MPP_AUTH_SCHEME} ${parts.join(", ")}`;
}

/** Decode the `request` parameter into its structured object. */
export function decodeMppRequest(challenge: MppChallenge): MppRequest {
  const decoded = b64urlDecodeJson(challenge.request);
  const parsed = MppRequestSchema.safeParse(decoded);
  if (!parsed.success) invalid();
  return parsed.data as MppRequest;
}

// ── Credential ───────────────────────────────────────────────────────────────

/** The echoed Challenge as carried inside a Credential (same wire values). */
const echoedChallengeSchema = z
  .object({
    id: text,
    realm: text,
    method: text,
    intent: z.enum(MPP_INTENTS),
    request: base64url,
    header: optional(text),
    opaque: optional(base64url),
    expires: optional(text),
  })
  .passthrough();

export const MppCredentialSchema = z
  .object({
    challenge: echoedChallengeSchema,
    source: text,
    payload: record,
  })
  .strict();
export type MppCredential = z.infer<typeof MppCredentialSchema>;

/** Parse the raw value of an `Authorization: Payment …` (or alt) header. */
export function parseMppCredential(value: string): MppCredential {
  try {
    if (typeof value !== "string") invalid();
    const trimmed = value.trim();
    const schemePrefix = `${MPP_AUTH_SCHEME} `;
    const token = trimmed.startsWith(schemePrefix) ? trimmed.slice(schemePrefix.length) : trimmed;
    const parsed = MppCredentialSchema.safeParse(b64urlDecodeJson(token));
    if (!parsed.success) invalid();
    return parsed.data as MppCredential;
  } catch {
    return invalid();
  }
}

/** Encode a credential into an `Authorization: Payment <b64url>` header value. */
export function encodeMppCredentialHeader(credential: MppCredential): string {
  const parsed = MppCredentialSchema.safeParse(credential);
  if (!parsed.success) invalid();
  return `${MPP_AUTH_SCHEME} ${b64urlEncodeJson(parsed.data)}`;
}

// ── Receipt ──────────────────────────────────────────────────────────────────

export const MppReceiptSchema = z
  .object({
    method: text,
    reference: text,
    status: z.literal("success"),
    timestamp: text,
    externalId: optional(text),
    fundingCurrency: optional(text),
    subscriptionId: optional(text),
  })
  .strict();

/** Hand-written so optional fields stay optional (zod's transform widens them). */
export interface MppReceipt {
  method: string;
  reference: string;
  status: "success";
  timestamp: string;
  externalId?: string;
  fundingCurrency?: string;
  subscriptionId?: string;
}

export function parseMppReceipt(value: string): MppReceipt {
  try {
    const parsed = MppReceiptSchema.safeParse(b64urlDecodeJson(value.trim()));
    if (!parsed.success) invalid();
    return parsed.data as MppReceipt;
  } catch {
    return invalid();
  }
}

export function encodeMppReceiptHeader(receipt: MppReceipt): string {
  const parsed = MppReceiptSchema.safeParse(receipt);
  if (!parsed.success) invalid();
  return b64urlEncodeJson(parsed.data);
}

// ── Bridge: MPP Challenge/Credential → x402 escrow gate ───────────────────────

export interface MppChargeContext {
  job: Pick<JobCard, "id" | "title" | "description" | "bountySat" | "deadline">;
  agentProviderDid: string;
  rail?: SettlementRail;
}

export interface MppBridgeResult {
  authorized: boolean;
  /** ADR-007 product this intent is priced under. */
  product: FeeProduct;
  demand: X402PaymentDemand;
  reason?: string;
}

export interface MppBridgeOptions {
  /** Replay protection for Credential single-use. A default guard is created. */
  replayGuard?: ReplayGuard;
  /** Injectable clock (epoch ms) for deterministic tests. */
  now?: () => number;
}

/**
 * Adapter that authorizes an MPP Credential against the existing x402 escrow
 * gate. It performs **structural** binding and consistency checks only:
 * challenge/credential echo match, intent/realm/method match, amount match,
 * expiry, and single-use. It does not verify payment finality.
 */
export class MppBridge {
  private readonly replayGuard: ReplayGuard;
  private readonly now: () => number;

  constructor(options: MppBridgeOptions = {}) {
    this.replayGuard = options.replayGuard ?? new ReplayGuard();
    this.now = options.now ?? Date.now;
  }

  /**
   * Authorize a Credential for a Challenge, fail-closed. Returns
   * `authorized: false` with a reason on any mismatch, expiry, or replay.
   */
  authorize(challenge: MppChallenge, credential: MppCredential, ctx: MppChargeContext): MppBridgeResult {
    const product = mppIntentToProduct(challenge.intent);
    const demand = jobCardToDemand(ctx.job, ctx.rail);
    const deny = (reason: string): MppBridgeResult => ({ authorized: false, product, demand, reason });

    // 1. The credential must echo the exact challenge terms.
    const echo = credential.challenge;
    if (
      echo.id !== challenge.id ||
      echo.realm !== challenge.realm ||
      echo.method !== challenge.method ||
      echo.intent !== challenge.intent ||
      echo.request !== challenge.request
    ) {
      return deny("credential does not echo the issued challenge");
    }

    // 2. The advertised amount must equal the job bounty (unit consistency).
    const request = decodeMppRequest(challenge);
    if (request.amount !== demand.amount) {
      return deny("challenge amount does not match the job bounty");
    }

    // 3. Expiry.
    if (challenge.expires !== undefined) {
      const expiresAt = Date.parse(challenge.expires);
      if (!Number.isFinite(expiresAt)) return deny("challenge expiry is not a valid timestamp");
      if (this.now() > expiresAt) return deny("challenge has expired");
    }

    // 4. Structural receipt consistency, via the shared x402 gate. Done before
    //    consuming the challenge id so an invalid proof cannot burn it.
    const receipt = credentialToReceipt(demand, credential, this.now());
    if (!verifyPaymentReceipt(demand, receipt)) {
      return deny("invalid or mismatched payment credential");
    }

    // 5. Single-use. Reject a replayed challenge id (last, so only an otherwise
    //    valid credential is consumed).
    if (this.replayGuard.consume(`mpp:${challenge.id}`).replay) {
      return deny("challenge credential already consumed");
    }

    return { authorized: true, product, demand };
  }
}

/**
 * Adapt an MPP Credential into the x402 receipt shape the escrow gate checks.
 * The `payload.hash` (when present) is the payment reference; otherwise the
 * credential `source` is used. This is a correlation mapping, not verification.
 */
function credentialToReceipt(
  demand: X402PaymentDemand,
  credential: MppCredential,
  paidAt: number,
): X402PaymentReceipt {
  const payload = credential.payload as Record<string, unknown>;
  const reference =
    typeof payload["hash"] === "string" && (payload["hash"] as string).length > 0
      ? (payload["hash"] as string)
      : credential.source;
  return {
    demandId: demand.resourceId,
    transactionId: reference,
    amountSat: demand.amount,
    paidAt,
    payerDid: credential.source,
  };
}

/** Build a success Receipt for a settled MPP charge. */
export function buildMppReceipt(
  reference: string,
  method: string,
  options: { now?: () => number; externalId?: string; subscriptionId?: string; fundingCurrency?: string } = {},
): MppReceipt {
  const at = (options.now ?? Date.now)();
  const receipt: MppReceipt = {
    method,
    reference,
    status: "success",
    timestamp: new Date(at).toISOString(),
  };
  if (options.externalId !== undefined) receipt.externalId = options.externalId;
  if (options.fundingCurrency !== undefined) receipt.fundingCurrency = options.fundingCurrency;
  if (options.subscriptionId !== undefined) receipt.subscriptionId = options.subscriptionId;
  return receipt;
}
