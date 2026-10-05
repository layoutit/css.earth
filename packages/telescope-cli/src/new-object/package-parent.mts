import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { OBJECT_SCHEMA } from '@cssearth/objects';
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
/** The system a new host's bodies are inside, before the host's first bake. The bake's systems step writes every system from
 * the placed world (site/build/prepare/system-packages.mts), but no tool reads a tree in which a parent is missing, that
 * step included: a planet that names `<host>-system` needs the package there. This writes it as the step will write it for
 * a star with its bodies, where the host sat and with the host's own card, and moves the host inside. A system already
 * there is kept. Returns whether it wrote one. */
export async function ensureHostSystem(root: string, hostId: string, planets: boolean): Promise<boolean> {
  const system = hostedParent(hostId), path = (id: string) => resolve(root, `src/objects/${id}/object.json`);
  const missing = (error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return undefined; throw error; };
  if (await readFile(path(system), 'utf8').catch(missing) !== undefined) return false;
  const host = JSON.parse(await readFile(path(hostId), 'utf8')) as { parent?: unknown; properties: { catalog: Record<string, unknown>; worldFrame: unknown } }, catalog = host.properties.catalog;
  if (typeof host.parent !== 'string' || host.parent === system) throw new TypeError(`src/objects/${hostId}/object.json: the host of ${system} names no parent, so the system has no place in the object tree.`);
  await mkdir(dirname(path(system)), { recursive: true });
  await writeFile(path(system), `${JSON.stringify({ schema: OBJECT_SCHEMA, id: system, parent: host.parent, type: 'system', generator: 'site/build/prepare/system-packages.mts',
    properties: { system: { host: hostId },
      catalog: { name: catalog.systemName, systemName: catalog.systemName, classification: planets ? 'planetary-system' : 'star-system', color: catalog.color, distanceAu: catalog.distanceAu, description: catalog.description },
      worldFrame: host.properties.worldFrame } }, null, 2)}\n`);
  await writeFile(path(hostId), `${JSON.stringify({ ...host, parent: system }, null, 2)}\n`);
  return true;
}
/** At the end of a run: the system of every host of the bodies it wrote (a planet or companion on its host, a star bound to
 * another), so the tree is whole before the first bake reads it. */
export async function ensureHostSystems(root: string, bodies: readonly { readonly host: string; readonly planet: boolean }[], progress: (line: string) => void): Promise<void> {
  for (const host of new Set(bodies.map(body => body.host)))
    if (await ensureHostSystem(root, host, bodies.some(body => body.host === host && body.planet))) progress(`${host}: its system package written, with ${host} inside it`);
}
/** `files` with the package's descriptor naming `parent`, written after its id. */
export function withParent<Files extends Map<string, string | Buffer>>(files: Files, id: string, parent: string): Files {
  const path = `src/objects/${id}/object.json`, { schema, id: own, parent: _drafted, ...rest } = JSON.parse(String(files.get(path))) as Record<string, unknown>;
  files.set(path, `${JSON.stringify({ schema, id: own, parent, ...rest }, null, 2)}\n`);
  return files;
}
