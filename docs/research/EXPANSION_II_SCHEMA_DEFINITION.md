# Expansion II: Cryptographic State Oracle — Schema Definition

> **Status:** Research — Proceeding per ATS Source-Level Verification
> **Priority:** P0 | **Estimated Effort:** 4–6 weeks MVP
> **Date:** 2026-07-31

---

## 1. Overview

Elevate Kwil/Tableland from a decentralized relational database to a verifiable state oracle. Every critical state change produces a signed event envelope containing an MMR root. `conxian-nexus` ingests the envelope, validates the MMR inclusion proof, and bridges verified state to on-chain settlement.

This expansion builds on existing production infrastructure:
- `nexus/src/state/mod.rs` — `MMRProof`, `MMRFoundation`, `NexusState`
- `nexus/src/sync/mod.rs` — `NexusSync` with Kwil/Tableland adapters
- `nexus/src/storage/kwil.rs` — `KwilAdapter`, `KwilMmrNodeCommitment`
- SQL migrations for `mmr_peaks`, `mmr_nodes`

---

## 2. Event Envelope Schema

### 2.1 Binary Format (Canonical)

```
Byte Offset | Field              | Type     | Size    | Description
------------|--------------------|----------|---------|---------------------------
0           | magic              | [u8; 4]  | 4       | 0x43_58_53_4F ("CXSO" = Conxian State Oracle)
4           | version            | u8       | 1       | 0x01
5           | envelope_type      | u8       | 1       | 0x00 = state_transition, 0x01 = snapshot, 0x02 = attestation
6           | timestamp          | u64      | 8       | Unix epoch milliseconds
14          | chain_id           | u32      | 4       | Network identifier
18          | table_id           | [u8; 32] | 32      | SHA-256 of fully-qualified table name
50          | sequence_number    | u64      | 8       | Monotonically increasing per table
58          | operation_count    | u16      | 2       | Number of state transitions in this envelope
60          | mmr_peak_count     | u8       | 1       | Number of MMR peaks (1–32)
61          | mmr_peaks          | [[u8; 32]] | N*32 | MMR peak hashes (N = mmr_peak_count)
61+N*32     | mmr_size           | u64      | 8       | Total number of leaves in the MMR
69+N*32     | state_root         | [u8; 32] | 32      | Root hash of the current state
101+N*32    | previous_envelope  | [u8; 32] | 32      | SHA-256 of previous envelope (or zero)
133+N*32    | operations_hash    | [u8; 32] | 32      | SHA-256 of all operations in this batch
165+N*32    | signature_scheme   | u8       | 1       | 0x00 = Ed25519, 0x01 = ECDSA secp256k1
166+N*32    | signature          | [u8; 64] | 64      | Signature over bytes [0..165+N*32]
230+N*32    | payload_length     | u32      | 4       | Length of operations payload
234+N*32    | payload            | [u8; L]  | L       | CBOR-encoded operations array
```

Total header size: 234 + (N * 32) bytes where N = mmr_peak_count (1 ≤ N ≤ 32).
Maximum header: 234 + 1024 = 1258 bytes.

### 2.2 Operations Payload (CBOR)

Each element in the payload array is a state transition record:

```cbor
{
  0: "insert" / "update" / "delete",     ; operation type (text)
  1: h'...',                               ; row key (bytes, 32 bytes)
  2: {                                     ; changed columns (map)
    "column_name": "new_value",
    ...
  },
  3: 42,                                    ; block height (uint)
  4: h'...'                                 ; tx hash (bytes, 32 bytes)
}
```

### 2.3 Signature Computation

```
signature = Sign(
    private_key,
    SHA-256(bytes[0..165+N*32])  // entire header excluding signature and payload
)
```

The signing key is the Tableland table owner's key, establishing cryptographic provenance of state transitions.

---

## 3. MMR Inclusion Proof Validation

### 3.1 Algorithm (Nexus-Side)

The Nexus already has `MMRProof::verify()` — the envelope validation adds an envelope-level wrapper:

```rust
pub fn validate_state_envelope(envelope: &StateEnvelope, known_peaks: &[[u8; 32]]) -> Result<()> {
    // 1. Verify signature over header
    verify_signature(&envelope)?;

    // 2. Verify previous envelope chain (prevent replay/reorder)
    verify_envelope_chain(&envelope)?;

    // 3. For each operation in payload, verify MMR inclusion
    for op in &envelope.operations {
        let proof = MMRProof {
            leaf: hash_operation(op),
            pos: op.mmr_position,
            siblings: op.mmr_siblings.clone(),
            peaks: envelope.mmr_peaks.clone(),
            root: compute_mmr_root(&envelope.mmr_peaks),
        };
        proof.verify(&known_peaks)?;
    }

    // 4. Update known peaks
    update_peaks(&envelope.mmr_peaks)?;

    Ok(())
}
```

### 3.2 Edge Cases

| Case | Handling |
|:-----|:---------|
| Gap in `sequence_number` | Request missing envelopes from Tableland; stall bridging until contiguous |
| Fork (two envelopes with same `sequence_number`) | Accept the one with earlier `timestamp`; if equal, accept lower `operations_hash` |
| Replay (duplicate envelope hash) | Reject: `previous_envelope` chain prevents replays |
| Empty batch (operation_count = 0) | Valid: snapshot envelope (`envelope_type = 0x01`) with no ops |
| MMR peak mismatch | Reject: Nexus queries Tableland for full MMR state and re-derives peaks |

---

## 4. Nexus Integration Points

### 4.1 New Module: `nexus/src/oracle/state_envelope.rs`

```rust
pub struct StateOracle {
    storage: Arc<Storage>,
    tableland: Arc<TablelandAdapter>,
    state: Arc<NexusState>,
    envelope_cache: LruCache<[u8; 32], StateEnvelope>,
}

impl StateOracle {
    pub async fn ingest_envelope(&self, envelope: StateEnvelope) -> Result<VerificationReport>;
    pub async fn get_state_proof(&self, table_id: &[u8; 32], key: &[u8]) -> Result<MMRProof>;
    pub async fn bridge_verified_state(&self, report: VerificationReport) -> Result<TxHash>;
}
```

### 4.2 Configuration

```toml
[state_oracle]
enabled = true
tableland_endpoint = "https://tableland.network/api/v1"
kwil_endpoint = "https://kwil.example.com"
envelope_cache_size = 1000
max_envelope_age_seconds = 300
trusted_signing_keys = [
    "0xabcd...",
]
```

### 4.3 API Endpoints

| Method | Path | Purpose |
|:-------|:-----|:--------|
| POST | `/v1/oracle/envelope` | Ingest a state envelope |
| GET | `/v1/oracle/proof/{table_id}/{key}` | Get MMR inclusion proof for a key |
| GET | `/v1/oracle/state/{table_id}` | Get current verified state for a table |

---

## 5. Tableland-Side Changes (Out of Scope for Conxian)

The event envelope generation must be implemented on the Tableland/Kwil side:

1. **Trigger:** On `INSERT`/`UPDATE`/`DELETE` to critical tables
2. **Batching:** Accumulate operations for up to 500ms or 100 operations, whichever first
3. **MMR Update:** Append operation hashes to table's MMR, compute new peaks
4. **Envelope Assembly:** Construct binary envelope per schema above
5. **Signing:** Sign with table owner's key
6. **Delivery:** POST to Nexus `/v1/oracle/envelope`

---

## 6. MVP Scope (4–6 Weeks)

| Week | Deliverable |
|:-----|:-----------|
| 1–2 | `StateEnvelope` struct + binary serialization/deserialization + signature verification |
| 2–3 | `StateOracle` module: envelope ingestion, MMR inclusion validation, chain verification |
| 3–4 | REST API endpoints + configuration + integration tests |
| 5 | Tableland-side envelope generation script (reference implementation) |
| 6 | End-to-end test: Tableland state change → envelope → Nexus validation → bridged to on-chain |

---

## 7. Risks

| Risk | Mitigation |
|:-----|:-----------|
| Tableland doesn't implement envelope generation | Nexus can poll Tableland directly as fallback (existing `NexusSync` pull model) |
| MMR divergence between Nexus and Tableland | Nexus re-derives MMR from full Tableland state on mismatch |
| Envelope flooding (DoS) | Rate-limit per table_id; max 10 envelopes/sec/table |
| Large payloads exceed memory | `payload_length` max = 1MB; reject oversized envelopes |
