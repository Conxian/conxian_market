#!/usr/bin/env python3
"""Pass 5 — Survival / feasibility model.

Answers the owner's challenge: "is this feasible at these returns; ain't we being
too cheap to not even survive?" using the REAL cost base and funding ask found in
the org (not assumed).

Inputs (verified, sourced):
  - Funding ask: USD 24,000 / 12 months (HRF/Spiral/OpenSats drafts)
  - Infra burn: ~$0/mo (Render free x5, CF/Supabase/Neon free)
  - FUNDING sec.4.1 cost base: $20,000/mo (CONTRADICTS the $24k/yr ask)
  - Rates: ADR-005 0.50%->0.10%; ADR-001 2.0%; 80/10/10-of-gross 10%

Run: python3 analysis/fee_model_survival.py
Emits: analysis/charts_survival/*.png and analysis/fee_model_results_survival.json
"""
import json
import os

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "charts_survival")
os.makedirs(OUT, exist_ok=True)
res = {}

# Verified cost bases (annual USD)
COST_ASK = 24_000.0        # the real funding ask (HRF/Spiral/OpenSats)
COST_DOC = 240_000.0       # FUNDING sec.4.1 cost base
COST_LEAN = 24_000.0       # infra ~0 + part-time maintainer
COST_BASE = 60_000.0       # infra ~0 + full-time maintainer at ZA senior rate

# Candidate platform take rates
RATES = {"ADR-005 0.50% (launch)": 0.005, "ADR-001 2.0%": 0.02,
         "80/10/10 of gross 10%": 0.10, "Marketplace 15%": 0.15, "Uber ~25%": 0.25}

res["cost_bases_usd_per_year"] = {"ask": COST_ASK, "doc_sec_4_1": COST_DOC,
                                  "lean": COST_LEAN, "base": COST_BASE}

# ── 1. Break-even volume by rate and cost base ───────────────────────────────
print("Break-even annual settled volume (USD):")
be = {}
for cname, cost in [("lean $24k", COST_LEAN), ("base $60k", COST_BASE), ("doc $240k", COST_DOC)]:
    for rname, r in RATES.items():
        be[f"{cname} | {rname}"] = cost / r
        print(f"  {cname:12s} @ {rname:24s} -> ${cost/r:,.0f}")
res["break_even_volume_usd"] = be

# Chart: log-scale bars of break-even volume at the $24k ask
plt.figure(figsize=(11, 6))
labels = list(RATES.keys())
vals = [COST_LEAN / RATES[k] for k in labels]
bars = plt.bar(labels, vals, color=["tab:red", "tab:orange", "tab:green", "tab:blue", "tab:purple"])
plt.yscale("log")
for b, v in zip(bars, vals):
    plt.text(b.get_x() + b.get_width() / 2, v, f"${v/1e6:,.1f}M" if v >= 1e6 else f"${v/1e3:,.0f}k",
             ha="center", va="bottom", fontsize=9)
plt.axhline(1e6, color="grey", ls="--", lw=1, label="$1M/yr volume (plausible yr-1 target)")
plt.ylabel("annual settled volume needed (USD, log)")
plt.title("Break-even volume to cover the $24k/yr ask, by take rate")
plt.legend(fontsize=8); plt.grid(alpha=0.3, axis="y"); plt.xticks(rotation=15, ha="right"); plt.tight_layout()
plt.savefig(f"{OUT}/01_breakeven_by_rate.png", dpi=130); plt.close()

# ── 2. Revenue vs volume for each rate (log-log) ─────────────────────────────
vols = np.logspace(4, 8, 200)  # $10k .. $100M per year
plt.figure(figsize=(11, 6))
for rname, r in RATES.items():
    plt.plot(vols, vols * r, label=f"{rname}")
for cname, cost, col in [("lean $24k", COST_LEAN, "green"), ("base $60k", COST_BASE, "orange"),
                         ("doc $240k", COST_DOC, "red")]:
    plt.axhline(cost, color=col, ls="--", lw=1, label=f"cost: {cname}")
plt.xscale("log"); plt.yscale("log")
plt.xlabel("annual settled volume (USD, log)"); plt.ylabel("annual platform revenue (USD, log)")
plt.title("Revenue vs volume: where each take rate crosses each cost base")
plt.legend(fontsize=7); plt.grid(alpha=0.3); plt.tight_layout()
plt.savefig(f"{OUT}/02_revenue_vs_volume.png", dpi=130); plt.close()

# ── 3. Runway: months of survival from a $24k grant at a given run-rate ──────
# Grant of $24k, net monthly burn = infra(~0) + people. Show runway vs monthly burn.
grants = [24_000, 60_000, 240_000]
burns = np.linspace(500, 25_000, 200)
plt.figure(figsize=(11, 6))
for g in grants:
    plt.plot(burns, g / burns, label=f"grant ${g:,}")
plt.axhline(12, color="red", ls="--", lw=1, label="12-month target")
plt.axvline(2_000, color="green", ls=":", lw=1, label="$2k/mo (the actual ask)")
plt.ylim(0, 48); plt.xlabel("monthly burn (USD)"); plt.ylabel("runway (months)")
plt.title("Runway: the $24k ask funds 12 months only at <=$2k/mo burn")
plt.legend(fontsize=8); plt.grid(alpha=0.3); plt.tight_layout()
plt.savefig(f"{OUT}/03_runway.png", dpi=130); plt.close()

# ── 4. Marketplace vs rail: take-rate benchmark ──────────────────────────────
bench = {
    "Lightning routing": 0.03, "Stripe": 2.9, "Card interchange": 1.5,
    "Uniswap": 0.05, "Conxian ADR-005": 0.5, "Conxian ADR-001": 2.0,
    "Upwork": 10, "Airbnb": 15, "Conxian 80/10/10": 10.0, "App stores": 30, "Uber": 25,
}
plt.figure(figsize=(11, 7))
names = list(bench.keys()); vals = [bench[k] for k in names]
cols = ["tab:red" if "Conxian" in n else "tab:blue" for n in names]
order = np.argsort(vals)
names = [names[i] for i in order]; vals = [vals[i] for i in order]
cols = [cols[i] for i in order]
bars = plt.barh(names, vals, color=cols)
for b, v in zip(bars, vals):
    plt.text(v, b.get_y() + b.get_height() / 2, f"  {v}%", va="center", fontsize=9)
plt.xscale("log")
plt.xlabel("take rate (%, log)")
plt.title("Take-rate benchmark: Conxian prices in the RAIL band, operates in the MARKETPLACE band")
plt.grid(alpha=0.3, axis="x"); plt.tight_layout()
plt.savefig(f"{OUT}/04_take_benchmark.png", dpi=130); plt.close()

# ── 5. Sensitivity: revenue at $1M/yr volume across rates ────────────────────
v = 1_000_000
plt.figure(figsize=(11, 6))
xs = list(RATES.keys())
ys = [v * RATES[k] for k in xs]
plt.bar(xs, ys, color=["tab:red", "tab:orange", "tab:green", "tab:blue", "tab:purple"])
for i, y in enumerate(ys):
    plt.text(i, y, f"${y:,.0f}", ha="center", va="bottom", fontsize=9)
plt.axhline(COST_LEAN, color="green", ls="--", label="lean cost $24k")
plt.axhline(COST_BASE, color="orange", ls="--", label="base cost $60k")
plt.axhline(COST_DOC, color="red", ls="--", label="doc cost $240k")
plt.ylabel("platform revenue at $1M/yr volume (USD)")
plt.title("At $1M/yr settled volume: only a marketplace-grade rate covers even the lean cost")
plt.legend(fontsize=8); plt.grid(alpha=0.3, axis="y"); plt.xticks(rotation=15, ha="right"); plt.tight_layout()
plt.savefig(f"{OUT}/05_revenue_at_1m.png", dpi=130); plt.close()

res["revenue_at_1m_volume"] = {k: v * RATES[k] for k in RATES}
res["volume_to_cover_24k"] = {k: COST_LEAN / RATES[k] for k in RATES}

with open(os.path.join(HERE, "fee_model_results_survival.json"), "w") as fh:
    json.dump(res, fh, indent=2, default=str)
print("\ncharts_survival written")
print(json.dumps(res["volume_to_cover_24k"], indent=2, default=str))
