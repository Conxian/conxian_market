# Session 73 — Cross-Repo Fee Model Gap Analysis & Benchmark (G4/G5/G8)

> **Session:** 73
> **Date:** 2026-10-02
> **Orchestration Repo:** `conxian_market` (`@conxian/market-sdk`)
> **Scope:** Canonical fee/settlement model — cross-repo gap analysis (G4/G5/G8)
> and financial benchmark for ADR-004 hardening.

---

## 1. Context — the fee model is implemented but not canonical

ADR-004 (`docs/adr/ADR_004_DYNAMIC_FEE_FLOOR_MODEL.md`) defines the hybrid fee
floor in the **market SDK (TypeScript)**: rail-specific flat floors, logarithmic
30-day volume decay, a clamped `systemLoadFactor`, and an enterprise
subscription cap. The model is live in `conxian_market`, but it is the *only*
home of the fee logic:

- The **Rust core** (`lib-conxian-core`) has **no** canonical fee/settlement
  model — fee logic is duplicated between the market SDK (TS) and nexus
  `api/billing` (Rust) with no shared source of truth. → **G4**.
- **Nexus** `api/billing` (CON-24) uses Free/Pro/Enterprise **signature-limit**
  tiers that are unrelated to the ADR-004 **enterprise subscription cap**. The
  two fee surfaces are not linked. → **G5**.
- ADR-004 §4.2 flags three hardening items that were deliberately deferred:
  volume-tier hysteresis, rail-floor calibration from measured cost, and wiring
  `systemLoadFactor` to a mempool/congestion oracle. → **G8**.

## 2. Gap Matrix (cross-repo)

| ID | Gap | Repo / Issue | Severity | Resolution |
| :--- | :--- | :--- | :--- | :--- |
| G4 | No canonical fee/settlement model in Rust core | `lib-conxian-core` #367 | Medium | Define canonical fee-model types in core; Rust↔TS binding; deprecation plan |
| G5 | nexus `api/billing` tiers misaligned with ADR-004 enterprise cap | `conxian-nexus` #353 | Medium | Map Enterprise tier → ADR-004 cap; document relationship; cross-repo fixture |
| G8 | ADR-004 hardening (hysteresis, rail calibration, load oracle) | `conxian_market` #99 | Low | Hysteresis; derive floors from measured cost; wire load oracle |
| G6 | `protocol::rails` → `protocol::bridges` ontology rename | `conxius-enclave-sdk` #422 | — | **DONE** (tests + rustfmt, PRs #427/#430) |

## 3. Financial benchmark

The ADR-004 rail floors and volume tiers were grounded against the treasury KPI
bands (`conxian_market/src/treasury_report.ts`) and the dynamic revenue scenario
(`projectDynamicRevenueScenario`):

| Rail | Flat floor (sats) | Notes |
| :--- | ---: | :--- |
| Lightning | 10 | channel-native, cheapest |
| Statechain / Fedimint | 25 | pool/community rails |
| RGB | 20 | client-side validation |
| sBTC / AlexStacks / Babylon | 50 | Stacks/alt-L1 bridged |
| EVM_ERC8183 | 100 | cross-chain, most expensive |

Volume tiers: 200 → 150 → 75 → 25 bps, floored at 10 bps (`MIN_PERCENTAGE_FLOOR_BPS`).
Enterprise cap: percentage component replaced by the rail flat floor.
Revenue split: **50/30/20** (Operations / Founders / Ecosystem), integral-conserving.

Treasury threshold bands (runway 12/6 mo, volume 33k/15k, revenue 20k/10k,
stablecoin 40/25) remain the dashboard KPI anchor; the dynamic model feeds the
revenue projection, not the threshold definitions.

## 4. Plan (forward-only)

1. **G4** — lift the ADR-004 types (floors, tiers, load clamp, cap) into
   `lib-conxian-core` as the canonical model; add a Rust↔TS binding (or codegen);
   schedule deprecation of the duplicated market/nexus implementations.
2. **G5** — map nexus `api/billing` Free/Pro/Enterprise tiers onto the ADR-004
   enterprise cap and document the fee↔billing relationship; add a cross-repo
   test fixture so a drift in either surface fails CI.
3. **G8** — add volume-tier hysteresis, re-derive rail floors from measured
   per-rail settlement cost, and wire `systemLoadFactor` to a mempool oracle.

## 5. References

- `docs/adr/ADR_004_DYNAMIC_FEE_FLOOR_MODEL.md`
- `docs/research/SESSION_71_RESEARCH_EXPANSION_AND_GAP_MATRIX.md`
- `.github-private/docs/CAPABILITIES_AUDIT_2026_10_02.md` §5 (G1–G8 register)
- Issues: `lib-conxian-core#367`, `conxian-nexus#353`, `conxian_market#99`
