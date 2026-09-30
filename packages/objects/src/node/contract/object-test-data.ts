import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireRecord } from '@cssearth/core';
/** Exercise the same final prepared definition that the browser authenticates. */
export async function loadObjectTestDefinition(id: string, root = process.cwd()): Promise<unknown> {
  // The transport's data is the restored runtime (prepared-transport.ts).
  return requireRecord(JSON.parse(await readFile(resolve(root, 'src/objects', id, 'prepared/runtime.json'), 'utf8')), 'Prepared object test fixture');
}

/** A runtime's structure: its keys and value types, each array reduced to the distinct structures of its items and whether
 * it holds more than one. Objects of one structure take the same paths through the shared runtime, so behaviour tests run
 * once per structure rather than once per object; each object's own data is checked when it is prepared. */
export function runtimeStructure(value: unknown): string {
  if (Array.isArray(value)) return `[${[...new Set(value.map(runtimeStructure))].sort().join('|')}]${value.length > 1 ? '+' : ''}`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : 1).map(([key, item]) => `${key}:${runtimeStructure(item)}`).join(',')}}`;
  }
  return typeof value;
}

/** The first object of each runtime structure among `ids`, with its prepared definition. An object whose runtime is not
 * restored is left out. */
export async function runtimeRepresentatives(ids: readonly string[], root = process.cwd()): Promise<{ id: string; definition: unknown }[]> {
  const seen = new Set<string>(), representatives: { id: string; definition: unknown }[] = [];
  for (const id of ids) {
    let definition: unknown;
    try { definition = await loadObjectTestDefinition(id, root); }
    catch (error) { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') continue; throw error; }
    const structure = runtimeStructure(definition);
    if (seen.has(structure)) continue;
    seen.add(structure);
    representatives.push({ id, definition });
  }
  return representatives;
}
