import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseAuthoredObjectDescriptor } from '@cssearth/objects';

/** Discovery follows the descriptor; no parallel list of migrated object IDs. */
export async function authoredObject(id, projectRoot = process.cwd()) {
  let source;
  try { source = JSON.parse(await readFile(resolve(projectRoot, 'src/planets', id, 'object.json'), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  return source.properties?.recipe ? parseAuthoredObjectDescriptor(source) : null;
}
