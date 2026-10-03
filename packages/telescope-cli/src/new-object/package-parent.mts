import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { hostedParent } from './new-hosted-planet.mts';

/** The object a package this tool writes is inside (packages/objects/src/registry/object-tree.ts). A star bound to another is
 * inside that star's system. Any other keeps the parent its package already has, since the systems step moves a star with planets
 * into its own system; a new package takes the parent its spec names, and is refused without one. */
export async function packageParent(root: string, id: string, named: { readonly parent?: string; readonly boundTo?: { readonly host: string } }): Promise<string> {
  if (named.boundTo) return hostedParent(named.boundTo.host);
  const path = `src/objects/${id}/object.json`;
  const existing = await readFile(resolve(root, path), 'utf8').then(text => (JSON.parse(text) as { parent?: unknown }).parent, (error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return undefined; throw error; });
  const parent = typeof existing === 'string' ? existing : named.parent;
  if (parent === undefined) throw new TypeError(`${id}: a new object names the object it is inside: give its spec a parent (its galaxy's id, "milky-way" for a star Gaia or Hipparcos places) or the star it is bound to (boundTo).`);
  return parent;
}
/** `files` with the package's descriptor naming `parent`, written after its id. */
export function withParent<Files extends Map<string, string | Buffer>>(files: Files, id: string, parent: string): Files {
  const path = `src/objects/${id}/object.json`, { schema, id: own, parent: _drafted, ...rest } = JSON.parse(String(files.get(path))) as Record<string, unknown>;
  files.set(path, `${JSON.stringify({ schema, id: own, parent, ...rest }, null, 2)}\n`);
  return files;
}
