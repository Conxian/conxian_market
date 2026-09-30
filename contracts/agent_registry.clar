;; ERC-8004-aligned on-chain agent identity registry (Clarity 4).
;;
;; Anchors agent identity on Stacks rails via a Clarity map (the ADR_003
;; "Clarity map" variant of the SIP-010 identity anchor (no EVM ERC-721).
;; Mirrors the off-chain `src/agent_registry.ts` surface: AgentCard identity,
;; SHA-256 digest-bound reputation, and fail-closed authorization.
;;
;; Identity is bound to a 32-byte card digest computed off-chain (same
;; canonicalization as `agentCardDigest` in the SDK); reputation updates must
;; reference the registered digest, and authorization fails closed for unknown
;; agents or insufficient trust tier.

;; ---------------------------------------------------------------------------
;; Errors
;; ---------------------------------------------------------------------------
(define-constant ERR_UNAUTHORIZED (err u100))
(define-constant ERR_ALREADY_REGISTERED (err u101))
(define-constant ERR_NOT_REGISTERED (err u102))
(define-constant ERR_DIGEST_MISMATCH (err u103))
(define-constant ERR_INVALID_TIER (err u104))

;; ---------------------------------------------------------------------------
;; Trust tiers (mirror the market `TrustTier` ranking)
;; ---------------------------------------------------------------------------
(define-constant TIER_OBSERVER_ONLY u0)
(define-constant TIER_EXPEDIENT u1)
(define-constant TIER_MANAGED u2)
(define-constant TIER_STRICT u3)

;; ---------------------------------------------------------------------------
;; Ownership
;; ---------------------------------------------------------------------------
(define-data-var contract-owner principal tx-sender)

;; ---------------------------------------------------------------------------
;; Agent identity anchor (keyed by the agent's Stacks principal)
;; ---------------------------------------------------------------------------
(define-map agent-cards
    principal
    {
        agent-id: (string-ascii 128),
        name: (string-utf8 256),
        provider-did: (string-ascii 256),
        card-digest: (buff 32),
        minimum-tier: uint,
        issued-at: uint
    }
)

;; ---------------------------------------------------------------------------
;; Digest-bound reputation
;; ---------------------------------------------------------------------------
(define-map agent-reputation
    principal
    {
        card-digest: (buff 32),
        tasks-completed: uint,
        sla-compliance-bps: uint,
        disputes-lost: uint,
        updated-at: uint
    }
)

;; ---------------------------------------------------------------------------
;; Validation helpers
;; ---------------------------------------------------------------------------
(define-private (valid-tier (tier uint))
    (or
        (is-eq tier TIER_OBSERVER_ONLY)
        (is-eq tier TIER_EXPEDIENT)
        (is-eq tier TIER_MANAGED)
        (is-eq tier TIER_STRICT)
    )
)

;; ---------------------------------------------------------------------------
;; Public: register the caller's agent card (identity anchor)
;; ---------------------------------------------------------------------------
(define-public (register-agent
        (agent-id (string-ascii 128))
        (name (string-utf8 256))
        (provider-did (string-ascii 256))
        (card-digest (buff 32))
        (minimum-tier uint))
    (begin
        (asserts! (valid-tier minimum-tier) ERR_INVALID_TIER)
        (asserts! (is-none (map-get? agent-cards tx-sender)) ERR_ALREADY_REGISTERED)
        (map-set agent-cards tx-sender
            {
                agent-id: agent-id,
                name: name,
                provider-did: provider-did,
                card-digest: card-digest,
                minimum-tier: minimum-tier,
                issued-at: block-height
            }
        )
        (ok true)
    )
)

;; ---------------------------------------------------------------------------
;; Public: update reputation, bound to the registered card digest.
;; Restricted to the contract owner (trusted verifier/oracle); fail-closed.
;; ---------------------------------------------------------------------------
(define-public (update-reputation
        (agent principal)
        (card-digest (buff 32))
        (tasks-completed uint)
        (sla-compliance-bps uint)
        (disputes-lost uint))
    (begin
        (asserts! (is-eq tx-sender (var-get contract-owner)) ERR_UNAUTHORIZED)
        (let
            ((card (unwrap! (map-get? agent-cards agent) ERR_NOT_REGISTERED)))
            (asserts! (is-eq (get card-digest card) card-digest) ERR_DIGEST_MISMATCH)
            (map-set agent-reputation agent
                {
                    card-digest: card-digest,
                    tasks-completed: tasks-completed,
                    sla-compliance-bps: sla-compliance-bps,
                    disputes-lost: disputes-lost,
                    updated-at: block-height
                }
            )
            (ok true)
        )
    )
)

;; ---------------------------------------------------------------------------
;; Public: transfer contract ownership
;; ---------------------------------------------------------------------------
(define-public (set-owner (new-owner principal))
    (begin
        (asserts! (is-eq tx-sender (var-get contract-owner)) ERR_UNAUTHORIZED)
        (ok (var-set contract-owner new-owner))
    )
)

;; ---------------------------------------------------------------------------
;; Read-only: retrieve an agent card
;; ---------------------------------------------------------------------------
(define-read-only (get-agent-card (agent principal))
    (ok (map-get? agent-cards agent))
)

;; ---------------------------------------------------------------------------
;; Read-only: retrieve digest-bound reputation
;; ---------------------------------------------------------------------------
(define-read-only (get-reputation (agent principal))
    (ok (map-get? agent-reputation agent))
)

;; ---------------------------------------------------------------------------
;; Read-only: fail-closed authorization gate.
;; Returns false for unregistered agents and for insufficient trust tier.
;; ---------------------------------------------------------------------------
(define-read-only (is-authorized (agent principal) (required-tier uint))
    (match (map-get? agent-cards agent)
        entry (ok (>= (get minimum-tier entry) required-tier))
        (ok false)
    )
)
