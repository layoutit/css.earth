import { readFile } from 'node:fs/promises';
import { systemViewFile } from '@cssearth/objects';
import { requireObject } from '../objects.mts';

/** A host's prepared system view, read from the package of the system its host is inside (its parent). */
export async function readSystemViewFile(host: string): Promise<unknown> {
  const owner = requireObject(host).parent;
  if (owner === undefined) throw new TypeError(`${host} is inside no object, so no package has its system view.`);
  return JSON.parse(await readFile(new URL(`../../src/objects/${owner}/prepared/${systemViewFile(host)}`, import.meta.url), 'utf8'));
}
