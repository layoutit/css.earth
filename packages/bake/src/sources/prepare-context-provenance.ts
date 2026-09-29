import { sha256 } from '@cssearth/core/node';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sourceArray, sourceObject, sourcePath, sourceText } from '@cssearth/objects/sources';
import { validateObjectProvenance } from '@cssearth/objects/provenance';
import { manifestSources } from './context-source-records.ts';
import { requireInventory, mergeInventory, inventoryText } from '@cssearth/objects/node';
import { VOLUME_METADATA_FILENAMES } from '../delivery/index.ts';
export const contextProvenanceCompilerClosure = ['packages/bake/src/sources/prepare-context-provenance.ts', 'packages/bake/src/sources/context-source-records.ts'];
/** Compile each context package's provenance record and presentation from its manifest, recipes and inventory. `route`
 * is the application route that shows the context objects; the application passes it in. */
export async function prepareContextProvenance({ route, root = process.cwd(), input = (path: string) => readFile(resolve(root, path)) }: {
  route: string; root?: string; input?: (path: string) => Promise<Buffer>;
}) {
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
    // The context's baked outputs are listed by its inventory; the record and presentation written below join them there.
    const inventory = requireInventory(id, JSON.parse((await input(`${base}/inventory.json`)).toString()));
    const listed = inventory.assets.filter(asset => asset.location === 'prepared' && !VOLUME_METADATA_FILENAMES.includes(asset.filename as typeof VOLUME_METADATA_FILENAMES[number]));
    const descriptorPath = `${base}/object.json`;
    const descriptorBytes = await readFile(resolve(root, descriptorPath)).catch((error: unknown) => { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null; throw error; });
    if (descriptorBytes) {
      const descriptor = sourceObject(JSON.parse((await input(descriptorPath)).toString()));
      const bankPath = sourcePath(sourceObject(descriptor.prepared).url);
      if (!listed.some(asset => asset.filename === bankPath || asset.filename === bankPath.replace(/^prepared\//u, ''))) throw new Error(`${id}: inventory.json lists no prepared descriptor bank ${bankPath}.`);
    }
    const recipes = [], products = [], runtimeAssets = [];
    for (const [index, value] of sourceArray(presentation.products, sourceObject).entries()) {
      const recipePath = `${base}/${sourcePath(value.recipe)}`, recipeBytes = await input(recipePath);
      const outputs = [];
      for (const path of sourceArray(value.outputs, sourcePath)) {
        if (!path.startsWith('prepared/')) throw new TypeError('Context output must be prepared.');
        const expected = listed.find(asset => asset.filename === path || asset.filename === path.slice(9));
        if (!expected) throw new Error(`${id}: inventory.json lists no context output ${path}.`);
        if (!Number.isSafeInteger(expected.bytes) || expected.bytes <= 0) throw new TypeError(`${id}: inventory.json records ${expected.bytes} bytes for ${path}.`);
        outputs.push({ url: `${base}/${path}`, bytes: expected.bytes, verification: 'inventory-listed' });
        // The inventory row itself is carried forward unchanged.
        runtimeAssets.push({ filename: expected.filename, sha256: expected.sha256, bytes: expected.bytes });
      }
      recipes.push({ id: `recipe-${index}`, path: recipePath, parameters: JSON.parse(recipeBytes.toString()) });
      products.push({ id: sourceText(value.id), label: sourceText(value.label), process: sourceText(value.process),
        recipe: `recipe-${index}`, selector: value.selector === '/' || value.selector === '' ? '' : sourceText(value.selector), recipeDependencies: [`recipe-${index}`],
        inputs: [...sourceArray(value.inputs, sourceText)], parents: [], lensIds: [], observationAttribution: 'none',
        interpretation: sourceObject(value.interpretation), limitations: [...sourceArray(value.limitations, sourceText)], outputs });
    }
    const provenance = validateObjectProvenance({ schema: 'cssearth-object-provenance@3', objectId: id, basis: 'recovered',
      manifest: { path: 'source/manifest.json' },
      generator: { path: contextProvenanceCompilerClosure[0] },
      sources, recipes, products, coverage: { scope: 'object-datasets-and-bound-rendering-products', unresolved: [
        'Byte and lineage checks do not establish scientific completeness or visual qualification.'
      ] } }, id);
    const metadata = [
      { filename: 'provenance.json', text: JSON.stringify(provenance, null, 2) + '\n' },
      { filename: 'presentation.json', text: JSON.stringify({ name: sourceText(presentation.name), products: products.map(({ id, label, limitations }) => ({ id, label, limitations })) }, null, 2) + '\n' }
    ];
    // New inventory rows name the written record and presentation by their R2 content addresses.
    for (const item of metadata) runtimeAssets.push({ filename: item.filename, bytes: Buffer.byteLength(item.text), sha256: sha256(item.text) });
    const next = mergeInventory(inventory, 'prepared', runtimeAssets);
    const outputs = [...metadata.map(item => ({ path: resolve(root, base, 'prepared', item.filename), text: item.text })),
      { path: resolve(root, base, 'inventory.json'), text: inventoryText(next) }];
    results.push({ id, name: sourceText(presentation.name), route, base, controls: [], provenance, outputs });
  }
  return results;
}
