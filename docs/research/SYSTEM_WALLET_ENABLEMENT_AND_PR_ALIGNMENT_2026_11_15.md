# Whole-System Wallet & Treasury Enablement — juxtaposed with every open PR

> **Status:** Discussion input (research) — **nothing here is deployed or enabled**
> **Date:** 2026-11-15
> **Question:** how do the business repo, the Business Operations System (BOS), the
> gateway, and the market fit together — and do we enable a **system wallet**
> (operational/keeper/gas)? This doc maps the whole system and **juxtaposes it with
> all 11 open PRs** so we do not divert: every open PR is checked against the plan.
> **Verified against:** live code, `origin/dev`, the GitHub API, and the private
> `conxian-business` repo (read-only), 2026-11-15.

---

## 0. The one-line answer

The architecture is **already decided and written down** (business repo
`docs/BOS_WALLET_CONTROL_MODEL.md` + `docs/protocols/ENTERPRISE_CUSTODY_BASELINE.md`).
What is missing is **not design — it is (a) a deployed vault, (b) a signing key, and
(c) a decision on which PR lands first**. Concretely: we do **not** need a new "system
wallet" concept; the **`SAB_BOS_EXECUTOR_KEY`** (a 1-of-1, gas-buffer-only keeper key)
already *is* the operational/system wallet, and it is designed to be **enabled in
testnet/shadow only** — never as a custodian, never with admin/owner rights.

**But we must land the model before enabling anything**, because the two market PRs in
flight (#355 and #356) **contradict each other on the split rule** and **conflict on 6
files**. Enabling a wallet on top of an unresolved split rule would bake in the wrong
number.

---

## 1. The system, as it actually is (verified)

```
LAYER 0 — Governance & identity        SAB (business) → DAO timelock
         conxian-business (PRIVATE, default branch `main`)
           ├─ BOS = orchestration + policy + evidence (NEVER a signing key)
           └─ apps/control-plane  → bos.conxian-labs.com / control.conxian-labs.com

LAYER 1 — Monetisation surface         conxian-gateway   (ADR-009 single surface)
           Rust; billing.rs ProtocolFeeRecord; ⚠ fee collection is a STUB
           (gateway #974 report endpoint, #975 settle_protocol_fee — both OPEN)

LAYER 2 — Value layer (the market)     conxian_market
           fee_product.ts (ADR-007) → protocol_fee_settlement.ts → protocol-fee-vault.clar
           ⚠ contract NOT deployed; protocolFeeActive = false

LAYER 3 — Settlement rails             Lightning (CLN+LNbits, self-hosted),
           sBTC, Stacks/ALEX, RGB, Statechain (Spark), Citrea, EVM-L2

LAYER 4 — Trust / custody              conxius-enclave-sdk (TEE/HSM),
           conxius-wallet (signing layer), lib-conxian-core (fees)
```

**Live today:** gateway web service (Render), 3 DigitalOcean droplets (pruned bitcoind +
Core Lightning + LNbits; Forgejo + act_runner), labs-site, control-plane (frozen 7 Nov
build). **Cost:** ≈ $24/mo infra + $117.41/mo GitHub platform, `revenue = $0`.
**Nothing collects a fee anywhere.** `Conxian/Conxian` (the contracts repo the plan
assumed) **does not exist** — confirmed via the org API.

---

## 2. Custody architecture (canonical — from the business repo, not invented here)

`conxian-business/docs/BOS_WALLET_CONTROL_MODEL.md` defines **wallet classes**, not
human wallets. **Custody lives in contract principals; a wallet is only the signing
layer.** Concrete principals, caps, and tranche sizes are **deliberately off-Git** (ZSE)
in a signer-administration record (pointer stub `admin/SECRETS.md` → Lit Protocol vault).

| Class | Type | Quorum | Purpose | Limit |
|---|---|---|---|---|
| `BOOTSTRAP_OPERATOR_WALLET` | standard | 1-of-1 (temp) | deploy + one-time init only | must not survive handoff |
| **`SAB_BOS_EXECUTOR_KEY`** | **system signer** | **1-of-1** | **keeper ops, fee sweeps, reporting, allowlisted calls, approved Web3 SaaS/storage payments** | **gas-buffer only; no admin/owner writes** |
| `SAB_DEPLOYER_MULTISIG` | standard | start 2-of-3 → **3-of-5** | deploys/upgrades, role wiring | holds **deploy gas only**; no vault withdrawal |
| `SAB_PAYOUT_MULTISIG` | standard | 3-of-5 (or 2-of-3+caps) | maintainer/bounty payouts | small tranches; **disabled** until enablement decision |
| `SAB_EMERGENCY_PAUSE_MULTISIG` | standard | **2-of-3** | fast pause/isolate | **pause only**; no value transfer |
| `SAB_EMERGENCY_RECOVERY_MULTISIG` | standard | **3-of-5** | unpause, key rotation, revokes | incidents only |
| `DAO_TIMELOCK` | contract | DAO queues; execute permissionless | time-delayed policy/high-risk | ≥ 144 blocks (chain) / ≥ 86 400 s (off-chain) |
| `DAO_POLICY_AUTHORITY` | standard/contract | 3-of-5 | queue/cancel timelock | policy only; no custody |
| `PROTOCOL_VAULTS` | contract | on-chain rules | `operational-treasury`, `dao-treasury`, `vaults.custody`, **`protocol-fee-vault`** | deny-by-default withdrawals |

**Quorum rule:** 3-of-5 is the preferred end-state for anything that moves value or
changes control-plane authority; start 2-of-3 and migrate when a 5-signer bench exists.

**Enterprise baseline (`ENTERPRISE_CUSTODY_BASELINE.md`):** keys in HSM/MPC/TEE, **no
plaintext keys in containers/CI/agents**; **separate keys** for payment / treasury /
identity-admin / deployment; quorum ≥ 2-of-3; time-lock ≥ 144 blocks / ≥ 24 h; fail-closed
signing; deterministic approval state machine (`CREATED → POLICY_VALIDATED →
QUORUM_PENDING → APPROVED → EXECUTING → COMPLETED`).

**Non-custody boundary (repeated across the business repo):** Conxian-Labs does **not**
take custody of user/customer assets. User keys stay user-controlled; protocol balances
live in contract principals; regulated partners own regulated custody.

---

## 3. "Do we enable a system wallet?" — the three candidates

| Candidate | What it is | Recommendation |
|---|---|---|
| **`SAB_BOS_EXECUTOR_KEY`** | the **operational / keeper / gas** wallet — a 1-of-1 system signer for automated calls (epoch triggers, fee sweeps, reporting) | **Yes, but testnet/shadow only, and only after Step 1 of §7.** Capped to a small gas buffer; no admin/owner rights; allowlisted calls only. This is the correct answer to "do we enable an operational wallet". |
| **`SAB_DEPLOYER_MULTISIG`** | the wallet that deploys `protocol-fee-vault.clar` | **Blocked — no key material exists.** Needs a genuine signer set. Not something an agent can bootstrap. |
| **`TREASURY-VAULT` / `PROTOCOL_VAULTS`** | the passive fee destination (contract principal) | **Correct destination; not deployed.** Deploying needs `SAB_DEPLOYER_MULTISIG` (above). |

**Verdict:** the system wallet we *can* responsibly enable now is the **keeper/gas key**,
in a non-production lane, with strict caps. Everything value-bearing stays gated.

---

## 4. The money flow, end-to-end — and exactly where it stops

```
G (gross, escrow-locked)
 ├─ builder  ← G − take            (direct; works today)
 └─ take (10% matched / ADR-005 dynamic rail)
      └─ 50/30/20 → TREASURY-VAULT  ← STOP #1: contract not deployed
           └─ sweep-treasury → ops / founders / ecosystem
                └─ gateway accumulate_protocol_fee ← STOP #2: stub (gateway #974)
                     └─ settle_protocol_fee (sign + broadcast) ← STOP #3: stub (gateway #975)
```

Three stubs, in three repos, all with open tracking issues. **No value moves today.**
The market side (fee computation, settlement plan, vault contract, tests) is done and
correct; the **gateway side is the real gap** (confirmed by `.github-private` #130:
"`billing.rs` aggregators have no non-test callers; no fee endpoint; `ContractBridge`
never constructed").

---

## 5. Juxtaposition with every open PR (11 total)

| # | PR | Repo | What it does | Overlap / risk | Alignment action |
|---|---|---|---|---|---|
| 355 | docs(agents,kb) align KB + **single canonical fee model (ADR-005)** | market | Aligns KB; **keeps 80/10/10**, adds `FEE_DESTINATION_AND_CUSTODY.md`, `TREASURY_DEPLOYMENT_GUIDE.md` | **CONFLICTS with #356 on 6 files**; **contradicts ADR-007** (keeps 80/10/10; calls ADR-005 canonical; ADR-005 is still *Proposed*) | **Land FIRST**, then rebase #356 onto it |
| 356 | Protocol fee ADR-007 **two-product model, implemented** (+ MPP bridge) | market | fee_product.ts, protocol-fee-vault.clar, MPP bridge, docs sweep | supersedes #355's fee-model conclusions; over-broad (3 topics) | **Split**: fee model (rebase after #355) + MPP (#371, already closed) as separate PRs |
| 130 | restricted protocol-fee destination packet | .github-private | private continuity copy of #356 + a **second copy** of `protocol-fee-vault.clar` | 3rd copy of the vault contract (market, .github-private, `Conxian/contracts` submodule) | keep as backup; **name one canonical contract home** |
| 2099 | fee-model economics juxtaposition + BOS renders the fee | business | grounded analysis; control-plane `/economics` shows the fee; L402 finding | none — business has a `dev` branch, base is valid (corrected) | it is the **model of record** for economics |
| 262 | align site pricing/search to **ADR-007** | labs-site | removes 80/10/10 from public pages | assumes ADR-007 is the model | **after** #355/#356 land; consistent with #356 |
| 261 | access-request intake | labs-site | customer-safe intake | none | independent |
| 621 / 783 / 1020 | org-wide doc audit | nexus / enclave-sdk / wallet | dead links, retired repos | none | independent |
| 977 / 978 | dependabot bumps | gateway | deps | none | independent |

**No PR diverts from the others on rails/settlement.** The **only** collision is
**#355 ↔ #356** (the fee model), and **#262 depends on its outcome**.

---

## 6. Divergences to resolve BEFORE enabling anything

| # | Divergence | Evidence | Why it gates enablement |
|---|---|---|---|
| **D1** | **#355 and #356 conflict** | `git merge-tree` → 6 conflicting files | you cannot enable a fee whose split rule two open PRs disagree on |
| **D2** | **80/10/10 vs 50/30/20** | #355 keeps 80/10/10 (net); #356/ADR-007 retires it for one 50/30/20 on the take | the split rule is the number that reaches the wallet |
| **D3** | **ADR-005 *Proposed* vs ADR-007 *Accepted*** | `origin/dev` shows ADR-005 Proposed; ADR-007 only exists on the #356 branch | #355 promotes ADR-005 to Accepted; ADR-007 amends it — the two branches assert different canonical rates |
| ~~D4~~ | ~~business #2099 targets `dev`, but the default branch is `main`~~ | **RESOLVED 2026-11-15** — `conxian-business` has `dev`, `main` and `staged`; base `dev` is valid | none |
| **D5** | gateway **"x402" is off-spec L402** | business #2099 §4; gateway #976 | naming a rail wrong misprices it (rail vs matched) |
| **D6** | **3 copies** of `protocol-fee-vault.clar` | market #356, .github-private #130, `Conxian/contracts` submodule | ambiguity over which contract is canonical to deploy |
| **D7** | **#355's deployment guide** points at the dead `Conxian/Conxian` | `TREASURY_DEPLOYMENT_GUIDE.md` §1.1 | a runbook that names a non-existent repo cannot be executed |

---

## 7. Recommended way forward (least diversion, aligned)

**Step 1 — Land the model, one at a time.**
Merge **#355 first** (it is the base KB alignment), then **rebase #356 onto it** and
resolve the fee-model contradictions explicitly (adopt ADR-007: 50/30/20 on the take,
80/10/10 retired; mark ADR-005 as scoped-to-rail, not the headline). **Do not merge both
as-is.**

**Step 2 — Split #356.** Extract the MPP bridge into its own PR (#371 is already closed
against it) so the fee-model PR is reviewable. Keep the vault contract in exactly one
place (**D6**).

**Step 3 — Confirm the one governance number.** The only genuinely unresolved item is
the **split basis** (market #358). ADR-007 answers it (Option A: split the take). Confirm
and close #358.

**Step 4 — Enable the system wallet, non-production only.**
Stand up `SAB_BOS_EXECUTOR_KEY` as a **capped gas-buffer keeper key in testnet/shadow**,
wired to the `fee sweep`/`reporting` allowlist — **not** to any value path. Record it in
the off-Git signer record. This is safe to do now and unblocks shadow-mode verification
(market #363).

**Step 5 — Deploy the vault (owner-gated).** `SAB_DEPLOYER_MULTISIG` → deploy
`protocol-fee-vault.clar` (market #360) → configure role principals → then the gateway
bridge (#974/#975) → then, and only then, `protocolFeeActive` (#363).

---

## 8. Open questions for the owner

1. **PR order:** land **#355 first, then rebase #356** (recommended), or merge #356 and
   discard #355's fee-model changes?
2. **Split rule:** confirm **ADR-007** (one 50/30/20 on the take; 80/10/10 retired) and
   close market #358?
3. **System wallet:** enable **`SAB_BOS_EXECUTOR_KEY`** now in **testnet/shadow only**
   (capped, allowlisted), or hold until the vault deploys?
4. **Signer set:** who are the `SAB_DEPLOYER_MULTISIG` signers? (No key material exists;
   this is the true blocker to #360.)
5. **Canonical contract home:** market repo (recommended) vs `.github-private` vs the
   `Conxian/contracts` submodule?

---

*This document was created by an AI agent (OpenHands) on behalf of the user. It asserts
no revenue, moves no value, and enables nothing.*
