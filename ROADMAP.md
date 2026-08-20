# Conxian Ecosystem & Market SDK Roadmap

> **Current Session:** Session 51
> **Strategic Directive:** Hardening the Core (Functional Settlement, Fee Collection, SLA Enforcement & Telemetry Health)
> **Primary Orchestration Repo:** `conxian_market` (`@conxian/market-sdk`)

---

## 🎯 Executive Vision
The Conxian Market SDK serves as the value, settlement, and SLA enforcement layer for the Conxian Ecosystem. Rather than building proprietary AI agents, Conxian orchestrates and monetizes industrial, high-utility agent labor through programmable escrow (ERC-8183 / CJCS Job Cards), multi-rail Bitcoin/Stacks settlement, TrustTier verification, autonomous SLA enforcement, and telemetry monitoring.

---

## 🧭 Multi-Session Execution Roadmap

### Session 48 — Foundation & Alignment
- [x] Per-repo needs analysis across all 16 ecosystem repositories.
- [x] Document repository boundary separation (Conxian/Conxian as reference, conxian_market as runtime marketplace).
- [x] Define TrustTier pricing matrix, SLA rulesets, and 80/10/10 BOS yield model in `docs/knowledge_base/`.

### Session 49 — Autonomous SLA Enforcement Engine
- [x] Research expansion and cross-repo gap analysis (`SESSION_49_RESEARCH_EXPANSION_AND_GAP_MATRIX.md`).
- [x] Candidate Scoring: SLA Bounty Engine scored #1 (94/100).
- [x] Implemented `SlaEngine` in `src/sla_engine.ts` for automated CJCS Job Card evaluation, delay penalties, gap card generation, and builder reputation tracking.
- [x] Wired `SlaEngine` into `ConxianMarketSDK` bridge and main exports.

### Session 50 — Telemetry & Treasury Health Watcher
- [x] Full ecosystem audit across Neon DBs (`orange-paper-76209725`, etc.), Supabase instances (`yauldfcpswnufgwfvnlr`), and Render deployments.
- [x] Research expansion and candidate scoring matrix (`SESSION_50_RESEARCH_EXPANSION_AND_GAP_MATRIX.md`).
- [x] Candidate Scoring: Telemetry & Treasury Health Watcher scored #2 (92/100).
- [x] Implemented `MonitoringWatcher` in `src/monitoring_watcher.ts` covering sBTC peg status, Fedimint mint health, Babylon staking concentration, and 12-month treasury runway calculations.
- [x] Wired `MonitoringWatcher` into `ConxianMarketSDK` bridge and main exports.

### Session 51 — TrustTier Pricing & Routing Middleware Pipeline (CURRENT)
- [x] Synthesize ecosystem audit across all repos, databases, Render web services, open PRs, and active issues (#488, #527, #530, #532, #1082, #242).
- [x] Research expansion and gap analysis (`SESSION_51_RESEARCH_EXPANSION_AND_GAP_MATRIX.md`).
- [x] Candidate Scoring: TrustTier Pricing & Routing Middleware scored #3 (90/100).
- [x] Implemented `TrustTierMiddleware` in `src/trust_tier_middleware.ts` per `trust_tier_pricing.md`:
  1. Tier Detection with feature-flag aware P0 gap degradation.
  2. Tier-based fee calculator with 80/10/10 yield split distribution.
  3. SLA Template resolution (Strict, Managed, Expedient, ObserverOnly).
  4. Multi-rail routing matrix and HTTP wire header generator (`x-conxian-tier`, `x-conxian-rail`, `x-conxian-fee-bps`, `x-conxian-fee-sat`, `x-conxian-sla-tier`, `x-conxian-p0-degraded`).
- [x] Wired `TrustTierMiddleware` into `ConxianMarketSDK` bridge and exported in `src/index.ts`.
- [x] Added unit tests (`tests/trust_tier_middleware.test.ts`), verifying 54 total passing tests across 7 test suites with 100% type safety (`npm run typecheck`).

---

## 🔮 Upstream Dependencies & Future Work

1. **Upstream Protocol Fee Activation (`Conxian/Conxian`)**:
   - Resolve Issues [#488](https://github.com/Conxian/Conxian/issues/488) (2% protocol fee collection) and [#507](https://github.com/Conxian/Conxian/issues/507) (sBTC vault integration).
2. **Upstream Enclave Attestation (`conxius-enclave-sdk`)**:
   - Resolve P0 blockers [#242](https://github.com/Conxian/Conxian/issues/242) (AWS Nitro), [#241](https://github.com/Conxian/Conxian/issues/241) (Android KeyMint), and [#240](https://github.com/Conxian/Conxian/issues/240) (Attestation Roots) to allow Strict and Managed trust tier promotion without P0 degradation.
3. **Upstream CI & Org Rulesets (`conxius-platform`)**:
   - Enforce unified CI validation scripts and rulesets ([#1082](https://github.com/Conxian/conxius-platform/issues/1082), [#854](https://github.com/Conxian/conxius-platform/issues/854)).

---
*Roadmap maintained and updated per session cycle.*
