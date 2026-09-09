import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { OBJECT_PROVENANCE_SCHEMA, validateObjectProvenance } from '../../src/platform/object-provenance.mjs';
import { provenanceProducts } from './provenance-recipes.mjs';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const optionalJson = async path => json(path).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
const contained = (root, path) => {
  const result = resolve(root, path), offset = relative(root, result);
  if (offset === '..' || offset.startsWith('../') || offset.startsWith('..\\')) throw new TypeError(`Provenance path escapes its package: ${path}.`);
  return result;
};
async function fileIdentity(path) {
  const digest = createHash('sha256'); let bytes = 0;
  for await (const chunk of createReadStream(path)) { bytes += chunk.length; digest.update(chunk); }
  return { bytes, sha256: digest.digest('hex') };
}
function assertIdentity(actual, expected, path) {
  if (actual.sha256 !== expected.sha256 || actual.bytes !== expected.bytes) throw new Error(`Provenance identity mismatch: ${path}.`);
}

/**
 * Finalize lineage beside the prepared object, after its asset inventory exists.
 * Recovered records bind existing recipe/asset pins but never claim a new run.
 * A preparation run verifies the exact bound input and output bytes before
 * publishing its record. Source acquisition history remains attributed to the
 * source manifest/operation, not retroactively invented by this compiler.
 */
export async function prepareObjectProvenance({ objectDirectory, publicDirectory, outputDirectory = resolve(objectDirectory, 'prepared'), basis = 'prepared', verify = basis === 'prepared', write = true }) {
  if (!['prepared', 'recovered'].includes(basis) || (basis === 'prepared' && !verify)) throw new TypeError('Prepared provenance requires byte verification.');
  const sourceDirectory = resolve(objectDirectory, 'source');
  const descriptor = await json(resolve(objectDirectory, 'object.json')), id = descriptor.id;
  if (!/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError('Invalid provenance object identity.');
  const manifestBytes = await readFile(resolve(sourceDirectory, 'manifest.json'));
  const manifest = JSON.parse(manifestBytes), byPath = new Map(manifest.inputs.map(input => [input.path, { kind: 'source-input', ...input }]));
  for (const [kind, entries] of [['authored-document', manifest.documents], ['generated-intermediate', manifest.generatedIntermediates]]) {
    for (const entry of entries ?? []) byPath.set(entry.path, { ...entry, id: entry.id ?? `${kind}:${entry.path}`, kind,
      origin: entry.origin ?? `object:source/${entry.path}`, title: entry.title ?? entry.purpose ?? entry.path,
      credit: entry.credit ?? 'cssEarth contributors', acquisition: entry.acquisition ?? entry.generator ?? 'Authored, pinned object-package document.',
      upstreamLineage: 'not-recorded',
    });
  }
  const recipes = new Map();
  for (const reference of descriptor.properties.recipe.sources) {
    const bytes = await readFile(contained(objectDirectory, reference.path));
    if (sha256(bytes) !== reference.sha256) throw new Error(`Provenance recipe changed: ${reference.path}.`);
    recipes.set(reference.id, { ...reference, parameters: JSON.parse(bytes) });
  }
  const contentPath = recipes.get('content')?.path.replace(/^source\//u, '');
  if (byPath.has(contentPath)) byPath.get(contentPath).kind = 'authored-content';
  const [lenses, assets, stagedInventory, acquisition, minimaps] = await Promise.all([
    optionalJson(resolve(outputDirectory, 'lenses.json')), optionalJson(resolve(outputDirectory, 'assets.json')),
    optionalJson(resolve(outputDirectory, 'runtime-assets.json')), optionalJson(resolve(sourceDirectory, 'preparation/acquisition.json')),
    optionalJson(resolve(outputDirectory, 'minimaps.json')),
  ]);
  const inventory = stagedInventory ?? await json(resolve(objectDirectory, 'runtime-assets.json'));
  const outputPins = new Map(inventory.assets.map(asset => [`/scenes/${id}/${asset.filename}`, { bytes: asset.bytes, sha256: asset.sha256 }]));
  for (const [filename, pin] of Object.entries(assets?.hashes ?? {})) {
    const url = `/scenes/${id}/${filename}`, existing = outputPins.get(url);
    if (existing) assertIdentity(pin, existing, url);
    outputPins.set(url, pin);
  }
  const geographic = {};
  const noiseRecipe = recipes.get('paged-ellipsoid')?.parameters.geographic?.noise;
  if (noiseRecipe) {
    const directory = noiseRecipe.directory;
    const pin = await json(contained(sourceDirectory, `${directory}/manifest.json`));
    const prepared = await optionalJson(resolve(outputDirectory, 'noise.json'));
    if (prepared) {
      if (prepared.sourceSha256 !== pin.decodedSha256) throw new Error('Geographic provenance uses a different decoded source.');
      const sourcePin = byPath.get(`${directory}/${pin.file}`);
      if (!sourcePin) throw new Error('Geographic provenance source is undeclared.');
      assertIdentity({ sha256: pin.sha256, bytes: pin.bytes }, { sha256: sourcePin.expectedSha256, bytes: sourcePin.expectedBytes }, pin.file);
      geographic.noise = { pin, prepared, directory };
      for (const page of prepared.roots) {
        const identity = { sha256: page.sha256, bytes: page.bytes }, previous = outputPins.get(page.url);
        if (previous) assertIdentity(identity, previous, page.url);
        outputPins.set(page.url, identity);
      }
    }
  }
  const { products: bindings, unresolved } = provenanceProducts({ id, recipes, manifest, lenses, assets, geographic, runtimeUrls: [...outputPins.keys()] });
  const sources = new Map(), products = [], measuredOutputs = new Map();
  const bindSource = async (path, visiting = new Set()) => {
    const entry = byPath.get(path);
    if (!entry) throw new Error(`Provenance input is not in the source manifest: ${id}/${path}.`);
    if (visiting.has(path)) throw new Error(`Cyclic acquisition dependency: ${path}.`);
    if (sources.has(entry.id)) return entry.id;
    const { expectedSha256, expectedBytes, consumers, ...record } = entry;
    const pin = { sha256: expectedSha256, bytes: expectedBytes };
    if (verify) assertIdentity(await fileIdentity(contained(sourceDirectory, path)), pin, path);
    const acquisitionOperation = acquisition?.operations?.find(operation => operation.path === path) ?? null;
    const verificationOperations = acquisition?.operations?.filter(operation => operation.expectedPath === path) ?? [];
    const dependencies = acquisitionOperation?.fileSource
      ? [await bindSource(acquisitionOperation.fileSource, new Set([...visiting, path]))] : [];
    sources.set(entry.id, { ...record, ...pin, dependencies,
      verification: verify ? 'bytes-verified' : 'manifest-pin', acquisitionOperation, verificationOperations });
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
        let actual = measuredOutputs.get(url);
        if (!actual) {
          actual = await fileIdentity(path).catch(error => { if (basis === 'recovered' && error.code === 'ENOENT') return null; throw error; });
          if (actual) measuredOutputs.set(url, actual);
        }
        if (actual && pin) assertIdentity(actual, pin, url);
        if (!pin) pin = actual;
      }
      if (!pin) { unresolved.push({ product: binding.id, output: url, reason: 'Prepared output has no available identity.' }); continue; }
      outputs.push({ url, ...pin, verification: measuredOutputs.has(url) ? 'bytes-verified' : 'asset-manifest-pin' });
    }
    if (!outputs.length) { unresolved.push({ product: binding.id, reason: 'No prepared output is bound to this recipe operation.' }); continue; }
    const { inputPaths, urls, ...product } = binding;
    products.push({ ...product, inputs: [...new Set(inputs)], outputs,
      inputBasis: inputs.length || product.parents.length ? 'bound-inputs' : 'authored-recipe' });
  }
  // Minimap previews have their own outputs, but inherit the interpretation and
  // inputs of the source product. They never acquire provenance by URL matching.
  for (const preview of minimaps?.images ?? []) {
    const parent = products.find(product => product.lensIds.includes(preview.id));
    if (!parent) continue;
    const path = contained(outputDirectory, preview.path);
    const identity = await fileIdentity(path).catch(error => { if (basis === 'recovered' && error.code === 'ENOENT') return null; throw error; });
    if (!identity) { unresolved.push({ product: `preview:${preview.id}`, reason: 'Prepared preview file is unavailable.' }); continue; }
    products.push({ id: `preview:${preview.id}`, label: `${parent.label} preview`, recipe: parent.recipe, selector: parent.selector,
      recipeDependencies: parent.recipeDependencies,
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
  const includeDependencies = sourceId => {
    for (const dependency of sources.get(sourceId).dependencies) {
      if (!usedSources.has(dependency)) { usedSources.add(dependency); includeDependencies(dependency); }
    }
  };
  [...usedSources].forEach(includeDependencies);
  const document = validateObjectProvenance({
    schema: OBJECT_PROVENANCE_SCHEMA, objectId: id, basis,
    manifest: { path: 'source/manifest.json', sha256: sha256(manifestBytes) },
    generator: { path: 'tools/objects/provenance.mjs', sha256: sha256(await readFile(new URL('./provenance.mjs', import.meta.url))),
      bindingsSha256: sha256(await readFile(new URL('./provenance-recipes.mjs', import.meta.url))) },
    recipes: [...recipes.values()].filter(recipe => usedRecipes.has(recipe.id)),
    sources: [...sources.values()].filter(source => usedSources.has(source.id)), products,
    coverage: { scope: 'object-datasets-and-bound-rendering-products', unresolved },
  }, id);
  if (write) {
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(resolve(outputDirectory, 'provenance.json'), JSON.stringify(document, null, 2) + '\n');
  }
  return document;
}
