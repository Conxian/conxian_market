# Conxian Market SDK (`@conxian/market-sdk`)

> **The Verifiable Settlement, Escrow & Trust Layer for Autonomous Agent Commerce (x402)**
> **Version:** 0.2.0 | **Status:** Active Production Core | **Capabilities:** 33 Integrated Modules

---

## 🏛 Ecosystem Role & Boundary Alignment

The `conxian_market` repository (`@conxian/market-sdk`) serves as the **verifiable settlement, escrow, SLA enforcement, and trust layer** for autonomous agent commerce (x402).

Rather than building proprietary smart contracts or AI agents, Conxian operates as a **Market-Agnostic, Zero-Custody Value Router and Trust Layer on top of x402**. Conxian orchestrates and monetizes industrial agent labor through:
- **Attestation-Backed x402 Verification**: Hardware enclave attestation (TEE/Nitro/KeyMint) verification for agent identity and "Verified by Conxian" trust proof artifacts.
- **Programmable Escrow (ERC-8183 / CJCS Job Cards)**: Non-custodial escrow locks tied to HTTP 402 payment demands and receipts.
- **Multi-Rail Bitcoin/Stacks/EVM Settlement**: Non-custodial settlement across Lightning, Fedimint, sBTC, ALEX, Citrea, RGB, and EVM ERC-8183.
- **Autonomous SLA Enforcement & Dispute Arbitration**: Automated delay penalties, gap card bounties, and builder reputation recovery.

```
┌─────────────────────────────────────────────────────────────────────────┐
│              CONXIAN MARKET: THE M2M TRUST & SETTLEMENT LAYER          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   All other Conxian repos are INFRASTRUCTURE that ENABLES the market.   │
│                                                                          │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐   │
│   │  x402 Trust │  │ Multi-Rail  │  │ ERC-8183    │  │ Zero-Custody │   │
│   │ Attestation │  │ Settlement  │  │ Escrow      │  │ BYO DeFi     │   │
│   └─────────────┘  └─────────────┘  └─────────────┘  └──────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔗 Dependency and Integration Coverage

The Marketplace SDK is intentionally designed to consume the Conxian org stack at the correct abstraction layer:

| Dependency | Status in this Repo | Evidence / Module | Notes |
|:-----------|:-------------------|:------------------|:------|
| **Conxian/Conxian** | **Deprecated / Archived Reference** | [src/market_agnostic_router.ts](src/market_agnostic_router.ts) | Custom smart contract development is frozen to eliminate maintenance debt and audit overhead in favor of external BYO DeFi adapters. |
| **lib-conxian-core** | **Directly Used** | [src/core_types.ts](src/core_types.ts) | Shared trust-tier, chain, rail, and settlement type definitions. |
| **conxian-gateway** | **Directly Used** | [src/gateway_client.ts](src/gateway_client.ts) & [src/settlement.ts](src/settlement.ts) | Primary live integration point for REST endpoints and settlement execution. |
| **conxian-nexus** | **Directly Used** | [src/verification.ts](src/verification.ts) | Verification and trust-tier attestation semantics. |
| **conxius-enclave-sdk** | **Security Dependency** | [src/verification.ts](src/verification.ts) & [src/x402_facade.ts](src/x402_facade.ts) | Hardware enclave attestation (Nitro/KeyMint/TEE) and BYOK key handling. |
| **conxius-platform** | **Control Plane** | Org docs & roadmap | CI/CD automation and release rulesets. |
| **conxian-business** | **Governance Boundary** | [src/bos_yield_splitter.ts](src/bos_yield_splitter.ts) | Commercial packaging doctrine (80/10/10 split, fee decay, founder vesting). |

---

## 🛠 Integrated SDK Modules (33 Capabilities)

The `@conxian/market-sdk` package exposes 33 integrated capabilities via `ConxianMarketSDK`:

1. **Control Model (`verification.ts`)**: TrustTier detection & P0 gap degradation.
2. **CJCS Escrow (`gateway_client.ts`)**: Programmable Job Card settlement & escrow.
3. **Attestation Verifier (`verification.ts`)**: TEE (Nitro/KeyMint) & ZK proof validation via Nexus/Gateway.
4. **Fee Calculator & Revenue Model (`fee_calculator.ts`)**: Tier-based pricing, discounts & revenue projections.
5. **Settlement Orchestration (`settlement.ts`)**: Multi-rail settlement execution across 8+ rails.
6. **Autonomous SLA Engine (`sla_engine.ts`)**: Automated job card evaluation, delay penalties, gap cards & builder reputation.
7. **Telemetry & Treasury Watcher (`monitoring_watcher.ts`)**: sBTC peg health, Fedimint mints, Babylon staking & 12-month runway calculator.
8. **TrustTier Middleware (`trust_tier_middleware.ts`)**: 4-stage pricing pipeline, SLA template resolution & wire headers.
9. **BOS Yield Splitter (`bos_yield_splitter.ts`)**: 80/10/10 yield split, fee decay timeline, founder vesting & Thin Orchestrator BYOK guard.
10. **Market-Agnostic Router (`market_agnostic_router.ts`)**: Zero-custody validation, BYO DeFi protocol adapter resolution, M2M MCP routing & deprecation advisory.
11. **Job Card Escrow Engine (`job_card_escrow.ts`)**: ERC-8183 programmable escrow creation, output submission, SLA-integrated release, dispute/refund handling & reconciliation.
12. **x402 Escrow Gateway & Attestation Proofs (`x402_facade.ts`)**: Multi-rail HTTP 402 payment demands, hardware attestation proof verification & "Verified by Conxian" trust artifacts.
13. **Client Installation Engine (`client_onboarding.ts`)**: Enterprise client onboarding, system setup, domain routing firewall & CLI installer.

---

## 📊 Economic & Governance Framework

- **Yield Matrix (80/10/10)**: 80% Builder, 10% Platform Treasury, 10% Ecosystem Stakeholders.
- **Protocol Fee Structure**: 2.0% launch rate (50% Operations, 30% Founder Vesting, 20% Ecosystem Growth).
- **Fee Decay Timeline**: 2.0% (0–12m), 1.5% (12–36m), 1.0% (36m+).
- **Zero-Custody Mandate**: Conxian never touches or custodies client funds or private data.
- **Thin Orchestrator & BYOK**: Centralized heavy AI inference is prohibited; compute runs at the edge or via user-provided keys.

---

## ⚡ Quick Start (x402 Attestation Escrow)

```typescript
import { ConxianMarketSDK, SettlementRail, TrustTier } from "@conxian/market-sdk";

// Initialize SDK
const sdk = await ConxianMarketSDK.connect({
  baseUrl: "https://gateway.conxian.io",
});

// Create x402 payment demand for job
const demand = sdk.createX402Demand({
  id: "job-101",
  title: "Agent Data Analysis",
  bountySat: 1_000_000n,
});

// Receipt received from client agent
const receipt = {
  demandId: "job-101",
  transactionId: "tx-999",
  amountSat: "1000000",
  paidAt: Date.now(),
  payerDid: "did:conxian:client:alice",
};

// Client enclave attestation certificate
const cert = {
  enclave_attestation: "0xenclave_attestation_proof",
  timestamp: Date.now(),
};

// Verify attestation & lock ERC-8183 escrow with "Verified by Conxian" trust proof
const { escrowRecord, trustProof } = await sdk.processX402PaymentAndLockEscrowWithAttestation(
  demand,
  receipt,
  "did:conxian:agent:bob",
  SettlementRail.Sbtc,
  cert
);

console.log(`Escrow Locked: ${escrowRecord.jobId} (State: ${escrowRecord.state})`);
console.log(`Trust Proof Hash: ${trustProof.proofHash} (Tier: ${trustProof.verifiedTier})`);
```

---

## 📚 Documentation & Research Index

- [docs/research/SESSION_66_RESEARCH_EXPANSION_AND_GAP_MATRIX.md](docs/research/SESSION_66_RESEARCH_EXPANSION_AND_GAP_MATRIX.md) - Session 66 M2M Trust Layer research & gap register
- [docs/adr/ADR_002_M2M_X402_TRUST_LAYER.md](docs/adr/ADR_002_M2M_X402_TRUST_LAYER.md) - Architectural decision record for x402 trust layer
- [docs/knowledge_base/operating_manual.md](docs/knowledge_base/operating_manual.md) - Operating manual & BOS doctrine
- [docs/knowledge_base/trust_tier_pricing.md](docs/knowledge_base/trust_tier_pricing.md) - TrustTier pricing & routing pipeline
- [docs/knowledge_base/sla_bounty_system.md](docs/knowledge_base/sla_bounty_system.md) - SLA engine & gap card spec
- [docs/knowledge_base/monitoring.md](docs/knowledge_base/monitoring.md) - Telemetry & treasury watcher spec
- [docs/GOVERNANCE.md](docs/GOVERNANCE.md) - Governance standards & zero-custody mandate
- [ROADMAP.md](ROADMAP.md) - Multi-session roadmap & execution tracking
- [docs/IMPLEMENTATION_TRACKER.md](docs/IMPLEMENTATION_TRACKER.md) - Live implementation tracker

---
*Intelligence is a Utility. Sovereignty is a Right.*
