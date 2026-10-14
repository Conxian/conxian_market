# ADR 006: Integration Architecture with Roundhouse AI Discovery Index & x402 Trust Engine

> **Status:** Accepted
> **Date:** 2026-10-14
> **Author:** Conxian Architecture Board | Session 75
> **Deciders:** Conxian Core Maintainers

---

## 1. Context & Problem Statement

Autonomous AI agent commerce requires both **agent discovery** (identifying available APIs, their endpoints, and payment terms) and **verifiable settlement** (executing payments, verifying TEE execution attestation, locking programmable escrow, and settling across multi-rail assets).

Roundhouse AI serves as an open discovery and verification index for the x402 payment protocol, offering a public `/v0/endpoints` directory and liveness auditing. However, Roundhouse itself does not handle hardware enclave attestation (AWS Nitro / StrongBox), multi-rail Bitcoin/sBTC settlement, or ERC-8183 conditional job card escrow.

Conxian requires a formal architectural decision to establish how `@conxian/market-sdk` ingests Roundhouse AI discovery data while serving as the cryptographic trust, TEE attestation, and settlement engine behind those endpoints.

---

## 2. Decision Outcome

**Decision:** Establish Conxian as the **Cryptographic Trust, Hardware Attestation, & Settlement Engine** for Roundhouse AI x402 endpoints, utilizing bi-directional data flow:

### **Key Architectural Principles:**
1. **Directory Ingestion via SDK**:
   - `@conxian/market-sdk` includes `RoundhouseClient` (`src/roundhouse_client.ts`) to ingest Roundhouse's `/v0/endpoints` directory, enabling agent discovery filtered by attestation status, trust tier, and supported settlement rails.
2. **"Verified by Conxian" TEE Attestation Certificates**:
   - For x402 endpoints listed in Roundhouse, Conxian issues hardware-backed TEE attestation certificates (`VerifiedByConxianCertificate`) binding Nitro/StrongBox quotes to payment receipts.
3. **Multi-Rail & Escrow Upgrade Path**:
   - Simple x402 payment demands discovered via Roundhouse can be automatically wrapped into ERC-8183 job card escrows (`job_card_escrow.ts`) and settled over Bitcoin, Lightning, sBTC, or EVM stablecoins.
4. **Bi-Directional Settlement Event Publishing**:
   - Conxian publishes signed settlement event proofs back to Roundhouse's indexing engine, enriching Roundhouse's audit log with cross-chain settlement data.

---

## 3. Consequences

### Positive:
- **Zero Discovery Overhead**: Ingests existing Roundhouse index rather than building a redundant catalog.
- **Hardware Defensibility**: Adds AWS Nitro and StrongBox TEE attestation verification to standard x402 endpoints.
- **Multi-Rail Expansion**: Expands Roundhouse x402 endpoints beyond Base/Solana USDC to native Bitcoin, Lightning, sBTC, and ISO 20022 payment streams.

### Negative:
- External dependency on Roundhouse AI's HTTP `/v0/endpoints` availability (mitigated via local SDK caching and fallback).

---

## 4. Status & Compliance
Implemented and verified in `@conxian/market-sdk` v0.2.5 (Session 75).
