# Contributing Guidelines

Thank you for your interest in contributing to the Conxian Marketplace! By contributing, you help secure, scale, and harden the decentralized orchestration layer of the Conxian Ecosystem.

---

## Code of Conduct

All contributors are expected to uphold a professional, safe, and collaborative development environment. Respect your fellow developers and prioritize engineering quality.

---

## Core Principles

1. **Hardening the Core:** Prioritize functional settlement, fee collection, and stability mechanisms over adding new, unverified experimental contract stubs.
2. **Zero Secret Egress (ZSE):** Never commit secrets, operational credentials, configuration variables, or private files to git. Use `.env.example` as a template for local sandboxes.
3. **DeFi-Agnostic Orchestration:** Focus on routing payments and managing escrows cleanly through external protocols (e.g., ALEX, Uniswap) rather than attempting to build proprietary, duplicative decentralized exchanges or lending rails.

---

## Branching & Workflow Policy

- **Main Branch (`main`):** Represents the latest stable and verified codebase state. Direct pushes to `main` are disabled. All changes must be made via Pull Requests.
- **Pull Requests (PR):**
  - Create a descriptive branch for your work (e.g., `feat/erc8183-escrow` or `fix/gitignore-hardening`).
  - PRs must pass all automated CI/CD checks (GitHub Actions & CircleCI) before merging.
  - Linear git history is enforced—squash-and-merge or rebase are the preferred merging strategies.

---

## Release & Changelog Discipline

All user-facing changes, governance updates, and security enhancements must follow [Semantic Versioning](https://semver.org/):
- **Major (`X.0.0`):** Breaking protocol, contract interface, or architectural changes.
- **Minor (`1.X.0`):** Backward-compatible feature additions or new module integrations.
- **Patch (`1.0.X`):** Backward-compatible security fixes, bug fixes, or documentation updates.

Whenever submitting a PR that alters functionality or repository structure:
1. Update `CHANGELOG.md` under the `[Unreleased]` section following [Keep a Changelog](https://keepachangelog.com/) standards.
2. Ensure documentation across `README.md`, `ROADMAP.md`, and `SECURITY.md` remains in sync.

---

## Pre-Commit Security & Verification Checks

Before submitting your Pull Request, run the local hygiene checks:

```bash
# 1. Verify ZSE Compliance (No secrets tracked)
git ls-files | grep -i -E "\.env$|\.key$|\.pem$|credentials\.json|secrets\.json"

# 2. Verify Tracked Artifact Hygiene
git ls-files | grep -i -E "^node_modules/|^dist/|^build/|^coverage/|^playwright-report/|test\.txt$"

# 3. Verify Required Core Documents
for doc in README.md SECURITY.md CONTRIBUTING.md LICENSE ROADMAP.md CHANGELOG.md; do
  [ -f "$doc" ] || echo "Missing $doc"
done
```
