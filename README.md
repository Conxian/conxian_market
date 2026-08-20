# Conxian Market SDK (`@conxian/market-sdk`)

> **The Value, Settlement & SLA Enforcement Layer of the Conxian Ecosystem**
> **Version:** 0.2.0 | **Status:** Active Production Core | **Capabilities:** 31 Integrated Modules

---

## 🏛 Ecosystem Role & Boundary Alignment

The `conxian_market` repository (`@conxian/market-sdk`) serves as the **orchestration, settlement, fee routing, SLA enforcement, and telemetry layer** for the Conxian ecosystem.

Rather than building proprietary smart contracts or AI agents, Conxian operates as a **Market-Agnostic, Zero-Custody Value Router** that orchestrates and monetizes industrial agent labor through programmable escrow (ERC-8183 / CJCS Job Cards), multi-rail Bitcoin/Stacks settlement, TrustTier verification, autonomous SLA enforcement, telemetry monitoring, and BYO DeFi protocol routing.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     CONXIAN MARKET: THE VALUE LAYER                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   All other Conxian repos are INFRASTRUCTURE that ENABLES the market.   │
│                                                                          │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐   │
│   │  Discovery  │  │  Settlement │  │   Escrow    │  │  Zero-Custody│   │
│   │  (Agents)   │  │ (2% Fee)    │  │ (ERC-8183)  │  │ BYO DeFi Router│   │
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
| **conxian-nexus** | **Partial Integration** | [src/verification.ts](src/verification.ts) | Verification and trust-tier attestation semantics. |
| **conxius-enclave-sdk** | **Security Dependency** | [src/verification.ts](src/verification.ts) & [src/bos_yield_splitter.ts](src/bos_yield_splitter.ts) | Enclave attestation (Nitro/KeyMint) and BYOK key handling. |
| **conxius-platform** | **Control Plane** | Org docs & roadmap | CI/CD automation and release rulesets. |
| **conxian-business** | **Governance Boundary** | [src/bos_yield_splitter.ts](src/bos_yield_splitter.ts) | Commercial packaging doctrine (80/10/10 split, fee decay, founder vesting). |

---

## 🛠 Integrated SDK Modules (31 Capabilities)

The `@conxian/market-sdk` package exposes 31 integrated capabilities via `ConxianMarketSDK`:

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

---

## 📊 Economic & Governance Framework

- **Yield Matrix (80/10/10)**: 80% Builder, 10% Platform Treasury, 10% Ecosystem Stakeholders.
- **Protocol Fee Structure**: 2.0% launch rate (50% Operations, 30% Founder Vesting, 20% Ecosystem Growth).
- **Fee Decay Timeline**: 2.0% (0–12m), 1.5% (12–36m), 1.0% (36m+).
- **Zero-Custody Mandate**: Conxian never touches or custodies client funds or private data.
- **Thin Orchestrator & BYOK**: Centralized heavy AI inference is prohibited; compute runs at the edge or via user-provided keys.

---

## ⚡ Quick Start

```typescript
import { ConxianMarketSDK, SettlementRail, TrustTier } from "@conxian/market-sdk";

// Initialize SDK
const sdk = await ConxianMarketSDK.connect({
  baseUrl: "https://gateway.conxian.io",
});

// Run 4-stage TrustTier Pricing & Routing Pipeline
const pipelineResult = sdk.runTrustTierPipeline({
  headers: { "x-conxian-light-proof": "spv_proof" },
  amountSat: 100_000n,
});

console.log(`Effective Tier: ${pipelineResult.effectiveTier}`);
console.log(`Protocol Fee: ${pipelineResult.fee.feeSat} sats (${pipelineResult.fee.feeBps} bps)`);

// Validate Zero-Custody Compliance
const custody = sdk.validateZeroCustody({
  id: "settle-001",
  sourceWalletAddress: "0xalice...",
  destinationWalletAddress: "0xbob...",
  amountSat: 100_000n,
  rail: SettlementRail.EvmErc8183,
  isClientKeyIsolated: true,
  storesClientDataOnHub: false,
});

console.log(`Zero Custody Compliant: ${custody.isZeroCustodyCompliant}`);
```

---

## 📚 Documentation & Research Index

- [docs/knowledge_base/operating_manual.md](docs/knowledge_base/operating_manual.md) - Operating manual & BOS doctrine
- [docs/knowledge_base/trust_tier_pricing.md](docs/knowledge_base/trust_tier_pricing.md) - TrustTier pricing & routing pipeline
- [docs/knowledge_base/sla_bounty_system.md](docs/knowledge_base/sla_bounty_system.md) - SLA engine & gap card spec
- [docs/knowledge_base/monitoring.md](docs/knowledge_base/monitoring.md) - Telemetry & treasury watcher spec
- [docs/GOVERNANCE.md](docs/GOVERNANCE.md) - Governance standards & zero-custody mandate
- [ROADMAP.md](ROADMAP.md) - Multi-session roadmap & execution tracking
- [docs/IMPLEMENTATION_TRACKER.md](docs/IMPLEMENTATION_TRACKER.md) - Live implementation tracker

---
*Intelligence is a Utility. Sovereignty is a Right.*
