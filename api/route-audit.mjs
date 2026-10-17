import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'];
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function pathParameterNames(route) {
  return [...route.matchAll(/\{([^}/]+)\}/g)].map(match => match[1]);
}

export function extractOperations(spec) {
  const operations = [];
  for (const [route, pathItem] of Object.entries(spec.paths ?? {})) {
    for (const method of METHODS) {
      const operation = pathItem?.[method];
      if (!operation) continue;
      const evidence = Array.isArray(operation['x-method-evidence']) ? operation['x-method-evidence'] : [];
      const routeParams = pathParameterNames(route);
      const declaredParams = new Set(
        [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])]
          .filter(parameter => parameter && parameter.in === 'path' && typeof parameter.name === 'string')
          .map(parameter => parameter.name)
      );
      const undeclaredPathParams = routeParams.filter(name => !declaredParams.has(name));
      const operationId = operation.operationId ?? '';
      const summary = operation.summary ?? '';
      const upperMethod = method.toUpperCase();
      operations.push({
        method: upperMethod,
        route,
        operationId,
        summary,
        hasOperationId: Boolean(operationId),
        hasSummary: Boolean(summary),
        isWriteOperation: WRITE_METHODS.has(upperMethod),
        pathParameterNames: routeParams,
        undeclaredPathParams,
        evidenceCount: evidence.length,
        dispatchVerified: operation['x-dispatch-verified'] === true,
        methodStatus: pathItem['x-method-status'] ?? 'not specified',
        evidence
      });
    }
  }
  return operations.sort((a, b) => a.method.localeCompare(b.method) || a.route.localeCompare(b.route));
}

export function filterOperations(operations, {writesOnly = false, needsReview = false} = {}) {
  return operations.filter(item => {
    if (writesOnly && !(item.isWriteOperation ?? WRITE_METHODS.has(item.method))) return false;
    if (needsReview) {
      const flagged = (item.isWriteOperation ?? WRITE_METHODS.has(item.method))
        || !(item.hasOperationId ?? Boolean(item.operationId))
        || !(item.hasSummary ?? Boolean(item.summary))
        || (item.undeclaredPathParams ?? []).length > 0;
      if (!flagged) return false;
    }
    return true;
  });
}

export function summarizeOperations(operations) {
  const methods = {};
  let withEvidence = 0;
  let dispatchVerified = 0;
  let writeOperations = 0;
  let missingOperationIds = 0;
  let missingSummaries = 0;
  let undeclaredPathParameterOperations = 0;
  for (const item of operations) {
    methods[item.method] = (methods[item.method] ?? 0) + 1;
    if (item.evidenceCount > 0) withEvidence++;
    if (item.dispatchVerified) dispatchVerified++;
    if (item.isWriteOperation ?? WRITE_METHODS.has(item.method)) writeOperations++;
    if (!(item.hasOperationId ?? Boolean(item.operationId))) missingOperationIds++;
    if (!(item.hasSummary ?? Boolean(item.summary))) missingSummaries++;
    if ((item.undeclaredPathParams ?? []).length > 0) undeclaredPathParameterOperations++;
  }
  return {
    totalOperations: operations.length,
    methods,
    operationsWithStaticMethodEvidence: withEvidence,
    operationsWithoutStaticMethodEvidence: operations.length - withEvidence,
    dispatchVerifiedBySourceMetadata: dispatchVerified,
    writeOperationsRequireCarefulReview: writeOperations,
    operationsMissingOperationId: missingOperationIds,
    operationsMissingSummary: missingSummaries,
    operationsWithUndeclaredPathParameters: undeclaredPathParameterOperations,
    liveEndpointVerification: 'not performed by this report'
  };
}

export function csv(operations) {
  const columns = [
    ['Method', item => item.method],
    ['Route', item => item.route],
    ['Operation ID', item => item.operationId],
    ['Summary', item => item.summary],
    ['Static evidence count', item => item.evidenceCount],
    ['Dispatch verified by source metadata', item => item.dispatchVerified],
    ['Write operation requiring review', item => item.isWriteOperation],
    ['Missing operation ID', item => !item.hasOperationId],
    ['Missing summary', item => !item.hasSummary],
    ['Undeclared path parameters', item => (item.undeclaredPathParams ?? []).join('; ')],
    ['Review flags', item => [
      item.isWriteOperation ? 'write method: review before sending' : '',
      !item.hasOperationId ? 'missing operationId' : '',
      !item.hasSummary ? 'missing summary' : '',
      (item.undeclaredPathParams ?? []).length ? 'undeclared path params: ' + item.undeclaredPathParams.join('; ') : ''
    ].filter(Boolean).join('; ') || 'none detected by static checks']
  ];
  const cell = value => { const normalized = String(value ?? '').replace(/[\r\n]+/g, ' '); const safe = /^[\t ]*[=+\-@]/.test(normalized) ? "'" + normalized : normalized; return '"' + safe.replaceAll('"', '""') + '"'; };
  return [
    columns.map(([name]) => cell(name)).join(','),
    ...operations.map(item => columns.map(([, value]) => cell(value(item))).join(','))
  ].join('\n');
}

export function markdown(operations, summary) {
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
    `| Write operations requiring careful review | ${summary.writeOperationsRequireCarefulReview} |`,
    `| Operations missing operationId | ${summary.operationsMissingOperationId} |`,
    `| Operations missing summary | ${summary.operationsMissingSummary} |`,
    `| Operations with undeclared path parameters | ${summary.operationsWithUndeclaredPathParameters} |`,
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
    '| Method | Route | Operation ID | Static evidence | Review flags | Dispatch metadata |',
    '| --- | --- | --- | ---: | --- | --- |',
    ...operations.map(item => {
      const flags = [
        item.isWriteOperation ? 'write method: review before sending' : '',
        !item.hasOperationId ? 'missing operationId' : '',
        !item.hasSummary ? 'missing summary' : '',
        item.undeclaredPathParams.length ? `undeclared path params: ${item.undeclaredPathParams.join(', ')}` : ''
      ].filter(Boolean).join('; ') || 'none detected by static checks';
      return `| ${item.method} | \`${item.route.replaceAll('|', '\\|')}\` | \`${item.operationId.replaceAll('|', '\\|')}\` | ${item.evidenceCount} | ${flags.replaceAll('|', '\\|')} | ${item.dispatchVerified ? 'marked verified in source metadata' : 'not marked verified'} |`;
    }),
    ''
  ];
  return lines.join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = new Set(process.argv.slice(2));
  if (args.has('--help')) {
    console.log('Usage: node route-audit.mjs [--json] [--full] [--csv] [--writes-only] [--needs-review]\n  default       print a compact summary\n  --json        print the machine-readable inventory\n  --full        print the full Markdown inventory\n  --csv         print a spreadsheet-friendly CSV inventory\n  --writes-only include POST/PUT/PATCH/DELETE only\n  --needs-review include operations flagged by static checks');
  } else {
    const spec = JSON.parse(fs.readFileSync(new URL('./openapi.json', import.meta.url), 'utf8'));
    const allOperations = extractOperations(spec);
    const operations = filterOperations(allOperations, {writesOnly: args.has('--writes-only'), needsReview: args.has('--needs-review')});
    const summary = summarizeOperations(operations);
    if (args.has('--json')) console.log(JSON.stringify({ summary, operations }, null, 2));
    else if (args.has('--csv')) console.log(csv(operations));
    else if (args.has('--full')) console.log(markdown(operations, summary));
    else {
      console.log('Static route evidence audit (no network requests performed)');
      console.log(JSON.stringify(summary, null, 2));
      console.log('Use --full for a Markdown inventory or --json for machine-readable details.');
    }
  }
}
