# BitVM3 result envelope review

Status: research contract only. Production verification remains unavailable.

PR #191 proposes a result envelope, optional commitment/input/nonce fields and a
boundary API. Those are useful compatibility scaffolding. They are not evidence
of cryptographic verification. The original implementation accepted a caller's
`verified: true` and granted Strict trust without validating a signature or issuer.
Five regression cases reproduce this on the original source, including forged
signatures, stale receipts, non-finite costs and negative costs.

The corrected boundary always returns invalid/ObserverOnly. Both the legacy API
and proposed boundary API retain that behavior, including through certificate
tier detection and the universal adapter. Repeated caller nonces confer no trust.
The envelope's claimed measured cost is not a verified economic measurement.

## Remaining qualification

- A qualified verifier must actually evaluate the proof, rather than echo metadata.
- Authenticate the issuer against an independently configured trust root and
  verify a canonical signature over the full operation-bound result.
- Bind network, verifier version, circuit commitment, inputs and challenge context.
- Enforce freshness and durable replay protection in the authoritative backend.
- Validate measured costs, units and any exchange-rate evidence before applying
  the CXIP-1317 cost target.
- Integrate and test the real Gateway/Nexus transport and failure behavior before
  enabling successful BitVM3 results or advertising SDK bridge completion.

The existing OpenSpec `2026-10-19-bitvm3-verification-boundary` remains the work
definition. No workflow, CI gate, promotion rule, trust-tier definition or release
acceptance requirement is changed by this remediation.
