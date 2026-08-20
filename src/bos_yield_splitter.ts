/**
 * Conxian Market: Business Operating System (BOS) Yield Splitter & Thin Orchestrator Guard.
 *
 * Implements the commercial packaging and economic rules specified in docs/knowledge_base/operating_manual.md:
 * 1. Commercial Yield Matrix (80/10/10): 80% Builder, 10% Platform Treasury, 10% Ecosystem Stakeholders.
 * 2. Economic Fee Decay: 2.0% (0-12m), 1.5% (12-36m), 1.0% (36m+), allocated 50% Ops, 30% Founders, 20% Ecosystem.
 * 3. Founder Compensation & Vesting: 4-year vesting with cliff, 50/50 base/bonus cap, 6-month emergency escrow limit.
 * 4. Sovereign OS Thin Orchestrator & BYOK Guard: Prohibits centralized AI inference and mandates enclave key security.
 */

export interface YieldSplit {
  grossAmountSat: bigint;
  builderSat: bigint;            // 80%
  platformTreasurySat: bigint;   // 10%
  ecosystemStakeholdersSat: bigint; // 10%
}

export interface FeeDecayTier {
  phase: "Launch Stabilization" | "Growth Phase" | "Mature Ecosystem";
  minMonths: number;
  maxMonths: number | null;
  rateBps: number;              // 200 bps (2.0%), 150 bps (1.5%), 100 bps (1.0%)
}

export const FEE_DECAY_TIMELINE: FeeDecayTier[] = [
  { phase: "Launch Stabilization", minMonths: 0, maxMonths: 12, rateBps: 200 },
  { phase: "Growth Phase", minMonths: 12, maxMonths: 36, rateBps: 150 },
  { phase: "Mature Ecosystem", minMonths: 36, maxMonths: null, rateBps: 100 },
];

export interface ProtocolFeeDistribution {
  feeSat: bigint;
  rateBps: number;
  operationsTreasurySat: bigint; // 50%
  founderCompensationSat: bigint; // 30%
  ecosystemGrowthSat: bigint;    // 20%
}

export interface FounderVestingInput {
  monthsElapsed: number;
  totalAllocatedSat: bigint;
  monthlyBaseCapSat: bigint;
  daoBonusSat: bigint;
  escrowSat: bigint;
}

export interface FounderVestingResult {
  isVested: boolean;              // False if before 12-month cliff
  vestedRatio: number;            // 0.0 to 1.0 based on 48 months
  vestedAmountSat: bigint;
  authorizedMonthlyBaseSat: bigint;
  authorizedBonusSat: bigint;     // Capped at 50% of total comp
  emergencyLimitSat: bigint;      // Max 6-month base compensation
  isEscrowWithinLimit: boolean;
  violations: string[];
}

export interface InferencePolicyInput {
  isCentralizedInference: boolean;
  handlesPrivateKeys: boolean;
  usesMcpHandoff: boolean;
  usesEnclaveSdk: boolean;
}

export interface InferencePolicyResult {
  compliant: boolean;
  isThinOrchestrator: boolean;
  isByokSecured: boolean;
  violations: string[];
}

export class BosYieldSplitter {
  /**
   * Calculate 80/10/10 yield split for AI labor transactions per KB specs.
   */
  static calculateYieldSplit(grossAmountSat: bigint): YieldSplit {
    const builderSat = (grossAmountSat * 80n) / 100n;
    const platformTreasurySat = (grossAmountSat * 10n) / 100n;
    const ecosystemStakeholdersSat = grossAmountSat - builderSat - platformTreasurySat;

    return {
      grossAmountSat,
      builderSat,
      platformTreasurySat,
      ecosystemStakeholdersSat,
    };
  }

  /**
   * Get effective protocol fee rate based on months elapsed since launch.
   */
  static getEffectiveFeeRateBps(monthsElapsed: number): FeeDecayTier {
    if (monthsElapsed < 12) return FEE_DECAY_TIMELINE[0];
    if (monthsElapsed < 36) return FEE_DECAY_TIMELINE[1];
    return FEE_DECAY_TIMELINE[2];
  }

  /**
   * Calculate protocol fee and distribute 50% Ops / 30% Founders / 20% Ecosystem.
   */
  static distributeProtocolFee(
    grossAmountSat: bigint,
    monthsElapsed: number
  ): ProtocolFeeDistribution {
    const tier = BosYieldSplitter.getEffectiveFeeRateBps(monthsElapsed);
    const feeSat = (grossAmountSat * BigInt(tier.rateBps)) / 10_000n;

    const operationsTreasurySat = (feeSat * 50n) / 100n;
    const founderCompensationSat = (feeSat * 30n) / 100n;
    const ecosystemGrowthSat = feeSat - operationsTreasurySat - founderCompensationSat;

    return {
      feeSat,
      rateBps: tier.rateBps,
      operationsTreasurySat,
      founderCompensationSat,
      ecosystemGrowthSat,
    };
  }

  /**
   * Evaluate founder compensation vesting and emergency escrow compliance.
   */
  static evaluateFounderVesting(input: FounderVestingInput): FounderVestingResult {
    const violations: string[] = [];

    // 4-year vesting schedule = 48 months
    const isVested = input.monthsElapsed >= 12; // 1-year cliff
    const vestedRatio = isVested ? Math.min(1.0, input.monthsElapsed / 48) : 0.0;
    const vestedAmountSat = BigInt(Math.floor(Number(input.totalAllocatedSat) * vestedRatio));

    const authorizedMonthlyBaseSat = isVested ? input.monthlyBaseCapSat : 0n;

    // Performance Cap: Base 50%, DAO bonus cap at 50% of total compensation (bonus cannot exceed base)
    let authorizedBonusSat = input.daoBonusSat;
    if (authorizedBonusSat > authorizedMonthlyBaseSat) {
      authorizedBonusSat = authorizedMonthlyBaseSat;
      violations.push("DAO bonus capped at 50% of total monthly compensation");
    }

    // Emergency limit: Maximum 6 months base compensation in escrow
    const emergencyLimitSat = authorizedMonthlyBaseSat * 6n;
    const isEscrowWithinLimit = input.escrowSat <= emergencyLimitSat;
    if (!isEscrowWithinLimit) {
      violations.push("Escrow balance exceeds maximum 6-month compensation limit");
    }

    if (!isVested) {
      violations.push("Founder compensation locked before 12-month vesting cliff");
    }

    return {
      isVested,
      vestedRatio,
      vestedAmountSat,
      authorizedMonthlyBaseSat,
      authorizedBonusSat,
      emergencyLimitSat,
      isEscrowWithinLimit,
      violations,
    };
  }

  /**
   * Enforce Sovereign OS Thin Orchestrator & BYOK security requirements.
   */
  static verifyInferencePolicy(input: InferencePolicyInput): InferencePolicyResult {
    const violations: string[] = [];

    // Rule 1: Thin Orchestrator Pattern — Never perform heavy AI inference on centralized infrastructure
    const isThinOrchestrator = !input.isCentralizedInference && input.usesMcpHandoff;
    if (input.isCentralizedInference) {
      violations.push("Centralized heavy AI inference prohibited; must run at edge or via user keys");
    }
    if (!input.usesMcpHandoff) {
      violations.push("Agent handoffs must use Model Context Protocol (MCP)");
    }

    // Rule 2: BYOK Security — Sensitive key handling requires conxius-enclave-sdk
    const isByokSecured = !input.handlesPrivateKeys || input.usesEnclaveSdk;
    if (input.handlesPrivateKeys && !input.usesEnclaveSdk) {
      violations.push("Sensitive key handling requires conxius-enclave-sdk integration");
    }

    const compliant = isThinOrchestrator && isByokSecured && violations.length === 0;

    return {
      compliant,
      isThinOrchestrator,
      isByokSecured,
      violations,
    };
  }
}
