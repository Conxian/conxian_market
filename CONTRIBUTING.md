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
