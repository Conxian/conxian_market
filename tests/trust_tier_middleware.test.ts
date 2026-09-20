import { describe, expect, it } from "vitest";
import { TrustTier, SettlementRail, DEFAULT_FEATURE_FLAGS } from "../src/core_types";
import { TrustTierMiddleware } from "../src/trust_tier_middleware";

describe("TrustTierMiddleware", () => {
  const middleware = new TrustTierMiddleware(DEFAULT_FEATURE_FLAGS);

  it("evaluates ObserverOnly tier when no headers are provided", () => {
    const result = middleware.executePipeline({
      headers: {},
      amountSat: 100_000n,
    });

    expect(result.detectedTier).toBe(TrustTier.ObserverOnly);
    expect(result.effectiveTier).toBe(TrustTier.ObserverOnly);
    expect(result.isDegradedForP0).toBe(false);
    expect(result.fee.feeSat).toBe(0n);
    expect(result.selectedRail).toBeNull();
    expect(result.availableRails.length).toBe(0);
    expect(result.wireHeaders["x-conxian-tier"]).toBe("OBSERVER_ONLY");
  });

  it("evaluates Expedient tier for light client proofs", () => {
    const result = middleware.executePipeline({
      headers: {
        "x-conxian-light-proof": "spv_proof_data",
      },
      amountSat: 1_000_000n, // 1M sats
    });

    expect(result.detectedTier).toBe(TrustTier.Expedient);
    expect(result.effectiveTier).toBe(TrustTier.Expedient);
    expect(result.isDegradedForP0).toBe(false);

    // Protocol fee = 175 bps for Lightning rail (200 bps base - 25 bps discount) = 17,500 sats
    expect(result.fee.feeSat).toBe(17_500n);
    expect(result.fee.feeBps).toBe(175);

    // SLA Template guarantees
    expect(result.slaTemplate.guarantees.uptime).toBe("99%");
    expect(result.slaTemplate.autoBountyEnabled).toBe(false);

    // Default rail selection
    expect(result.selectedRail).toBe(SettlementRail.Lightning);
    expect(result.wireHeaders["x-conxian-rail"]).toBe("LIGHTNING");
  });

  it("degrades Managed tier to Expedient when attestation is disabled in feature flags", () => {
    const gatedMiddleware = new TrustTierMiddleware({
      ...DEFAULT_FEATURE_FLAGS,
      attestationAvailable: false,
    });

    const result = gatedMiddleware.executePipeline({
      headers: {
        "x-conxian-enclave-attestation": "attestation_jwt",
      },
      amountSat: 100_000n,
    });

    expect(result.detectedTier).toBe(TrustTier.Managed);
    expect(result.effectiveTier).toBe(TrustTier.Expedient);
    expect(result.isDegradedForP0).toBe(true);
    expect(result.wireHeaders["x-conxian-p0-degraded"]).toBe("true");
  });

  it("handles Strict tier when attestation is fully available", () => {
    const fullMiddleware = new TrustTierMiddleware({
      ...DEFAULT_FEATURE_FLAGS,
      attestationAvailable: true,
      statechainAvailable: true,
    });

    const result = fullMiddleware.executePipeline({
      headers: {
        "x-conxian-tee-proof": "nitro_quote",
        "x-conxian-zk-proof": "groth16_proof",
      },
      amountSat: 500_000n,
    });

    expect(result.detectedTier).toBe(TrustTier.Strict);
    expect(result.effectiveTier).toBe(TrustTier.Strict);
    expect(result.isDegradedForP0).toBe(false);
    expect(result.slaTemplate.guarantees.uptime).toBe("99.99%");
    expect(result.slaTemplate.autoBountyEnabled).toBe(true);
  });

  it("honors user preferred rail when eligible for effective tier", () => {
    const fullMiddleware = new TrustTierMiddleware({
      ...DEFAULT_FEATURE_FLAGS,
      attestationAvailable: true,
    });

    const result = fullMiddleware.executePipeline({
      headers: {
        "x-conxian-enclave-attestation": "attestation_jwt",
      },
      amountSat: 200_000n,
      preferredRail: SettlementRail.Rgb,
    });

    expect(result.effectiveTier).toBe(TrustTier.Managed);
    expect(result.selectedRail).toBe(SettlementRail.Rgb);
    expect(result.wireHeaders["x-conxian-rail"]).toBe("RGB");
  });

  it("formats wire headers correctly via static helper", () => {
    const result = middleware.executePipeline({
      headers: {
        "x-conxian-light-proof": "spv_proof_data",
      },
      amountSat: 100_000n,
    });

    const wire = TrustTierMiddleware.formatWireHeaders(result);
    expect(wire["x-conxian-tier"]).toBe("EXPEDIENT");
    expect(wire["x-conxian-fee-bps"]).toBe("175");
    expect(wire["x-conxian-fee-sat"]).toBe("1750");
    expect(wire["x-conxian-sla-tier"]).toBe("EXPEDIENT");
    expect(wire["x-conxian-p0-degraded"]).toBe("false");
  });
});

describe("TrustTierLifecycleEngine", () => {
  const middleware = new TrustTierMiddleware(DEFAULT_FEATURE_FLAGS);
  const fullMiddleware = new TrustTierMiddleware({
    ...DEFAULT_FEATURE_FLAGS,
    attestationAvailable: true,
  });

  it("evaluates tier upgrade request requirements per KB Section 6", () => {
    // 1. Rejection due to insufficient reputation
    const lowRepResult = middleware.evaluateTierUpgrade({
      currentTier: TrustTier.ObserverOnly,
      targetTier: TrustTier.Expedient,
      reputationScore: 30, // threshold is 40
    });
    expect(lowRepResult.status).toBe("INSUFFICIENT_REPUTATION");
    expect(lowRepResult.requiredReputation).toBe(40);
    expect(lowRepResult.newTier).toBe(TrustTier.ObserverOnly);

    // 2. Upgrade approval to Expedient with rep = 45
    const expResult = middleware.evaluateTierUpgrade({
      currentTier: TrustTier.ObserverOnly,
      targetTier: TrustTier.Expedient,
      reputationScore: 45,
    });
    expect(expResult.status).toBe("APPROVED");
    expect(expResult.newTier).toBe(TrustTier.Expedient);

    // 3. Rejection due to missing enclave attestation for Managed
    const missingEnclaveResult = middleware.evaluateTierUpgrade({
      currentTier: TrustTier.Expedient,
      targetTier: TrustTier.Managed,
      reputationScore: 75, // threshold is 70
      headers: {},
    });
    expect(missingEnclaveResult.status).toBe("MISSING_ATTESTATION");
    expect(missingEnclaveResult.newTier).toBe(TrustTier.Expedient);

    // 4. Upgrade approval to Managed with rep = 75 and enclave header (when attestationAvailable is true)
    const managedResult = fullMiddleware.evaluateTierUpgrade({
      currentTier: TrustTier.Expedient,
      targetTier: TrustTier.Managed,
      reputationScore: 75,
      headers: {
        "x-conxian-enclave-attestation": "valid_jwt_attestation",
      },
    });
    expect(managedResult.status).toBe("APPROVED");
    expect(managedResult.newTier).toBe(TrustTier.Managed);

    // 5. Upgrade approval with P0 degradation when default feature flags (attestationAvailable = false) are active
    const degradedManagedResult = middleware.evaluateTierUpgrade({
      currentTier: TrustTier.Expedient,
      targetTier: TrustTier.Managed,
      reputationScore: 75,
      headers: {
        "x-conxian-enclave-attestation": "valid_jwt_attestation",
      },
    });
    expect(degradedManagedResult.status).toBe("APPROVED");
    expect(degradedManagedResult.newTier).toBe(TrustTier.Expedient);

    // 6. Upgrade approval to Strict with rep = 95 and TEE + ZK proofs
    const strictResult = fullMiddleware.evaluateTierUpgrade({
      currentTier: TrustTier.Managed,
      targetTier: TrustTier.Strict,
      reputationScore: 95,
      headers: {
        "x-conxian-tee-proof": "nitro_quote_data",
        "x-conxian-zk-proof": "groth16_proof_data",
      },
    });
    expect(strictResult.status).toBe("APPROVED");
    expect(strictResult.newTier).toBe(TrustTier.Strict);
  });

  it("evaluates tier downgrade triggers for consecutive breaches and P0 gaps", () => {
    // 2 consecutive breaches downgrades Strict to Managed
    const downgrade2Breaches = middleware.evaluateTierDowngrade({
      currentTier: TrustTier.Strict,
      consecutiveBreaches: 2,
    });
    expect(downgrade2Breaches.downgraded).toBe(true);
    expect(downgrade2Breaches.newTier).toBe(TrustTier.Managed);

    // 3 consecutive breaches downgrades to ObserverOnly
    const downgrade3Breaches = middleware.evaluateTierDowngrade({
      currentTier: TrustTier.Managed,
      consecutiveBreaches: 3,
    });
    expect(downgrade3Breaches.downgraded).toBe(true);
    expect(downgrade3Breaches.newTier).toBe(TrustTier.ObserverOnly);

    // Active P0 gap degrades Strict tier
    const p0Middleware = new TrustTierMiddleware({
      ...DEFAULT_FEATURE_FLAGS,
      attestationAvailable: false,
    });
    const p0Downgrade = p0Middleware.evaluateTierDowngrade({
      currentTier: TrustTier.Strict,
      consecutiveBreaches: 0,
      hasActiveP0Gap: true,
    });
    expect(p0Downgrade.downgraded).toBe(true);
    expect(p0Downgrade.newTier).toBe(TrustTier.Expedient);
  });
});
