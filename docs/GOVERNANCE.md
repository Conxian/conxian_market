# Conxian Governance: The Sovereign Standard

## 1. The Multi-Dimensional Mandate
Every module and agent in the Conxian Marketplace must adhere to the **Multi-Dimensional Scaling** rule:
- **Cost Independence:** The operational cost of an agent (inference, storage) should ideally be borne by the *User* (Local Inference) or the *Agent Provider*, not the *Conxian Hub*.
- **Hub Responsibility:** The Conxian Hub only manages *Settlement*, *Reputation*, and *Handoff Discovery*.

## 2. Sovereign Infrastructure Requirements
To be listed as a "Sovereign" module, the following must be true:
- **BYOK (Bring Your Own Key):** The module must allow users to provide their own API keys (e.g., Gemini, DeepSeek, AWS) or point to a local Ollama node.
- **Edge-Ready:** The code must be capable of running in a TEE (Trusted Execution Environment) or locally on the user's hardware.
- **ZK-Compliant:** Financial transactions must generate ZK-proofs of correctness to ensure "Auditing without Surveillance."

## 3. The Builder Revenue Matrix
Conxian implements a default **80/10/10** yield matrix:
- **80%:** To the User/Operator.
- **10%:** To the Platform Treasury (The "Hub Fee").
- **10%:** To the Logic Builder (Passive Royalty).

## 4. Discarding the Stubs
Governance votes will prioritize **Functional Depth** over **Architectural Breadth**. Any "Stub" contract that remains non-functional for more than 2 cycles will be subject to a "Discard and Rebuild" mandate to ensure ecosystem trust.
