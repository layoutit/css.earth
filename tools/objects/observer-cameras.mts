/**
 * Derive the controlled-camera fields of a body's ground-based photograph lens from its pinned inputs, and write them
 * into the recipe. The body's `source/preparation/observer-cameras.json` names the rotation model, the Horizons tables
 * and the centre rule; the frames' own headers state their exposures; the lens mesh places the limb.
 *
 *   node tools/objects/observer-cameras.mts <object-id>          report the derived fields beside the stated ones
 *   node tools/objects/observer-cameras.mts <object-id> --write  state the derived fields in the recipe and re-pin it
 */
import { sha256 } from '../../src/platform/sha256.mts';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireArray, requireRecord } from '../sources/source-values.mts';
import { deriveObserverCameras, loadObserverCameraInputs, recipeFields } from './terrestrial-layers/observer-cameras.mts';
import { loadCameraShape } from './terrestrial-layers/shape-camera-mosaic.mts';
import { radialTerrainForLens } from './terrestrial-layers/radial-models.mts';

const ROOT = resolve(import.meta.dirname, '../..');
const [objectId, flag] = process.argv.slice(2);
if (!objectId || (flag !== undefined && flag !== '--write')) { console.error('usage: node tools/objects/observer-cameras.mts <object-id> [--write]'); process.exit(2); }

const sourceDirectory = resolve(ROOT, 'src/objects', objectId, 'source');
const { record, recipe, lens, frames } = await loadObserverCameraInputs(sourceDirectory);
const mesh = await loadCameraShape(sourceDirectory, radialTerrainForLens(recipe as unknown as Parameters<typeof radialTerrainForLens>[0], record.lensId));
const derived = await deriveObserverCameras(sourceDirectory, record, frames, mesh, ROOT);

const KEYS = ['observerLatitude', 'observerWestLongitude', 'sunLatitude', 'sunWestLongitude', 'rangeKm', 'northAzimuthDegrees', 'pixelAngleMicroradians', 'center'] as const;
let differences = 0;
for (const [index, camera] of derived.entries()) {
  const stated = frames[index].stated, fields = recipeFields(camera);
  const changed = KEYS.filter(key => JSON.stringify(stated[key]) !== JSON.stringify(fields[key]));
  differences += changed.length;
  console.log(`${camera.id}  ${camera.exposure.start} +${(camera.exposure.exposureSeconds / 2).toFixed(1)} s  W ${fields.observerWestLongitude}  az ${fields.northAzimuthDegrees}  centre ${fields.center.join(',')} (limb ${camera.limb.limbBins} bins, ${camera.limb.iterations} it)  phase ${camera.phaseDegrees.toFixed(2)}`
    + (changed.length ? `\n    differs from the recipe in ${changed.map(key => `${key}: ${JSON.stringify(stated[key])} → ${JSON.stringify(fields[key])}`).join('; ')}` : ''));
}
console.log(differences ? `${differences} field(s) differ from the recipe.` : 'The recipe states the derived fields.');

if (flag === '--write') {
  const recipePath = resolve(sourceDirectory, 'preparation/terrestrial.json');
  if (differences) {
    const document = requireRecord(JSON.parse(await readFile(recipePath, 'utf8')));
    const lenses = requireArray(requireRecord(document.raster).surfaceObservations).map(value => requireRecord(value));
    const target = lenses.find(entry => entry.id === lens.id);
    if (!target) throw new Error('The recipe changed while it was being derived.');
    for (const [index, frame] of requireArray(target.frames).map(value => requireRecord(value)).entries()) Object.assign(frame, recipeFields(derived[index]));
    await writeFile(recipePath, JSON.stringify(document, null, 2) + '\n');
  }
  // The manifest owns the recipe document's pin; a written recipe is re-pinned in the same step so the two never disagree.
  const bytes = await readFile(recipePath), digest = sha256(bytes);
  const manifestPath = resolve(sourceDirectory, 'manifest.json'), manifest = requireRecord(JSON.parse(await readFile(manifestPath, 'utf8')));
  for (const entry of requireArray(manifest.documents).map(value => requireRecord(value))) if (entry.path === 'preparation/terrestrial.json') { entry.expectedBytes = bytes.length; entry.expectedSha256 = digest; }
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`${differences ? `Wrote ${frames.length} frame camera(s) to the recipe` : 'The recipe already states the derived fields'}; re-pinned it in the manifest.`);
}
