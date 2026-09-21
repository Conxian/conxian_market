# Session 53: Market-Agnostic Non-Custodial Architecture & Conxian/Conxian Deprecation Advisory

> **Generated:** 2026-08-20 | **Session:** 53 | **Status:** Active
> **Scope:** Full Ecosystem Review, Non-Custodial Routing Strategy, BYO DeFi Protocols, M2M Economy Expansion, and Conxian/Conxian Deprecation Advisory.

---

## 1. Executive Summary & Strategic Positioning

In Session 53, a deep architectural synthesis was conducted across the Conxian ecosystem, focusing on **Market-Agnostic Non-Custodial Routing** and the strategic deprecation/archiving of proprietary smart contract infrastructure (`Conxian/Conxian`).

### Core Strategic Mandates:
1. **Zero Custody Doctrine**: Conxian never holds, touches, or custodies client funds or private data. All funds remain in user-controlled wallets, non-custodial smart contracts (ERC-8183, sBTC vaults), or lightning/Fedimint channels. Conxian acts strictly as a **Non-Custodial Value & Message Router**.
2. **BYO DeFi Integration**: Rather than building or maintaining proprietary AMMs, liquidity pools, or vaults, Conxian routes transactions to established, audited external protocols selected by the client (ALEX, Uniswap, Fedimint, Lightning, Citrea, Base, Polygon).
3. **`Conxian/Conxian` Deprecation Advisory**: Rebuilds/maintains of custom Solidity/Clarity smart contracts in `Conxian/Conxian` introduce heavy maintenance debt, security audit liabilities, and bootstrapping drag. Formal governance recommendation is to **Deprecate & Archive `Conxian/Conxian`** and rely entirely on external DeFi adapters and standard escrow interfaces (ERC-8183).
4. **Full M2M Economy Support**: Autonomous AI agents communicate, request work, negotiate trust tiers, and settle M2M payments via MCP (Model Context Protocol) without human intervention or centralized hub intermediation.

---

## 2. Infrastructure & Organization Asset Audit

### A. Managed Database Infrastructure
- **Neon Cloud Postgres**:
  - `orange-paper-76209725` (*Conxian Nexus* - PG17): Primary production metadata database. Schemas: `cnx_bos`, `erp_mock`, `affiliate`, `neon_auth`.
  - `noisy-flower-17484435` (*Business Operating System* - PG18): Active BOS analytical store.
  - `small-math-44741750` (*market* - PG18): Marketplace event & settlement log store.
- **Supabase Cloud Postgres**:
  - `yauldfcpswnufgwfvnlr` (*Conxian BOS* - PG17): Active health status. Tables: `ma_milestones`, `exit_velocity`, `deployment_efficiency`, `runway_metrics`, `deai_requests`, `ip_audit_logs`, `ats_violations`.
  - `iczqutrbbfudfzfplymc` (*Conxian-platform* - PG17): Telemetry & audit mirror store.

### B. Render Cloud Deployments
- **Service**: `conxian-labs-site` (`srv-d9ndhr2jnfac73as7te0`)
  - **URL**: `https://conxian-labs-site-xhqq.onrender.com`
  - **Status**: Active deployment on `main`.

---

## 3. Cross-Repo Ecosystem Audit & Deprecation Roadmap

| Repo Name | Current Role | Strategic Recommendation | Action Plan |
|:---|:---|:---|:---|
| **Conxian/conxian_market** | Value layer & orchestration SDK (`@conxian/market-sdk`). | **ACTIVE PRIMARY HUB** | Maintain as lean, non-custodial routing and SLA enforcement layer. |
| **Conxian/Conxian** | Monorepo containing legacy contracts & orchestrator stubs. | **DEPRECATED / ARCHIVED** | Freeze development. Migrate all active interfaces to `conxian_market` and external DeFi adapters. |
| **Conxian/conxius-enclave-sdk** | TEE attestation & enclave key handling. | **ACTIVE SECURITY DEP** | Enforce BYOK key isolation and attestation for Strict/Managed tiers. |
| **Conxian/conxian-gateway** | Settlement rail ingress & REST gateway. | **ACTIVE INGRESS DEP** | Route non-custodial REST requests to external rails. |
| **Conxian/conxius-platform** | Control plane & CI rulesets. | **ACTIVE DEPLOY DEP** | Enforce unified CI rulesets and push protection. |
| **Conxian/conxius-wallet** | Wallet client & safety gate. | **ACTIVE CLIENT DEP** | Enforce client-side signing and zero-custody wallet isolation. |

---

## 4. Knowledge Base Candidate Evaluation & Scoring Matrix

### Candidate Scoring Table

| Candidate Module | Source KB Spec | Strategic Value (30) | Technical Feasibility (30) | Unblocker Score (20) | Spec Maturity (20) | Total Score (100) | Rank / Action |
|:---|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| **SLA Bounty & Gap Card Engine** | `docs/knowledge_base/sla_bounty_system.md` | 28 | 29 | 18 | 19 | **94** | Completed in Session 49 (`sla_engine.ts`) |
| **Telemetry & Treasury Health Watcher** | `docs/knowledge_base/monitoring.md` | 28 | 28 | 18 | 18 | **92** | Completed in Session 50 (`monitoring_watcher.ts`) |
| **TrustTier Pricing & Routing Middleware** | `docs/knowledge_base/trust_tier_pricing.md` | 27 | 28 | 17 | 18 | **90** | Completed in Session 51 (`trust_tier_middleware.ts`) |
| **BOS Yield Splitter & Thin Orchestrator Guard** | `docs/knowledge_base/operating_manual.md` | 26 | 28 | 16 | 17 | **87** | Completed in Session 52 (`bos_yield_splitter.ts`) |
| **Market-Agnostic Non-Custodial Router** | `docs/GOVERNANCE.md` & `operating_manual.md` | 30 | 29 | 19 | 19 | **97** | **#1 — INIT BEST CANDIDATE (Session 53)** |

---

## 5. Best Candidate Analysis: Market-Agnostic Non-Custodial Router (`market_agnostic_router.ts`)

`docs/GOVERNANCE.md` and `docs/knowledge_base/operating_manual.md` establish that Conxian is a **Market-Agnostic, Zero-Custody Value Router**.

### Implementation Scope for `market_agnostic_router.ts`:
1. **Zero-Custody Validator**:
   - `validateZeroCustody(request: NonCustodialSettlementRequest)`: Verifies that funds are held in client-managed wallets or external smart contracts, ensuring Conxian never holds private keys, funds, or unencrypted client data.
2. **BYO DeFi Protocol Adapter Resolver**:
   - `resolveDefiAdapter(rail: SettlementRail, preferredProtocol?: string)`: Resolves external DeFi protocols (ALEX sBTC/USDC pools, Uniswap v3/v4 ERC-8183 pools, Fedimint e-cash mints, Lightning routing nodes) without building proprietary contracts.
3. **Market-Agnostic M2M Handoff Engine**:
   - `routeM2mSettlement(fromAgent: string, toAgent: string, amountSat: bigint, rail: SettlementRail)`: Coordinates non-custodial M2M agent payments via MCP context and wire headers.
4. **`Conxian/Conxian` Deprecation Advisory Generator**:
   - `getDeprecationAdvisory()`: Emits formal architectural rationale and migration guidance for deprecating proprietary contracts in favor of external protocols.

---

## 6. End-to-End Session Cycle Management

To ensure continuity across future agentic sessions:
- **Research Expansion**: Documented in `SESSION_53_RESEARCH_EXPANSION_AND_GAP_MATRIX.md`.
- **Implementation Tracker**: Updated in `IMPLEMENTATION_TRACKER.md`.
- **Strategic Roadmap**: Synchronized in `ROADMAP.md`.
- **Verification**: Gated by `npm test` and `npm run typecheck`.

---
*End of Session 53 Research Expansion Document.*
