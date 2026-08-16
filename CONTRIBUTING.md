# Contributing Guidelines

Thank you for your interest in contributing to the Conxian Marketplace! By contributing, you help secure, scale, and harden the decentralized orchestration layer of the Conxian Ecosystem.

---

## Code of Conduct

All contributors are expected to uphold a professional, safe, and collaborative development environment. Respect your fellow developers and prioritize engineering quality.

---

## Core Principles

1. **Hardening the Core:** Prioritize functional settlement, fee collection, and stability mechanisms over adding new, unverified experimental contract stubs.
2. **Zero Secret Egress (ZSE):** Never commit secrets, configuration variables, or private files to git. Run the verification steps before pushing your code.
3. **DeFi-Agnostic Orchestration:** Focus on routing payments and managing escrows cleanly through external protocols (e.g., ALEX, Uniswap) rather than attempting to build proprietary, duplicative decentralized exchanges or lending rails.
4. **Boundary Discipline:** Do not compete with consumer-owned custody, wallet execution, data ownership, or native chain-side products. This repo stays in the market orchestration layer and only adds chain-native enforcement when a rail requires minimal settlement truth enforcement.

## Repository Scope

This repository is the Conxian Marketplace and orchestration layer, not the standalone SDK package root for the entire organization. Contributions should stay aligned with the marketplace, settlement, treasury, and gateway coordination responsibilities of this repo unless a separate repo or package is explicitly designated for a different boundary.

The market layer depends on adjacent Conxian repos including lib-conxian-core, conxian-gateway, conxian-nexus, conxius-platform, and conxian-business. Conxian/Conxian is treated as an archived historical reference repo and not an active implementation target for this market repo. When proposing a change, confirm whether the work belongs in the market repo itself or in one of those adjacent components or SDK packages.

## Dependency and Integration Ownership

This repo should only consume Conxian dependencies at the appropriate layer. In practice, the market layer depends most directly on:
- lib-conxian-core for protocol primitives and shared types
- conxian-gateway for settlement and API orchestration
- conxian-nexus for verification and proof semantics
- archived protocol reference material only from Conxian/Conxian; not an active contract, governance, or DeFi workstream for this repo

Platform and business concerns are adjacent layers owned elsewhere. If a change is actually a platform CI issue, a business governance issue, or a protocol-core issue, it should be proposed in the corresponding repo rather than folded into this marketplace repository.
### Org Handoff Rules

When a proposal is not clearly market-layer work, use this decision rule:
- If the work is about shared protocol types, chain adapters, or settlement primitives → route to lib-conxian-core or the protocol repo.
- If the work is about rail execution, API orchestration, or settlement ingress/egress → route to conxian-gateway.
- If the work is about proof verification, attestation trust, or MMR-based assurance → route to conxian-nexus or the enclave SDK depending on the layer.
- If the work is about CI/CD, operational enforcement, or release policy → route to conxius-platform.
- If the work is about business rules, governance approvals, or BOS logic → route to conxian-business.

This repo should remain focused on value capture, settlement orchestration, fee logic, and marketplace composition while upstream repos mature.
---

## Branching & Workflow Policy

- **Main Branch (`main`):** Represents the latest stable and verified codebase state. Direct pushes to `main` are disabled. All changes must be made via Pull Requests.
- **Pull Requests (PR):**
  - Create a descriptive branch for your work (e.g., `feat/erc8183-escrow` or `fix/gitignore-hardening`).
  - PRs must pass all automated CI/CD checks before they can be merged.
  - Linear git history is enforced—squash-and-merge or rebase are the preferred merging strategies.

---

## Security & Verification Checks

Before submitting your Pull Request, ensure that:
1. No sensitive operational data, credentials, or `.env` files are tracked in git.
2. All modified files follow proper styling, formatting, and formatting rules.
3. If database schema migrations or query tuning are included, verify them in isolated temporary branches before requesting target branch inclusion.
