# Complete the bounded x402 v2 wire profile

Refs: Market #176, Business #1411 and #1390; follows merged Market #178.

Compare the existing profile with x402 upstream commit
`0e6e8c55d86b4f14234fb6e49a4052074fb93e57`. Accept omitted/null optional
resource fields using the upstream normalization contract. Enforce the documented
server-advertised extension envelope and resource discovery bounds. Preserve
settlement amount and diagnostic fields, and reject a pending-settlement claim
without a transaction identifier. Keep HTTP/MCP codecs bounded and all returned
payment and settlement claims unverified.

Use source-pinned synthetic fixtures and positive/negative transport tests.
Run the full library, CLI process, type and distribution checks. No facilitator,
signature verification, payment retry, entitlement or runtime authority is added.
