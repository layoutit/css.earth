/** Project declaration connectivity through file moves and explicit post-move graph edits.
 * Tier folders use longest-prefix ownership. Root allow entries share the tier-zero site(root) folder.
 * Lateral allowances are directed [fromFolder, toFolder] pairs. Tests are included in every view. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { stronglyConnected } from './folders.mts';
import { KINDS, type Kind } from './import-declarations.mts';
import { byText, isTestPath } from './zones.mts';

export interface Edge { readonly from: string; readonly to: string; readonly kind: Kind; readonly line?: number }
interface Tier { readonly tier: number; readonly name: string; readonly folders: string[] }
interface TierMap { readonly tiers: Tier[]; readonly root: { readonly allow: string[]; readonly entries: string[]; readonly tier: number }; readonly lateral: string[][]; readonly tests?: 'any-tier'; readonly testFiles: string[]; readonly assets: string[]; readonly status?: 'draft' | 'enforced'; readonly forbid: { from: string[]; to: string[]; reason: string }[] }
export interface ProjectionInput { readonly declarations: unknown; readonly moves: unknown; readonly tiers: unknown; readonly edits?: unknown }
function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label}: expected object`);
  return Object.fromEntries(Object.entries(value));
}
function keys(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new TypeError(`${label}: unknown key ${key}`);
}
function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.length) throw new TypeError(`${label}: expected nonempty string`);
  return value;
}
function path(value: unknown, label: string): string {
  const text = string(value, label);
  if (text.startsWith('/') || text.includes('\\') || text.split('/').some(part => !part || part === '.' || part === '..')) throw new TypeError(`${label}: expected repository-relative path`);
  return text;
}
function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new TypeError(`${label}: expected array`);
  return value;
}
function kind(value: unknown): Kind {
  for (const candidate of KINDS) if (candidate === value) return candidate;
  throw new TypeError(`Unknown import kind: ${String(value)}`);
}
function tierMap(value: unknown): TierMap {
  const map = record(value, 'tiers'); keys(map, ['tiers', 'root', 'lateral', 'tests', 'testFiles', 'assets', 'status', 'forbid', 'draftUntil', 'warningCeiling'], 'tiers');
  if (map.status !== undefined && map.status !== 'draft' && map.status !== 'enforced') throw new TypeError('status: expected draft or enforced');
  if (map.draftUntil !== undefined && (typeof map.draftUntil !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(map.draftUntil)
    || !Number.isFinite(Date.parse(map.draftUntil)) || new Date(map.draftUntil).toISOString().slice(0, 10) !== map.draftUntil)) throw new TypeError('draftUntil: expected ISO date');
  if (map.warningCeiling !== undefined && (typeof map.warningCeiling !== 'number' || !Number.isSafeInteger(map.warningCeiling) || map.warningCeiling < 0)) throw new TypeError('warningCeiling: expected nonnegative integer');
  if (map.status === 'draft' && (map.draftUntil === undefined || map.warningCeiling === undefined)) throw new TypeError('draft requires draftUntil and warningCeiling');
  const forbid = array(map.forbid ?? [], 'forbid').map(value => {
    const rule = record(value, 'forbid'); keys(rule, ['from', 'to', 'reason'], 'forbid');
    return { from: array(rule.from, 'forbid.from').map(value => path(value, 'folder')), to: array(rule.to, 'forbid.to').map(value => path(value, 'folder')), reason: string(rule.reason, 'forbid.reason') };
  });
  const tiers = array(map.tiers, 'tiers.tiers').map(value => {
    const item = record(value, 'tier'); keys(item, ['tier', 'name', 'folders'], 'tier');
    if (typeof item.tier !== 'number' || !Number.isSafeInteger(item.tier) || item.tier < 0) throw new TypeError('tier: expected nonnegative integer');
    return { tier: item.tier, name: string(item.name, 'tier.name'), folders: array(item.folders, 'tier.folders').map(value => path(value, 'folder')) };
  });
  const folders = tiers.flatMap(tier => tier.folders);
  if (new Set(folders).size !== folders.length) throw new TypeError('Duplicate tier folder');
  for (const rule of forbid) if (!rule.from.length || !rule.to.length || [...rule.from, ...rule.to].some(folder => !folders.includes(folder))) throw new TypeError('forbid: expected nonempty lists of declared folders');
  const root = record(map.root, 'root'); keys(root, ['allow', 'entries', 'tier'], 'root');
  const entries = root.entries === undefined ? [] : array(root.entries, 'root.entries').map(value => path(value, 'root.entry'));
  const rootTier = root.tier ?? 0;
  if (typeof rootTier !== 'number' || !Number.isSafeInteger(rootTier) || rootTier < 0) throw new TypeError('root.tier: expected nonnegative integer');
  if (map.tests !== undefined && map.tests !== 'any-tier') throw new TypeError('tests: expected any-tier');
  const assets = map.assets === undefined ? [] : array(map.assets, 'assets').map(value => path(value, 'asset'));
  const testFiles = map.testFiles === undefined ? [] : array(map.testFiles, 'testFiles').map(value => path(value, 'test file'));
  const allow = array(root.allow, 'root.allow').map(value => path(value, 'root.allow'));
  const lateral = map.lateral === undefined ? [] : array(map.lateral, 'lateral').map(value => {
    const pair = array(value, 'lateral pair').map(value => path(value, 'lateral folder'));
    if (pair.length !== 2 || !pair.every(folder => folders.includes(folder))) throw new TypeError('lateral: expected two listed folders');
    if (tiers.find(tier => tier.folders.includes(pair[0]!))?.tier !== tiers.find(tier => tier.folders.includes(pair[1]!))?.tier) throw new TypeError('lateral folders must share a tier');
    return pair;
  });
  if (!entries.every(file => allow.includes(file))) throw new TypeError('root.entries must be allowed');
  return { tiers, forbid, ...(map.status === undefined ? {} : { status: map.status }), root: { allow, entries, tier: rootTier }, lateral, assets, ...(map.tests === 'any-tier' ? { tests: map.tests } : {}), testFiles };
}

/** Validate the inventory envelope and each declaration, rather than trusting JSON type assertions. */
function inventory(value: unknown): { edges: Edge[]; files: Set<string>; tests: Set<string> } {
  const input = record(value, 'declarations'); keys(input, ['base', 'declarations', 'pairs', 'summary'], 'declarations');
  if (input.base !== undefined) string(input.base, 'base');
  if (input.pairs !== undefined) array(input.pairs, 'pairs'); // Derived cache is never a connectivity source.
  const files = new Set<string>();
  if (input.summary !== undefined) {
    const summary = record(input.summary, 'summary');
    keys(summary, ['files', 'declarations', 'filePairs', 'unresolved', 'folderPairs', 'scanner'], 'summary');
    if (summary.files !== undefined) for (const value of array(summary.files, 'summary.files')) files.add(path(value, 'file'));
  }
  const tests = new Set<string>();
  const edges: Edge[] = [];
  for (const value of array(input.declarations, 'declarations')) {
    const entry = record(value, 'declaration');
    keys(entry, ['from', 'to', 'line', 'specifier', 'kind', 'symbols', 'form', 'sideEffectOnly', 'test', 'unresolved'], 'declaration');
    const from = path(entry.from, 'from'); files.add(from);
    if (entry.test === true) tests.add(from);
    const importKind = kind(entry.kind);
    if (entry.line !== undefined && (typeof entry.line !== 'number' || !Number.isSafeInteger(entry.line) || entry.line < 1)) throw new TypeError('line: expected positive integer');
    for (const key of ['test', 'sideEffectOnly', 'unresolved']) if (entry[key] !== undefined && typeof entry[key] !== 'boolean') throw new TypeError(`${key}: expected boolean`);
    for (const key of ['specifier', 'form']) if (entry[key] !== undefined) string(entry[key], key);
    if (entry.symbols !== undefined) for (const symbol of array(entry.symbols, 'symbols')) string(symbol, 'symbol');
    if (entry.to === null) continue;
    const to = string(entry.to, 'to');
    // URLs and package identifiers are external; repository paths in site remain nodes.
    if (to.startsWith('site/')) { path(to, 'to'); files.add(to); }
    edges.push({ from, to, kind: importKind, ...(typeof entry.line === 'number' ? { line: entry.line } : {}) });
  }
  return { edges, files, tests };
}

/** Accept legacy test inputs and validate the ordered plan envelope. */
export function editList(value: unknown): unknown[] {
  if (value === undefined) return [];
  if (Array.isArray(value)) return value;
  const data = record(value, 'edits'); keys(data, ['edits', 'changes'], 'edits');
  const edits = array(data.edits, 'edits.edits');
  const ids = edits.map(value => {
    const edit = record(value, 'edit');
    if (edit.op === 'add-file') array(edit.imports, 'add-file.imports');
    return string(edit.id, 'id');
  });
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate edit id');
  const used: string[] = [];
  for (const value of array(data.changes, 'changes')) {
    const change = record(value, 'change'); keys(change, ['id', 'edits'], 'change');
    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u.test(string(change.id, 'change.id'))) throw new Error('change.id: expected kebab string');
    for (const id of array(change.edits, 'change.edits').map(value => string(value, 'edit id'))) {
      if (!ids.includes(id)) throw new Error(`Unknown change edit: ${id}`); used.push(id);
    }
  }
  if (used.length !== ids.length || new Set(used).size !== ids.length) throw new Error('Changes must partition edits');
  return edits;
}

const under = (file: string, folder: string) => file.startsWith(`${folder}/`);
const sortEdges = (a: Edge, b: Edge) => byText(a.from, b.from) || byText(a.to, b.to) || byText(a.kind, b.kind) || (a.line ?? 0) - (b.line ?? 0);
const VIEW_KINDS: Readonly<Record<string, readonly Kind[]>> = {
  value: ['value'], 'value+lazy': ['value', 'lazy'], 'value+lazy+type': ['value', 'lazy', 'type'], all: KINDS,
};
export function project(input: ProjectionInput) {
  const tiers = tierMap(input.tiers), original = inventory(input.declarations);
  for (const file of [...tiers.testFiles, ...tiers.assets]) original.files.add(file);
  const moves = record(input.moves, 'moves'), destinations = new Set<string>();
  for (const [from, value] of Object.entries(moves)) {
    path(from, 'move source');
    if (!original.files.has(from)) throw new Error(`Move source is not an inventory file: ${from} (folder moves are not allowed)`);
    if (value !== null) {
      const target = path(value, 'move target');
      if (destinations.has(target)) throw new Error(`Move collision: ${target}`);
      destinations.add(target);
    }
  }
  const moved = (file: string): string | null => {
    const value = moves[file];
    return value === undefined ? file : value === null ? null : path(value, 'move target');
  };
  const testFiles = new Set([...original.files].filter(file => isTestPath(file) || original.tests.has(file) || tiers.testFiles.includes(file)).map(file => moved(file)).filter((file): file is string => file !== null));
  for (const file of tiers.testFiles) testFiles.add(file);
  const files = new Set<string>();
  for (const file of original.files) {
    const target = moved(file);
    if (target !== null) { if (files.has(target)) throw new Error(`Move collision: ${target}`); files.add(target); }
  }
  let edges: Edge[] = [];
  for (const edge of original.edges) {
    const from = moved(edge.from), to = moved(edge.to);
    if (from !== null && to !== null) edges.push({ ...edge, from, to });
  }
  for (const value of editList(input.edits)) {
    const edit = record(value, 'edit'), op = string(edit.op, 'op');
    const fileOp = op === 'add-file' || op === 'remove-file';
    keys(edit, ['id', 'line', ...(fileOp ? ['op', 'path', 'note', 'change', 'imports'] : op === 'retarget' ? ['op', 'from', 'to', 'newTo', 'kind', 'note', 'change'] : ['op', 'from', 'to', 'kind', 'note', 'change'])], 'edit');
    if (edit.id !== undefined && !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u.test(string(edit.id, 'id'))) throw new TypeError('id: expected kebab string');
    if (edit.line !== undefined && (typeof edit.line !== 'number' || !Number.isSafeInteger(edit.line) || edit.line < 1)) throw new TypeError('edit.line: expected positive integer');
    if (edit.note !== undefined) string(edit.note, 'note');
    if (edit.change !== undefined) string(edit.change, 'change');
    if (fileOp) {
      const file = path(edit.path, 'edit.path');
      if (op === 'add-file') { if (files.has(file)) throw new Error(`add-file already exists: ${file}`); files.add(file);
        for (const value of array(edit.imports ?? [], 'imports')) {
          const imported = record(value, 'import'); keys(imported, ['to', 'kind'], 'import');
          edges.push({ from: file, to: path(imported.to, 'import.to'), kind: kind(imported.kind) });
        }
      }
      else { if (!files.delete(file)) throw new Error(`remove-file did not match: ${file}`); edges = edges.filter(edge => edge.from !== file && edge.to !== file); }
      continue;
    }
    if (!['remove-import', 'add-import', 'retarget'].includes(op)) throw new TypeError(`Unknown edit op: ${op}`);
    const from = path(edit.from, 'edit.from'), to = string(edit.to, 'edit.to'), importKind = edit.kind === undefined ? undefined : kind(edit.kind);
    if (!files.has(from)) throw new Error(`Edit source file does not exist: ${from}`);
    const checkTarget = (target: string): void => { if (target.startsWith('site/') && !files.has(target)) throw new Error(`Edit target file does not exist: ${target}`); };
    if (op === 'add-import') {
      if (importKind === undefined) throw new TypeError('add-import requires kind');
      checkTarget(to);
      if (edges.some(edge => edge.from === from && edge.to === to && edge.kind === importKind)) throw new Error(`add-import already exists: ${from} -> ${to}`);
      edges.push({ from, to, kind: importKind });
    } else {
      const matches = (edge: Edge) => edge.from === from && edge.to === to && (importKind === undefined || edge.kind === importKind) && (edit.line === undefined || edge.line === edit.line);
      if (!edges.some(matches)) throw new Error(`${op} did not match: ${from} -> ${to}`);
      if (op === 'remove-import') edges = edges.filter(edge => !matches(edge));
      else { const newTo = string(edit.newTo, 'newTo'); checkTarget(newTo); edges = edges.map(edge => matches(edge) ? { ...edge, to: newTo } : edge); }
    }
  }
  for (const edge of edges) if (edge.to.startsWith('site/') && !files.has(edge.to)) throw new Error(`Edit target file does not exist: ${edge.to}`);
  edges.sort(sortEdges);
  const folders = tiers.tiers.flatMap(tier => tier.folders.map(folder => ({ folder, tier: tier.tier }))).sort((a, b) => b.folder.length - a.folder.length || byText(a.folder, b.folder));
  const owner = (file: string) => folders.find(item => under(file, item.folder)) ?? (tiers.root.allow.includes(file) ? { folder: tiers.root.entries.includes(file) ? 'site(entry)' : 'site(root)', tier: tiers.root.entries.includes(file) ? tiers.root.tier : 0 } : undefined);
  const domain = (file: string) => file.startsWith('site/') || folders.some(item => under(file, item.folder)) || tiers.root.allow.includes(file);
  const unassigned = [...files].filter(file => domain(file) && !owner(file)).sort(byText);
  const assigned = [...files].filter(file => owner(file)).sort(byText);
  const inside = edges.filter(edge => owner(edge.from) && owner(edge.to));
  const ignored = edges.length - inside.length;
  const forbidden = inside.filter(edge => !(tiers.tests === 'any-tier' && testFiles.has(edge.from)) && tiers.forbid.some(rule => rule.from.some(folder => under(edge.from, folder)) && rule.to.some(folder => under(edge.to, folder))));
  const productionImportsTests = edges.filter(edge => !testFiles.has(edge.from) && (testFiles.has(edge.to) || isTestPath(edge.to)));
  // Leaf consumers get separate folder nodes: colocated test imports must not imply production folder dependencies.
  const folderOf = (file: string) => `${owner(file)!.folder}${tiers.tests === 'any-tier' && testFiles.has(file) ? ` (test: ${file})` : ''}`;
  const cycles = (nodes: string[], links: { from: string; to: string }[], source: Edge[], folder = false) =>
    stronglyConnected(nodes, links).filter(component => component.length > 1 || (!folder && links.some(edge => edge.from === component[0] && edge.to === component[0]))).sort((a, b) => b.length - a.length || byText(a[0]!, b[0]!))
      .map(members => ({ members, edges: source.filter(edge => members.includes(folder ? folderOf(edge.from) : edge.from) && members.includes(folder ? folderOf(edge.to) : edge.to)) }));
  const views = Object.fromEntries(Object.entries(VIEW_KINDS).map(([name, kinds]) => {
    const selected = inside.filter(edge => kinds.includes(edge.kind));
    const upward = selected.filter(edge => !(tiers.tests === 'any-tier' && testFiles.has(edge.from)) && owner(edge.to)!.tier > owner(edge.from)!.tier);
    const lateral = selected.filter(edge => {
      if (tiers.tests === 'any-tier' && testFiles.has(edge.from)) return false;
      const from = owner(edge.from)!, to = owner(edge.to)!;
      return from.tier === to.tier && from.folder !== to.folder && !tiers.lateral.some(pair => pair[0] === from.folder && pair[1] === to.folder);
    });
    return [name, { fileSccs: cycles(assigned, selected, selected), folderSccs: cycles([...new Set(assigned.map(file => folderOf(file)))].sort(byText),
      selected.map(edge => ({ from: folderOf(edge.from), to: folderOf(edge.to) })), selected, true), upward, lateral }];
  }));
  const counts = [...new Set(assigned.map(file => owner(file)!.folder))].sort(byText).map(folder => ({ folder,
    in: inside.filter(edge => owner(edge.to)!.folder === folder && owner(edge.from)!.folder !== folder).length,
    out: inside.filter(edge => owner(edge.from)!.folder === folder && owner(edge.to)!.folder !== folder).length }));
  const failed = forbidden.length > 0 || productionImportsTests.length > 0 || unassigned.length > 0 || Object.values(views).some(view => view.fileSccs.length > 0 || view.folderSccs.length > 0 || view.upward.length > 0 || view.lateral.length > 0);
  return { failed, edges, forbidden, unassigned, productionImportsTests, views, folderCounts: counts, worstOffenders: [...counts].sort((a, b) => b.out + b.in - a.out - a.in || byText(a.folder, b.folder)).slice(0, 10),
    summary: { files: files.size, declarations: edges.length, internalDeclarations: inside.length, ignoredDeclarations: ignored } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2), options = new Map<string, string>();
    for (let i = 0; i < args.length; i += 2) {
      const key = args[i], value = args[i + 1];
      if (!key || !['--declarations', '--moves', '--tiers', '--edits', '--json'].includes(key) || !value || options.has(key)) throw new Error(`Unknown or incomplete argument: ${key}`);
      options.set(key, value);
    }
    const read = (key: string): unknown => { const file = options.get(key); if (!file) throw new Error(`Missing ${key}`); return JSON.parse(readFileSync(file, 'utf8')); };
    const result = project({ declarations: read('--declarations'), moves: read('--moves'), tiers: read('--tiers'), ...(options.has('--edits') ? { edits: read('--edits') } : {}) });
    for (const [name, view] of Object.entries(result.views)) console.error(`${name}: ${view.fileSccs.length} file SCCs, ${view.folderSccs.length} folder SCCs, ${view.upward.length} upward, ${view.lateral.length} lateral`);
    console.error(`Unassigned: ${result.unassigned.length}; ignored declarations: ${result.summary.ignoredDeclarations}`);
    console.error('Folder in/out:', result.folderCounts); console.error('Worst offenders:', result.worstOffenders);
    const json = `${JSON.stringify(result, null, 2)}\n`, out = options.get('--json');
    if (out) { mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, json); } else console.log(json);
    if (result.failed) process.exitCode = 1;
  } catch (error) { console.error(error); process.exitCode = 1; }
}
