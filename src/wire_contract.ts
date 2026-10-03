/**
 * Monetary settlement wire contracts.
 *
 * JSON has no bigint representation, so monetary fields cross the wire as
 * decimal strings. These schemas validate the wire shape at runtime and coerce
 * the decimal-string fields back to `bigint` for in-process use, closing the
 * "trust caller-supplied payload" gap on the settlement boundary.
 */

import { z } from "zod";
import { SettlementRail, TrustTier } from "./core_types.js";

/** Unsigned monetary amount encoded as a decimal string on the wire. */
const decimalBigint = z
  .string()
  .regex(/^\d+$/, "expected an unsigned decimal string")
  .transform((value) => BigInt(value));

export const ProtocolFeeRecordSchema = z.object({
  settlementId: z.string(),
  rail: z.nativeEnum(SettlementRail),
  tier: z.nativeEnum(TrustTier),
  amountSat: decimalBigint,
  feeSat: decimalBigint,
  feeBps: z.number(),
  timestamp: z.number(),
  builderId: z.string(),
  txId: z.string().optional(),
});

export const SettlementResultSchema = z.object({
  success: z.boolean(),
  settlementId: z.string(),
  fee: ProtocolFeeRecordSchema,
  txId: z.string().optional(),
  rail: z.nativeEnum(SettlementRail),
  error: z.string().optional(),
});

export const M2MSettlementResponseSchema = z.object({
  txId: z.string(),
});

/** Runtime-validated settlement result (bigint fields restored). */
export type ValidatedSettlementResult = z.output<typeof SettlementResultSchema>;
