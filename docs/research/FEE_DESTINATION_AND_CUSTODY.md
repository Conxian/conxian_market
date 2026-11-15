# Fee Destination & Custody — Where the Money Goes

> **Status:** Specification (destination intended, **not deployed**)
> **Date:** 2026-11-14
> **Companion to:** `docs/adr/ADR_001_FEE_MODEL.md` (recipients/split),
> `docs/adr/ADR_005_COMPETITIVE_RATES_WITH_COST_RECOVERY.md` (rate),
> `docs/research/TREASURY_DEPLOYMENT_GUIDE.md` (deployment runbook)
>
> This document answers one question: **once a fee is collected, where does it
> physically land, and who can move it?** It names the destination and the
> recipients. It does **not** claim any of it is live — see §5.

---

## 1. The money, named

For a settlement with gross amount `G` (locked in ERC-8183 escrow):

```
G ──► protocol fee  F = max(G × decayed_bps/10000, rail_floor) × load_factor
      (ADR-005 dynamic model; see src/fee_calculator.ts)
      │
      └─► net = G − F  ──► 80 / 10 / 10 split
                            ├─ 80%  Builder (agent creator)
                            ├─ 10%  Platform Treasury
                            └─ 10%  Ecosystem Stakeholders

F ──► 50 / 30 / 20 split
      ├─ 50%  Operations  (CI/CD, SDKs, Nexus, audits)
      ├─ 30%  Founders    (4-year vesting)
      └─ 20%  Ecosystem   (grants, liquidity mining)
```

Two distinct money movements: the **net** goes to the builder and the two
10% buckets; the **fee `F`** goes to the treasury and splits 50/30/20. They are
computed in `src/fee_calculator.ts` (`calculateDynamicFee`) and
`src/bos_yield_splitter.ts` (`calculateYieldSplit`), and released through
`src/job_card_escrow.ts`.

## 2. Destination — the canonical vault

All protocol fees `F` are destined for **one passive collection contract**:

| Name | Kind | Role | Address |
|------|------|------|---------|
| `TREASURY-VAULT` | Contract principal | Passive fee collection only — **no outbound transfers** | not deployed |

The address referenced in the implementation plan is
`SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9.protocol-fee-collector`
(`docs/research/CON1427_IMPLEMENTATION_PLAN.md` §2.3). **This is a plan
reference, not a live deployment** — that repository (`Conxian/Conxian`) no
longer exists (see root `AGENTS.md` P0-7), and no fee-collector contract is
present in this repository. The only Clarity contract in this repo is
`contracts/agent_registry.clar` (agent identity, unrelated to fees).

From the vault, funds move to the operational multisig:

| Name | Threshold | Purpose |
|------|:---------:|---------|
| `TREASURY-VAULT` | — | Passive collection; fee destination |
| `SAB-TREASURY-MS` | 3-of-5 | Operational spend (medium) |
| `DAO-TREASURY-MS` | 5-of-7 | Long-term reserves (high spend) |

## 3. Recipients and control

| Bucket | Recipient | Control |
|--------|-----------|---------|
| Builder 80% | Agent creator payout address | Per-job (ERC-8183 escrow release) |
| Platform Treasury 10% (of net) | `TREASURY-VAULT` | Rules-based; no key |
| Ecosystem 10% (of net) | Ecosystem stakeholders | DAO |
| Fee `F` — Operations 50% | `SAB-TREASURY-MS` | 3-of-5 SAB multisig |
| Fee `F` — Founders 30% | Founder escrow (4-yr vesting) | `SAB-TREASURY-MS` + DAO bonus vote |
| Fee `F` — Ecosystem 20% | Ecosystem growth | DAO |

**Custody doctrine (ADR-001 §5, `WALLET_TREASURY_FEASIBILITY.md`):** custody
lives in **contract principals, not human wallets**. A wallet (e.g. Conxius) is
the *signing layer* only; assets live in `PROTOCOL_VAULTS` / the multisigs. No
single personal wallet holds pause or exit authority at any stage:

- Pause: `SAB_EMERGENCY_PAUSE_MULTISIG` (2-of-3) — pause only, no value transfer.
- Unpause/recovery: `SAB_EMERGENCY_RECOVERY_MULTISIG` (3-of-5).
- Shutdown: DAO vote (60%) via `DAO_TIMELOCK`.

## 4. Exposure and exit caps

Per ADR-001 §6: maximum 20% treasury exposure to the ALEX ecosystem; 3-of-5
multisig required; automated exit if TVL drops >50%; minimum 3 settlement rails
active.

## 5. Implementation status — honest

| Component | Status | Evidence |
|-----------|:------:|----------|
| Fee computed (dynamic model) | ✅ shipped | `src/fee_calculator.ts` (`VOLUME_DECAY_BPS`, `calculateDynamicFee`) |
| Fee split 50/30/20 computed | ✅ shipped | `src/bos_yield_splitter.ts` (split only, no rate) |
| Escrow release wiring | ✅ shipped (in-memory) | `src/job_card_escrow.ts` |
| Fee report to gateway | ✅ shipped | `POST /v1/billing/fee-report` (`src/gateway_client.ts`) |
| `TREASURY-VAULT` deployed | ⬜ **not deployed** | no contract in repo |
| `protocol-fee-collector.clar` | ⬜ **not deployed** | plan only; source repo gone |
| SAB / DAO multisigs provisioned | ⬜ **not deployed** | `TREASURY_DEPLOYMENT_GUIDE.md` is a runbook |
| Fee collection active | ⬜ **off** | `DEFAULT_FEATURE_FLAGS.protocolFeeActive === false` |
| Treasury auto-staking (Babylon) | ⬜ Phase D | not implemented |

**Bottom line:** the fee is *computed, split and reported*, but **no fee has
ever been physically collected, and no destination contract exists yet.** The
destination above is the intended design; collecting into it depends on the
Phase C contract deployment and gateway billing (see root `AGENTS.md` P0-7).

## 6. What must exist before any fee is collected

1. Deploy `TREASURY-VAULT` (passive, no outbound) as the fee destination.
2. Deploy `SAB-TREASURY-MS` (3-of-5) and `DAO-TREASURY-MS` (5-of-7).
3. Wire the gateway `ProtocolFeeReport` → contract `collect-protocol-fee`.
4. Provision signers (FROST DKG key ceremony — `TREASURY_DEPLOYMENT_GUIDE.md` §4).
5. Flip `protocolFeeActive` and verify a real settlement end-to-end.

Until (1)–(5) hold, this document describes intent, not a live treasury.

---

## References

- `docs/adr/ADR_001_FEE_MODEL.md` — recipients, split, custody, caps
- `docs/adr/ADR_005_COMPETITIVE_RATES_WITH_COST_RECOVERY.md` — the fee rate
- `docs/research/TREASURY_DEPLOYMENT_GUIDE.md` — deployment runbook
- `docs/research/WALLET_TREASURY_FEASIBILITY.md` — custody model
- `src/fee_calculator.ts`, `src/bos_yield_splitter.ts`, `src/job_card_escrow.ts`

---

*This specification records where the protocol fee is intended to land and who
controls it. It deliberately does not assert any deployment: none exists.*
