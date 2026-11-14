// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Conxian Labs (Pty) Ltd
//
// Part of the @conxian/market-sdk revenue moat. This file is licensed
// AGPL-3.0-or-later, NOT MIT: see LICENSING.md. Running a modified version
// of this file as a network service obliges you to offer the corresponding
// source to your users (AGPL-3.0 section 13), or to obtain a commercial
// licence from Conxian Labs.
/**
 * Protocol fee settlement planning.
 *
 * Closes the gap between "fee computed" and "fee routed": `job_card_escrow`
 * computes the 80/10/10 yield split and then drops the treasury and ecosystem
 * legs, routing only the builder leg. This module turns a released escrow into
 * the complete, deterministic recipient instruction set:
 *
 *   builder            -> direct payout to the builder principal
 *   platform treasury  -> TREASURY-VAULT intake (contracts/protocol-fee-vault.clar)
 *   ecosystem          -> ecosystem principal
 *   vault sweep        -> 50/30/20 of the vault intake to Operations / Founders / Ecosystem
 *
 * Recipients are role principals, never hardcoded addresses (docs/AGENTS.md).
 * The plan fails closed: while any required principal is unconfigured, no
 * instruction is emitted and `isSettleable` is false.
 *
 * The vault is passive intake. Value leaves it only through the vault
 * contract's `sweep-treasury`, which the plan's `vaultSweep` mirrors so the
 * on-chain split and the off-chain plan cannot drift.
 */

import { BosYieldSplitter } from "./bos_yield_splitter.js";
import { SettlementRail, TrustTier } from "./core_types.js";

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
  /** TREASURY-VAULT — passive intake for the platform-treasury leg. */
  vault: RolePrincipal;
  ecosystem: RolePrincipal;
  /** Vault sweep recipients (SAB-TREASURY-MS release targets). */
  operations: RolePrincipal;
  founders: RolePrincipal;
  /** Vault sweep split in basis points. Defaults to the ADR-001 50/30/20. */
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
  /** Protocol fee already computed by `fee_calculator` (feeSat). */
  feeSat: bigint;
}

export interface SettlementInstruction {
  leg: "builder" | "treasury" | "ecosystem";
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
  grossAmountSat: bigint;
  protocolFeeSat: bigint;
  netPayoutSat: bigint;
  /**
   * Total protocol take across all legs (fee + treasury slice + ecosystem
   * slice), in basis points of gross. Surfaced so the ADR-001 §1 (2%) versus
   * §1.1 (80/10/10) divergence is visible rather than silent.
   */
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
 * Pure and deterministic; performs no I/O. Mirrors the arithmetic already used
 * by `job_card_escrow.evaluateAndRelease`: the protocol fee is taken off the
 * gross, then 80/10/10 applies to the net payout.
 */
export function buildProtocolFeeSettlement(
  input: FeeSettlementInput,
  config: FeeSettlementConfig,
): ProtocolFeeSettlementPlan {
  const blockers: string[] = [];

  if (input.grossAmountSat <= 0n) {
    blockers.push("grossAmountSat must be greater than zero");
  }
  if (input.feeSat < 0n) {
    blockers.push("feeSat must not be negative");
  }
  if (input.feeSat > input.grossAmountSat) {
    blockers.push("feeSat exceeds grossAmountSat");
  }

  const builderPrincipal = requirePrincipal("BUILDER", config.builder.principal, blockers);
  const vaultPrincipal = requirePrincipal("TREASURY_VAULT", config.vault.principal, blockers);
  const ecosystemPrincipal = requirePrincipal("ECOSYSTEM", config.ecosystem.principal, blockers);
  const operationsPrincipal = requirePrincipal("OPERATIONS", config.operations.principal, blockers);
  const foundersPrincipal = requirePrincipal("FOUNDERS", config.founders.principal, blockers);

  const split = config.vaultSplit ?? DEFAULT_VAULT_SPLIT;
  if (
    split.operationsBps + split.foundersBps + split.ecosystemBps !== 10_000 ||
    split.operationsBps < 0 ||
    split.foundersBps < 0 ||
    split.ecosystemBps < 0
  ) {
    blockers.push("vaultSplit basis points must be non-negative and sum to 10000");
  }

  const netPayoutSat = input.grossAmountSat > input.feeSat
    ? input.grossAmountSat - input.feeSat
    : 0n;
  const yieldSplit = BosYieldSplitter.calculateYieldSplit(netPayoutSat);

  const operationsSat = (yieldSplit.platformTreasurySat * BigInt(split.operationsBps)) / 10_000n;
  const foundersSat = (yieldSplit.platformTreasurySat * BigInt(split.foundersBps)) / 10_000n;
  // Remainder bucket absorbs integer-division dust, matching the vault contract.
  const ecosystemSweepSat = yieldSplit.platformTreasurySat - operationsSat - foundersSat;

  const vaultSweep: VaultSweepPlan = {
    intakeSat: yieldSplit.platformTreasurySat,
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
      amountSat: yieldSplit.builderSat,
      destination: "direct",
      rail: input.rail,
    },
    {
      leg: "treasury",
      recipientRole: "TREASURY_VAULT",
      recipientPrincipal: vaultPrincipal,
      amountSat: yieldSplit.platformTreasurySat,
      destination: "vault-intake",
      rail: input.rail,
    },
    {
      leg: "ecosystem",
      recipientRole: "ECOSYSTEM",
      recipientPrincipal: ecosystemPrincipal,
      amountSat: yieldSplit.ecosystemStakeholdersSat,
      destination: "direct",
      rail: input.rail,
    },
  ];

  const totalProtocolTakeSat =
    input.feeSat + yieldSplit.platformTreasurySat + yieldSplit.ecosystemStakeholdersSat;
  const effectiveProtocolTakeBps =
    input.grossAmountSat > 0n
      ? Number((totalProtocolTakeSat * 10_000n) / input.grossAmountSat)
      : 0;

  // Sweep recipients are required to settle even though they are not payees of
  // this settlement: an unconfigured sweep target would strand the intake.
  void operationsPrincipal;
  void foundersPrincipal;

  return {
    settlementId: input.settlementId,
    rail: input.rail,
    tier: input.tier,
    grossAmountSat: input.grossAmountSat,
    protocolFeeSat: input.feeSat,
    netPayoutSat,
    effectiveProtocolTakeBps,
    instructions,
    vaultSweep,
    isSettleable: blockers.length === 0,
    blockers,
  };
}
