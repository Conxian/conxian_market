# Expansion I: Policy-Gated Autonomous Signing — Feasibility Audit Scope

> **Status:** Pre-research — Feasibility audit required before implementation planning
> **Priority:** P1 | **Estimated Audit Effort:** 2–3 weeks
> **Date:** 2026-07-31

---

## 1. Why This Audit Is Necessary

The ATS proposes adding RISC0 zkVM receipt verification inside the `conxius-enclave-sdk` TEE boundary. Currently:

- **`conxius-enclave-sdk`** has zero ZK dependencies. Its only crypto dependency is `musig2 = "0.4.1"`.
- **`SignRequest`** has no `policy_receipt` field. The signing path is: `sign(request) -> SignResponse`.
- **`risc0-zkvm`** is not a dependency of any Conxian crate (Gateway has it transitively in `Cargo.lock`, unused in source).

Before committing engineering resources, a feasibility audit must answer fundamental questions about whether this expansion is viable within the constraints of the existing enclave architecture.

---

## 2. Audit Questions

### 2.1 Memory & Performance

| Question | Method | Success Criteria |
|:---------|:-------|:-----------------|
| Can a RISC0 receipt verifier fit within TEE StrongBox memory limits? | Profile `risc0-zkvm` verifier binary size and runtime memory against enclave memory budget | Verifier binary ≤ 2MB; runtime memory ≤ 16MB |
| What is the wall-clock time for RISC0 receipt verification inside a TEE? | Benchmark verification of receipts of varying complexity (100K–10M cycles) on target enclave hardware | Verification time ≤ 500ms for 1M-cycle receipts |
| Does verification time scale linearly with receipt complexity? | Measure verification time for receipts of 100K, 500K, 1M, 5M, 10M cycles | Document scaling curve; identify ceiling |

### 2.2 Security Boundary

| Question | Method | Success Criteria |
|:---------|:-------|:-----------------|
| Does adding `risc0-zkvm` expand the TEE's trusted computing base (TCB) unacceptably? | Audit `risc0-zkvm` dependency tree for supply chain risk; compare TCB size against current enclave | No new network-facing dependencies in the verification path |
| Can the RISC0 verifier run in the same memory space as the MuSig2 signer without side-channel risk? | Static analysis of memory access patterns; verify no shared mutable state between verifier and signer | Verifier and signer operate in isolated memory regions |
| What is the attack surface of the policy circuit compiler? | Threat model the policy circuit → receipt pipeline; identify trust assumptions | Documented trust model with explicit assumptions |

### 2.3 Integration Feasibility

| Question | Method | Success Criteria |
|:---------|:-------|:-----------------|
| Can `lib-conxian-core` remain unchanged as the ATS claims? | Trace all RISC0 dependencies; if any intersect with `lib-conxian-core`'s API surface, the claim is false | Zero changes to `lib-conxian-core`'s public API |
| Does the policy receipt need to be passed through `conxius-wallet` before reaching the enclave? | Map the signing UX flow: user → wallet → enclave. Identify where policy receipt enters the pipeline | Wallet requires ≤ 1 new field in its signing request schema |
| Can policy circuits be compiled and distributed independently of the enclave binary? | Prototype a policy compilation and distribution pipeline | Policy circuits can be updated without enclave recompilation |

### 2.4 Alternative Approaches

| Question | Method | Success Criteria |
|:---------|:-------|:-----------------|
| Can `ark-groth16` (already in `lib-conxian-core`) replace RISC0 for policy verification, avoiding a new dependency? | Prototype a Groth16-based policy circuit; compare proof size, verification time, and circuit expressiveness against RISC0 | Viable alternative if Groth16 proof verification fits within TEE constraints |
| Can policy verification happen OUTSIDE the enclave (in Nexus) with the enclave receiving only a signed authorization token? | Design a split architecture: Nexus verifies policy → issues signed token → enclave verifies token → signs | Enclave TCB remains unchanged; Nexus absorbs verification complexity |

---

## 3. Audit Deliverables

1. **Memory & Performance Report**: RISC0 verifier binary size, runtime memory, verification latency for 100K–10M cycle receipts on target TEE hardware
2. **Security Analysis**: TCB comparison (current vs. with RISC0), attack surface assessment, side-channel analysis
3. **Integration Impact Assessment**: Required changes to `SignRequest`, `conxius-wallet`, `lib-conxian-core`
4. **Alternative Recommendation**: Groth16-native vs. RISC0 vs. split-enclave architecture with rationale
5. **Go/No-Go Recommendation**: Clear recommendation on whether to proceed with Expansion I as proposed, with modifications, or not at all

---

## 4. Prerequisites

Before the audit can begin:

1. Obtain target TEE hardware specifications (memory limits, CPU, trusted execution environment version)
2. Select policy circuit complexity for benchmarking (start with: daily spend limit, multi-sig threshold, time-locked withdrawal)
3. Set up isolated test environment matching production enclave constraints
4. Engage `lib-conxian-core` maintainers to assess Groth16 circuit definition requirements

---

## 5. Go/No-Go Criteria

| Criterion | Go | No-Go |
|:----------|:---|:------|
| Memory | Verifier fits within 2× current enclave memory headroom | Exceeds available memory by >10% |
| Latency | Verification ≤ 500ms | Verification > 2s |
| TCB expansion | ≤ 3 new crates in dependency tree | Network-facing or unaudited crates added |
| `lib-conxian-core` changes | Zero public API changes | Any public API change required |
| Wallet changes | ≤ 1 field added to signing schema | Wallet signing UX requires redesign |
