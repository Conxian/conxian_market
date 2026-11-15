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

## Pass 4 — Feasibility / "are we too cheap to survive?" (owner challenge)

### 4a. THE ACTUAL FUNDING CONTEXT (found, not assumed)
- **Real funding ask:** **USD 24,000 / 12 months** (~$2,000/mo), 0.5 FTE senior engineer
  (HRF + Spiral + OpenSats drafts, `.github-private/docs/funding/`). Budget = engineering
  time $15k + TEE test hardware $3k + security review $5k + docs $1k.
- **Real cost base:** infra ≈ **$0/mo** (Render free ×5, Cloudflare/Supabase/Neon free);
  the only bleed was GitHub (~$105/mo, now stopped). `FINANCIAL_REALITY_CHECK_2026_11_14.md`.
- **Recognised revenue: $0.** `unit-economics.json` is mostly `null`; verdict
  `INSUFFICIENT DATA`.
- **⚠️ CONTRADICTION:** `FUNDING_AND_ECONOMICS.md` §4.1 says the cost base is
  **$20,000/mo ($240k/yr)**. The actual ask is **$24k/yr**. That is a **10× discrepancy**
  in the org's own numbers.

### 4b. THREE CONFLICTING TAKE RATES in the docs
| Source | Platform take | Break-even @ $24k/yr |
|---|---|---|
| ADR-005 (newest, "calibrated") | **0.50% → 0.10%** | **$4.8M/yr** volume |
| ADR-001 §2 (tier table) | **2.0%** | **$1.2M/yr** volume |
| ADR-001 §1.1/§1.2 (80/10/10 of GROSS) | **10.0%** | **$240k/yr** volume |
| FUNDING §2.3 (50/30/20 of the 10% treasury) | 10% (Option B) | $240k/yr |

So the platform's take is documented as **0.50%, 2%, AND 10%** — a **20× spread**.

### 4c. CODE reality (two unreconciled takes, two code paths)
- `job_card_escrow.evaluateAndRelease` applies **80/10/10 of gross** → platform **10%**
  (and drops the treasury/ecosystem legs — the P0-7 bug).
- `fee_calculator.calculateDynamicFee` computes **0.50% of gross**, split 50/30/20.
- These are **different takes on different paths** — the D-1 conflict, now sharpened.

### 4d. ANSWER to "ain't we too cheap to survive?"
- At **0.50%**: self-funding needs **~$4.8M/yr** settled volume. Not plausible in year 1.
- At **10%**: needs **~$240k/yr** — plausible.
- **Diagnosis:** Conxian prices like a *settlement rail* (0.50%, vs Stripe 2.9%) while
  operating like a *marketplace* (escrow + attestation + SLA + dispute). Marketplaces take
  10–30% (Upwork 10%, Airbnb ~15%, Uber ~25%, app stores 15–30%). **0.50% is too cheap
  for the service provided.**
- **But** the market fee is not the only surface: the gateway subscription ladder
  ($200/mo base + usage; 128k-sat plans; x402 1000 sat/call) is the designated
  monetisation surface (ADR-009) and the four surfaces are **disjoint** (#1343).
- **Nuance:** the correct answer is not "raise the market fee to 10% blindly" (that risks
  disintermediation), but to (a) resolve which surface books the revenue, and (b) set the
  market fee at a level that survives *if it is the only surface*.

### 4e. Option A re-check (owner: "option A also, but make sure first")
Option A (split the FEE F 50/30/20; treat 80/10/10 as aggregate) is still the correct
**split-basis** resolution. BUT Option A alone leaves the platform with only **0.50%** of
gross — which, on the survival math, **is too cheap**. So Option A must be paired with a
decision on the **fee level** (not just the basis). Recommendation updated below.

## Pass 5 — Survival model (`fee_model_survival.py`)
- Break-even volume for the **$24k/yr** ask: 0.50% → **$4.8M/yr**; 2% → $1.2M/yr;
  10% → $240k/yr; 15% → $160k/yr.
- At a plausible **$1M/yr** volume: 0.50% earns **$5,000** (21% of the ask); 2% → $20k
  (83%); 10% → $100k. **0.50% cannot survive.**
- Take-rate benchmark chart: Conxian prices in the **rail** band (0.05–2.9%) but
  operates a **marketplace** (escrow+attestation+SLA+dispute; peers take 10–30%).

## Pass 6 — Growth model (`fee_model_growth.py`)
- Flywheel: **supply (builders) is the scarce side**; recruiting builders (+50%) and
  retention (+20% jobs/agent) beat a rate hike on risk-adjusted terms.
- Path to break-even: at 0.50% far later than at a marketplace rate.
- Comparable playbooks: **Shopify** (subs, ~0% GMV take on $292B GMV), **Stripe**
  (dev-first), **Uber** (subsidise supply), **Airbnb** (trust layer) → fit; **Upwork**
  (rate hike → churn) → warning. Uniswap (free protocol + token).
- Land-and-expand: cheap 0.50% rail to land devs (x402) + marketplace take on matched jobs.

## Pass 5–6 outputs
- Docs: `docs/research/FEE_MODEL_FEASIBILITY_AND_SURVIVAL.md`,
  `docs/research/FEE_MODEL_GROWTH_AND_ALIGNMENT.md`.
- Artifact: `analysis/fee_model_feasibility_growth.html` (10 charts).
- Alignment: **D-1 (basis) = Option A confirmed**; **D-5 (level)** and **D-6 (surface)**
  are the remaining owner decisions.

## Final verification (all passes)
Parity 0/1440 · 4 models OK · 2 artifacts valid (24 images, 0 missing) · 471 tests pass.
