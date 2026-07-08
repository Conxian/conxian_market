# Conxian Governance: The Sovereign Standard

## 1. The Multi-Dimensional Mandate
Every module and agent in the Conxian Marketplace must adhere to the **Multi-Dimensional Scaling** rule:
- **Cost Independence:** The operational cost of an agent (inference, storage) must be borne by the *User* (Local Inference) or the *Agent Provider*. The Conxian Hub will not subsidize inference.
- **Hub Responsibility:** The Conxian Hub acts strictly as a **Thin Orchestrator**, managing only *Settlement*, *Reputation*, and *MCP-based Handoff Discovery*.

## 2. Sovereign Infrastructure Requirements
To be listed as a "Sovereign" module, the following mandates must be fulfilled:
- **BYOK (Bring Your Own Key):** The module must allow users to provide their own API keys (e.g., DeepSeek, Gemini, AWS) or point to a local Ollama node.
- **Deployment Optionality:** Codebases must be portable across Cloud, Edge, and **Behind-Firewall Sovereign Servers** to ensure client choice and data sovereignty.
- **MCP Native:** All agent-to-agent and hub-to-agent communication must use the **Model Context Protocol (MCP)** to ensure interoperability and state portability.
- **Edge-Ready:** The code must be capable of running in a TEE (Trusted Execution Environment) or locally on the user's hardware.
- **ZK-Compliant:** Financial transactions must generate ZK-proofs of correctness to ensure "Auditing without Surveillance."

## 3. The Builder Revenue Matrix
Conxian implements a default **80/10/10** yield matrix:
- **80%:** To the Builder (Agent Creator).
- **10%:** To the Platform Treasury (The "Hub Fee").
- **10%:** To Ecosystem Stakeholders (Governance/Incentives).

## 4. Discarding the Stubs
Governance votes will prioritize **Functional Depth** over **Architectural Breadth**. Any "Stub" contract or adapter that remains non-functional for more than 2 cycles will be subject to a **"Discard and Rebuild"** mandate to ensure ecosystem trust and economic vitality.
