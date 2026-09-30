// Refresh the surface panoramas of an already prepared object without re-preparing its surfaces: verify the authored source
// pins, resample the panoramas into sky-cube faces against the prepared runtime definition, and rewrite the runtime plan,
// the runtime asset manifest and the object descriptor. Usage: node site/build/prepare/refresh-panoramas.ts <objectId> [...]
import { updateInventory } from '@cssearth/objects/node';
import { sha256 } from '@cssearth/core/node';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { attachSurfacePanoramas } from '@cssearth/bake/objects/panoramas';
import { readAuthoredSources } from '@cssearth/bake/objects/sources';
import { collectRuntimeAssetUrls, parseRuntimeManifest } from '@cssearth/bake/delivery';

const record = (value: unknown, label: string): Record<string, unknown> => { if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError(`${label} must be an object.`); return value as Record<string, unknown>; };

export async function refreshObjectPanoramas(id: string): Promise<{ count: number; files: number }> {
  if (!/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError('Invalid object id.');
  const objectDirectory = resolve('src/objects', id), sourceDirectory = resolve(objectDirectory, 'source'), outputDirectory = resolve(objectDirectory, 'prepared'), publicDirectory = resolve('public/scenes', id);
  const { descriptor, sources } = await readAuthoredSources(objectDirectory);
  if (!descriptor.recipe.panoramas) throw new TypeError(`${id} declares no panoramas.`);
  const previous = record(JSON.parse(await readFile(resolve(outputDirectory, 'runtime.json'), 'utf8')), 'prepared runtime');
  const { panoramas: _previous, ...definition } = previous;
  const attached = await attachSurfacePanoramas({ descriptor, sources, sourceDirectory, publicDirectory, definition });
  await writeFile(resolve(outputDirectory, 'runtime.json'), `${JSON.stringify(attached.definition)}\n`);
  // Only the panorama files changed among the delivered assets: every file the new plan names replaces the old plan's.
  const manifest = parseRuntimeManifest(JSON.parse(await readFile(resolve(objectDirectory, 'inventory.json'), 'utf8')), id);
  const named = (plan: unknown) => new Set(collectRuntimeAssetUrls(id, plan).map(url => url.split('/').at(-1)!));
  const before = named(previous.panoramas), after = named(attached.definition.panoramas);
  const entries = [];
  for (const filename of after) {
    const bytes = await readFile(resolve(publicDirectory, filename));
    entries.push({ filename, bytes: bytes.byteLength, sha256: sha256(bytes) });
  }
  const assets = [...manifest.assets.filter(asset => !before.has(asset.filename) && !after.has(asset.filename)), ...entries]
    .sort((a, b) => a.filename.localeCompare(b.filename));
  await updateInventory({ objectId: id, objectDirectory, location: 'public', assets });
  const writer = record(await import(pathToFileURL(resolve(process.cwd(), 'site/build/prepare/prepare-object-json.mts')).href), 'prepared object writer');
  if (typeof writer.writeObjectJson !== 'function') throw new TypeError('Prepared object writer is missing.');
  await (writer.writeObjectJson as (objectId: string, runtime: Record<string, unknown>) => Promise<unknown>)(id, attached.definition);
  return { count: attached.count, files: entries.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  for (const id of process.argv.slice(2)) {
    const result = await refreshObjectPanoramas(id);
    console.log(JSON.stringify({ id, ...result }));
  }
}
