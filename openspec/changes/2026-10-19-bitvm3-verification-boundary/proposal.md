# BitVM3 candidate verification boundary

## Problem
The Session 75 candidate treats caller metadata as verification and can elevate a certificate without a qualified cryptographic backend. Version strings, digest-shaped strings and cost estimates are research inputs, not evidence.

## Decision
Preserve the candidate types, research and adapter API. Make the unimplemented BitVM3 verification path return invalid/ObserverOnly with an explicit unavailable result. Do not invent an HTTP route or accept an arbitrary gateway response for an undefined protocol. Keep independently verified existing TEE, enclave and light-client paths usable. Restore the current dev promotion policy without the candidate's unrelated template fallback expansion.

## Validation
Negative fixtures cover both attestation flag states, arbitrary strings, replay/stale metadata, non-finite and negative claimed costs, unavailable gateway, and the public SDK/adapter entry points. A separately verified proof may still establish its own existing tier. Run the full SDK tests, CLI conformance, typecheck, build and trusted promotion tests.

## Research and remaining qualification
Primary sources reviewed 2026-10-19:
- https://bitvm.org/bitvm3.pdf — protocol security depends on committed circuits, challenge/evaluation and transaction semantics.
- https://github.com/BitVM/garbled-snark-verifier — reference implementation evaluates committed Groth16 verifier circuits with input-consistency/cut-and-choose requirements.

A metadata-only validator cannot implement those protocols. A new backend requires a pinned protocol/version, authenticated operation- and input-bound results, freshness/replay rules, adversarial vectors and independent security review. Cost caps need measured transaction size, fee/FX inputs and freshness; a caller's USD estimate is never an authorization condition. Scoring/yield/telemetry models remain unqualified for live operational or financial claims. This correction does not qualify the whole research candidate for release.
