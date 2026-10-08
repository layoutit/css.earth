import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
import { resolve } from 'node:path';
import { requireRecord } from '@cssearth/core';
import { readPreparedRuntimeText } from '../prepared-runtime-files.js';
/** Exercise the same final prepared definition that the browser authenticates. */
export async function loadObjectTestDefinition(id: string, root = checkoutProjectRoot(import.meta.url)): Promise<unknown> {
  // The transport's data is the restored runtime (prepared-transport.ts).
  return requireRecord(JSON.parse(await readPreparedRuntimeText(resolve(root, 'src/objects', id, 'prepared'))), 'Prepared object test fixture');
}
