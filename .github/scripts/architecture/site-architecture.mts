/** Validate the pending site layout against one live declaration scan and reproduce its marked tables. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readImportDeclarations } from './import-declarations.mts';
import { repositoryFiles, type ImportGraph } from './graph.mts';
import { project, editList, type ProjectionInput } from './projection.mts';
import { sequence, minimality } from './plan-proofs.mts';
import { references, liveReferences, coveringReferences, compactReferences } from './plan-references.mts';
import { byText, isTestPath } from './zones.mts';

const DOC = 'docs/site-architecture.md';
const DATA = 'docs/site-architecture';
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Expected object');
  return Object.fromEntries(Object.entries(value));
}
function list(value: unknown): unknown[] { if (!Array.isArray(value)) throw new TypeError('Expected array'); return value; }
function text(value: unknown): string { if (typeof value !== 'string') throw new TypeError('Expected string'); return value; }
function number(value: unknown): number { if (typeof value !== 'number') throw new TypeError('Expected number'); return value; }
const row = (cells: readonly (string | number)[]) => `| ${cells.map(cell => String(cell).replaceAll('|', '\\|').replaceAll('\n', ' ')).join(' | ')} |`;

/** Pure rendering also validates the projection; a stale edit or an uncovered root file fails before writing. */
export function renderTables(input: ProjectionInput): Record<string, string> {
  const after = project(input), map = record(input.moves), tierData = record(input.tiers);
  if (after.failed) throw new Error(`Site plan fails projection: ${JSON.stringify({ unassigned: after.unassigned,
    tests: after.productionImportsTests, forbidden: after.forbidden, views: Object.fromEntries(Object.entries(after.views).map(([name, view]) => [name,
      [view.fileSccs.length, view.folderSccs.length, view.upward.length, view.lateral.length]])) })}`);
  const tiers = list(tierData.tiers).map(value => {
    const entry = record(value); return { tier: number(entry.tier), name: text(entry.name), folders: list(entry.folders).map(text) };
  }).sort((a, b) => a.tier - b.tier || byText(a.name, b.name));
  const inventory = record(input.declarations), summary = record(inventory.summary);
  const originals = new Set([...list(summary.files).map(text), ...list(tierData.assets ?? []).map(text), ...list(tierData.testFiles ?? []).map(text)]);
  const deleted = new Set(editList(input.edits).map(record).filter(edit => edit.op === 'remove-file').map(edit => text(edit.path)));
  const destinations = new Set([...originals].map(file => map[file] === undefined ? file : map[file] === null ? '' : text(map[file])).filter(file => file && !deleted.has(file)));
  const edits = editList(input.edits).map(record);
  for (const edit of edits) {
    if (!edit.note || !edit.change) throw new Error('Each plan edit needs a note and a change name');
    if (edit.op === 'add-file') destinations.add(text(edit.path));
  }
  const owner = (file: string) => tiers.flatMap(tier => tier.folders.map(folder => ({ ...tier, folder })))
    .sort((a, b) => b.folder.length - a.folder.length).find(entry => file.startsWith(`${entry.folder}/`));
  const folders = [row(['Tier', 'Folder', 'Purpose', 'Final files', 'Incoming moves']), row(['---:', '---', '---', '---:', '---'])];
  for (const tier of tiers) for (const folder of tier.folders) {
    const count = [...destinations].filter(file => owner(file)?.folder === folder).length;
    const incoming = Object.entries(map).filter(([from, to]) => typeof to === 'string' && owner(to)?.folder === folder && from !== to);
    const notable = incoming.filter(([from]) => !isTestPath(from)).slice(0, 4).map(([from]) => `\`${from.slice(5)}\``);
    folders.push(row([tier.tier, `\`${folder.slice(5)}/\``, tier.name, count, `${incoming.length}${notable.length ? `; ${notable.join(', ')}` : ''}`]));
  }
  const groups = new Map<string, { tier: number; ids: string[]; notes: Set<string> }>();
  edits.forEach(edit => {
    const change = text(edit.change), group = groups.get(change) ?? { tier: Infinity, ids: [], notes: new Set<string>() };
    const target = edit.op === 'add-file' ? text(edit.path) : edit.op === 'retarget' ? text(edit.newTo) : text(edit.from ?? edit.path);
    if (edit.op === 'remove-file') group.tier = 0;
    else group.tier = Math.min(group.tier, owner(target)?.tier ?? 0);
    group.ids.push(text(edit.id ?? edit.change)); group.notes.add(text(edit.note)); groups.set(change, group);
  });
  const changes = [row(['Tier', 'Change / PR', 'Edit ids', 'Required code change']), row(['---:', '---', '---', '---'])];
  for (const [name, group] of groups) {
    changes.push(row([group.tier, name, group.ids.join(', '), [...group.notes].join(' ')]));
  }
  // Identity retains the same proposed tier numbers for existing folders; loose root files are tier zero.
  const before = project({ declarations: input.declarations, moves: {}, tiers: { ...tierData,
    root: { allow: [...originals].filter(file => file.startsWith('site/') && file.split('/').length === 2) } } });
  const numbers = [row(['View', 'Before file SCCs', 'Before folder SCCs', 'Before upward', 'Before lateral', 'After file SCCs', 'After folder SCCs', 'After upward', 'After lateral']),
    row(['---', '---:', '---:', '---:', '---:', '---:', '---:', '---:', '---:'])];
  for (const [name, next] of Object.entries(after.views)) {
    const old = before.views[name]!;
    numbers.push(row([name, old.fileSccs.length, old.folderSccs.length, old.upward.length, old.lateral.length,
      next.fileSccs.length, next.folderSccs.length, next.upward.length, next.lateral.length]));
  }
  numbers.push('', `Unassigned files: before ${before.unassigned.length}; after ${after.unassigned.length}. No lateral allowances.`,
    'Identity uses the proposed numbers on existing folders and tier zero for loose root files. It applies no moves or edits.');
  return { folders: folders.join('\n'), changes: changes.join('\n'), numbers: numbers.join('\n') };
}

/** Replace only marked tables, rejecting missing or duplicated markers. */
export function updateTables(document: string, tables: Readonly<Record<string, string>>): string {
  let result = document;
  for (const [name, content] of Object.entries(tables)) {
    const start = `<!-- generated:${name} -->`, end = `<!-- /generated:${name} -->`;
    if (result.split(start).length !== 2 || result.split(end).length !== 2) throw new Error(`Missing or duplicate ${name} markers`);
    const first = result.indexOf(start) + start.length, last = result.indexOf(end);
    if (last < first) throw new Error(`Reversed ${name} markers`);
    result = `${result.slice(0, first)}\n${content}\n${result.slice(last)}`;
  }
  return result;
}

/** Fail on stale generated content; exported to mutation-test the actual throw. */
export function assertCurrent(document: string, next: string): void {
  if (document !== next) throw new Error('Site architecture tables are stale; run node .github/scripts/architecture/site-architecture.mts --write');
}
/** Planned findings warn without a deadline; enforced and strict acceptance findings throw. */
export function planFinding(status: unknown, check: () => void, policy: { actions?: boolean } = {}): void {
  if (status !== 'planned' && status !== 'enforced') throw new TypeError('status: expected planned or enforced');
  try { check(); } catch (error) {
    if (status !== 'planned') throw error;
    const message = `SITE_PLAN_WARNING: ${String(error)}. Fix: node .github/scripts/architecture/site-architecture.mts --write`;
    console.warn(message);
    if (policy.actions ?? process.env.GITHUB_ACTIONS === 'true') console.warn(`::warning file=docs/site-architecture.md::${message.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}`);
  }
}

export async function checkSiteArchitecture(root: string, options: { readonly graph?: ImportGraph; readonly write?: boolean; readonly sequence?: boolean; readonly minimality?: boolean; readonly identity?: boolean; readonly accept?: boolean; readonly references?: boolean; readonly old?: readonly string[] } = {}): Promise<void> {
  const started = performance.now();
  const read = (name: string): unknown => JSON.parse(readFileSync(resolve(root, DATA, `${name}.json`), 'utf8'));
  const moves = read('moves'), tiers = read('tiers'), edits = read('edits');
  if (options.references) {
    const inventory = references(root, { ...record(moves), ...Object.fromEntries((options.old ?? []).map(old => [old, null])) });
    if (options.old?.length) {
      const findings = liveReferences(inventory, options.old); console.log(JSON.stringify({ liveOldPaths: findings, folderAndGlobReview: coveringReferences(inventory, options.old) }, null, 2));
      if (findings.length) throw new Error(`${findings.length} live old-path references`);
    } else console.log(JSON.stringify(inventory, null, 2));
    return;
  }
  const declarations = await readImportDeclarations(root, { prefix: 'site/', graph: options.graph, checkAgainstScanner: true });
  if (declarations.summary.scanner.unexplained) throw new Error('Site declarations disagree with the production scanner');
  const known = new Set(repositoryFiles(root));
  const tierData = record(tiers);
  const validateInputs = () => {
    // Ignored generated inputs may be absent before preparation; their proposed relocations require the documented generator edits.
    for (const file of [...Object.keys(record(moves)), ...list(tierData.testFiles ?? []), ...list(tierData.assets ?? [])].map(text)) {
      if (!known.has(file) && !/^site\/(?:prepared-[^/]+|moon-labels\.prepared\.json)$/u.test(file)) throw new Error(`Unknown plan input: ${file}`);
    }
  };
  const input = { declarations, moves, tiers, edits };
  if (options.identity) {
    const roots = declarations.summary.files.filter(file => file.split('/').length === 2);
    const result = project({ declarations, moves: {}, tiers: { ...tierData, root: { allow: roots } } });
    console.log(JSON.stringify(result.views, null, 2)); return;
  }
  if (options.sequence || options.minimality) {
    validateInputs();
    const result = options.sequence ? sequence(input) : minimality(input); console.log(JSON.stringify(result, null, 2));
    if (result.failed) throw new Error('Plan proof failed'); return;
  }
  planFinding(options.accept ? 'enforced' : tierData.status, () => {
    validateInputs();
    const tables = renderTables(input);
    if (!Array.isArray(edits)) {
      const proof = sequence(input);
      tables.sequence = [row(['Phase', 'Step', 'File SCCs', 'Folder SCCs', 'Upward', 'Lateral', 'Result']), row(['---', '---', '---:', '---:', '---:', '---:', '---']),
        ...proof.steps.map(step => row([step.phase, step.step, step.fileSccs, step.folderSccs, step.phase === 'S3' ? 'n/a' : step.upward, step.phase === 'S3' ? 'n/a' : step.lateral, step.failed ? 'FAIL' : 'pass']))].join('\n');
      if (proof.failed) throw new Error('Sequence proof failed; run node .github/scripts/architecture/site-architecture.mts --sequence');
      if (minimality(input).failed) throw new Error('Minimality proof failed; run node .github/scripts/architecture/site-architecture.mts --minimality');
      const inventory = compactReferences(references(root, record(moves)));
      const stored = readFileSync(resolve(root, DATA, 'references.json'), 'utf8');
      if (!options.write) assertCurrent(stored, `${JSON.stringify(inventory, null, 2)}\n`);
      const referenceData = record(inventory);
      const counts = new Map<string, number>();
      for (const value of list(referenceData.occurrences)) { const entry = record(value); const key = `${text(entry.scope)}: ${text(entry.classification)}`; counts.set(key, (counts.get(key) ?? 0) + 1); }
      tables.references = [row(['Scope and class', 'Path/class pairs']), row(['---', '---:']), ...[...counts].sort().map(([key, count]) => row([key, count]))].join('\n');
      tables['relative-reads'] = [row(['Test with depth-sensitive reads', 'Destination']), row(['---', '---']),
        ...list(referenceData.relativeReads).map(value => { const entry = record(value); return row([text(entry.file), text(entry.destination)]); })].join('\n');
      const refPath = resolve(root, DATA, 'references.json'), expected = `${JSON.stringify(inventory, null, 2)}\n`;
      if (options.write) writeFileSync(refPath, expected);
    }
    const docPath = resolve(root, DOC), document = readFileSync(docPath, 'utf8'), next = updateTables(document, tables);
    if (options.write) {
      writeFileSync(docPath, next);
    } else assertCurrent(document, next);
    console.log(`SITE_PLAN_OK: all views clear; tables match (${((performance.now() - started) / 1000).toFixed(1)} s${options.graph ? ', shared graph' : ', including scan'}).`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    const modes = ['--write', '--sequence', '--minimality', '--identity', '--references', '--accept'];
    const mode = args[0];
    if (mode && !modes.includes(mode)) throw new Error('Usage: site-architecture.mts [--accept|--write|--sequence|--minimality|--identity|--references [--old paths...]]');
    const old = mode === '--references' && args[1] === '--old' ? args.slice(2) : [];
    if (args.length > 1 && !old.length) throw new Error('Unexpected arguments');
    await checkSiteArchitecture(resolve(import.meta.dirname, '../../..'), { write: mode === '--write', sequence: mode === '--sequence',
      minimality: mode === '--minimality', identity: mode === '--identity', references: mode === '--references', old, accept: mode === '--accept' });
  } catch (error) { console.error(error); process.exitCode = 1; }
}
