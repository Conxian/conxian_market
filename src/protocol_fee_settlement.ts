// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Conxian Labs (Pty) Ltd
//
// Part of the @conxian/market-sdk revenue moat. This file is licensed
// AGPL-3.0-or-later, NOT MIT: see LICENSING.md. Running a modified version
// of this file as a network service obliges you to offer the corresponding
// source to your users (AGPL-3.0 section 13), or to obtain a commercial
// licence from Conxian Labs.
/**
 * Protocol fee settlement planning (ADR-007).
 *
 * Closes the gap between "fee computed" and "fee routed". Under the two-product
 * model the platform's take (10% of gross on a matched job; the ADR-005 dynamic
 * fee on a rail) is the single source that funds the treasury, and the vault's
 * `sweep-treasury` applies the single 50/30/20 split rule. This module turns a
 * released settlement into the complete, deterministic recipient instruction set:
 *
 *   builder            -> direct payout to the builder principal (gross − take)
 *   platform take      -> TREASURY-VAULT intake (contracts/protocol-fee-vault.clar)
 *   vault sweep        -> 50/30/20 of the take to Operations / Founders / Ecosystem
 *
 * The ecosystem is funded from the platform's 50/30/20 — NOT a second deduction
 * on the builder (ADR-007 §2.2). Recipients are role principals, never hardcoded
 * addresses (docs/AGENTS.md). The plan fails closed: while any required principal
 * is unconfigured, `isSettleable` is false.
 *
 * The vault is passive intake. Value leaves it only through the vault contract's
 * `sweep-treasury`, which the plan's `vaultSweep` mirrors so the on-chain split
 * and the off-chain plan cannot drift.
 */

import { SettlementRail, TrustTier } from "./core_types.js";
import {
  computeProductTake,
  type FeeProduct,
  type ProductSignals,
} from "./fee_product.js";

/** Canonical wallet/role principals (docs/AGENTS.md §3). */
export type SettlementRole =
  | "BUILDER"
  | "TREASURY_VAULT"
  | "ECOSYSTEM"
  | "OPERATIONS"
  | "FOUNDERS";

/** A role plus its resolved contract principal. Unset principal => fail closed. */
export interface RolePrincipal {
  role: SettlementRole;
  principal?: string;
}

export interface FeeSettlementConfig {
  builder: RolePrincipal;
  /** TREASURY-VAULT — passive intake for the platform take. */
  vault: RolePrincipal;
  /** Vault sweep recipients (SAB-TREASURY-MS release targets). */
  operations: RolePrincipal;
  founders: RolePrincipal;
  ecosystem: RolePrincipal;
  /** Vault sweep split in basis points. Defaults to the ADR-007 50/30/20. */
  vaultSplit?: {
    operationsBps: number;
    foundersBps: number;
    ecosystemBps: number;
  };
}

export interface FeeSettlementInput {
  settlementId: string;
  rail: SettlementRail;
  tier: TrustTier;
  grossAmountSat: bigint;
  /** Explicit product. Omit to classify from `signals` (fail-closed). */
  product?: FeeProduct;
  signals?: ProductSignals;
  volumeDecayTier?: import("./core_types.js").VolumeDecayTier;
  systemLoadFactor?: number;
  matchedJobTakeBps?: number;
}

export interface SettlementInstruction {
  leg: "builder" | "treasury";
  recipientRole: SettlementRole;
  recipientPrincipal?: string;
  amountSat: bigint;
  /** `direct` pays out immediately; `vault-intake` routes into TREASURY-VAULT. */
  destination: "direct" | "vault-intake";
  rail: SettlementRail;
}

export interface VaultSweepPlan {
  intakeSat: bigint;
  operationsSat: bigint;
  foundersSat: bigint;
  ecosystemSat: bigint;
  operationsBps: number;
  foundersBps: number;
  ecosystemBps: number;
}

export interface ProtocolFeeSettlementPlan {
  settlementId: string;
  rail: SettlementRail;
  tier: TrustTier;
  product: FeeProduct;
  grossAmountSat: bigint;
  /** The platform's take (10% matched job; ADR-005 dynamic fee on a rail). */
  protocolTakeSat: bigint;
  builderSat: bigint;
  /** Effective platform take in basis points of gross. */
  effectiveProtocolTakeBps: number;
  instructions: SettlementInstruction[];
  vaultSweep: VaultSweepPlan;
  isSettleable: boolean;
  blockers: string[];
}

const DEFAULT_VAULT_SPLIT = {
  operationsBps: 5000,
  foundersBps: 3000,
  ecosystemBps: 2000,
} as const;

/**
 * Documented treasury purposes, per bucket.
 * Source: docs/research/FUNDING_AND_ECONOMICS.md sec.2.1 and
 * docs/knowledge_base/operating_manual.md sec.3A.
 */
export const TREASURY_PURPOSES: Record<"OPERATIONS" | "FOUNDERS" | "ECOSYSTEM", readonly string[]> = {
  OPERATIONS: [
    "CI/CD & infrastructure",
    "SDK development & maintenance",
    "Nexus (Glass Node) operations",
    "Security audits (quarterly)",
  ],
  FOUNDERS: [
    "Founder/contributor compensation (4-year vesting)",
    "Performance bonuses (DAO-voted)",
    "Emergency fund (6-month cap)",
  ],
  ECOSYSTEM: [
    "Builder grants",
    "Liquidity mining programs",
    "Bug bounty & security",
  ],
} as const;

export interface TreasuryUtilisationLine {
  bucket: "OPERATIONS" | "FOUNDERS" | "ECOSYSTEM";
  amountSat: bigint;
  purposes: readonly string[];
  /** SAB release target for this bucket (docs/AGENTS.md sec.3). */
  releaseTarget: "SAB-TREASURY-MS" | "DAO-TREASURY-MS";
}

export interface TreasuryUtilisationPlan {
  lines: TreasuryUtilisationLine[];
  totalSweptSat: bigint;
  /** Target treasury asset mix (operating_manual sec.3C). */
  targetAllocation: {
    stablecoinsPct: number;
    rwaPct: number;
    liquidStakingPct: number;
    nativeTokenPct: number;
  };
  notes: string[];
}

/**
 * Map a vault sweep to the documented treasury purposes and the target asset mix.
 *
 * This is the "what for" layer: the sweep says how much each bucket receives,
 * this says what each bucket is for and which SAB release target moves it. Pure
 * and deterministic; performs no I/O and confers no spend authority.
 */
export function planTreasuryUtilisation(sweep: VaultSweepPlan): TreasuryUtilisationPlan {
  const lines: TreasuryUtilisationLine[] = [
    {
      bucket: "OPERATIONS",
      amountSat: sweep.operationsSat,
      purposes: TREASURY_PURPOSES.OPERATIONS,
      releaseTarget: "SAB-TREASURY-MS",
    },
    {
      bucket: "FOUNDERS",
      amountSat: sweep.foundersSat,
      purposes: TREASURY_PURPOSES.FOUNDERS,
      releaseTarget: "SAB-TREASURY-MS",
    },
    {
      bucket: "ECOSYSTEM",
      amountSat: sweep.ecosystemSat,
      purposes: TREASURY_PURPOSES.ECOSYSTEM,
      releaseTarget: "DAO-TREASURY-MS",
    },
  ];

  const notes = [
    "Released only by the configured sweep authority (SAB-TREASURY-MS); this plan grants no spend authority.",
    "Babylon staking yield recycles through the same 50/30/20 split (MARKET-014).",
    "Minimum 12-month stablecoin runway; 3-of-5 multisig, 48-hour timelock above the high-value threshold.",
  ];

  return {
    lines,
    totalSweptSat: sweep.intakeSat,
    targetAllocation: {
      stablecoinsPct: 40,
      rwaPct: 30,
      liquidStakingPct: 20,
      nativeTokenPct: 10,
    },
    notes,
  };
}

function requirePrincipal(
  role: SettlementRole,
  principal: string | undefined,
  blockers: string[],
): string | undefined {
  if (!principal || principal.trim().length === 0) {
    blockers.push(`${role} principal is not configured`);
    return undefined;
  }
  return principal;
}

/**
 * Build the complete recipient instruction set for a released settlement.
 *
 * Pure and deterministic; performs no I/O. The platform's take (10% of gross on
 * a matched job; the ADR-005 dynamic fee on a rail) routes into TREASURY-VAULT,
 * which sweeps it 50/30/20. The builder receives `gross − take` directly.
 */
export function buildProtocolFeeSettlement(
  input: FeeSettlementInput,
  config: FeeSettlementConfig,
): ProtocolFeeSettlementPlan {
  const blockers: string[] = [];

  if (input.grossAmountSat <= 0n) {
    blockers.push("grossAmountSat must be greater than zero");
  }

  const builderPrincipal = requirePrincipal("BUILDER", config.builder.principal, blockers);
  const vaultPrincipal = requirePrincipal("TREASURY_VAULT", config.vault.principal, blockers);
  const operationsPrincipal = requirePrincipal("OPERATIONS", config.operations.principal, blockers);
  const foundersPrincipal = requirePrincipal("FOUNDERS", config.founders.principal, blockers);
  const ecosystemPrincipal = requirePrincipal("ECOSYSTEM", config.ecosystem.principal, blockers);

  const split = config.vaultSplit ?? DEFAULT_VAULT_SPLIT;
  if (
    split.operationsBps + split.foundersBps + split.ecosystemBps !== 10_000 ||
    split.operationsBps < 0 ||
    split.foundersBps < 0 ||
    split.ecosystemBps < 0
  ) {
    blockers.push("vaultSplit basis points must be non-negative and sum to 10000");
  }

  const take = computeProductTake({
    product: input.product,
    signals: input.signals,
    grossAmountSat: input.grossAmountSat,
    tier: input.tier,
    rail: input.rail,
    volumeDecayTier: input.volumeDecayTier,
    systemLoadFactor: input.systemLoadFactor,
    matchedJobTakeBps: input.matchedJobTakeBps,
  });

  // The vault sweep mirrors the contract's arithmetic: 50/30/20 of the take,
  // ecosystem absorbing integer-division dust. Under the single split rule the
  // vault split and the take split agree by construction; the config override
  // lets an operator retune the vault without changing the take.
  const operationsSat = (take.takeSat * BigInt(split.operationsBps)) / 10_000n;
  const foundersSat = (take.takeSat * BigInt(split.foundersBps)) / 10_000n;
  const ecosystemSweepSat = take.takeSat - operationsSat - foundersSat;

  const vaultSweep: VaultSweepPlan = {
    intakeSat: take.takeSat,
    operationsSat,
    foundersSat,
    ecosystemSat: ecosystemSweepSat,
    operationsBps: split.operationsBps,
    foundersBps: split.foundersBps,
    ecosystemBps: split.ecosystemBps,
  };

  const instructions: SettlementInstruction[] = [
    {
      leg: "builder",
      recipientRole: "BUILDER",
      recipientPrincipal: builderPrincipal,
      amountSat: take.builderSat,
      destination: "direct",
      rail: input.rail,
    },
    {
      leg: "treasury",
      recipientRole: "TREASURY_VAULT",
      recipientPrincipal: vaultPrincipal,
      amountSat: take.takeSat,
      destination: "vault-intake",
      rail: input.rail,
    },
  ];

  // Sweep recipients are required to settle even though they are not payees of
  // this settlement: an unconfigured sweep target would strand the intake.
  void operationsPrincipal;
  void foundersPrincipal;
  void ecosystemPrincipal;

  return {
    settlementId: input.settlementId,
    rail: input.rail,
    tier: input.tier,
    product: take.product,
    grossAmountSat: input.grossAmountSat,
    protocolTakeSat: take.takeSat,
    builderSat: take.builderSat,
    effectiveProtocolTakeBps: take.takeBps,
    instructions,
    vaultSweep,
    isSettleable: blockers.length === 0,
    blockers,
  };
}
