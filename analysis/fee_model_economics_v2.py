#!/usr/bin/env python3
"""Pass 2 — corrected & expanded fee economics.

Replaces the flawed isoelastic Laffer (Pass 1 found no interior optimum under
constant elasticity) with demand curves that have a CHOKE PRICE, which is what
produces a genuine interior revenue-maximising rate.

Also adds: elasticity sensitivity, disintermediation (off-platform leakage),
break-even, and a full-system revenue build-up.

Run: python3 analysis/fee_model_economics_v2.py
Emits: analysis/charts_v2/*.png and analysis/fee_model_results_v2.json
"""
import json
import os

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "charts_v2")
os.makedirs(OUT, exist_ok=True)
res = {}

# ── 1. Laffer with a CHOKE PRICE (the correct interior optimum) ───────────────
# Linear demand: V(r) = Vmax (1 - r/r_c).  R(r) = r V(r) peaks at r* = r_c/2.
r = np.linspace(0, 300, 601)  # bps
Vmax = 1e8
plt.figure(figsize=(11, 6))
peaks = {}
for r_c, col in [(100, "tab:red"), (200, "tab:orange"), (300, "tab:blue"), (400, "tab:green")]:
    V = Vmax * np.clip(1 - r / r_c, 0, None)
    R = r * V
    r_star = r_c / 2
    peaks[r_c] = r_star
    plt.plot(r, R / Vmax, color=col, label=f"choke r_c={r_c} bps → peak at {r_star:.0f} bps")
    plt.plot(r_star, (r_star * Vmax * (1 - r_star / r_c)) / Vmax, "k*", ms=11)
plt.axvline(50, color="grey", ls="--", lw=1, label="shipped launch rate 50 bps")
plt.axvline(200, color="grey", ls=":", lw=1, label="retired 2%")
plt.xlabel("fee rate (bps)"); plt.ylabel("revenue index  R/Vmax")
plt.title("Laffer (corrected): linear demand with a choke price → revenue peaks at exactly half the choke")
plt.legend(fontsize=8); plt.grid(alpha=0.3); plt.tight_layout()
plt.savefig(f"{OUT}/01_laffer_choke.png", dpi=130); plt.close()
res["laffer_linear_peak_bps"] = {str(k): v for k, v in peaks.items()}
res["laffer_linear_note"] = "Linear demand V=Vmax(1-r/rc) → R peaks at r*=rc/2 exactly."

# ── 2. Varying elasticity (log-log demand with elasticity rising with r) ──────
# A demand curve whose local elasticity rises with the rate is the realistic
# shape; the revenue peak is where |elasticity| = 1.
r = np.linspace(1, 400, 600)
plt.figure(figsize=(11, 6))
# eps(r) = eps0 + slope*r ; V = V0 * (r/r0)^(-eps(r)) evaluated numerically
for eps0, slope, col in [(0.3, 0.004, "tab:red"), (0.5, 0.004, "tab:orange"),
                         (0.5, 0.008, "tab:blue"), (0.7, 0.008, "tab:green")]:
    eps_r = eps0 + slope * r
    # numerical integration of d ln V/d ln r = -eps(r)
    lnV = np.cumsum(-eps_r * np.gradient(np.log(r)))
    V = np.exp(lnV)
    R = r * V
    i = int(np.argmax(R))
    plt.plot(r, R / R.max(), color=col,
             label=f"eps0={eps0}, slope={slope} → peak {r[i]:.0f} bps (|e|={eps_r[i]:.2f})")
    plt.plot(r[i], 1.0, "k*", ms=11)
plt.axvline(50, color="grey", ls="--", lw=1, label="shipped 50 bps")
plt.xlabel("fee rate (bps)"); plt.ylabel("revenue (normalised to its own peak)")
plt.title("Laffer with RISING elasticity: the peak sits where |elasticity| crosses 1")
plt.legend(fontsize=8); plt.grid(alpha=0.3); plt.tight_layout()
plt.savefig(f"{OUT}/02_laffer_varying_elasticity.png", dpi=130); plt.close()

# ── 3. Disintermediation: off-platform leakage ───────────────────────────────
# Fraction that stays on-platform = 1/(1+exp(k*(r - r_leak)))  (logistic)
r = np.linspace(1, 400, 600)
Vmax = 1e8
plt.figure(figsize=(11, 6))
for r_leak, k in [(100, 0.05), (150, 0.05), (200, 0.05), (150, 0.10)]:
    stay = 1 / (1 + np.exp(k * (r - r_leak)))
    R = r * Vmax * stay
    i = int(np.argmax(R))
    plt.plot(r, R / Vmax, label=f"leak midpoint {r_leak} bps, k={k} → peak {r[i]:.0f} bps")
    plt.plot(r[i], R[i] / Vmax, "k*", ms=10)
plt.axvline(50, color="grey", ls="--", lw=1, label="shipped 50 bps")
plt.xlabel("fee rate (bps)"); plt.ylabel("revenue index R/Vmax")
plt.title("Disintermediation: above the leakage threshold, volume leaves and revenue falls")
plt.legend(fontsize=8); plt.grid(alpha=0.3); plt.tight_layout()
plt.savefig(f"{OUT}/03_disintermediation.png", dpi=130); plt.close()

# ── 4. Effective rate is convex in size (floor interaction) — the real shape ──
RAIL_COST = {"LIGHTNING": 8, "FEDIMINT": 20, "ALEX_STACKS": 40, "SBTC": 300}
def floor_of(rail):
    return (RAIL_COST[rail] * 12500) // 10000
sizes = np.logspace(1, 9, 500)
plt.figure(figsize=(11, 6))
for rail, col in zip(RAIL_COST, ["tab:green", "tab:blue", "tab:orange", "tab:red"]):
    fl = floor_of(rail)
    eff = np.maximum(sizes * 0.005, fl) / sizes * 10000
    plt.plot(sizes, eff, color=col, label=f"{rail} (floor {fl} sat)")
plt.xscale("log"); plt.yscale("log")
plt.axhline(50, color="grey", ls="--", lw=1, label="headline 50 bps")
plt.xlabel("settlement size (sats, log)"); plt.ylabel("effective rate (bps, log)")
plt.title("Effective rate vs size: the floor makes the fee REGRESSIVE (higher rate on small jobs)")
plt.legend(fontsize=8); plt.grid(alpha=0.3); plt.tight_layout()
plt.savefig(f"{OUT}/04_regressive_floor.png", dpi=130); plt.close()

# ── 5. Break-even: revenue vs fixed cost across scenarios ────────────────────
vols = np.array([1e5, 5e5, 1e6, 5e6, 1e7, 2.5e7, 5e7, 1e8])
btc = 100_000.0
avg = 250_000
rev = []
for v in vols:
    total_sat = v / btc * 1e8
    n = total_sat / avg
    fee = max(avg * 0.005, 50)  # AlexStacks
    rev.append(n * fee / 1e8 * btc)
rev = np.array(rev)
plt.figure(figsize=(11, 6))
plt.plot(vols, rev, "o-", label="fee revenue (0.50% launch)")
plt.axhline(20_000, color="tab:red", ls="--", label="burn $20k/mo (FUNDING)")
plt.axhline(30_000, color="darkred", ls=":", label="burn $30k/mo")
plt.xscale("log"); plt.yscale("log")
plt.xlabel("monthly settled volume (USD, log)"); plt.ylabel("monthly revenue (USD, log)")
plt.title("Break-even: with only the fee stream, break-even needs very high volume")
plt.legend(fontsize=8); plt.grid(alpha=0.3); plt.tight_layout()
plt.savefig(f"{OUT}/05_breakeven.png", dpi=130); plt.close()
be20 = float(np.interp(0, rev - 20_000, vols)) if rev.max() > 20_000 else None
res["breakeven_volume_usd_at_20k_burn"] = be20

# ── 6. Full-system revenue build-up (5 streams, corrected) ───────────────────
# Streams per FUNDING sec.5, but using the ADR-005 rate for the fee stream.
v_month = 1e7  # $10M/mo
fee_stream = v_month * 0.005            # protocol fee 0.50%
premium = v_month * 0.005               # Managed premium (blocked)
institutional = v_month * 0.003         # negotiated (blocked)
community = v_month * 0.01 * 0.0        # 1% of pool volume — but 0 collected today
staking = v_month * 0.0005              # ~ APY on staked treasury (blocked)
streams = {"Protocol fee (0.50%)": fee_stream, "Premium (+0.5%)": premium,
           "Institutional (0.30%)": institutional, "Community pools (1%)": community,
           "Staking yield": staking}
plt.figure(figsize=(11, 6))
names = list(streams); vals = [streams[n] for n in names]
cols = ["tab:green", "tab:red", "tab:red", "tab:red", "tab:red"]
plt.barh(names, vals, color=cols)
for i, v in enumerate(vals):
    plt.text(v, i, f"  ${v:,.0f}", va="center", fontsize=9)
plt.xlabel("monthly revenue (USD) at $10M/mo volume")
plt.title("5-stream build-up: only the protocol fee is collectable today; the rest are blocked")
plt.grid(alpha=0.3, axis="x"); plt.tight_layout()
plt.savefig(f"{OUT}/06_five_stream.png", dpi=130); plt.close()
res["five_stream_at_10m"] = streams
res["five_stream_total_collectable_today"] = fee_stream * 0.0  # nothing collects yet

# ── 7. Sensitivity heatmap: revenue vs (rate, elasticity) ────────────────────
rates = np.linspace(10, 300, 60)
elasts = np.linspace(0.3, 2.0, 60)
RR = np.zeros((len(elasts), len(rates)))
for i, e in enumerate(elasts):
    for j, rr in enumerate(rates):
        RR[i, j] = rr * Vmax * (rr / 50.0) ** (-e)
plt.figure(figsize=(11, 6))
plt.imshow(RR / Vmax, aspect="auto", origin="lower",
           extent=[rates[0], rates[-1], elasts[0], elasts[-1]], cmap="viridis")
plt.colorbar(label="revenue index R/Vmax")
plt.axvline(50, color="white", ls="--", lw=1.2, label="shipped 50 bps")
plt.xlabel("fee rate (bps)"); plt.ylabel("volume elasticity ε")
plt.title("Sensitivity: revenue rises with rate only when ε<1; falls when ε>1 (white line = shipped rate)")
plt.legend(fontsize=8); plt.tight_layout()
plt.savefig(f"{OUT}/07_sensitivity.png", dpi=130); plt.close()

with open(os.path.join(HERE, "fee_model_results_v2.json"), "w") as fh:
    json.dump(res, fh, indent=2, default=str)
print("charts_v2 written")
print(json.dumps(res, indent=2, default=str))
