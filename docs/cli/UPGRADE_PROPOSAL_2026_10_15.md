# CLI agent interface upgrade

Parent: Conxian/conxian-business#1411; sprint #1390. Scope: the current Market onboarding binary. Read current SDK/Core, Gateway/Nexus and Platform contracts before adding commands.

## Design
Retain the existing onboarding command and protect its local identity file. Add versioned JSON/schema discovery, strict arguments, explicit local preview and machine-readable outcomes. Resolve rail/tier names against the SDK enums. Help and schema require no built SDK; preview must create no identity, write no files and make no network requests. No local plan grants purchased entitlement, hardware custody or production authority.

## Research
- https://clig.dev/ — primary CLI design guidance: structured output, explicit noninteractive usage and meaningful exit status.
- https://modelcontextprotocol.io/specification/2026-07-28/server/tools — tool input/output schemas, deterministic discovery and execution errors. This CLI is not an MCP server or a claim of MCP conformance.
- https://blog.modelcontextprotocol.io/posts/2026-03-16-tool-annotations/ — behavioral hints are not authorization enforcement.

## Acceptance
Preserve useful human output and existing command defaults. Process tests cover schema/help/version, unknown/missing/duplicate options, rail/tier resolution, unsafe URL rejection, no-write/no-network preview, closed stdin, exclusive private-file creation, incomplete provisioning and output separation. Existing SDK tests, typecheck and ESM distribution checks pass. Hosted checks, component release and qualified service acceptance remain separate.
