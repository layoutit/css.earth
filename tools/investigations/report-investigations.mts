/** Report investigation decisions and missing ledgers from the same descriptors that generate OBJECTS, or with --facilities from
 * the facilities catalogue's ground telescopes and their ledgers under src/facilities.
 * Usage: node tools/investigations/report-investigations.mts [--facilities] [--classification=asteroid] [--status=deferred,unresolved] [--search=registration] [--summary] [--json]
 *        node tools/investigations/report-investigations.mts --index [--write]
 *
 * `--index` renders the open-work index: every unresolved or deferred decision grouped by what is being waited on, so the
 * next piece of work is chosen from the record instead of memory. `--write` refreshes the committed copy.
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { INVESTIGATION_STATUSES, readFacilityLedgers, readInvestigationLedgers, type InvestigationLedger, type InvestigationStatus } from './investigation-ledger.mts';
import { readCatalog } from '../prepare/prepare-catalog.mts';

interface ObjectIdentity { id: string; classification: string }
export interface InvestigationOptions { classification?: string; statuses: readonly InvestigationStatus[]; search?: string; summary: boolean; json: boolean; facilities: boolean; index: boolean; write: boolean }
export const INVESTIGATION_INDEX_FILE = 'docs/provenance/investigation-index.md';
export function investigationOptions(args: readonly string[]): InvestigationOptions {
  const { values } = parseArgs({ args: [...args], strict: true, options: {
    classification: { type: 'string' }, status: { type: 'string' }, search: { type: 'string' },
    summary: { type: 'boolean', default: false }, json: { type: 'boolean', default: false },
    index: { type: 'boolean', default: false }, write: { type: 'boolean', default: false }, facilities: { type: 'boolean', default: false },
  } });
  const requested = values.status?.split(',') ?? ['deferred', 'unresolved', 'excluded'];
  const statuses = [...new Set(requested)].map(name => {
    const status = INVESTIGATION_STATUSES.find(status => status === name);
    if (!status) throw new TypeError(`Choose statuses from ${INVESTIGATION_STATUSES.join(', ')}.`);
    return status;
  });
  if (values.classification !== undefined && !values.classification.trim()) throw new TypeError('Classification must not be empty.');
  if (values.write && !values.index) throw new TypeError('--write refreshes the committed index; pass --index.');
  if (values.facilities && values.classification !== undefined) throw new TypeError('Facilities have no object classification.');
  return { classification: values.classification, statuses, search: values.search, summary: values.summary, json: values.json,
    facilities: values.facilities, index: values.index, write: values.write };
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

/** The external source an open decision examined: where the evidence that would reopen it appears. */
export function watchedSource(evidence: readonly string[]) {
  const external = evidence.find(link => !link.startsWith('https://github.com/layoutit/css.earth/'));
  return external === undefined ? null : new URL(external).host;
}

/** The open-work index: unresolved and deferred decisions grouped by the shared record or route they wait on, and by the
 * external source that would reopen them. A decision with no external source is the backlog: nothing names where to look. */
export function formatInvestigationIndex(report: ReturnType<typeof investigationReport>) {
  const open = report.entries.filter(entry => entry.status === 'unresolved' || entry.status === 'deferred');
  const group = <T,>(items: readonly T[], key: (item: T) => string) => {
    const groups = new Map<string, T[]>();
    for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
    return [...groups].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'en'));
  };
  const bodies = (entries: readonly { objectId: string }[]) => {
    const names = [...new Set(entries.map(entry => entry.objectId))];
    return names.slice(0, 6).join(', ') + (names.length > 6 ? `, +${names.length - 6} more` : '');
  };
  const cell = (text: string) => text.replace(/\|/g, '\\|');
  const unsourced = open.filter(entry => watchedSource(entry.evidence) === null);
  const lines = ['# Open investigation index', '',
    'Generated by `node tools/investigations/report-investigations.mts --index --write`. Every unresolved or deferred decision in the ledgers. Counts are recorded',
    'decisions, not scientific readiness.', '',
    `**Ledgers:** ${report.coverage.objectsWithLedger} of ${report.coverage.cataloguedObjects} catalogued objects.`,
    `**Open decisions:** ${open.length} (${report.counts.unresolved} unresolved, ${report.counts.deferred} deferred).`, '',
    '## Where the reopening evidence would appear', '',
    'The source each decision examined. Watching these is how a decision reopens.', '',
    '| Source | Open | Bodies |', '| --- | ---: | --- |'];
  for (const [host, entries] of group(open.filter(entry => watchedSource(entry.evidence) !== null), entry => watchedSource(entry.evidence)!)) {
    lines.push(`| ${host} | ${entries.length} | ${bodies(entries)} |`);
  }
  lines.push('', '## What each decision waits on', '', '| Waiting on | Open | Bodies | Reopens when |', '| --- | ---: | --- | --- |');
  for (const [key, entries] of group(open, entry => entry.survey ?? entry.id)) {
    lines.push(`| \`${key}\` | ${entries.length} | ${bodies(entries)} | ${cell(entries.find(entry => entry.revisitWhen)?.revisitWhen ?? '—')} |`);
  }
  const excludedUnsourced = report.entries.filter(entry => entry.status === 'excluded' && watchedSource(entry.evidence) === null).length;
  lines.push('', '## Backlog: no external source recorded', '',
    `${unsourced.length} of these open decisions name no source outside this repository, so nothing says where to look`,
    `(${unsourced.length + excludedUnsourced} with the excluded decisions, which the ledger test tracks). Give each one the archive,`,
    'deposit or paper it was checked against, or record that its next move is work here.', '',
    '| Waiting on | Open | Bodies |', '| --- | ---: | --- |');
  for (const [key, entries] of group(unsourced, entry => entry.survey ?? entry.id)) {
    lines.push(`| \`${key}\` | ${entries.length} | ${bodies(entries)} |`);
  }
  return lines.join('\n') + '\n';
}

/** The facilities a sweep covers: the catalogue's ground telescopes. A facility may keep a ledger without a page record. */
export async function groundFacilities(root: string) {
  const catalogue = JSON.parse(await readFile(resolve(root, 'site/source/facilities/catalog.json'), 'utf8')) as { facilities: { id: string; setting: { value: string } }[] };
  return catalogue.facilities.filter(facility => facility.setting.value === 'ground').map(facility => ({ id: facility.id, classification: 'ground-facility' }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = fileURLToPath(new URL('../../', import.meta.url)), options = investigationOptions(process.argv.slice(2));
  if (options.facilities) {
    const [facilities, ledgers] = await Promise.all([groundFacilities(root), readFacilityLedgers(root)]);
    const report = investigationReport(facilities, ledgers.map(ledger => ({ schema: ledger.schema, objectId: ledger.facilityId, entries: ledger.entries })), options);
    console.log(options.json ? JSON.stringify(report, null, 2)
      : formatInvestigationReport(report, options.summary).replace(/catalogued objects have ledgers/u, 'ground facilities have ledgers').trimEnd());
    process.exit(0);
  }
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
