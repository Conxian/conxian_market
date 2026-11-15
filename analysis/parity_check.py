#!/usr/bin/env python3
"""Cross-language parity check: Python port of calculateDynamicFee vs the real
compiled TypeScript.

Pass 1 self-verification. The reference grid is produced by
analysis/gen_ts_grid.mjs from dist/fee_calculator.js (the actual shipped code),
then this script recomputes every row in Python and reports any mismatch.

Run:
  npm run build
  node analysis/gen_ts_grid.mjs > /tmp/ts_fee_grid.json
  python3 analysis/parity_check.py /tmp/ts_fee_grid.json
"""
import json
import sys

# Mirrors src/fee_calculator.ts exactly (integer sat arithmetic, BigInt semantics)
RAIL_COST_SAT = {
    "LIGHTNING": 8, "STATECHAIN": 100, "FEDIMINT": 20, "RGB": 250,
    "SBTC": 300, "ALEX_STACKS": 40, "BABYLON": 40, "EVM_ERC8183": 60,
}
RAIL_FLOOR_MARGIN_BPS = 2500
VOLUME_DECAY_BPS = {"TIER_1": 50, "TIER_2": 25, "TIER_3": 15, "TIER_4": 10}
MIN_PERCENTAGE_FLOOR_BPS = 10


def rail_floor(rail: str) -> int:
    # (cost * (10000 + margin)) / 10000 with integer division (BigInt semantics)
    return (RAIL_COST_SAT[rail] * (10000 + RAIL_FLOOR_MARGIN_BPS)) // 10000


def decayed_bps(tier: str) -> int:
    return max(MIN_PERCENTAGE_FLOOR_BPS, VOLUME_DECAY_BPS[tier])


def clamp(v, lo, hi):
    return min(hi, max(lo, v))


def dynamic_fee(rail: str, tier: str, amount_sat: int, load: float):
    lf = clamp(load, 1.0, 3.0)
    dbps = decayed_bps(tier)
    floor = rail_floor(rail)
    pct = (amount_sat * dbps) // 10000
    base = pct if pct > floor else floor
    # (base * round(load*100)) / 100
    scaled = (base * round(lf * 100)) // 100
    ops = (scaled * 50) // 100
    fnd = (scaled * 30) // 100
    eco = scaled - ops - fnd
    eff_bps = (scaled * 10000) // amount_sat if amount_sat > 0 else dbps
    return pct, floor, scaled, eff_bps, ops, fnd, eco


def main(path):
    rows = json.load(open(path))
    mismatches = []
    for r in rows:
        rail, tier, amount_sat, load = r[0], r[1], int(r[2]), float(r[3])
        exp = [int(x) for x in r[4:]]
        got = list(dynamic_fee(rail, tier, amount_sat, load))
        if got != exp:
            mismatches.append((r[:4], exp, got))
    print(f"rows checked: {len(rows)}")
    print(f"mismatches:   {len(mismatches)}")
    for m in mismatches[:10]:
        print("  MISMATCH", m)
    if not mismatches:
        print("PARITY OK — Python port matches compiled TypeScript on all rows.")
    return 1 if mismatches else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "/tmp/ts_fee_grid.json"))
