/** Compare every recorded dimension; differences are data, malformed recordings are tool errors. */
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { normalisations, publicLayoutNeutral, readRecording, serialise } from './model.mts';
export interface Difference { file: string; dimension: string; base?: unknown; head?: unknown }
export function dimensions(file: string, base: unknown, head: unknown, path = ''): Difference[] {
  if (serialise(base) === serialise(head)) return [];
  if (typeof base === 'object' && base !== null && !Array.isArray(base) && typeof head === 'object' && head !== null && !Array.isArray(head)) {
    return [...new Set([...Object.keys(base), ...Object.keys(head)])].sort().flatMap(key => dimensions(file, Reflect.get(base, key), Reflect.get(head, key), path ? `${path}.${key}` : key));
  }
  return [{ file, dimension: path || 'presence', base, head }];
}
export async function compare(base: string, head: string): Promise<Difference[]> {
  const [before, after] = await Promise.all([readRecording(base), readRecording(head)]);
  for (const recording of [before, after]) for (const file of ['closure.json', 'index.json']) recording.set(file, publicLayoutNeutral(recording.get(file)));
  return [...new Set([...before.keys(), ...after.keys()])].sort().flatMap(file => dimensions(file, before.get(file), after.get(file)));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const { values } = parseArgs({ options: { base: { type: 'string' }, head: { type: 'string' }, json: { type: 'string' }, summary: { type: 'boolean' }, full: { type: 'boolean' } } });
    if (!values.base || !values.head) throw new Error('Usage: diff.mts --base <dir> --head <dir> [--json <file>]');
    const differences = await compare(values.base, values.head);
    const report = { normalisations, differences };
    if (values.json) await writeFile(values.json, serialise(report));
    console.log(serialise(!values.full ? { normalisations, differences: differences.map(({ file, dimension }) => ({ file, dimension, ...(dimension.startsWith('body.static.') ? { category: 'built output' } : {}) })) } : report));
    process.exitCode = differences.length ? 1 : 0;
  } catch (error) { console.error(String(error)); process.exitCode = 2; }
}
