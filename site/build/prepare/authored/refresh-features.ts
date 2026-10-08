import { requireInventory, updateInventory, readPreparedRuntimeText } from '@cssearth/objects/node';
import { parsePreparedObjectRuntime } from '@cssearth/objects';
// Refresh the named-feature catalogue of an already prepared object without re-preparing its surfaces: verify the
// authored source pins, re-run the shared feature attachment against the prepared runtime definition, and rewrite the
// catalogue, the runtime plan, the content document, the runtime asset manifest and the
// object descriptor. Usage: node site/build/prepare/authored/refresh-features.ts <objectId> [...]
import { sha256 } from '@cssearth/core/node';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { attachSurfaceFeatures, writeFeatureContent } from '@cssearth/bake/objects/surface-features';
import { readAuthoredSources } from '@cssearth/bake/objects/sources';
import { parseRuntimeManifest } from '@cssearth/bake/delivery';

const record = (value: unknown, label: string): Record<string, unknown> => { if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError(`${label} must be an object.`); return value as Record<string, unknown>; };

export async function refreshObjectFeatures(id: string): Promise<{ count: number | null }> {
  if (!/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError('Invalid object id.');
  const objectDirectory = resolve('src/objects', id), sourceDirectory = resolve(objectDirectory, 'source'), outputDirectory = resolve(objectDirectory, 'prepared'), publicDirectory = resolve('site/public/scenes', id);
  const { descriptor, sources } = await readAuthoredSources(objectDirectory);
  if (!descriptor.recipe.features) return { count: null };
  const definition = record(parsePreparedObjectRuntime(JSON.parse(await readPreparedRuntimeText(outputDirectory)), { parsedJson: true }), 'prepared runtime');
  const attached = await attachSurfaceFeatures({ descriptor, sources, sourceDirectory, publicDirectory, outputDirectory, definition });
  if (!attached.features) throw new TypeError(`${id} declares features but attached none.`);
  await writeFeatureContent(outputDirectory, attached.features);
  await writeFile(resolve(outputDirectory, 'runtime.json'), `${JSON.stringify(attached.definition)}\n`);
  // Only the feature transport changed among the delivered assets: replace its label catalogue and selection banks.
  const manifest = parseRuntimeManifest(requireInventory(id, JSON.parse(await readFile(resolve(objectDirectory, 'inventory.json'), 'utf8'))), id);
  const plan = record(record(attached.definition, 'definition').features, 'features plan');
  const catalog = record(plan.catalog, 'catalog');
  const urls = [String(catalog.url)];
  if (plan.selection !== undefined) {
    const selection = record(plan.selection, 'feature selection');
    if (!Array.isArray(selection.banks)) throw new TypeError('Feature selection banks are missing.');
    for (const value of selection.banks) urls.push(String(record(value, 'feature selection bank').url));
  }
  const filenames = urls.map(url => url.split('/').at(-1)!);
  const catalogName = filenames[0]!;
  const stem = catalogName.replace(/\.json$/u, '');
  const entries = [];
  for (const filename of filenames) {
    const bytes = await readFile(resolve(publicDirectory, filename));
    entries.push({ filename, bytes: bytes.byteLength, sha256: sha256(bytes) });
  }
  const assets = [...manifest.assets.filter(asset => asset.filename !== catalogName &&
    !(asset.filename.startsWith(`${stem}-selection-`) && asset.filename.endsWith('.json'))), ...entries]
    .sort((a, b) => a.filename.localeCompare(b.filename));
  await updateInventory({ objectId: id, objectDirectory, location: 'public', assets });
  const writer = record(await import(pathToFileURL(resolve(process.cwd(), 'site/build/prepare/authored/prepare-object-json.mts')).href), 'prepared object writer');
  if (typeof writer.writeObjectJson !== 'function') throw new TypeError('Prepared object writer is missing.');
  await (writer.writeObjectJson as (objectId: string, runtime: Record<string, unknown>) => Promise<unknown>)(id, attached.definition as Record<string, unknown>);
  return { count: Number(record(plan.catalog, 'catalog').count) +
      (plan.selection === undefined ? 0 : Number(record(plan.selection, 'selection').count)) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  for (const id of process.argv.slice(2)) {
    const result = await refreshObjectFeatures(id);
    console.log(JSON.stringify({ id, ...result }));
  }
}
