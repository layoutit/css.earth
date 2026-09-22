import { sha256 } from '../../src/platform/sha256.mts';
import { parseProductInputEvidence } from '../../src/platform/product-input-evidence.mts';
import type { ProductInputEvidence } from '../../src/platform/product-input-evidence.mts';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { parseObjectDescriptor } from '@cssearth/objects';
import type { Lens } from '../../site/object-shell-types.ts';
import { validateDatasetText } from '../../site/dataset-content.mts';
import { parsePreparedVolumePresentation } from '../../site/volume-presentation.mts';
import { parseCapture } from '../../src/platform/exploration-catalog.mts';
import { validateObjectProvenance } from '../../src/platform/object-provenance.mts';
import type { ProvenanceDocument, ProvenanceSource, ProvenanceJson } from '../../src/platform/object-provenance.mts';
import { parseSourceBinding, sourceArray, sourceDigest, sourceId, sourceObject, sourcePath, sourceText, sourceUnique, sourceUrl } from '../../src/platform/source-catalog.mts';
import { hasErrorCode } from '../sources/source-values.mts';
import { writePreparedSet } from '../prepared/write-prepared-set.mts';
import { readInventory, mergeInventory, inventoryText } from '../../src/platform/runtime-asset-closure.mts';
import { manifestSources } from '../sources/context-source-records.mts';
import { composeSkyBandPng, verifySkyBandRecipe } from '../objects/observation/sky-band-composite.mts';
import { RUNTIME_ASSET_ORIGIN, fetchWithRetry, sourceCacheUrl } from '../assets/source-mirror.mts';

export const volumeProvenanceCompilerClosure = ['tools/prepare/prepare-volume-provenance.mts', 'site/dataset-content.mts', 'tools/sources/context-source-records.mts',
  'tools/objects/observation/sky-band-composite.mts', 'tools/objects/observation/wise-atlas-mosaic.mts', 'tools/objects/color-transfer.mts', 'tools/fits/fits.mts'] as const;

const integer = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) throw new TypeError('Expected a positive integer.');
  return value;
};
const json = (bytes: Buffer): unknown => JSON.parse(bytes.toString('utf8'));
const stringify = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
function provenanceJson(value: unknown): ProvenanceJson {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(provenanceJson);
  const result: Record<string, ProvenanceJson> = {};
  for (const [key, entry] of Object.entries(sourceObject(value))) result[key] = provenanceJson(entry);
  return result;
}
interface Pin { path: string; sha256: string; bytes: number; }
function pin(raw: unknown): Pin {
  const value = sourceObject(raw, ['path', 'sha256', 'bytes']);
  return { path: sourcePath(value.path), sha256: sourceDigest(value.sha256), bytes: integer(value.bytes) };
}
/** A preview is a publisher image downloaded by URL, a composite of a pinned sky band recipe, or an image this package
 * draws itself from one of its own declared inputs. The third kind exists for a dataset whose source is the package's
 * own product rather than a figure someone published: there is nothing to download, and a publisher figure of some
 * other observation would misrepresent it. */
type Crop = { left: number; top: number; width: number; height: number };
/** A preview whose file is in this repository (authored here, or a download kept beside its source) is identified by that
 * file; a preview fetched into the ignored cache is named by its path there. */
interface TrackedPreview { path: string; url?: string; authoredFrom?: string; crop?: Crop; }
interface CachedPreview { path: string; url?: string; skyBands?: { path: string }; crop?: Crop; }
type Preview = TrackedPreview | CachedPreview;
const isTracked = (preview: Preview): preview is TrackedPreview => !preview.path.startsWith('.local/');
function preview(raw: unknown): Preview {
  const value = sourceObject(raw, ['path', 'url', 'skyBands', 'authoredFrom', 'crop']);
  const path = sourcePath(value.path);
  const result: Preview = path.startsWith('.local/') ? { path }
    : { path, ...(value.authoredFrom === undefined ? {} : { authoredFrom: sourceId(value.authoredFrom) }) };
  const kinds = [value.url, value.skyBands, value.authoredFrom].filter(candidate => candidate !== undefined);
  if (kinds.length !== 1) throw new TypeError('A preview names exactly one of a URL, a sky band recipe or the input it is drawn from.');
  if (value.authoredFrom !== undefined) { /* named above */ }
  else if (value.url !== undefined) result.url = sourceUrl(value.url);
  else if (isTracked(result)) throw new TypeError('A tracked preview names its URL or the input it is drawn from.');
  else {
    result.skyBands = { path: sourcePath(sourceObject(value.skyBands, ['path']).path) };
  }
  if (value.crop !== undefined) {
    const crop = sourceObject(value.crop, ['left', 'top', 'width', 'height']);
    const offset = (raw: unknown) => { if (typeof raw !== 'number' || !Number.isSafeInteger(raw) || raw < 0) throw new TypeError('Invalid crop offset.'); return raw; };
    result.crop = { left: offset(crop.left), top: offset(crop.top), width: integer(crop.width), height: integer(crop.height) };
  }
  return result;
}
interface LensRecord {
  id: string; label: string; title: string; description: string; summary: string; detail: string;
  facts: { id: string; label: string; value: string }[]; input: string; preview: Preview;
  /** Further inputs this one lens was built from, each with its role, beyond its own image and the shared inputs. */
  inputEvidence: ProductInputEvidence[];
}
interface Presentation {
  objectId: string; name: string; defaultLens: string; bank: { path: string }; recipes: { path: string; id: string }[];
  sharedInputs: string[]; inputEvidence: ProductInputEvidence[]; lenses: LensRecord[];
}
function presentation(raw: unknown): Presentation {
  const value = sourceObject(raw, ['schema', 'objectId', 'name', 'defaultLens', 'bank', 'recipes', 'sharedInputs', 'inputEvidence', 'lenses']);
  if (value.schema !== 'cssearth-volume-presentation-source@1') throw new TypeError('Invalid volume presentation source.');
  const lenses = sourceArray(value.lenses, raw => {
    const lens = sourceObject(raw, ['id', 'label', 'title', 'description', 'summary', 'detail', 'facts', 'input', 'preview', 'inputEvidence']);
    const result = { id: sourceId(lens.id), label: sourceText(lens.label), title: sourceText(lens.title), description: sourceText(lens.description),
      summary: sourceText(lens.summary), detail: sourceText(lens.detail), input: sourceId(lens.input), preview: preview(lens.preview),
      inputEvidence: [...sourceArray(lens.inputEvidence ?? [], parseProductInputEvidence)],
      facts: [...sourceArray(lens.facts, raw => { const fact = sourceObject(raw, ['id', 'label', 'value']); return { id: sourceId(fact.id), label: sourceText(fact.label), value: sourceText(fact.value) }; })] };
    validateDatasetText(result);
    return result;
  });
  sourceUnique(lenses.map(lens => lens.id), 'volume lens');
  const defaultLens = sourceId(value.defaultLens);
  if (!lenses.length || !lenses.some(lens => lens.id === defaultLens)) throw new TypeError('Invalid volume default lens.');
  return { objectId: sourceId(value.objectId), name: sourceText(value.name), defaultLens, bank: { path: sourcePath(sourceObject(value.bank, ['path']).path) }, lenses: [...lenses],
    sharedInputs: [...sourceArray(value.sharedInputs, sourceId)], inputEvidence: [...sourceArray(value.inputEvidence ?? [], parseProductInputEvidence)], recipes: [...sourceArray(value.recipes, raw => {
      const recipe = sourceObject(raw, ['id', 'path']);
      return { path: sourcePath(recipe.path), id: sourceId(recipe.id) };
    })] };
}
/** A manifest input, identified from its bytes when the file is present. */
function source(raw: unknown, identity: { sha256: string; bytes: number } | null): ProvenanceSource {
  const value = sourceObject(raw, ['id', 'path', 'origin', 'sourceUrl', 'title', 'credit', 'displayCredit', 'acquisition', 'sourceBinding', 'capture', 'lensId', 'license', 'dependencies']);
  return { id: sourceId(value.id), kind: 'source-input', path: sourcePath(value.path), origin: sourceUrl(value.origin), sourceUrl: sourceUrl(value.sourceUrl),
    title: sourceText(value.title), credit: sourceText(value.credit), acquisition: sourceText(value.acquisition),
    ...(identity ? { sha256: identity.sha256, bytes: identity.bytes } : {}), sourceBinding: parseSourceBinding(value.sourceBinding),
    dependencies: [...sourceArray(value.dependencies, sourceId)], verification: identity ? 'bytes-verified' : 'download-not-present',
    ...(value.lensId === undefined ? {} : { lensId: sourceId(value.lensId) }),
    ...(value.displayCredit === undefined ? {} : { displayCredit: sourceText(value.displayCredit) }),
    ...(value.license === undefined ? {} : { license: sourceText(value.license) }),
    ...(value.capture === undefined ? {} : { capture: parseCapture(value.capture) }) };
}

export interface PreparedVolumeProvenance {
  id: string; name: string; route: string; base: string; controls: Lens[]; defaultLens: string; provenance: ProvenanceDocument;
  outputs: { path: string; text: string | Uint8Array }[];
  /** A volume attached to a body is no place of its own: each of its lenses is reached through the body's dataset that shows it. */
  hostedBy?: HostedDatasets;
}
export interface HostedDatasets {
  objectId: string; name: string; route: string; datasets: Record<string, { lensId: string; label: string }>;
}
/** The body an attached volume's delivery names, and which of the body's own datasets shows each of the volume's lenses. */
async function hostedDatasets(root: string, base: string, objectId: string, lensIds: readonly string[], input: (path: string) => Promise<Buffer>): Promise<HostedDatasets | undefined> {
  const deliveryPath = `${base}/source/delivery.json`;
  const exists = await readFile(resolve(root, deliveryPath)).then(() => true, (error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return false; throw error; });
  if (!exists) return undefined;
  const host = sourceObject(json(await input(deliveryPath))).attachedTo;
  if (host === undefined) return undefined;
  const hostId = sourceId(host), content = sourceObject(json(await input(`src/objects/${hostId}/source/content/object.json`)));
  const datasets: Record<string, { lensId: string; label: string }> = {};
  for (const raw of sourceArray(sourceObject(content.lenses).controls, sourceObject)) {
    if (raw.volume === undefined) continue;
    const volume = sourceObject(raw.volume);
    if (volume.objectId !== objectId) continue;
    const lensId = sourceId(volume.lensId);
    if (datasets[lensId]) throw new TypeError(`Two datasets of ${hostId} show ${objectId}/${lensId}.`);
    datasets[lensId] = { lensId: sourceId(raw.id), label: sourceText(raw.label) };
  }
  for (const lensId of lensIds) if (!datasets[lensId]) throw new TypeError(`No dataset of ${hostId} shows ${objectId}/${lensId}.`);
  return { objectId: hostId, name: sourceText(content.displayName), route: `/${hostId}/`, datasets };
}

/** Read the prepared package that setup:assets installed. Deploy catalogue compilation must bind to these
 * R2-backed bytes; rebuilding provenance from authoring inputs can describe a different package. */
export async function readPreparedVolumeProvenance({ root = process.cwd(), input = path => readFile(resolve(root, path)) }: {
  root?: string; input?: (path: string) => Promise<Buffer>;
} = {}): Promise<PreparedVolumeProvenance[]> {
  const results: PreparedVolumeProvenance[] = [];
  const folders = await readdir(resolve(root, 'src/objects'), { withFileTypes: true });
  for (const folder of folders.filter(folder => folder.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const id = folder.name, base = `src/objects/${id}`, sourcePresentationPath = `${base}/source/presentation.json`;
    const exists = await readFile(resolve(root, sourcePresentationPath)).then(() => true, (error: unknown) => {
      if (hasErrorCode(error, 'ENOENT')) return false;
      throw error;
    });
    if (!exists) continue;
    const sourcePresentation = sourceObject(json(await input(sourcePresentationPath)));
    // The three source-only catalogue contexts use source/presentation.json too, but are not prepared lens packages.
    // prepareContextProvenance owns their in-memory catalogue records below; there are no R2 metadata files to read.
    if (sourcePresentation.schema !== 'cssearth-volume-presentation-source@1') continue;
    if (sourcePresentation.objectId !== id) throw new TypeError(`Mismatched volume presentation object: ${id}.`);
    const descriptor = parseObjectDescriptor(json(await input(`${base}/object.json`)));
    if (descriptor.id !== id || !descriptor.prepared || !['volume-lens-bank', 'image-layer-bank'].includes(descriptor.type))
      throw new TypeError(`Invalid prepared volume descriptor: ${id}.`);
    const provenance = validateObjectProvenance(json(await input(`${base}/prepared/provenance.json`)), id);
    const defaultLens = sourceId(sourcePresentation.defaultLens);
    const lensIds = sourceArray(sourcePresentation.lenses, raw => sourceId(sourceObject(raw).id));
    const prepared = parsePreparedVolumePresentation(json(await input(`${base}/prepared/presentation.json`)),
      { id, defaultLens, lenses: lensIds.map(lensId => ({ id: lensId })) }, provenance);
    const bankUrl = `${base}/${descriptor.prepared!.url}`;
    if (!provenance.products.flatMap(product => product.outputs).some(output => output.url === bankUrl)) throw new TypeError(`Unbound prepared bank: ${bankUrl}.`);
    const hostedBy = await hostedDatasets(root, base, id, prepared.controls.map(control => control.id), input);
    results.push({ id, name: sourceText(sourcePresentation.name), route: hostedBy?.route ?? `/sun/?focus=${id}`, base,
      controls: prepared.controls, defaultLens: prepared.defaultLens, provenance, outputs: [], ...(hostedBy ? { hostedBy } : {}) });
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
  let pipeline = sharp(bytes, { limitInputPixels: 50000000 });
  if (pin.crop) pipeline = pipeline.extract(pin.crop);
  const result = await pipeline.resize({ width: 768, height: 768, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
  const { width, height } = result.info;
  return { bytes: result.data, width, height };
}

/** Recover portable lineage from source-owned byte pins without replaying the cloud compiler. */
export async function prepareVolumeProvenance({ root = process.cwd(), objectId, input = path => readFile(resolve(root, path)), mirrorOrigin = null }: Options = {}): Promise<PreparedVolumeProvenance[]> {
  if (objectId !== undefined) sourceId(objectId);
  const results: PreparedVolumeProvenance[] = [];
  const generatorBytes = await input(volumeProvenanceCompilerClosure[0]);
  for (const path of volumeProvenanceCompilerClosure.slice(1)) await input(path);
  const folders = await readdir(resolve(root, 'src/objects'), { withFileTypes: true });
  for (const folder of folders.filter(folder => folder.isDirectory() && (objectId === undefined || folder.name === objectId)).sort((a, b) => a.name.localeCompare(b.name))) {
    const base = `src/objects/${folder.name}`, presentationPath = `${base}/source/presentation.json`;
    const presentationBytes = await readFile(resolve(root, presentationPath)).catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return null; throw error; });
    if (presentationBytes === null || sourceObject(json(presentationBytes)).schema !== 'cssearth-volume-presentation-source@1') continue;
    const ownedPresentationBytes = await input(presentationPath);
    const record = presentation(json(ownedPresentationBytes));
    if (record.objectId !== folder.name) throw new TypeError('Mismatched volume presentation object.');
    const manifestPath = `${base}/source/manifest.json`, manifestBytes = await input(manifestPath);
    const manifest = sourceObject(json(manifestBytes), ['schema', 'pathBase', 'inputs', 'documents', 'generatedIntermediates']);
    if (manifest.schema !== 'cssearth-volume-source-manifest@1' || manifest.pathBase !== 'repository') throw new TypeError('Invalid volume source manifest.');
    const descriptor = sourceObject(json(await input(`${base}/object.json`)));
    // Every manifest input is identified from its bytes when it is present: checked-in evidence through the source
    // reader, a restored download from the checkout. A download that is not restored is named by path alone.
    const inputs: ProvenanceSource[] = [];
    for (const raw of sourceArray(manifest.inputs, sourceObject)) {
      const path = sourcePath(raw.path);
      const bytes = path.startsWith('.local/')
        ? await readFile(resolve(root, path)).catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return null; throw error; })
        : await input(path);
      inputs.push(source(raw, bytes === null ? null : { sha256: sha256(bytes), bytes: bytes.length }));
    }
    const sources = [...inputs, ...(descriptor.type === 'image-layer-bank'
      ? await manifestSources({ documents: manifest.documents, generatedIntermediates: manifest.generatedIntermediates }, root, input) : [])];
    const bySource = new Map(sources.map(source => [source.id, source]));
    const prepared = sourceObject(descriptor.prepared);
    if (descriptor.id !== record.objectId || !((descriptor.type === 'volume-lens-bank' && prepared.format === 'cssearth-volume-lenses@1') ||
      (descriptor.type === 'image-layer-bank' && prepared.format === 'cssearth-image-layer-bank@1' && record.lenses.length === 1 && record.defaultLens === 'optical'))) throw new TypeError(`Invalid volume descriptor: ${record.objectId}`);
    const bankPath = `${base}/${sourcePath(prepared.url)}`;
    const installedBank = await readFile(resolve(root, bankPath)).catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return null; throw error; });
    const layerOutputs: { url: string; sha256: string; bytes: number; verification: string }[] = [];
    if (descriptor.type === 'image-layer-bank') {
      if (!bankPath.startsWith(`${base}/prepared/`)) throw new TypeError(`Image-layer delivery must be prepared: ${record.objectId}`);
      if (installedBank === null) throw new Error(`Image-layer bank required for complete delivery inventory: ${record.objectId}`);
      const bank = sourceObject(json(await input(bankPath))); // Retained small resource receipt, not image bytes.
      const resources = sourceArray(bank.resources, raw => {
        const resource = sourceObject(raw);
        return pin({ path: resource.path, sha256: resource.sha256, bytes: resource.bytes });
      });
      if (!resources.length) throw new Error(`Empty image-layer resource inventory: ${record.objectId}`);
      sourceUnique(resources.map(resource => resource.path), 'image-layer resource');
      for (const resource of resources) {
        const url = `${dirname(bankPath)}/${resource.path}`;
        const bytes = await readFile(resolve(root, url)).catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return null; throw error; });
        if (bytes !== null && (bytes.length !== resource.bytes || sha256(bytes) !== resource.sha256)) throw new Error(`Changed image-layer resource: ${url}`);
        layerOutputs.push({ url, sha256: resource.sha256, bytes: resource.bytes, verification: 'manifest-pin' });
      }
    }
    const recipes = [{ id: 'presentation', path: presentationPath, sha256: sha256(ownedPresentationBytes), parameters: provenanceJson(json(ownedPresentationBytes)) }];
    for (const recipe of record.recipes) {
      const bytes = await input(recipe.path);
      recipes.push({ id: recipe.id, path: recipe.path, sha256: sha256(bytes), parameters: provenanceJson(json(bytes)) });
    }
    const outputs: { path: string; text: string | Uint8Array }[] = [];
    const controls: Lens[] = [];
    const products = [];
    for (const [index, lens] of record.lenses.entries()) {
      const own = bySource.get(lens.input);
      if (!own || own.lensId !== lens.id) throw new TypeError(`Unbound volume lens image: ${record.objectId}/${lens.id}`);
      for (const evidence of lens.inputEvidence) if (!bySource.has(evidence.sourceId) || evidence.sourceId === lens.input)
        throw new TypeError(`Unknown or repeated lens input: ${record.objectId}/${lens.id}/${evidence.sourceId}`);
      const image = await preparePreview(root, lens.preview, input, { mirrorOrigin });
      const previewUrl = `/scenes/${record.objectId}/datasets/${sha256(image.bytes)}.webp`;
      outputs.push({ path: resolve(root, `public${previewUrl}`), text: image.bytes });
      controls.push({ id: lens.id, label: lens.label, title: lens.title, thumbnailUrl: previewUrl,
        texture: { url: previewUrl, width: image.width, height: image.height, attribution: { label: own.displayCredit ?? own.credit, url: own.sourceUrl } },
        description: lens.description, summary: lens.summary, detail: lens.detail, facts: lens.facts });
      products.push({ id: lens.id, label: lens.label, process: 'Apply the pinned source image to the shared prepared volume field; preserve the saved reconstruction and display settings.',
        recipe: 'presentation', selector: `/lenses/${index}`, recipeDependencies: recipes.map(recipe => recipe.id),
        inputs: [...new Set([lens.input, ...lens.inputEvidence.map(evidence => evidence.sourceId), ...record.sharedInputs])],
        inputEvidence: [{ sourceId: lens.input, role: 'appearance', evidence: `Selected image at source/presentation.json#/lenses/${index}/input.` }, ...lens.inputEvidence, ...record.inputEvidence], parents: [], lensIds: [lens.id],
        observationAttribution: 'source-lineage', interpretation: { kind: 'observation-conditioned-volume', sourceKind: 'published-display-image' }, limitations: [lens.description, lens.detail],
        outputs: [...(installedBank === null ? [] : [{ url: bankPath, sha256: sha256(installedBank), bytes: installedBank.length, verification: 'bytes-verified' }]),
          ...layerOutputs, { url: previewUrl, sha256: sha256(image.bytes), bytes: image.bytes.length, verification: 'bytes-verified' }] });
    }
    const provenance = validateObjectProvenance({ schema: 'cssearth-object-provenance@3', objectId: record.objectId, basis: 'recovered',
      manifest: { path: 'source/manifest.json' },
      generator: { path: volumeProvenanceCompilerClosure[0] },
      sources, recipes, products, coverage: { scope: 'object-datasets-and-bound-rendering-products', unresolved: [
        'Native source identities are recovered from checked-in pins; this metadata preparation does not rerun or scientifically validate the reconstruction.',
        ...(installedBank === null ? ['The current volume bank is not installed; only the source-preview outputs are represented.'] : [])
      ] } }, record.objectId);
    outputs.push({ path: resolve(root, `${base}/prepared/provenance.json`), text: stringify(provenance) },
      { path: resolve(root, `${base}/prepared/presentation.json`), text: stringify({ schema: 'cssearth-volume-presentation@1', objectId: record.objectId, controls, defaultLens: record.defaultLens }) });
    const publicPrefix = resolve(root, `public/scenes/${record.objectId}`) + '/';
    const publicAssets = outputs.filter(output => output.path.startsWith(publicPrefix)).map(output => {
      const bytes = Buffer.from(output.text);
      return { filename: output.path.slice(publicPrefix.length), location: 'public' as const, bytes: bytes.length, sha256: sha256(bytes) };
    });
    // The lens previews are the object's public entries. An image-layer bank's prepared entries are its bank, layers,
    // record and presentation; a volume-lens bank's prepared entries were written by its own bake and are kept.
    const current = await readInventory(record.objectId, resolve(root, base));
    const prefix = `${base}/prepared/`;
    const preparedOutputs = outputs.filter(output => output.path.startsWith(resolve(root, prefix) + '/')).map(output => {
      const bytes = Buffer.from(output.text);
      return { filename: output.path.slice(resolve(root, prefix).length + 1), bytes: bytes.length, sha256: sha256(bytes) };
    });
    const preparedAssets = descriptor.type === 'image-layer-bank'
      ? [{ filename: bankPath.slice(prefix.length), bytes: installedBank!.length, sha256: sha256(installedBank!) },
        ...layerOutputs.map(output => ({ filename: output.url.slice(prefix.length), bytes: output.bytes, sha256: output.sha256 })), ...preparedOutputs]
      : [...(current?.assets.filter(asset => asset.location === 'prepared' && !preparedOutputs.some(output => output.filename === asset.filename)) ?? []), ...preparedOutputs];
    const next = mergeInventory(mergeInventory(current, 'public', publicAssets), 'prepared', preparedAssets);
    outputs.push({ path: resolve(root, `${base}/inventory.json`), text: inventoryText(next) });
    const hostedBy = await hostedDatasets(root, base, record.objectId, record.lenses.map(lens => lens.id), input);
    results.push({ id: record.objectId, name: record.name, route: hostedBy?.route ?? `/sun/?focus=${record.objectId}`, base, controls, defaultLens: record.defaultLens, provenance, outputs,
      ...(hostedBy === undefined ? {} : { hostedBy }) });
  }
  if (objectId !== undefined && results.length !== 1) throw new TypeError(`No volume presentation for ${objectId}.`);
  return results;
}

/** Prepare every volume's presentation and provenance and write them as one set. Real callers opt into the mirror. */
export async function writeVolumeProvenance(options: Options = {}) {
  const results = await prepareVolumeProvenance(options);
  const outputs = results.flatMap(result => result.outputs);
  for (const output of outputs) await mkdir(dirname(output.path), { recursive: true });
  await writePreparedSet(outputs);
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some(arg => !/^--object=[a-z][a-z0-9-]*$/.test(arg)))
    throw new TypeError('Usage: prepare-volume-provenance [--object=<id>].');
  // The real CLI entry point: opts into the mirror explicitly (library code above defaults it off).
  const results = await writeVolumeProvenance({ mirrorOrigin: RUNTIME_ASSET_ORIGIN,
    ...(args[0] === undefined ? {} : { objectId: args[0].slice(9) }) });
  console.log(`Prepared volume presentation and provenance: ${results.length} objects, ${results.reduce((sum, result) => sum + result.controls.length, 0)} lenses.`);
}
