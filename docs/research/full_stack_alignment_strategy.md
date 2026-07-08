# Full-Stack Alignment Strategy: Conxian Autonomous Infrastructure

## 1. Executive Summary
This strategy defines the unified architecture for the Conxian ecosystem, ensuring that the **Core**, **SDK**, **Wallet**, **Gateway**, and **Nexus** layers operate as a cohesive "Agentic-First" stack. A critical pivot in this version is the **exclusion of proprietary DeFi systems (conxian/conxian)**. Conxian does not build financial primitives; we build the **Orchestration** and **Settlement** infrastructure that allows AI labor to utilize *any* external DeFi system (e.g., Uniswap, ALEX, BitVM rails) as a utility.

## 2. DeFi-Agnostic Orchestration
To avoid the resource drain of recreating established financial systems, Conxian operates as **Orchestration-as-a-Service**:
- **Utility Focus:** We treat DeFi as a commodity. Our agents ingest "Operating Lane" rules to select the best external settlement rail for a given task.
- **Zero-Conflict:** By not building our own DeFi, we remove competition with the very protocols we aim to orchestrate, making Conxian a neutral "Trust Layer" for the entire Bitcoin and EVM ecosystems.

## 3. Layered Responsibility Mapping

### A. The Foundation: Core Primitives (lib-conxian-core)
- **Role:** Shared cryptographic and protocol logic for *interacting* with external rails.
- **Responsibility:** MuSig2 aggregation, PSBT construction, and verification logic for external ZK-proofs.
- **Mandate:** Support universal chain adapter traits to enable seamless integration with any 3rd party settlement layer.

### B. The Interface: Conclave SDK (@conxian/sdk)
- **Role:** High-level abstraction for builders to plug agentic labor into global settlement.
- **Responsibility:** Standardizing how agents request payments, decompose tasks, and handle MCP handoffs across diverse rails.

### C. The Reference: Conxius Wallet (conxius-wallet)
- **Role:** A minimalist reference client for the SDK.
- **Responsibility:** Proving that hardware-backed signing can be applied to *any* external protocol.

### D. The Ingress: Conxian Gateway (conxian-gateway)
- **Role:** Industrial protocol translator.
- **Responsibility:** Normalizing industrial flows (ISO 20022, Fedimint) into a format that can be settled on external on-chain rails.

### E. The Truth: Conxian Nexus (conxian-nexus)
- **Role:** The "Glass Node" observation layer.
- **Responsibility:** Verifying that external contract states (e.g., a successful swap on ALEX) have actually occurred before triggering agent handoffs.

## 4. Deployment Optionality: The Sovereign Server Model
Conxian supports three primary deployment lanes to maximize client sovereignty:
1. **Cloud-Orchestrated:** For standard convenience (BYOK required).
2. **Edge-Local:** Orchestration running on mobile/enclave hardware.
3. **On-Prem Sovereign (Behind-Firewall):** Dedicated Hubs and Gateways for "Zero Secret Egress" industrial environments.

## 5. Agentic Interoperability
- **MCP-Native:** All handoffs use the Model Context Protocol.
- **ERC-8183 Escrow:** Programmable settlement remains the core mechanism, but the underlying liquidity resides in external, audited protocols.
