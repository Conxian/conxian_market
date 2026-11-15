#!/usr/bin/env python3
"""Conxian protocol-fee economics: micro (unit), meso (Laffer/two-sided),
macro (monetary/real-terms) and scaling.

Parameters are mirrored from the shipped model so the analysis cannot drift:
  src/fee_calculator.ts     (ADR-004/005: volume decay, rail floor, load factor)
  src/bos_yield_splitter.ts (80/10/10 and 50/30/20 splits)
  src/monitoring_watcher.ts (40/30/20/10 treasury target allocation)

Run:  python3 analysis/fee_model_economics.py
Emits: analysis/charts/*.png and analysis/fee_model_results.json
"""
import json
import os

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "charts")
os.makedirs(OUT, exist_ok=True)

# Parameters (mirrored from src/fee_calculator.ts)
RAIL_COST_SAT = {
    "Lightning": 8, "Statechain": 100, "Fedimint": 20, "Rgb": 250,
    "Sbtc": 300, "AlexStacks": 40, "Babylon": 40, "EvmErc8183": 60,
}
FLOOR_MARGIN_BPS = 2500  # +25% over measured cost
VOLUME_DECAY_BPS = {"TIER_1": 50, "TIER_2": 25, "TIER_3": 15, "TIER_4": 10}
MIN_PCT_FLOOR_BPS = 10
VOLUME_TIER_THRESHOLDS_SAT = [0, 100_000_000, 1_000_000_000, 10_000_000_000]
RETIRED_FLAT_BPS = 200  # M0: the retired ADR-001 "2%"

# Splits
FEE_SPLIT = {"operations": 0.50, "founders": 0.30, "ecosystem": 0.20}
NET_SPLIT = {"builder": 0.80, "platform_treasury": 0.10, "ecosystem": 0.10}
TREASURY_ALLOC = {"stablecoins": 0.40, "rwa": 0.30, "liquid_staking": 0.20, "native": 0.10}


def rail_floor(rail: str) -> float:
    return RAIL_COST_SAT[rail] * (10000 + FLOOR_MARGIN_BPS) / 10000


def fee(amount_sat: float, bps: float, rail: str, load: float = 1.0) -> float:
    return max(amount_sat * bps / 10000, rail_floor(rail)) * load


def effective_bps(amount_sat: float, bps: float, rail: str, load: float = 1.0) -> float:
    if amount_sat <= 0:
        return bps
    return fee(amount_sat, bps, rail, load) / amount_sat * 10000


# Model variants juxtaposed
MODELS = {
    "M0 flat 2% (retired)": lambda a, rail: fee(a, RETIRED_FLAT_BPS, rail, 1.0),
    "M1 dynamic 0.50% + floor (launch)": lambda a, rail: fee(a, 50, rail, 1.0),
    "M1' dynamic 0.10% + floor (mature)": lambda a, rail: fee(a, 10, rail, 1.0),
    "M2 floor-only (cost+25%)": lambda a, rail: rail_floor(rail),
    "M3 load 2.0x (congestion)": lambda a, rail: fee(a, 50, rail, 2.0),
}

results = {}

# 1. Fee vs settlement size (micro)
sizes = np.logspace(1, 9, 400)  # 10 sat -> 1e9 sat
rail = "AlexStacks"
plt.figure(figsize=(11, 6))
for name, fn in MODELS.items():
    plt.plot(sizes, [fn(a, rail) for a in sizes], label=name)
plt.plot(sizes, [a * 0.02 for a in sizes], ":", color="grey", alpha=0.6, label="2% reference line")
plt.axhline(rail_floor(rail), color="red", ls="--", lw=1, label=f"rail floor (AlexStacks) = {rail_floor(rail):.0f} sat")
plt.xscale("log"); plt.yscale("log")
plt.xlabel("settlement size (sats, log)"); plt.ylabel("protocol fee (sats, log)")
plt.title("Micro: fee vs settlement size - the floor dominates micro-payments, the rate dominates macro")
plt.legend(fontsize=8); plt.grid(alpha=0.3); plt.tight_layout()
plt.savefig(f"{OUT}/01_fee_vs_size.png", dpi=130); plt.close()

# 2. Effective rate vs size (the "zero-value trap" boundary)
plt.figure(figsize=(11, 6))
for name, fn in MODELS.items():
    plt.plot(sizes, [fn(a, rail) / a * 10000 for a in sizes], label=name)
for bench, lbl in [(150, "card interchange ~1.5%"), (250, "Stripe ~2.9%"), (30, "Lightning ~0.03%"), (10, "mature 0.10%")]:
    plt.axhline(bench, color="grey", ls=":", lw=0.8)
    plt.text(sizes[-1], bench, f" {lbl}", va="center", fontsize=7, color="grey")
plt.xscale("log"); plt.yscale("log")
plt.xlabel("settlement size (sats, log)"); plt.ylabel("effective rate (bps, log)")
plt.title("Effective rate vs size - floor sets a high rate on micro-payments; rate governs large ones")
plt.legend(fontsize=8); plt.grid(alpha=0.3); plt.tight_layout()
plt.savefig(f"{OUT}/02_effective_rate_vs_size.png", dpi=130); plt.close()

# 3. Laffer: revenue vs rate under volume elasticity
r0 = 50.0
V0 = 1e8
rates = np.linspace(1, 400, 400)
plt.figure(figsize=(11, 6))
for eps in [0.5, 1.0, 1.5, 2.0, 3.0]:
    rev = rates * V0 * (rates / r0) ** (-eps)
    plt.plot(rates, rev / V0, label=f"elasticity eps={eps}")
    peak_i = int(np.argmax(rev))
    plt.plot(rates[peak_i], rev[peak_i] / V0, "k*", ms=9)
plt.axvline(50, color="green", ls="--", lw=1, label="current launch rate 0.50%")
plt.axvline(200, color="red", ls="--", lw=1, label="retired 2%")
plt.xlabel("fee rate (bps)"); plt.ylabel("revenue index  R/V0")
plt.title("Meso (Laffer): revenue = rate x volume(rate). Peak shifts left as volume responds to price")
plt.legend(fontsize=8); plt.grid(alpha=0.3); plt.tight_layout()
plt.savefig(f"{OUT}/03_laffer_revenue_vs_rate.png", dpi=130); plt.close()
results["laffer_optimum_bps"] = {
    str(eps): float(rates[int(np.argmax(rates * V0 * (rates / r0) ** (-eps)))]) for eps in [0.5, 1.0, 1.5, 2.0, 3.0]
}

# 4. Monthly revenue vs volume across models (FUNDING scenarios)
vols_usd = np.array([1e5, 5e5, 1e6, 5e6, 1e7, 2.5e7, 5e7, 1e8])
btc = 100_000.0
avg_txn_sat = 250_000
plt.figure(figsize=(11, 6))
for name, fn in MODELS.items():
    rev = []
    for v in vols_usd:
        total_sat = v / btc * 1e8
        n = total_sat / avg_txn_sat
        rev.append(n * fn(avg_txn_sat, rail) / 1e8 * btc)
    plt.plot(vols_usd, rev, "o-", label=name)
plt.xscale("log"); plt.yscale("log")
plt.xlabel("monthly settled volume (USD, log)"); plt.ylabel("monthly protocol fee revenue (USD, log)")
plt.title("Revenue vs volume - the fee that funds the protocol, by model")
plt.legend(fontsize=8); plt.grid(alpha=0.3); plt.tight_layout()
plt.savefig(f"{OUT}/04_revenue_vs_volume.png", dpi=130); plt.close()

# 5. Cost recovery: fee vs rail cost, all rails
rails = list(RAIL_COST_SAT)
x = np.arange(len(rails))
cost = [RAIL_COST_SAT[r] for r in rails]
fl = [rail_floor(r) for r in rails]
small = 100_000
pct_fee = [max(small * 50 / 10000, rail_floor(r)) for r in rails]
plt.figure(figsize=(11, 6))
plt.bar(x - 0.25, cost, 0.25, label="measured rail cost (sat)")
plt.bar(x, fl, 0.25, label="floor = cost x 1.25 (sat)")
plt.bar(x + 0.25, pct_fee, 0.25, label="fee on 100k-sat job @0.50% (sat)")
plt.yscale("log"); plt.xticks(x, rails, rotation=30, ha="right")
plt.ylabel("sats (log)")
plt.title("Cost recovery: the floor guarantees fee >= cost + 25% margin on every rail")
plt.legend(fontsize=8); plt.grid(alpha=0.3, axis="y"); plt.tight_layout()
plt.savefig(f"{OUT}/05_cost_recovery.png", dpi=130); plt.close()

# 6. Scaling: revenue (linear) vs network value (Metcalfe n^2)
n = np.linspace(1, 1000, 500)
value = n ** 2
revenue = n * 0.5
capture = revenue / value * 1e3
fig, ax1 = plt.subplots(figsize=(11, 6))
ax1.plot(n, value / value[-1], label="network value proportional to n^2 (Metcalfe)", color="tab:blue")
ax1.plot(n, revenue / revenue[-1], label="fee revenue proportional to n (fixed rate)", color="tab:orange")
ax1.set_xlabel("number of agents / participants (n)")
ax1.set_ylabel("normalised (1.0 at n=1000)")
ax2 = ax1.twinx()
ax2.plot(n, capture, "r--", label="value capture ratio (revenue/value) proportional to 1/n")
ax2.set_ylabel("capture ratio (permille of n^2)")
ax1.set_title("Scaling: revenue grows linearly, network value quadratically -> take rate must decline with scale")
l1, la1 = ax1.get_legend_handles_labels(); l2, la2 = ax2.get_legend_handles_labels()
ax1.legend(l1 + l2, la1 + la2, fontsize=8, loc="upper left"); ax1.grid(alpha=0.3); plt.tight_layout()
plt.savefig(f"{OUT}/06_scaling.png", dpi=130); plt.close()

# 7. Macro: real treasury value under BTC appreciation
btc_path = np.array([1, 2, 3, 5, 10])
fee_sat_monthly = 1e6
usd_volume = 1e8
real_usd_fee_if_usd_priced = usd_volume * 50 / 10000 * np.ones_like(btc_path)
real_usd_fee_if_sat_priced = (fee_sat_monthly / 1e8 * 100_000) * btc_path
plt.figure(figsize=(11, 6))
plt.plot(btc_path, real_usd_fee_if_usd_priced, "o-", label="USD-priced work: real fee stable")
plt.plot(btc_path, real_usd_fee_if_sat_priced, "s-", label="sat-priced work: real fee scales with BTC (hidden escalator)")
plt.xlabel("BTC appreciation multiple"); plt.ylabel("real monthly fee revenue (USD)")
plt.title("Macro: denomination decides whether a BTC-denominated fee is stable or an escalator")
plt.legend(fontsize=8); plt.grid(alpha=0.3); plt.tight_layout()
plt.savefig(f"{OUT}/07_macro_btc.png", dpi=130); plt.close()

# 8. Full-system waterfall for one settlement
G = 1_000_000
F = fee(G, 50, rail, 1.0)
net = G - F
parts = {
    "Builder (80% net)": net * NET_SPLIT["builder"],
    "Platform treasury (10% net)": net * NET_SPLIT["platform_treasury"],
    "Ecosystem (10% net)": net * NET_SPLIT["ecosystem"],
    "Ops (50% fee)": F * FEE_SPLIT["operations"],
    "Founders (30% fee)": F * FEE_SPLIT["founders"],
    "Ecosystem (20% fee)": F * FEE_SPLIT["ecosystem"],
}
plt.figure(figsize=(11, 6))
left = 0
colors = plt.cm.tab20(np.linspace(0, 1, len(parts)))
for (k, v), c in zip(parts.items(), colors):
    plt.barh(0, v, left=left, color=c, edgecolor="black", label=f"{k}: {v:,.0f} sat")
    left += v
plt.yticks([]); plt.xlabel("sats of a 1,000,000-sat settlement")
plt.title(f"Full system: where one settlement goes (fee F = {F:,.0f} sat = {F/G*10000:.0f} bps)")
plt.legend(fontsize=8, loc="lower right"); plt.grid(alpha=0.3, axis="x"); plt.tight_layout()
plt.savefig(f"{OUT}/08_full_system_waterfall.png", dpi=130); plt.close()

# 9. Split-basis juxtaposition (decision D-1)
slice_B = net * NET_SPLIT["platform_treasury"]
optA = {"operations": F * 0.50, "founders": F * 0.30, "ecosystem_fee": F * 0.20}
optB = {"operations": slice_B * 0.50, "founders": slice_B * 0.30, "ecosystem_fee": slice_B * 0.20}
labels = ["Operations", "Founders", "Ecosystem (fee leg)"]
a_vals = [optA["operations"], optA["founders"], optA["ecosystem_fee"]]
b_vals = [optB["operations"], optB["founders"], optB["ecosystem_fee"]]
xx = np.arange(len(labels))
plt.figure(figsize=(11, 6))
plt.bar(xx - 0.2, a_vals, 0.4, label=f"A: 50/30/20 on fee F (F={F:,.0f} sat)")
plt.bar(xx + 0.2, b_vals, 0.4, label=f"B: 50/30/20 on 10%-of-net slice ({slice_B:,.0f} sat)")
plt.xticks(xx, labels); plt.ylabel("sats")
plt.title("Decision D-1: the two split bases give different amounts. B is far larger than A at a 0.50% fee")
plt.legend(fontsize=8); plt.grid(alpha=0.3, axis="y"); plt.tight_layout()
plt.savefig(f"{OUT}/09_split_basis.png", dpi=130); plt.close()

# Key numbers for the writeup
results.update({
    "assumptions": {"btc_usd": btc, "avg_txn_sat": avg_txn_sat, "rail": rail},
    "rail_floors_sat": {r: rail_floor(r) for r in rails},
    "example_1m_sat_settlement": {
        "gross_sat": G, "fee_sat": F, "fee_bps": F / G * 10000, "net_sat": net,
        "split": parts,
        "optionA_fee_50_30_20": optA,
        "optionB_slice_50_30_20": optB,
        "optionB_is_multiple_of_A": slice_B / F,
    },
    "effective_bps_examples": {
        "10k_sat_alexstacks": effective_bps(10_000, 50, rail),
        "100k_sat_alexstacks": effective_bps(100_000, 50, rail),
        "1M_sat_alexstacks": effective_bps(1_000_000, 50, rail),
        "1M_sat_lightning": effective_bps(1_000_000, 50, "Lightning"),
        "1M_sat_sbtc": effective_bps(1_000_000, 50, "Sbtc"),
    },
    "protocol_take_note": (
        "If 80/10/10 is a per-settlement deduction, the effective protocol take is "
        "10% of net (not 0.50% of gross). At a 1,000,000-sat gross with a 0.50% fee, "
        "the platform treasury receives the 10%-of-net slice, ~20x the whole 50/30/20 "
        "of F. This is the crux of decision D-1/D-2."
    ),
})

with open(os.path.join(HERE, "fee_model_results.json"), "w") as fh:
    json.dump(results, fh, indent=2, default=str)

print("charts written to", OUT)
print(json.dumps(results["example_1m_sat_settlement"], indent=2, default=str))
