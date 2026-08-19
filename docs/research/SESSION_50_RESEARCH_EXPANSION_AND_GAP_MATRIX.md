# Session 50: Cross-Repo Research Expansion & Gap Synthesis Matrix

> **Generated:** 2026-08-19 | **Session:** 50 | **Status:** Active
> **Scope:** Ecosystem-wide Audit across 10 Repos, Neon/Supabase DBs, Render Cloud, Open PRs, Missing Components, and Candidate Scoring for Knowledge Base Runtime Implementation.

---

## 1. Executive Summary & Research Scope

In Session 50, a full-cycle research expansion and gap analysis was executed across all Conxian organizational repositories, active cloud infrastructure (Neon Postgres projects, Supabase database instances, Render web services), knowledge base manuals, and live issue backlogs.

The strategic directive remains **Hardening the Core**: driving functional settlement, treasury health, and SLA enforcement while maintaining a lean, high-utility marketplace orchestration layer (`market-sdk`).

---

## 2. Infrastructure & Organization Asset Audit

### A. Managed Database Infrastructure
- **Neon Cloud Postgres**:
  - `orange-paper-76209725` (*Conxian Nexus* - PG17): Primary production database on `br-fancy-poetry-aghwta0o`. Contains `cnx_bos`, `erp_mock`, `affiliate`, `neon_auth` schemas.
  - `noisy-flower-17484435` (*Business Operating System* - PG18): Active BOS analytical store.
  - `small-math-44741750` (*market* - PG18): Marketplace event store.
  - `sparkling-sunset-69236559` (*corelibs* - PG18), `weathered-night-98492579` (*Software dev kit* - PG18), `noisy-cloud-41146057` (*Gateway* - PG18).
- **Supabase Cloud Postgres**:
  - `yauldfcpswnufgwfvnlr` (*Conxian BOS* - PG17): Active health status. Tables: `ma_milestones` (26 rows), `exit_velocity` (14 rows), `deployment_efficiency` (11 rows), `runway_metrics` (4 rows), `deai_requests` (3 rows), `ip_audit_logs` (8 rows), `ats_violations` (3 rows).
  - `iczqutrbbfudfzfplymc` (*Conxian-platform* - PG17): Active health status. Mirror schemas for telemetry and audit.

### B. Render Cloud Deployments
- **Service**: `conxian-labs-site` (`srv-d9ndhr2jnfac73as7te0`)
  - **URL**: `https://conxian-labs-site-xhqq.onrender.com`
  - **Status**: Suspended / Not suspended active, Branch: `main`.

---

## 3. Cross-Repo Ecosystem Audit & Gap Inventory

| Repo Name | Current State / Active Issues | Missing Code / Functional Gaps | Severity / Risk |
|:---|:---|:---|:---:|
| **Conxian/conxian_market** | Active marketplace orchestration layer. 36 passing unit tests in `market-sdk`. Issue #8 open. | Missing runtime Telemetry & Treasury Health Watcher module (`monitoring.md`). | **P1 (Runtime Target - Session 50)** |
| **Conxian/Conxian** | Revenue activation & smart contracts. Issues #488, #527, #530, #532, #507, #500, #515 open. | Protocol fee collection (2%) and sBTC vault integrations pending on-chain contracts. | **P0 (Upstream)** |
| **Conxian/conxius-enclave-sdk** | Trust chain & TEE attestation. Issues #242, #241, #240, #202, #200 open. | AWS Nitro attestation, Android KeyMint, and root cert revocation incomplete. | **P0 (Upstream)** |
| **Conxian/conxius-platform** | Control plane & CI rulesets. Issues #1082, #854, #1223 open. | Unified CI script enforcement and push protection rulesets in evaluate mode. | **P1 (Upstream)** |
| **Conxian/conxius-wallet** | Wallet client & safety gate. Issues #444, #357, #356 open. | Centralized value-operation gate and mobile baseline verification open. | **P1 (Upstream)** |
| **Conxian/conxian-gateway** | Settlement rail ingress. Issues #306, #228, #220 closed. | Market-facing REST endpoints operational; RGB stash and DLC CET follow-ons pending. | **P2 (Upstream)** |
| **Conxian/conxian-business** | Business strategy & BOS research. Strategic issue #989 active. | Strategy docs aligned with yield matrix (80/10/10) and treasury management. | **P2 (Governance)** |
| **Conxian/lib-conxian-core** | Core Rust/TS primitives. All tracked core items closed. | Shared types (`TrustTier`, `SettlementRail`, `ChainId`) stable in `core_types.ts`. | **Stable** |

---

## 4. Knowledge Base Candidate Evaluation & Scoring Matrix

To maintain an end-to-end cycle in each session, candidate runtime implementations specified in `docs/knowledge_base/` were evaluated and scored based on:
1. **Strategic Value (30%)**: Alignment with Hardening the Core & Productive AI vision.
2. **Technical Feasibility (30%)**: Implementability within the `market-sdk` package without introducing unsafe mocks or external heavy runtime dependencies.
3. **Ecosystem Unblocker (20%)**: Ability to provide immediate observable health metrics to market operators, treasury managers, and agent builders.
4. **Specification Maturity (20%)**: Completeness of the KB document (SOPs, rule engines, type definitions).

### Candidate Scoring Table

| Candidate Module | Source KB Spec | Strategic Value (30) | Technical Feasibility (30) | Unblocker Score (20) | Spec Maturity (20) | Total Score (100) | Rank / Action |
|:---|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| **SLA Bounty & Gap Card Engine** | `docs/knowledge_base/sla_bounty_system.md` | 28 | 29 | 18 | 19 | **94** | Completed in Session 49 (`sla_engine.ts`) |
| **Telemetry & Treasury Health Watcher** | `docs/knowledge_base/monitoring.md` | 28 | 28 | 18 | 18 | **92** | **#1 — INIT BEST CANDIDATE (Session 50)** |
| **TrustTier Pricing Middleware** | `docs/knowledge_base/trust_tier_pricing.md` | 27 | 25 | 17 | 18 | **87** | Implemented in `fee_calculator.ts` & `verification.ts` |
| **BOS Yield Splitter (80/10/10)** | `docs/knowledge_base/operating_manual.md` | 25 | 26 | 14 | 16 | **81** | Integrated in `fee_calculator.ts` |

---

## 5. Best Candidate Analysis: Telemetry & Treasury Health Watcher (`monitoring_watcher.ts`)

`docs/knowledge_base/monitoring.md` defines an autonomous telemetry watcher and treasury health evaluator that serves as the nervous system of autonomous settlement.

### Implementation Scope for `monitoring_watcher.ts`:
1. **sBTC Peg & Signer Health Watcher**:
   - Peg status evaluation (ratio, green ≥0.995, yellow 0.98–0.995, red <0.98).
   - Signer quorum health (green ≥90%, yellow 70–90%, red <70%).
2. **Fedimint Mint Health Evaluator**:
   - Guardian threshold check (green ≥ threshold, yellow threshold - 1, red < threshold - 1).
   - E-cash to liquidity ratio (green ≤80%, yellow 80–95%, red >95%).
3. **Babylon Staking Health Evaluator**:
   - Treasury staking concentration (green ≤25%, yellow 25–35%, red >35%).
   - Provider slashing counter & yield deviation evaluator.
4. **Treasury Health & Runway Calculator**:
   - Compute runway in months (`fiatBalance + cryptoInFiat / monthlyBurnRate`).
   - Evaluate health status: Green (12+ months), Warning (6–12 months), Critical (<6 months).
   - Asset allocation split validation against target ratio (40% Stablecoins, 30% RWA, 20% Liquid Staking, 10% Native).
5. **Unified Health Snapshot & Alert Generator**:
   - Aggregates status across sBTC, Fedimint, Babylon, Treasury, and SLA Gap Card health into a single deterministic report.

---

## 6. End-to-End Session Cycle Management

To ensure continuity across future agentic sessions:
- **Research Expansion**: Documented in `SESSION_50_RESEARCH_EXPANSION_AND_GAP_MATRIX.md`.
- **Implementation Tracker**: Updated in `IMPLEMENTATION_TRACKER.md`.
- **Strategic Roadmap**: Synchronized in `ROADMAP.md`.
- **Verification**: Gated by `npm test` and `npm run typecheck`.

---
*End of Session 50 Research Expansion Document.*
