# Onboarding and evidence boundaries

Read code and the current SDK/Core evidence contracts before changing support claims. Conxian is universal-chain with Bitcoin as its trust root; external assets and staking adapters remain in scope. No native Conxian token is introduced.

Configuration syntax, requested tiers, credentials, registry entries and arbitrary proof strings cannot establish payment, connected services, custody, attestation or production qualification. The synchronous installer is a local planner. Its entitlement is unverified with zero execution grants; health and SLA measurements remain unknown. Add independently authenticated, fresh, operation-bound issuer/provider evidence before enabling a later installation path.

Keep `tests/onboarding_evidence.test.ts` as the negative conformance boundary. x402 local receipt correlation and in-memory escrow bookkeeping do not verify payment or submit a chain transaction. A local SHA-256 record is unsigned and confers no authority. A missing or rejecting verifier must never fall back to proof presence.
