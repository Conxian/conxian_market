# Roundhouse candidate: local discovery, explicit external gaps

This supersedes the implementation claims in the earlier #168 candidate. The prior certificate was a base64 encoding, not a cryptographic signature; its event reporter set verified status without a verifier and returned success even when no transport ran or the transport rejected the request.

The corrected candidate adds bounded, copied local endpoint registrations and diagnostic filters to current dev. All returned registrations are ObserverOnly, unverified, unprobed and not established x402 support. These records confer no permission, entitlement, custody, signing or execution capability. Existing universal-chain and Bitcoin-rooted behavior and the onboarding corrections in #170 are preserved.

Remote discovery fails explicitly when requested, without falling back to cached records. Certificate issuance and settlement publication raise typed unavailable errors and make no network calls. The earlier candidate's type names remain as compatibility vocabulary; their presence does not establish an issuer or operational capability. No default external origin is assumed.

At this review on 2026-10-15, the claimed service and `/v0/endpoints` reference could not be retrieved, and focused searches did not establish its API contract. This is an evidence gap, not proof that the service does not exist. Before remote enablement, obtain authoritative API/authentication/version documentation, bounded response and redirect/timeout rules, actual proof verification and issuer/key provenance, operation/destination/freshness/replay binding, and independently reproducible positive and negative acceptance evidence. Retain component issue #159 and Business #1390 for that work.
