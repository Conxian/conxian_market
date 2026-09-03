# Conxian Ecosystem & Market SDK Roadmap

> **Current Session:** Session 54
> **Strategic Directive:** Hardening the Core (Functional Settlement, Non-Custodial Value Routing & M2M Economy Orchestration)
> **Primary Orchestration Repo:** `conxian_market` (`@conxian/market-sdk`)

---

## 🎯 Executive Vision
The Conxian Market SDK serves as the value, settlement, and SLA enforcement layer for the Conxian Ecosystem. Rather than building proprietary smart contracts or AI agents, Conxian operates as a **Market-Agnostic, Zero-Custody Value Router** that orchestrates and monetizes industrial agent labor through programmable escrow (ERC-8183 / CJCS Job Cards), multi-rail Bitcoin/Stacks settlement, TrustTier verification, autonomous SLA enforcement, telemetry monitoring, and BYO DeFi protocol routing.

---

## 🧭 Multi-Session Execution Roadmap

### Session 48 — Foundation & Alignment
- [x] Per-repo needs analysis across all 16 ecosystem repositories.
- [x] Document repository boundary separation (Conxian/Conxian as reference, conxian_market as runtime marketplace).
- [x] Define TrustTier pricing matrix, SLA rulesets, and 80/10/10 BOS yield model in `docs/knowledge_base/`.

### Session 49 — Autonomous SLA Enforcement Engine
- [x] Research expansion and cross-repo gap analysis (`SESSION_49_RESEARCH_EXPANSION_AND_GAP_MATRIX.md`).
- [x] Candidate Scoring: SLA Bounty Engine scored #1 (94/100).
- [x] Implemented `SlaEngine` in `src/sla_engine.ts`.

### Session 50 — Telemetry & Treasury Health Watcher
- [x] Full ecosystem audit across Neon DBs (`orange-paper-76209725`, etc.), Supabase instances (`yauldfcpswnufgwfvnlr`), and Render deployments.
- [x] Research expansion and candidate scoring matrix (`SESSION_50_RESEARCH_EXPANSION_AND_GAP_MATRIX.md`).
- [x] Implemented `MonitoringWatcher` in `src/monitoring_watcher.ts`.

### Session 51 — TrustTier Pricing & Routing Middleware Pipeline
- [x] Research expansion and gap analysis (`SESSION_51_RESEARCH_EXPANSION_AND_GAP_MATRIX.md`).
- [x] Implemented `TrustTierMiddleware` in `src/trust_tier_middleware.ts`.

### Session 52 — BOS Yield Splitter & Thin Orchestrator Guard
- [x] Research expansion and gap analysis (`SESSION_52_RESEARCH_EXPANSION_AND_GAP_MATRIX.md`).
- [x] Implemented `BosYieldSplitter` in `src/bos_yield_splitter.ts`.

### Session 53 — Market-Agnostic Non-Custodial Router & Conxian/Conxian Deprecation
- [x] Synthesize ecosystem audit across all repos, databases, Render web services, open PRs, and active issues.
- [x] Research expansion and gap analysis (`SESSION_53_RESEARCH_EXPANSION_AND_GAP_MATRIX.md`).
- [x] Candidate Scoring: Market-Agnostic Non-Custodial Router scored #1 (97/100).
- [x] Formulate formal architectural advisory to **Deprecate & Archive `Conxian/Conxian`** in favor of external BYO DeFi adapters and `@conxian/market-sdk` orchestration.
- [x] Implemented `MarketAgnosticRouter` in `src/market_agnostic_router.ts`.

### Session 54 — ERC-8183 Job Card Escrow & Programmable Settlement Engine (CURRENT)
- [x] Synthesize ecosystem audit across all repos, databases, Render web services, open PRs, and active issues.
- [x] Research expansion and gap analysis (`SESSION_54_RESEARCH_EXPANSION_AND_GAP_MATRIX.md`).
- [x] Candidate Scoring: ERC-8183 Job Card Escrow Engine scored #1 (98/100).
- [x] Implemented `JobCardEscrowEngine` in `src/job_card_escrow.ts`:
  1. Non-custodial escrow creation with zero-custody validation.
  2. Output submission with payload hash and attestation proof verification.
  3. SLA-integrated release with protocol fee calculation (`FeeCalculator`), 80/10/10 yield distribution (`BosYieldSplitter`), and M2M rail payment routing (`MarketAgnosticRouter`).
  4. Dispute resolution, gap card auto-bounty generation (`SlaEngine`), and non-custodial client refund distribution.
- [x] Wired `JobCardEscrowEngine` into `ConxianMarketSDK` bridge and exported in `src/index.ts`.
- [x] Added comprehensive unit tests (`tests/job_card_escrow.test.ts`), verifying 77 total passing tests across 11 test suites with 100% type safety (`npm run typecheck`).

---

## 🔮 Upstream Dependencies & Future Work

1. **Upstream Enclave Attestation (`conxius-enclave-sdk`)**:
   - Resolve P0 blockers [#242](https://github.com/Conxian/Conxian/issues/242) (AWS Nitro), [#241](https://github.com/Conxian/Conxian/issues/241) (Android KeyMint), and [#240](https://github.com/Conxian/Conxian/issues/240) (Attestation Roots) to allow Strict and Managed trust tier promotion without P0 degradation.
2. **Upstream CI & Org Rulesets (`conxius-platform`)**:
   - Enforce unified CI validation scripts and rulesets ([#1082](https://github.com/Conxian/conxius-platform/issues/1082), [#854](https://github.com/Conxian/conxius-platform/issues/854)).

---
*Roadmap maintained and updated per session cycle.*
