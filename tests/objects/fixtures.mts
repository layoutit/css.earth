import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
/** Tests consume the same JSON preparation products as the shared renderer. */
export async function readPreparedFixture(id: string, artifact: string): Promise<unknown> {
  if (!/^[a-z][a-z0-9-]*$/.test(id) || !/^[a-z][a-z0-9-]*$/.test(artifact)) throw new TypeError('Unsafe prepared fixture address.');
  const root = process.env.OBJECT_PREPARATION_ROOT
    ? resolve(process.env.OBJECT_PREPARATION_ROOT, id)
    : resolve(projectRoot, 'src/planets', id, 'prepared');
  return JSON.parse(await readFile(resolve(root, `${artifact}.json`), 'utf8'));
}
