# Conxian Market: TrustTier Pricing Middleware

> **Status:** Active | **Version:** 1.0 | **Last Updated:** 2026-08-01 (Session 48)
> **Purpose:** Tier detection, fee middleware, and SLA templates for 4-tier pricing model.
>
> **Implementation:** `src/trust_tier_middleware.ts` (`TrustTierMiddleware`,
> `TrustTierLifecycleEngine`), `src/fee_calculator.ts` (`detectTrustTier`,
> `calculateRailFee`), surfaced as `sdk.runTrustTierPipeline()` and
> `sdk.detectTrustTier()`. The `src/middleware/trust-tier.ts` path in the snippets
> is illustrative, not a file in this repository.

---

## 1. Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                  PRICING MIDDLEWARE PIPELINE                      │
│                                                                    │
│  Settlement Request                                               │
│       │                                                           │
│       ▼                                                           │
│  ┌────────────────┐                                               │
│  │ Tier Detector   │  Read attestation / API key / none           │
│  └───────┬────────┘                                               │
│          │                                                        │
│          ▼                                                        │
│  ┌────────────────┐                                               │
│  │ Fee Calculator  │  Apply tier-based fee schedule               │
│  └───────┬────────┘                                               │
│          │                                                        │
│          ▼                                                        │
│  ┌────────────────┐                                               │
│  │ SLA Enforcer    │  Select SLA template for tier                │
│  └───────┬────────┘                                               │
│          │                                                        │
│          ▼                                                        │
│  ┌────────────────┐                                               │
│  │ Rail Router     │  Select settlement rail for tier             │
│  └───────┬────────┘                                               │
│          │                                                        │
│          ▼                                                        │
│  Execute Settlement                                               │
└──────────────────────────────────────────────────────────────────┘
```

## 2. Tier Detection

### 2.1 Detection Sources

```rust
/// How the system determines a client's TrustTier.
enum TierDetectionSource {
    /// TEE attestation verified + ZK proof validated (AWS Nitro, Intel SGX)
    TeeAttestation {
        certificate: AttestationCertificate,
        zk_proof: Option<Vec<u8>>,
    },
    /// Enclave SDK attestation without ZK proof
    EnclaveAttestation {
        certificate: AttestationCertificate,
    },
    /// Light client proof (SPV, MMR)
    LightClientProof {
        proof_height: u64,
        proof_hash: [u8; 32],
    },
    /// No verification — anonymous/free tier
    Unauthenticated,
}
```

### 2.2 Detection Flow

```
Request → Has TEE attestation + ZK proof?
              ├── YES → Strict tier
              └── NO → Has enclave attestation?
                           ├── YES → Managed tier
                           └── NO → Has light client proof?
                                        ├── YES → Expedient tier
                                        └── NO → ObserverOnly tier
```

### 2.3 Implementation

```typescript
// Platform middleware: src/middleware/trust-tier.ts
async function detectTrustTier(req: SettlementRequest): Promise<TrustTier> {
  // 1. Check for TEE attestation header
  const teeProof = req.headers['x-conxian-tee-proof'];
  const zkProof = req.headers['x-conxian-zk-proof'];
  if (teeProof && zkProof) {
    const valid = await verifyTeeZkProof(teeProof, zkProof);
    if (valid) return TrustTier.Strict;
  }

  // 2. Check for enclave attestation
  const enclaveProof = req.headers['x-conxian-enclave-attestation'];
  if (enclaveProof) {
    const valid = await verifyEnclaveAttestation(enclaveProof);
    if (valid) return TrustTier.Managed;
  }

  // 3. Check for light client proof
  const lightProof = req.headers['x-conxian-light-proof'];
  if (lightProof) {
    const valid = await verifyLightClientProof(lightProof);
    if (valid) return TrustTier.Expedient;
  }

  // 4. Default: unauthenticated browsing
  return TrustTier.ObserverOnly;
}
```

## 3. Fee Schedule

### 3.1 Tier-Based Pricing

The fee **rate** is the ADR-005 dynamic model (`src/fee_calculator.ts`): a single
volume-decay percentage (0.50%→0.10%) composed with a per-rail flat floor. The
trust tier governs rail availability; the Managed premium is proposed but not
wired (`attestationAvailable === false`).

| Tier | Verification | Protocol Fee | Premium | Settlement Rails |
|:----:|:------------|:------------:|:-------:|-----------------|
| **Strict** | TEE + ZK | Negotiated | Negotiated | All rails |
| **Managed** | Enclave attestation | ADR-005 dynamic | +0.5% (proposed, inactive) | All rails |
| **Expedient** | Light client | ADR-005 dynamic | — | ALEX, EVM, Fedimint, Lightning |
| **ObserverOnly** | None | Settlement disabled | — | None (discovery only) |

### 3.2 Fee Split

The collected fee (whatever the dynamic model returns) splits:

| Tier | Ops (50%) | Founders (30%) | Ecosystem (20%) | Premium Destination |
|------|:---------:|:--------------:|:---------------:|--------------------|
| Strict | 50% | 30% | 20% | Premium → SAB treasury |
| Managed | 50% | 30% | 20% | +0.5% → SAB treasury (if enabled) |
| Expedient | 50% | 30% | 20% | — |
| ObserverOnly | — | — | — | — |

### 3.3 Fee Calculation

The canonical model is `calculateDynamicFee` in `src/fee_calculator.ts` — use it
directly; do not re-derive a flat rate.

```typescript
// Canonical: single volume-decay percentage + per-rail flat floor.
import { calculateDynamicFee } from "./fee_calculator";

const fee = calculateDynamicFee({
  tier,                    // TrustTier (ObserverOnly throws)
  rail,                    // SettlementRail
  amountSat,
  volumeDecayTier: "TIER_1", // 0.50% launch rate
});
// fee.effectiveFeeSat  = max(amount × decayed_bps/10000, rail_floor) × load_factor
// fee.distribution     = { operationsSat: 50%, foundersSat: 30%, ecosystemSat: 20% }
```

## 4. Rail Selection by Tier

### 4.1 Routing Table

```typescript
const RAIL_ROUTING: Record<TrustTier, SettlementRail[]> = {
  [TrustTier.Strict]: [
    SettlementRail.EnclaveAttested,
    SettlementRail.Statechain,
    SettlementRail.SBTC,
    SettlementRail.RGB,
    SettlementRail.Babylon,
    SettlementRail.Lightning,
    SettlementRail.Fedimint,
    SettlementRail.ALEX,
    SettlementRail.EVM,
  ],
  [TrustTier.Managed]: [
    SettlementRail.Statechain,
    SettlementRail.SBTC,
    SettlementRail.RGB,
    SettlementRail.Babylon,
    SettlementRail.Lightning,
    SettlementRail.Fedimint,
    SettlementRail.ALEX,
    SettlementRail.EVM,
  ],
  [TrustTier.Expedient]: [
    SettlementRail.Lightning,
    SettlementRail.Fedimint,
    SettlementRail.ALEX,
    SettlementRail.EVM,
  ],
  [TrustTier.ObserverOnly]: [], // No settlement — discovery only
};
```

### 4.2 Rail Preference (Auto-Selection)

When multiple rails available, select by:
1. **Cost** → Lowest total fee for amount
2. **Speed** → Fastest finality for amount
3. **Privacy** → Client preference (if set)

```typescript
function selectRail(amount: bigint, tier: TrustTier, preference?: 'cost' | 'speed' | 'privacy'): SettlementRail {
  const available = RAIL_ROUTING[tier];
  if (available.length === 0) throw new Error('No rails available for this tier');

  switch (preference) {
    case 'cost':
      return cheapestRail(available, amount);
    case 'speed':
      return fastestRail(available);
    case 'privacy':
      return mostPrivateRail(available);
    default:
      return cheapestRail(available, amount); // Default: cost-optimize
  }
}
```

## 5. SLA Templates by Tier

### 5.1 Template Matrix

| SLA Parameter | Strict | Managed | Expedient | ObserverOnly |
|---------------|:------:|:-------:|:---------:|:------------:|
| Uptime guarantee | 99.99% | 99.9% | 99% | — |
| Max latency (P95) | 100ms | 500ms | 2s | — |
| Proof of execution | ZK + TEE | Enclave attestation | Light client | — |
| Dispute resolution | 1h | 4h | 24h | — |
| Penalty for breach | 100% refund + 50% penalty | 100% refund | 50% refund | — |
| Auto-bounty (gap cards) | ✅ | ✅ | Manual | ❌ |
| Support response | 15 min | 1h | 24h | Best effort |

### 5.2 SLA Template: Strict (Institutional)

```yaml
sla_template:
  tier: Strict
  guarantees:
    uptime: "99.99%"
    latency_p95: "100ms"
    proof: "ZK + TEE attestation"
    dispute_resolution: "1 hour"
  penalties:
    breach: "100% refund + 50% penalty"
    consecutive_breaches: "Contract termination + full refund"
  monitoring:
    heartbeat: "10s"
    proof_validation: "every transaction"
  auto_bounty: true
```

### 5.3 SLA Template: Expedient (Standard)

```yaml
sla_template:
  tier: Expedient
  guarantees:
    uptime: "99%"
    latency_p95: "2s"
    proof: "Light client verification"
    dispute_resolution: "24 hours"
  penalties:
    breach: "50% refund"
    consecutive_breaches: "Tier downgrade to ObserverOnly"
  monitoring:
    heartbeat: "60s"
    proof_validation: "batch (hourly)"
  auto_bounty: false  # Manual approval required
```

## 6. Tier Upgrade Path

```
ObserverOnly ──▶ Expedient ──▶ Managed ──▶ Strict
    │                │            │           │
    │  Enroll in     │  Pass      │  Deploy   │  Complete
    │  reputation    │  light     │  enclave  │  TEE + ZK
    │  system        │  client    │  SDK      │  audit
    │                │  check     │           │
    ▼                ▼            ▼           ▼
  Free tier      Basic API    Enclave key  Hardware
  browsing       key issued   provisioned  attestation
```

### 6.1 Upgrade Requirements

| Upgrade | Requirements | Verification | Cost |
|---------|-------------|:------------:|:----:|
| ObsOnly → Expedient | Reputation ≥ 40, API key registration | Automated | Free |
| Expedient → Managed | Reputation ≥ 70, enclave SDK deployment | Enclave attestation check | Enclave provisioning |
| Managed → Strict | Reputation ≥ 90, TEE + ZK audit passed | Third-party audit | Audit fee (variable) |

---

## 7. Revenue Projections by Tier Mix

| Tier Mix Scenario | Expedient % | Managed % | Strict % | Monthly Revenue (@$1M vol) |
|-------------------|:-----------:|:---------:|:--------:|:--------------------------:|
| Launch (current) | 90% | 9% | 1% | $20,450 |
| Growth (6 mo) | 70% | 25% | 5% | $21,750 |
| Mature (12 mo) | 50% | 40% | 10% | $23,500 |
| Institutional (24 mo) | 30% | 50% | 20% | $25,000+ |

---

*Pricing is the bridge between infrastructure and revenue. Every tier must earn its margin.*
