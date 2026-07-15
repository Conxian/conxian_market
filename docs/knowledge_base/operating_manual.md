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

## 3. Economic Framework: Multi-Dimensional DeFi Monetary System
*Source: FUNDING_AND_ECONOMICS.md / Issue #6*

### A. Protocol Fee Structure
| Fee Component | Rate | Allocation |
|:--------------|:----:|:-----------|
| **Total Protocol Fee** | 2% | Launch rate (scales down) |
| **Operations Treasury** | 50% | CI/CD, SDKs, Nexus, Audits |
| **Founder Compensation** | 30% | 4-year vesting schedule |
| **Ecosystem Growth** | 20% | Grants, Liquidity Mining, Bug Bounties |

### B. Fee Decay Timeline
| Phase | Duration | Rate |
|:------|:--------:|:----:|
| Launch Stabilization | 0-12 months | 2.0% |
| Growth Phase | 12-36 months | 1.5% |
| Mature Ecosystem | 36+ months | 1.0% |

### C. Treasury Management Standards
- **Minimum Runway:** 12-month stablecoin reserve
- **Asset Allocation:** 40% Stablecoins, 30% RWA, 20% Liquid Staking, 10% Native
- **Governance Controls:** 3-of-5 multisig, 48-hour timelock for >$50K

### D. Founder Compensation Rules
- **Vesting:** 4-year cliff, monthly thereafter
- **Performance Cap:** 50% base, 50% DAO-voted bonus
- **Emergency Limit:** Maximum 6-month compensation in escrow

## 4. Settlement Rail Integration
*Source: ALEX Launch Strategy*

### A. Primary Rails (ALEX/Bitcoin)
- **sBTC/USDC Pools:** Trustless Bitcoin settlement for AI labor
- **ALEX Launchpad:** APower-based allocation mechanism
- **Cross-Chain:** Fedimint, Citrea adapters

### B. Secondary Rails (EVM)
- **ERC-8183 Escrow:** Programmable settlement standard
- **Uniswap Integration:** EVM liquidity pools
- **USDC/USDT:** Stable settlement currencies

## 5. Sovereign OS (DD) Implementation Patterns
*Source: Daemon-Dynamics Analysis*

### A. "Thin Orchestrator" Pattern
- **Role:** The Hub manages task routing and settlement only.
- **Rule:** Never perform heavy AI inference on centralized Conxian infrastructure.
- **Action:** Coordinate handoffs via MCP (Model Context Protocol).

### B. "BYOK" (Bring Your Own Key) Security
- **Requirement:** Agents must be configured to use the User's API keys or local compute.
- **Security:** Use the `conxius-enclave-sdk` for sensitive key handling.

## 6. Lifecycle & Control Model
*Source: CON-685*

| Phase | Entry Criteria | Exit Criteria |
| :--- | :--- | :--- |
| **Discover** | Identified Industrial Need | Initial Research Documented |
| **Design** | Aligned with Productive AI Ethos | Technical Specification Approved |
| **Build** | Functional Core (No Stubs) | Security Unit Tests Passing |
| **Verify** | ZK-Proof Generation Successful | Audit/Remediation Complete |
| **Release** | Marketplace Publication Approved | Active Settlement Enabled |

## 7. Maintenance & Updates
- **Data-First:** Always audit repository state against the "Data-Driven Insights" report before major releases.
- **Stub Policy:** Zero tolerance for non-functional placeholders in the "Settlement" or "Security" layers.
- **Treasury Reviews:** Quarterly treasury health assessments
- **Fee Audits:** Annual protocol fee structure review via DAO governance
