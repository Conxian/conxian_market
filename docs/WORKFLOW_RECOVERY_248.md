# Workflow recovery — issue #248

The three failed, zero-job runs recorded on 3 November 2026 cannot execute
because `neon_workflow.yml`, `docs-ci.yml` and `publish.yml` contain the invalid
YAML mapping `permissions: contents: read`. Local YAML parsing reproduces a
syntax error at that line in all three files. The repair uses a nested
`contents: read` mapping and preserves the permission level.

The Neon job outputs also referenced `create_neon_branch_encode`, although
the action step ID is `create_neon_branch`. Both outputs now reference the
actual step. Connection outputs remain secret-bearing; never print them.

The ordinary SDK CI now parses every workflow and checks job-output step
references. Regression fixtures reject malformed YAML and a dangling output,
and accept a valid hyphenated step ID. This is a bounded source validator,
not a complete GitHub Actions schema or expression evaluator.

Local validation: all eight workflow files parse; three new validator tests
and 15 promotion-policy tests pass; SDK typecheck, 390 tests, 72 CLI checks,
build and distribution verification pass. Hosted exact-head results are
separate. No package was published and no Neon branch was created or deleted
by local validation. Ordinary PR automation may provision its configured
isolated preview branch; production databases remain outside this repair.

The issue stays open until hosted validation and the relevant operational
contracts are accepted through the normal review and promotion route.
