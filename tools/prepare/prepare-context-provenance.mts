import { sha256 } from '../../src/platform/sha256.mts';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sourceArray, sourceObject, sourcePath, sourceText, sourceDigest } from '../../src/platform/source-catalog.mts';
import { validateObjectProvenance } from '../../src/platform/object-provenance.mts';
import { manifestSources } from '../sources/context-source-records.mts';
export const contextProvenanceCompilerClosure = ['tools/prepare/prepare-context-provenance.mts', 'tools/sources/context-source-records.mts'];
export async function prepareContextProvenance({ root = process.cwd(), input = (path: string) => readFile(resolve(root, path)) } = {}) {
  const results = [];
  const generator = await input(contextProvenanceCompilerClosure[0]!);
  for (const path of contextProvenanceCompilerClosure.slice(1)) await input(path);
  for (const folder of (await readdir(resolve(root, 'src/objects'), { withFileTypes: true })).sort((a,b)=>a.name.localeCompare(b.name))) {
    if (!folder.isDirectory()) continue;
    const id = folder.name, base = `src/objects/${id}`, presentationPath = `${base}/source/presentation.json`;
    const bytes = await readFile(resolve(root, presentationPath)).catch((error: unknown) => { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null; throw error; });
    if (!bytes) continue;
    const raw = sourceObject(JSON.parse(bytes.toString()));
    if (!raw.provenance) continue;
    const presentation = sourceObject(raw.provenance);
    await input(presentationPath);
    const manifestBytes = await input(`${base}/source/manifest.json`), manifest = sourceObject(JSON.parse(manifestBytes.toString()));
    if (manifest.schema !== 'cssearth-volume-source-manifest@1' || manifest.pathBase !== 'repository') throw new TypeError(`Invalid context manifest: ${id}`);
    const sources = await manifestSources(manifest, root, input);
    // The receipt is the context's own output inventory, tracked beside object.json; runtime-assets.json is derived from it below.
    const receipt = sourceObject(JSON.parse((await input(`${base}/prepared-receipt.json`)).toString()));
    const pins = sourceArray(receipt.outputs, sourceObject);
    const descriptorPath = `${base}/object.json`;
    const descriptorBytes = await readFile(resolve(root, descriptorPath)).catch((error: unknown) => { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null; throw error; });
    if (descriptorBytes) {
      const descriptor = sourceObject(JSON.parse((await input(descriptorPath)).toString()));
      const prepared = sourceObject(descriptor.prepared);
      const bankPath = sourcePath(prepared.url);
      const bankPin = pins.find(pin => pin.path === bankPath || pin.path === bankPath.replace(/^prepared\//u, ''));
      if (!bankPin || bankPin.sha256 !== prepared.sha256) throw new Error(`Changed prepared descriptor bank: ${id}`);
    }
    const recipes = [], products = [], runtimeAssets = [];
    for (const [index, value] of sourceArray(presentation.products, sourceObject).entries()) {
      const recipePath = `${base}/${sourcePath(value.recipe)}`, recipeBytes = await input(recipePath);
      const outputs = [];
      for (const path of sourceArray(value.outputs, sourcePath)) {
        if (!path.startsWith('prepared/')) throw new TypeError('Context output must be prepared.');
        const expected = pins.find(pin => pin.path === path || pin.path === path.slice(9));
        if (!expected) throw new Error(`Unpinned context output: ${id}/${path}`);
        const installed = await readFile(resolve(root, base, path)).catch((error: unknown) => {
          if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null; throw error;
        });
        if (installed && (sha256(installed) !== expected.sha256 || installed.length !== expected.bytes)) throw new Error(`Unpinned context output: ${id}/${path}`);
        if (typeof expected.bytes !== 'number' || !Number.isSafeInteger(expected.bytes) || expected.bytes <= 0) throw new TypeError('Invalid context output size');
        const pin = { url: `${base}/${path}`, sha256: sourceDigest(expected.sha256), bytes: expected.bytes, verification: 'manifest-pin' };
        outputs.push(pin); runtimeAssets.push({ filename: path.slice(9), sha256: pin.sha256, bytes: pin.bytes });
      }
      recipes.push({ id: `recipe-${index}`, path: recipePath, sha256: sha256(recipeBytes), parameters: JSON.parse(recipeBytes.toString()) });
      products.push({ id: sourceText(value.id), label: sourceText(value.label), process: sourceText(value.process),
        recipe: `recipe-${index}`, selector: value.selector === '/' || value.selector === '' ? '' : sourceText(value.selector), recipeDependencies: [`recipe-${index}`],
        inputs: [...sourceArray(value.inputs, sourceText)], parents: [], lensIds: [], observationAttribution: 'none',
        interpretation: sourceObject(value.interpretation), limitations: [...sourceArray(value.limitations, sourceText)], outputs });
    }
    const provenance = validateObjectProvenance({ schema: 'cssearth-object-provenance@3', objectId: id, basis: 'recovered',
      manifest: { path: 'source/manifest.json', sha256: sha256(manifestBytes) },
      generator: { path: contextProvenanceCompilerClosure[0], sha256: sha256(generator), bindingsSha256: sha256(JSON.stringify(sources.map(source => source.sourceBinding))) },
      sources, recipes, products, coverage: { scope: 'object-datasets-and-bound-rendering-products', unresolved: [
        'Byte and lineage checks do not establish scientific completeness or visual qualification.'
      ] } }, id);
    const metadata = [
      { filename: 'provenance.json', text: JSON.stringify(provenance, null, 2) + '\n' },
      { filename: 'presentation.json', text: JSON.stringify({ name: sourceText(presentation.name), products: products.map(({ id, label, limitations }) => ({ id, label, limitations })) }, null, 2) + '\n' }
    ];
    for (const item of metadata) runtimeAssets.push({ filename: item.filename, bytes: Buffer.byteLength(item.text), sha256: sha256(item.text) });
    const inventory = JSON.stringify({ schema: `css${id}-runtime-assets@1`, resourceRoot: 'prepared', assets: runtimeAssets }, null, 2) + '\n';
    const outputs = [...metadata.map(item => ({ path: resolve(root, base, 'prepared', item.filename), text: item.text })),
      { path: resolve(root, base, 'runtime-assets.json'), text: inventory }];
    results.push({ id, name: sourceText(presentation.name), route: '/sun/', base, controls: [], provenance, outputs });
  }
  return results;
}
