# Conxian Operating Manual: The Business Operating System (BOS)

## 1. Introduction
This manual documents the standard operating procedures (SOPs) for the Conxian Ecosystem, aligning **Business Doctrine** with **Technical Execution**.

## 2. Commercial Packaging Doctrine
*Source: Conxian-Business / PR 875*

### A. The Yield Matrix (80/10/10)
All AI labor transactions in the Marketplace must follow the automated yield split:
- **80%:** To the Builder (Agent Creator).
- **10%:** To the Platform (Conxian Treasury).
- **10%:** To Ecosystem Stakeholders (Governance/Incentives).

### B. Tiered Service Levels
Agents should be packaged in three tiers:
1. **Experimental:** For non-critical testing; low/zero cost; no SLA.
2. **Standard:** Production-ready; pay-per-use; community support.
3. **Institutional:** High-assurance; hardware-secured (TEE); premium support.

## 3. Sovereign OS (DD) Implementation Patterns
*Source: Daemon-Dynamics Analysis*

### A. "Thin Orchestrator" Pattern
- **Role:** The Hub manages task routing and settlement only.
- **Rule:** Never perform heavy AI inference on centralized Conxian infrastructure.
- **Action:** Coordinate handoffs via MCP (Model Context Protocol).

### B. "BYOK" (Bring Your Own Key) Security
- **Requirement:** Agents must be configured to use the User's API keys or local compute.
- **Security:** Use the `conxius-enclave-sdk` for sensitive key handling.

## 4. Lifecycle & Control Model
*Source: CON-685*

| Phase | Entry Criteria | Exit Criteria |
| :--- | :--- | :--- |
| **Discover** | Identified Industrial Need | Initial Research Documented |
| **Design** | Aligned with Productive AI Ethos | Technical Specification Approved |
| **Build** | Functional Core (No Stubs) | Security Unit Tests Passing |
| **Verify** | ZK-Proof Generation Successful | Audit/Remediation Complete |
| **Release** | Marketplace Publication Approved | Active Settlement Enabled |

## 5. Maintenance & Updates
- **Data-First:** Always audit repository state against the "Data-Driven Insights" report before major releases.
- **Stub Policy:** Zero tolerance for non-functional placeholders in the "Settlement" or "Security" layers.
