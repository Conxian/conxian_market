# CLI diagnostics and protocol wire conformance

Refs: [Business #1411](https://github.com/Conxian/conxian-business/issues/1411), [Market #176](https://github.com/Conxian/conxian_market/issues/176).

The CLI retains offline help, schema, graph and local onboarding preview. Explicit diagnostics add one read-only authenticated request; they never create an identity, provision services, dispatch tools or grant operations.

```sh
conxian-agent-init --diagnose gateway --endpoint https://gateway.example.invalid --token-env CONXIAN_DIAGNOSTIC_TOKEN --json
conxian-agent-init --diagnose nexus --endpoint https://nexus.example.invalid --token-env CONXIAN_DIAGNOSTIC_TOKEN --json
```

These `.invalid` addresses illustrate configuration only. Supply a separately authorized real endpoint and set the named credential variable outside the command line. Credentials and provider error bodies are withheld from output. No credential value is accepted as a CLI flag.

Accepted API roots are the HTTPS origin, Gateway `/api/v1` or `/api/v1/agent`, and Nexus `/v1`. Diagnostics append `/capabilities`, reject redirects and URL credentials/query/fragment, use a maximum 10-second deadline (5 seconds by default), and cap decoded response bytes at 32 KiB. The deadline covers both response headers and body consumption. The strict version-1 registration schema rejects unknown fields, duplicate IDs, wrong repositories and operation/production claims. Empty registrations remain empty.

`status: ok` and exit 0 mean the requested registration read completed. `qualifiedOperationCount` remains zero; `productionQualified`, `execution_enabled` and `custody_verified` remain false. Transport/rejection/manifest failures return incomplete/exit 1; invalid configuration returns exit 2. These observations do not authenticate hardware or establish an exact chain/network/operation contract.

The SDK exports `readRegistrationDiagnostic` and `validateRegistrationManifest` for other consumers. Their current producer contracts were inspected at Gateway `0b15b59e2c1f031db0049ad36e6b8125f0918174` (`internal/api/src/capabilities.rs`) and Nexus `104458dbb39548ab56550e0f8a3216b45bd9ab50` (`src/api/capabilities.rs`). Full Core operation-manifest negotiation remains under Core #440 and the downstream owner trackers.

## Explicit x402 v2 profile

`conxian-x402-v2-wire/1` is an additive bounded transport profile, separate from the existing sats/payment-pointer facade. It provides exported schemas/types and HTTP base64 codecs for `PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE` and `PAYMENT-RESPONSE`. It validates v2 structure, CAIP-2 network syntax, decimal atomic amounts, and bounded valid UTF-8 JSON. Unknown top-level fields and oversized inputs are rejected. Payment payload resource metadata is optional; explicit null optional wire fields normalize to absence, matching the upstream TypeScript schemas. Scheme-specific payloads and `extra` remain opaque.

Server-advertised extensions require object-valued `info` and `schema` envelopes; this validates their shape, not the advertised JSON Schema or its contents. Client and settlement extensions retain their opaque protocol-specific shapes. Resource discovery names and tags use printable ASCII with 32-character limits and at most five tags; icon URLs must be absolute HTTP(S). These checks do not fetch icons. Settlement responses preserve decimal `amount`, `errorMessage` and `extra`. Facilitator `extensionResponses` are a private transport sidechannel and are rejected on this buyer-facing wire. This profile's local byte, collection and timeout bounds are not asserted as global protocol requirements.

`errorReason: settlement_pending` requires `success: false` and a non-empty broadcast identifier. It represents an indeterminate confirmation state that needs separate reconciliation; the codec performs no retry or chain lookup and never treats this claim as proof of settlement or non-payment.

`x402V2McpRequired` emits a tool-error result with identical structured/text demand content. `x402V2McpPayment` returns the `x402/payment` metadata entry to place under request `_meta`. Callers still implement the selected MCP protocol version's session/request metadata and transport. These helpers do not implement an MCP server or a payment facilitator.

Successful parsing, an opaque signature, or a `success` field in a settlement response remains an unverified wire claim. No signature validation, resource/terms authorization, replay consumption, transaction/finality verification, durable settlement, entitlement, tool execution, or ERC-8004 registry lookup occurs here. Market #176/#159 retain those gates. The legacy facade is not silently converted or labelled v2 compatible.

## Research and selection

Checked on 15 October 2026:

- [x402 v2 types and payment flow](https://github.com/x402-foundation/x402/blob/main/specs/x402-specification-v2.md), [HTTP transport](https://github.com/x402-foundation/x402/blob/main/specs/transports-v2/http.md), [MCP transport](https://github.com/x402-foundation/x402/blob/main/specs/transports-v2/mcp.md).
- [MCP tools, schemas and untrusted annotations](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/server/tools.mdx).
- [CLI Guidelines](https://clig.dev/): predictable noninteractive commands, machine output and separate errors.
- [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004): registry identity and deployed contract evidence are separate from semantic DID adapters and payment protocols.

Compatibility follow-up checked on 16 October 2026 against immutable x402 revision `0e6e8c55d86b4f14234fb6e49a4052074fb93e57`: [core specification](https://github.com/x402-foundation/x402/blob/0e6e8c55d86b4f14234fb6e49a4052074fb93e57/specs/x402-specification-v2.md), [TypeScript schemas](https://github.com/x402-foundation/x402/blob/0e6e8c55d86b4f14234fb6e49a4052074fb93e57/typescript/packages/core/src/schemas/index.ts), and [facilitator types](https://github.com/x402-foundation/x402/blob/0e6e8c55d86b4f14234fb6e49a4052074fb93e57/typescript/packages/core/src/types/facilitator.ts). Synthetic fixtures in `tests/fixtures/x402_v2_wire.json` record that revision; they do not claim upstream integration, network execution or payment evidence.

The selected option extends the current SDK and CLI with tested contracts. A replacement CLI, autonomous payment runtime, or new identity registry would add dependencies and authority without the necessary provider/commercial acceptance evidence. A future verified facilitator should use the maintained scheme implementation behind a separately tested adapter rather than treating this codec as a cryptographic verifier.
