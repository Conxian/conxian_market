# Agent-facing CLI contract

The Market binary creates a local agent identity and a plan. It does not establish a paid entitlement, provision a service, attest a device or authorize settlement. The architecture reference maps source roles; read each component's current contracts before adding operations.

```bash
npm run build
node bin/conxian-agent-init.mjs --schema
node bin/conxian-agent-init.mjs --graph
node bin/conxian-agent-init.mjs --dry-run --json
node bin/conxian-agent-init.mjs --json --output .conxian-agent.env
```

Help, schema, version and graph work without the built SDK. Preview loads the SDK for enum/configuration validation, with no key generation, writes or network requests. Normal invocation preserves exclusive local identity creation with mode 0600 on Unix; an existing identity is never overwritten. Current onboarding remains incomplete pending independent evidence and exits 1.

| Exit | Meaning |
| --- | --- |
| 0 | Requested discovery or preview completed |
| 1 | Local operation failed or onboarding remains incomplete |
| 2 | Invalid arguments or configuration |

JSON output uses `schema_version: 1`. Results go to stdout; errors go to stderr, with no progress banners in JSON mode. Unknown/duplicate options, unknown rails/tiers and URLs containing credentials, query strings, fragments or control bytes are rejected. Rail/tier values come from the SDK enums; enum names and values are accepted case-insensitively. This intentionally replaces silent defaults on invalid input.

The packaged [system graph](../../bin/system-graph.json) separates source dependencies, HTTP/configuration contracts and design intent. It includes no connection counts, runtime observations or qualification grants. Internal governance details and security findings remain in the private KB.

Upgrade scope is tracked by Business #1411 under sprint #1390. Next slices: reconcile the Rust installer commands with Gateway's current configuration schema, connect bounded authenticated runtime diagnostics, and add reviewed operation plans/idempotency only where provider and authorization contracts exist. Platform agent coordination and wallet integration retain their own owners and gates. This is an initial CLI upgrade, not a claim that every ecosystem operation is exposed.

Research and acceptance: [upgrade proposal](UPGRADE_PROPOSAL_2026_10_15.md). Run `npm test`, `npm run typecheck`, and `npm run verify:dist` before publication.
