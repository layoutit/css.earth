/** Report investigation decisions and missing ledgers from the same descriptors that generate OBJECTS.
 * Usage: node tools/report-investigations.mts [--classification=asteroid] [--status=deferred,unresolved] [--search=registration] [--summary] [--json]
 *        node tools/report-investigations.mts --index [--write]
 *
 * `--index` renders the open-work index: every unresolved or deferred decision grouped by what is being waited on, so the
 * next piece of work is chosen from the record instead of memory. `--write` refreshes the committed copy.
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { INVESTIGATION_STATUSES, readInvestigationLedgers, type InvestigationLedger, type InvestigationStatus } from './investigation-ledger.mts';
import { readCatalog } from './prepare-catalog.mts';

interface ObjectIdentity { id: string; classification: string }
export interface InvestigationOptions { classification?: string; statuses: readonly InvestigationStatus[]; search?: string; summary: boolean; json: boolean; index: boolean; write: boolean }
export const INVESTIGATION_INDEX_FILE = 'docs/provenance/investigation-index.md';
export function investigationOptions(args: readonly string[]): InvestigationOptions {
  const { values } = parseArgs({ args: [...args], strict: true, options: {
    classification: { type: 'string' }, status: { type: 'string' }, search: { type: 'string' },
    summary: { type: 'boolean', default: false }, json: { type: 'boolean', default: false },
    index: { type: 'boolean', default: false }, write: { type: 'boolean', default: false },
  } });
  const requested = values.status?.split(',') ?? ['deferred', 'unresolved', 'excluded'];
  const statuses = [...new Set(requested)].map(name => {
    const status = INVESTIGATION_STATUSES.find(status => status === name);
    if (!status) throw new TypeError(`Choose statuses from ${INVESTIGATION_STATUSES.join(', ')}.`);
    return status;
  });
  if (values.classification !== undefined && !values.classification.trim()) throw new TypeError('Classification must not be empty.');
  if (values.write && !values.index) throw new TypeError('--write refreshes the committed index; pass --index.');
  return { classification: values.classification, statuses, search: values.search, summary: values.summary, json: values.json,
    index: values.index, write: values.write };
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

/** The open-work index: unresolved and deferred decisions grouped by the shared record or route they are waiting on. */
export function formatInvestigationIndex(report: ReturnType<typeof investigationReport>) {
  const open = report.entries.filter(entry => entry.status === 'unresolved' || entry.status === 'deferred');
  const groups = new Map<string, typeof open>();
  for (const entry of open) {
    const key = entry.survey ?? entry.id;
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  const ordered = [...groups].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'en'));
  const lines = ['# Open investigation index', '',
    'Generated by `pnpm investigations:index`. Every unresolved or deferred decision in the ledgers, grouped by the shared',
    'record or entry id it waits on. Counts are recorded decisions, not scientific readiness.', '',
    `**Ledgers:** ${report.coverage.objectsWithLedger} of ${report.coverage.cataloguedObjects} catalogued objects.`,
    `**Open decisions:** ${open.length} (${report.counts.unresolved} unresolved, ${report.counts.deferred} deferred).`, '',
    '| Waiting on | Open | Bodies | Reopens when |', '| --- | ---: | --- | --- |'];
  for (const [key, entries] of ordered) {
    const bodies = entries.map(entry => entry.objectId);
    const shown = bodies.slice(0, 6).join(', ') + (bodies.length > 6 ? `, +${bodies.length - 6} more` : '');
    const revisit = entries.find(entry => entry.revisitWhen)?.revisitWhen ?? '—';
    lines.push(`| \`${key}\` | ${entries.length} | ${shown} | ${revisit.replace(/\|/g, '\\|')} |`);
  }
  return lines.join('\n') + '\n';
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = fileURLToPath(new URL('../', import.meta.url)), options = investigationOptions(process.argv.slice(2));
  const [objects, ledgers] = await Promise.all([readCatalog(resolve(root, 'src/objects')), readInvestigationLedgers(root)]);
  // The index covers every recorded decision, so its status filter is not the report's.
  const report = investigationReport(objects, ledgers, options.index ? { ...options, statuses: [...INVESTIGATION_STATUSES] } : options);
  if (options.index) {
    const text = formatInvestigationIndex(report);
    if (!options.write) { console.log(text.trimEnd()); }
    else {
      const { writeFile } = await import('node:fs/promises');
      await writeFile(resolve(root, INVESTIGATION_INDEX_FILE), text);
      console.log(`${INVESTIGATION_INDEX_FILE}: ${report.counts.unresolved + report.counts.deferred} open decisions`);
    }
  } else console.log(options.json ? JSON.stringify(report, null, 2) : formatInvestigationReport(report, options.summary).trimEnd());
}
