# Route-by-route verification workflow

The route catalog is reconstructed from client-side evidence. It must not be treated as a list of supported or stable server APIs. Start with this offline audit:

```sh
cd api
node route-audit.mjs
node route-audit.mjs --full > ../ROUTE_EVIDENCE_AUDIT.md
node route-audit.mjs --json > ../route-evidence-audit.json
```

The report reads the checked-in OpenAPI document only. CI uploads the full Markdown report as a downloadable artifact named `route-evidence-audit` (retained for 14 days). It does **not** connect to Instagram, use credentials, or mark endpoints as live-verified. It also flags write methods for careful review, missing operation IDs or summaries, and path placeholders without declared path parameters. These are documentation-quality checks, not proof that an endpoint works or is safe. “Static method evidence” means the source-analysis pipeline retained a method/path observation; it does not establish server support, permissions, required headers, payload correctness, or successful dispatch.

## Controlled live verification

For each candidate, use only an account you control and the local workbench:

1. Record the exact route, method, account/profile type, and date in a private local audit log.
2. Begin with read-only GET requests where possible. Avoid testing write methods merely to see whether they work.
3. Check the upstream HTTP status and response shape; distinguish authentication, challenge, rate-limit, unsupported-route, and transport failures.
4. Do not save cookies, bearer tokens, request bodies, private response data, or full query strings in a shared report.
5. Repeat only when necessary and respect platform limits. A single success is evidence for that account and time, not a guarantee of general support.
6. Treat POST, PUT, PATCH, and DELETE as potentially destructive. Review the route and payload and use the workbench confirmation prompt.

Do not publish credentials, account identifiers, private responses, or an unredacted live test log in issues or pull requests. This project does not provide a public multi-user testing service.
