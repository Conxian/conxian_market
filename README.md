# Conxian Marketplace (conxian_market)

## Repository scope and boundaries

This repository is the Conxian Marketplace and orchestration layer for the broader Conxian ecosystem. It is not the standalone public SDK, npm package root, or a generic client library for external consumption.

The market layer coordinates discovery, settlement, escrow, and treasury logic across the ecosystem and integrates with adjacent Conxian repos such as:
- Conxian/Conxian — protocol/core contracts and on-chain governance
- lib-conxian-core — shared protocol primitives and chain adapters
- conxian-gateway — settlement rail and compliance middleware
- conxian-nexus — verification, proof, and state synchronization
- conxius-platform — CI/CD and control-plane orchestration
- conxian-business — governance and operating model work

This repo is the value-layer coordination mechanism for the marketplace, not the canonical SDK distribution point or the entire Conxian stack.

### Chain-native boundary and anti-competition rule

The marketplace must remain an orchestration and value-capture layer. It must not become a consumer-facing custody, wallet, data, or full DeFi platform that competes with the users and infrastructure owners it serves.

The repo should only take on chain-native enforcement when it is the minimal, required settlement boundary for a chosen rail. In practice, this means:
- universal chain support is an abstraction layer for routing, verification, and compatibility
- consumer-owned custody, execution, and data remain outside this repo
- any chain-native contract work is limited to the minimum required to enforce settlement truth on a specific rail
- Stacks or any other chain is integrated only when it serves the market’s settlement and verification flow, not when it would expand into a competing ecosystem product

## Dependency and integration coverage

The marketplace repo is intentionally designed to consume the Conxian org stack at the correct abstraction layer:

| Dependency | Status in this repo | Evidence | Notes |
|:-----------|:-------------------|:---------|:------|
| **Conxian/Conxian** | Indirect / protocol boundary | Shared ecosystem architecture and fee/governance docs | This repo does not own the protocol core itself; it coordinates settlement and marketplace logic around it. |
| **lib-conxian-core** | **Directly used** | Shared trust-tier, chain, rail, and settlement type definitions in [src/core_types.ts](src/core_types.ts) | This is the main primitive dependency used by fee, settlement, and verification logic. |
| **conxian-gateway** | **Directly used** | Gateway REST client and settlement execution pipeline in [src/gateway_client.ts](src/gateway_client.ts) and [src/settlement.ts](src/settlement.ts) | This is the primary live integration point for settlement and routing. |
| **conxian-nexus** | **Partial integration** | Verification and trust-tier logic in [src/verification.ts](src/verification.ts) and bridge references in [src/sdk_bridge.ts](src/sdk_bridge.ts) | The repo depends on nexus concepts and proof semantics, but the actual implementation remains gateway-oriented and feature-gated by upstream maturity. |
| **conxius-platform** | Indirect / orchestration boundary | CI/CD and control-plane references in the org docs and roadmap | This repo does not own platform infrastructure; it consumes platform-grade operations and release scaffolding as an adjacent layer. |
| **conxian-business** | Governance / policy boundary | BOS and governance references in [docs/AGENTS.md](docs/AGENTS.md) and [docs/research/conxian_business_logic_analysis.md](docs/research/conxian_business_logic_analysis.md) | Business doctrine informs the repo, but this repo does not directly import business workflow modules. |

### Current assessment

This repo is already aligned to the org role it should play:
- It uses the shared core primitives and the gateway settlement layer aggressively.
- It partially consumes the trust/proof model represented by nexus.
- It does not absorb the business or platform repos as direct runtime dependencies; those are separate governance and platform layers.
- Remaining gaps are primarily upstream/infrastructure maturity issues, not missing imports inside this repo.

### Org dependency gaps to track

| Area | Current state | Dependency owner | Repo-level implication |
|:-----|:--------------|:----------------|:----------------------|
| **Core primitives** | Strong direct usage | lib-conxian-core | Market logic depends on shared trust tiers, rail definitions, and chain metadata. |
| **Settlement rails** | Strong direct usage | conxian-gateway | Market flow is intentionally built around gateway APIs and settlement routing. |
| **Proof verification** | Partial integration | conxian-nexus | The repo expects nexus-backed proof semantics, but actual runtime checks remain gateway-driven and feature-gated. |
| **TEE attestation** | Upstream blocker | conxius-enclave-sdk | Strict trust tiers remain gated by unresolved P0 attestation issues. |
| **CI/CD enforcement** | Upstream blocker | conxius-platform | Release quality gates and repo automation should come from platform-level enforcement. |
| **Business rules / BOS** | Governance boundary | conxian-business | Business rationale is consumed conceptually, not as a runtime code dependency in this repo. |

### Recommended next org actions

1. Keep this repo focused on marketplace orchestration, fee routing, escrow logic, and settlement integration.
2. Treat gateway and core as the active runtime dependencies this repo must keep aligned with.
3. Treat nexus as the trust/proof enhancement layer to deepen integration when upstream verification services mature.
4. Keep business and platform concerns in their own repos unless a direct runtime dependency is explicitly required.
5. Track the remaining strict-tier blockers as upstream work, not as a reason to broaden this repo beyond its market role.

## ⚡ The Production Settlement Core of the Conxian Ecosystem

The Conxian Marketplace is the **primary value capture mechanism** for the entire Conxian ecosystem. It provides discovery, deployment, settlement, and escrow for autonomous AI labor.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     CONXIAN MARKET: THE VALUE LAYER                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   All other Conxian repos are INFRASTRUCTURE that ENABLES the market.   │
│                                                                          │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                    │
│   │  Discovery  │  │  Settlement │  │   Escrow    │                    │
│   │  (Agents)   │  │  (2% Fee)   │  │  (ERC-8183) │                    │
│   └─────────────┘  └─────────────┘  └─────────────┘                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 🏛 The Ethos: Sovereign, Productive, Federated

- **DeFi-Agnostic Orchestration:** We do not build proprietary DeFi protocols. We build the **Orchestration Layer** that allows AI labor to utilize *any* external financial primitive (EVM, Bitcoin L2s, etc.) as a settlement utility.
- **Sovereign AI (BYOK) Mandate:** All agents must support Bring-Your-Own-Keys (BYOK). Intelligence is decoupled from cloud monopolies, ensuring users control their data, keys, and inference costs.
- **Productive AI (Real Economy):** We prioritize "Productive" modules (logistics, finance, industrial management) that solve real-world efficiency gaps over consumer chatbots.
- **Deployment Optionality:** To fulfill the "Sovereign" promise, Conxian supports multiple deployment lanes: Cloud-Orchestrated, Edge-Local (mobile/hardware), and **On-Prem Sovereign (behind-firewall)**.
- **Multi-Dimensional Scaling:** Our infrastructure remains a "Thin Platform." We capture value through settlement fees while pushing compute costs to the edge.

### 🛠 Core Architecture

1. **The Hub (Thin Orchestrator):** Lightweight coordination of agent handoffs using the **Model Context Protocol (MCP)**.
2. **The Escrow Layer (ERC-8183):** Programmable settlement that secures builder royalties and user funds using external liquidity rails.
3. **The Builder Network:** A decentralized "App Store" where specialized agentic logic is published and monetized.
4. **The Treasury Layer:** 2% protocol fee with 50/30/20 allocation for sustainable operations.

### 🔗 Ecosystem Integration

| Component | Role | Status |
|:----------|:-----|:-------|
| **conxian-nexus** | Trust verification, ZK proofs | ✅ v0.4.19 |
| **conxian-gateway** | Settlement rails, industrial ingress | ✅ v0.1.4 |
| **conxius-enclave-sdk** | Hardware security, BYOK | ✅ v2.0.12 |
| **lib-conxian-core** | 30+ chain adapters | ✅ v0.2.12 |
| **Conxian/Conxian** | Smart contracts, fee collection | ✅ Mainnet |

### 📊 Economic Model

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     PROTOCOL FEE: 2%                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  USER PAYMENT → ERC-8183 ESCROW → SETTLEMENT                    │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                           │
│                              ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    100% RELEASED TO BUILDER                       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                           │
│                              ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                     PROTOCOL FEE: 2%                            │    │
│  │                                                                  │    │
│  │  50% → Operations (CI/CD, SDKs, Nexus, Audits)                   │    │
│  │  30% → Founders (4-year vesting)                                │    │
│  │  20% → Ecosystem (Grants, Liquidity, Bounties)                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 🚀 Roadmap: From Stubs to Economic Vitality

Our current focus is **Hardening the Orchestration Core**:
- **Rail Integration:** Connecting the Marketplace to external DeFi protocols (ALEX, Uniswap) for functional settlement.
- **Federated Standard:** Mandating the **MCP-only** handoff model for all third-party AI providers.
- **Security Hardening:** Transitioning from Admin-Key control to DAO-governed Access Control (CON-1438).

### 📚 Research Documents

- [FUNDING_AND_ECONOMICS.md](docs/research/FUNDING_AND_ECONOMICS.md) - Complete funding model
- [FULL_SYSTEM_ARCHITECTURE.md](docs/research/FULL_SYSTEM_ARCHITECTURE.md) - Ecosystem integration
- [MARKET_UNIFIED_POSITIONING.md](docs/research/MARKET_UNIFIED_POSITIONING.md) - Unified enhancement blueprint

---
*Intelligence is a Utility. Sovereignty is a Right.*
