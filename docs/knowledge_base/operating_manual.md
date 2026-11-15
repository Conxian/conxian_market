# Conxian Operating Manual: The Business Operating System (BOS)

> ⚠️ **SUPERSEDED (2026-11-14, ADR-007).** The fee/revenue model in this document is
> **historical**. The accepted model is **two products** — rail (ADR-005 dynamic rate)
> and matched job (**10% take, builder keeps 90%**) — under **one 50/30/20 split rule on
> the take**. There is no 2% fee, no 80/10/10, and no 5-stream revenue (no collection
> path). Numbers below are retained for history. Authoritative:
> `docs/adr/ADR_007_TWO_PRODUCT_RATE_MODEL.md`.


## 1. Introduction
This manual documents the standard operating procedures (SOPs) for the Conxian Ecosystem, aligning **Business Doctrine** with **Technical Execution**.

## 2. Commercial Packaging Doctrine
*Source: Conxian-Business / PR 875*

### A. The Yield Matrix (90/10 matched-job take — ADR-007)
All AI labour transactions in the Marketplace follow the automated split:
- **Builder:** keeps **90%** of the gross bounty (matched job).
- **Platform take:** **10%** of the gross bounty, then split **50/30/20**
  (ops / founders / ecosystem) — a single split rule.
- **Rail (raw x402/M2M, no job card):** charged the ADR-005 **dynamic rate**
  (0.50%→0.10% + cost floor), not a take.

> The retired 80/10/10 is **not** applied. Ecosystem is funded from the platform's
> 50/30/20, **not** as a second deduction on the builder.

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
| **Matched-job take** | 10% of gross | Builder keeps 90% |
| **Rail fee** | ADR-005 dynamic (0.50%→0.10% + floor) | Charged on raw x402/M2M |
| **Operations Treasury** | 50% of take | CI/CD, SDKs, Nexus, Audits |
| **Founder Compensation** | 30% of take | 4-year vesting schedule |
| **Ecosystem Growth** | 20% of take | Grants, Liquidity Mining, Bug Bounties |

> The retired "Total Protocol Fee 2%" and its decay timeline (2.0%→1.5%→1.0%) no
> longer apply — the rail rate is dynamic (ADR-005) and the matched-job take is flat
> 10% (ADR-007).

### B. Fee Rate Schedule (ADR-005)
| Volume tier (30-day) | Rate |
|:---------------------|:----:|
| TIER_1 | 0.50% |
| TIER_2 | 0.25% |
| TIER_3 | 0.15% |
| TIER_4 | 0.10% |

> The retired static 2.0/1.5/1.0% time-based decay is superseded by ADR-005.
> The fee also carries a per-rail flat floor (`cost × 1.25`) so it never rounds
> to zero on micro-settlements.

### C. Treasury Management Standards
- **Minimum Runway:** 12-month stablecoin reserve
- **Asset Allocation:** 40% Stablecoins, 30% RWA, 20% Liquid Staking, 10% Native
- **Governance Controls:** 3-of-5 multisig, 48-hour timelock for >$50K

### D. Founder Compensation Rules
- **Vesting:** 4-year cliff, monthly thereafter
- **Performance Cap:** 50% base, 50% DAO-voted bonus
- **Emergency Limit:** Maximum 6-month compensation in escrow

## 4. Settlement Rail Integration (BYO DeFi & Non-Custodial Doctrine)
*Source: ALEX Launch Strategy & Session 53 Architecture Expansion*

### A. Non-Custodial & Market-Agnostic Routing
- **Zero Custody:** Conxian never holds, touches, or custodies client funds or private data.
- **BYO DeFi Adapters:** Clients select external audited protocols (ALEX sBTC/USDC pools, Uniswap v4 ERC-8183 escrow, Fedimint e-cash mints, Lightning routing nodes).
- **Deprecation Advisory:** Proprietary smart contract development (`Conxian/Conxian`) is deprecated and recommended for archival to avoid contract maintenance debt and audit overhead.

### B. Primary Rails (ALEX/Bitcoin & EVM)
- **sBTC/USDC Pools:** Trustless Bitcoin settlement for AI labor via ALEX.
- **ERC-8183 Escrow:** Programmable settlement standard for EVM chains.
- **Federated Mints & Lightning:** Instant M2M e-cash micro-payments.

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
- **Treasury Reviews:** Quarterly treasury health assessments.
- **Fee Audits:** Annual protocol fee structure review via DAO governance.
