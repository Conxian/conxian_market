import { describe, expect, it } from "vitest";
import { MonitoringWatcher } from "../src/monitoring_watcher.js";
import { SlaEngine } from "../src/sla_engine.js";
import { BosYieldSplitter } from "../src/bos_yield_splitter.js";

describe("Multi-Cloud Scorecard Telemetry & Real-Time Yield Validation", () => {
  const watcher = new MonitoringWatcher();
  const slaEngine = new SlaEngine();

  it("aggregates multi-cloud scorecard telemetry across Supabase, Neon, and Render", () => {
    const scorecard = watcher.aggregateMultiCloudTelemetry({
      supabase: {
        status: "GREEN",
        cnxBosSchemaHealthy: true,
        queryLatencyMs: 45,
        activeConnections: 12,
      },
      neon: {
        status: "GREEN",
        lfcHitRatePct: 98.5,
        workingSetSizeBytes: 1024000,
        computeState: "ACTIVE",
        activeConnections: 8,
      },
      render: {
        status: "GREEN",
        serviceUptimePct: 99.95,
        cpuUsagePct: 35.2,
        memoryUsagePct: 42.1,
        instanceCount: 3,
      },
    });

    expect(scorecard.overallStatus).toBe("GREEN");
    expect(scorecard.supabase.schemaHealthy).toBe(true);
    expect(scorecard.neon.computeState).toBe("ACTIVE");
    expect(scorecard.render.serviceUptimePct).toBe(99.95);
    expect(scorecard.alerts).toHaveLength(0);
  });

  it("flags RED multi-cloud status when Supabase schema is unhealthy or Neon is suspended", () => {
    const scorecard = watcher.aggregateMultiCloudTelemetry({
      supabase: {
        status: "RED",
        cnxBosSchemaHealthy: false,
        queryLatencyMs: 850,
        activeConnections: 0,
      },
      neon: {
        status: "RED",
        lfcHitRatePct: 60.0,
        workingSetSizeBytes: 5000,
        computeState: "SUSPENDED",
        activeConnections: 0,
      },
      render: {
        status: "GREEN",
        serviceUptimePct: 99.5,
        cpuUsagePct: 40.0,
        memoryUsagePct: 50.0,
        instanceCount: 1,
      },
    });

    expect(scorecard.overallStatus).toBe("RED");
    expect(scorecard.alerts.some((a) => a.includes("Supabase BOS cnx_bos schema unhealthy"))).toBe(true);
    expect(scorecard.alerts.some((a) => a.includes("Neon compute endpoint is suspended"))).toBe(true);
  });

  it("evaluates multi-cloud SLA health in SlaEngine", () => {
    const scorecard = watcher.aggregateMultiCloudTelemetry({
      supabase: {
        status: "GREEN",
        cnxBosSchemaHealthy: true,
        queryLatencyMs: 650, // >500ms -> YELLOW
        activeConnections: 10,
      },
      neon: {
        status: "GREEN",
        lfcHitRatePct: 92.0,
        workingSetSizeBytes: 50000,
        computeState: "ACTIVE",
        activeConnections: 5,
      },
      render: {
        status: "GREEN",
        serviceUptimePct: 99.9,
        cpuUsagePct: 20.0,
        memoryUsagePct: 30.0,
        instanceCount: 2,
      },
    });

    const slaHealth = slaEngine.evaluateMultiCloudSlaHealth(scorecard);
    expect(slaHealth.status).toBe("YELLOW");
    expect(slaHealth.alerts.some((a) => a.includes("Supabase BOS query latency high"))).toBe(true);
  });

  it("validates 80/10/10 yield split in real time against live multi-cloud telemetry", () => {
    const scorecard = watcher.aggregateMultiCloudTelemetry({
      supabase: {
        status: "GREEN",
        cnxBosSchemaHealthy: true,
        queryLatencyMs: 25,
        activeConnections: 5,
      },
      neon: {
        status: "GREEN",
        lfcHitRatePct: 99.1,
        workingSetSizeBytes: 200000,
        computeState: "ACTIVE",
        activeConnections: 10,
      },
      render: {
        status: "GREEN",
        serviceUptimePct: 99.99,
        cpuUsagePct: 15.0,
        memoryUsagePct: 25.0,
        instanceCount: 4,
      },
    });

    const validation = BosYieldSplitter.validateYieldSplitRealtime({
      grossAmountSat: 1_000_000n, // 1M sats
      telemetry: scorecard,
    });

    expect(validation.isYieldSplitValid).toBe(true);
    expect(validation.builderYieldSat).toBe(800_000n); // 80%
    expect(validation.platformTreasuryYieldSat).toBe(100_000n); // 10%
    expect(validation.ecosystemYieldSat).toBe(100_000n); // 10%
    expect(validation.multiCloudStatus).toBe("GREEN");
  });
});
