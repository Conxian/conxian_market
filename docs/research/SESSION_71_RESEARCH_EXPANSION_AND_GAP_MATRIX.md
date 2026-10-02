# Session 71 — Research Expansion & Gap Matrix

> **Session:** 71
> **Date:** 2026-10-02
> **Orchestration Repo:** `conxian_market` (`@conxian/market-sdk`)
> **Scope:** Dynamic Hybrid Fee Floor & System Load Self-Adjustment (ADR-004)

---

## 1. Research Expansion — Cross-Industry Fee Model Benchmarks

The static percentage-only fee model was benchmarked against four industry
reference implementations to ground the ADR-004 decision.

### 1.1 Lightning Network (BOLT 7 / channel routing)

Lightning routes charge a **base fee (millisatoshi)** plus a **fee rate** per
forwarded HTLC. The base fee is the direct analogue of Conxian's flat floor:
it exists precisely to make micro-payments economically viable to relay.
**Takeaway:** a flat minimum is a proven, production-hardened mechanism against
zero-value relaying — adopted as the rail flat floor.

### 1.2 Ethereum EIP-1559

EIP-1559 splits fees into a **base fee** (burned, adjusts per-block with
congestion) plus a **priority tip**. The base-fee adjustment is a load-scaled,
bounded response to network demand.
**Takeaway:** a bounded congestion multiplier is the right shape for
Conxian's `systemLoadFactor`; the `[1.0, 3.0]` clamp mirrors EIP-1559's
bounded per-block adjustment.

### 1.3 Fedimint community pools

Fedimint e-cash federations already discount for pooled/community liquidity.
**Takeaway:** volume-based rate discounting is expected behaviour in
privacy-preserving rails; the logarithmic 30-day decay generalises it across
rails.

### 1.4 Traditional PSP interchange

Card networks (Visa/Mastercard) publish **tiered interchange schedules** where
the effective rate falls as volume and settlement size rise.
**Takeaway:** a tiered decay (200 → 150 → 75 → 25 bps) with a hard floor is the
canonical shape for pricing volume; the 10 bps percentage floor prevents the
rate from collapsing to zero.

## 2. Gap Matrix

| ID | Gap | Severity | Resolution |
| :--- | :--- | :--- | :--- |
| GAP-71-01 | No minimum economic value per settlement (Zero-Value Trap) | High | Rail-specific flat satoshi floors |
| GAP-71-02 | Fee insensitive to rolling 30-day volume | Medium | Logarithmic volume decay tiers |
| GAP-71-03 | Fee insensitive to live system load | Medium | Clamped `systemLoadFactor` |
| GAP-71-04 | Enterprise clients pay unbounded percentage fees | Low | Enterprise subscription cap at flat floor |

## 3. Candidate Scoring Matrix

| Candidate | Zero-Value Fix | Volume-Responsive | Load-Responsive | Complexity | Verdict |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Static percentage (status quo) | ❌ | ❌ | ❌ | Low | Rejected |
| Flat floor only | ✅ | ❌ | ❌ | Low | Insufficient |
| Floor + linear volume decay | ✅ | ✅ | ❌ | Medium | Partial |
| **Floor + logarithmic decay + load clamp** | ✅ | ✅ | ✅ | Medium | **Selected** |
| Continuous auction (per-txn) | ✅ | ✅ | ✅ | High | Deferred (complexity) |

The selected candidate was chosen because it eliminates the Zero-Value Trap
with the lowest complexity that still captures both volume and load
responsiveness; a continuous auction was deferred as a future enhancement.

## 4. Stability & Enhancement Notes

- **Invariant:** `effective_fee_sat >= flat_floor_sat` for every non-observer
  settlement — the Zero-Value Trap is eliminated by construction.
- **Invariant:** `effective_fee_sat <= max(percentage_fee_sat, floor) * 3.0` —
  the load clamp bounds worst-case congestion pricing.
- **Enhancement (next):** derive rail floors from measured per-rail settlement
  cost, add volume-tier hysteresis, and wire `systemLoadFactor` to a measured
  mempool oracle (see ADR-004 §4.2).
