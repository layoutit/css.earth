import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { hasErrorCode, isRecord } from '../sources/source-values.mts';
import type { ObjectDiscovery } from '../../site/object-discovery.mts';
import { parseArrivalView } from '../../site/arrival-view.mts';
import { preparedDefaultViewRotation } from '../../src/renderers/css/dist/navigation.js';

/** Authored exceptions describe illustrative datasets, not a permanent body blacklist. */
export function discoveryPolicy(value: unknown) {
  if (!isRecord(value)) throw new TypeError('Missing discovery catalogue.');
  const { featured = false, illustrationLenses = [], orientationReference } = value;
  if (orientationReference !== undefined && (!Number.isInteger(orientationReference) || Number(orientationReference) < 1)) throw new TypeError('Invalid object orientation reference.');
  if (typeof featured !== 'boolean' || !Array.isArray(illustrationLenses) ||
      !illustrationLenses.every(id => typeof id === 'string' && /^[a-z][a-z0-9-]*$/u.test(id)) ||
      new Set(illustrationLenses).size !== illustrationLenses.length) throw new TypeError('Invalid object discovery policy.');
  return { featured, illustrationLenses: illustrationLenses as string[], ...(orientationReference === undefined ? {} : { orientationReference: Number(orientationReference) }) };
}

/** Only prepared, exposed observation lenses count. A source download, an
 * illustration texture, a shape/elevation view or a source count cannot promote a body. */
export function deriveObjectDiscovery(catalog: unknown, controls: unknown, recipes: readonly unknown[], camera?: unknown): ObjectDiscovery {
  const policy = discoveryPolicy(catalog);
  if (!isRecord(controls) || !isRecord(controls.lenses) || !Array.isArray(controls.lenses.controls)) throw new TypeError('Missing prepared discovery lenses.');
  const exposed = new Set(controls.lenses.controls.map(lens => {
    if (!isRecord(lens) || typeof lens.id !== 'string') throw new TypeError('Invalid prepared discovery lens.');
    return lens.id;
  }));
  const observed = new Set<string>();
  const photographed = new Set<string>();
  const sourceColors = new Set<string>();
  // Measured lenses that are not imagery: a whole-disc or photometric colour, or measured geometry in neutral gray.
  const measured = new Set<string>();
  for (const recipe of recipes) {
    if (!isRecord(recipe)) throw new TypeError('Invalid discovery recipe.');
    const raster = isRecord(recipe.raster) ? recipe.raster : recipe;
    for (const key of ['observations', 'surfaceObservations', 'observedColors', 'mosaics', 'surfaces']) {
      const entries = raster[key];
      if (entries === undefined) continue;
      if (!Array.isArray(entries)) throw new TypeError(`Invalid discovery ${key}.`);
      for (const entry of entries) {
        if (!isRecord(entry) || typeof entry.id !== 'string') throw new TypeError('Invalid observation lens.');
        if (key === 'surfaces' && isRecord(entry.science) && entry.science.kind === 'stellar-photometric-color' && exposed.has(entry.id)) sourceColors.add(entry.id);
        if (isRecord(entry.science) && ['neutral-shape', 'black-shadow', 'disc-integrated-color', 'stellar-photometric-color'].includes(String(entry.science.kind)) && exposed.has(entry.id)) measured.add(entry.id);
        if (isRecord(entry.metadata) && entry.metadata.modeled === true ||
            isRecord(entry.science) && ['neutral-shape', 'black-shadow', 'disc-integrated-color', 'stellar-photometric-color'].includes(String(entry.science.kind)) || key === 'surfaces' && policy.illustrationLenses.includes(entry.id)) continue;
        if (exposed.has(entry.id)) {
          observed.add(entry.id);
          if (key === 'observations' || key === 'surfaceObservations') photographed.add(entry.id);
        }
      }
    }
  }
  const imagery = observed.size > 0;
  // A measured lens beside an illustration keeps the body "Shape only"; the illustration still never counts as imagery.
  const illustration = !imagery && !measured.size && [...exposed].some(id => policy.illustrationLenses.includes(id));
  let arrival;
  if (photographed.size && camera !== undefined) {
    arrival = parseArrivalView({ defaultLens: controls.lenses.defaultLens, lensIds: [...photographed],
      rotation: preparedDefaultViewRotation(camera) });
  }
  return { imagery, illustration, featured: !illustration && (policy.featured || imagery), ...(arrival ? { arrival } : {}),
    // A star's colour lens from its spectrum or catalogued temperature is measured, though not an image of its surface.
    ...(!imagery && sourceColors.size ? { sourceColor: true as const } : {}),
    // An orientation reference outranks classification in universe annotations (the Sun, then Earth).
    ...(policy.orientationReference === undefined ? {} : { orientationReference: policy.orientationReference }) };
}

export async function prepareObjectDiscovery(descriptor: unknown, objectDirectory: string) {
  if (!isRecord(descriptor) || !isRecord(descriptor.properties) || !isRecord(descriptor.properties.recipe) ||
      !Array.isArray(descriptor.properties.recipe.sources)) throw new TypeError('Missing discovery recipe sources.');
  const inputs: unknown[] = [];
  for (const source of descriptor.properties.recipe.sources) {
    if (!isRecord(source) || typeof source.id !== 'string' || typeof source.path !== 'string') throw new TypeError('Invalid discovery recipe source.');
    if (!['terrestrial', 'raster', 'shape-model'].includes(source.id)) continue;
    const path = resolve(objectDirectory, source.path);
    if (!path.startsWith(resolve(objectDirectory) + sep)) throw new TypeError('Discovery recipe escaped its package.');
    const recipe: unknown = JSON.parse(await readFile(path, 'utf8'));
    // A shape model names its lens surfaces by `lens`; discovery reads them as surfaces like the raster lane's.
    if (source.id === 'shape-model') {
      if (isRecord(recipe) && Array.isArray(recipe.surfaces))
        inputs.push({ surfaces: recipe.surfaces.map(surface => isRecord(surface) ? { id: surface.lens, science: surface.science } : surface) });
    } else inputs.push(recipe);
  }
  // A new package has no prepared lenses until its first preparation: it is discoverable as shape only, not an error.
  const preparedJson = async (name: string): Promise<unknown> => {
    try { return JSON.parse(await readFile(resolve(objectDirectory, 'prepared', name), 'utf8')); }
    catch (error) { if (hasErrorCode(error, 'ENOENT')) return null; throw error; }
  };
  const controls: unknown = await preparedJson('controls.json') ?? { lenses: { controls: [] } };
  // Only photographic packages need their prepared camera. No geometry or image
  // analysis runs in the browser or during a selection.
  const photographic = inputs.some(input => {
    if (!isRecord(input)) return false;
    const raster = isRecord(input.raster) ? input.raster : input;
    return ['observations', 'surfaceObservations'].some(key => Array.isArray(raster[key]) && raster[key].length > 0);
  });
  const runtime: unknown = photographic ? await preparedJson('runtime.json') : null;
  return deriveObjectDiscovery(descriptor.properties.catalog, controls, inputs, isRecord(runtime) ? runtime.camera : undefined);
}
