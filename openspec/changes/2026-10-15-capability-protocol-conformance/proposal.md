# Bounded capability diagnostics and explicit protocol conformance

Refs: Business #1411, Market #176, Core #440, Gateway #526, Nexus #418.

Extend the existing local planner with an explicit read-only diagnostic command for the current Gateway/Nexus registration contracts. Require an HTTPS target, bearer credential from a named environment variable, bounded response size and duration, no redirects, strict schema validation and redacted typed errors. Discovery remains registration evidence with zero qualified operations, no custody evidence and no production grant. Offline discovery and onboarding retain their behavior.

Add an independent x402 v2 wire-profile codec for HTTP and MCP. Validate versioned requirements, CAIP-2 network identifiers and atomic decimal amounts; preserve scheme-specific payloads and extensions without interpreting them as authority. Keep the legacy sats facade separate. Wire parsing never verifies signatures, settles payments, dispatches tools or accepts a registry identity.

Acceptance: compatible Gateway/Nexus fixtures, wrong owner/schema/claims, duplicates, empty registrations, UTF-8/body/time bounds, rejected HTTP and redirects, credential redaction, CLI process and no-write checks; HTTP/MCP x402 v2 round trips and rejection of legacy/incompatible payloads. Existing library, CLI, type and distribution checks must pass. Provider operation qualification, real payment integration and release acceptance remain tracked separately.
