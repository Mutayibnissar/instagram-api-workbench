import fs from 'node:fs';

const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'];

export function extractOperations(spec) {
  const operations = [];
  for (const [route, pathItem] of Object.entries(spec.paths ?? {})) {
    for (const method of METHODS) {
      const operation = pathItem?.[method];
      if (!operation) continue;
      const evidence = Array.isArray(operation['x-method-evidence']) ? operation['x-method-evidence'] : [];
      operations.push({
        method: method.toUpperCase(),
        route,
        operationId: operation.operationId ?? '',
        summary: operation.summary ?? '',
        evidenceCount: evidence.length,
        dispatchVerified: operation['x-dispatch-verified'] === true,
        methodStatus: pathItem['x-method-status'] ?? 'not specified',
        evidence
      });
    }
  }
  return operations.sort((a, b) => a.method.localeCompare(b.method) || a.route.localeCompare(b.route));
}

export function summarizeOperations(operations) {
  const methods = {};
  let withEvidence = 0;
  let dispatchVerified = 0;
  for (const item of operations) {
    methods[item.method] = (methods[item.method] ?? 0) + 1;
    if (item.evidenceCount > 0) withEvidence++;
    if (item.dispatchVerified) dispatchVerified++;
  }
  return {
    totalOperations: operations.length,
    methods,
    operationsWithStaticMethodEvidence: withEvidence,
    operationsWithoutStaticMethodEvidence: operations.length - withEvidence,
    dispatchVerifiedBySourceMetadata: dispatchVerified,
    liveEndpointVerification: 'not performed by this report'
  };
}

function markdown(operations, summary) {
  const lines = [
    '# Static Route Evidence Audit',
    '',
    '> This is a local static-analysis inventory, not a live endpoint test. A route with source evidence is not thereby guaranteed to exist, be accessible, or behave as expected on Instagram.',
    '',
    '## Summary',
    '',
    '| Metric | Count / status |',
    '| --- | ---: |',
    `| Operations | ${summary.totalOperations} |`,
    `| Operations with static method evidence | ${summary.operationsWithStaticMethodEvidence} |`,
    `| Operations without static method evidence | ${summary.operationsWithoutStaticMethodEvidence} |`,
    `| Marked dispatch-verified by source metadata | ${summary.dispatchVerifiedBySourceMetadata} |`,
    '| Live endpoint verification | Not performed |',
    '',
    '## HTTP method breakdown',
    '',
    '| Method | Operations |',
    '| --- | ---: |',
    ...Object.entries(summary.methods).sort(([a], [b]) => a.localeCompare(b)).map(([method, count]) => `| ${method} | ${count} |`),
    '',
    '## Route inventory',
    '',
    '| Method | Route | Operation ID | Static evidence records | Dispatch metadata |',
    '| --- | --- | --- | ---: | --- |',
    ...operations.map(item => `| ${item.method} | \`${item.route.replaceAll('|', '\\|')}\` | \`${item.operationId.replaceAll('|', '\\|')}\` | ${item.evidenceCount} | ${item.dispatchVerified ? 'marked verified in source metadata' : 'not marked verified'} |`),
    ''
  ];
  return lines.join('\n');
}

const args = new Set(process.argv.slice(2));
if (args.has('--help')) {
  console.log('Usage: node route-audit.mjs [--json] [--full]\n  default  print a compact summary\n  --json   print the full machine-readable inventory\n  --full   print the full Markdown inventory');
} else {
  const spec = JSON.parse(fs.readFileSync(new URL('./openapi.json', import.meta.url), 'utf8'));
  const operations = extractOperations(spec);
  const summary = summarizeOperations(operations);
  if (args.has('--json')) console.log(JSON.stringify({ summary, operations }, null, 2));
  else if (args.has('--full')) console.log(markdown(operations, summary));
  else {
    console.log('Static route evidence audit (no network requests performed)');
    console.log(JSON.stringify(summary, null, 2));
    console.log('Use --full for a Markdown inventory or --json for machine-readable details.');
  }
}
