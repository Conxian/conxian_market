import { describe, expect, it } from "vitest";
import type { JobCard } from "../src/core_types";
import { TrustTier } from "../src/core_types";
import {
  BuilderReputationRecord,
  GapCard,
  SlaEngine,
  URGENCY_PRICING_TABLE,
} from "../src/sla_engine";

describe("SlaEngine", () => {
  const engine = new SlaEngine();

  const mockJobCard: JobCard = {
    id: "JC-2026-001",
    title: "AI Inference Pipeline Optimization",
    builderId: "did:conxian:builder-123",
    status: "IN_PROGRESS" as any,
    deadline: "2026-08-01T10:00:00Z" as any,
    bountySat: 50_000n,
    tier: TrustTier.Managed,
    rail: "LIGHTNING" as any,
    description: "Optimization job",
    createdAt: Math.floor(new Date("2026-08-01T00:00:00Z").getTime() / 1000),
  };

  it("should detect deadline breach and generate auto-published gap card for Managed tier", () => {
    // Current time is 2 hours past deadline (exceeds 1h grace)
    const currentTimeIso = "2026-08-01T12:00:00Z";

    const result = engine.evaluateJobCard(mockJobCard, currentTimeIso);

    expect(result.triggeredRules).toContain("SLA-001");
    expect(result.generatedGapCards).toHaveLength(1);

    const gapCard = result.generatedGapCards[0];
    expect(gapCard.id).toBe("GC-2026-001");
    expect(gapCard.parentJobId).toBe("JC-2026-001");
    expect(gapCard.urgency).toBe("high");
    expect(gapCard.state).toBe("auto_published");
    // Budget high urgency = 50k * 1.2 = 60k sats
    expect(gapCard.budgetSats).toBe(60_000n);
  });

  it("should create pending_approval gap card for Expedient tier", () => {
    const expedientJob: JobCard = {
      ...mockJobCard,
      tier: TrustTier.Expedient,
    };
    const currentTimeIso = "2026-08-01T12:00:00Z";

    const result = engine.evaluateJobCard(expedientJob, currentTimeIso);

    expect(result.generatedGapCards).toHaveLength(1);
    expect(result.generatedGapCards[0].state).toBe("pending_approval");
  });

  it("should trigger reopen and priority escalation if delay exceeds 4h", () => {
    // Current time is 5 hours past deadline
    const currentTimeIso = "2026-08-01T15:00:00Z";

    const result = engine.evaluateJobCard(mockJobCard, currentTimeIso);

    expect(result.triggeredRules).toContain("SLA-001");
    expect(result.triggeredRules).toContain("SLA-002");
    expect(result.reopenJobCard).toBe(true);
  });

  it("should flag builder on idle timeout (>48h)", () => {
    const currentTimeIso = "2026-08-03T10:00:00Z";
    const lastActivityTimeIso = "2026-08-01T00:00:00Z"; // 58 hours ago

    const result = engine.evaluateJobCard(mockJobCard, currentTimeIso, {
      lastActivityTimeIso,
    });

    expect(result.triggeredRules).toContain("SLA-003");
    expect(result.builderFlagged).toBe("warn");
  });

  it("should reject settlement on TrustTier mismatch", () => {
    const currentTimeIso = "2026-08-01T05:00:00Z";

    const result = engine.evaluateJobCard(mockJobCard, currentTimeIso, {
      actualTrustTier: TrustTier.Expedient, // Expected Managed
    });

    expect(result.triggeredRules).toContain("SLA-005");
    expect(result.settlementRejected).toBeDefined();
  });

  it("should notify treasury on fee shortfall", () => {
    const currentTimeIso = "2026-08-01T05:00:00Z";

    const result = engine.evaluateJobCard(mockJobCard, currentTimeIso, {
      collectedFeeBps: 150, // Less than 190
    });

    expect(result.triggeredRules).toContain("SLA-006");
    expect(result.treasuryNotified).toBeDefined();
  });

  it("should update builder reputation score and calculate eligible TrustTier", () => {
    const initialRecord: BuilderReputationRecord = {
      builderId: "did:conxian:builder-123",
      score: 80,
      slaBreachCount: 0,
      abandonmentCount: 0,
      gapCardsResolved: 0,
      qualityDisputeCount: 0,
      consecutiveCompletions: 0,
      eligibleTier: TrustTier.Managed,
      status: "active",
    };

    // 1. SLA Breach (-10)
    const afterBreach = SlaEngine.updateBuilderReputation(initialRecord, "sla_breach");
    expect(afterBreach.score).toBe(70);
    expect(afterBreach.eligibleTier).toBe(TrustTier.Managed);

    // 2. Abandonment (-25) -> Score 45 -> Expedient tier
    const afterAbandonment = SlaEngine.updateBuilderReputation(afterBreach, "abandonment");
    expect(afterAbandonment.score).toBe(45);
    expect(afterAbandonment.eligibleTier).toBe(TrustTier.Expedient);

    // 3. Gap Resolved (+5) -> Score 50 -> Expedient tier
    const afterResolution = SlaEngine.updateBuilderReputation(afterAbandonment, "gap_resolved");
    expect(afterResolution.score).toBe(50);

    // 4. Multiple successful jobs (+ streak bonus: +2 per job when streak >= 5)
    let current = afterResolution;
    for (let i = 0; i < 25; i++) {
      current = SlaEngine.updateBuilderReputation(current, "job_completed");
    }
    expect(current.score).toBeGreaterThanOrEqual(90);
    expect(current.eligibleTier).toBe(TrustTier.Strict);
  });

  it("should auto-resolve gap card and update builder reputation score", () => {
    const gapCard: GapCard = {
      id: "GC-2026-999",
      context: "sla_remediation",
      type: "gap_card",
      parentJobId: "JC-2026-001",
      description: "Remediate SLA breach",
      deadlineIso: "2026-08-02T12:00:00Z",
      budgetSats: 60_000n,
      urgency: "high",
      labels: ["gap", "sla-breach"],
      trustTier: TrustTier.Managed,
      state: "auto_published",
      createdAtIso: "2026-08-01T12:00:00Z",
    };

    const initialReputation: BuilderReputationRecord = {
      builderId: "did:conxian:hero-builder",
      score: 65,
      slaBreachCount: 1,
      abandonmentCount: 0,
      gapCardsResolved: 0,
      qualityDisputeCount: 0,
      consecutiveCompletions: 0,
      eligibleTier: TrustTier.Expedient,
      status: "active",
    };

    const resolutionResult = engine.autoResolveGapCard({
      gapCard,
      resolvingBuilderId: "did:conxian:hero-builder",
      proofHash: "0xproof_hash_1234567890abcdef",
      currentReputation: initialReputation,
      currentTimeIso: "2026-08-01T14:00:00Z",
    });

    expect(resolutionResult.status).toBe("resolved");
    expect(resolutionResult.gapCardId).toBe("GC-2026-999");
    expect(resolutionResult.payoutSats).toBe(60_000n);
    expect(resolutionResult.resolvingBuilderId).toBe("did:conxian:hero-builder");
    expect(resolutionResult.reputationDelta).toBe(5);
    expect(resolutionResult.updatedReputation?.score).toBe(70);
    expect(resolutionResult.updatedReputation?.eligibleTier).toBe(TrustTier.Managed);
    expect(gapCard.state).toBe("resolved");
  });

  it("should evaluate builder reputation recovery trajectory", () => {
    const initialReputation: BuilderReputationRecord = {
      builderId: "did:conxian:recovering-builder",
      score: 80,
      slaBreachCount: 1,
      abandonmentCount: 0,
      gapCardsResolved: 1,
      qualityDisputeCount: 0,
      consecutiveCompletions: 4,
      eligibleTier: TrustTier.Managed,
      status: "active",
    };

    const recovered = engine.evaluateReputationRecovery(initialReputation, 3);
    // Initial streak = 4 -> job 1 makes streak 5 (+2 bonus) -> score 82
    // job 2 makes streak 6 (+2 bonus) -> score 84
    // job 3 makes streak 7 (+2 bonus) -> score 86
    expect(recovered.score).toBe(86);
    expect(recovered.consecutiveCompletions).toBe(7);
  });
});
