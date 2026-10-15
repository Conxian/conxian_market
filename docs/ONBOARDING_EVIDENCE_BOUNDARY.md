# Onboarding evidence boundary

Work: Market #159 and Business #1343/#1390. This change corrects prior success claims; it does not change fees or the supported-chain strategy.

`ClientInstallerEngine` validates local configuration and prepares an unsigned deployment plan. Without a purchase issuer, runtime probes, provider custody verification and provisioning receipts, it returns no paid license, no execution grant and no completed installation. The legacy `licenseOverride` parameter is retained for source compatibility but cannot grant authority.

Health/SLA status can be `UNVERIFIED`; unmeasured latency is `null`. Consumers must handle these values explicitly. A URL or BYO credential is configuration, not measured service health. Custody cannot be certified by scanning configuration text. The manifest checksum is SHA-256 over the documented versioned JSON array; it is not a signature.

x402 proof strings cannot replace a backend verifier that is absent, rejects or errors. Its local correlation artifact explicitly reports `paymentVerified: false`: matching receipt fields and attestation verification do not prove settlement finality or bind a certificate to payment. Escrow methods here record in-memory bookkeeping; chain execution and independent payment evidence remain required integration work.

Independent acceptance must test authenticated issuer receipts bound to client, tier, allowed operations and expiry; replay protection; measured runtime health; provider/key custody; deployment receipts; denied and stale evidence; and rollback. Green component tests do not grant production qualification.
