import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireRecord } from '@cssearth/core';
/** Exercise the same final prepared definition that the browser authenticates. */
export async function loadObjectTestDefinition(id: string, root = process.cwd()): Promise<unknown> {
  // The transport's data is the restored runtime (prepared-transport.ts).
  return requireRecord(JSON.parse(await readFile(resolve(root, 'src/objects', id, 'prepared/runtime.json'), 'utf8')), 'Prepared object test fixture');
}
