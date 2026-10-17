# Release Readiness and Verification Checklist

This checklist describes the current scope of Instagram API Workbench and the evidence needed before treating a build or a particular route as ready. It is intentionally conservative: a successful local test suite is not proof that Instagram supports every reconstructed operation.

## Current automated checks

The GitHub Actions workflow on `main` is expected to run:

- Node.js unit and security regression tests.
- Desktop/mobile browser smoke tests for the local workbench UI.
- OpenAPI structure, catalog, and provenance validation.
- Python extraction regression tests using synthetic fixtures.
- Static route-audit report generation, including Markdown and CSV artifacts.
- A production dependency audit that fails on high-severity findings.

Check the latest workflow run before release. A green run means these defined checks passed for that commit; it does not imply live route coverage.

## Verification levels

| Level | Evidence | What it establishes | What it does not establish |
| --- | --- | --- | --- |
| Static candidate | Route or operation appears in recovered metadata | A candidate was found in the reconstructed client corpus | Server existence, access, or expected behavior |
| Static source evidence | Sanitized method/path evidence is attached | A source-analysis observation supports the candidate | Final dispatch, permissions, response shape, or availability |
| Local automated test | A deterministic test passes with fixtures/mocks | The tested local behavior works for that test case | Instagram's live behavior |
| Controlled live check | An explicitly authorized request succeeds and is recorded with a timestamp and sanitized result | That request worked for that account/session and context at that time | Other routes, accounts, permissions, or future availability |

The offline route audit deliberately reports live endpoint verification as not performed. Do not relabel static metadata as live verification.

## Before sharing a build

- [ ] Confirm the target commit is on `main` and its required GitHub Actions checks passed.
- [ ] Run `cd api && npm ci && npm test && npm run validate && npm run test:ui`.
- [ ] Run `cd api/bulk-trace && python -m unittest -v test_extract.py`.
- [ ] Generate the route audit and review queues; inspect write operations before any manual execution.
- [ ] Review dependency-audit results and Dependabot alerts.
- [ ] Confirm no session cookies, bearer tokens, private account identifiers, raw device dumps, or unredacted request/response bodies were committed.
- [ ] Confirm the local server remains bound to loopback and is not exposed through a public tunnel or multi-user hosting.
- [ ] Verify README and release notes accurately describe known limitations.

## Before a controlled live route check

Only test accounts and routes you are authorized to access. Prefer harmless, read-only requests first.

- [ ] Record the exact application/session context, route, method, required headers, and timestamp.
- [ ] Use a dedicated test account where possible; do not automate high-volume requests or bypass platform controls.
- [ ] Inspect the request for personal data and ensure secrets are not copied into logs, reports, screenshots, or commits.
- [ ] Confirm the route's method and payload from evidence rather than guessing based on a URL.
- [ ] Treat POST, PUT, PATCH, and DELETE operations as potentially state-changing. Review the full payload and expected impact before sending.
- [ ] Capture only sanitized status and outcome evidence. Do not publish cookies, bearer tokens, full private responses, or account-specific identifiers.
- [ ] Mark a route as verified only for the specific tested context and timestamp; document failures and ambiguous results without extrapolating to other routes.

## Security boundaries

- This project is a local research workbench, not a hosted public API service.
- Session cookies and bearer tokens are credentials. Never commit them or send them to third-party helpers.
- Do not disable origin/token checks, redirect protections, upstream allowlists, body/response limits, or manual write confirmation to make a test pass.
- Do not use the workbench for bulk actions, spam, scraping private data, or evading Instagram rate limits and security controls.
- If a test exposes a credential or personal data, stop, revoke/rotate the credential where appropriate, remove the secret from any shared artifacts, and investigate repository history.

## Release decision

A release is ready for **local research use** when the automated checks pass, the security boundaries remain intact, and the limitations above are visible to users.

A route is **live-verified** only when there is a separate, authorized, sanitized record of a successful controlled live check. A repository release must never claim complete live route verification or production readiness for a public multi-user service based only on CI or static analysis.
