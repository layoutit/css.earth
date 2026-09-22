import { sha256 } from '../../src/platform/sha256.mts';
import type { ProductInputEvidence } from '../../src/platform/product-input-evidence.mts';
import { recordPreparationEvidence } from '../prepare/preparation-evidence.mts';
import {hasErrorCode} from '../sources/source-values.mts';
import {record, records, maybeRecord, text, namedRecords, identity, sourceEntry, provenanceManifest} from './provenance-records.mts';
import type {ProvenanceRecipeSource, ProductBinding, GeographicProvenance} from './provenance-records.mts';
type Identity = ReturnType<typeof identity>;
type BoundSource = ReturnType<typeof sourceEntry> & {id: string; kind: string; consumers?: readonly string[]};
type BoundProduct = Omit<ProductBinding, 'inputPaths' | 'urls' | 'inputRoles'> & {
  inputEvidence?: readonly ProductInputEvidence[]; inputs: string[]; outputs: (Identity & {url: string; verification: string})[]; inputBasis?: string;
};
interface PreparationOptions {objectDirectory: string; publicDirectory: string; outputDirectory?: string; basis?: 'prepared' | 'recovered'; verify?: boolean; write?: boolean;}
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { OBJECT_PROVENANCE_SCHEMA, validateObjectProvenance } from '../../src/platform/object-provenance.mts';
import { provenanceProducts } from './provenance-recipes.mts';


const json = async (path: string) => record(JSON.parse(await readFile(path, 'utf8')));
const optionalJson = async (path: string) => json(path).catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return null; throw error; });
const contained = (root: string, path: string) => {
  const result = resolve(root, path), offset = relative(root, result);
  if (offset === '..' || offset.startsWith('../') || offset.startsWith('..\\')) throw new TypeError(`Provenance path escapes its package: ${path}.`);
  return result;
};
async function fileIdentity(path: string) {
  const digest = createHash('sha256'); let bytes = 0;
  for await (const chunk of createReadStream(path)) { bytes += chunk.length; digest.update(chunk); }
  return { bytes, sha256: digest.digest('hex') };
}
function assertIdentity(actual: Identity, expected: Identity, path: string) {
  if (actual.sha256 !== expected.sha256 || actual.bytes !== expected.bytes) throw new Error(`Provenance identity mismatch: ${path}.`);
}

/**
 * Finalize lineage beside the prepared object, after its asset inventory exists.
 * Recovered records bind existing recipe/asset pins but never claim a new run.
 * A preparation run verifies the exact bound input and output bytes before
 * publishing its record. Source acquisition history remains attributed to the
 * source manifest/operation, not retroactively invented by this compiler.
 */
export async function prepareObjectProvenance({ objectDirectory, publicDirectory, outputDirectory = resolve(objectDirectory, 'prepared'), basis = 'recovered', verify = basis === 'prepared', write = true }: PreparationOptions) {
  if (!['prepared', 'recovered'].includes(basis) || (basis === 'prepared' && !verify)) throw new TypeError('Prepared provenance requires byte verification.');
  const sourceDirectory = resolve(objectDirectory, 'source');
  const descriptor = await json(resolve(objectDirectory, 'object.json')), id = text(descriptor.id);
  if (!/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError('Invalid provenance object identity.');
  const manifestBytes = await readFile(resolve(sourceDirectory, 'manifest.json'));
  const manifest = provenanceManifest(JSON.parse(manifestBytes.toString('utf8')));
  const recipes = new Map<string, ProvenanceRecipeSource>();
  const manifestPins = new Map([...manifest.inputs, ...manifest.documents, ...manifest.generatedIntermediates].map(entry => [`source/${entry.path}`, entry]));
  for (const input of records(record(record(descriptor.properties).recipe).sources)) {
    // The descriptor names its recipes; the manifest pins them.
    const path = text(input.path), pin = manifestPins.get(path);
    if (!pin) throw new Error(`Provenance recipe is not in the source manifest: ${id}/${path}.`);
    const bytes = await readFile(contained(objectDirectory, path));
    // A recipe is authored here, so its identity is its bytes.
    const reference = { id: text(input.id), path, sha256: sha256(bytes) };
    recipes.set(reference.id, { ...reference, parameters: record(JSON.parse(bytes.toString('utf8'))) });
  }
  const contentPath = recipes.get('content')?.path.replace(/^source\//u, '');
  const byPath = new Map<string, BoundSource>(manifest.inputs.map(input => [input.path, Object.assign({kind: 'source-input'}, input)]));
  for (const [defaultKind, entries] of [['source-document', manifest.documents], ['generated-intermediate', manifest.generatedIntermediates]] as const) {
    for (const entry of entries) {
      const content = entry.path === contentPath;
      const kind = content ? 'authored-content' : text(entry.kind ?? defaultKind);
      const authored = kind === 'authored-content' || kind === 'authored-document';
      // Keep existing content IDs; a manifest collection alone is not authorship.
      const id = text(entry.id ?? `${content ? 'authored-document' : kind}:${entry.path}`);
      byPath.set(entry.path, Object.assign({}, entry, {id, kind,
        origin: entry.origin ?? `object:source/${entry.path}`, title: entry.title ?? entry.purpose ?? entry.path,
        credit: entry.credit ?? (authored ? 'cssEarth contributors' : 'Credit not recorded in source manifest.'),
        acquisition: entry.acquisition ?? entry.generator ?? (authored ? 'Authored, pinned object-package document.' : 'Acquisition not recorded in source manifest.'),
        upstreamLineage: entry.upstreamLineage ?? 'not-recorded',
      }));
    }
  }
  const contentEntry = contentPath === undefined ? undefined : byPath.get(contentPath);
  if (contentEntry) contentEntry.kind = 'authored-content';
  const [lenses, assets, stagedInventory, acquisition, minimaps] = await Promise.all([
    optionalJson(resolve(outputDirectory, 'lenses.json')), optionalJson(resolve(outputDirectory, 'assets.json')),
    optionalJson(resolve(outputDirectory, 'inventory.json')), optionalJson(resolve(sourceDirectory, 'preparation/acquisition.json')),
    optionalJson(resolve(outputDirectory, 'minimaps.json')),
  ]);
  const inventory = stagedInventory ?? await json(resolve(objectDirectory, 'inventory.json'));
  const outputPins = new Map<string, Identity>(records(inventory.assets).filter(asset => asset.location === 'public').map(asset => [`/scenes/${id}/${text(asset.filename)}`, identity(asset)]));
  for (const [filename, value] of Object.entries(record(assets?.hashes ?? {}))) {
    // The inventory is the one owner of a published file's identity. A baked assets.json carries its own copy,
    // and `refresh-photographs` merges the previous map forward, so a rebaked file leaves a stale duplicate
    // behind. It fills gaps the inventory does not cover and never overrides it; the bytes themselves are
    // still verified against the pin below.
    const url = `/scenes/${id}/${filename}`;
    if (!outputPins.has(url)) outputPins.set(url, identity(value));
  }
  const geographic: GeographicProvenance = {};
  const noiseRecipe = maybeRecord(maybeRecord(recipes.get('paged-ellipsoid')?.parameters.geographic)?.noise);
  if (noiseRecipe) {
    const directory = text(noiseRecipe.directory);
    const pin = await json(contained(sourceDirectory, `${directory}/manifest.json`));
    const prepared = await optionalJson(resolve(outputDirectory, 'noise.json'));
    if (prepared) {
      if (!byPath.has(`${directory}/${pin.file}`)) throw new Error('Geographic provenance source is undeclared.');
      geographic.noise = { pin, prepared, directory };
      for (const page of records(prepared.roots)) {
        const pin = identity(page), url = text(page.url), previous = outputPins.get(url);
        if (previous) assertIdentity(pin, previous, url);
        outputPins.set(url, pin);
      }
    }
  }
  const { products: bindings, unresolved } = provenanceProducts({ id, recipes, manifest, lenses, assets, geographic, runtimeUrls: [...outputPins.keys()] });
  const sources = new Map<string, Record<string, unknown> & {id: string; dependencies: string[]}>(), products: BoundProduct[] = [], measuredOutputs = new Map<string, Identity>();
  const acquisitionOperations = records(acquisition?.operations ?? []);
  const bindSource = async (path: string, visiting = new Set<string>()): Promise<string> => {
    const entry = byPath.get(path);
    if (!entry) throw new Error(`Provenance input is not in the source manifest: ${id}/${path}.`);
    if (visiting.has(path)) throw new Error(`Cyclic acquisition dependency: ${path}.`);
    if (sources.has(entry.id)) return entry.id;
    const { consumers, ...record } = entry;
    // A source present in the checkout is identified from its bytes; a download that is not restored is named by path.
    const measured = await fileIdentity(contained(sourceDirectory, path)).catch((error: unknown) => { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; });
    const pin = measured ? { sha256: measured.sha256, bytes: measured.bytes } : {};
    const acquisitionOperation = acquisitionOperations.find(operation => operation.path === path) ?? null;
    const verificationOperations = acquisitionOperations.filter(operation => operation.expectedPath === path) ?? [];
    const dependencies = acquisitionOperation?.fileSource
      ? [await bindSource(text(acquisitionOperation.fileSource), new Set([...visiting, path]))] : [];
    if (acquisitionOperation?.kind === 'mapped-composition') {
      const recipePath = text(acquisitionOperation.recipePath), recipeEntry = byPath.get(recipePath);
      if (!recipeEntry) throw new Error(`Unbound composition recipe: ${recipePath}.`);
      const bytes = await readFile(contained(sourceDirectory, recipePath));
      // Recovery reads this recipe to discover dependencies.
      const {parseMappedCompositionRecipe} = await import('./acquisition/mapped-composition.mts');
      const plan = parseMappedCompositionRecipe(JSON.parse(bytes.toString('utf8')));
      if (!byPath.has(plan.input)) throw new Error(`Composition input is undeclared: ${plan.input}.`);
      const ancestors = new Set([...visiting, path]);
      dependencies.push(await bindSource(recipePath, ancestors), await bindSource(plan.input, ancestors));
    }
    sources.set(entry.id, { ...record, ...pin, dependencies,
      verification: measured ? 'bytes-verified' : 'download-not-present', acquisitionOperation, verificationOperations });
    return entry.id;
  };
  for (const binding of bindings) {
    const inputs = [];
    for (const path of binding.inputPaths) {
      inputs.push(await bindSource(path));
    }
    const outputs = [];
    for (const url of [...new Set(binding.urls)]) {
      let pin = outputPins.get(url);
      const local = url.startsWith('object:prepared/');
      const path = local ? contained(outputDirectory, url.slice('object:prepared/'.length))
        : contained(publicDirectory, url.slice(`/scenes/${id}/`.length));
      // A stale alias in lens metadata is not a consumed runtime output.
      // Only the published inventory and producer asset receipts establish that.
      if (!local && !pin) continue;
      if (verify || !pin) {
        let actual: Identity | null | undefined = measuredOutputs.get(url);
        if (!actual) {
          actual = await fileIdentity(path).catch((error: unknown) => { if (basis === 'recovered' && hasErrorCode(error, 'ENOENT')) return null; throw error; });
          if (actual) measuredOutputs.set(url, actual);
        }
        if (actual && pin) assertIdentity(actual, pin, url);
        if (!pin) pin = actual ?? undefined;
      }
      if (!pin) { unresolved.push({ product: binding.id, output: url, reason: 'Prepared output has no available identity.' }); continue; }
      outputs.push({ url, ...pin, verification: measuredOutputs.has(url) ? 'bytes-verified' : 'asset-manifest-pin' });
    }
    if (!outputs.length) { unresolved.push({ product: binding.id, reason: 'No prepared output is bound to this recipe operation.' }); continue; }
    const { inputPaths, urls, inputRoles, ...product } = binding;
    products.push({ ...product, inputs: [...new Set(inputs)], outputs,
      ...(inputRoles && Object.keys(inputRoles).length ? { inputEvidence: Object.entries(inputRoles).map(([path, evidence]) => ({ sourceId: sources.get(byPath.get(path)!.id)!.id, ...evidence })) } : {}),
      inputBasis: inputs.length || product.parents.length ? 'bound-inputs' : 'authored-recipe' });
  }
  // Minimap previews have their own outputs, but inherit the interpretation and
  // inputs of the source product. They never acquire provenance by URL matching.
  for (const preview of namedRecords(minimaps?.images ?? [])) {
    const parent = products.find(product => product.lensIds.includes(preview.id));
    if (!parent) continue;
    const path = contained(outputDirectory, text(preview.path));
    const identity = await fileIdentity(path).catch((error: unknown) => { if (basis === 'recovered' && hasErrorCode(error, 'ENOENT')) return null; throw error; });
    if (!identity) { unresolved.push({ product: `preview:${preview.id}`, reason: 'Prepared preview file is unavailable.' }); continue; }
    products.push({ id: `preview:${preview.id}`, label: `${parent.label} preview`, recipe: parent.recipe, selector: parent.selector,
      recipeDependencies: parent.recipeDependencies, observationAttribution: parent.observationAttribution,
      inputs: [], parents: [parent.id], lensIds: [], process: 'Prepare a small surface preview from the same interpreted dataset.',
      limitations: [], outputs: [{ url: `object:prepared/${preview.path}`, ...identity, verification: 'bytes-verified' }] });
  }
  const available = new Set(products.map(product => product.id));
  // Never silently drop a missing dependency while claiming its child is bound.
  for (const product of products) for (const parent of product.parents) {
    if (!available.has(parent)) throw new Error(`Unresolved provenance parent: ${id}/${product.id} -> ${parent}.`);
  }
  const usedRecipes = new Set(products.flatMap(product => product.recipeDependencies));
  const usedSources = new Set(products.flatMap(product => product.inputs));
  const includeDependencies = (sourceId: string): void => {
    const source = sources.get(sourceId);
    if (!source) throw new Error(`Missing provenance dependency: ${sourceId}.`);
    for (const dependency of source.dependencies) {
      if (!usedSources.has(dependency)) { usedSources.add(dependency); includeDependencies(dependency); }
    }
  };
  [...usedSources].forEach(includeDependencies);
  let document = validateObjectProvenance({
    schema: OBJECT_PROVENANCE_SCHEMA, objectId: id, basis,
    manifest: { path: 'source/manifest.json' },
    generator: { path: 'tools/objects/provenance.mts' },
    recipes: [...recipes.values()].filter(recipe => usedRecipes.has(recipe.id)),
    sources: [...sources.values()].filter(source => usedSources.has(source.id)), products,
    coverage: { scope: 'object-datasets-and-bound-rendering-products', unresolved },
  }, id);
  // The record is a function of the package's authored files alone; it never reads an earlier copy of itself.
  if (basis === 'prepared') document = validateObjectProvenance({ ...document, lastPreparation: recordPreparationEvidence(document) }, id);
  if (write) {
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(resolve(outputDirectory, 'provenance.json'), JSON.stringify(document, null, 2) + '\n');
  }
  return document;
}
