import { sha256 } from '../src/platform/sha256.mts';
import { parseProductInputEvidence } from '../src/platform/product-input-evidence.mts';
import type { ProductInputEvidence } from '../src/platform/product-input-evidence.mts';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import type { Lens } from '../site/planet-shell-types.ts';
import { validateDatasetText } from '../site/dataset-content.mts';
import { parseCapture } from '../src/platform/exploration-catalog.mts';
import { validateObjectProvenance } from '../src/platform/object-provenance.mts';
import type { ProvenanceDocument, ProvenanceSource, ProvenanceJson } from '../src/platform/object-provenance.mts';
import { parseSourceBinding, sourceArray, sourceDigest, sourceId, sourceObject, sourcePath, sourceText, sourceUnique, sourceUrl } from '../src/platform/source-catalog.mts';
import { hasErrorCode } from './source-values.mts';
import { writePreparedSet } from './write-prepared-set.mts';
import { manifestSources } from './context-source-records.mts';
import { composeSkyBandPng } from './objects/observation/sky-band-composite.mts';

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
/** A preview is either a publisher image downloaded by URL or composed from a pinned sky band recipe. */
interface Preview extends Pin { url?: string; skyBands?: { path: string; sha256: string }; crop?: { left: number; top: number; width: number; height: number }; }
function preview(raw: unknown): Preview {
  const value = sourceObject(raw, ['path', 'sha256', 'bytes', 'url', 'skyBands', 'crop']);
  const result: Preview = pin({ path: value.path, sha256: value.sha256, bytes: value.bytes });
  if ((value.url === undefined) === (value.skyBands === undefined)) throw new TypeError('A preview names either a URL or a sky band recipe.');
  if (value.url !== undefined) result.url = sourceUrl(value.url);
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
}
interface Presentation {
  objectId: string; name: string; defaultLens: string; bank: Pin; recipes: (Pin & { id: string })[];
  sharedInputs: string[]; inputEvidence: ProductInputEvidence[]; lenses: LensRecord[];
}
function presentation(raw: unknown): Presentation {
  const value = sourceObject(raw, ['schema', 'objectId', 'name', 'defaultLens', 'bank', 'recipes', 'sharedInputs', 'inputEvidence', 'lenses']);
  if (value.schema !== 'cssearth-volume-presentation-source@1') throw new TypeError('Invalid volume presentation source.');
  const lenses = sourceArray(value.lenses, raw => {
    const lens = sourceObject(raw, ['id', 'label', 'title', 'description', 'summary', 'detail', 'facts', 'input', 'preview']);
    const result = { id: sourceId(lens.id), label: sourceText(lens.label), title: sourceText(lens.title), description: sourceText(lens.description),
      summary: sourceText(lens.summary), detail: sourceText(lens.detail), input: sourceId(lens.input), preview: preview(lens.preview),
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
}
interface Options {
  root?: string;
  /** Repository-relative, tracked compiler inputs only. Downloads never enter source closure. */
  input?: (path: string) => Promise<Buffer>;
}

async function preparePreview(root: string, pin: Preview, input: (path: string) => Promise<Buffer>): Promise<{ bytes: Buffer; width: number; height: number }> {
  const path = resolve(root, pin.path);
  let bytes = await readFile(path).catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return null; throw error; });
  if (bytes === null && pin.skyBands) {
    // The survey bands download into the shared cache; only the pinned recipe and tile lists are source closure.
    bytes = (await composeSkyBandPng(pin.skyBands, { input, cache: resolve(root, '.local/nebula-lab/sky-bands') })).bytes;
    if (bytes.length !== pin.bytes || sha256(bytes) !== pin.sha256) throw new Error(`Changed sky band preview: ${pin.skyBands.path}`);
    await mkdir(dirname(path), { recursive: true }); await writeFile(path, bytes);
  } else if (bytes === null) {
    const response = await fetch(pin.url!, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`Preview download failed: ${response.status} ${pin.url}`);
    bytes = Buffer.from(await response.arrayBuffer());
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
export async function prepareVolumeProvenance({ root = process.cwd(), input = path => readFile(resolve(root, path)) }: Options = {}): Promise<PreparedVolumeProvenance[]> {
  const results: PreparedVolumeProvenance[] = [];
  const generatorBytes = await input(volumeProvenanceCompilerClosure[0]);
  for (const path of volumeProvenanceCompilerClosure.slice(1)) await input(path);
  const folders = await readdir(resolve(root, 'src/objects'), { withFileTypes: true });
  for (const folder of folders.filter(folder => folder.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
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
      const image = await preparePreview(root, lens.preview, input);
      const previewUrl = `/scenes/${record.objectId}/datasets/${sha256(image.bytes)}.webp`;
      outputs.push({ path: resolve(root, `public${previewUrl}`), text: image.bytes });
      controls.push({ id: lens.id, label: lens.label, title: lens.title, thumbnailUrl: previewUrl,
        texture: { url: previewUrl, width: image.width, height: image.height, attribution: { label: own.displayCredit ?? own.credit, url: own.sourceUrl } },
        description: lens.description, summary: lens.summary, detail: lens.detail, facts: lens.facts });
      products.push({ id: lens.id, label: lens.label, process: 'Apply the pinned source image to the shared prepared volume field; preserve the saved reconstruction and display settings.',
        recipe: 'presentation', selector: `/lenses/${index}`, recipeDependencies: recipes.map(recipe => recipe.id),
        inputs: [...new Set([lens.input, ...record.sharedInputs])],
        inputEvidence: [{ sourceId: lens.input, role: 'appearance', evidence: `Selected image at source/presentation.json#/lenses/${index}/input.` }, ...record.inputEvidence], parents: [], lensIds: [lens.id],
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
    if (descriptor.type === 'image-layer-bank') {
      const prefix = `${base}/prepared/`;
      const assets = [
        { filename: bankPath.slice(prefix.length), bytes: bankBytes, sha256: bankSha256 },
        ...layerOutputs.map(output => ({ filename: output.url.slice(prefix.length), bytes: output.bytes, sha256: output.sha256 })),
        ...outputs.filter(output => output.path.startsWith(resolve(root, prefix) + '/')).map(output => {
          const bytes = Buffer.from(output.text);
          return { filename: output.path.slice(resolve(root, prefix).length + 1), bytes: bytes.length, sha256: sha256(bytes) };
        }),
        ...outputs.filter(output => output.path.startsWith(resolve(root, `public/scenes/${record.objectId}`) + '/')).map(output => {
          const bytes = Buffer.from(output.text);
          return { filename: output.path.slice(resolve(root, `public/scenes/${record.objectId}`).length + 1), location: 'public', bytes: bytes.length, sha256: sha256(bytes) };
        }),
      ];
      const inventory = stringify({ schema: `css${record.objectId}-runtime-assets@1`, resourceRoot: 'prepared', assets });
      outputs.push({ path: resolve(root, `${base}/runtime-assets.json`), text: inventory });
    }
    results.push({ id: record.objectId, name: record.name, route: `/sun/?focus=${record.objectId}`, base, controls, defaultLens: record.defaultLens, provenance, outputs });
  }
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const results = await prepareVolumeProvenance();
  const outputs = results.flatMap(result => result.outputs);
  for (const output of outputs) await mkdir(dirname(output.path), { recursive: true });
  await writePreparedSet(outputs);
  console.log(`Prepared volume presentation and provenance: ${results.length} objects, ${results.reduce((sum, result) => sum + result.controls.length, 0)} lenses.`);
}
