import { parseVolumeSourcePreview, parseVolumeSourceManifest, VOLUME_PRESENTATION_SOURCE_SCHEMA, type VolumeSourcePreview as Preview, type TrackedVolumeSourcePreview as TrackedPreview, type VolumePresentationSource as Presentation, PREPARED_VOLUME_DATASETS_SCHEMA, PREPARED_IMAGE_LAYER_BANK_SCHEMA, parseObjectDescriptor } from '@cssearth/objects';
import { sha256 } from '@cssearth/core/node';
import { parseProductInputEvidence } from '@cssearth/objects/provenance';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

import type { Dataset } from '../../object-shell-types.ts';
import { validateDatasetText } from '../../dataset-content.mts';
import { parsePreparedVolumePresentation } from '../../volume-presentation.mts';
import { checkLineage, lineageSource } from '@cssearth/objects/provenance';
import type { ObjectLineage } from '@cssearth/objects/provenance';
import { sourceArray, sourceId, sourceObject, sourcePath, sourceText, sourceUnique, sourceUrl } from '@cssearth/objects/sources';
import { hasErrorCode } from '@cssearth/core';
import { writePreparedSet } from '@cssearth/bake/delivery';
import { readInventory, mergeInventory, inventoryText } from '@cssearth/objects/node';
import { manifestSources } from '@cssearth/bake/sources';
import { composeSkyBandPng, verifySkyBandRecipe } from '@cssearth/telescope-cli/sky/sky-band-composite';
import { RUNTIME_ASSET_ORIGIN, fetchWithRetry, sourceCacheUrl } from '@cssearth/bake/objects/sources';
import { DECORATIVE_WEBP } from '@cssearth/bake/raster';

export const volumePresentationCompilerClosure = ['site/build/prepare/prepare-volume-presentation.mts', 'site/dataset-content.mts', 'packages/bake/src/sources/context-source-records.ts',
  'packages/objects/src/prepared-data/volume-source-manifest.ts', 'packages/objects/src/prepared-data/volume-presentation-source.ts',
  'packages/telescope-cli/src/sky/sky-band-composite.mts', 'packages/bake/src/objects/raster/wise-atlas-mosaic.ts', 'packages/bake/src/objects/color/color-transfer.ts', 'packages/fits/src/fits.ts', 'packages/fits/src/node/file.ts', 'packages/bake/src/raster/lossy-lane.ts'] as const;

const json = (bytes: Buffer): unknown => JSON.parse(bytes.toString('utf8'));
const stringify = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
/** A preview is a publisher image downloaded by URL, a composite of a pinned sky band recipe, or an image this package
 * draws itself from one of its own declared inputs. The third kind exists for a dataset whose source is the package's
 * own product rather than a figure someone published: there is nothing to download, and a publisher figure of some
 * other observation would misrepresent it. */
const isTracked = (preview: Preview): preview is TrackedPreview => !preview.path.startsWith('.local/');
function presentation(raw: unknown): Presentation {
  const value = sourceObject(raw, ['schema', 'objectId', 'name', 'defaultDataset', 'bank', 'recipes', 'sharedInputs', 'inputEvidence', 'datasets']);
  if (value.schema !== VOLUME_PRESENTATION_SOURCE_SCHEMA) throw new TypeError('Invalid volume presentation source.');
  const datasets = sourceArray(value.datasets, raw => {
    const dataset = sourceObject(raw, ['id', 'label', 'title', 'description', 'summary', 'detail', 'facts', 'input', 'preview', 'inputEvidence']);
    const result = { id: sourceId(dataset.id), label: sourceText(dataset.label), title: sourceText(dataset.title), description: sourceText(dataset.description),
      summary: sourceText(dataset.summary), detail: sourceText(dataset.detail), input: sourceId(dataset.input), preview: parseVolumeSourcePreview(dataset.preview),
      inputEvidence: [...sourceArray(dataset.inputEvidence ?? [], parseProductInputEvidence)],
      facts: [...sourceArray(dataset.facts, raw => { const fact = sourceObject(raw, ['id', 'label', 'value']); return { id: sourceId(fact.id), label: sourceText(fact.label), value: sourceText(fact.value) }; })] };
    validateDatasetText(result);
    return result;
  });
  sourceUnique(datasets.map(dataset => dataset.id), 'volume dataset');
  const defaultDataset = sourceId(value.defaultDataset);
  if (!datasets.length || !datasets.some(dataset => dataset.id === defaultDataset)) throw new TypeError('Invalid volume default dataset.');
  return { objectId: sourceId(value.objectId), name: sourceText(value.name), defaultDataset, bank: { path: sourcePath(sourceObject(value.bank, ['path']).path) }, datasets: [...datasets],
    sharedInputs: [...sourceArray(value.sharedInputs, sourceId)], inputEvidence: [...sourceArray(value.inputEvidence ?? [], parseProductInputEvidence)] };
}
/** Which manifest sources each dataset reads: its own image, its further inputs and the shared inputs. */
function volumeLineage(record: Presentation, manifest: Record<string, unknown>, imageLayer: boolean): ObjectLineage {
  const sources = imageLayer ? manifestSources(manifest) : sourceArray(manifest.inputs, raw => lineageSource(raw));
  const bySource = new Map(sources.map(source => [source.id, source]));
  const products = record.datasets.map((dataset, index) => {
    if (bySource.get(dataset.input)?.datasetId !== dataset.id) throw new TypeError(`Unbound volume dataset image: ${record.objectId}/${dataset.id}`);
    for (const evidence of dataset.inputEvidence) if (!bySource.has(evidence.sourceId) || evidence.sourceId === dataset.input)
      throw new TypeError(`Unknown or repeated dataset input: ${record.objectId}/${dataset.id}/${evidence.sourceId}`);
    return { id: dataset.id, label: dataset.label, datasetIds: [dataset.id], parents: [], observationAttribution: 'source-lineage' as const,
      inputs: [...new Set([dataset.input, ...dataset.inputEvidence.map(evidence => evidence.sourceId), ...record.sharedInputs])],
      inputEvidence: [{ sourceId: dataset.input, role: 'appearance' as const, evidence: `Selected image at source/presentation.json#/datasets/${index}/input.` }, ...dataset.inputEvidence, ...record.inputEvidence],
      interpretation: { kind: 'observation-conditioned-volume', sourceKind: 'published-display-image' }, limitations: [dataset.description, dataset.detail] };
  });
  return checkLineage({ objectId: record.objectId, manifestPath: 'source/manifest.json', sources, products });
}

export interface PreparedVolume {
  id: string; name: string; route: string; base: string; controls: Dataset[]; defaultDataset: string; lineage: ObjectLineage;
  outputs: { path: string; text: string | Uint8Array }[];
  /** A volume attached to a body is no place of its own: each of its datasets is reached through the body's dataset that shows it. */
  hostedBy?: HostedDatasets;
}
export interface HostedDatasets {
  objectId: string; name: string; route: string; datasets: Record<string, { datasetId: string; label: string }>;
}
/** The body an attached volume's delivery names, and which of the body's own datasets shows each of the volume's datasets. */
async function hostedDatasets(root: string, base: string, objectId: string, datasetIds: readonly string[], input: (path: string) => Promise<Buffer>, declared?: string): Promise<HostedDatasets | undefined> {
  // The bank's descriptor names its host (`properties.host`); a bank attached to a body is hosted by that body.
  const deliveryPath = `${base}/source/delivery.json`;
  const attached = declared !== undefined ? undefined : await readFile(resolve(root, deliveryPath)).then(() => true, (error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return false; throw error; })
    ? sourceObject(json(await input(deliveryPath))).attachedTo : undefined;
  const host = declared ?? attached;
  if (host === undefined) return undefined;
  const hostId = sourceId(host), content = sourceObject(json(await input(`src/objects/${hostId}/source/content/object.json`)));
  const datasets: Record<string, { datasetId: string; label: string }> = {};
  for (const raw of sourceArray(sourceObject(content.datasets).controls, sourceObject)) {
    if (raw.volume === undefined) continue;
    const volume = sourceObject(raw.volume);
    if (volume.objectId !== objectId) continue;
    const datasetId = sourceId(volume.datasetId);
    if (datasets[datasetId]) throw new TypeError(`Two datasets of ${hostId} show ${objectId}/${datasetId}.`);
    datasets[datasetId] = { datasetId: sourceId(raw.id), label: sourceText(raw.label) };
  }
  for (const datasetId of datasetIds) if (!datasets[datasetId]) throw new TypeError(`No dataset of ${hostId} shows ${objectId}/${datasetId}.`);
  return { objectId: hostId, name: sourceText(content.displayName), route: `/${hostId}/`, datasets };
}

/** Read each volume's installed presentation (`setup:assets --metadata`) beside the lineage of its source records. Deploy
 * catalogue compilation binds to the published presentation; rebuilding it from authoring inputs can describe another package. */
export async function readPreparedVolumes({ root = process.cwd(), input = path => readFile(resolve(root, path)) }: {
  root?: string; input?: (path: string) => Promise<Buffer>;
} = {}): Promise<PreparedVolume[]> {
  const results: PreparedVolume[] = [];
  for (const { base, record, manifest, descriptor } of await volumeSources(root, input)) {
    const lineage = volumeLineage(record, manifest, descriptor.type === 'image-layer-bank');
    const prepared = parsePreparedVolumePresentation(json(await input(`${base}/prepared/presentation.json`)),
      { id: record.objectId, defaultDataset: record.defaultDataset, datasets: record.datasets }, lineage.sources);
    const hostedBy = await hostedDatasets(root, base, record.objectId, prepared.controls.map(control => control.id), input, typeof descriptor.properties.host === 'string' ? descriptor.properties.host : undefined);
    results.push({ id: record.objectId, name: record.name, route: hostedBy?.route ?? `/${record.objectId}/`, base,
      controls: prepared.controls, defaultDataset: prepared.defaultDataset, lineage, outputs: [], ...(hostedBy ? { hostedBy } : {}) });
  }
  return results;
}
/** Every volume package's source presentation, manifest and descriptor, checked against each other. */
async function volumeSources(root: string, input: (path: string) => Promise<Buffer>, objectId?: string) {
  const results = [];
  const folders = await readdir(resolve(root, 'src/objects'), { withFileTypes: true });
  for (const folder of folders.filter(folder => folder.isDirectory() && (objectId === undefined || folder.name === objectId)).sort((a, b) => a.name.localeCompare(b.name))) {
    const base = `src/objects/${folder.name}`, presentationPath = `${base}/source/presentation.json`;
    const presentationBytes = await readFile(resolve(root, presentationPath)).catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return null; throw error; });
    // The source-only catalogue contexts use source/presentation.json too, but are not prepared dataset packages.
    if (presentationBytes === null || sourceObject(json(presentationBytes)).schema !== VOLUME_PRESENTATION_SOURCE_SCHEMA) continue;
    const record = presentation(json(await input(presentationPath)));
    if (record.objectId !== folder.name) throw new TypeError(`Mismatched volume presentation object: ${folder.name}.`);
    const manifest = sourceObject(json(await input(`${base}/source/manifest.json`)), ['schema', 'pathBase', 'inputs', 'documents', 'generatedIntermediates']);
    parseVolumeSourceManifest(manifest, { reader: 'presentation', objectId: record.objectId });
    const descriptor = parseObjectDescriptor(json(await input(`${base}/object.json`)));
    const format = descriptor.prepared?.format;
    if (descriptor.id !== record.objectId || !((descriptor.type === 'volume-dataset-bank' && format === PREPARED_VOLUME_DATASETS_SCHEMA) ||
      (descriptor.type === 'image-layer-bank' && format === PREPARED_IMAGE_LAYER_BANK_SCHEMA && record.datasets.length === 1 && record.defaultDataset === 'optical')))
      throw new TypeError(`Invalid volume descriptor: ${record.objectId}`);
    results.push({ base, record, manifest, descriptor });
  }
  return results;
}
interface Options {
  root?: string;
  /** Prepare one volume without acquiring unrelated objects' preview sources. */
  objectId?: string;
  /** Repository-relative, tracked compiler inputs only. Downloads never enter source closure. */
  input?: (path: string) => Promise<Buffer>;
  /** Opt-in (default null/off): the real content-addressed mirror origin, named explicitly by a production caller.
   * Left off by default so an ordinary test never makes a surprise real request to it. */
  mirrorOrigin?: string | null;
}

export async function preparePreview(root: string, pin: Preview, input: (path: string) => Promise<Buffer>,
  { mirrorOrigin = null, fetcher = fetch }: { mirrorOrigin?: string | null; fetcher?: typeof fetch } = {}): Promise<{ bytes: Buffer; width: number; height: number }> {
  const path = resolve(root, pin.path), download = isTracked(pin) ? null : pin;
  // The recipe is source closure whether or not its composite is already cached.
  if (download?.skyBands) await verifySkyBandRecipe(download.skyBands, input);
  // An authored preview is written and checked in by the package's own author, so it is source closure; every other
  // preview is a download or a cache and stays outside it.
  let bytes = isTracked(pin)
    ? await input(pin.path).catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) throw new Error(`Preview is missing: ${pin.path}; it is kept in this repository beside its source.`); throw error; })
    : await readFile(path).catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return null; throw error; });
  if (bytes === null && download) {
    // Our own mirror first (only when a caller opted in), addressed by the cache path. A miss or any mirror error
    // composes the sky bands from the survey archive or downloads the publisher image, which stays the provenance
    // origin either way.
    if (mirrorOrigin) {
      const mirrorUrl = sourceCacheUrl(mirrorOrigin, 'local', pin.path.slice('.local/'.length));
      bytes = await fetchWithRetry(fetcher, mirrorUrl, { idleMs: 5000, attempts: 1 }).catch(() => null);
    }
    // The survey bands download into the shared cache; only the recipe and tile lists are source closure.
    if (bytes === null && download.skyBands) bytes = (await composeSkyBandPng(download.skyBands, { input, cache: resolve(root, '.local/nebula-lab/sky-bands') })).bytes;
    // Capped at 3 attempts x 120s idle (~6 min worst case, not 30): a stalled publisher must not hang the build.
    else if (bytes === null) bytes = await fetchWithRetry(fetcher, download.url!, { idleMs: 120000, attempts: 3 })
      .catch((error: unknown) => { throw new Error(`Preview download failed: ${download.url} (${error instanceof Error ? error.message : String(error)})`); });
    await mkdir(dirname(path), { recursive: true }); await writeFile(path, bytes);
  }
  if (bytes === null) throw new Error(`Preview is missing: ${pin.path}`);
  // M101's Mayall mosaic, the largest preview source, is 7296 x 7353 px (53.6 megapixels).
  let pipeline = sharp(bytes, { limitInputPixels: 60000000 });
  if (pin.crop) pipeline = pipeline.extract(pin.crop);
  // The sidebar shows the preview 300 CSS px wide: keep 2x of that, in the decorative encoding.
  const result = await pipeline.resize({ width: 600, height: 600, fit: 'inside', withoutEnlargement: true }).webp(DECORATIVE_WEBP).toBuffer({ resolveWithObject: true });
  const { width, height } = result.info;
  return { bytes: result.data, width, height };
}

/** Prepare each volume's presentation (its dataset previews and controls) and inventory from its source records. */
export async function prepareVolumePresentations({ root = process.cwd(), objectId, input = path => readFile(resolve(root, path)), mirrorOrigin = null }: Options = {}): Promise<PreparedVolume[]> {
  if (objectId !== undefined) sourceId(objectId);
  const results: PreparedVolume[] = [];
  for (const path of volumePresentationCompilerClosure) await input(path);
  for (const { base, record, manifest, descriptor } of await volumeSources(root, input, objectId)) {
    const lineage = volumeLineage(record, manifest, descriptor.type === 'image-layer-bank');
    const bankPath = `${base}/${sourcePath(descriptor.prepared!.url)}`;
    const installedBank = await readFile(resolve(root, bankPath)).catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return null; throw error; });
    // An image-layer bank's layers join its inventory, addressed by their installed bytes.
    const layers: { filename: string; bytes: number; sha256: string }[] = [];
    if (descriptor.type === 'image-layer-bank') {
      if (!bankPath.startsWith(`${base}/prepared/`)) throw new TypeError(`Image-layer delivery must be prepared: ${record.objectId}`);
      if (installedBank === null) throw new Error(`Image-layer bank required for complete delivery inventory: ${record.objectId}`);
      const bank = sourceObject(json(await input(bankPath))); // Retained small resource receipt, not image bytes.
      const resources = sourceArray(bank.resources, raw => sourcePath(sourceObject(raw).path));
      if (!resources.length) throw new Error(`Empty image-layer resource inventory: ${record.objectId}`);
      sourceUnique(resources, 'image-layer resource');
      for (const path of resources) {
        const url = `${dirname(bankPath)}/${path}`, bytes = await readFile(resolve(root, url));
        layers.push({ filename: url.slice(`${base}/prepared/`.length), bytes: bytes.length, sha256: sha256(bytes) });
      }
    }
    const outputs: { path: string; text: string | Uint8Array }[] = [];
    const controls: Dataset[] = [];
    const inputs = new Map(sourceArray(manifest.inputs, sourceObject).map(raw => [sourceId(raw.id), raw]));
    for (const dataset of record.datasets) {
      const own = inputs.get(dataset.input)!;
      const image = await preparePreview(root, dataset.preview, input, { mirrorOrigin });
      const previewUrl = `/scenes/${record.objectId}/datasets/${dataset.id}.webp`;
      outputs.push({ path: resolve(root, `public${previewUrl}`), text: image.bytes });
      controls.push({ id: dataset.id, label: dataset.label, title: dataset.title, thumbnailUrl: previewUrl,
        texture: { url: previewUrl, width: image.width, height: image.height, attribution: { label: sourceText(own.displayCredit ?? own.credit), url: sourceUrl(own.sourceUrl) } },
        description: dataset.description, summary: dataset.summary, detail: dataset.detail, facts: dataset.facts });
    }
    outputs.push({ path: resolve(root, `${base}/prepared/presentation.json`), text: stringify({ schema: 'cssearth-volume-presentation@2', objectId: record.objectId, controls, defaultDataset: record.defaultDataset }) });
    const publicPrefix = resolve(root, `public/scenes/${record.objectId}`) + '/';
    const publicAssets = outputs.filter(output => output.path.startsWith(publicPrefix)).map(output => {
      const bytes = Buffer.from(output.text);
      return { filename: output.path.slice(publicPrefix.length), location: 'public' as const, bytes: bytes.length, sha256: sha256(bytes) };
    });
    // The dataset previews are the object's public entries. An image-layer bank's prepared entries are its bank, layers
    // and presentation; a volume-dataset bank's prepared entries were written by its own bake and are kept.
    const current = await readInventory(record.objectId, resolve(root, base));
    const prefix = `${base}/prepared/`;
    const preparedOutputs = outputs.filter(output => output.path.startsWith(resolve(root, prefix) + '/')).map(output => {
      const bytes = Buffer.from(output.text);
      return { filename: output.path.slice(resolve(root, prefix).length + 1), bytes: bytes.length, sha256: sha256(bytes) };
    });
    // A retired layer leaves with the old bank, and prepared files other tools write beside it (catalogue dot banks) stay.
    const imageLayerAssets = descriptor.type === 'image-layer-bank'
      ? [{ filename: bankPath.slice(prefix.length), bytes: installedBank!.length, sha256: sha256(installedBank!) },
        ...layers, ...preparedOutputs] : null;
    const preparedAssets = imageLayerAssets
      ? [...(current?.assets.filter(asset => asset.location === 'prepared' && !asset.filename.startsWith('layers/')
          && !imageLayerAssets.some(own => own.filename === asset.filename)) ?? []), ...imageLayerAssets]
      : [...(current?.assets.filter(asset => asset.location === 'prepared' && !preparedOutputs.some(output => output.filename === asset.filename)) ?? []), ...preparedOutputs];
    const next = mergeInventory(mergeInventory(current, 'public', publicAssets), 'prepared', preparedAssets);
    outputs.push({ path: resolve(root, `${base}/inventory.json`), text: inventoryText(next) });
    const hostedBy = await hostedDatasets(root, base, record.objectId, record.datasets.map(dataset => dataset.id), input, typeof descriptor.properties.host === 'string' ? descriptor.properties.host : undefined);
    results.push({ id: record.objectId, name: record.name, route: hostedBy?.route ?? `/${record.objectId}/`, base, controls, defaultDataset: record.defaultDataset, lineage, outputs,
      ...(hostedBy === undefined ? {} : { hostedBy }) });
  }
  if (objectId !== undefined && results.length !== 1) throw new TypeError(`No volume presentation for ${objectId}.`);
  return results;
}

/** Prepare every volume's presentation and write them as one set. Real callers opt into the mirror. */
export async function writeVolumePresentations(options: Options = {}) {
  const results = await prepareVolumePresentations(options);
  const outputs = results.flatMap(result => result.outputs);
  for (const output of outputs) await mkdir(dirname(output.path), { recursive: true });
  await writePreparedSet(outputs);
  return results;
}

// Entry script: node site/build/prepare/prepare-volume-presentation.mts [--object=<id>].
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some(arg => !/^--object=[a-z][a-z0-9-]*$/.test(arg)))
    throw new TypeError('Usage: prepare-volume-presentation [--object=<id>].');
  // The real CLI entry point: opts into the mirror explicitly (the library defaults it off).
  const results = await writeVolumePresentations({ mirrorOrigin: RUNTIME_ASSET_ORIGIN,
    ...(args[0] === undefined ? {} : { objectId: args[0].slice(9) }) });
  console.log(`Prepared volume presentations: ${results.length} objects, ${results.reduce((sum, result) => sum + result.controls.length, 0)} datasets.`);
}
