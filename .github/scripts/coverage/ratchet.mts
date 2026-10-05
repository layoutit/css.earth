/** Coverage floors: monotone updates, checked summaries, and explicit path identity changes. */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const checkoutRoot = fileURLToPath(new URL('../../../', import.meta.url));
const metrics = ['lines', 'branches', 'functions'] as const;
type Metric = typeof metrics[number];
export type Percentages = Record<Metric, number>;
type Counts = { hit: number; total: number; pct: number };
export type Summary = { version: 1; qualified: boolean; scopeId: string; scope: string[]; files: { file: string; exempt: boolean; loaded: boolean; lines: Counts; branches: Counts; functions: Counts }[]; aggregate: Record<Metric, Counts> };
export type Floors = { version: 1; scope: { id: string; files: string[] }; aggregate: Percentages; files: Record<string, Percentages>; moves?: Record<string, string>; retired?: Record<string, string> };

function object(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return Object.fromEntries(Object.entries(value));
}
function path(value: unknown): string {
  if (typeof value !== 'string' || !value || value.startsWith('/') || value.includes('\\') || value.split('/').some(p => p === '..' || p === '.' || !p)) throw new Error('Expected a repository-relative path');
  return value;
}
function percentage(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) throw new Error('Expected a percentage from 0 to 100');
  return value;
}
function percentages(value: unknown): Percentages {
  const v = object(value, 'percentages');
  return { lines: percentage(v.lines), branches: percentage(v.branches), functions: percentage(v.functions) };
}
function counts(value: unknown): Counts {
  const v = object(value, 'counts');
  if (typeof v.hit !== 'number' || typeof v.total !== 'number' || !Number.isSafeInteger(v.hit) || !Number.isSafeInteger(v.total) || v.hit < 0 || v.total < v.hit) throw new Error('Invalid coverage counts');
  const pct = percentage(v.pct);
  const exact = v.total ? 100 * v.hit / v.total : 100;
  if (Math.abs(pct - exact) > 0.11) throw new Error('Percentage disagrees with coverage counts');
  return { hit: v.hit, total: v.total, pct: exact };
}
export function parseSummary(value: unknown): Summary {
  const v = object(value, 'summary');
  if (v.version !== 1 || !Array.isArray(v.scope) || !Array.isArray(v.files)) throw new Error('Invalid summary version, scope, or files');
  if (typeof v.scopeId !== "string" || !v.scopeId.trim()) throw new Error("Missing scope id");
  const scope = v.scope.map(path);
  const files = v.files.map((f: unknown) => {
    const item = object(f, 'file');
    if (typeof item.exempt !== 'boolean' || typeof item.loaded !== 'boolean') throw new Error('File flags must be boolean');
    return { file: path(item.file), exempt: item.exempt, loaded: item.loaded, lines: counts(item.lines), branches: counts(item.branches), functions: counts(item.functions) };
  });
  if (new Set(files.map(f => f.file)).size !== files.length) throw new Error('Duplicate summary file');
  if (new Set(scope).size !== scope.length || scope.length !== files.length || scope.some(file => !files.some(row => row.file === file))) throw new Error('Scope must contain exactly the summary files, without duplicates');
  const aggregate = object(v.aggregate, 'aggregate');
  const result: Summary = { version: 1, qualified: v.qualified === true, scopeId: v.scopeId, scope, files, aggregate: { lines: counts(aggregate.lines), branches: counts(aggregate.branches), functions: counts(aggregate.functions) } };
  for (const metric of metrics) {
    const eligible = files.filter(file => !file.exempt);
    const hit = eligible.reduce((total, file) => total + file[metric].hit, 0);
    const total = eligible.reduce((sum, file) => sum + file[metric].total, 0);
    if (result.aggregate[metric].hit !== hit || result.aggregate[metric].total !== total) throw new Error(`Aggregate ${metric} must sum the nonexempt files`);
  }
  return result;
}
export function parseMap(value: unknown, reasons = false): Record<string, string> {
  return Object.fromEntries(Object.entries(object(value, 'map')).map(([key, val]) => {
    path(key);
    if (reasons) {
      if (typeof val !== 'string' || !/^(deleted|moved|merged-into:.+|exempt:.+)$/.test(val)) throw new Error('Invalid retirement reason');
      if (val.startsWith('merged-into:')) path(val.slice(12));
      if (val.startsWith('exempt:') && !val.slice(7).trim()) throw new Error('Invalid retirement reason');
      return [key, val];
    }
    return [key, path(val)];
  }));
}
export function parseFloors(value: unknown): Floors {
  const v = object(value, 'floors');
  if (v.version !== 1) throw new Error('Invalid floors version');
  const files = Object.fromEntries(Object.entries(object(v.files, 'files')).map(([key, val]) => [path(key), percentages(val)]));
  const scope = object(v.scope, 'scope');
  if (typeof scope.id !== 'string' || !scope.id.trim() || !Array.isArray(scope.files)) throw new Error('Invalid stored scope');
  const scopeFiles = scope.files.map(path);
  if (new Set(scopeFiles).size !== scopeFiles.length) throw new Error('Duplicate stored scope file');
  const floors: Floors = { version: 1, scope: { id: scope.id, files: scopeFiles }, aggregate: percentages(v.aggregate), files };
  if (v.moves !== undefined) floors.moves = parseMap(v.moves);
  if (v.retired !== undefined) floors.retired = parseMap(v.retired, true);
  validateIdentity(floors);
  return floors;
}
function validateIdentity(floors: Floors): void {
  const destinations = new Set<string>();
  for (const [old, destination] of Object.entries(floors.moves ?? {})) {
    if (floors.files[old] || floors.retired?.[old] || old === destination || destinations.has(destination)) throw new Error(`Invalid move identity: ${old}`);
    destinations.add(destination);
    terminal(old, floors);
  }
  for (const retired of Object.keys(floors.retired ?? {})) if (floors.files[retired]) throw new Error(`Active file is retired: ${retired}`);
}
function terminal(file: string, floors: Floors): string {
  const visited = new Set<string>();
  for (let steps = 0; floors.moves?.[file]; steps++) {
    if (steps > Object.keys(floors.moves).length) throw new Error("Move cycle");
    if (visited.has(file)) throw new Error('Move cycle');
    visited.add(file);
    file = floors.moves[file];
  }
  if (!floors.files[file] && !floors.retired?.[file]) throw new Error(`Move destination is absent: ${file}`);
  return file;
}
export function checkSummary(summary: Summary, floors: Floors): string[] {
  const failures: string[] = [];
  if (!summary.qualified) failures.push('Unqualified coverage run');
  for (const metric of metrics) if (summary.aggregate[metric].pct + 1e-9 < floors.aggregate[metric]) failures.push(`aggregate ${metric}: ${summary.aggregate[metric].pct} < ${floors.aggregate[metric]}`);
  if (summary.scopeId !== floors.scope.id || JSON.stringify([...summary.scope].sort()) !== JSON.stringify([...floors.scope.files].sort())) failures.push('Stored scope differs from summary scope');
  for (const file of summary.scope) if (floors.retired?.[file]) failures.push(`Retired path still in scope: ${file}`);
  for (const file of summary.files) if (!file.exempt && !floors.files[file.file]) failures.push(`Missing floor for scope file: ${file.file}`);
  const files = new Map(summary.files.map(f => [f.file, f]));
  for (const [file, floor] of Object.entries(floors.files)) {
    const actual = files.get(file);
    if (!actual || actual.exempt) { failures.push(`Missing or newly exempt ratcheted file: ${file}`); continue; }
    for (const metric of metrics) if (actual[metric].pct + 1e-9 < floor[metric]) failures.push(`${file} ${metric}: ${actual[metric].pct} < ${floor[metric]}`);
  }
  return failures;
}
function down(value: number): number { return Math.floor((value + 1e-10) * 10) / 10; }
function measured(value: Record<Metric, Counts>): Percentages { return { lines: down(value.lines.pct), branches: down(value.branches.pct), functions: down(value.functions.pct) }; }
function raise(old: Percentages, next: Percentages): Percentages { return { lines: Math.max(old.lines, next.lines), branches: Math.max(old.branches, next.branches), functions: Math.max(old.functions, next.functions) }; }
export function updateFloors(summary: Summary, old?: Floors, moves: Record<string, string> = {}, retired: Record<string, string> = {}): Floors {
  if (!summary.qualified) throw new Error('Floors require qualified passing runs');
  const next: Floors = { version: 1, scope: { id: summary.scopeId, files: summary.scope }, aggregate: measured(summary.aggregate), files: {}, moves: { ...old?.moves, ...moves }, retired: { ...old?.retired, ...retired } };
  if (old) next.aggregate = raise(old.aggregate, next.aggregate);
  for (const file of summary.files) if (!file.exempt) next.files[file.file] = measured(file);
  for (const [file, floor] of Object.entries(old?.files ?? {})) {
    if (next.files[file]) next.files[file] = raise(floor, next.files[file]);
    else if (moves[file]) {
      const destination = moves[file];
      if (!next.files[destination]) throw new Error(`Move destination is absent: ${destination}`);
      next.files[destination] = raise(floor, next.files[destination]);
    } else if (!retired[file]) throw new Error(`Disappeared file needs a move or retirement: ${file}`);
  }
  for (const file of Object.keys(moves)) if (!old?.files[file]) throw new Error(`Move must identify an existing file: ${file}`);
  for (const file of Object.keys(retired)) if (!old?.files[file]) throw new Error(`Retirement must identify an existing file: ${file}`);
  parseMap(next.retired ?? {}, true);
  validateIdentity(next);
  if (Object.keys(next.retired ?? {}).some(file => summary.scope.includes(file))) throw new Error("Retired path still in scope");
  if (old) {
    const failures = compareFloors(old, next, new Set(summary.scope));
    if (failures.length) throw new Error(failures.join('\n'));
  }
  return next;
}
export function compareFloors(base: Floors, next: Floors, headFiles: Set<string> = new Set(execFileSync('git', ['ls-files'], { cwd: checkoutRoot, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim().split('\n'))): string[] {
  const failures: string[] = [];
  for (const [file, reason] of Object.entries(next.retired ?? {})) {
    if (!base.retired?.[file] && headFiles?.has(file)) failures.push(`Retired path exists at head: ${file}`);
    if (reason.startsWith('merged-into:') && headFiles && !headFiles.has(reason.slice(12))) failures.push(`Merge target absent at head: ${file}`);
  }
  for (const [file] of Object.entries(next.moves ?? {})) if (!base.moves?.[file] && headFiles) {
    if (headFiles.has(file)) failures.push(`Moved path exists at head: ${file}`);
    if (!headFiles.has(terminal(file, next))) failures.push(`Move target absent at head: ${file}`);
  }
  for (const metric of metrics) if (next.aggregate[metric] < base.aggregate[metric]) failures.push(`Lowered aggregate ${metric}`);
  for (const [file, floor] of Object.entries(base.files)) {
    let destination = file;
    if (!next.files[file]) {
      if (next.retired?.[file]) continue;
      if (!next.moves?.[file]) { failures.push(`Deleted floor: ${file}`); continue; }
      destination = terminal(file, next);
      if (next.retired?.[destination]) continue;
    }
    const actual = next.files[destination];
    if (actual) for (const metric of metrics) if (actual[metric] < floor[metric]) failures.push(`Lowered ${file} ${metric}`);
  }
  for (const [file, destination] of Object.entries(base.moves ?? {})) if (next.moves?.[file] !== destination) failures.push(`Changed move history: ${file}`);
  for (const [file, reason] of Object.entries(base.retired ?? {})) if (next.retired?.[file] !== reason) failures.push(`Changed retirement history: ${file}`);
  return failures;
}
/** Seed or raise from repeated qualified runs, taking the minimum independently for every metric. */
export function minimumFloors(summaries: Summary[], old?: Floors, moves: Record<string,string> = {}, retired: Record<string,string> = {}): Floors {
  if (summaries.length < 3) throw new Error('At least three qualified runs required');
  const first = summaries[0]!;
  if (summaries.some(s => s.scopeId !== first.scopeId || JSON.stringify([...s.scope].sort()) !== JSON.stringify([...first.scope].sort()))) throw new Error('Repeated scopes differ');
  const candidates = summaries.map(s=>updateFloors(s,old,moves,retired));
  const next = candidates[0]!;
  for (const metric of metrics) {
    next.aggregate[metric] = Math.min(...candidates.map(c=>c.aggregate[metric]));
    for (const file of Object.keys(next.files)) next.files[file]![metric] = Math.min(...candidates.map(c=>c.files[file]![metric]));
  }
  return next;
}
async function readJson(file: string): Promise<unknown> { return JSON.parse(await readFile(file, 'utf8')); }
export function readBaseFloors(base: string, floorFile: string): Floors | undefined {
  if (base.startsWith('-') || !/^[\w./-]+$/.test(base)) throw new Error('Invalid base ref');
  const file = path(floorFile);
  // A valid commit with no floors file is the initial introduction, not a lowered floor.
  // Resolve the ref independently so an invalid ref cannot masquerade as an absent file.
  execFileSync('git', ['rev-parse', '--verify', `${base}^{commit}`], { cwd: checkoutRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const entry = execFileSync('git', ['ls-tree', '--name-only', base, '--', file], { cwd: checkoutRoot, encoding: 'utf8' }).trim();
  if (!entry) return undefined;
  return parseFloors(JSON.parse(execFileSync('git', ['show', `${base}:${file}`], { cwd: checkoutRoot, encoding: 'utf8' })));
}
export async function main(args: string[]): Promise<void> {
  const options = new Map<string, string>();
  const allowed = new Set(['--check', '--update', '--floors', '--move-map', '--retired', '--base']);
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]; const value = args[i + 1];
    if (!key || !allowed.has(key) || !value || value.startsWith('--') || options.has(key)) throw new Error('Invalid arguments');
    options.set(key, value);
  }
  if (options.has('--check') && options.has('--update')) throw new Error('Choose check or update');
  if (!options.has('--update') && (options.has('--move-map') || options.has('--retired'))) throw new Error('Identity changes require update');
  const floorFile = options.get('--floors') ?? '.github/coverage-ratchet.json';
  let floors: Floors | undefined;
  try { floors = parseFloors(await readJson(resolve(checkoutRoot,floorFile))); } catch (error) {
    if (!(options.has('--update') && error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
  }
  const update = options.get('--update');
  if (update) {
    const moves = options.get('--move-map'); const retired = options.get('--retired');
    const value = await readJson(resolve(checkoutRoot,update));
    const moveEntries = moves ? parseMap(await readJson(resolve(checkoutRoot,moves))) : {}, retireEntries = retired ? parseMap(await readJson(resolve(checkoutRoot,retired)), true) : {};
    floors = Array.isArray(value) ? minimumFloors(value.map(parseSummary), floors, moveEntries, retireEntries) : updateFloors(parseSummary(value), floors, moveEntries, retireEntries);
  }
  if (!floors) throw new Error('Floors unavailable');
  const failures: string[] = [];
  const check = options.get('--check');
  if (check) failures.push(...checkSummary(parseSummary(await readJson(resolve(checkoutRoot,check))), floors));
  const base = options.get('--base');
  if (base) {
    const baseline = readBaseFloors(base, floorFile);
    const headFiles = new Set(execFileSync('git', ['ls-files'], { cwd: checkoutRoot, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim().split('\n'));
    if (baseline) failures.push(...compareFloors(baseline, floors, headFiles));
    else if (Object.keys(floors.retired ?? {}).length || Object.keys(floors.moves ?? {}).length) throw new Error('Initial floors cannot introduce identity history');
  }
  if (!update && !check && !base) throw new Error('Expected --check, --update, or --base');
  if (failures.length) throw new Error(failures.join('\n'));
  if (update) await writeFile(resolve(checkoutRoot,floorFile), `${JSON.stringify(floors, null, 2)}\n`);
  console.log(update ? `Coverage floors updated: ${floorFile}` : 'Coverage ratchet passed');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main(process.argv.slice(2)).catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
