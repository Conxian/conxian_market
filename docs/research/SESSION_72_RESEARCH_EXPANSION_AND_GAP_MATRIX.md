# Session 72: ADR-004 Dynamic Fee Floor Reporting & Mempool Oracle Integration — Research Expansion & Gap Matrix

> **Generated:** 2026-10-02 | **Session:** 72 | **Status:** Active
> **Primary Orchestration Repo:** `conxian_market` (`@conxian/market-sdk`)
> **Scope:** Dynamic Fee Report Aggregation & Mempool Oracle Load Adapter (ADR-004)

---

## 1. Executive Summary & Strategic Positioning

Following Session 71's introduction of ADR-004 (Dynamic Hybrid Fee Floor, Logarithmic 30-Day Volume Decay, and System Load Self-Adjustment Engine), Session 72 completes the operational lifecycle by extending the protocol reporting and load telemetry infrastructure:

1. **Dynamic Fee Report Aggregator (`generateDynamicFeeReport`)**: Aggregates dynamic settlement events across rails and tiers, explicitly computing total volume, total effective fees, 50/30/20 distribution split (Operations / Founders / Ecosystem), and categorizing settlements into **floor-dominated** (dust-protected micro-payments) vs. **percentage-dominated** transactions.
2. **Mempool Oracle Load Adapter (`resolveSystemLoadFromMempool`)**: Dynamically resolves the `systemLoadFactor` in the `[1.0, 3.0]` clamp using mempool fee samples or percentiles (`fastestFeeSatVb`, `halfHourFeeSatVb`, `hourFeeSatVb`), mapping live Bitcoin network congestion directly into dynamic settlement pricing.
3. **Unified SDK Bridge Wiring (`ConxianMarketSDK`)**: Exposes dynamic fee reporting and mempool load factor resolution on `ConxianMarketSDK` (`src/sdk_bridge.ts`) and exports all core types and utilities in `src/index.ts`.

---

## 2. Systematic Reconnaissance & Gap Register

| Gap ID | Category | Priority | As-Is State | To-Be State | Resolution |
|:-------|:---------|:---------|:------------|:------------|:-----------|
| **GAP-72-01** | Fee Reporting Engine | High | `generateFeeReport` in `src/fee_calculator.ts` handles legacy percentage-only fees, lacking support for ADR-004 dynamic fee structures, flat floor dominance metrics, or volume decay tiers. | `generateDynamicFeeReport` aggregates dynamic settlement events, providing total volume, total fee satoshis, 50/30/20 distribution, per-rail breakdowns, and floor vs. percentage dominance counts. | Implemented `generateDynamicFeeReport` in `src/fee_calculator.ts`. |
| **GAP-72-02** | Congestion Telemetry & Oracle | Medium | `calculateDynamicFee` accepted a manual `systemLoadFactor`, but no helper or oracle adapter existed to derive `systemLoadFactor` from live mempool fee rate samples (`sat/vB`). | `resolveSystemLoadFromMempool` maps `MempoolFeeSample` (percentiles or sat/vB fee rates) into a clamped `systemLoadFactor` in `[1.0, 3.0]`. | Implemented `resolveSystemLoadFromMempool` in `src/fee_calculator.ts`. |
| **GAP-72-03** | SDK Bridge & Test Suite | High | `ConxianMarketSDK` bridge in `src/sdk_bridge.ts` exposed single-settlement `calculateDynamicFee`, but lacked `generateDynamicFeeReport` and `resolveSystemLoadFromMempool`. Unit test coverage missing. | `ConxianMarketSDK` exposes `generateDynamicFeeReport` and `resolveSystemLoadFromMempool`. Comprehensive unit tests in `tests/fee_calculator.test.ts` and `tests/sdk_bridge.test.ts`. | Wired methods on `ConxianMarketSDK`, exported via `src/index.ts`, and authored unit tests. |

---

## 3. Weighted Candidate Scoring Matrix

| Candidate ID | Candidate Feature Name | Gap Coverage (30%) | Cost Inverted (20%) | Risk Inverted (20%) | Testability (15%) | Alignment (15%) | Weighted Total | Rank |
|:-------------|:-----------------------|:------------------:|:-------------------:|:------------------:|:-----------------:|:---------------:|:--------------:|:----:|
| **CAN-72-A** | **ADR-004 Dynamic Fee Floor Reporting Engine & Mempool Oracle Load Integration** | **5/5 (1.50)** | **5/5 (1.00)** | **5/5 (1.00)** | **5/5 (0.75)** | **5/5 (0.75)** | **5.00 / 5.00 (100%)** | **#1 (Selected)** |
| CAN-72-B | Standalone Off-Chain Python Telemetry Daemon | 2/5 (0.60) | 3/5 (0.60) | 3/5 (0.60) | 3/5 (0.45) | 2/5 (0.30) | 2.55 / 5.00 (51%) | #2 |
| CAN-72-C | Hardcoded Static Congestion Rules in Gateway | 1/5 (0.30) | 4/5 (0.80) | 2/5 (0.40) | 2/5 (0.30) | 1/5 (0.15) | 1.95 / 5.00 (39%) | #3 |

---

## 4. Implementation Artifacts & Verification

- **Types Added (`src/core_types.ts`)**:
  - `DynamicSettlementEvent`
  - `DynamicFeeBreakdownByRail`
  - `DynamicFeeReport`
  - `MempoolFeeSample`
  - `LoadOracleAdapterConfig`
- **Functions Added (`src/fee_calculator.ts`)**:
  - `resolveSystemLoadFromMempool(config)`
  - `generateDynamicFeeReport(events, periodStart, periodEnd)`
- **Bridge Integration (`src/sdk_bridge.ts` & `src/index.ts`)**:
  - `ConxianMarketSDK.prototype.generateDynamicFeeReport`
  - `ConxianMarketSDK.prototype.resolveSystemLoadFromMempool`
  - Exported through main barrel file `src/index.ts`.
- **Test Suite Verification (`tests/fee_calculator.test.ts` & `tests/sdk_bridge.test.ts`)**:
  - Verified percentile mapping and sat/vB interpolation into load factors `[1.0, 3.0]`.
  - Verified dynamic fee report aggregation across Lightning micro-payments and macro-payments, confirming 50/30/20 distribution splits and floor dominance counts.
  - Test result: **20 test files passed (178/178 tests passing), 0 errors.**

---
*Maintained per Conxian Session Cycle standards.*
