// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Conxian Labs (Pty) Ltd
//
// Part of the @conxian/market-sdk revenue moat. This file is licensed
// AGPL-3.0-or-later, NOT MIT: see LICENSING.md. Running a modified version
// of this file as a network service obliges you to offer the corresponding
// source to your users (AGPL-3.0 section 13), or to obtain a commercial
// licence from Conxian Labs.
/**
 * Two-product rate model (ADR-007).
 *
 * One split rule, two rates:
 *   - Product A `rail`        — raw pass-through (x402/MCP-402/M2M). Take = the
 *     ADR-005 dynamic fee (percentage decay, never below the cost floor).
 *   - Product B `matched_job` — a job card with escrow + attestation + SLA +
 *     dispute. Take = 10% of gross (builder keeps 90%).
 *
 * Every take is then split 50/30/20 (operations / founders / ecosystem) — the
 * single split rule — applied to the take, whatever it is.
 *
 * Routing is fail-closed: a settlement that cannot be classified as a raw rail
 * call is priced at the HIGHER (matched-job) rate, never the cheaper rail rate.
 *
 * Refs: docs/adr/ADR_007_TWO_PRODUCT_RATE_MODEL.md
 */

import { type SettlementRail, type TrustTier, type VolumeDecayTier } from "./core_types.js";
import { calculateDynamicFee } from "./fee_calculator.js";

/** The two products. */
export type FeeProduct = "rail" | "matched_job";

/** Matched-job take: 10% of gross (builder keeps 90%). ADR-007 §2.2. */
export const MATCHED_JOB_TAKE_BPS = 1000;

/** The single split rule — 50/30/20 on the take. ADR-007 §2.0. */
export const TAKE_SPLIT_BPS = {
  operations: 5000,
  founders: 3000,
  ecosystem: 2000,
} as const;

export interface PlatformTakeSplit {
  operationsSat: bigint;
  foundersSat: bigint;
  ecosystemSat: bigint;
}

export interface ProductTake extends PlatformTakeSplit {
  product: FeeProduct;
  grossAmountSat: bigint;
  /** The platform's take (10% for a matched job; the dynamic fee for a rail). */
  takeSat: bigint;
  /** What the builder receives: `gross − take`. */
  builderSat: bigint;
  /** Effective take in basis points of gross. */
  takeBps: number;
}

/**
 * Signals used to classify a settlement. Any single marketplace signal marks it
 * as a matched job; the absence of all of them marks it as a raw rail call.
 */
export interface ProductSignals {
  hasJobCard?: boolean;
  hasEscrow?: boolean;
  hasAttestation?: boolean;
  hasSla?: boolean;
  hasDisputePath?: boolean;
}

/** True when any marketplace signal is present. */
export function hasMarketplaceSignal(signals: ProductSignals): boolean {
  return Boolean(
    signals.hasJobCard ||
      signals.hasEscrow ||
      signals.hasAttestation ||
      signals.hasSla ||
      signals.hasDisputePath,
  );
}

/**
 * Classify a settlement from its signals. Any marketplace signal => matched job;
 * otherwise a raw rail call.
 */
export function classifyFeeProduct(signals: ProductSignals): FeeProduct {
  return hasMarketplaceSignal(signals) ? "matched_job" : "rail";
}

/**
 * Resolve the product for a settlement, **fail-closed**.
 *
 * An explicit product always wins. Otherwise the signals decide. When neither is
 * given the settlement is priced as a matched job — the higher rate — so an
 * unclassifiable settlement can never slip onto the cheap rail path.
 */
export function resolveFeeProduct(
  explicit?: FeeProduct,
  signals?: ProductSignals,
): FeeProduct {
  if (explicit) return explicit;
  if (signals) return classifyFeeProduct(signals);
  return "matched_job";
}

/**
 * The single split rule: 50/30/20 of the take to operations / founders /
 * ecosystem. The ecosystem bucket absorbs integer-division dust so the three
 * always sum to the take.
 */
export function splitPlatformTake(takeSat: bigint): PlatformTakeSplit {
  if (takeSat <= 0n) {
    return { operationsSat: 0n, foundersSat: 0n, ecosystemSat: 0n };
  }
  const operationsSat = (takeSat * BigInt(TAKE_SPLIT_BPS.operations)) / 10000n;
  const foundersSat = (takeSat * BigInt(TAKE_SPLIT_BPS.founders)) / 10000n;
  const ecosystemSat = takeSat - operationsSat - foundersSat;
  return { operationsSat, foundersSat, ecosystemSat };
}

export interface ProductTakeInput {
  /** Explicit product. Omit to classify from `signals` (fail-closed). */
  product?: FeeProduct;
  signals?: ProductSignals;
  grossAmountSat: bigint;
  /** Rail-only: the dynamic fee needs a tier and rail. */
  tier?: TrustTier;
  rail?: SettlementRail;
  volumeDecayTier?: VolumeDecayTier;
  systemLoadFactor?: number;
  enterpriseSubscriptionCap?: boolean;
  /** Matched-job take override in basis points. Defaults to 10%. */
  matchedJobTakeBps?: number;
}

/**
 * Compute the take for a settlement under the two-product model, and split it
 * 50/30/20. Deterministic; performs no I/O.
 */
export function computeProductTake(input: ProductTakeInput): ProductTake {
  const product = resolveFeeProduct(input.product, input.signals);
  const gross = input.grossAmountSat;

  if (gross <= 0n) {
    return {
      product,
      grossAmountSat: gross,
      takeSat: 0n,
      builderSat: 0n,
      takeBps: 0,
      operationsSat: 0n,
      foundersSat: 0n,
      ecosystemSat: 0n,
    };
  }

  let takeSat: bigint;
  if (product === "matched_job") {
    const bps = BigInt(input.matchedJobTakeBps ?? MATCHED_JOB_TAKE_BPS);
    takeSat = (gross * bps) / 10000n;
  } else {
    if (input.tier === undefined || input.rail === undefined) {
      throw new Error("Rail take requires `tier` and `rail`");
    }
    takeSat = calculateDynamicFee({
      tier: input.tier,
      rail: input.rail,
      amountSat: gross,
      volumeDecayTier: input.volumeDecayTier,
      systemLoadFactor: input.systemLoadFactor,
      enterpriseSubscriptionCap: input.enterpriseSubscriptionCap,
    }).effectiveFeeSat;
  }

  // The take can never exceed the gross (a rail floor on a dust amount would).
  if (takeSat > gross) takeSat = gross;
  const builderSat = gross - takeSat;
  const split = splitPlatformTake(takeSat);
  const takeBps = Number((takeSat * 10000n) / gross);

  return {
    product,
    grossAmountSat: gross,
    takeSat,
    builderSat,
    takeBps,
    ...split,
  };
}
