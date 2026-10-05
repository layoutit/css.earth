/** Replay ordered semantic changes and folder moves, and reject unnecessary semantic groups. */
import { project, editList, type ProjectionInput } from './projection.mts';
import { isTestPath } from './zones.mts';
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Expected object');
  return Object.fromEntries(Object.entries(value));
}
function list(value: unknown): unknown[] { if (!Array.isArray(value)) throw new TypeError('Expected array'); return value; }
function text(value: unknown): string { if (typeof value !== 'string') throw new TypeError('Expected string'); return value; }
function changes(input: ProjectionInput) {
  const data = object(input.edits); editList(data);
  return list(data.changes).map(value => { const entry = object(value); return { id: text(entry.id), ids: list(entry.edits).map(text) }; });
}
/** Removal is at the PR group boundary: imports, new modules and their users are one atomic change. */
export function minimality(input: ProjectionInput) {
  if (project(input).failed) throw new Error('Minimality requires a passing full projection');
  const edits = editList(input.edits).map(object);
  const results = changes(input).map(change => {
    try { return { change: change.id, necessary: project({ ...input, edits: edits.filter(edit => !change.ids.includes(text(edit.id))) }).failed }; }
    catch { return { change: change.id, necessary: true }; } // A missing dependency is a projection failure too.
  });
  return { failed: results.some(result => !result.necessary), results };
}
export interface SequenceStep { phase: string; step: string; fileSccs: number; folderSccs: number; upward: number; lateral: number; failed: boolean }
/** S3 keeps old file locations; S4 holds every remaining file in one temporary top-tier owner. */
export function sequence(input: ProjectionInput): { failed: boolean; steps: SequenceStep[] } {
  const tiers = object(input.tiers), moves = object(input.moves), inventory = object(input.declarations);
  const originals = [...new Set([...list(object(inventory.summary).files).map(text), ...list(tiers.assets ?? []).map(text), ...list(tiers.testFiles ?? []).map(text)])];
  const edits = editList(input.edits).map(object), added = new Set(edits.filter(edit => edit.op === 'add-file').map(edit => text(edit.path)));
  const inverse = new Map(Object.entries(moves).filter((entry): entry is [string, string] => typeof entry[1] === 'string').map(([old, final]) => [final, old]));
  const oldPath = (file: string) => added.has(file) ? `site/${file.slice(file.lastIndexOf('/') + 1)}` : inverse.get(file) ?? file;
  const translate = (edit: Record<string, unknown>) => Object.fromEntries(Object.entries(edit).map(([key, value]) => {
    if (['from', 'to', 'newTo', 'path'].includes(key)) return [key, oldPath(text(value))];
    if (key === 'imports') return [key, list(value).map(value => { const imported = object(value); return { ...imported, to: oldPath(text(imported.to)) }; })];
    return [key, value];
  }));
  const liveFolders = [...new Set(originals.filter(file => file.split('/').length > 2).map(file => file.slice(0, file.indexOf('/', 5))))];
  const finalTiers = list(tiers.tiers).map(object);
  const s3Tiers = { ...tiers, forbid: [], lateral: [], tiers: [...new Set([...liveFolders, ...finalTiers.flatMap(tier => list(tier.folders).map(text))])].map(folder => ({ tier: 0, name: folder, folders: [folder] })), root: { allow: [...originals.filter(file => file.split('/').length === 2), ...[...added].map(oldPath)] } };
  const deleted = Object.fromEntries(Object.entries(moves).filter(([, value]) => value === null));
  const baseline = project({ declarations: input.declarations, moves: deleted, tiers: s3Tiers });
  const steps: SequenceStep[] = [], active: Record<string, unknown>[] = [];
  let previous = baseline;
  const groups = changes(input);
  for (const [index, change] of groups.entries()) {
    active.push(...edits.filter(edit => change.ids.includes(text(edit.id))).map(translate));
    const result = project({ declarations: input.declarations, moves: deleted, tiers: s3Tiers, edits: active }), view = result.views.all!;
    const failed = Object.entries(result.views).some(([name, current]) => current.fileSccs.length > previous.views[name]!.fileSccs.length
      || current.folderSccs.some(cycle => !baseline.views[name]!.folderSccs.some(old => cycle.members.every(member => old.members.includes(member))))
      || (index === groups.length - 1 && current.fileSccs.length !== 0));
    steps.push({ phase: 'S3', step: change.id, fileSccs: view.fileSccs.length, folderSccs: view.folderSccs.length, upward: view.upward.length, lateral: view.lateral.length, failed });
    previous = result;
  }
  const final = project(input), finalFiles = [...new Set([...originals.map(file => moves[file] === undefined ? file : moves[file] === null ? '' : text(moves[file])), ...added])].filter(Boolean);
  const tests = new Set(originals.filter(file => isTestPath(file) || list(tiers.testFiles ?? []).includes(file)).map(file => moves[file] === undefined ? file : moves[file] === null ? '' : text(moves[file])).filter(Boolean));
  const folderOrder = finalTiers.flatMap(tier => list(tier.folders).map(folder => ({ folder: text(folder), tier: Number(tier.tier) }))).sort((a, b) => a.tier - b.tier || a.folder.localeCompare(b.folder));
  const moved = new Set<string>(), root = object(tiers.root), allow = list(root.allow).map(text);
  for (const { folder } of folderOrder) {
    moved.add(folder);
    const locate = (file: string) => (allow.includes(file) && moved.size === folderOrder.length) || [...moved].some(folder => file.startsWith(`${folder}/`)) || !file.startsWith('site/') ? file : `site/legacy/${file.slice(5)}`;
    const declarations = { declarations: final.edges.map(edge => ({ ...edge, from: locate(edge.from), to: locate(edge.to), test: tests.has(edge.from) })), summary: { files: finalFiles.map(locate) } };
    const result = project({ declarations, moves: {}, tiers: { ...tiers, assets: [], testFiles: [...tests].map(locate),
      tiers: [...finalTiers, { tier: Math.max(...folderOrder.map(item => item.tier)) + 2, name: 'Temporary remaining files', folders: ['site/legacy'] }] } });
    const view = result.views.all!;
    steps.push({ phase: 'S4', step: folder, fileSccs: view.fileSccs.length, folderSccs: view.folderSccs.length, upward: view.upward.length, lateral: view.lateral.length, failed: result.failed });
  }
  return { failed: steps.some(step => step.failed), steps };
}
