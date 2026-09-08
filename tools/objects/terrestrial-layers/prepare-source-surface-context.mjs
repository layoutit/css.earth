/** Regenerate a source-surface context image for review. Does not change source
 * files or pins; normal object preparation verifies the reviewed image bytes. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createSourceManifest } from '../../../src/platform/source-manifest.mjs';
import { loadRadialTerrain, createRadialScienceColorSampler } from './radial-terrain.mjs';
import { createShapeSurfaceSampler } from './obj-shape.mjs';
import { renderRadialSnapshot } from './radial-snapshot.mjs';

const [id, output] = process.argv.slice(2);
if (!/^[a-z][a-z0-9-]*$/.test(id ?? '') || !output) throw new TypeError('Usage: prepare-source-surface-context.mjs <object-id> <output.png>');
const sourceDirectory = resolve('src/planets', id, 'source');
const config = JSON.parse(await readFile(resolve(sourceDirectory, 'preparation/terrestrial.json'), 'utf8'));
const source = await createSourceManifest({ planetId: id, planetName: config.displayName, sourceRoot: sourceDirectory });
await source.verify();
const entry = source.manifest.generatedIntermediates.find(entry => entry.generator === 'tools/objects/terrestrial-layers/radial-snapshot.mjs');
const lens = config.raster.scientific.find(lens => lens.id === entry?.recipe?.lensId && lens.surfaceSampling);
if (!entry || !lens) throw new TypeError('The context image must use a declared source-surface scientific lens.');
const radial = await loadRadialTerrain({ config, sourceDirectory, source });
const sampleSurface = createRadialScienceColorSampler(createShapeSurfaceSampler(radial.grid, lens), lens, config);
const png = await renderRadialSnapshot({ ...entry.recipe, faces: radial.faces, sampleSurface });
await mkdir(dirname(resolve(output)), { recursive: true });
await writeFile(output, png);
console.log(JSON.stringify({ id, output: resolve(output), bytes: png.length, source: lens.path, method: lens.surfaceSampling }));
