# ATS: Universal Chain Path Expansion — Source-Level Verification

> **Origin:** Gemini ATS (share `gfTcQpndTlA2`, 2026-07-31)
> **Verification:** OpenHands agent source-level audit against `conxian-business/main` @ `c5d6c17`
> **Status:** Corrected & Annotated | **Date:** 2026-07-31

---

## Verification Methodology

Every claim was traced against actual Rust source files (`src/**/*.rs`), not docs, not `Cargo.toml`, not test files. Claims marked ❌ had zero source hits. Claims marked ⚠️ exist but differ materially from the ATS description.

---

## Verified Repository Integration Map

| Repository | What Exists (Source-Verified) | ATS Claim | Verdict |
|:-----------|:------------------------------|:----------|:-------:|
| **`lib-conxian-core`** | `ark-groth16` dependency (BitVM2), MuSig2 fuzz corpus, chain adapters | "Base cryptography, MuSig2, Groth16/RISC0 baseline" | ⚠️ Groth16 only for BitVM2; RISC0 not a dependency |
| **`conxius-enclave-sdk`** | `musig2` crate (0.4.1), `protocol/musig2.rs` (85 loc), BitVM2 partial signing, TEE attestation | "Zero-egress signing with RISC0 receipt verification gate" | ❌ No RISC0 dep; no policy receipt field in `SignRequest`; no pre-signing verification |
| **`conxian-nexus`** | MMR state machine (`MMRProof`, `MMRFoundation`, `NexusState`), Kwil/Tableland adapters, BitVM2 Groth16 verifier, autonomous orchestrator, PPP oracle | "Groth16/RISC0 verification, MMR inclusion proofs, recursive proof aggregator" | ⚠️ MMR and Kwil/Tableland are real; Groth16 is BitVM2-only; no RISC0; no proof aggregator |
| **`conxius-wallet`** | Reference client, non-custodial signing | "None — continues normal transaction lifecycle" | ✅ Correct |
| **Kwil / Tableland** | `nexus/src/storage/kwil.rs`, `nexus/src/storage/tableland/`, `NexusSync` pulls data | "Event envelope generation with MMR root outputs" | ⚠️ Nexus reads from Tableland; envelope generation on Tableland side is aspirational |

---

## Expansion-by-Expansion Source Audit

### Expansion I: Policy-Gated Autonomous Signing

**ATS Claim:** "Enclave verifies RISC0 receipt internally → unlocks MuSig2 signing"

**Source Reality:**
- `enclave-sdk/src/enclave/mod.rs` defines `SignRequest { algorithm, message_hash, derivation_path, key_id, taproot_tweak }` — no `policy_receipt` field
- `sign(&self, request: SignRequest) -> ConclaveResult<SignResponse>` — no verification pipeline
- `risc0` is not a dependency in any Cargo.toml (Gateway has it in Cargo.lock as transitive, unused)
- `enclave-sdk/Cargo.toml` depends on `musig2 = "0.4.1"` — no ZK dependency of any kind

**Assessment:** This expansion requires building from scratch:
1. Add `risc0-zkvm` dependency (new supply chain surface)
2. Add `policy_receipt` field to `SignRequest`
3. Implement RISC0 verifier inside TEE boundary
4. Solve TEE memory constraints for proof verification
5. Design policy circuit and off-chain execution engine

**Recommendation:** DEFER pending feasibility audit. The ATS itself correctly identifies this need: "Benchmark the computational overhead of verifying a RISC0 receipt directly inside the TEE/StrongBox boundaries."

---

### Expansion II: Cryptographic State Oracle

**ATS Claim:** "Tableland generates MMR event envelopes → Nexus verifies inclusion proof"

**Source Reality:**
- `nexus/src/state/mod.rs` — `MMRProof`, `MMRFoundation`, `NexusState` with lock ordering (leaves before mmr)
- `nexus/src/sync/mod.rs` — `NexusSync` imports `KwilAdapter`, `TablelandAdapter`, `KwilMmrNodeCommitment`
- `nexus/src/storage/kwil.rs` — `KwilAdapter` with MMR node commitment storage
- SQL migrations: `20240101000004_mmr_peaks.sql`, `20240101000007_mmr_nodes.sql`

**What's Missing:** The event envelope generation on the Tableland/Kwil side (not a Conxian concern). Nexus already has the ingestion and validation infrastructure. The "envelope" concept is the only novel piece.

**Assessment:** This builds directly on production code. No new dependencies required. The MMR validation infrastructure is already tested and operational.

**Recommendation:** PROCEED immediately. See `EXPANSION_II_SCHEMA_DEFINITION.md` for the byte-level schema.

---

### Expansion III: Recursive Proof Aggregation

**ATS Claim:** "Nexus batches RISC0 + MMR + MuSig2 into single Groth16 aggregate proof"

**Source Reality:**
- `nexus/src/main.rs` imports `bitvm_groth16::CanonicalStateTransitionVerifier` — BitVM2-specific, not general-purpose
- `nexus/src/config.rs` — `BitvmGroth16TrustedRegistryConfig` with BN254 curve and verification key registry
- No proof aggregation module exists
- No recursive circuit infrastructure exists
- RISC0 proofs don't exist (Expansion I prerequisite)
- MuSig2 partial signatures are not ZK proofs and cannot be aggregated into a Groth16 circuit

**Assessment:** This is the most ambitious and least grounded expansion. It depends on Expansion I, assumes Groth16 can aggregate heterogeneous proof types (a research problem), and conflates MuSig2 signatures with ZK proofs. The Groth16 infrastructure that DOES exist is scoped exclusively to BitVM2 canonical state transitions.

**Recommendation:** REJECT for now. Table until: (a) Expansion I feasibility audit passes, (b) RISC0 support lands in `lib-conxian-core`, (c) a research spike proves heterogeneous proof aggregation is viable with `ark-groth16`.

---

## Consolidated Recommendations

| # | Action | Priority | Effort |
|:--|:-------|:--------:|:------:|
| 1 | Proceed with Expansion II schema definition and prototyping | 🔴 P0 | 4–6 weeks |
| 2 | Commission Expansion I feasibility audit (TEE + RISC0 memory/performance) | 🟡 P1 | 2–3 weeks |
| 3 | Table Expansion III until I and II are proven | 🟢 P2 | N/A |
| 4 | Amend ATS: replace "RISC0" with "to-be-added dependency" throughout | 🟡 P1 | 1 hour |
| 5 | Amend ATS: correct repos that need modifications (lib-conxian-core, wallet may need circuit defs) | 🟡 P1 | 1 hour |
