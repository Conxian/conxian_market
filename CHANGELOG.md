# Changelog

All notable changes to the Conxian Marketplace (`conxian_market`) project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- GitHub Actions workflow (`.github/workflows/ci.yml`) for repository hygiene, ZSE compliance, and documentation validation.
- CircleCI validation pipeline (`.circleci/config.yml`) for automated pull request checks.
- Comprehensive `CHANGELOG.md` adhering to Keep a Changelog and SemVer standard.
- `.env.example` template to support BYOK sandbox configuration without exposing secrets.

### Changed
- Strengthened `.gitignore` rules to strictly exclude environment configurations (`.env.*`), build artifacts, coverage reports, and temporal files.
- Updated `README.md` and `CONTRIBUTING.md` with release discipline, ZSE verification procedures, and CI instructions.

### Security
- Untracked temporary artifact `test.txt` from Git repository index to maintain clean repository state.
- Enforced Zero Secret Egress (ZSE) policy in CI checks.

---

## [1.0.0] - 2026-08-21

### Added
- Initial public release of Conxian Marketplace documentation, research baseline, and governance guidelines.
- Core economic model definitions (2% protocol fee allocation: 50% ops, 30% founders, 20% ecosystem).
- System architecture mapping and ERC-8183 escrow specifications.
