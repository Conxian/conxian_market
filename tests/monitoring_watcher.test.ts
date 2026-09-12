import { describe, expect, it } from "vitest";
import {
  ConxianMarketSDK,
  MonitoringWatcher,
  DEFAULT_TARGET_ALLOCATION,
  TrustTier,
  type SbtcHealthInput,
  type FedimintMintInput,
  type BabylonStakingInput,
  type TreasuryRunwayInput,
  type JobCardSlaAuditInput,
  type SlaHealthInput,
} from "../src/index";

describe("MonitoringWatcher Engine", () => {
  const watcher = new MonitoringWatcher();

  describe("sBTC Health Evaluation", () => {
    it("returns GREEN when peg and quorum are healthy", () => {
      const input: SbtcHealthInput = {
        pegRatio: 0.998,
        signerQuorumPct: 95.0,
      };
      const result = watcher.evaluateSbtcHealth(input);
      expect(result.status).toBe("GREEN");
      expect(result.alerts).toHaveLength(0);
    });

    it("returns YELLOW when peg or quorum is degraded", () => {
      const input: SbtcHealthInput = {
        pegRatio: 0.990, // < 0.995
        signerQuorumPct: 85.0, // < 90%
      };
      const result = watcher.evaluateSbtcHealth(input);
      expect(result.status).toBe("YELLOW");
      expect(result.alerts).toHaveLength(2);
      expect(result.alerts[0]).toContain("WARNING: sBTC peg slight deviation");
    });

    it("returns RED when peg is critically de-pegged or quorum is compromised", () => {
      const input: SbtcHealthInput = {
        pegRatio: 0.975, // < 0.98
        signerQuorumPct: 65.0, // < 70%
      };
      const result = watcher.evaluateSbtcHealth(input);
      expect(result.status).toBe("RED");
      expect(result.alerts).toHaveLength(2);
      expect(result.alerts[0]).toContain("CRITICAL: sBTC peg severe deviation");
    });
  });

  describe("Fedimint Mint Health Evaluation", () => {
    it("returns GREEN when active guardians exceed threshold and heartbeat is fresh", () => {
      const input: FedimintMintInput = {
        mintId: "mint-001",
        communityName: "Industrial Alpha Mint",
        totalLiquiditySats: 10_000_000n,
        ecashInCirculationSats: 5_000_000n,
        activeGuardians: 5,
        requiredThreshold: 3,
        lastGuardianHeartbeatSeconds: 10,
        pendingRedemptions: 2,
      };
      const result = watcher.evaluateFedimintMintHealth(input);
      expect(result.status).toBe("GREEN");
      expect(result.ecashRatioPct).toBe(50.0);
      expect(result.alerts).toHaveLength(0);
    });

    it("returns RED when active guardians drop below threshold", () => {
      const input: FedimintMintInput = {
        mintId: "mint-002",
        communityName: "Degraded Mint",
        totalLiquiditySats: 10_000_000n,
        ecashInCirculationSats: 9_600_000n, // 96% > 95% Red
        activeGuardians: 2, // < 3 threshold Red
        requiredThreshold: 3,
        lastGuardianHeartbeatSeconds: 150, // > 120s Red
        pendingRedemptions: 25, // > 20 Red
      };
      const result = watcher.evaluateFedimintMintHealth(input);
      expect(result.status).toBe("RED");
      expect(result.alerts.length).toBeGreaterThanOrEqual(3);
      expect(result.alerts.some((a) => a.includes("below required guardian threshold"))).toBe(true);
    });
  });

  describe("Babylon Staking Health Evaluation", () => {
    it("returns GREEN when exposure and provider limits are within safety bounds", () => {
      const input: BabylonStakingInput = {
        totalTreasuryBtc: 100,
        totalStakedBtc: 20, // 20% <= 25%
        maxSingleProviderPct: 15.0, // <= 20%
        slashingEventsCount: 0,
        yieldDeviationPct: 3.0,
      };
      const result = watcher.evaluateBabylonHealth(input);
      expect(result.status).toBe("GREEN");
      expect(result.stakedTreasuryPct).toBe(20.0);
      expect(result.alerts).toHaveLength(0);
    });

    it("returns RED when slashing events occur or treasury exposure is excessive", () => {
      const input: BabylonStakingInput = {
        totalTreasuryBtc: 100,
        totalStakedBtc: 40, // 40% > 35%
        maxSingleProviderPct: 35.0, // > 30%
        slashingEventsCount: 2, // >= 2
        yieldDeviationPct: 30.0, // > 25%
      };
      const result = watcher.evaluateBabylonHealth(input);
      expect(result.status).toBe("RED");
      expect(result.alerts).toHaveLength(4);
      expect(result.alerts.some((a) => a.includes("Multiple provider slashing events"))).toBe(true);
    });
  });

  describe("Treasury Runway & Asset Allocation Evaluation", () => {
    it("calculates runway months and asset allocation deviations accurately", () => {
      const input: TreasuryRunwayInput = {
        fiatBalanceZar: 2_000_000,
        cryptoBalanceZar: 3_000_000, // Total = 5,000,000 ZAR
        monthlyBurnRateZar: 250_000, // 20 months runway
        allocation: {
          stablecoinsZar: 2_000_000, // 40%
          rwaZar: 1_500_000, // 30%
          liquidStakingZar: 1_000_000, // 20%
          nativeTokenZar: 500_000, // 10%
        },
      };
      const result = watcher.evaluateTreasuryRunway(input);
      expect(result.status).toBe("GREEN");
      expect(result.runwayMonths).toBe(20);
      expect(result.totalAssetsZar).toBe(5_000_000);
      expect(result.allocationDeviations.stablecoinsZar.actualPct).toBe(40);
      expect(result.allocationDeviations.stablecoinsZar.deltaPct).toBe(0);
      expect(result.alerts).toHaveLength(0);
    });

    it("returns RED when runway is under 6 months", () => {
      const input: TreasuryRunwayInput = {
        fiatBalanceZar: 500_000,
        cryptoBalanceZar: 500_000, // Total = 1,000,000 ZAR
        monthlyBurnRateZar: 250_000, // 4 months runway
        allocation: {
          stablecoinsZar: 100_000, // 10% (< 25% warning)
          rwaZar: 300_000,
          liquidStakingZar: 300_000,
          nativeTokenZar: 300_000,
        },
      };
      const result = watcher.evaluateTreasuryRunway(input);
      expect(result.status).toBe("RED");
      expect(result.runwayMonths).toBe(4);
      expect(result.alerts.some((a) => a.includes("Treasury runway critical"))).toBe(true);
      expect(result.alerts.some((a) => a.includes("Stablecoin asset allocation low"))).toBe(true);
    });
  });

  describe("Unified Health Snapshot via SDK Bridge", () => {
    it("generates a complete snapshot aggregating all subsystem health states", async () => {
      const sdk = await ConxianMarketSDK.connect({
        baseUrl: "https://gateway.conxian.dev",
      });

      const snapshot = sdk.getHealthSnapshot({
        sbtc: {
          pegRatio: 0.998,
          signerQuorumPct: 95.0,
        },
        fedimints: [
          {
            mintId: "mint-001",
            communityName: "Alpha Mint",
            totalLiquiditySats: 10_000_000n,
            ecashInCirculationSats: 2_000_000n,
            activeGuardians: 5,
            requiredThreshold: 3,
            lastGuardianHeartbeatSeconds: 15,
            pendingRedemptions: 0,
          },
        ],
        babylon: {
          totalTreasuryBtc: 100,
          totalStakedBtc: 15,
          maxSingleProviderPct: 10,
          slashingEventsCount: 0,
          yieldDeviationPct: 1.5,
        },
        treasury: {
          fiatBalanceZar: 3_000_000,
          cryptoBalanceZar: 3_000_000,
          monthlyBurnRateZar: 300_000,
          allocation: {
            stablecoinsZar: 2_400_000,
            rwaZar: 1_800_000,
            liquidStakingZar: 1_200_000,
            nativeTokenZar: 600_000,
          },
        },
      });

      expect(snapshot.overallStatus).toBe("GREEN");
      expect(snapshot.criticalAlertCount).toBe(0);
      expect(snapshot.warningAlertCount).toBe(0);
      expect(snapshot.fedimint).toHaveLength(1);
      expect(sdk.getCapabilitySummary().monitoringWatcherEnabled).toBe(true);
    });
  });

  describe("CJCS SLA Telemetry Health Evaluation (Session 62)", () => {
    const now = Date.now();
    const oneHour = 3600 * 1000;

    it("audits a compliant JobCard with no rule violations", () => {
      const job: JobCardSlaAuditInput = {
        jobId: "jc-clean-01",
        state: "Accepted",
        createdAt: now - 5 * oneHour,
        deadline: now + 10 * oneHour,
        lastActivityAt: now - 1 * oneHour,
        requiredTrustTier: TrustTier.Expedient,
        builderTrustTier: TrustTier.Managed,
        expectedFeeSat: 1000n,
        collectedFeeSat: 1000n,
      };

      const violations = watcher.auditJobCardSla(job, now);
      expect(violations).toHaveLength(0);
    });

    it("audits JobCards and detects stale, breach, abandonment, trust tier, and fee shortfall violations", () => {
      const staleJob: JobCardSlaAuditInput = {
        jobId: "jc-stale-01",
        state: "Pending",
        createdAt: now - 30 * oneHour, // > 24h
        deadline: now + 10 * oneHour,
        requiredTrustTier: TrustTier.Expedient,
        expectedFeeSat: 1000n,
        collectedFeeSat: 0n,
      };

      const breachJob: JobCardSlaAuditInput = {
        jobId: "jc-breach-01",
        state: "Accepted",
        createdAt: now - 20 * oneHour,
        deadline: now - 2 * oneHour, // deadline passed
        lastActivityAt: now - 1 * oneHour,
        requiredTrustTier: TrustTier.Expedient,
        expectedFeeSat: 1000n,
        collectedFeeSat: 0n,
      };

      const abandonedJob: JobCardSlaAuditInput = {
        jobId: "jc-abandoned-01",
        state: "Accepted",
        createdAt: now - 60 * oneHour,
        deadline: now + 10 * oneHour,
        lastActivityAt: now - 50 * oneHour, // idle > 48h
        requiredTrustTier: TrustTier.Expedient,
        expectedFeeSat: 1000n,
        collectedFeeSat: 0n,
      };

      const tierViolationJob: JobCardSlaAuditInput = {
        jobId: "jc-tier-01",
        state: "Accepted",
        createdAt: now - 2 * oneHour,
        deadline: now + 10 * oneHour,
        requiredTrustTier: TrustTier.Strict,
        builderTrustTier: TrustTier.Expedient, // builder tier < required tier
        expectedFeeSat: 1000n,
        collectedFeeSat: 0n,
      };

      const feeShortfallJob: JobCardSlaAuditInput = {
        jobId: "jc-fee-01",
        state: "Completed",
        createdAt: now - 5 * oneHour,
        deadline: now + 5 * oneHour,
        requiredTrustTier: TrustTier.Expedient,
        expectedFeeSat: 1000n,
        collectedFeeSat: 500n, // collected < expected
      };

      expect(watcher.auditJobCardSla(staleJob, now)[0].kind).toBe("stale_jobcard");
      expect(watcher.auditJobCardSla(breachJob, now)[0].kind).toBe("sla_breach");
      expect(watcher.auditJobCardSla(abandonedJob, now)[0].kind).toBe("builder_abandonment");
      expect(watcher.auditJobCardSla(tierViolationJob, now)[0].kind).toBe("trust_tier_violation");
      expect(watcher.auditJobCardSla(feeShortfallJob, now)[0].kind).toBe("fee_shortfall");
    });

    it("evaluates aggregate SLA health and returns RED when breaches occur", () => {
      const slaInput: SlaHealthInput = {
        activeJobCardsCount: 2,
        jobCards: [
          {
            jobId: "jc-001",
            state: "Accepted",
            createdAt: now - 5 * oneHour,
            deadline: now - 1 * oneHour, // breach
            requiredTrustTier: TrustTier.Expedient,
            expectedFeeSat: 1000n,
            collectedFeeSat: 0n,
          },
          {
            jobId: "jc-002",
            state: "Accepted",
            createdAt: now - 2 * oneHour,
            deadline: now + 5 * oneHour,
            requiredTrustTier: TrustTier.Expedient,
            expectedFeeSat: 1000n,
            collectedFeeSat: 0n,
          },
        ],
      };

      const result = watcher.evaluateSlaHealth(slaInput, now);
      expect(result.status).toBe("RED");
      expect(result.breachCount).toBe(1);
      expect(result.complianceRatePct).toBe(50);
      expect(result.alerts[0]).toContain("CRITICAL: SLA breaches detected");
    });

    it("includes SLA health evaluation in Unified Health Snapshot", () => {
      const snapshot = watcher.createSnapshot({
        sbtc: { pegRatio: 1.0, signerQuorumPct: 95 },
        fedimints: [],
        babylon: {
          totalStakedBtc: 10,
          totalTreasuryBtc: 100,
          maxSingleProviderPct: 15,
          slashingEventsCount: 0,
          yieldDeviationPct: 0,
        },
        treasury: {
          fiatBalanceZar: 1000000,
          cryptoBalanceZar: 5000000,
          monthlyBurnRateZar: 200000,
          allocation: {
            stablecoinsZar: 2400000,
            rwaZar: 1800000,
            liquidStakingZar: 1200000,
            nativeTokenZar: 600000,
          },
        },
        sla: {
          activeJobCardsCount: 1,
          jobCards: [
            {
              jobId: "jc-snap-01",
              state: "Accepted",
              createdAt: now - 2 * oneHour,
              deadline: now + 5 * oneHour,
              requiredTrustTier: TrustTier.Expedient,
              expectedFeeSat: 1000n,
              collectedFeeSat: 1000n,
            },
          ],
        },
      });

      expect(snapshot.sla).toBeDefined();
      expect(snapshot.sla?.status).toBe("GREEN");
      expect(snapshot.overallStatus).toBe("GREEN");
    });
  });
});
