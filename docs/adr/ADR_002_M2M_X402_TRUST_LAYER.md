# ADR 002: Conxian as the Verifiable Settlement & Escrow Trust Layer for x402 Agent Commerce

> **Status:** Accepted
> **Date:** 2026-09-17
> **Author:** Conxian Architecture Board | Session 66
> **Deciders:** Conxian Core Maintainers

---

## 1. Context & Problem Statement

Autonomous agent-to-agent (M2M) commerce relies increasingly on HTTP 402 Payment Required protocols (such as the Linux Foundation x402 specification). However, standard x402 implementations focus primarily on point-to-point payment request and receipt negotiation. They lack three critical enterprise and industrial capabilities:

> **Verified (2026-11-14).** The *"Linux Foundation"* attribution above is **correct**:
> `x402.org` is *"a Series of LF Projects, LLC"*, and the Linux Foundation announced the
> **operational launch of the x402 Foundation on 2026-07-14** (Coinbase contributed the
> protocol; 40 members including Google, Stripe, Visa, Mastercard, AWS, Shopify,
> Cloudflare, Coinbase). x402 charges **zero protocol fees** — Conxian's fee is a
> **trust-layer** fee, not a protocol toll. See
> `docs/research/X402_MPP_ECOSYSTEM_2026.md`.

1. **Hardware Agent Attestation**: Verifying that an autonomous agent is executing within a trusted execution environment (TEE / Nitro / KeyMint).
2. **Programmable Escrow & SLA Enforcement**: Locking payment bounties in non-custodial escrow (ERC-8183 / CJCS Job Cards) and releasing them only upon verified SLA completion.
3. **Cryptographic Proof Artifacts**: Generating immutable "Verified by Conxian" trust proof artifacts for dispute resolution and institutional auditability.

Conxian must clarify its strategic positioning and technical architecture relative to x402.

---

## 2. Decision Outcome

**Decision:** Position Conxian as the **Trust Layer on top of x402**, rather than competing with x402 or building a proprietary payment rail.

### Key Architectural Commitments:
1. **x402 Facade Integration**:
   - Conxian's `@conxian/market-sdk` wraps x402 payment demands (`jobCardToDemand`) and validates payment receipts (`verifyPaymentReceipt`).
2. **Attestation-Backed Verification**:
   - Receipts accompanied by enclave attestation certificates are verified via `verifyPaymentReceiptWithAttestation` against `GatewayVerifier`.
3. **Immutable Trust Proof Artifacts**:
   - Every attestation-backed x402 payment lock generates an immutable `X402TrustProofArtifact` containing proof hashes, verified TrustTier level, and issuer identity (`conxian.org/trust-layer`).
4. **Attestation-Locked Escrow Gateway**:
   - `X402EscrowGateway.processPaymentAndLockEscrowWithAttestation` locks funds into ERC-8183 job card escrows with TrustTier enforcement and previewed 80/10/10 yield splits.

---

## 3. Consequences

### Positive:
- **Zero Standards Friction**: Integrates seamlessly with existing x402 ecosystems (Coinbase AgentKit, OKX Agent Pay, Nevermined, MoltJobs).
- **High Defensibility**: Provides hardware TEE attestation and multi-rail Bitcoin/Stacks/EVM settlement that basic payment protocols cannot replicate.
- **Zero-Custody Guarantee**: Funds remain locked in non-custodial ERC-8183 smart escrow contracts; Conxian never holds client private keys or funds.

### Negative:
- Depends on enclave-sdk attestation providers for Strict/Managed trust tier verification.

---

## 4. Status & Compliance
Implemented and verified in `@conxian/market-sdk` v0.2.0 (Session 66).
