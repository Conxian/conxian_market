/**
 * Conxian Market: Telemetry & Treasury Health Watcher Engine.
 *
 * Implements the monitoring, health evaluation, and treasury runway specifications
 * from `docs/knowledge_base/monitoring.md`.
 *
 * Key Capabilities:
 *   - sBTC Peg & Signer Health Evaluation
 *   - Fedimint Mint Health & Liquidity Checking
 *   - Babylon Staking Concentration & Slashing Watcher
 *   - Treasury Runway & Asset Allocation Split Calculator
 *   - Unified Health Snapshot & Alert Generation
 */

import type { TrustTier } from "./core_types";

// ── Health Severity Status ──

export type HealthStatus = "GREEN" | "YELLOW" | "RED";

// Helper to escalate health status
function escalateStatus(current: HealthStatus, next: HealthStatus): HealthStatus {
  if (current === "RED" || next === "RED") return "RED";
  if (current === "YELLOW" || next === "YELLOW") return "YELLOW";
  return "GREEN";
}

// ── sBTC Monitoring Types ──

export interface SbtcHealthInput {
  pegRatio: number; // e.g. 0.998 (target: 1.0)
  signerQuorumPct: number; // e.g. 94.0 (0-100)
  depositLatencySeconds?: number;
  unconfirmedWithdrawals?: number;
}

export interface SbtcHealthResult {
  status: HealthStatus;
  pegRatio: number;
  signerQuorumPct: number;
  alerts: string[];
}

// ── Fedimint Monitoring Types ──

export interface FedimintMintInput {
  mintId: string;
  communityName: string;
  totalLiquiditySats: bigint;
  ecashInCirculationSats: bigint;
  activeGuardians: number;
  requiredThreshold: number;
  lastGuardianHeartbeatSeconds: number;
  pendingRedemptions: number;
}

export interface FedimintHealthResult {
  mintId: string;
  status: HealthStatus;
  ecashRatioPct: number;
  alerts: string[];
}

// ── Babylon Staking Monitoring Types ──

export interface BabylonStakingInput {
  totalTreasuryBtc: number;
  totalStakedBtc: number;
  maxSingleProviderPct: number; // e.g. 25.0
  slashingEventsCount: number;
  yieldDeviationPct: number; // e.g. 5.0 (5% difference from expected)
}

export interface BabylonHealthResult {
  status: HealthStatus;
  stakedTreasuryPct: number;
  alerts: string[];
}

// ── Treasury Runway & Asset Allocation Types ──

export interface AssetAllocation {
  stablecoinsZar: number;
  rwaZar: number;
  liquidStakingZar: number;
  nativeTokenZar: number;
}

export interface TargetAllocationPct {
  stablecoinsPct: number; // Target: 40%
  rwaPct: number; // Target: 30%
  liquidStakingPct: number; // Target: 20%
  nativeTokenPct: number; // Target: 10%
}

export const DEFAULT_TARGET_ALLOCATION: TargetAllocationPct = {
  stablecoinsPct: 40,
  rwaPct: 30,
  liquidStakingPct: 20,
  nativeTokenPct: 10,
};

export interface TreasuryRunwayInput {
  fiatBalanceZar: number;
  cryptoBalanceZar: number;
  monthlyBurnRateZar: number;
  allocation: AssetAllocation;
  targetAllocation?: TargetAllocationPct;
}

export interface TreasuryRunwayResult {
  status: HealthStatus;
  runwayMonths: number;
  totalAssetsZar: number;
  allocationDeviations: Record<keyof AssetAllocation, { actualPct: number; targetPct: number; deltaPct: number }>;
  alerts: string[];
}

// ── Unified Health Report ──

export interface UnifiedHealthSnapshot {
  timestamp: string;
  overallStatus: HealthStatus;
  sbtc: SbtcHealthResult;
  fedimint: FedimintHealthResult[];
  babylon: BabylonHealthResult;
  treasury: TreasuryRunwayResult;
  criticalAlertCount: number;
  warningAlertCount: number;
}

// ── Monitoring Watcher Engine Class ──

export class MonitoringWatcher {
  /** Evaluate sBTC Peg and Signer Quorum Health */
  evaluateSbtcHealth(input: SbtcHealthInput): SbtcHealthResult {
    const alerts: string[] = [];
    let status: HealthStatus = "GREEN";

    // Peg Ratio check (Target >= 0.995 Green, 0.98-0.995 Yellow, < 0.98 Red)
    if (input.pegRatio < 0.98) {
      status = escalateStatus(status, "RED");
      alerts.push(`CRITICAL: sBTC peg severe deviation (Ratio: ${input.pegRatio.toFixed(4)})`);
    } else if (input.pegRatio < 0.995) {
      status = escalateStatus(status, "YELLOW");
      alerts.push(`WARNING: sBTC peg slight deviation (Ratio: ${input.pegRatio.toFixed(4)})`);
    }

    // Signer Quorum check (>= 90% Green, 70-90% Yellow, < 70% Red)
    if (input.signerQuorumPct < 70) {
      status = escalateStatus(status, "RED");
      alerts.push(`CRITICAL: Signer quorum health compromised (${input.signerQuorumPct.toFixed(1)}%)`);
    } else if (input.signerQuorumPct < 90) {
      status = escalateStatus(status, "YELLOW");
      alerts.push(`WARNING: Signer quorum degraded (${input.signerQuorumPct.toFixed(1)}%)`);
    }

    // Optional unconfirmed withdrawals backlog check
    if (input.unconfirmedWithdrawals !== undefined && input.unconfirmedWithdrawals > 50) {
      status = escalateStatus(status, "YELLOW");
      alerts.push(`WARNING: High unconfirmed withdrawal backlog (${input.unconfirmedWithdrawals})`);
    }

    return {
      status,
      pegRatio: input.pegRatio,
      signerQuorumPct: input.signerQuorumPct,
      alerts,
    };
  }

  /** Evaluate Fedimint Mint Health */
  evaluateFedimintMintHealth(input: FedimintMintInput): FedimintHealthResult {
    const alerts: string[] = [];
    let status: HealthStatus = "GREEN";

    // Guardian active threshold check
    if (input.activeGuardians < input.requiredThreshold) {
      status = escalateStatus(status, "RED");
      alerts.push(
        `CRITICAL: Fedimint mint ${input.mintId} below required guardian threshold (${input.activeGuardians}/${input.requiredThreshold})`,
      );
    } else if (input.activeGuardians === input.requiredThreshold) {
      status = escalateStatus(status, "YELLOW");
      alerts.push(
        `WARNING: Fedimint mint ${input.mintId} operating at exact threshold (${input.activeGuardians}/${input.requiredThreshold})`,
      );
    }

    // Guardian Heartbeat check (<=30s Green, 30-120s Yellow, >120s Red)
    if (input.lastGuardianHeartbeatSeconds > 120) {
      status = escalateStatus(status, "RED");
      alerts.push(`CRITICAL: Guardian heartbeat stale (${input.lastGuardianHeartbeatSeconds}s ago)`);
    } else if (input.lastGuardianHeartbeatSeconds > 30) {
      status = escalateStatus(status, "YELLOW");
      alerts.push(`WARNING: Guardian heartbeat delayed (${input.lastGuardianHeartbeatSeconds}s ago)`);
    }

    // E-cash in circulation vs total liquidity ratio (<=80% Green, 80-95% Yellow, >95% Red)
    const ecashRatioPct =
      input.totalLiquiditySats > 0n
        ? (Number(input.ecashInCirculationSats) / Number(input.totalLiquiditySats)) * 100
        : 100;

    if (ecashRatioPct > 95) {
      status = escalateStatus(status, "RED");
      alerts.push(`CRITICAL: Mint e-cash utilization critical (${ecashRatioPct.toFixed(1)}%)`);
    } else if (ecashRatioPct > 80) {
      status = escalateStatus(status, "YELLOW");
      alerts.push(`WARNING: Mint e-cash utilization high (${ecashRatioPct.toFixed(1)}%)`);
    }

    // Redemption backlog check (>20 Red, >5 Yellow)
    if (input.pendingRedemptions > 20) {
      status = escalateStatus(status, "RED");
      alerts.push(`CRITICAL: High redemption backlog (${input.pendingRedemptions})`);
    } else if (input.pendingRedemptions > 5) {
      status = escalateStatus(status, "YELLOW");
      alerts.push(`WARNING: Moderate redemption backlog (${input.pendingRedemptions})`);
    }

    return {
      mintId: input.mintId,
      status,
      ecashRatioPct,
      alerts,
    };
  }

  /** Evaluate Babylon Staking Health */
  evaluateBabylonHealth(input: BabylonStakingInput): BabylonHealthResult {
    const alerts: string[] = [];
    let status: HealthStatus = "GREEN";

    const stakedTreasuryPct =
      input.totalTreasuryBtc > 0 ? (input.totalStakedBtc / input.totalTreasuryBtc) * 100 : 0;

    // Total staked % of treasury (<=25% Green, 25-35% Yellow, >35% Red)
    if (stakedTreasuryPct > 35) {
      status = escalateStatus(status, "RED");
      alerts.push(`CRITICAL: Treasury staking exposure excessive (${stakedTreasuryPct.toFixed(1)}%)`);
    } else if (stakedTreasuryPct > 25) {
      status = escalateStatus(status, "YELLOW");
      alerts.push(`WARNING: Treasury staking exposure high (${stakedTreasuryPct.toFixed(1)}%)`);
    }

    // Single provider concentration check (<=20% Green, 20-30% Yellow, >30% Red)
    if (input.maxSingleProviderPct > 30) {
      status = escalateStatus(status, "RED");
      alerts.push(`CRITICAL: Single provider concentration too high (${input.maxSingleProviderPct.toFixed(1)}%)`);
    } else if (input.maxSingleProviderPct > 20) {
      status = escalateStatus(status, "YELLOW");
      alerts.push(`WARNING: Single provider concentration elevated (${input.maxSingleProviderPct.toFixed(1)}%)`);
    }

    // Provider slashing events (0 Green, 1 Yellow, >=2 Red)
    if (input.slashingEventsCount >= 2) {
      status = escalateStatus(status, "RED");
      alerts.push(`CRITICAL: Multiple provider slashing events detected (${input.slashingEventsCount})`);
    } else if (input.slashingEventsCount === 1) {
      status = escalateStatus(status, "YELLOW");
      alerts.push(`WARNING: Provider slashing event detected (${input.slashingEventsCount})`);
    }

    // Yield deviation check (+-10% Green, +-25% Yellow, >25% Red)
    if (Math.abs(input.yieldDeviationPct) > 25) {
      status = escalateStatus(status, "RED");
      alerts.push(`CRITICAL: Yield deviation severe (${input.yieldDeviationPct.toFixed(1)}%)`);
    } else if (Math.abs(input.yieldDeviationPct) > 10) {
      status = escalateStatus(status, "YELLOW");
      alerts.push(`WARNING: Yield deviation elevated (${input.yieldDeviationPct.toFixed(1)}%)`);
    }

    return {
      status,
      stakedTreasuryPct,
      alerts,
    };
  }

  /** Calculate Treasury Health and Runway */
  evaluateTreasuryRunway(input: TreasuryRunwayInput): TreasuryRunwayResult {
    const alerts: string[] = [];
    let status: HealthStatus = "GREEN";

    const totalAssetsZar = input.fiatBalanceZar + input.cryptoBalanceZar;
    const monthlyBurn = input.monthlyBurnRateZar > 0 ? input.monthlyBurnRateZar : 1;
    const runwayMonths = totalAssetsZar / monthlyBurn;

    // Runway status (12+ months Green, 6-12 months Yellow, <6 months Red)
    if (runwayMonths < 6) {
      status = escalateStatus(status, "RED");
      alerts.push(`CRITICAL: Treasury runway critical (${runwayMonths.toFixed(1)} months remaining)`);
    } else if (runwayMonths < 12) {
      status = escalateStatus(status, "YELLOW");
      alerts.push(`WARNING: Treasury runway below 12-month target (${runwayMonths.toFixed(1)} months remaining)`);
    }

    // Asset allocation split verification
    const target = input.targetAllocation ?? DEFAULT_TARGET_ALLOCATION;
    const sumAllocated =
      input.allocation.stablecoinsZar +
      input.allocation.rwaZar +
      input.allocation.liquidStakingZar +
      input.allocation.nativeTokenZar;

    const baseForAlloc = sumAllocated > 0 ? sumAllocated : 1;

    const actualAlloc = {
      stablecoinsPct: (input.allocation.stablecoinsZar / baseForAlloc) * 100,
      rwaPct: (input.allocation.rwaZar / baseForAlloc) * 100,
      liquidStakingPct: (input.allocation.liquidStakingZar / baseForAlloc) * 100,
      nativeTokenPct: (input.allocation.nativeTokenZar / baseForAlloc) * 100,
    };

    const deviations: TreasuryRunwayResult["allocationDeviations"] = {
      stablecoinsZar: {
        actualPct: actualAlloc.stablecoinsPct,
        targetPct: target.stablecoinsPct,
        deltaPct: actualAlloc.stablecoinsPct - target.stablecoinsPct,
      },
      rwaZar: {
        actualPct: actualAlloc.rwaPct,
        targetPct: target.rwaPct,
        deltaPct: actualAlloc.rwaPct - target.rwaPct,
      },
      liquidStakingZar: {
        actualPct: actualAlloc.liquidStakingPct,
        targetPct: target.liquidStakingPct,
        deltaPct: actualAlloc.liquidStakingPct - target.liquidStakingPct,
      },
      nativeTokenZar: {
        actualPct: actualAlloc.nativeTokenPct,
        targetPct: target.nativeTokenPct,
        deltaPct: actualAlloc.nativeTokenPct - target.nativeTokenPct,
      },
    };

    // Alert if stablecoins below target (25% threshold)
    if (actualAlloc.stablecoinsPct < 25) {
      status = escalateStatus(status, "YELLOW");
      alerts.push(`WARNING: Stablecoin asset allocation low (${actualAlloc.stablecoinsPct.toFixed(1)}% vs target 40%)`);
    }

    return {
      status,
      runwayMonths,
      totalAssetsZar,
      allocationDeviations: deviations,
      alerts,
    };
  }

  /** Create a Unified Health Snapshot across all telemetry streams */
  createSnapshot(params: {
    sbtc: SbtcHealthInput;
    fedimints: FedimintMintInput[];
    babylon: BabylonStakingInput;
    treasury: TreasuryRunwayInput;
  }): UnifiedHealthSnapshot {
    const sbtcRes = this.evaluateSbtcHealth(params.sbtc);
    const fedimintRes = params.fedimints.map((f) => this.evaluateFedimintMintHealth(f));
    const babylonRes = this.evaluateBabylonHealth(params.babylon);
    const treasuryRes = this.evaluateTreasuryRunway(params.treasury);

    const allStatuses = [sbtcRes.status, ...fedimintRes.map((f) => f.status), babylonRes.status, treasuryRes.status];

    let overallStatus: HealthStatus = "GREEN";
    if (allStatuses.includes("RED")) {
      overallStatus = "RED";
    } else if (allStatuses.includes("YELLOW")) {
      overallStatus = "YELLOW";
    }

    const allAlerts = [
      ...sbtcRes.alerts,
      ...fedimintRes.flatMap((f) => f.alerts),
      ...babylonRes.alerts,
      ...treasuryRes.alerts,
    ];

    const criticalAlertCount = allAlerts.filter((a) => a.startsWith("CRITICAL")).length;
    const warningAlertCount = allAlerts.filter((a) => a.startsWith("WARNING")).length;

    return {
      timestamp: new Date().toISOString(),
      overallStatus,
      sbtc: sbtcRes,
      fedimint: fedimintRes,
      babylon: babylonRes,
      treasury: treasuryRes,
      criticalAlertCount,
      warningAlertCount,
    };
  }
}
