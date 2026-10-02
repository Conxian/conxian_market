# ADR 004: Dynamic Hybrid Fee Floor & System Load Self-Adjustment Model

> **Status:** Proposed
> **Date:** 2026-10-02
> **Author:** Conxian KB maintenance agent (botshelomokoka)
> **Deciders:** Conxian Core Maintainers (pending review)

---

## 1. Context & Problem Statement

ADR 001 fixed a static, percentage-only fee model (`TIER_FEE_BPS` +
`RAIL_FEE_OFFSET_BPS`). That model has a structural failure on high-velocity
machine-to-machine (M2M) micro-payments: a pure basis-point fee on a 5–50
satoshi HTTP-402 data packet or MCP tool call yields a fee that rounds to
**0 satoshis** while still consuming node compute and bandwidth. This is the
"Zero-Value Trap" — protocol nodes perform verifiable work for zero revenue,
which is an economic DoS surface that degrades into a fee-less resource sink
under load.

The gap is threefold:

- **GAP-71-01** — no minimum economic value (flat floor) per settlement.
- **GAP-71-02** — the fee is insensitive to rolling 30-day volume; a
  high-volume M2M operator pays the same rate as a one-off retail settlement.
- **GAP-71-03** — the fee is insensitive to live system load; the protocol
  cannot price congestion.

## 2. Decision

Introduce a **hybrid** fee model that composes three independently-verifiable
mechanisms on top of the existing trust-tier matrix:

1. **Rail-specific flat satoshi floor** — a minimum fee per settlement.
2. **Logarithmic 30-day volume decay** — the percentage rate decays with
   sustained volume, bounded below by a minimum percentage floor.
3. **System load self-adjustment** — a congestion multiplier applied to the
   effective fee, clamped to a defined band.

The result is a fee that is **never zero, never unbounded, and responsive to
both volume and load.**

## 3. Design

### 3.1 Rail-Specific Flat Satoshi Floors

Each settlement rail carries a minimum fee (dust protection):

| Rail | Flat Floor |
| :--- | ---: |
| `Lightning` | 10 sats |
| `Statechain` | 25 sats |
| `Fedimint` | 25 sats |
| `RGB` | 20 sats |
| `sBTC` | 50 sats |
| `AlexStacks` | 50 sats |
| `Babylon` | 50 sats |
| `EVM_ERC8183` | 100 sats |

Floors are ordered by settlement cost: Lightning is cheapest (channel-native),
EVM cross-chain is most expensive.

### 3.2 Logarithmic 30-Day Volume Decay

The percentage rate decays across four volume tiers:

| Tier | Basis Points | Rate |
| :--- | ---: | ---: |
| `TIER_1` | 200 | 2.00% (launch / low volume) |
| `TIER_2` | 150 | 1.50% |
| `TIER_3` | 75 | 0.75% |
| `TIER_4` | 25 | 0.25% (high-velocity M2M) |

`calculateVolumeDecayedBps` floors the decayed rate at
`MIN_PERCENTAGE_FLOOR_BPS = 10` (0.10%) so the percentage component can never
collapse to zero, independent of the flat floor.

### 3.3 System Load Self-Adjustment

A `systemLoadFactor` in `[1.0, 3.0]` multiplies the effective fee. Values are
clamped — below `1.0` is treated as `1.0` (no negative discount), above `3.0`
is treated as `3.0` (a hard cap that prevents a fee spiral under adversarial
mempool load).

### 3.4 Effective Fee Composition

```
percentage_fee_sat = amount_sat * decayed_bps / 10_000
base_fee_sat        = enterprise_cap ? flat_floor_sat
                                   : max(percentage_fee_sat, flat_floor_sat)
effective_fee_sat   = base_fee_sat * system_load_factor
```

An **enterprise subscription cap** replaces the percentage component with the
flat floor, so a committed enterprise client never pays a percentage fee on a
large settlement — it pays the rail floor (bounded, predictable).

Revenue distribution is unchanged: **50/30/20** (Operations Treasury / Founders
Vesting / Ecosystem Growth), computed on the final `effective_fee_sat`.

## 4. Stability & Enhancement Analysis

This section records the stabilising properties and the open enhancement
surface, so the model can be hardened without breaking its invariants.

### 4.1 Stabilising Properties

- **Monotonic non-negativity** — `effective_fee_sat >= flat_floor_sat >= 10`
  for every non-observer settlement; the Zero-Value Trap is eliminated by
  construction.
- **Bounded above** — `effective_fee_sat <= max(percentage_fee_sat, floor) * 3`.
  The load cap bounds worst-case congestion pricing.
- **Integral conservation** — the 50/30/20 split is computed as
  `ecosystem = total - operations - founders`, so no satoshi is lost to
  integer rounding.
- **Clamped inputs** — `system_load_factor` is clamped to `[1.0, 3.0]`; the
  volume decay is floored at 10 bps. Neither input can push the model outside
  its operating envelope.

### 4.2 Known Edge Cases / Future Enhancements

- **Floor vs. percentage crossover** — for micro-payments the flat floor
  dominates and the *effective* bps is far above the nominal tier (e.g. 10 sats
  on a 50-sat payment ≈ 2000 bps). This is intended (dust protection) but must
  be surfaced in the fee report so operators can distinguish floor-dominated
  from percentage-dominated revenue.
- **Volume-tier hysteresis** — the current decay is a pure function of tier;
  a live operator should add hysteresis so a client oscillating near a tier
  boundary does not thrash between rates.
- **Rail floor calibration** — floors are initial engineering estimates;
  they should be re-derived from measured per-rail settlement cost, not static
  constants.
- **Load signal source** — `systemLoadFactor` is caller-supplied; wiring it to
  a measured mempool/congestion oracle is the intended next step (kept out of
  this ADR to avoid a runtime dependency).

## 5. Consequences

- **Positive** — every settlement carries non-zero economic value; revenue
  scales with both volume and load; enterprise clients get predictable bounded
  fees; the existing trust-tier matrix is preserved (the dynamic model composes
  on top of it).
- **Negative** — micro-payments now carry an absolute minimum fee, which may
  price out the smallest sub-satoshi-denominated use cases; the load factor is
  a new parameter that requires governance to prevent mis-calibration.
- **Neutral** — the existing `calculateRailFee` path is untouched; the dynamic
  model is additive and opt-in via `calculateDynamicFee`.
