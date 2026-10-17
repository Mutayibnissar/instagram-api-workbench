# Development and Verification Guide

## Project status

This repository is an independently maintained copy of the MIT-licensed
[upstream Instagram API Workbench](https://github.com/kernelpanic0x11/instagram-api-workbench).
The upstream project and its license/notices are retained. Changes here do not
modify the original repository.

The route and operation inventory is recovered from static analysis of a client
application. It is **not** a list of server endpoints verified to work. Do not
describe candidate routes as supported or stable Instagram APIs.

## Requirements

- Node.js 20 or later
- Python 3.10+ for the synthetic DEX extraction tests
- Chrome only if you intentionally use the optional browser-login helper

## Run locally

From the repository root:

```bash
cd api
npm ci
npm test
npm run validate
npm start
```

Open `http://127.0.0.1:8766/`. The workbench is designed to listen on loopback
only. Do not expose it to a LAN, reverse proxy, tunnel, or public hosting service.

## Automated checks

GitHub Actions runs these checks on pushes and pull requests to `main`:

- Node unit and security regression tests
- OpenAPI JSON/YAML equivalence and schema validation
- Evidence-catalog consistency checks
- Python tests for conservative DEX receiver/method tracking
- A dependency vulnerability report (informational; it does not currently fail
  the build on audit findings)

See the latest run in the repository's Actions tab.

## Security boundaries

- Use only accounts and session credentials you control.
- Treat session cookies and bearer tokens like passwords. Never commit them,
  include them in issue reports, or paste them into public logs.
- Use the local browser session or manual credentials only on your own machine.
- Do not deploy this workbench as a multi-user service.
- Some requests can change account state. Review method, route, payload, and
  target account before running any mutating operation.
- Authentication verification confirms only the specific identity check at the
  time it ran; it does not establish permission for every route.
- Follow Instagram/Meta terms, applicable law, rate limits, and privacy
  requirements. This project does not promise increased reach, ranking changes,
  or a way to bypass platform restrictions.

## Contribution checklist

Before submitting a change:

1. Run `npm ci`, `npm test`, and `npm run validate` in `api/`.
2. Run `python -m unittest -v test_extract.py` in `api/bulk-trace/`.
3. Keep route claims linked to evidence and clearly label uncertainty.
4. Add regression tests for security-sensitive behavior.
5. Ensure no credentials, session state, personal account data, or browser
   profiles are staged for commit.
