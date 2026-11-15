# Working Notes — Fee Model Verification (3-pass challenge)

> Session 2026-11-14. Self-verification log. Persisted so no work is lost between passes.

## Pass 1 — Verify own work

### 1a. Cross-language parity: Python model vs compiled TypeScript

Built `analysis/gen_ts_grid.mjs` (emits a reference grid from the **real** compiled
`dist/fee_calculator.js`) and `analysis/parity_check.py` (recomputes every row in
Python with BigInt/integer semantics).

- Grid: 8 rails × 4 decay tiers × 9 amounts × 5 load factors = **1440 rows**.
- Result: **0 mismatches — PARITY OK.**
- This confirms the Python port reproduces the shipped fee exactly, including the
  integer-division truncation and the `clamp(load,1.0,3.0)` behaviour (load 5.0 → 3.0).

**Conclusion:** the analysis model is faithful to the code. The economics doc's
model numbers are trustworthy *as a model of the code*.

### 1b. ⚠️ CORRECTION — the "69 bps Laffer optimum" was wrong

**Previous claim:** "at elasticity ε≈1 the revenue-maximising rate is ~69 bps."

**Re-derivation.** With isoelastic demand `V(r) = V0 (r/r0)^(-ε)`:

```
R(r) = r · V(r) = V0 · r0^ε · r^(1-ε)
```

- ε < 1 → `R` **increasing** in r → corner max (charge the most).
- ε = 1 → `R` **constant** (`= V0·r0`) → *no* interior optimum; argmax is float noise.
- ε > 1 → `R` **decreasing** in r → corner max (charge the least).

So under **constant** elasticity there is **no interior revenue-maximising rate**.
My earlier chart's "peak" at ε=1 (69 bps) was a floating-point tie-break artifact of
`np.argmax` on a numerically-flat array. **The claim is withdrawn.**

**Why this matters.** A Laffer *interior peak* requires **elasticity that varies with
the rate** — i.e. a demand curve with a choke price (finite maximum willingness to
pay). Real demand is not isoelastic over the whole range: near zero rate demand is
inelastic; near the choke price it is very elastic. The peak sits where |ε| crosses 1.

**Correct model (Pass 2):** use a demand curve with a choke price, e.g. linear
`V(r) = Vmax · (1 - r/r_choke)`, and/or log-log demand with an elasticity that rises
with r. Then the revenue-maximising rate is a genuine interior point, and the result
can be compared against the shipped 50 bps launch rate.

### 1c. Numbers to re-audit in the doc (Pass 3)

- The Laffer section and its chart (`03_laffer_revenue_vs_rate.png`) → must be replaced.
- The "~69 bps" sentence in `FEE_MODEL_ECONOMICS_JUXTAPOSITION.md` §3 → must be corrected.
- The HTML artifact's "~69 bps" verdict line → must be corrected.
- Everything else (D-1 19.9×, cost recovery, scaling, macro) → re-check in Pass 3.

### 1d. Confirmed-correct so far

- Python/TS parity: exact (1440/1440).
- D-1: option B / option A = 19.9× at 50 bps on a 1,000,000-sat settlement. Re-derive
  analytically: A_ops = 0.5·F = 0.5·0.005·G = 0.0025·G; B_ops = 0.5·0.1·(G−F) =
  0.05·0.995·G = 0.04975·G; ratio = 0.04975/0.0025 = **19.9**. ✔ exact.
- Rail floors: `(cost × 12500)//10000` → Lightning 10, Fedimint 25, AlexStacks 50,
  Babylon 50, EvmErc8183 75, Statechain 125, RGB 312, Sbtc 375. ✔ (integer division)

## Pass 2 — Rebuild + expand

### 2a. Corrected Laffer (choke-price demand)
Linear demand `V = Vmax(1 − r/rc)` → `R(r) = r·Vmax(1 − r/rc)` → peak at **r* = rc/2**
(exact, confirmed numerically for rc = 100/200/300/400 → 50/100/150/200 bps).
A revenue peak only exists with a finite choke price. Charts: `charts_v2/01`, `02`.

### 2b. Varying elasticity
With elasticity rising in r, the revenue peak sits where |ε| crosses 1 (chart 02).
This is the realistic shape and the correct framing to replace the withdrawn claim.

### 2c. Disintermediation
Modelled as logistic on-platform retention. Above the leakage midpoint, revenue falls
(chart 03). The 50 bps shipped rate sits below typical leakage midpoints (100–200 bps) —
i.e. the current rate is inside the safe zone, which supports keeping it low.

### 2d. Regressive floor (new finding)
The cost floor makes the effective rate **regressive**: small jobs pay a higher effective
rate than large ones (chart 04). At 50 bps the crossover (floor = percentage) is
~2,000 sat (Lightning) to ~75,000 sat (sBTC). This is intended (cost recovery) but is a
distributional fact worth stating: micro-agent work subsidises large work.

### 2e. Break-even (corrected)
With only the fee stream at the ADR-005 rate, break-even at the FUNDING $20k/mo burn needs
~**$4.0M/mo** settled volume (chart 05).

### 2f. ⚠️ MATERIAL DISCREPANCY — 5-stream revenue at $10M volume
`FUNDING_AND_ECONOMICS.md` §5.3 states **$220,800/mo** at $10M volume (full 5-stream).
Recomputed at the ADR-005 rate: fee stream = **$50,000/mo** (0.50% × $10M). The doc's
figure implies ~2.2% of volume — the **retired 2%-era** rate. So the doc's revenue
projection is ~4.4× too high vs the ADR-005 rate. This compounds drift issue #366.

### 2g. Five-stream collectable today = $0
Fee (not collected), premium (blocked: attestation), institutional (blocked), community
($0), staking (blocked: fails closed). Chart 06.

## Pass 3 — Final check with all inputs

### 3a. Full re-run (all green)
- `npm run build` → OK; parity harness → **1440 rows, 0 mismatches**.
- `fee_model_economics.py` (v1) → OK; `fee_model_economics_v2.py` → OK.
- Artifact: 14 images referenced, 0 missing, valid HTML.
- `npx vitest run` → **471 passed / 37 files**.

### 3b. Consolidated numeric audit — 11/11 PASS
D-1 19.90× · fee 5000 sat · net 995000 · Lightning floor 10 · sBTC floor 375 ·
Laffer peak = rc/2 (50, 200) · break-even $4.0M · fee stream $50k @ $10M ·
collectable today $0 · doc overstates 4.42×.

### 3c. Corrections shipped in this pass
- Withdrew the "69 bps Laffer optimum" (float artifact) in
  `FEE_MODEL_ECONOMICS_JUXTAPOSITION.md` §3; replaced with the choke-price model
  (peak = r_c/2) + disintermediation + regressive-floor findings.
- Updated the recommendation table, "what not to do", and the confidence table.
- Added the material 4.4× revenue-projection discrepancy (feeds #366).
- Rebuilt the HTML artifact (v2) with the corrected charts + a visible self-correction note.

### 3d. Residual uncertainty (unchanged, stated honestly)
- Rail cost table is v0, not telemetry.
- Demand-curve shape (choke price, elasticity path) is assumed, not estimated.
- Benchmark take-rate figures not re-verified online this session (search tools limited).

### 3e. Verdict
The corrected model **strengthens** the Option A recommendation: with a plausible
~100 bps choke price the revenue-maximising rate is ~50 bps — the shipped rate — and
50 bps sits below the disintermediation threshold. No change to the recommendation;
the reasoning behind it is now correct rather than partly spurious.
