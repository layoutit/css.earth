import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { isRecord } from './source-values.mts';
import type { ObjectDiscovery } from '../site/object-discovery.mts';

/** Authored exceptions describe illustrative datasets, not a permanent body blacklist. */
export function discoveryPolicy(value: unknown) {
  if (!isRecord(value)) throw new TypeError('Missing discovery catalogue.');
  const { featured = false, illustrationLenses = [] } = value;
  if (typeof featured !== 'boolean' || !Array.isArray(illustrationLenses) ||
      !illustrationLenses.every(id => typeof id === 'string' && /^[a-z][a-z0-9-]*$/u.test(id)) ||
      new Set(illustrationLenses).size !== illustrationLenses.length) throw new TypeError('Invalid object discovery policy.');
  return { featured, illustrationLenses: illustrationLenses as string[] };
}

/** Only prepared, exposed observation lenses count. A source download, an
 * illustration texture, a shape/elevation view or a source count cannot promote a body. */
export function deriveObjectDiscovery(catalog: unknown, controls: unknown, recipes: readonly unknown[]): ObjectDiscovery {
  const policy = discoveryPolicy(catalog);
  if (!isRecord(controls) || !isRecord(controls.lenses) || !Array.isArray(controls.lenses.controls)) throw new TypeError('Missing prepared discovery lenses.');
  const exposed = new Set(controls.lenses.controls.map(lens => {
    if (!isRecord(lens) || typeof lens.id !== 'string') throw new TypeError('Invalid prepared discovery lens.');
    return lens.id;
  }));
  const observed = new Set<string>();
  for (const recipe of recipes) {
    if (!isRecord(recipe)) throw new TypeError('Invalid discovery recipe.');
    const raster = isRecord(recipe.raster) ? recipe.raster : recipe;
    for (const key of ['observations', 'surfaceObservations', 'observedColors', 'mosaics', 'surfaces']) {
      const entries = raster[key];
      if (entries === undefined) continue;
      if (!Array.isArray(entries)) throw new TypeError(`Invalid discovery ${key}.`);
      for (const entry of entries) {
        if (!isRecord(entry) || typeof entry.id !== 'string') throw new TypeError('Invalid observation lens.');
        if (isRecord(entry.metadata) && entry.metadata.modeled === true ||
            isRecord(entry.science) && entry.science.kind === 'glb-base-color' || key === 'surfaces' && policy.illustrationLenses.includes(entry.id)) continue;
        if (exposed.has(entry.id)) observed.add(entry.id);
      }
    }
  }
  const imagery = observed.size > 0;
  const illustration = !imagery && [...exposed].some(id => policy.illustrationLenses.includes(id));
  return { imagery, illustration, featured: !illustration && (policy.featured || imagery) };
}

export async function prepareObjectDiscovery(descriptor: unknown, objectDirectory: string) {
  if (!isRecord(descriptor) || !isRecord(descriptor.properties) || !isRecord(descriptor.properties.recipe) ||
      !Array.isArray(descriptor.properties.recipe.sources)) throw new TypeError('Missing discovery recipe sources.');
  const inputs: unknown[] = [];
  for (const source of descriptor.properties.recipe.sources) {
    if (!isRecord(source) || typeof source.id !== 'string' || typeof source.path !== 'string') throw new TypeError('Invalid discovery recipe source.');
    if (!['terrestrial', 'raster'].includes(source.id)) continue;
    const path = resolve(objectDirectory, source.path);
    if (!path.startsWith(resolve(objectDirectory) + sep)) throw new TypeError('Discovery recipe escaped its package.');
    inputs.push(JSON.parse(await readFile(path, 'utf8')));
  }
  return deriveObjectDiscovery(descriptor.properties.catalog,
    JSON.parse(await readFile(resolve(objectDirectory, 'prepared/controls.json'), 'utf8')), inputs);
}
