/** Compare validated observations and decoded PNG pixels, without dropping order, duplicates or transient writes. */
import { readdir, readFile, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import pixelmatch from 'pixelmatch';
import { canonicalTrace, differenceHistogram } from './canonical.mts';
import { decodePng } from './png.mts';
import { families, parseTrace, type Family, type Json, type Trace } from './trace.mts';

export interface Difference { journey: string; profile: string; family: Family | 'trace'; path: string; base: Json; head: Json; subject?: Json; count?: number }
interface ValueDifference { path: string; base: Json; head: Json }

/** First differing JSON leaf; object key order is immaterial, array order and repeated values are exact. */
export function firstDifference(base: Json, head: Json, path = '$'): ValueDifference | null {
  if (base === head) return null;
  if (base === null || head === null || typeof base !== 'object' || typeof head !== 'object') return { path, base, head };
  if (Array.isArray(base) && Array.isArray(head)) {
    for (let index = 0; index < Math.min(base.length, head.length); index++) {
      const result = firstDifference(base[index]!, head[index]!, `${path}[${index}]`);
      if (result) return result;
    }
    return base.length === head.length ? null : { path: `${path}.length`, base: base.length, head: head.length };
  }
  if (Array.isArray(base) || Array.isArray(head)) return { path, base, head };
  for (const key of [...new Set([...Object.keys(base), ...Object.keys(head)])].sort()) {
    const field = `${path}[${JSON.stringify(key)}]`;
    if (!Object.hasOwn(base, key)) return { path: `${field} (missing in base)`, base: null, head: head[key]! };
    if (!Object.hasOwn(head, key)) return { path: `${field} (missing in head)`, base: base[key]!, head: null };
    const result = firstDifference(base[key]!, head[key]!, field);
    if (result) return result;
  }
  return null;
}
export function compareTraces(base: Trace, head: Trace): Difference[] {
  if (base.journey !== head.journey || base.profile !== head.profile) throw new Error('Cannot compare different journey/profile identities');
  if (firstDifference(base.toolchain, head.toolchain)) throw new Error(`${base.journey}/${base.profile}: toolchain/profile settings differ; record on the same toolchain`);
  base = canonicalTrace(base, true); head = canonicalTrace(head, true);
  const differences: Difference[] = [];
  const add = (family: Difference['family'], result: ValueDifference | null) => {
    if (result) differences.push({ journey: base.journey, profile: base.profile, family, ...result });
  };
  add('trace', firstDifference(base.knownVariations ?? [], head.knownVariations ?? [], '$.knownVariations'));
  add('trace', firstDifference(base.volatile ?? [], head.volatile ?? [], '$.volatile'));
  add('trace', firstDifference(base.combinations ?? [], head.combinations ?? [], '$.combinations'));
  add('trace', firstDifference(base.observed ?? [], head.observed ?? [], '$.observed'));
  add('trace', firstDifference(base.exercises, head.exercises, '$.exercises'));
  for (const family of families) {
    // Conversion constructs JSON from typed records, with no unchecked cast.
    const rows = (trace: Trace): Json => trace.observations[family].map(row => ({ sequence: row.sequence, step: row.step, data: row.data,
      ...(row.screenshot === undefined ? {} : { screenshot: row.screenshot }) }));
    const result = firstDifference(rows(base), rows(head), `$.observations.${family}`);
    add(family, result);
    if (result) {
      const difference = differences[differences.length - 1];
      if (!difference) throw new Error('Missing family difference');
      difference.count = [...differenceHistogram(rows(base), rows(head)).values()].reduce((sum, count) => sum + count, 0);
      const index = /\[(\d+)\]/u.exec(result.path)?.[1];
      const data = index === undefined ? null : base.observations[family][Number(index)]?.data;
      if (data && typeof data === 'object' && !Array.isArray(data)) difference.subject = data.subject ?? data.url ?? data.kind ?? data.barrier ?? null;
    }
  }
  return differences;
}

/** Zero threshold, antialiasing included, no masks: even a one-channel or one-pixel change is a difference. */
export function comparePng(base: Uint8Array, head: Uint8Array): ValueDifference | null {
  const a = decodePng(base), b = decodePng(head);
  if (a.width !== b.width || a.height !== b.height) return { path: 'dimensions', base: [a.width, a.height], head: [b.width, b.height] };
  let count = 0;
  for (let offset = 0; offset < a.data.length; offset += 4) {
    if ([0, 1, 2, 3].some(channel => a.data[offset + channel] !== b.data[offset + channel])) count++;
  }
  // Keep exact RGBA as well: pixelmatch blends alpha, which can hide a changed transparent channel.
  count = Math.max(count, pixelmatch(a.data, b.data, undefined, a.width, a.height, { threshold: 0, includeAA: true }));
  if (!count) return null;
  let first = 0;
  while (first < a.data.length && a.data[first] === b.data[first]) first++;
  const pixel = Math.floor(first / 4), x = pixel % a.width, y = Math.floor(pixel / a.width);
  return { path: `pixels[${x},${y}] (${count} differing pixels)`, base: [...a.data.subarray(pixel * 4, pixel * 4 + 4)], head: [...b.data.subarray(pixel * 4, pixel * 4 + 4)] };
}

async function inside(root: string, file: string) {
  const actual = await realpath(file), path = relative(root, actual);
  if (path === '..' || path.startsWith('../') || isAbsolute(path)) throw new Error(`Trace artifact escapes its directory: ${file}`);
  return actual;
}
async function load(directory: string): Promise<Map<string, { trace: Trace; directory: string }>> {
  const root = await realpath(directory), traces = new Map<string, { trace: Trace; directory: string }>();
  async function visit(folder: string) {
    for (const entry of (await readdir(folder, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      const file = resolve(folder, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Symlinks are not trace artifacts: ${file}`);
      if (entry.isDirectory()) { await visit(file); continue; }
      if (!entry.isFile() || !entry.name.endsWith('.trace.json')) continue;
      const input: unknown = JSON.parse(await readFile(file, 'utf8'));
      const trace = parseTrace(input), key = `${trace.journey}/${trace.profile}`;
      if (traces.has(key)) throw new Error(`Duplicate journey/profile trace: ${key}; compare one run directory at a time`);
      traces.set(key, { trace, directory: folder });
    }
  }
  await visit(root);
  if (!traces.size) throw new Error(`No *.trace.json files in ${directory}; an empty recording cannot pass`);
  return traces;
}
export async function compareDirectories(baseDirectory: string, headDirectory: string): Promise<Difference[]> {
  const [base, head] = await Promise.all([load(baseDirectory), load(headDirectory)]);
  const differences: Difference[] = [];
  // Read every screenshot even if its counterpart is absent; incomplete artifacts are tool errors.
  const pictures = new Map<string, Uint8Array>();
  for (const entries of [base, head]) for (const { trace, directory } of entries.values()) {
    const root = await realpath(directory);
    for (const row of trace.observations.rendering) if (row.screenshot) {
      const file = await inside(root, resolve(directory, row.screenshot));
      const bytes = await readFile(file);
      decodePng(bytes);
      pictures.set(resolve(directory, row.screenshot), bytes);
    }
  }
  for (const key of [...new Set([...base.keys(), ...head.keys()])].sort()) {
    const a = base.get(key), b = head.get(key), owner = a ?? b;
    if (!owner) throw new Error('Trace identity disappeared');
    if (!a || !b) {
      differences.push({ journey: owner.trace.journey, profile: owner.trace.profile, family: 'trace', path: '$', base: a ? 'present' : 'missing', head: b ? 'present' : 'missing' });
      continue;
    }
    differences.push(...compareTraces(a.trace, b.trace));
    for (const [index, row] of a.trace.observations.rendering.entries()) {
      const other = b.trace.observations.rendering[index];
      if (!row.screenshot || !other?.screenshot || row.screenshot !== other.screenshot) continue;
      const before = pictures.get(resolve(a.directory, row.screenshot)), after = pictures.get(resolve(b.directory, other.screenshot));
      if (!before || !after) throw new Error('Screenshot bytes disappeared');
      const result = comparePng(before, after);
      if (result) differences.push({ journey: a.trace.journey, profile: a.trace.profile, family: 'rendering', ...result,
        path: `$.observations.rendering[${index}].screenshot.${result.path}` });
    }
  }
  return differences;
}
