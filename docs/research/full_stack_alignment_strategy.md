# Full-Stack Alignment Strategy: Conxian Autonomous Infrastructure

## 1. Executive Summary
This strategy defines the unified architecture for the Conxian ecosystem, ensuring that the **Core**, **SDK**, **Wallet**, **Gateway**, and **Nexus** layers operate as a cohesive "Agentic-First" stack. The goal is to provide maximum client optionality while maintaining the "Sovereign" and "Multi-Dimensional Scaling" mandates.

## 2. Layered Responsibility Mapping

### A. The Foundation: Core Primitives (lib-conxian-core)
- **Role:** Canonical source for shared cryptographic and protocol logic.
- **Responsibility:** MuSig2 key aggregation, BitVM2 state-root verification, BIP-322 message signing, and universal chain adapter traits.
- **Mandate:** Zero-stub production code only.

### B. The Interface: Conclave SDK (@conxian/sdk)
- **Role:** High-level abstraction for builders to interact with Conxian settlement and orchestration.
- **Responsibility:** Standardizing the interface for hardware-backed signing, task decomposition, and MCP handoffs.
- **Mandate:** npm-distributable, low TTFV (< 15 mins), and decoupled from specific UI implementations.

### C. The Reference: Conxius Wallet (conxius-wallet)
- **Role:** A minimalist reference client for the SDK.
- **Responsibility:** Proving the security model (StrongBox/TEE) and providing a "Fast Path" for retail and enterprise user verification.
- **Mandate:** Transition from "The Product" to "The Reference App" to avoid competing with marketplace integrators.

### D. The Ingress: Conxian Gateway (conxian-gateway)
- **Role:** Industrial protocol translator and delivery runtime.
- **Responsibility:** Normalizing ISO 20022, Fedimint, and Citrea payloads into the Conxian settlement envelope.
- **Mandate:** Fail-closed operation and high-assurance delivery of cross-chain events.

### E. The Truth: Conxian Nexus (conxian-nexus)
- **Role:** The "Glass Node" and proof materialization layer.
- **Responsibility:** Maintaining the cursorable cross-chain event feed and generating ZK-proofs of state.
- **Mandate:** Move from polling to recursive-proof verification (BitVM3) for O(1) scaling.

## 3. Deployment Optionality: The Sovereign Server Model
To enhance client choice and security, Conxian supports three primary deployment lanes:

1. **Cloud-Orchestrated:** High-convenience, using Conxian-hosted Hubs for handoffs (BYOK required).
2. **Edge-Local:** Running orchestration logic directly on the user's mobile device or hardware enclave via the SDK.
3. **On-Prem Sovereign (Behind-Firewall):** Deploying a dedicated Conxian Hub and Gateway behind a client's corporate firewall. This ensures that sensitive industrial data never leaves the client's internal network while still participating in the global settlement layer.

## 4. Agentic Interoperability
- **MCP-Native Handoffs:** All agent communication must follow the Model Context Protocol. This allows a Bittensor agent to hand off a task to a local on-prem agent seamlessly.
- **ERC-8183 Escrow:** Every settlement must use programmable escrow to ensure that funds are only released upon verified completion, regardless of the deployment environment.

## 5. Sovereign Servers behind Client Firewalls
This deployment model is critical for enterprise adoption where "Zero Secret Egress" is mandatory.

### A. Requirements for On-Prem Orchestration
- **Local Hub Controller:** A dockerized or NixOS-based instance of the Conxian Hub that manages agent discovery and handoffs locally.
- **Firewall-Aware Ingress:** The Gateway must be capable of receiving regional settlement data (e.g., Investec API, regional SAP instance) without exposing the internal network to the public internet.
- **State-Sync via Nexus:** The local server periodically syncs with the global Nexus feed to verify global settlement events but maintains its own local transaction log.

### B. Local-First Execution
- **Edge Inference Support:** The Hub must support pointing to local Ollama nodes or hardware-secured inference engines (e.g., Groq-on-prem).
- **Offline-First Resilience:** Settlement intents can be signed and queued locally, then pushed to the global network once a secure outbound connection is established.
