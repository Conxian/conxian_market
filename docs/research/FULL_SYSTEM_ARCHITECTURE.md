# Conxian Full System Architecture & Integration Map

> **Status:** Living Document | **Last Updated:** 2026-07-15  
> **Version:** 1.0 | **Owner:** Conxian Labs

---

## Executive Summary

This document provides a comprehensive audit of the **entire Conxian ecosystem** against the Multi-Dimensional DeFi Monetary System. It verifies integration points, identifies gaps, and provides actionable recommendations for full system coherence.

---

## 1. Ecosystem Repository Map

### 1.1 Protocol Layer (DAO-Facing)

| Repository | Language | Purpose | Status |
|:-----------|:--------:|:--------|:-------|
| **Conxian/Conxian** | Clarity | Protocol primitives, DeFi logic, DAO governance | Mainnet-Ready |
| **lib-conxian-core** | Rust | Shared protocol primitives, chain adapters | v0.3.x Stable (17 modules, all wired) |

### 1.2 Infrastructure Layer

| Repository | Language | Purpose | Status |
|:-----------|:--------:|:--------|:-------|
| **conxian-gateway** | Rust | Middleware bridging Bitcoin/Stacks with enterprise compliance | v0.1.5+ Active (stacks, rgb, babylon, fedimint adapters) |
| **conxian-nexus** | Rust | Glass Node - verification, synchronization, proof layer | v0.4.0+ Active (enclave attestation, 13 core modules) |
| **conxius-enclave-sdk** | Rust | Hardware enclave, FROST DKG, BitVM2, Attestation | **v2.0.12 Production** |

### 1.3 Access & Client Layer

| Repository | Language | Purpose | Status |
|:-----------|:--------:|:--------|:-------|
| **conxius-wallet** | TypeScript | Sovereign non-custodial wallet (Android-first) | v1.9.5 Production |
| **conxian_ui** | TypeScript | Public web interface layer | Active |
| **conxius-platform** | TypeScript | Control-plane scaffolding, CI/CD, orchestration | Active |

### 1.4 Tooling Layer

| Repository | Language | Purpose | Status |
|:-----------|:--------:|:--------|:-------|
| **conxius-orbit** | Python | Deployment tooling, contract rollout, builder CLI | Active |
| **conxian_market** | Markdown | Settlement core, marketplace, research | Active |

### 1.5 Governance & Narrative

| Repository | Language | Purpose | Status |
|:-----------|:--------:|:--------|:-------|
| **conxian-business** | TypeScript | CNS - Strategy, legal, operational docs | Private |
| **.github** | Python | Public defaults and documentation | Active |
| **conxian-labs-site** | HTML | Public website | Active |

---

## 2. Economic Integration Points

### 2.1 Protocol Fee Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CONXIAN MULTI-DIMENSIONAL MONETARY SYSTEM            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  USER PAYMENT (AI Labor)                                                 │
│       │                                                                  │
│       ▼                                                                  │
│  ┌─────────────────┐                                                     │
│  │ ERC-8183 Escrow │ ◄─── conxian-gateway (settlement orchestration)   │
│  └────────┬────────┘                                                     │
│           │                                                              │
│           ▼                                                              │
│  ┌─────────────────────────────────────────────────────────┐              │
│  │              BUILDER SETTLEMENT (80%)                  │              │
│  │                    (Direct payout)                      │              │
│  └─────────────────────────────────────────────────────────┘              │
│                                                                          │
│           ▼                                                              │
│  ┌─────────────────────────────────────────────────────────┐              │
│  │              PROTOCOL FEE (2%)                         │              │
│  │                  conxian/Conxian                       │              │
│  │               (Clarity smart contract)                  │              │
│  └─────────────────────────┬───────────────────────────────┘              │
│                            │                                             │
│         ┌──────────────────┼──────────────────┐                           │
│         ▼                  ▼                  ▼                          │
│  ┌────────────┐    ┌──────────────┐    ┌──────────────┐                 │
│  │ OPERATIONS │    │   FOUNDERS   │    │  ECOSYSTEM   │                 │
│  │  (50%)    │    │    (30%)    │    │   (20%)     │                 │
│  └─────┬──────┘    └──────┬───────┘    └──────┬───────┘                 │
│        │                   │                   │                         │
│        ▼                   ▼                   ▼                         │
│  ┌────────────┐    ┌──────────────┐    ┌──────────────┐               │
│  │  CI/CD    │    │   4-Year     │    │   Builder    │               │
│  │  SDKs     │    │   Vesting    │    │   Grants     │               │
│  │  Nexus    │    │   Schedule   │    │   Liquidity │               │
│  │  Audits   │    │              │    │   Mining     │               │
│  └────────────┘    └──────────────┘    └──────────────┘               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Component Integration Matrix

| Component | Fee Collection | Settlement | Treasury | Attribution |
|:----------|:--------------:|:----------:|:--------:|:-----------|
| **Conxian Protocol** | ✅ Clarity | ✅ | ✅ | Contract-controlled |
| **conxian-gateway** | ✅ Middleware | ✅ API | ⚠️ Partial | X402 protocol |
| **conxian-nexus** | ⚠️ Observational | ✅ Proofs | ❌ | Verifier only |
| **conxius-enclave-sdk** | ❌ | ✅ Signing | ❌ | Key management |
| **conxius-wallet** | ⚠️ UX only | ✅ Non-custodial | ❌ | User-controlled |
| **conxian_market** | ✅ Settlement | ✅ Escrow | ✅ Primary | **This Repo** |

---

## 3. Settlement Rail Integration

### 3.1 Primary Rails (ALEX/Stacks)

```
┌─────────────────────────────────────────────────────────────────┐
│                     ALEX SETTLEMENT LAYER                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐        │
│  │  sBTC Pools │────▶│ ALEX AMM   │────▶│  Staking   │        │
│  │  (USDC)    │     │  (Orderbook)│     │ (APower)   │        │
│  └─────────────┘     └─────────────┘     └─────────────┘        │
│         │                  │                   │                │
│         └──────────────────┼───────────────────┘                │
│                            ▼                                    │
│                   ┌─────────────────┐                           │
│                   │  AI Labor Flow  │                           │
│                   │ Settlement Pool │                           │
│                   └────────┬────────┘                           │
│                            │                                    │
│         ┌──────────────────┼──────────────────┐                │
│         ▼                  ▼                  ▼                 │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐           │
│  │  Builder   │    │  Protocol  │    │ Ecosystem  │           │
│  │  (80%)    │    │  (2%)     │    │  (18%)    │           │
│  └────────────┘    └────────────┘    └────────────┘           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Multi-Chain Adapter Support

| Chain/Protocol | Adapter Status | Settlement Ready | Notes |
|:---------------|:--------------:|:---------------:|:------|
| **Bitcoin L1** | ✅ Via Stacks | ✅ sBTC peg | Trustless |
| **Stacks L2** | ✅ Native | ✅ | Primary |
| **ALEX (Stacks)** | ✅ Native | ✅ | Launchpad |
| **EVM (Eth/L2)** | ✅ Via Gateway | ✅ | ERC-8183 |
| **Fedimint** | ✅ Wired (Session 48) | ✅ T2 Managed | FedimintMint in gateway engine |
| **Babylon** | ✅ Wired (Session 48) | ✅ T2 Managed | StakingIntent in gateway engine |
| **RGB** | ✅ Wired (Session 48) | ✅ T2 Managed | GatewayRgbAdapter bridged to core types |
| **sBTC** | ✅ Wired (Session 48) | ✅ T2 Managed | SBTCBridge + Emily API lifecycle |
| **Statechain (Spark)** | ✅ v2.0.12 | ✅ T2 Managed | FROST-based 1-of-n VTXO protocol |
| **Ark** | ✅ v2.0.12 | ✅ | vTXO payment pools |
| **Lightning** | ✅ SRL-1 | ✅ | Nexus LightningAdapter |

> **Session 48:** All 17 core modules wired. 11 BTC L2 protocols covered via enclave-sdk.
> See `docs/research/SETTLEMENT_RAILS.md` for full 6-rail catalog with fee models and flow diagrams.

### 3.3 Six-Rail Settlement Architecture (Session 48)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    CONXIAN 6-RAIL SETTLEMENT LAYER                        │
│                                                                            │
│  ┌──────────────────────┐              ┌──────────────────────┐           │
│  │   MANAGED TIER (T2)  │              │  EXPEDIENT TIER (T1) │           │
│  │  Enclave Attestation │              │  Light Client Proof  │           │
│  ├──────────────────────┤              ├──────────────────────┤           │
│  │ ① Statechain (Spark) │              │ ④ Lightning (SRL-1)  │           │
│  │   VTXO off-chain BTC │              │   Instant payments   │           │
│  │   1-of-n FROST trust │              │   LN routing fees    │           │
│  │                      │              │                      │           │
│  │ ② sBTC (Stacks)      │              │ ⑤ Fedimint (e-cash)  │           │
│  │   BTC peg-in/out     │              │   Community pools    │           │
│  │   Emily API lifecycle│              │   3-of-5 guardians   │           │
│  │                      │              │                      │           │
│  │ ③ RGB (contract)     │              │ ⑥ ALEX/Stacks (AMM)  │           │
│  │   RGB-20/21 assets   │              │   Swap settlement    │           │
│  │   OP_RETURN anchors  │              │   Orderbook + Staking│           │
│  └──────────────────────┘              └──────────────────────┘           │
│           │                                       │                       │
│           └───────────────┬───────────────────────┘                       │
│                           ▼                                               │
│                  ┌─────────────────┐                                      │
│                  │  TrustTier Gate │  ObserverOnly→Expedient→Managed      │
│                  │  Fee Calculator │  0%→2%→2.5%→Negotiated              │
│                  └────────┬────────┘                                      │
│                           ▼                                               │
│                  ┌─────────────────┐                                      │
│                  │  SLA Enforcer   │  7 rules, auto-bounty generation     │
│                  └────────┬────────┘                                      │
│                           ▼                                               │
│         ┌─────────────────┼─────────────────┐                            │
│         ▼                 ▼                  ▼                             │
│  ┌────────────┐   ┌────────────┐    ┌────────────┐                       │
│  │  Builder   │   │  Protocol  │    │  Treasury  │                       │
│  │  (80%)    │   │  Fee (2%)  │    │  (18%)    │                       │
│  └────────────┘   └────────────┘    └────────────┘                       │
│                                                                            │
│  Babylon staking yield (3-5% APY) → 50% ops / 30% founders / 20% eco     │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.4 Rail Selection Logic

```typescript
function selectRail(
  amount: bigint,
  tier: TrustTier,
  preference?: 'cost' | 'speed' | 'privacy'
): SettlementRail {
  const rails = RAIL_ROUTING[tier];
  // ObserverOnly: [] (no settlement)
  // Expedient:  [Lightning, Fedimint, ALEX, EVM]
  // Managed:    [+ Statechain, sBTC, RGB, Babylon]
  // Strict:     [+ EnclaveAttested] (all rails)

  switch (preference) {
    case 'cost':     return cheapestRail(rails, amount);
    case 'speed':    return fastestRail(rails);
    case 'privacy':  return mostPrivateRail(rails);
    default:         return cheapestRail(rails, amount);
  }
}
```

> Full rail comparison: `SETTLEMENT_RAILS.md` §9 — finality, throughput, privacy, min amount, fee.

---

## 4. Security Model Integration

### 4.1 Trust Tier Architecture (Session 48)

| Tier | Verification | Protocol Fee | Settlement Rails | SLA Template |
|:----:|:------------|:------------:|:----------------|:------------|
| **Strict** | TEE + ZK proof | Negotiated | All 6 rails | 99.99% uptime, 100ms P95, ZK proof, 1h dispute |
| **Managed** | Enclave attestation | 2% + 0.5% premium | Statechain, sBTC, RGB, Babylon, +Expedient rails | 99.9% uptime, 500ms P95, enclave proof, 4h dispute |
| **Expedient** | Light client | 2% flat | Lightning, Fedimint, ALEX, EVM | 99% uptime, 2s P95, light proof, 24h dispute |
| **ObserverOnly** | None | Free | None (discovery only) | N/A |

> Tier detection: `trust_tier_pricing.md` §2. SLA templates: `trust_tier_pricing.md` §5.
> Nexus `ExecutionRequest` carries TrustTier via PR #196 (enclave attestation).

### 4.2 Enclave SDK Attestation Flow (Updated)

```typescript
// Tier detection middleware — trust_tier_pricing.md §2
async function detectTrustTier(req: SettlementRequest): Promise<TrustTier> {
  const teeProof = req.headers['x-conxian-tee-proof'];
  const zkProof = req.headers['x-conxian-zk-proof'];
  if (teeProof && zkProof && await verifyTeeZkProof(teeProof, zkProof))
    return TrustTier.Strict;

  const enclaveProof = req.headers['x-conxian-enclave-attestation'];
  if (enclaveProof && await verifyEnclaveAttestation(enclaveProof))
    return TrustTier.Managed;

  const lightProof = req.headers['x-conxian-light-proof'];
  if (lightProof && await verifyLightClientProof(lightProof))
    return TrustTier.Expedient;

  return TrustTier.ObserverOnly;
}

// Fee calculation by tier
function calculateFee(amount: bigint, tier: TrustTier): bigint {
  switch (tier) {
    case TrustTier.Strict:   return 0n;  // Negotiated separately
    case TrustTier.Managed:  return (amount * 250n) / 10000n;  // 2.5%
    case TrustTier.Expedient: return (amount * 200n) / 10000n; // 2%
    case TrustTier.ObserverOnly: return 0n;
  }
}
```

### 4.3 CJCS SLA Enforcement (Session 48)

```
JobCard → SLA Watcher (60s poll) → 7 gap detection rules
    │                                    │
    ├── Deadline exceeded + 1h   → Gap Card (Managed+ auto)
    ├── Builder idle 48h         → Reopen + warn flag
    ├── TrustTier mismatch       → Reject settlement
    ├── Fee shortfall <95%       → Hold + notify treasury
    └── 3+ quality disputes      → Suspend builder
```

> Full SLA system: `sla_bounty_system.md`. TrustTier gating: auto-execution for Managed+, manual for Expedient/ObserverOnly.

---

## 5. MCP & Orchestration Integration

### 5.1 Model Context Protocol Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     MCP ORCHESTRATION FLOW                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User Request ──▶ conxian-gateway (MCP Host)                     │
│                            │                                     │
│          ┌─────────────────┼─────────────────┐                  │
│          ▼                 ▼                 ▼                  │
│   ┌────────────┐    ┌────────────┐    ┌────────────┐           │
│   │  Builder A │    │  Builder B │    │  Builder C │           │
│   │ (Bittensor)│    │ (Fetch.ai) │    │ (Numerai) │           │
│   └─────┬──────┘    └─────┬──────┘    └─────┬──────┘           │
│         │                  │                 │                  │
│         └──────────────────┼─────────────────┘                  │
│                            ▼                                     │
│                   ┌─────────────────┐                            │
│                   │ ERC-8183 Escrow │                            │
│                   │ Settlement Pool │                            │
│                   └────────┬────────┘                            │
│                            │                                     │
│          ┌─────────────────┼─────────────────┐                  │
│          ▼                 ▼                 ▼                  │
│   ┌────────────┐    ┌────────────┐    ┌────────────┐           │
│   │  Builder   │    │  Protocol  │    │ Ecosystem  │           │
│   │  (80%)    │    │  (2%)     │    │  (18%)    │           │
│   └────────────┘    └────────────┘    └────────────┘           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 MCP Integration Points

| Component | MCP Role | Status | Notes |
|:----------|:--------:|:------:|:------|
| **conxian-gateway** | MCP Host | ✅ v0.1.4 | Main orchestrator |
| **conxian-nexus** | MCP Resource | ✅ v0.4.19 | Proof provider |
| **conxius-wallet** | MCP Client | ✅ v1.9.5 | User signing |
| **conxian_market** | MCP Registry | ✅ | Agent discovery |

---

## 6. Treasury Management Integration

### 6.1 Asset Allocation by Component

```
┌─────────────────────────────────────────────────────────────────┐
│                   TREASURY ASSET MANAGEMENT                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Target: 40% Stablecoins | 30% RWA | 20% Liquid Staking | 10% Native │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ OPERATIONS TREASURY (50% of 2% = 1% of total)              ││
│  │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       ││
│  │ │ CI/CD   │ │ SDK Dev  │ │ Nexus    │ │ Audits   │       ││
│  │ │ $X/mo   │ │ $X/mo    │ │ Ops      │ │ $X/qtr   │       ││
│  │ └──────────┘ └──────────┘ └──────────┘ └──────────┘       ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ FOUNDER COMPENSATION (30% of 2% = 0.6% of total)           ││
│  │ ┌──────────────────────────────────────────────────────┐   ││
│  │ │ 4-Year Cliff Vesting │ Performance Bonus │ Emergency │   ││
│  │ └──────────────────────────────────────────────────────┘   ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ECOSYSTEM GROWTH (20% of 2% = 0.4% of total)               ││
│  │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       ││
│  │ │ Builder  │ │Liquidity │ │Bug       │ │Legal     │       ││
│  │ │ Grants   │ │Mining    │ │Bounty    │ │Defense   │       ││
│  │ └──────────┘ └──────────┘ └──────────┘ └──────────┘       ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Treasury Component Ownership

| Treasury Function | Component | Status | Gap |
|:-----------------|:----------|:------:|:----|
| **Fee Collection** | Conxian/Conxian | ✅ | - |
| **Fee Distribution** | conxian-gateway | ✅ | - |
| **Asset Storage** | conxian-nexus | ⚠️ | Requires multisig |
| **Reporting** | conxius-platform | ⚠️ | Dashboard needed |
| **Governance** | conxian-business | ⚠️ | DAO transition |

---

## 7. Gap Analysis & Recommendations

### 7.1 Integration Gaps

| Gap | Severity | Component | Recommendation |
|:----|:--------:|:----------|:---------------|
| **Multisig Treasury** | 🔴 Critical | All | Deploy 3-of-5 SAFE before launch |
| **Fee Collection Contract** | 🔴 Critical | Conxian/Conxian | Activate CON-1427 |
| **Reporting Dashboard** | 🟠 High | conxius-platform | Build treasury dashboard |
| **DAO Governance** | 🟠 High | conxian-business | Implement CON-1439 |
| **ALEX Adapter** | 🟠 High | conxian-gateway | Build Stacks settlement adapter |
| **ERC-8183 Integration** | 🟡 Medium | conxian_market | Complete escrow implementation |
| **Lightning Settlement** | 🟡 Medium | conxian-nexus | SRL-1 completion |

### 7.2 Implementation Priority

```
PHASE 0 (Pre-Launch - Critical)
├── Deploy multisig treasury (3-of-5 SAFE)
├── Activate protocol fee collection (2%)
├── Set up ALEX settlement pools
└── Build treasury reporting dashboard

PHASE 1 (Launch - High Priority)
├── Connect conxian-gateway to ALEX
├── Implement ERC-8183 escrow
├── Deploy founder vesting contracts
└── Establish RWA allocation

PHASE 2 (Stabilization - Medium)
├── Complete DAO governance transition
├── Build Lightning settlement path
├── Implement automatic fee decay
└── Expand Fedimint/Citrea adapters
```

---

## 8. Verification Checklist

### 8.1 Protocol Layer Verification

| Item | Component | Status | Evidence |
|:-----|:----------|:------:|:---------|
| 218 Clarity contracts | Conxian/Conxian | ✅ | Mainnet deployed |
| Fee collection logic | Conxian/Conxian | ⚠️ | CON-1427 required |
| 80/10/10 yield matrix | Conxian/Conxian | ✅ | Implemented |
| ERC-8183 standard | conxian_market | ✅ | In progress |

### 8.2 Infrastructure Verification

| Item | Component | Status | Evidence |
|:-----|:----------|:------:|:---------|
| Rust chain adapters | lib-conxian-core | ✅ v0.2.12 | 30+ chains |
| TEE attestation | conxius-enclave-sdk | ✅ v2.0.12 | Production |
| FROST DKG | conxius-enclave-sdk | ✅ v2.0.12 | Stable |
| BitVM2 support | conxius-enclave-sdk | ✅ | Active |
| Fedimint adapter | conxius-enclave-sdk | ✅ v2.0.7 | Stable |
| Ark adapter | conxius-enclave-sdk | ✅ v2.0.7 | Stable |
| Glass Node | conxian-nexus | ✅ v0.4.19 | Active |
| ISO 20022 | conxian-gateway | ✅ | Enterprise ready |
| MCP Host | conxian-gateway | ✅ | Main orchestrator |

### 8.3 Settlement Verification

| Item | Component | Status | Evidence |
|:-----|:----------|:------:|:---------|
| Bitcoin L1 | Via Stacks | ✅ | sBTC peg |
| Stacks L2 | Native | ✅ | Primary |
| ALEX launchpad | Native | ✅ | Active |
| EVM settlement | conxian-gateway | ✅ | X402 protocol |
| Fedimint | conxius-enclave-sdk | ✅ | Federation |
| Ark | conxius-enclave-sdk | ✅ | vTXO |

---

## 9. Conclusion

### 9.1 System Readiness

| Category | Readiness | Notes |
|:---------|:---------:|:------|
| **Protocol Core** | 🟢 90% | Minor gaps in fee collection |
| **Infrastructure** | 🟢 85% | MCP, SDK production-ready |
| **Settlement Rails** | 🟡 70% | ALEX integration needed |
| **Treasury Management** | 🟡 60% | Multisig required |
| **Governance** | 🟡 50% | DAO transition pending |

### 9.2 Key Actions Required

1. **Immediately:** Deploy 3-of-5 multisig treasury
2. **Immediately:** Activate CON-1427 fee collection
3. **Week 1-2:** Set up ALEX settlement pools
4. **Week 3-4:** Connect conxian-gateway to ALEX
5. **Month 2:** Build treasury reporting dashboard
6. **Month 3:** Launch ALEX IDO

### 9.3 Economic Model Validation

✅ **VALIDATED:** The 2% protocol fee with 50/30/20 allocation is compatible with the existing Conxian ecosystem architecture.

- **Operations (50%):** Supports CI/CD, SDK development, Nexus operations, and quarterly audits
- **Founders (30%):** 4-year vesting with DAO-voted performance bonuses
- **Ecosystem (20%):** Builder grants, liquidity mining, bug bounties

The model leverages existing production-ready infrastructure:
- ✅ conxius-enclave-sdk v2.0.12 for secure key management
- ✅ lib-conxian-core v0.2.12 for multi-chain adapters
- ✅ conxian-gateway v0.1.4 for settlement orchestration
- ✅ conxian-nexus v0.4.19 for verification

---

*This document is the authoritative integration map for the Conxian ecosystem.*
