import { describe, expect, it } from "vitest";
import { MonitoringWatcher } from "../src/monitoring_watcher.js";
import { SlaEngine } from "../src/sla_engine.js";
import { BosYieldSplitter } from "../src/bos_yield_splitter.js";
import type { MultiCloudTelemetryInput } from "../src/core_types.js";

describe("Multi-Cloud Telemetry & Yield Validation", () => {
  const watcher = new MonitoringWatcher();
  const slaEngine = new SlaEngine();

  const healthyInput: MultiCloudTelemetryInput = {
    supabase: {
      databaseId: "yauldfcpswnufgwfvnlr",
      connectionHealth: "HEALTHY",
      activeQueryLatencyMs: 45,
      bosStatechainSyncStatus: "IN_SYNC",
    },
    neon: {
      projectId: "orange-paper-76209725",
      branchId: "br-main",
      computeState: "ACTIVE",
      cpuUsagePct: 25,
      memoryUsagePct: 40,
      connectionPoolUtilizationPct: 30,
    },
    render: {
      serviceId: "srv-conxian-gateway",
      status: "LIVE",
      p95HttpLatencyMs: 120,
      restartCount24h: 0,
    },
  };

  it("aggregates healthy multi-cloud telemetry to GREEN scorecard", () => {
    const scorecard = watcher.aggregateMultiCloudTelemetry(healthyInput);
    expect(scorecard.overallStatus).toBe("GREEN");
    expect(scorecard.supabaseStatus).toBe("GREEN");
    expect(scorecard.neonStatus).toBe("GREEN");
    expect(scorecard.renderStatus).toBe("GREEN");
    expect(scorecard.alerts).toHaveLength(0);
  });

  it("escalates scorecard status to RED on critical database or service failure", () => {
    const criticalInput: MultiCloudTelemetryInput = {
      ...healthyInput,
      supabase: {
        ...healthyInput.supabase!,
        connectionHealth: "DOWN",
      },
    };

    const scorecard = watcher.aggregateMultiCloudTelemetry(criticalInput);
    expect(scorecard.overallStatus).toBe("RED");
    expect(scorecard.supabaseStatus).toBe("RED");
    expect(scorecard.alerts.some((a) => a.includes("DOWN"))).toBe(true);
  });

  it("fails closed when telemetry providers are absent", () => {
    const scorecard = watcher.aggregateMultiCloudTelemetry({});
    const validation = BosYieldSplitter.validateYieldSplitRealtime({
      grossAmountSat: 1_000_000n,
      telemetry: scorecard,
    });

    expect(scorecard.overallStatus).toBe("RED");
    expect(scorecard.supabaseStatus).toBe("RED");
    expect(scorecard.neonStatus).toBe("RED");
    expect(scorecard.renderStatus).toBe("RED");
    expect(scorecard.alerts).toEqual(
      expect.arrayContaining([
        "CRITICAL: Supabase BOS telemetry unavailable",
        "CRITICAL: Neon Postgres telemetry unavailable",
        "CRITICAL: Render Web Service telemetry unavailable",
      ])
    );
    expect(validation.authorized).toBe(false);
  });

  it("keeps OUT_OF_SYNC critical when Supabase is also degraded", () => {
    const scorecard = watcher.aggregateMultiCloudTelemetry({
      ...healthyInput,
      supabase: {
        ...healthyInput.supabase!,
        connectionHealth: "DEGRADED",
        activeQueryLatencyMs: 900,
        bosStatechainSyncStatus: "OUT_OF_SYNC",
      },
    });

    expect(scorecard.overallStatus).toBe("RED");
    expect(scorecard.supabaseStatus).toBe("RED");
    expect(scorecard.alerts).toContain(
      `CRITICAL: Supabase BOS Database (${healthyInput.supabase!.databaseId}) statechain OUT_OF_SYNC`
    );
  });

  it("evaluates multi-cloud SLA health with telemetry alerts", () => {
    const degradedInput: MultiCloudTelemetryInput = {
      ...healthyInput,
      render: {
        ...healthyInput.render!,
        p95HttpLatencyMs: 2500, // exceeds 1500ms threshold
      },
    };

    const scorecard = watcher.aggregateMultiCloudTelemetry(degradedInput);
    const slaHealth = slaEngine.evaluateMultiCloudSlaHealth(scorecard);

    expect(slaHealth.status).toBe("YELLOW");
    expect(slaHealth.alerts.length).toBeGreaterThan(0);
  });

  it("validates 80/10/10 yield split in real-time and pauses on RED telemetry", () => {
    const criticalInput: MultiCloudTelemetryInput = {
      ...healthyInput,
      render: {
        ...healthyInput.render!,
        status: "CRASHED",
      },
    };

    const scorecard = watcher.aggregateMultiCloudTelemetry(criticalInput);
    const validation = BosYieldSplitter.validateYieldSplitRealtime({
      grossAmountSat: 1_000_000n,
      telemetry: scorecard,
    });

    expect(validation.yieldSplit.builderSat).toBe(800_000n);
    expect(validation.yieldSplit.platformTreasurySat).toBe(100_000n);
    expect(validation.yieldSplit.ecosystemStakeholdersSat).toBe(100_000n);
    expect(validation.authorized).toBe(false); // Paused on RED
    expect(validation.warnings.some((w) => w.includes("paused"))).toBe(true);
  });
  it("fails closed for stale, invalid, or future telemetry timestamps", () => {
    const fresh = watcher.aggregateMultiCloudTelemetry({
      ...healthyInput,
      capturedAtIso: "2026-10-29T07:00:00.000Z",
    });

    const stale = BosYieldSplitter.validateYieldSplitRealtime({
      grossAmountSat: 1_000_000n,
      telemetry: fresh,
      evaluatedAtIso: "2026-10-29T07:06:00.001Z",
    });
    expect(stale.authorized).toBe(false);
    expect(stale.warnings).toContain(
      "Yield split settlement paused: telemetry is older than the five-minute freshness window"
    );

    const invalid = BosYieldSplitter.validateYieldSplitRealtime({
      grossAmountSat: 1_000_000n,
      telemetry: { ...fresh, capturedAtIso: "not-a-timestamp" },
      evaluatedAtIso: "2026-10-29T07:00:00.000Z",
    });
    expect(invalid.authorized).toBe(false);
    expect(invalid.warnings).toContain(
      "Yield split settlement paused: telemetry timestamps are missing or invalid"
    );

    const future = BosYieldSplitter.validateYieldSplitRealtime({
      grossAmountSat: 1_000_000n,
      telemetry: { ...fresh, capturedAtIso: "2026-10-29T07:00:31.000Z" },
      evaluatedAtIso: "2026-10-29T07:00:00.000Z",
    });
    expect(future.authorized).toBe(false);
    expect(future.warnings).toContain(
      "Yield split settlement paused: telemetry capture time is in the future"
    );
  });

  it("retains telemetry warnings when the base SLA is already RED", () => {
    const warning = "WARNING: Render latency exceeds the operational threshold";
    const scorecard = watcher.aggregateMultiCloudTelemetry({
      ...healthyInput,
      capturedAtIso: "2026-10-29T07:00:00.000Z",
      render: {
        ...healthyInput.render!,
        p95HttpLatencyMs: 2500,
      },
    });
    expect(scorecard.alerts).toContain(warning.replace("exceeds the operational threshold", "latency elevated (2500ms)"));

    const baseSla = {
      status: "RED" as const,
      totalAudited: 1,
      breachCount: 1,
      abandonmentCount: 0,
      staleCount: 0,
      violationCount: 1,
      complianceRatePct: 0,
      violations: [],
      alerts: ["CRITICAL: Existing SLA breach"],
    };
    const result = slaEngine.evaluateMultiCloudSlaHealth(scorecard, baseSla);
    expect(result.status).toBe("RED");
    expect(result.alerts).toEqual(
      expect.arrayContaining(["CRITICAL: Existing SLA breach", ...scorecard.alerts])
    );
    expect(result.violationCount).toBe(1 + scorecard.alerts.length);
  });

});
