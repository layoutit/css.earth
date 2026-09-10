import {requireRecord,requireArray,requireFiniteNumber} from '../../source-values.mts';
import {parseRadialLoaderConfig,parseRadialSnapshot} from './radial-source.mts';
import {parseSciencePalette} from './source-records.mts';
import {matchesPreparationGenerator} from '../../preparation-generator.mts';
/** Regenerate a source-surface context image for review. Does not change source
 * files or pins; normal object preparation verifies the reviewed image bytes. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createSourceManifest } from '../../../src/platform/source-manifest.mts';
import { loadRadialTerrain, requireTerrainMesh, createRadialScienceColorSampler } from './radial-terrain.mts';
import { createShapeSurfaceSampler } from './obj-shape.mts';
import { renderRadialSnapshot } from './radial-snapshot.mts';

const [id, output] = process.argv.slice(2);
if (!/^[a-z][a-z0-9-]*$/.test(id ?? '') || !output) throw new TypeError('Usage: prepare-source-surface-context.mts <object-id> <output.png>');
const sourceDirectory = resolve('src/planets', id, 'source');
const input=requireRecord(JSON.parse(await readFile(resolve(sourceDirectory, 'preparation/terrestrial.json'), 'utf8')));
const config=Object.assign({},parseRadialLoaderConfig(input),{raster:{width:requireFiniteNumber(requireRecord(input.raster).width)}});
const source = await createSourceManifest({ planetId: id, planetName: config.displayName ?? id, sourceRoot: sourceDirectory });
await source.verify();
const entry = source.manifest.generatedIntermediates.find(entry => matchesPreparationGenerator(entry.generator, 'tools/objects/terrestrial-layers/radial-snapshot.mts'));
const recipe=entry && requireRecord(requireRecord(entry).recipe);
const rawLens=requireArray(requireRecord(input.raster).scientific).map(value=>requireRecord(value)).find(lens=>lens.id===recipe?.lensId && lens.surfaceSampling);
const lens=rawLens && parseSciencePalette(rawLens);
if (!entry || !lens || !recipe) throw new TypeError('The context image must use a declared source-surface scientific lens.');
const radial = await loadRadialTerrain({ config, sourceDirectory, source });
if(!radial)throw new Error("Source context requires terrain.");
const sampleSurface = createRadialScienceColorSampler(createShapeSurfaceSampler(requireTerrainMesh(radial.grid), lens), lens, config);
const png = await renderRadialSnapshot({ ...parseRadialSnapshot(recipe), faces: radial.faces, sampleSurface });
await mkdir(dirname(resolve(output)), { recursive: true });
await writeFile(output, png);
console.log(JSON.stringify({ id, output: resolve(output), bytes: png.length, source: rawLens?.path, method: rawLens?.surfaceSampling }));
