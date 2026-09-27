/** Verify a telescope product record and every file it claims, independent of its stage. */
import { readFile, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { parseProductRecord } from '@cssearth/telescope';
import { sameRun } from '@cssearth/telescope/node';
import { sha256 } from '@cssearth/core/node';

export function localOutput(root: string, name: string): string {
  const path = resolve(root, name), rel = relative(root, path);
  if (isAbsolute(name) || !rel || rel === '..' || rel.startsWith('../')) throw new Error('Output escapes its product directory');
  return path;
}

export async function verifiedProduct(path: string) {
  const file = resolve(path), bytes = await readFile(file), record = parseProductRecord(JSON.parse(bytes.toString())), root = dirname(file);
  const realRoot = await realpath(root);
  for (const output of record.outputs) localOutput(realRoot, relative(realRoot, await realpath(localOutput(root, output.path))));
  if (!await sameRun(record, record, name => localOutput(root, name))) throw new Error('Product output pins changed or are missing');
  return { file, root, record, pin: { sha256: sha256(bytes), bytes: bytes.length } };
}
