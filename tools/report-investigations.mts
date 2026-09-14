/** Report investigation decisions and missing ledgers from the same descriptors that generate OBJECTS.
 * Usage: node tools/report-investigations.mts [--classification=asteroid] [--status=deferred,unresolved] [--search=registration] [--summary] [--json]
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { INVESTIGATION_STATUSES, readInvestigationLedgers, type InvestigationLedger, type InvestigationStatus } from './investigation-ledger.mts';
import { readCatalog } from './prepare-catalog.mts';

interface ObjectIdentity { id: string; classification: string }
export interface InvestigationOptions { classification?: string; statuses: readonly InvestigationStatus[]; search?: string; summary: boolean; json: boolean }
export function investigationOptions(args: readonly string[]): InvestigationOptions {
  const { values } = parseArgs({ args: [...args], strict: true, options: {
    classification: { type: 'string' }, status: { type: 'string' }, search: { type: 'string' },
    summary: { type: 'boolean', default: false }, json: { type: 'boolean', default: false },
  } });
  const requested = values.status?.split(',') ?? ['deferred', 'unresolved', 'excluded'];
  const statuses = [...new Set(requested)].map(name => {
    const status = INVESTIGATION_STATUSES.find(status => status === name);
    if (!status) throw new TypeError(`Choose statuses from ${INVESTIGATION_STATUSES.join(', ')}.`);
    return status;
  });
  if (values.classification !== undefined && !values.classification.trim()) throw new TypeError('Classification must not be empty.');
  return { classification: values.classification, statuses, search: values.search, summary: values.summary, json: values.json };
}

/** Ledger coverage measures recorded decisions, never scientific acceptance or completeness of an archive survey. */
export function investigationReport(objects: readonly ObjectIdentity[], ledgers: readonly InvestigationLedger[], options: InvestigationOptions) {
  if (options.classification && !objects.some(object => object.classification === options.classification)) throw new TypeError(`Unknown object classification: ${options.classification}.`);
  const selected = objects.filter(object => !options.classification || object.classification === options.classification);
  const ids = new Set(selected.map(object => object.id));
  // The unfiltered report also retains context objects whose ledgers are outside the navigable catalogue.
  const scoped = ledgers.filter(ledger => !options.classification || ids.has(ledger.objectId));
  const byId = new Map(scoped.map(ledger => [ledger.objectId, ledger]));
  const counts = Object.fromEntries(INVESTIGATION_STATUSES.map(status => [status, scoped.reduce((sum, ledger) => sum + ledger.entries.filter(entry => entry.status === status).length, 0)]));
  const search = options.search?.toLocaleLowerCase('en');
  const entries = scoped.flatMap(ledger => ledger.entries.map(entry => ({ objectId: ledger.objectId, ...entry })))
    .filter(entry => options.statuses.includes(entry.status) && (!search || [entry.objectId, entry.subject, entry.finding, entry.revisitWhen ?? ''].some(text => text.toLocaleLowerCase('en').includes(search))))
    .sort((a, b) => options.statuses.indexOf(a.status) - options.statuses.indexOf(b.status) || a.objectId.localeCompare(b.objectId, 'en') || a.id.localeCompare(b.id, 'en'));
  const missing = selected.filter(object => !byId.has(object.id)).map(object => object.id).sort();
  return { classification: options.classification ?? 'all', scope: 'Repository investigation records; ledger coverage is not scientific readiness or proof of an exhaustive source survey.',
    coverage: { cataloguedObjects: selected.length, objectsWithLedger: selected.length - missing.length, missingLedgers: missing }, counts,
    filters: { statuses: options.statuses, ...(options.search === undefined ? {} : { search: options.search }) }, entries };
}

export function formatInvestigationReport(report: ReturnType<typeof investigationReport>, summary = false) {
  const { coverage } = report;
  const lines = [`${report.classification}: ${coverage.objectsWithLedger}/${coverage.cataloguedObjects} catalogued objects have ledgers`,
    'Counts are recorded decisions, not completed or qualified bodies.',
    INVESTIGATION_STATUSES.map(status => `${status}: ${report.counts[status]}`).join(' | ')];
  if (coverage.missingLedgers.length) lines.push(`Missing ledgers: ${coverage.missingLedgers.join(', ')}`);
  if (!summary) for (const entry of report.entries) {
    const last = entry.checked.at(-1);
    lines.push(`\n- ${entry.objectId}: ${entry.subject} [${entry.status}; ${entry.id}]`, `  finding: ${entry.finding}`);
    if (entry.revisitWhen) lines.push(`  revisit when: ${entry.revisitWhen}`);
    if (last) lines.push(`  checked: ${last.date} at ${last.commit}${last.pr === undefined ? '' : ` (#${last.pr})`}`);
    lines.push(`  evidence: ${entry.evidence.join(' ')}`);
  }
  return lines.join('\n') + '\n';
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = fileURLToPath(new URL('../', import.meta.url)), options = investigationOptions(process.argv.slice(2));
  const [objects, ledgers] = await Promise.all([readCatalog(resolve(root, 'src/objects')), readInvestigationLedgers(root)]);
  const report = investigationReport(objects, ledgers, options);
  console.log(options.json ? JSON.stringify(report, null, 2) : formatInvestigationReport(report, options.summary).trimEnd());
}
