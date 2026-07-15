# Conxian Marketplace (conxian_market)

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
