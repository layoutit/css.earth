import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseAuthoredObjectDescriptor } from '@cssearth/objects';

/** Discovery follows the descriptor; no parallel list of migrated object IDs. */
export async function authoredObject(id: string, projectRoot = process.cwd()) {
  let source: unknown;
  try { source = JSON.parse(await readFile(resolve(projectRoot, 'src/objects', id, 'object.json'), 'utf8')); }
  catch (error) { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null; throw error; }
  const properties = source && typeof source === 'object' && 'properties' in source ? source.properties : null;
  return properties && typeof properties === 'object' && 'recipe' in properties && properties.recipe ? parseAuthoredObjectDescriptor(source) : null;
}
