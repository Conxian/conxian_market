# M2M Framework Research — what to adopt in `conxian_market`

> **Session 77** | Status: research + first implementation | Scope: machine-to-machine
> (M2M) service authentication and IoT/M2M service-platform patterns.
> This is an evaluation against the market SDK's actual surface, not a vendor summary.

## 1. Why this matters here

`conxian_market` is the ecosystem's M2M value layer: agents and provider adapters
discover each other (`provider_discovery.ts`), present ERC-8004-aligned identity
(`agent_registry.ts`), pay per call (`x402_facade.ts`, `mcp_402.ts`), and settle
across rails (`settlement.ts`). Every one of those steps is a **machine
authenticating to a service** — but the SDK had **no M2M authentication
primitive**. Identity was a card digest and a trust tier; there was no credential
a headless agent could present to call a market endpoint.

The cited M2M landscape splits into two families, and only one maps onto this repo:

| Family | Examples | Relevance to `conxian_market` |
| --- | --- | --- |
| **IoT / device service platforms** (horizontal CSEs, device management) | Eclipse OM2M, ACME, OCEAN Mobius, Legato, Mango | **Low.** These model *field devices* (sensors, actuators) with a resource tree. The market models *software agents* transacting value; it has no device-management surface. |
| **M2M authentication / authorization stacks** (service-to-service credentials) | Ory (OAuth2 client credentials + JWK rotation), Authentik | **High.** This is exactly the missing primitive: a scoped, rotatable, revocable machine credential. |

Conclusion: adopt from the **auth** family; borrow *semantics* (not code) from the
IoT family only where the market later exposes device-backed providers.

## 2. What the sources actually specify

- **Ory — machine-to-machine auth** (`ory.com/machine-to-machine-auth`): OAuth2
  **client-credentials** flow for services/devices/agents; **granular scopes**;
  **JWK keyset rotation managed by the server** ("no manual key handling");
  **dynamic client registration** for fleets; zero-trust posture. (Fetched
  2026-11-11.)
- **Eclipse OM2M** (`eclipse.dev/om2m/`): an EPL-licensed oneM2M/ETSI SmartM2M
  implementation; a horizontal **Common Service Entity (CSE)** deployable in
  server/gateway/device; RESTful API for "machines authentication, resources
  discovery, applications registration, containers … access rights
  authorization". (Fetched 2026-11-11.)
- **Authentik**: open-source IdP supporting service-to-service tokens.
- **ACME / OCEAN Mobius / Legato / Mango**: oneM2M CSE, oneM2M-compliant
  platform, embedded Linux M2M framework, and SCADA-style data acquisition.

## 3. Mapping to the market SDK

| Source pattern | Market equivalent today | Gap | Action |
| --- | --- | --- | --- |
| OAuth2 client credentials | none | **missing** | **Implemented** — `src/m2m_auth.ts` |
| Scoped, audience-bound tokens | `TrustTier` only (authorization by tier) | tier ≠ credential | token `scope` + `aud`, layered under `trust_tier_middleware.ts` |
| JWK keyset rotation | none | **missing** | `MachineTokenAuthority.rotate()` + `jwks()` |
| Dynamic client registration | `AgentRegistry.register()` (identity, not credential) | agent ≠ client | keep separate; bind agent→client id later |
| Revocation / short-lived tokens | none | **missing** | short TTL + one-time `jti` replay guard |
| oneM2M CSE resource tree | provider manifests (`provider_discovery.ts`) | different domain | **do not adopt**; not a device platform |
| oneM2M "machines authentication" primitive | — | — | mirrors §3 row 1 |

## 4. What was implemented (Session 77)

`src/m2m_auth.ts` — `MachineTokenAuthority`: issues and verifies HS256 bearer
tokens for the OAuth2 client-credentials grant.

- **Client registry**: the secret is hashed on registration and never retained;
  comparison is constant-time.
- **Scope + audience enforcement**: a token is only issued for scopes and
  audiences the client is permitted, and only verifies for the audience and
  scopes the caller requires. An over-broad scope or wrong audience is denied at
  **issue** time as well as verify time.
- **Keyset rotation**: `rotate()` promotes a new `kid` and *retires* (not
  deletes) the old one with a grace window, so tokens signed moments before
  rotation keep verifying — the JWK-rotation property from the Ory model.
- **Fail-closed**: every rejection path returns `{ ok: false, reason }`; there is
  no allow-on-error branch.
- **No secret egress**: `jwks()` exposes `kid`/`alg`/`status` only.
- **Replay guard** (optional): one-time `jti` consumption.

9 unit tests (`tests/m2m_auth.test.ts`) cover issue/verify, unknown client, wrong
secret, over-broad scope, unpermitted audience, tampered payload, expiry, wrong
audience, insufficient scope, rotation grace + retired-key expiry, JWKS secrecy,
and replay.

> The tamper test earned its keep: it caught a real defect where the signature
> comparison decoded base64url material as hex, silently truncating both sides to
> empty and accepting a forged token. Fixed to a utf8 constant-time compare.

## 5. Deliberate non-adoptions

- **No oneM2M/OM2M adoption.** The market is not a device-management platform; a
  CSE resource tree would be an architecture inversion. If device-backed
  providers appear later, that is a separate provider adapter, not the market core.
- **No new dependency.** Ory/Authentik are full IdPs; the SDK stays
  dependency-light (`node:crypto` only). The *protocol shape* is adopted, not a
  server.
- **No secrets in git** (ZSE): signing keys are injected by the caller from a
  secret store.

## 6. Follow-ups (not done here)

1. Bind `AgentCard.agentId` → M2M `clientId` so identity and credential are one
   registration (currently separate).
2. Add an asymmetric (EdDSA/ES256) mode so verifiers need no shared secret —
   closer to JWKS and to zero-trust.
3. Wire `verify()` into `trust_tier_middleware.ts` as the authentication step
   *before* tier authorization.
4. Expose `jwks()` at a `.well-known/jwks.json` route when the market gains an
   HTTP surface.
5. Evaluate **dynamic client registration** for agent fleets (one client per
   agent) once `agent_registry` is persisted.

## Sources

- Ory — Machine to Machine Authentication: https://www.ory.com/machine-to-machine-auth
- Eclipse OM2M: https://eclipse.dev/om2m/
- oneM2M open-source list: https://wiki.onem2m.org/index.php?title=Open_Source
- OAuth 2.0 client credentials (RFC 6749 §4.4); JWK Set (RFC 7517)

*Research and implementation by an AI agent (OpenHands) on behalf of the Conxian owner.*
