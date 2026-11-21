# Implementation Tracker — Session 76 Update

> ⚠️ **SUPERSEDED (2026-11-14, ADR-007).** The fee/revenue model in this document is
> **historical**. The accepted model is **two products** — rail (ADR-005 dynamic rate)
> and matched job (**10% take, builder keeps 90%**) — under **one 50/30/20 split rule on
> the take**. There is no 2% fee, no 80/10/10, and no 5-stream revenue (no collection
> path). Numbers below are retained for history. Authoritative:
> `docs/adr/ADR_007_TWO_PRODUCT_RATE_MODEL.md`.


> **Updated:** 2026-10-17 | **Session:** 76 | **Scope:** Decentralized Systems Production Readiness, Resilient Issue Fallback & Opportunity Engine
>
> **Status note (2026-11-14):** the "current org issue reality" list below is a
> Session 76 snapshot and several entries have since closed (enclave-sdk #242/#198,
> wallet #444, platform #1082). See `AGENTS.md` for the verified P0 gap state.
>
> **Fee-model note (2026-11-14):** references to a 2% protocol fee below are
> superseded by ADR-005 (dynamic hybrid: 0.50%→0.10% + per-rail floor). See
> `docs/research/FEE_DESTINATION_AND_CUSTODY.md`.

---

## Current org issue reality

> **Alignment note (2026-11-21):** this list is a Session 76 snapshot with later status
> annotations. The authoritative list is the live GitHub issue tracker. The `Conxian` repository
> was deleted, not archived, and no issue links may point at it.

The live issue set shows this direct implementation path is active and relevant:

1. **`Conxian` (retired)** — **DELETED**: the former Stacks-native protocol repository no longer
   exists. On-chain smart contract development is retired; settlement routing and value
   orchestration live in `conxian_market` (`@conxian/market-sdk`) via external BYO DeFi protocols.
2. **conxian-gateway** — [#306](https://github.com/Conxian/conxian-gateway/issues/306) CLOSED, [#228](https://github.com/Conxian/conxian-gateway/issues/228) CLOSED, [#220](https://github.com/Conxian/conxian-gateway/issues/220) CLOSED; gateway client integration active in market-sdk.
3. **conxius-platform** — [#1082](https://github.com/Conxian/conxius-platform/issues/1082) CLOSED, [#854](https://github.com/Conxian/conxius-platform/issues/854) CLOSED, [#1223](https://github.com/Conxian/conxius-platform/issues/1223) CLOSED, [#1212](https://github.com/Conxian/conxius-platform/issues/1212) CLOSED
4. **conxius-enclave-sdk** — [#242](https://github.com/Conxian/conxius-enclave-sdk/issues/242) CLOSED, [#241](https://github.com/Conxian/conxius-enclave-sdk/issues/241) **OPEN**, [#240](https://github.com/Conxian/conxius-enclave-sdk/issues/240) **OPEN**, [#202](https://github.com/Conxian/conxius-enclave-sdk/issues/202) **OPEN**, [#200](https://github.com/Conxian/conxius-enclave-sdk/issues/200) CLOSED, [#267](https://github.com/Conxian/conxius-enclave-sdk/issues/267) CLOSED, [#271](https://github.com/Conxian/conxius-enclave-sdk/issues/271) CLOSED
5. **conxius-wallet** — [#444](https://github.com/Conxian/conxius-wallet/issues/444) CLOSED, [#357](https://github.com/Conxian/conxius-wallet/issues/357) **OPEN**, [#356](https://github.com/Conxian/conxius-wallet/issues/356) CLOSED
6. **conxian-business** — strategy research active on [#989](https://github.com/Conxian/conxian-business/issues/989) (**OPEN**).

> Issue states above verified against the GitHub API on 2026-11-14.
7. **conxian_market** — value layer runtime active:
   - Candidate #1 (`SLA Bounty Engine`): `sla_engine.ts` (Session 49).
   - Candidate #2 (`Telemetry & Treasury Health Watcher`): `monitoring_watcher.ts` (Session 50).
   - Candidate #3 (`TrustTier Pricing & Routing Middleware`): `trust_tier_middleware.ts` (Session 51).
   - Candidate #4 (`BOS Yield Splitter & Thin Orchestrator Guard`): `bos_yield_splitter.ts` (Session 52).
   - Candidate #5 (`Market-Agnostic Non-Custodial Router & BYO DeFi`): `market_agnostic_router.ts` (Session 53).
   - Candidate #6 (`ERC-8183 Job Card Escrow Engine`): `job_card_escrow.ts` (Session 54).
   - Candidate #7 (`Attestation-Aware Proof Verification & Fallback`): `verification.ts` (Session 55).
   - Candidate #8 (`Multi-Rail x402 Escrow Gateway & Settlement Bridge`): `x402_facade.ts` (Session 56).
   - Candidate #9 (`SLA Gap Auto-Resolution & Reputation Recovery Engine`): `sla_engine.ts` (Session 57).
   - Candidate #10 (`TrustTier Upgrade & Downgrade Lifecycle Engine`): `trust_tier_middleware.ts` (Session 58).
   - Candidate #11 (`Automated SLA Fee Penalty Settlement & Escrow Penalty Clawback Engine`): `sla_engine.ts` (Session 59).
   - Candidate #12 (`Treasury Multi-Sig Governance Timelock & Founder Compensation Escrow Controller`): `bos_yield_splitter.ts` (Session 60).
   - Candidate #13 (`Unified Client Installation & Connectivity Orchestrator Engine`): `client_onboarding.ts` (Session 61).
   - Candidate #14 (`Real-Time SLA Telemetry Watcher`): `monitoring_watcher.ts` (Session 62).
   - Candidate #15 (`Client Entitlements & Deployment Engine`): `client_onboarding.ts` (Session 63).
   - Candidate #16 (`Master Reconnaissance, Architecture Review & Domain Firewall Engine`): `client_onboarding.ts` (Session 64).
   - Candidate #17 (`Enterprise SLA Diagnostics`): `client_onboarding.ts` (Session 68).
   - Candidate #18 (`Enterprise Tiered SLA Policy Engine`): `client_onboarding.ts` (Session 69).
   - Candidate #19 (`ERC-8004 & MCP-402 SDK Bridge Integration`): `sdk_bridge.ts` (Session 70).
   - Candidate #20 (`Dynamic Hybrid Fee Floor Engine`): `fee_calculator.ts` (Session 71).
   - Candidate #21 (`Dynamic Fee Report & Mempool Load Adapter`): `fee_calculator.ts` (Session 72).
   - Candidate #22 (`CXIP-1317 Org-Wide Upgrade Proposal Analysis`): `docs/research/` (Session 74).
   - Candidate #23 (`Multi-Dimensional Scoring, Multi-Cloud Telemetry & BitVM3 Fraud Proof Engine`): `src/multi_dimensional_scoring.ts`, `src/monitoring_watcher.ts`, `src/verification.ts`, `src/sdk_bridge.ts` (Session 75).
   - Candidate #24 (`Decentralized Systems Production Readiness, Resilient Issue Fallback & Opportunity Engine`): `src/decentralized_systems.ts`, `src/sdk_bridge.ts` (Session 76).

This repo remains focused on the value and orchestration layer while upstream repos resolve enabling infrastructure.

### Open issues at the 2026-11-21 snapshot

| Issue | Title |
| --- | --- |
| [#379](https://github.com/Conxian/conxian_market/issues/379) | Track: non-dilutive financing primitive (capped revenue-share assignment) |
| [#364](https://github.com/Conxian/conxian_market/issues/364) | P2: Provision SAB-TREASURY-MS (3-of-5) and DAO-TREASURY-MS (5-of-7) |
| [#363](https://github.com/Conxian/conxian_market/issues/363) | P3: Enable protocolFeeActive after a shadow-mode settlement verifies end to end |
| [#360](https://github.com/Conxian/conxian_market/issues/360) | P0: Deploy TREASURY-VAULT to Stacks testnet (SAB_DEPLOYER_MULTISIG) |
| [#278](https://github.com/Conxian/conxian_market/issues/278) | P3: Split market into MIT SDK + AGPL settlement/fee enforcement |
| [#263](https://github.com/Conxian/conxian_market/issues/263) | Ops posture: library-only surface, consumption gap, release automation, staged->main hold |
| [#252](https://github.com/Conxian/conxian_market/issues/252) | P1: Adopt org-wide business operations evidence contract |
| [#176](https://github.com/Conxian/conxian_market/issues/176) | P1: Define and verify x402 v2 and agent identity conformance contracts |
| [#159](https://github.com/Conxian/conxian_market/issues/159) | Real x402 subscription payment pointer + non-zero demand (managed tier) |

---

## Relevant active work list

| Repo | Issue / Component | Status | Notes |
|:-----|:------------------|:------:|:------|
| conxian_market | SLA Bounty Engine (`sla_engine.ts`) | **COMPLETED (S49)** | Scoring matrix candidate #1 from `sla_bounty_system.md`. |
| conxian_market | Monitoring Watcher (`monitoring_watcher.ts`) | **COMPLETED (S50)** | Scoring matrix candidate #2 from `monitoring.md`. |
| conxian_market | TrustTier Middleware (`trust_tier_middleware.ts`) | **COMPLETED (S51)** | Scoring matrix candidate #3 from `trust_tier_pricing.md`. |
| conxian_market | BOS Yield Splitter (`bos_yield_splitter.ts`) | **COMPLETED (S52)** | Scoring matrix candidate #4 from `operating_manual.md`. |
| conxian_market | Non-Custodial Router (`market_agnostic_router.ts`) | **COMPLETED (S53)** | Scoring matrix candidate #5 from `GOVERNANCE.md`. |
| conxian_market | ERC-8183 Escrow Engine (`job_card_escrow.ts`) | **COMPLETED (S54)** | Scoring matrix candidate #6 from `trust_tier_pricing.md`. |
| conxian_market | Attestation Proof Verifier (`verification.ts`) | **COMPLETED (S55)** | Scoring matrix candidate #7 from `trust_tier_pricing.md`. |
| conxian_market | Multi-Rail x402 Escrow Gateway (`x402_facade.ts`) | **COMPLETED (S56)** | Scoring matrix candidate #8 from `operating_manual.md`. |
| conxian_market | SLA Gap Resolution & Recovery (`sla_engine.ts`) | **COMPLETED (S57)** | Scoring matrix candidate #1 from `sla_bounty_system.md`. |
| conxian_market | TrustTier Lifecycle Engine (`trust_tier_middleware.ts`) | **COMPLETED (S58)** | Scoring matrix candidate #1 from `trust_tier_pricing.md` Section 6. |
| conxian_market | SLA Fee Penalty & Clawback Engine (`sla_engine.ts`) | **COMPLETED (S59)** | Scoring matrix candidate #1 from `sla_bounty_system.md` Section 4. |
| conxian_market | Decentralized Systems Readiness Engine (`decentralized_systems.ts`) | **COMPLETED (S76)** | Scoring candidate #24; multi-rail readiness, issue fallback & opportunity. |
| conxian_market | Treasury Timelock & Founder Escrow (`bos_yield_splitter.ts`) | **COMPLETED (S60)** | Scoring matrix candidate #1 from `operating_manual.md` Section 3.C & 3.D. |
| conxian_market | Unified Client Installer (`client_onboarding.ts`) | **COMPLETED (S61)** | Scoring matrix candidate #1 from `CLIENT_ONBOARDING_AND_UNIFIED_INSTALLER_ARCHITECTURE.md`. |
| conxian_market | Real-Time SLA Telemetry Watcher (`monitoring_watcher.ts`) | **COMPLETED (S62)** | Scoring matrix candidate #1 from `monitoring.md` §5 & `sla_bounty_system.md`. |
| conxian_market | Client Entitlements & Deployment Engine (`client_onboarding.ts`) | **COMPLETED (S63)** | Scoring matrix candidate #1 from `CLIENT_ONBOARDING_AND_UNIFIED_INSTALLER_ARCHITECTURE.md`. |
| conxian_market | Master Reconnaissance & Domain Firewall Engine (`client_onboarding.ts`) | **COMPLETED (S64)** | Master Reconnaissance & B2B Architecture Review (`MASTER_RECONNAISSANCE_AND_ARCHITECTURE_REVIEW.md`). |
| conxian_market | Enterprise SLA Diagnostics (`client_onboarding.ts`) | **COMPLETED (S68)** | Scoring matrix candidate #1 (CAN-68-A) from Session 68 research expansion. |
| conxian_market | Enterprise Tiered SLA Policy Engine (`client_onboarding.ts`) | **COMPLETED (S69)** | Scoring matrix candidate #1 (CAN-69-A) from Session 69 research expansion. |
| conxian_market | ERC-8004 & MCP-402 SDK Bridge Integration (`sdk_bridge.ts`) | **COMPLETED (S70)** | Scoring matrix candidate #1 (CAN-70-A) from Session 70 research expansion. |
| conxian_market | Dynamic Hybrid Fee Floor Engine (`fee_calculator.ts`) | **COMPLETED (S71)** | Dynamic hybrid satoshi floors, 30-day volume decay, load multiplier, ADR-004. |
| conxian_market | Dynamic Fee Report & Mempool Load Adapter (`fee_calculator.ts`) | **COMPLETED (S72)** | Dynamic fee report aggregator and mempool fee rate load factor adapter (ADR-004). |
| conxian_market | CXIP-1317 Org-Wide Upgrade Research Expansion (`docs/research/`) | **COMPLETED (S74)** | Comprehensive analysis of CXIP-1317, turnkey asset matrix, and research expansion. |
| conxian_market | Multi-Dimensional Scoring, Multi-Cloud Telemetry & BitVM3 Engine (`src/`) | **RESEARCH / UNQUALIFIED (S75)** | Scoring, valuation and telemetry are candidate models. BitVM3 backend unavailable; metadata cannot establish verification or measured costs (CON-1437/1440/1436). |
| Conxian | Monorepo Smart Contracts | **DEPRECATED** | Recommended for archiving in favor of BYO DeFi adapters. |

---
