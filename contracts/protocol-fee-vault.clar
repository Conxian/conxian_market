;; TREASURY-VAULT - protocol-fee destination and gated treasury sweep.
;;
;; Home: this repository. The original destination contracts lived in
;; `Conxian/Conxian`, which is now archived (GitHub 404). conxian_market is the
;; Value Layer that already computes the protocol fee (src/fee_calculator.ts) and
;; reports it to the gateway (src/gateway_client.ts:submitFeeReport), so the
;; destination contract is re-homed here.
;;
;; Roles (docs/AGENTS.md sec.3, docs/adr/ADR_001_FEE_MODEL.md sec.5):
;;   - TREASURY-VAULT      : passive intake. Fees are routed here.
;;   - SAB-TREASURY-MS     : operational treasury (3-of-5). Holds sweep authority.
;;   - DAO-TREASURY-MS     : long-term reserves (5-of-7). Receives the ecosystem leg.
;;   - SAB_EMERGENCY_PAUSE : pause authority (2-of-3). Pause only, no value transfer.
;;
;; Design rules:
;;   - Fail closed. Until `treasury-principal` and the three recipients are
;;     configured, `sweep-treasury` aborts and no value moves.
;;   - Principals over addresses (docs/AGENTS.md). No address is hardcoded; every
;;     recipient is set by the owner during the SAB handoff.
;;   - The vault's own balance is passive intake only. Value leaves only when the
;;     configured treasury principal calls `sweep-treasury`, which distributes the
;;     50/30/20 split (ADR-001 sec.1.2) to the configured role principals.

;; ---------------------------------------------------------------------------
;; Errors
;; ---------------------------------------------------------------------------
(define-constant ERR_UNAUTHORIZED (err u100))
(define-constant ERR_NOT_CONFIGURED (err u101))
(define-constant ERR_ZERO_AMOUNT (err u102))
(define-constant ERR_INVALID_SPLIT (err u103))
(define-constant ERR_PAUSED (err u104))
(define-constant ERR_TRANSFER_FAILED (err u105))
(define-constant ERR_INSUFFICIENT_BALANCE (err u106))

;; ---------------------------------------------------------------------------
;; State
;; ---------------------------------------------------------------------------
;; Bootstrap owner (deployer). Must hand off to SAB_DEPLOYER_MULTISIG.
(define-data-var contract-owner principal tx-sender)

;; Sweep authority: the SAB-TREASURY-MS role principal. Unset => sweeps fail closed.
(define-data-var treasury-principal (optional principal) none)

;; Distribution recipients, one per ADR-001 sec.1.2 bucket. Unset => sweeps fail closed.
(define-data-var operations-principal (optional principal) none)
(define-data-var founders-principal (optional principal) none)
(define-data-var ecosystem-principal (optional principal) none)

;; Split in basis points. Default 50/30/20 (ADR-001 sec.1.2). Must sum to 10_000.
(define-data-var operations-split-bps uint u5000)
(define-data-var founders-split-bps uint u3000)
(define-data-var ecosystem-split-bps uint u2000)

;; Emergency pause (SAB_EMERGENCY_PAUSE_MULTISIG, 2-of-3). Pause only.
(define-data-var paused bool false)

;; Accounting (read-only transparency, mirrors src/treasury_report.ts).
(define-data-var collected-total-ustx uint u0)
(define-data-var swept-total-ustx uint u0)

;; ---------------------------------------------------------------------------
;; Intake ledger - one entry per recorded protocol-fee collection
;; ---------------------------------------------------------------------------
(define-map fee-intake
    { settlement-id: (string-ascii 128) }
    {
        amount-ustx: uint,
        rail: (string-ascii 32),
        tier: (string-ascii 32),
        recorded-at: uint
    }
)

;; ---------------------------------------------------------------------------
;; Owner administration
;; ---------------------------------------------------------------------------
(define-private (is-owner)
    (is-eq tx-sender (var-get contract-owner))
)

;; Hand the contract to the SAB deployer multisig after bootstrap.
(define-public (set-owner (new-owner principal))
    (begin
        (asserts! (is-owner) ERR_UNAUTHORIZED)
        (ok (var-set contract-owner new-owner))
    )
)

;; Set the sweep authority (SAB-TREASURY-MS). Unset by default => fail closed.
(define-public (set-treasury-principal (treasury principal))
    (begin
        (asserts! (is-owner) ERR_UNAUTHORIZED)
        (ok (var-set treasury-principal (some treasury)))
    )
)

;; Set the three distribution recipients. Unset by default => fail closed.
(define-public (set-recipient-principals
        (operations principal)
        (founders principal)
        (ecosystem principal))
    (begin
        (asserts! (is-owner) ERR_UNAUTHORIZED)
        (var-set operations-principal (some operations))
        (var-set founders-principal (some founders))
        (var-set ecosystem-principal (some ecosystem))
        (ok true)
    )
)

;; Set the distribution split. Must sum to 10_000 bps (100%).
(define-public (set-split
        (operations-bps uint)
        (founders-bps uint)
        (ecosystem-bps uint))
    (begin
        (asserts! (is-owner) ERR_UNAUTHORIZED)
        (asserts!
            (is-eq (+ operations-bps founders-bps ecosystem-bps) u10000)
            ERR_INVALID_SPLIT)
        (var-set operations-split-bps operations-bps)
        (var-set founders-split-bps founders-bps)
        (var-set ecosystem-split-bps ecosystem-bps)
        (ok true)
    )
)

;; Pause authority. Pause only; no value transfer, no unpause.
(define-public (pause)
    (begin
        (asserts! (is-owner) ERR_UNAUTHORIZED)
        (ok (var-set paused true))
    )
)

;; Unpause authority (SAB_EMERGENCY_RECOVERY_MULTISIG in production).
(define-public (unpause)
    (begin
        (asserts! (is-owner) ERR_UNAUTHORIZED)
        (ok (var-set paused false))
    )
)

;; ---------------------------------------------------------------------------
;; Intake: record a protocol-fee collection routed to this vault.
;;
;; Bookkeeping only. Value arrives by a plain transfer to this contract
;; principal; this call anchors the settlement id for transparency and audit.
;; Idempotent per settlement-id: a replayed id is rejected.
;; ---------------------------------------------------------------------------
(define-public (collect-protocol-fee
        (settlement-id (string-ascii 128))
        (amount-ustx uint)
        (rail (string-ascii 32))
        (tier (string-ascii 32)))
    (begin
        (asserts! (not (var-get paused)) ERR_PAUSED)
        (asserts! (> amount-ustx u0) ERR_ZERO_AMOUNT)
        (asserts!
            (is-none (map-get? fee-intake { settlement-id: settlement-id }))
            ERR_UNAUTHORIZED)
        (map-set fee-intake { settlement-id: settlement-id }
            {
                amount-ustx: amount-ustx,
                rail: rail,
                tier: tier,
                recorded-at: block-height
            }
        )
        (var-set collected-total-ustx (+ (var-get collected-total-ustx) amount-ustx))
        (ok true)
    )
)

;; ---------------------------------------------------------------------------
;; Sweep: the only outbound path. Gated by the treasury principal (SAB-TREASURY-MS).
;;
;; Distributes the split of the vault's balance to the three role principals and
;; returns the per-bucket amounts. Fails closed when any principal is unset.
;; ---------------------------------------------------------------------------
(define-public (sweep-treasury)
    (begin
        (asserts! (not (var-get paused)) ERR_PAUSED)

        (let (
            (operations (unwrap! (var-get operations-principal) ERR_NOT_CONFIGURED))
            (founders (unwrap! (var-get founders-principal) ERR_NOT_CONFIGURED))
            (ecosystem (unwrap! (var-get ecosystem-principal) ERR_NOT_CONFIGURED))
            (treasury (unwrap! (var-get treasury-principal) ERR_NOT_CONFIGURED))
        )
            ;; Only the configured treasury principal may move value.
            (asserts! (is-eq tx-sender treasury) ERR_UNAUTHORIZED)

            (let (
                (balance (stx-get-balance (as-contract tx-sender)))
                (operations-amount
                    (/ (* balance (var-get operations-split-bps)) u10000))
                (founders-amount
                    (/ (* balance (var-get founders-split-bps)) u10000))
                ;; Remainder bucket absorbs integer-division dust.
                (ecosystem-amount
                    (- balance
                        operations-amount
                        founders-amount))
            )
                (asserts! (> balance u0) ERR_INSUFFICIENT_BALANCE)

                (try! (as-contract (stx-transfer? operations-amount tx-sender operations)))
                (try! (as-contract (stx-transfer? founders-amount tx-sender founders)))
                (try! (as-contract (stx-transfer? ecosystem-amount tx-sender ecosystem)))

                (var-set swept-total-ustx (+ (var-get swept-total-ustx) balance))

                (ok {
                    operations-amount: operations-amount,
                    founders-amount: founders-amount,
                    ecosystem-amount: ecosystem-amount,
                    total-swept: balance
                })
            )
        )
    )
)

;; ---------------------------------------------------------------------------
;; Read-only views
;; ---------------------------------------------------------------------------
(define-read-only (get-config)
    {
        owner: (var-get contract-owner),
        treasury-principal: (var-get treasury-principal),
        operations-principal: (var-get operations-principal),
        founders-principal: (var-get founders-principal),
        ecosystem-principal: (var-get ecosystem-principal),
        operations-split-bps: (var-get operations-split-bps),
        founders-split-bps: (var-get founders-split-bps),
        ecosystem-split-bps: (var-get ecosystem-split-bps),
        paused: (var-get paused)
    }
)

;; True only when a sweep would be authorised and every recipient is configured.
(define-read-only (is-sweep-ready (caller principal))
    (and
        (not (var-get paused))
        (is-some (var-get treasury-principal))
        (is-some (var-get operations-principal))
        (is-some (var-get founders-principal))
        (is-some (var-get ecosystem-principal))
        (is-eq caller (unwrap-panic (var-get treasury-principal)))
    )
)

(define-read-only (get-accounting)
    {
        collected-total-ustx: (var-get collected-total-ustx),
        swept-total-ustx: (var-get swept-total-ustx),
        balance-ustx: (stx-get-balance (as-contract tx-sender))
    }
)

(define-read-only (get-intake (settlement-id (string-ascii 128)))
    (ok (map-get? fee-intake { settlement-id: settlement-id }))
)
