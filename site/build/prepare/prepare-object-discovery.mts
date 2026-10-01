import { open, readFile } from 'node:fs/promises';
import { basename, resolve, sep } from 'node:path';
import { hasErrorCode, isRecord } from '@cssearth/core';
import { parseArrivalView, parseArrivalBillboard, type ObjectDiscovery } from '@cssearth/objects';
import { resolveBuildSceneAddress } from '../../asset-origin.mts';
import { preparedDefaultViewRotation } from '@cssearth/renderer/navigation';

/** Authored exceptions describe illustrative datasets, not a permanent body blacklist. */
export function discoveryPolicy(value: unknown) {
  if (!isRecord(value)) throw new TypeError('Missing discovery catalogue.');
  const { featured = false, illustrationDatasets = [], orientationReference } = value;
  if (orientationReference !== undefined && (!Number.isInteger(orientationReference) || Number(orientationReference) < 1)) throw new TypeError('Invalid object orientation reference.');
  if (typeof featured !== 'boolean' || !Array.isArray(illustrationDatasets) ||
      !illustrationDatasets.every(id => typeof id === 'string' && /^[a-z][a-z0-9-]*$/u.test(id)) ||
      new Set(illustrationDatasets).size !== illustrationDatasets.length) throw new TypeError('Invalid object discovery policy.');
  return { featured, illustrationDatasets: illustrationDatasets as string[], ...(orientationReference === undefined ? {} : { orientationReference: Number(orientationReference) }) };
}

/** Only prepared, exposed observation datasets count. A source download, an
 * illustration texture, a shape/elevation view or a source count cannot promote a body. */
export function deriveObjectDiscovery(catalog: unknown, controls: unknown, recipes: readonly unknown[], camera?: unknown): ObjectDiscovery {
  const policy = discoveryPolicy(catalog);
  if (!isRecord(controls) || !isRecord(controls.datasets) || !Array.isArray(controls.datasets.controls)) throw new TypeError('Missing prepared discovery datasets.');
  const exposed = new Set(controls.datasets.controls.map(dataset => {
    if (!isRecord(dataset) || typeof dataset.id !== 'string') throw new TypeError('Invalid prepared discovery dataset.');
    return dataset.id;
  }));
  const observed = new Set<string>();
  const photographed = new Set<string>();
  const sourceColors = new Set<string>();
  // Measured datasets that are not imagery: a whole-disc or photometric colour, or measured geometry in neutral gray.
  const measured = new Set<string>();
  const simulated = new Set<string>();
  for (const recipe of recipes) {
    if (!isRecord(recipe)) throw new TypeError('Invalid discovery recipe.');
    const raster = isRecord(recipe.raster) ? recipe.raster : recipe;
    for (const key of ['observations', 'surfaceObservations', 'observedColors', 'mosaics', 'surfaces']) {
      const entries = raster[key];
      if (entries === undefined) continue;
      if (!Array.isArray(entries)) throw new TypeError(`Invalid discovery ${key}.`);
      for (const entry of entries) {
        if (!isRecord(entry) || typeof entry.id !== 'string') throw new TypeError('Invalid observation dataset.');
        if (isRecord(entry.metadata) && entry.metadata.simulation !== undefined) {
          if (typeof entry.metadata.simulation !== 'boolean') throw new TypeError('Simulation metadata must be boolean.');
          if (entry.metadata.simulation && exposed.has(entry.id)) { simulated.add(entry.id); continue; }
        }
        if (key === 'surfaces' && isRecord(entry.science) && entry.science.kind === 'stellar-photometric-color' && exposed.has(entry.id)) sourceColors.add(entry.id);
        if (isRecord(entry.science) && ['neutral-shape', 'black-shadow', 'disc-integrated-color', 'disc-integrated-band-color', 'stellar-photometric-color'].includes(String(entry.science.kind)) && exposed.has(entry.id)) measured.add(entry.id);
        if (isRecord(entry.metadata) && entry.metadata.modeled === true ||
            isRecord(entry.science) && ['neutral-shape', 'black-shadow', 'disc-integrated-color', 'disc-integrated-band-color', 'stellar-photometric-color'].includes(String(entry.science.kind)) || key === 'surfaces' && policy.illustrationDatasets.includes(entry.id)) continue;
        if (exposed.has(entry.id)) {
          observed.add(entry.id);
          if (key === 'observations' || key === 'surfaceObservations') photographed.add(entry.id);
        }
      }
    }
  }
  const imagery = observed.size > 0;
  // A measured dataset beside an illustration keeps the body "Shape only"; the illustration still never counts as imagery.
  const illustration = !imagery && !measured.size && (simulated.size > 0 || [...exposed].some(id => policy.illustrationDatasets.includes(id)));
  let arrival;
  if (photographed.size && camera !== undefined) {
    arrival = parseArrivalView({ defaultDataset: controls.datasets.defaultDataset, datasetIds: [...photographed],
      rotation: preparedDefaultViewRotation(camera) });
  }
  return { imagery, illustration, featured: !illustration && (policy.featured || imagery), ...(arrival ? { arrival } : {}),
    ...(illustration && simulated.size > 0 ? { simulation: true as const } : {}),
    // A star's colour dataset from its spectrum or catalogued temperature is measured, though not an image of its surface.
    ...(!imagery && sourceColors.size ? { sourceColor: true as const } : {}),
    // An orientation reference outranks classification in universe annotations (the Sun, then Earth).
    ...(policy.orientationReference === undefined ? {} : { orientationReference: policy.orientationReference }) };
}

/** A prepared runtime's `camera`, read from the start of the file. The bake writes `schema` then `camera` first, and
 * discovery needs nothing else: parsing all 3,595 runtimes (1.18 GB) to read this object cost the catalogue step
 * about 10 s. A runtime in any other shape is parsed whole. `null` when the body has no prepared runtime yet. */
export async function preparedRuntimeCamera(path: string): Promise<unknown> {
  let handle;
  try { handle = await open(path); }
  catch (error) { if (hasErrorCode(error, 'ENOENT')) return null; throw error; }
  try {
    const { buffer, bytesRead } = await handle.read({ buffer: Buffer.alloc(65536), position: 0 });
    const head = buffer.toString('utf8', 0, bytesRead), start = head.match(/^\{"schema":"[^"\\]*","camera":/u)?.[0].length;
    if (start !== undefined && head[start] === '{') {
      let depth = 0, inString = false;
      for (let index = start; index < head.length; index++) {
        const char = head[index];
        if (inString) { if (char === '\\') index++; else if (char === '"') inString = false; continue; }
        if (char === '"') inString = true;
        else if (char === '{' || char === '[') depth++;
        else if ((char === '}' || char === ']') && --depth === 0) return JSON.parse(head.slice(start, index + 1));
      }
    }
    const whole: unknown = JSON.parse(await readFile(path, 'utf8'));
    return isRecord(whole) ? whole.camera : undefined;
  } finally { await handle.close(); }
}

/** What a bank shows is its observations: images and volumes built from them are imagery; a bank of catalogue points is
 * measured, not pictured. */
const DATASET_PACKAGE_IMAGERY: Readonly<Record<string, boolean>> = { 'image-layer-bank': true, 'volume-dataset-bank': true, 'catalogue-point-bank': false };

export async function prepareObjectDiscovery(descriptor: unknown, objectDirectory: string) {
  if (isRecord(descriptor) && isRecord(descriptor.properties) && isRecord(descriptor.properties.recipe) && Array.isArray(descriptor.properties.recipe.surfaces) && !descriptor.properties.recipe.surfaces.length) {
    // An object with no surface shows the banks its datasets name: it is pictured when one of them is imagery. It is a
    // place on the map by itself, so it is featured.
    const content: unknown = JSON.parse(await readFile(resolve(objectDirectory, 'source/content/object.json'), 'utf8'));
    const controls = isRecord(content) && isRecord(content.datasets) && Array.isArray(content.datasets.controls) ? content.datasets.controls : [];
    const banks = new Set(controls.flatMap(control => isRecord(control) && isRecord(control.volume) && typeof control.volume.objectId === 'string' ? [control.volume.objectId] : []));
    let imagery = false;
    for (const bank of banks) {
      const companion: unknown = JSON.parse(await readFile(resolve(objectDirectory, '..', bank, 'object.json'), 'utf8'));
      if (!isRecord(companion) || typeof companion.type !== 'string' || !Object.hasOwn(DATASET_PACKAGE_IMAGERY, companion.type)) throw new TypeError(`src/objects/${bank}/object.json: ${String(descriptor.id)} shows it as a dataset, but it is not a bank package.`);
      imagery ||= DATASET_PACKAGE_IMAGERY[companion.type]!;
    }
    const policy = discoveryPolicy(descriptor.properties.catalog);
    return { imagery, illustration: false, featured: true, ...(policy.orientationReference === undefined ? {} : { orientationReference: policy.orientationReference }) };
  }
  if (!isRecord(descriptor) || !isRecord(descriptor.properties) || !isRecord(descriptor.properties.recipe) ||
      !Array.isArray(descriptor.properties.recipe.sources)) throw new TypeError(`Missing discovery recipe sources: ${isRecord(descriptor) ? String(descriptor.id) : 'unknown object'}.`);
  const inputs: unknown[] = [];
  for (const source of descriptor.properties.recipe.sources) {
    if (!isRecord(source) || typeof source.id !== 'string' || typeof source.path !== 'string') throw new TypeError('Invalid discovery recipe source.');
    if (!['terrestrial', 'raster', 'shape-model'].includes(source.id)) continue;
    const path = resolve(objectDirectory, source.path);
    if (!path.startsWith(resolve(objectDirectory) + sep)) throw new TypeError('Discovery recipe escaped its package.');
    const recipe: unknown = JSON.parse(await readFile(path, 'utf8'));
    // A shape model names its dataset surfaces by `dataset`; discovery reads them as surfaces like the raster lane's.
    if (source.id === 'shape-model') {
      if (isRecord(recipe) && Array.isArray(recipe.surfaces))
        inputs.push({ surfaces: recipe.surfaces.map(surface => isRecord(surface) ? { id: surface.dataset, science: surface.science } : surface) });
    } else inputs.push(recipe);
  }
  // A new package has no prepared datasets until its first preparation: it is discoverable as shape only, not an error.
  const preparedJson = async (name: string): Promise<unknown> => {
    try { return JSON.parse(await readFile(resolve(objectDirectory, 'prepared', name), 'utf8')); }
    catch (error) { if (hasErrorCode(error, 'ENOENT')) return null; throw error; }
  };
  const controls: unknown = await preparedJson('controls.json') ?? { datasets: { controls: [] } };
  const camera = await preparedRuntimeCamera(resolve(objectDirectory, 'prepared', 'runtime.json'));
  const discovery = deriveObjectDiscovery(descriptor.properties.catalog, controls, inputs, camera ?? undefined);
  const billboard = await preparedJson('arrival-billboard.json');
  if (billboard !== null) {
    const asset = parseArrivalBillboard(billboard);
    if (camera === null || !isRecord(controls) || !isRecord(controls.datasets)) throw new TypeError('An arrival billboard requires its prepared runtime and datasets.');
    // Every body can have an arrival image. This does not turn a shape model,
    // measured colour or illustration into photographic evidence.
    const view = { defaultDataset: controls.datasets.defaultDataset,
      datasetIds: [...new Set([controls.datasets.defaultDataset, ...(discovery.arrival?.datasetIds ?? [])])],
      rotation: preparedDefaultViewRotation(camera),
      billboard: { ...asset, url: await resolveBuildSceneAddress(asset.url, resolve(objectDirectory, '../../..')) } };
    try { discovery.arrival = parseArrivalView(view); }
    catch (error) {
      throw new TypeError(`${basename(objectDirectory)}: prepared/arrival-billboard.json (dataset ${asset.dataset}, rotation ${JSON.stringify(asset.rotation)}) ` +
        `does not match the default view (dataset ${view.defaultDataset}, rotation ${JSON.stringify(view.rotation)}). ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  }
  return discovery;
}
