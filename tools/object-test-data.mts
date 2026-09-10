import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireRecord } from './source-values.mts';
/** Exercise the same final prepared definition that the browser authenticates. */
export async function loadObjectTestDefinition(id: string, root = process.cwd()): Promise<unknown> {
  return requireRecord(JSON.parse(await readFile(resolve(root, 'src/planets', id, 'prepared/object.json'), 'utf8')), 'Prepared object test fixture').data;
}
