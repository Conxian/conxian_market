# Conxian Marketplace — Agent Knowledge Base

> **Type:** Autonomous agent operational memory
> **Repo:** Conxian/conxian_market | **Tier:** Reference Surface — Value Layer
> **Bootstrapped:** 2026-08-02 (Session 51) | **Authoritative:** docs/AGENTS.md supersedes

---

## Quick Reference

| Item | Value |
|------|-------|
| Role | Primary value capture — AI labor marketplace |
| Protocol Fee | 2% (50% Ops / 30% Founders / 20% Ecosystem) |
| Escrow | ERC-8183 programmable settlement |
| Settlement Rails | Lightning, Fedimint, Stacks/ALEX, Citrea, RGB, Statechain (Spark) |
| Trust Tiers | Strict (TEE+ZK) / Managed (Enclave) / Expedient (Light) / ObserverOnly (Free) |
| Wallet Custody | SAB multisigs (3-of-5 deployer, 3-of-5 payout, 2-of-3 emergency) |
| Key Package | `src/fee_calculator.ts` — CON-1427 tier/rail/fee computation |
| Auth Docs | `docs/AGENTS.md` (canonical), `docs/research/` (economic decisions) |
| Governance | Issue #9 — repository disposition pending |

## Authoritative Documents

Research chain (in order):
1. `docs/research/FUNDING_AND_ECONOMICS.md` — Fee model, revenue streams, break-even
2. `docs/research/SETTLEMENT_RAILS.md` — 6 rails, bridge status
3. `docs/research/FULL_SYSTEM_ARCHITECTURE.md` — Integration map, 17 modules
4. `docs/research/MARKET_UNIFIED_POSITIONING.md` — Enhancement matrix, gap closure
5. `docs/research/CROSS_REPO_GAP_ANALYSIS_SESSION_48.md` — 60 open issues, 23 code gaps
6. `docs/knowledge_base/` — monitoring, SLA bounty, trust tier pricing, operating manual

## CON-1427 Fee Calculator

| Component | Status |
|-----------|--------|
| Implementation plan | ✅ `docs/research/CON1427_IMPLEMENTATION_PLAN.md` |
| FeeCalculator (src) | ✅ 280 lines — tier detection, rail routing, fee report |
| Gateway bridge | ✅ `conxian-gateway:billing.rs` — ProtocolFeeRecord + 5 tests |
| Clarity contract | ⬜ Phase C — needs testnet deploy keys |
| Contract-bridge wire-up | ⬜ Phase C |
| Treasury auto-staking | ⬜ Phase D |

## P0 Gaps (from cross-repo analysis)

| # | Gap | Repo | Blocks |
|---|-----|------|--------|
| P0-1 | AWS Nitro attestation (#242) | enclave-sdk | Managed/Strict tiers |
| P0-2 | Android KeyMint (#241) | enclave-sdk | Mobile attestation |
| P0-3 | Attestation roots (#240) | enclave-sdk | Trust chain |
| P0-4 | CCTP fail-closed (#198) | enclave-sdk | Cross-chain security |
| P0-5 | Dev sandbox (#480) | Conxian | Builder onboarding |
| P0-6 | Value-op gate (#444) | wallet | Settlement verification |
| P0-7 | Protocol fee (#488) | Conxian | 5-stream revenue |
| P0-8 | CI validation (#1082) | platform | Green CI (BOS Gate 1) |

## Key Rules

- **ZSE**: No secrets, keys, or financial strategy in Git
- **SAB Custody**: All production wallets are SAB multisigs — no personal key dependency
- **Contract Principals**: Use `.conxian-access` roles, never hardcode addresses
- **Docs Root**: `docs/AGENTS.md` is canonical; this root AGENTS.md is bootstrap/summary
