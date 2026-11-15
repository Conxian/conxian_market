# Conxian Marketplace — Agent Knowledge Base

> **Type:** Autonomous agent operational memory
> **Repo:** Conxian/conxian_market | **Tier:** Reference Surface — Value Layer
> **Bootstrapped:** 2026-08-02 (Session 51) | **Authoritative:** docs/AGENTS.md supersedes

---

## Quick Reference

| Item | Value |
|------|-------|
| Role | Primary value capture — AI labor marketplace |
| Protocol Fee | ADR-007 two-product: 10% matched-job take (builder keeps 90%) / ADR-005 dynamic rail; take splits 50/30/20 |
| Escrow | ERC-8183 programmable settlement |
| Settlement Rails | Lightning, Fedimint, Stacks/ALEX, Babylon, RGB, sBTC, Statechain (Spark), EVM/ERC-8183 |
| Trust Tiers | Strict (TEE+ZK) / Managed (Enclave) / Expedient (Light) / ObserverOnly (Free) |
| Wallet Custody | SAB multisigs (3-of-5 deployer, 3-of-5 payout, 2-of-3 emergency) |
| Key Package | `src/sdk_bridge.ts` — ConxianMarketSDK: 18 capability groups / 38 wired capabilities (`getCapabilitySummary()`), gateway client, verification, settlement, SLA penalty engine |
| Auth Docs | `docs/AGENTS.md` (canonical), `docs/adr/` (decisions), `docs/research/` (economic decisions) |
| M2M Auth | `src/org_m2m.ts` verifies the **organization** service JWT contract (`conxius-platform` issues, `conxian-gateway` verifies). `src/m2m_auth.ts` is a market-internal issuer (HS256/EdDSA, JWKS) — **not** the org standard. |
| Governance | Issue #9 (repository disposition) — CLOSED; open governance work is #252 (org evidence contract) and #278 (MIT/AGPL split) |

## Authoritative Documents

Research chain (in order):
0. `docs/adr/ADR_001_FEE_MODEL.md` — **AUTHORITATIVE** — Fee basis, percentages, custody, exposure caps, pause/exit
0a. `docs/research/ECOSYSTEM_GRAPH.md` — **Full ecosystem map** — 16 repos, 55 issues, 5-phase roadmap
1. `docs/research/FUNDING_AND_ECONOMICS.md` — Fee model, revenue streams, break-even
2. `docs/research/SETTLEMENT_RAILS.md` — 8 rails defined, 6 ready (`RAIL_CAPABILITIES[].ready`)
3. `docs/research/FULL_SYSTEM_ARCHITECTURE.md` — Integration map, 17 modules
4. `docs/research/MARKET_UNIFIED_POSITIONING.md` — Enhancement matrix, gap closure
5. `docs/research/CROSS_REPO_GAP_ANALYSIS_SESSION_48.md` — 60 open issues, 23 code gaps
6. `docs/knowledge_base/` — monitoring, SLA bounty, trust tier pricing, operating manual

## CON-1427 Fee Calculator

| Component | Status |
|-----------|--------|
| Implementation plan | ✅ `docs/research/CON1427_IMPLEMENTATION_PLAN.md` |
| FeeCalculator (src) | ✅ `src/fee_calculator.ts` — tier detection, rail routing, dynamic fee report |
| SDK Bridge (src) | ✅ `src/sdk_bridge.ts` — `ConxianMarketSDK` wires 18 capability groups / 38 capabilities + SLA penalty settlement |
| Core Types (src) | ✅ `src/core_types.ts` — TypeScript mirror of lib-conxian-core + enclave-sdk |
| Gateway Client (src) | ✅ `src/gateway_client.ts` — typed HTTP client over the gateway REST contract |
| Verification (src) | ✅ `src/verification.ts` — Gateway-backed verifier, P0-aware degradation |
| Settlement (src) | ✅ `src/settlement.ts` — Multi-rail settlement orchestrator (8 rails) |
| Gateway bridge | ✅ `conxian-gateway:billing.rs` — ProtocolFeeRecord + 5 tests |
| Clarity contract | ⬜ Phase C — needs testnet deploy keys |
| Contract-bridge wire-up | ⬜ Phase C |
| Treasury auto-staking | ⬜ Phase D |

## P0 Gaps (from cross-repo analysis)

| # | Gap | Repo | Blocks | State (2026-11-14) |
|---|-----|------|--------|--------------------|
| P0-1 | AWS Nitro attestation (#242) | enclave-sdk | Managed/Strict tiers | CLOSED |
| P0-2 | Android KeyMint (#241) | enclave-sdk | Mobile attestation | OPEN |
| P0-3 | Attestation roots (#240) | enclave-sdk | Trust chain | OPEN |
| P0-4 | CCTP fail-closed (#198) | enclave-sdk | Cross-chain security | CLOSED |
| P0-5 | Dev sandbox (#480) | Conxian | Builder onboarding | unresolvable — `Conxian/Conxian` no longer exists |
| P0-6 | Value-op gate (#444) | wallet | Settlement verification | CLOSED |
| P0-7 | Protocol fee (#488) | conxian_market | two-product take | **re-homed** — `contracts/protocol-fee-vault.clar` (ADR-006); model implemented, deploy pending #360 |
| P0-8 | CI validation (#1082) | platform | Green CI (BOS Gate 1) | CLOSED |

## Key Rules

- **Always push and open a PR**: every completed work item MUST be pushed to the
  remote and opened as a pull request. Committing locally and stopping is
  unacceptable — a local-only commit is not delivered work. Push the branch and
  open the PR against the correct base (`dev`) before reporting done.
- **ZSE**: No secrets, keys, or financial strategy in Git
- **SAB Custody**: All production wallets are SAB multisigs — no personal key dependency
- **Contract Principals**: Use `.conxian-access` roles, never hardcode addresses
- **Docs Root**: `docs/AGENTS.md` is canonical; this root AGENTS.md is bootstrap/summary
