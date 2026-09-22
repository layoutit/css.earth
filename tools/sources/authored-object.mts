import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseAuthoredObjectDescriptor } from '@cssearth/objects';

/** Discovery follows the descriptor; no parallel list of migrated object IDs. */
export async function authoredObject(id: string, projectRoot = process.cwd()) {
  let source: unknown;
  try { source = JSON.parse(await readFile(resolve(projectRoot, 'src/objects', id, 'object.json'), 'utf8')); }
  catch (error) { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null; throw error; }
  const properties = source && typeof source === 'object' && 'properties' in source ? source.properties : null;
  if (!(properties && typeof properties === 'object' && 'recipe' in properties && properties.recipe)) return null;
  // The schema rejects a field, not a file, so a bare message leaves a CI log naming neither. Every caller
  // reaches a descriptor through here, so the object and its path are added once.
  try { return parseAuthoredObjectDescriptor(source); }
  catch (error) {
    throw new TypeError(`src/objects/${id}/object.json: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
}
