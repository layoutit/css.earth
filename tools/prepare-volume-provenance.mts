import { sha256 } from '../src/platform/sha256.mts';
import { parseProductInputEvidence } from '../src/platform/product-input-evidence.mts';
import type { ProductInputEvidence } from '../src/platform/product-input-evidence.mts';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { parseObjectDescriptor } from '@cssearth/objects';
import type { Lens } from '../site/planet-shell-types.ts';
import { validateDatasetText } from '../site/dataset-content.mts';
import { parsePreparedVolumePresentation } from '../site/volume-presentation.mts';
import { parseCapture } from '../src/platform/exploration-catalog.mts';
import { validateObjectProvenance } from '../src/platform/object-provenance.mts';
import type { ProvenanceDocument, ProvenanceSource, ProvenanceJson } from '../src/platform/object-provenance.mts';
import { parseSourceBinding, sourceArray, sourceDigest, sourceId, sourceObject, sourcePath, sourceText, sourceUnique, sourceUrl } from '../src/platform/source-catalog.mts';
import { hasErrorCode } from './source-values.mts';
import { writePreparedSet } from './write-prepared-set.mts';
import { manifestSources } from './context-source-records.mts';
import { composeSkyBandPng, skyBandCompositeFile, verifySkyBandRecipe } from './objects/observation/sky-band-composite.mts';
import { RUNTIME_ASSET_ORIGIN, fetchWithRetry, sourceCacheUrl } from './source-mirror.mts';

export const volumeProvenanceCompilerClosure = ['tools/prepare-volume-provenance.mts', 'site/dataset-content.mts', 'tools/context-source-records.mts',
  'tools/objects/observation/sky-band-composite.mts', 'tools/objects/observation/wise-atlas-mosaic.mts', 'tools/objects/color-transfer.mts', 'tools/fits.mts'] as const;

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
interface Preview extends Pin { url?: string; skyBands?: { path: string; sha256: string }; authoredFrom?: string;
  crop?: { left: number; top: number; width: number; height: number }; }
function preview(raw: unknown): Preview {
  const value = sourceObject(raw, ['path', 'sha256', 'bytes', 'url', 'skyBands', 'authoredFrom', 'crop']);
  const result: Preview = pin({ path: value.path, sha256: value.sha256, bytes: value.bytes });
  const kinds = [value.url, value.skyBands, value.authoredFrom].filter(candidate => candidate !== undefined);
  if (kinds.length !== 1) throw new TypeError('A preview names exactly one of a URL, a sky band recipe or the input it is drawn from.');
  if (value.authoredFrom !== undefined) result.authoredFrom = sourceId(value.authoredFrom);
  else if (value.url !== undefined) result.url = sourceUrl(value.url);
  else {
    const bands = sourceObject(value.skyBands, ['path', 'sha256']);
    result.skyBands = { path: sourcePath(bands.path), sha256: sourceDigest(bands.sha256) };
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
  objectId: string; name: string; defaultLens: string; bank: Pin; recipes: (Pin & { id: string })[];
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
  return { objectId: sourceId(value.objectId), name: sourceText(value.name), defaultLens, bank: pin(value.bank), lenses: [...lenses],
    sharedInputs: [...sourceArray(value.sharedInputs, sourceId)], inputEvidence: [...sourceArray(value.inputEvidence ?? [], parseProductInputEvidence)], recipes: [...sourceArray(value.recipes, raw => {
      const recipe = sourceObject(raw, ['id', 'path', 'sha256', 'bytes']);
      return { ...pin({ path: recipe.path, sha256: recipe.sha256, bytes: recipe.bytes }), id: sourceId(recipe.id) };
    })] };
}
function source(raw: unknown): ProvenanceSource {
  const value = sourceObject(raw, ['id', 'path', 'origin', 'sourceUrl', 'title', 'credit', 'displayCredit', 'acquisition', 'expectedSha256', 'expectedBytes', 'sourceBinding', 'capture', 'lensId', 'license', 'dependencies']);
  return { id: sourceId(value.id), kind: 'source-input', path: sourcePath(value.path), origin: sourceUrl(value.origin), sourceUrl: sourceUrl(value.sourceUrl),
    title: sourceText(value.title), credit: sourceText(value.credit), acquisition: sourceText(value.acquisition),
    sha256: sourceDigest(value.expectedSha256), bytes: integer(value.expectedBytes), sourceBinding: parseSourceBinding(value.sourceBinding),
    dependencies: [...sourceArray(value.dependencies, sourceId)], verification: 'manifest-pin',
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
    const bankPin = provenance.products.flatMap(product => product.outputs).find(output => output.url === bankUrl);
    if (!bankPin || bankPin.sha256 !== descriptor.prepared!.sha256) throw new TypeError(`Unbound prepared bank: ${bankUrl}.`);
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
  const path = resolve(root, pin.path);
  if (pin.skyBands) {
    // The recipe is source closure whether or not its composite is already cached.
    await verifySkyBandRecipe(pin.skyBands, input);
    const name = pin.path.split('/').at(-1);
    if (name !== skyBandCompositeFile(name?.split('.')[0] ?? '', pin.sha256)) throw new TypeError(`A sky band preview is cached under its own hash: ${pin.path}`);
  }
  // An authored preview is written and checked in by the package's own author, so it is source closure; every other
  // preview is a download or a cache and stays outside it.
  let bytes = pin.authoredFrom
    ? await input(pin.path).catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) throw new Error(`Authored preview is missing: ${pin.path}; run this object's source author.`); throw error; })
    : await readFile(path).catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return null; throw error; });
  if (bytes === null && pin.skyBands) {
    // The composite is pinned by its own hash, so our own content-addressed mirror can serve it (only when a caller
    // opted in), sha-verified before use. That keeps an ordinary build off the survey archive, whose availability is
    // outside this project: a miss, a mismatch or any mirror error composes from the archive exactly as before.
    if (mirrorOrigin) {
      const mirrorUrl = sourceCacheUrl(mirrorOrigin, pin.sha256, basename(pin.path));
      bytes = await fetchWithRetry(fetcher, mirrorUrl, { idleMs: 5000, attempts: 1 })
        .then(candidate => (candidate.length === pin.bytes && sha256(candidate) === pin.sha256) ? candidate : null)
        .catch(() => null);
    }
    // The survey bands download into the shared cache; only the pinned recipe and tile lists are source closure.
    if (bytes === null) bytes = (await composeSkyBandPng(pin.skyBands, { input, cache: resolve(root, '.local/nebula-lab/sky-bands') })).bytes;
    if (bytes.length !== pin.bytes || sha256(bytes) !== pin.sha256) throw new Error(`Changed sky band preview: ${pin.skyBands.path}`);
    await mkdir(dirname(path), { recursive: true }); await writeFile(path, bytes);
  } else if (bytes === null) {
    // Try the content-addressed mirror first (only when a caller opted in): it is our own reliable storage,
    // sha-verified before use. A miss, a mismatch or any mirror error falls back to the publisher URL, which stays
    // the provenance origin either way.
    if (mirrorOrigin) {
      const mirrorUrl = sourceCacheUrl(mirrorOrigin, pin.sha256, basename(pin.path));
      bytes = await fetchWithRetry(fetcher, mirrorUrl, { idleMs: 5000, attempts: 1 })
        .then(candidate => (candidate.length === pin.bytes && sha256(candidate) === pin.sha256) ? candidate : null)
        .catch(() => null);
    }
    // Capped at 3 attempts x 120s idle (~6 min worst case, not 30): a stalled publisher must not hang the build.
    if (bytes === null) bytes = await fetchWithRetry(fetcher, pin.url!, { idleMs: 120000, attempts: 3 })
      .catch((error: unknown) => { throw new Error(`Preview download failed: ${pin.url} (${error instanceof Error ? error.message : String(error)})`); });
    if (bytes.length !== pin.bytes || sha256(bytes) !== pin.sha256) throw new Error(`Changed publisher preview: ${pin.url}`);
    await mkdir(dirname(path), { recursive: true }); await writeFile(path, bytes);
  }
  if (bytes.length !== pin.bytes || sha256(bytes) !== pin.sha256) throw new Error(`Changed preview input: ${pin.path}`);
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
    const sources = [...sourceArray(manifest.inputs, source), ...(descriptor.type === 'image-layer-bank'
      ? await manifestSources({ documents: manifest.documents, generatedIntermediates: manifest.generatedIntermediates }, root, input) : [])];
    const bySource = new Map(sources.map(source => [source.id, source]));
    // Small checked-in evidence records are real compiler inputs. Original
    // rasters/table downloads remain recovered pins, outside source closure.
    for (const source of sources) if (!source.path.startsWith('.local/')) {
      const bytes = await input(source.path);
      if (sha256(bytes) !== source.sha256 || bytes.length !== source.bytes) throw new Error(`Changed volume evidence: ${source.path}`);
    }
    const prepared = sourceObject(descriptor.prepared);
    if (descriptor.id !== record.objectId || !((descriptor.type === 'volume-lens-bank' && prepared.format === 'cssearth-volume-lenses@1') ||
      (descriptor.type === 'image-layer-bank' && prepared.format === 'cssearth-image-layer-bank@1' && record.lenses.length === 1 && record.defaultLens === 'optical'))) throw new TypeError(`Invalid volume descriptor: ${record.objectId}`);
    const bankPath = `${base}/${sourcePath(prepared.url)}`, bankSha256 = sourceDigest(prepared.sha256);
    const installedBank = await readFile(resolve(root, bankPath)).catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return null; throw error; });
    if (installedBank !== null && sha256(installedBank) !== bankSha256) throw new Error(`Changed installed volume bank: ${record.objectId}`);
    // The descriptor owns the current bank identity. An ordinary rebake needs
    // no presentation edit. The source receipt only supplies size offline when
    // it still identifies precisely the descriptor's bank.
    const bankBytes = installedBank?.length ?? (bankPath === record.bank.path && bankSha256 === record.bank.sha256 ? record.bank.bytes : undefined);
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
      if (sha256(bytes) !== recipe.sha256 || bytes.length !== recipe.bytes) throw new Error(`Changed volume recipe: ${recipe.path}`);
      recipes.push({ id: recipe.id, path: recipe.path, sha256: recipe.sha256, parameters: provenanceJson(json(bytes)) });
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
        outputs: [...(bankBytes === undefined ? [] : [{ url: bankPath, sha256: bankSha256, bytes: bankBytes, verification: installedBank === null ? 'descriptor-pin' : 'bytes-verified' }]),
          ...layerOutputs, { url: previewUrl, sha256: sha256(image.bytes), bytes: image.bytes.length, verification: 'bytes-verified' }] });
    }
    const provenance = validateObjectProvenance({ schema: 'cssearth-object-provenance@3', objectId: record.objectId, basis: 'recovered',
      manifest: { path: 'source/manifest.json', sha256: sha256(manifestBytes) },
      generator: { path: volumeProvenanceCompilerClosure[0], sha256: sha256(generatorBytes), bindingsSha256: sha256(stringify(sources.map(source => source.sourceBinding))) },
      sources, recipes, products, coverage: { scope: 'object-datasets-and-bound-rendering-products', unresolved: [
        'Native source identities are recovered from checked-in pins; this metadata preparation does not rerun or scientifically validate the reconstruction.',
        ...(bankBytes === undefined ? ['The current volume bank is not installed and its byte count has no matching receipt; only the source-preview outputs are represented.'] : [])
      ] } }, record.objectId);
    outputs.push({ path: resolve(root, `${base}/prepared/provenance.json`), text: stringify(provenance) },
      { path: resolve(root, `${base}/prepared/presentation.json`), text: stringify({ schema: 'cssearth-volume-presentation@1', objectId: record.objectId, controls, defaultLens: record.defaultLens }) });
    const publicPrefix = resolve(root, `public/scenes/${record.objectId}`) + '/';
    const publicAssets = outputs.filter(output => output.path.startsWith(publicPrefix)).map(output => {
      const bytes = Buffer.from(output.text);
      return { filename: output.path.slice(publicPrefix.length), location: 'public' as const, bytes: bytes.length, sha256: sha256(bytes) };
    });
    if (descriptor.type === 'image-layer-bank') {
      const prefix = `${base}/prepared/`;
      const assets = [
        { filename: bankPath.slice(prefix.length), bytes: bankBytes, sha256: bankSha256 },
        ...layerOutputs.map(output => ({ filename: output.url.slice(prefix.length), bytes: output.bytes, sha256: output.sha256 })),
        ...outputs.filter(output => output.path.startsWith(resolve(root, prefix) + '/')).map(output => {
          const bytes = Buffer.from(output.text);
          return { filename: output.path.slice(resolve(root, prefix).length + 1), bytes: bytes.length, sha256: sha256(bytes) };
        }),
        ...publicAssets,
      ];
      const inventory = stringify({ schema: `css${record.objectId}-runtime-assets@1`, resourceRoot: 'prepared', assets });
      outputs.push({ path: resolve(root, `${base}/runtime-assets.json`), text: inventory });
    } else if (publicAssets.length) {
      // A volume-lens-bank object's baked volume field is inventoried separately by prepared-assets.json
      // (its `prepared/*` closure); it has no image-layer bank of its own here. Its lens dataset previews above
      // are still public `/scenes/<id>/datasets/*.webp` addresses, so `resolvePreparedAssetUrl` needs a
      // filename -> sha256 map for them once ASSET_ORIGIN is set — give them their own runtime-assets.json.
      const inventory = stringify({ schema: `css${record.objectId}-runtime-assets@1`, resourceRoot: 'prepared', assets: publicAssets });
      outputs.push({ path: resolve(root, `${base}/runtime-assets.json`), text: inventory });
    }
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
