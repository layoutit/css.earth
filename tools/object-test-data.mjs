import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
/** Exercise the same final prepared definition that the browser authenticates. */
export async function loadObjectTestDefinition(id, root = process.cwd()) {
  return JSON.parse(await readFile(resolve(root, 'src/planets', id, 'prepared/object.json'), 'utf8')).data;
}
