# Session 73 — ADR-004 G8 Hardening Implementation

> **UTC:** 2026-09-30 | **Repo:** `conxian_market` | **Gap:** G8 (ADR-004 hardening)
> **Predecessor:** `SESSION_72_RESEARCH_EXPANSION_AND_GAP_MATRIX.md` (load oracle + fee report)

## Scope

Closes the remaining G8 acceptance criteria from `.github-private` capability audit §5:

| Criterion | Status |
|-----------|--------|
| Wire `systemLoadFactor` to a mempool/congestion oracle | Done (Session 72 — `resolveSystemLoadFromMempool`) |
| Add volume-tier hysteresis | Done (this note — `selectVolumeDecayTier`) |
| Derive rail floors from measured cost | Done (this note — `calibrateRailFloorFromMeasuredCost`) |

## Changes

1. **Volume-tier hysteresis** (`selectVolumeDecayTier`):
   - `VOLUME_TIER_THRESHOLDS_SAT` gates tier entry by 30-day volume (0 / 1 BTC / 10 BTC / 100 BTC-equivalent).
   - ±5% hysteresis band (`TIER_HYSTERESIS_BPS`) damps oscillation near a boundary.
   - Step-wise movement: at most one tier per re-evaluation.

2. **Measured-cost rail floor calibration** (`calibrateRailFloorFromMeasuredCost`):
   - Re-derives a rail flat floor from measured per-rail settlement cost using the
     existing interchange-plus `railFloorFromCost` (cost × (1 + margin_bps / 10_000)).

3. **ADR-004 report hardening** (carried from the Session 72 PR):
   - `generateDynamicFeeReport` now excludes `ObserverOnly` events from `totalSettlements`.
   - Enterprise-capped settlements are always classified as floor-dominated.

## Verification

- `npm test`: 184/184 passing (20 files)
- `npm run typecheck`: clean
- `npm run build`: clean
