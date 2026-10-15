# Keep discovery separate from verification and publication

Work: Market #168/#159 and Conxian/conxian-business#1390.

The proposed Roundhouse integration creates certificate-shaped base64 strings, upgrades local declarations to verified trust, and reports successful publication without remote acceptance. Those are not cryptographic or runtime evidence. External API documentation and an authenticated response contract were not established in this review.

Preserve bounded local registration/filtering as explicitly unverified ObserverOnly diagnostics. Reject remote discovery when requested rather than silently replacing it with cache data. Certificate issuance and settlement publication remain unsupported until real issuer, signature, evidence, freshness, replay, destination and acceptance contracts are implemented. Keep existing dev onboarding hardening and governance templates unchanged.

Acceptance: negative tests for fabricated certificates/events, cache-based trust upgrades, remote fallback, mutation, malformed records and bounds; full tests, typecheck, build and distribution validation. No fee, custody, token, signer or live deployment changes.
