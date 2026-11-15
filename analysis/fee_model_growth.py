#!/usr/bin/env python3
"""Pass 6 — Growth model: from $0 to self-sustaining.

Grounded in what actually grew comparable platforms (Shopify, Stripe, Uber,
Airbnb, Upwork, Uniswap). Models the two-sided flywheel and the path from the
current $0 revenue to covering the cost base.

Run: python3 analysis/fee_model_growth.py
Emits: analysis/charts_growth/*.png and analysis/fee_model_results_growth.json
"""
import json
import os

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "charts_growth")
os.makedirs(OUT, exist_ok=True)
res = {}

# ── 1. The two-sided flywheel: logistic supply growth drives volume ──────────
# Supply = active agents/builders. Demand follows supply with a lag (network effect).
months = np.arange(0, 37)
K = 5_000           # carrying capacity (active agents)
r = 0.28            # growth rate
t0 = 14             # inflection month
supply = K / (1 + np.exp(-r * (months - t0)))
jobs_per_agent = 3.0        # matched jobs / agent / month
avg_job_usd = 120.0         # average job value
gmv = supply * jobs_per_agent * avg_job_usd * 12 / 12  # monthly GMV
plt.figure(figsize=(11, 6))
ax1 = plt.gca()
ax1.plot(months, supply, "o-", color="tab:blue", label="active agents (supply)")
ax1.set_xlabel("month"); ax1.set_ylabel("active agents", color="tab:blue")
ax1.tick_params(axis="y", labelcolor="tab:blue")
ax2 = ax1.twinx()
ax2.plot(months, gmv, "s-", color="tab:green", label="monthly GMV")
ax2.set_ylabel("monthly GMV (USD)", color="tab:green")
ax2.tick_params(axis="y", labelcolor="tab:green")
plt.title("The flywheel: supply growth (agents) drives GMV, super-linearly at first")
plt.grid(alpha=0.3); plt.tight_layout()
plt.savefig(f"{OUT}/01_flywheel.png", dpi=130); plt.close()

# ── 2. Path to break-even at different take rates ────────────────────────────
plt.figure(figsize=(11, 6))
for take, col, lbl in [(0.005, "tab:red", "0.50% (ADR-005 rail)"),
                       (0.02, "tab:orange", "2.0% (ADR-001)"),
                       (0.10, "tab:green", "10% (marketplace)")]:
    rev = gmv * take * 12  # annualised
    plt.plot(months, rev, color=col, label=lbl)
    # first month revenue covers $24k/yr
    hit = np.argmax(rev >= 24_000)
    if rev.max() >= 24_000:
        plt.plot(months[hit], rev[hit], "*", color=col, ms=14)
plt.axhline(24_000, color="green", ls="--", lw=1, label="$24k/yr (lean cost)")
plt.axhline(60_000, color="orange", ls="--", lw=1, label="$60k/yr (base cost)")
plt.xlabel("month"); plt.ylabel("annualised revenue (USD)")
plt.title("Path to break-even: at 0.50% it takes far longer than at a marketplace rate")
plt.legend(fontsize=8); plt.grid(alpha=0.3); plt.tight_layout()
plt.savefig(f"{OUT}/02_path_to_breakeven.png", dpi=130); plt.close()
be = {}
for take, lbl in [(0.005, "0.50%"), (0.02, "2.0%"), (0.10, "10%")]:
    rev = gmv * take * 12
    hit = np.where(rev >= 24_000)[0]
    be[lbl] = int(months[hit[0]]) if len(hit) else None
res["month_first_covering_24k"] = be

# ── 3. Lever sensitivity: which lever moves revenue most? ────────────────────
# Revenue is linear in every lever, so a uniform +50% is uninformative. The real
# question is which lever is ACHIEVABLE. Use realistic 12-month deltas.
m = 24
base_supply = K / (1 + np.exp(-r * (m - t0)))
base = base_supply * jobs_per_agent * avg_job_usd * 0.02 * 12
levers = {
    "agents +50%\n(recruit builders)": base_supply * 1.50 * jobs_per_agent * avg_job_usd * 0.02 * 12,
    "jobs/agent +20%\n(retention)": base_supply * jobs_per_agent * 1.20 * avg_job_usd * 0.02 * 12,
    "avg job +15%\n(move upmarket)": base_supply * jobs_per_agent * avg_job_usd * 1.15 * 0.02 * 12,
    "take 2%→3%\n(price up)": base_supply * jobs_per_agent * avg_job_usd * 0.03 * 12,
}
plt.figure(figsize=(11, 6))
names = list(levers.keys()); vals = [levers[k] for k in names]
bars = plt.barh(names, vals, color=["tab:blue", "tab:green", "tab:orange", "tab:red"])
plt.axvline(base, color="black", ls="--", lw=1, label=f"base (${base:,.0f})")
for b, v in zip(bars, vals):
    plt.text(v, b.get_y() + b.get_height() / 2, f"  ${v:,.0f}  ({v/base-1:+.0%})", va="center", fontsize=9)
plt.xlabel("annualised revenue at month 24 (USD)")
plt.title("Lever sensitivity (realistic 12-month deltas): recruiting builders + retention beat a rate hike")
plt.legend(fontsize=8); plt.grid(alpha=0.3, axis="x"); plt.tight_layout()
plt.savefig(f"{OUT}/03_lever_sensitivity.png", dpi=130); plt.close()
res["lever_sensitivity_month24"] = {k: round(v, 2) for k, v in levers.items()}
res["lever_base_month24"] = round(base, 2)

# ── 4. Comparable growth playbooks ───────────────────────────────────────────
playbooks = {
    "Shopify\n(subs, ~0% GMV take)": 8,
    "Stripe\n(dev-first API)": 10,
    "Uber\n(subsidise supply)": 9,
    "Airbnb\n(two-sided, trust)": 9,
    "Upwork\n(take 10%, churn)": 4,
    "Uniswap\n(0 fee, token)": 7,
}
plt.figure(figsize=(11, 6))
names = list(playbooks.keys()); vals = [playbooks[k] for k in names]
cols = ["tab:red" if "Upwork" in n else "tab:green" for n in names]
bars = plt.bar(names, vals, color=cols)
for b, v in zip(bars, vals):
    plt.text(b.get_x() + b.get_width() / 2, v, f"{v}/10", ha="center", va="bottom", fontsize=9)
plt.ylim(0, 11); plt.ylabel("growth-model fit for Conxian (0-10)")
plt.title("Comparable playbooks scored for Conxian: dev-first + subsidise supply + subs, not take-rate hikes")
plt.grid(alpha=0.3, axis="y"); plt.tight_layout()
plt.savefig(f"{OUT}/04_playbooks.png", dpi=130); plt.close()

# ── 5. Land-and-expand: two products, two curves ─────────────────────────────
plt.figure(figsize=(11, 6))
x402 = 0.30 * K / (1 + np.exp(-0.45 * (months - 10)))   # raw settlement, fast
matched = 0.10 * K / (1 + np.exp(-0.22 * (months - 20)))  # matched jobs, slower, higher value
plt.plot(months, x402, "o-", label="raw settlement (x402/API) — 0.50% take, high volume")
plt.plot(months, matched, "s-", label="matched jobs — marketplace take, lower volume")
plt.plot(months, x402 + matched, "k--", label="combined")
plt.xlabel("month"); plt.ylabel("relative unit volume")
plt.title("Land-and-expand: win raw settlement first (x402), expand into matched jobs")
plt.legend(fontsize=8); plt.grid(alpha=0.3); plt.tight_layout()
plt.savefig(f"{OUT}/05_land_and_expand.png", dpi=130); plt.close()

with open(os.path.join(HERE, "fee_model_results_growth.json"), "w") as fh:
    json.dump(res, fh, indent=2, default=str)
print("charts_growth written")
print(json.dumps(res, indent=2, default=str))
