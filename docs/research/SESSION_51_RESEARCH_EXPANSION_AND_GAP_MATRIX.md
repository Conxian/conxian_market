# Session 51: Cross-Repo Research Expansion & Gap Synthesis Matrix

> **Generated:** 2026-08-20 | **Session:** 51 | **Status:** Active
> **Scope:** Ecosystem-wide Audit across 10 Repos, Managed DBs (Neon & Supabase), Render Cloud, Open PRs, Missing Components, and Candidate Scoring for Knowledge Base Runtime Implementation.

---

## 1. Executive Summary & Research Scope

In Session 51, a comprehensive research expansion and gap analysis was executed across the Conxian ecosystem, covering repository structures, cloud database infrastructure (Neon Postgres projects & Supabase instances), Render deployment services, Knowledge Base manuals, and cross-repo issue backlogs.

The strategic directive continues to focus on **Hardening the Core**: completing functional settlement, fee collection, SLA enforcement, and treasury health while preserving a lean, high-utility marketplace orchestration layer (`market-sdk`).

---

## 2. Infrastructure & Organization Asset Audit

### A. Managed Database Infrastructure
- **Neon Cloud Postgres**:
  - `orange-paper-76209725` (*Conxian Nexus* - PG17): Primary production database. Schemas: `cnx_bos`, `erp_mock`, `affiliate`, `neon_auth`.
  - `noisy-flower-17484435` (*Business Operating System* - PG18): Active BOS analytical data store.
  - `small-math-44741750` (*market* - PG18): Marketplace event & settlement log store.
  - `sparkling-sunset-69236559` (*corelibs* - PG18), `weathered-night-98492579` (*Software dev kit* - PG18), `noisy-cloud-41146057` (*Gateway* - PG18).
- **Supabase Cloud Postgres**:
  - `yauldfcpswnufgwfvnlr` (*Conxian BOS* - PG17): Active health status. Tables: `ma_milestones`, `exit_velocity`, `deployment_efficiency`, `runway_metrics`, `deai_requests`, `ip_audit_logs`, `ats_violations`.
  - `iczqutrbbfudfzfplymc` (*Conxian-platform* - PG17): Active health status. Telemetry & audit mirror store.

### B. Render Cloud Deployments
- **Service**: `conxian-labs-site` (`srv-d9ndhr2jnfac73as7te0`)
  - **URL**: `https://conxian-labs-site-xhqq.onrender.com`
  - **Status**: Active deployment on `main`.

---

## 3. Cross-Repo Ecosystem Audit & Gap Inventory

| Repo Name | Current State / Active Issues | Missing Code / Functional Gaps | Severity / Risk |
|:---|:---|:---|:---:|
| **Conxian/conxian_market** | Active marketplace orchestration layer. 46 passing tests in `market-sdk`. Issue #8 open. | Missing TrustTier Pricing & Routing Middleware (`trust_tier_pricing.md`). | **P1 (Runtime Target - Session 51)** |
| **Conxian/Conxian** | Protocol fee collection & smart contracts. Issues #488, #527, #530, #532, #507, #500, #515 open. | Protocol fee collection (2%) and sBTC vault integrations pending on-chain contracts. | **P0 (Upstream)** |
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
2. **Technical Feasibility (30%)**: Implementability within the `market-sdk` package without introducing external heavy dependencies or unsafe mocks.
3. **Ecosystem Unblocker (20%)**: Ability to provide immediate value to market operators, builders, and gateways.
4. **Specification Maturity (20%)**: Completeness of the KB document (SOPs, rule engines, type definitions).

### Candidate Scoring Table

| Candidate Module | Source KB Spec | Strategic Value (30) | Technical Feasibility (30) | Unblocker Score (20) | Spec Maturity (20) | Total Score (100) | Rank / Action |
|:---|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| **SLA Bounty & Gap Card Engine** | `docs/knowledge_base/sla_bounty_system.md` | 28 | 29 | 18 | 19 | **94** | Completed in Session 49 (`sla_engine.ts`) |
| **Telemetry & Treasury Health Watcher** | `docs/knowledge_base/monitoring.md` | 28 | 28 | 18 | 18 | **92** | Completed in Session 50 (`monitoring_watcher.ts`) |
| **TrustTier Pricing & Routing Middleware** | `docs/knowledge_base/trust_tier_pricing.md` | 27 | 28 | 17 | 18 | **90** | **#1 — INIT BEST CANDIDATE (Session 51)** |
| **BOS Yield Splitter (80/10/10)** | `docs/knowledge_base/operating_manual.md` | 25 | 26 | 14 | 16 | **81** | Integrated in `fee_calculator.ts` |

---

## 5. Best Candidate Analysis: TrustTier Pricing & Routing Middleware (`trust_tier_middleware.ts`)

`docs/knowledge_base/trust_tier_pricing.md` defines an integrated pricing and routing middleware pipeline that connects request verification to settlement execution.

### Implementation Scope for `trust_tier_middleware.ts`:
1. **Pipeline Execution Engine**:
   - `executePipeline(request: TrustTierPipelineRequest)`: Orchestrates the 4-stage pipeline (Detect Tier → Calculate Fee & Split → Resolve SLA Template → Route Settlement Rail & Wire Headers).
2. **Tier Detection Component**:
   - Evaluates headers (`x-conxian-tee-proof`, `x-conxian-zk-proof`, `x-conxian-enclave-attestation`, `x-conxian-light-proof`) and applies feature-flag aware P0 gap degradation.
3. **Fee Schedule & 80/10/10 Split Resolver**:
   - Calculates protocol fee (Strict: negotiated, Managed: 2.0% + 0.5% premium = 2.5%, Expedient: 2.0%, ObserverOnly: 0%).
   - Distributes fee according to 50% Operations Treasury, 30% Founders Vesting, 20% Ecosystem Growth.
4. **SLA Template Resolver**:
   - Returns structured SLA guarantees and penalties for each trust tier (Strict: 99.99% uptime, 100ms latency P95; Managed: 99.9% uptime, 500ms latency; Expedient: 99% uptime, 2s latency; ObserverOnly: discovery only).
5. **Rail Routing & Wire Header Generator**:
   - Matches request to eligible settlement rails (`SettlementRail.EnclaveAttested`, `SBTC`, `Statechain`, `RGB`, `Babylon`, `Lightning`, `Fedimint`, `ALEX`, `EVM`).
   - Generates protocol wire headers (`x-conxian-tier`, `x-conxian-rail`, `x-conxian-fee-bps`, `x-conxian-fee-sat`, `x-conxian-sla-tier`).

---

## 6. End-to-End Session Cycle Management

To ensure continuity across future agentic sessions:
- **Research Expansion**: Documented in `SESSION_51_RESEARCH_EXPANSION_AND_GAP_MATRIX.md`.
- **Implementation Tracker**: Updated in `IMPLEMENTATION_TRACKER.md`.
- **Strategic Roadmap**: Synchronized in `ROADMAP.md`.
- **Verification**: Gated by `npm test` and `npm run typecheck`.

---
*End of Session 51 Research Expansion Document.*
