# Security Policy

## Supported Versions

We actively support and maintain the security of the Conxian Marketplace codebase. Below are the currently supported versions:

| Version | Supported |
| ------- | --------- |
| v1.0.x  | :white_check_mark: Yes |
| < v1.0  | :x: No |

---

## Zero Secret Egress (ZSE) Policy

The Conxian Ecosystem operates under a strict **Zero Secret Egress (ZSE)** mandate. Under this mandate:

- No sensitive operational secrets, private signing keys, personal API tokens, or strategy/financial documents may ever be committed to the public Git index.
- All production routing paths must rely on contract-controlled or Multi-Signature (3-of-5) vaults governed by the Sovereign Advisory Board (SAB).
- Developer workflows must use local mock environments or isolated developer-specific sandbox credentials.

If you find any sensitive values or operational credentials exposed in this repository, please notify us immediately following the disclosure process below.

Repository hygiene is enforced in CI as well as by `.gitignore`: environment files,
credentials, private-key material, dependency folders, build output, coverage, and
test-report directories must not be tracked. Treat a CI hygiene failure as a security
issue and remove the offending path from the Git index before continuing.

---

## Reporting a Vulnerability

We value the security of our platform and community. If you discover a security vulnerability or a violation of the Zero Secret Egress policy, please **DO NOT** open a public issue. Instead, report it securely to our security team.

### Disclosure Process

1. Send an encrypted email to **<security@conxian.org>** detailing the vulnerability.
2. Include a detailed description of the issue, step-by-step reproduction instructions, and potential impact.
3. Our team will acknowledge receipt of your report within 24 hours and provide an estimated timeline for resolution.
4. We kindly request that you practice responsible disclosure and give our team a reasonable window to remediate the vulnerability before public sharing.
