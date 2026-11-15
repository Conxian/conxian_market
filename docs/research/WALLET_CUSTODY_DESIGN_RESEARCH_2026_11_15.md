# Company-Controlled & System Vaults — Design Research and Recommendation

> **Status:** Design research (owner-approved direction) — **nothing here is deployed**
> **Date:** 2026-11-15
> **Answers:** owner questions 3, 4 and 5 —
> (3) *may we enable a system wallet only if we keep admin control to all relevant
> pieces, so we never lock ourselves out or lose the ability to operate or migrate to
> DAO control; research company-controlled vs system vaults;*
> (4) *design a hybrid company so wallet control can be assigned, reassigned and
> managed when someone is fired (ITIL5 / ITSM / banking);*
> (5) *research competitors and industry best practice and advise.*
> **Sources:** primary docs, fetched 2026-11-15 (Safe, Zodiac Roles, OpenZeppelin,
> Turnkey, FROST, Fireblocks) — quoted inline with URLs. Canonical Conxian sources:
> `conxian-business/docs/BOS_WALLET_CONTROL_MODEL.md`,
> `conxian-business/docs/protocols/ENTERPRISE_CUSTODY_BASELINE.md`.

---

## 0. The answer in one paragraph

Enable the **system wallet** — but build it the way the industry builds it: **separate
custody from authority from process.** Custody (the key material, the vault address)
**never moves** when people change. Authority (who may sign, what they may do) is a
**revocable role** you assign, reassign and revoke. Process (joiner/mover/leaver,
recertification, key ceremonies) governs the authority layer and triggers re-sharing
only when needed. That gives you the two properties the owner asked for: **you can always
operate** (no lockout) and **you can always migrate to DAO control** (it is one ownership
transfer, same address, no funds moved). We should adopt **Safe-style threshold custody +
a scoped, revocable role module + a timelock + a pause-only emergency role**, and we
should **not** hand the fee vault an immutable admin.

---

## 1. Company-controlled vs system vaults — the distinction

| | **Company-controlled vault** | **System (operational) vault** |
|---|---|---|
| Purpose | hold the company's / protocol's value | run automation: gas, fee sweeps, reporting, allowlisted calls |
| Who signs | humans, via a **threshold** (2-of-3 → 3-of-5) | a **machine key** (1-of-1 keeper) |
| Spending | governed by policy + quorum (+ timelock for high-risk) | **capped gas buffer**, allowlisted calls only |
| Failure mode | lockout (lost quorum) | key compromise (hot key) |
| Conxian name | `TREASURY-VAULT` → `SAB-TREASURY-MS` / `DAO-TREASURY-MS` | `SAB_BOS_EXECUTOR_KEY` |

Both already exist in Conxian's canonical model. The industry rule is that they are
**separate keys with separate policies** (never one "root key"):

> "**Key separation:** payment, treasury, identity/admin, and deployment keys MUST be
> separate keys with separate policies and audit trails (no shared "root key")."
> — `ENTERPRISE_CUSTODY_BASELINE.md` §1

The system vault is the thing the owner is asking about. Industry treats a machine
signer as **bounded**: Safe Modules exist precisely to give automation a *scoped* ability
without owner rights —

> "Safe Modules … enable recurring transactions … **Enhanced Security: Impose
> restrictions such as whitelists, rate limits, or spending caps** to control fund
> usage."
> — https://docs.safe.global/advanced/smart-account-modules

…and Turnkey's policy engine does the same at the API layer:

> "Our policy engine is the foundation for flexible controls and permissions within your
> organization … `consensus` determines which user(s) may take an action."
> — https://docs.turnkey.com/concepts/policies/overview

---

## 2. The lockout question — how to have admin control *and* not trap ourselves

The owner's exact worry: *"only if we can have admin controls to all relevant, so we
don't lock ourselves or find we cannot operate or move to DAO control."* Three mechanisms
solve it, and all three are standard.

### 2.1 Two-step admin transfer with a delay (not instant, not irreversible)

OpenZeppelin's hardened admin role gives exactly this: the admin seat can only change by
a **nominate → accept** handshake, and the change is **delayable and cancellable**:

> "`AccessControlDefaultAdminRules` … Enforces a **configurable delay** between the two
> steps, with the ability to **cancel before the transfer is accepted**."
> — https://docs.openzeppelin.com/contracts/5.x/api/access

Why it matters here: it prevents two opposite disasters — an **accidental** admin change,
and a **permanent lock** (you cannot fat-finger the admin away, and a scheduled transfer
can be cancelled if the successor does not accept). This is the mechanism to adopt for the
**fee vault's owner seat**.

### 2.2 A timelock that a company can still cancel (migration without a cliff)

The standard "progressive decentralization" controller splits roles:

> "**Admin:** … in charge of granting the roles of Proposer and Executor. **Proposer:**
> … scheduling (and cancelling) operations. **Executor:** … executing operations once the
> timelock has expired … The timelock enforces a **minimum delay** between the
> proposition and the execution."
> — https://docs.openzeppelin.com/contracts/5.x/api/governance (TimelockController)

So today: **company holds Proposer + Admin** (it can queue and **cancel**), **execution is
permissionless after the delay**. Later: hand Proposer to the DAO. There is no cliff —
the company can always cancel a pending action, and migration is a role grant, not a
redeploy.

### 2.3 A pause-only emergency role (stop the bleeding, never seize funds)

Conxian already specifies this and the vault already implements it (issue #362, shipped):
`SAB_EMERGENCY_PAUSE_MULTISIG` is **2-of-3, pause only, no value transfer**. That is the
industry pattern — fast halt without granting a fund-moving capability.

### 2.4 The one genuine lockout risk, named

Threshold custody has a real failure mode: **you cannot lower a threshold you can no
longer meet.** A Safe owner swap or threshold change must itself be signed by the current
threshold. So the design rule is: **never let the live signer bench fall below quorum +
1** — keep a **backup signer** outside the minimum, and rehearse recovery.

> "`swapOwner(prevOwner, oldOwner, newOwner)` … **No funds move; the address is
> unchanged**" — but the swap "is itself a transaction requiring threshold signatures from
> the current owner set."
> — Safe `OwnersManager` semantics (https://docs.safe.global/)

---

## 3. Hybrid-company design — assign / reassign / manage on personnel change

The owner's requirement: if someone is fired, control can be **assigned, reassigned and
managed**. The industry answer is a **three-layer split**, and it is the same answer in
ITSM, in banking, and in crypto.

```
LAYER 1  CUSTODY      the key material + the address        → NEVER moves on personnel change
LAYER 2  AUTHORITY    roles / policies / owner set          → THIS is what you reassign/revoke
LAYER 3  PROCESS      JML + recertification + ceremonies    → governs L2, triggers L1 re-share
```

### 3.1 ITIL / ITSM — joiner, mover, leaver applied to a *key holder*

ITSM's identity governance is **joiner-mover-leaver (JML)** plus periodic **access
recertification** and **separation of duties** (NIST SP 800-53 AC-2/AC-5/AC-6;
ISO/IEC 27001:2022 Annex A 5.15–5.18 and 8.2–8.3; SOC 2 CC6.2 provisioning/deprovisioning).

The crypto twist: a login is **revocable at the directory**; a **key share is material**.
So for a key holder:

- **Leaver** → revoke their **authority** (role/policy/owner slot) immediately, **and**
  re-share/re-key so the departed share is useless.
- **Mover** → re-scope the role binding; rotate the share set if the role changed.
- **Recertification** → periodic confirmation the current holder set should still hold;
  this is the **trigger** to re-share.

### 3.2 Banking — dual control, split knowledge, ceremonies

Banks never let one custodian hold a complete secret:

- **Dual control / four-eyes:** two authorised people act together.
- **Split knowledge:** no single custodian knows the whole key; components combine.
- **Key ceremony:** a scripted, witnessed procedure to generate/assign/**replace**
  custodians — which is exactly "reassign on departure."

Standards: FFIEC IT Examination Handbook (dual control, SoD); Basel *Principles for the
Sound Management of Operational Risk*; PCI DSS (**split knowledge and dual control** of
keys); ISO 27001 access-control clauses; SOC 2 CC6.3 (role-based access, least privilege,
SoD).

### 3.3 Crypto-native — reassign without moving funds

- **Multisig (Safe):** owners are swapped with `addOwnerWithThreshold` / `removeOwner` /
  **`swapOwner`**; threshold with `changeThreshold`. **The Safe address is unchanged and no
  funds move.** (Caveat §2.4: the swap needs the current threshold.)
- **MPC / TSS:** the key never exists in one place; a signer is replaced by provisioning a
  new device/user share — **same address**. **Key refresh / pro-active re-sharing**
  regenerates shares for a new participant set while **keeping the same public key**
  (re-DKG changes the key/address).
- **FROST (threshold Schnorr):** "allows splitting a Schnorr signing key into `n` shares
  for a threshold `t`, such that `t` (or more) participants … generate a signature that can
  be validated by the corresponding verifying key … **indistinguishable from a
  non-threshold signature**." — https://frost.zfnd.org/
- **Turnkey:** authority is **users + authenticators + policies**, key material stays in
  the enclave: "**The Root Quorum bypasses any policies**"; users hold implicit permission
  only if named in `consensus`. So revoking a person = remove their authenticator / user
  and/or tighten the policy — **no on-chain transaction, no fund movement**.
  Sub-organizations give per-tenant isolation: "**The parent organization has read-only
  visibility** into all of its sub-organizations."
  — https://docs.turnkey.com/concepts/policies/overview ·
  https://docs.turnkey.com/concepts/sub-organizations

### 3.4 Role-based authority *on chain* — the recommended pattern

> "**Role-Based Access Control:** Extends onchain permissions beyond owners/signers,
> allowing professionals like treasury managers to … manage an org's critical functions …
> **Fine-Tune Permissions:** Assign granular permissions to each role, scoping authorized
> addresses, designated functions, and allowed parameter values … **Set Rate and Threshold
> Limits.**"
> — https://docs.roles.gnosisguild.org/

This is the keystone: put the **operator** (or the **system wallet**) into a **Zodiac
Roles** role scoped to *only* the calls it needs, with rate/threshold limits. Then:

- **Fire someone** → remove their role. **Custody untouched.**
- **Reassign** → grant the role to the successor.
- **Rotate the system key** → swap the role holder; the vault never changes.

Pair it with **OpenZeppelin `AccessControlDefaultAdminRules`** (§2.1) for the admin seat,
and **Safe + a Guard module** to reject any transaction the module/guard does not approve.

---

## 4. Competitor / industry best practice (primary sources, fetched 2026-11-15)

| Firm | Model | Custody | Authority / control | Lockout & recovery handling |
|---|---|---|---|---|
| **Fireblocks** | MPC + policy engine | MPC vaults, keys in the Fireblocks boundary | Policy engine: role-based access, transaction approval (quorum), whitelisting, velocity limits | Admin/policy separation; recovery via the provider; docs at docs.fireblocks.com |
| **Safe (Gnosis Safe)** | smart-account multisig | address = contract; owners are swappable | owners/threshold; **Modules** for automation; **Guards** to reject; Zodiac Roles for scoped operators | `swapOwner` keeps the address; Guard blocks bad txs; recovery modules |
| **Zodiac Roles** | on-chain RBAC module | attaches to a Safe | **granular, parameter-scoped, rate-limited roles** | revoke a role without touching owners/custody |
| **Turnkey** | TEE/enclave key management | keys never leave the enclave (non-custodial) | **users + authenticators + policy engine**; **Root Quorum bypasses policies**; sub-organizations for isolation | revoke authenticator/user or tighten policy — no fund movement; parent has read-only view of sub-orgs |
| **OpenZeppelin** | contract libraries | n/a | `AccessControlDefaultAdminRules` (two-step + delay); `TimelockController` (Proposer/Executor/Admin, min delay) | two-step admin transfer is **cancellable**; timelock gives a cancel window before execution |
| **FROST / threshold** | threshold Schnorr | key split into `n` shares, `t` to sign | participants hold shares | same public key across re-shares; lost-share tolerance `n − t` |

**Consistent pattern across all of them:** custody stays put; authority is revocable;
process governs change. Nobody gives an immutable, single-owner admin to a value-bearing
vault.

---

## 5. Recommendation for Conxian (hybrid: company today → DAO later)

Adopt this for the fee vault and the system wallet. It satisfies "admin control to all
relevant" **and** "never locked out" **and** "migratable to DAO."

### 5.1 Custody layer (never moves)

| Component | Design |
|---|---|
| `TREASURY-VAULT` (`protocol-fee-vault.clar`) | passive intake; outbound only via `sweep-treasury` to the operational multisig |
| Operational treasury `SAB-TREASURY-MS` | **threshold**: start 2-of-3, target 3-of-5; a **backup signer** outside the minimum |
| Reserves `DAO-TREASURY-MS` | 5-of-7 |
| `SAB_BOS_EXECUTOR_KEY` (system) | 1-of-1 **keeper**; gas buffer + allowlisted calls only |

### 5.2 Authority layer (the revocable part)

1. **Fee vault admin seat** → `AccessControlDefaultAdminRules`-style: **two-step transfer
   with a delay**, cancellable. Owner holds it today; DAO later.
2. **Operator / system-wallet authority** → a **scoped role module** (Zodiac-Roles-style):
   the executor key may call **only** `collect-protocol-fee`, `sweep-treasury` reporting,
   etc., with **rate + per-tx caps**. Revoke the role to remove a person or rotate the key;
   **the vault address never changes.**
3. **Emergency** → `SAB_EMERGENCY_PAUSE_MULTISIG` **2-of-3, pause only** (already shipped,
   #362).
4. **Migration to DAO** → grant **Proposer** on the timelock to the DAO; the company keeps
   **Admin/Canceller** until it renounces. One role grant — **no redeploy, no fund move.**

### 5.3 Process layer (governs the above)

- **JML for key holders:** on a leaver, revoke role → re-share/re-key; on a mover,
  re-scope the role.
- **Quarterly access recertification** of the signer set (this is what triggers re-sharing).
- **Key ceremonies** for any signer-set change (witnessed, scripted, recorded off-Git per
  ZSE).
- **Recovery drill** each quarter: prove a signer can be swapped and the vault swept, on
  testnet.
- **Backup signer** always held outside the quorum, so the bench can never fall below
  quorum.

### 5.4 Concrete next actions

1. **Extend `contracts/protocol-fee-vault.clar`**: replace the single `contract-owner`
   gate with a **two-step, delayed owner transfer** + a **scoped-caller allowlist** for the
   executor (rate + per-tx caps). *(Code change, testable on simnet — not deployed.)*
2. **Model the role module** off Zodiac Roles semantics in the settlement planner
   (`src/protocol_fee_settlement.ts`) so the off-chain plan and the on-chain role agree.
3. **Write the signer-administration runbook** (JML + ceremony + drill) as a business-repo
   doc; principals stay off-Git (ZSE).
4. **Do not** enable `protocolFeeActive` (#363) until 1–3 land and a shadow sweep passes.

---

## 6. Honest limits

- Every mechanism above is quoted from **live primary docs fetched 2026-11-15**; the
  Conxian-specific mapping is a recommendation, not an implemented state.
- **Nothing is deployed.** The vault is not on any network; `protocolFeeActive` is `false`.
- Threshold custody has a residual lockout risk (§2.4); the mitigation is a backup signer
  and rehearsed recovery, not a single control.
- Enabling the **system wallet** is safe **only** under §5.2(2): scoped role + caps +
  pause-only emergency + delayed admin. Without the role scoping, a 1-of-1 keeper is a hot
  key with no blast-radius limit.

---

*This document was created by an AI agent (OpenHands) on behalf of the user. It asserts no
revenue, moves no value, and enables nothing.*
