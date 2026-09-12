import { fixtureRecord } from '../../test-values.mts';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {parseTerrestrialProfile} from './index.mts';
import {radialModelForLens} from './radial-models.mts';
const read = async (id: string) => JSON.parse(await readFile(new URL(`../../../src/planets/${id}/source/preparation/terrestrial.json`,import.meta.url), 'utf8'));
test('authored scientific body profiles dispatch without body-named executable recipes',async()=>{
 for(const id of ['dimorphos','bennu','vesta','ryugu','itokawa','eros'])assert.equal(parseTerrestrialProfile(await read(id)).namespace,id);
});
test('observation recipes reject ambiguous masks and fallback ordering',async()=>{
 const profile=await read('tethys');
 profile.raster.observations[0].validity.zeroValidity='dark';
 assert.throws(()=>parseTerrestrialProfile(profile),/channel/);
 const forward=await read('tethys');forward.raster.observations[1].monochromeBase='infrared';
 assert.throws(()=>parseTerrestrialProfile(forward),/ordering/);
});

test('a shape display requires a source mesh and consumer for the shared no-imagery grid', async () => {
 const profile=await read('ida');
 profile.raster.observations=[];profile.raster.scientific=[];
 profile.raster.shapeViews=[{id:'shape',label:'Shape',consumer:'geometry'}];
 profile.presentation.defaultLens='shape';
 assert.equal(fixtureRecord(parseTerrestrialProfile(profile),'presentation').defaultLens,'shape');
 assert.throws(()=>parseTerrestrialProfile({...profile,geometry:{...profile.geometry,radialTerrain:undefined}}),/pinned mesh/);
 profile.raster.shapeViews[0].consumer='';
 assert.throws(()=>parseTerrestrialProfile(profile),/source consumer/);
});

test('georeferenced photographs bind quality, physical distances and bounded disk normalization', async () => {
 const profile = await read('comet-67p');
 assert.equal(fixtureRecord(parseTerrestrialProfile(profile),'raster','surfaceObservations',0).id, 'osiris');
 for (const alter of [(p: unknown) => fixtureRecord(p)["qualityPath"] = '../unbound.IMG', (p: unknown) => fixtureRecord(p)["allowLossy"] = undefined,
(p: unknown) => fixtureRecord(p,"transfer")["maximumSourceDistanceMeters"] = 51, (p: unknown) => fixtureRecord(p,"transfer")["visibilityToleranceMeters"] = 2,
(p: unknown) => fixtureRecord(p,"photometry")["maximumGain"] = 4, (p: unknown) => fixtureRecord(p,"photometry")["maximumIncidenceDegrees"] = 90,
(p: unknown) => fixtureRecord(p,"photometry")["referenceIncidenceDegrees"] = 30, (p: unknown) => fixtureRecord(p)["displayPercentiles"] = [99, 1]]) {
  const changed = structuredClone(profile); alter(changed.raster.surfaceObservations[0]);
  assert.throws(() => parseTerrestrialProfile(changed), /source-bound/);
 }
});

test('an alternative model owns its observation mesh, transfer limit, and sampler state', async () => {
  const profile = await read('comet-67p');
  const alternative = structuredClone(profile.geometry.radialTerrain);
  alternative.simplification.maximumErrorMeters = 60;
  profile.geometry.radialTerrainAlternatives = [{ ...alternative, lensId: 'osiris' }];
  // The OSIRIS transfer limit now exceeds the default mesh bound (50 m) and
  // stays within its own model's bound; the other 50 m lenses are untouched.
  profile.raster.surfaceObservations.find((recipe: {id: string}) => recipe.id === 'osiris').transfer.maximumSourceDistanceMeters = 55;
  assert.doesNotThrow(() => parseTerrestrialProfile(profile), 'OSIRIS transfer limit belongs to its declared alternative mesh');
  profile.geometry.radialTerrainAlternatives[0].simplification.maximumErrorMeters = 49;
  assert.throws(() => parseTerrestrialProfile(profile), /source-bound/, 'the alternative mesh enforces the transfer limit');

  const observation = { samplePoint() { return null; } };
  const base: {observationSurfaces?: Map<string, typeof observation>} = {};
  const alternativeRadial: {observationSurfaces?: Map<string, typeof observation>} = {};
  const selected = radialModelForLens([{ lensIds: ['model'], radial: base }, { lensIds: ['osiris'], radial: alternativeRadial }], 'osiris');
  selected.radial.observationSurfaces ??= new Map();
  selected.radial.observationSurfaces.set('osiris', observation);
  assert.equal(selected.radial, alternativeRadial);
  assert.equal('observationSurfaces' in base, false);
  assert.equal(alternativeRadial.observationSurfaces?.get('osiris'), observation);
});

test('PDS4 geometry cubes declare their planes and identity and bind a lossless, labelled frame within the mesh transfer bound', async () => {
 const profile = await read('dimorphos');
 assert.equal(fixtureRecord(parseTerrestrialProfile(profile),'raster','surfaceObservations',0).format, 'pds4-geometry-cube');
 for (const alter of [(p: unknown) => fixtureRecord(p)["labelPath"] = undefined, (p: unknown) => fixtureRecord(p)["qualityPath"] = 'observations/quality.fits',
(p: unknown) => fixtureRecord(p)["allowLossy"] = true, (p: unknown) => fixtureRecord(p)["cube"] = undefined, (p: unknown) => fixtureRecord(p)["cameraPath"] = 'observations/camera.json',
(p: unknown) => fixtureRecord(p,"transfer")["maximumSourceDistanceMeters"] = 3]) {
  const changed = structuredClone(profile); alter(changed.raster.surfaceObservations[0]);
  assert.throws(() => parseTerrestrialProfile(changed), /source-bound/);
 }
});

test('a mosaic may rank frames in recipe order when one viewing direction ties their emission angles', async () => {
 const profile = await read('comet-67p');
 const recipe = profile.raster.surfaceObservations[0];
 recipe.selection = 'recipe-order';
 assert.doesNotThrow(() => parseTerrestrialProfile(profile));
 recipe.selection = 'nearest-frame';
 assert.throws(() => parseTerrestrialProfile(profile), /mosaic/);
});

test('SPICE camera recipes declare their kernels, bodies, instrument and pixel axes and nothing of the archived-geometry formats', async () => {
 const profile = await read('dimorphos'), cube = profile.raster.surfaceObservations[0];
 const kernels = ['spice/lsk/naif0012.tls', 'spice/fk/dart_009.tf', 'spice/ik/dart_draco_003.ti', 'spice/sclk/dart_sclk_0204.tsc', 'spice/spk/dart_2022_269_2022_269_spc_v04.bsp', 'spice/ck/dart_2022_269_2022_269_spc_v04.bc'];
 const spice = { kernels, observer: -135, target: 120065803, bodyFrame: 'DIMORPHOS_FIXED', instrument: -135102, clock: { header: 'ACQTMSOC', spacecraft: -135 }, aberration: 'LT+S',
  pixels: { focalLength: { key: 'FOCAL_LENGTH', unit: 'mm' }, pixelPitch: { key: 'PIXEL_SIZE', unit: 'micrometre' }, center: 'DETECTOR_CENTER', boresight: 'BORESIGHT', samples: 'PIXEL_SAMPLES', lines: 'PIXEL_LINES', frame: 'FOV_FRAME', origin: 0, column: '-X', row: '-Y' },
  image: { quantity: 'I/F', plane: 1, missingValueKeys: ['MISPXVAL'], saturationKey: 'SATPXVAL' } };
 profile.raster.surfaceObservations[0] = { id: 'draco-spice', format: 'spice-camera', consumer: 'draco-spice', path: cube.path, startTime: cube.startTime, filter: cube.filter, allowLossy: false,
  metadata: cube.metadata, spice, transfer: cube.transfer, photometry: cube.photometry, displayPercentiles: cube.displayPercentiles };
 assert.doesNotThrow(() => parseTerrestrialProfile(profile));
 for (const alter of [(p: unknown) => fixtureRecord(p)["spice"] = undefined, (p: unknown) => fixtureRecord(p)["labelPath"] = cube.labelPath, (p: unknown) => fixtureRecord(p)["cameraPath"] = 'observations/camera.json',
  (p: unknown) => fixtureRecord(p)["allowLossy"] = true, (p: unknown) => fixtureRecord(p)["cube"] = cube.cube, (p: unknown) => fixtureRecord(p,"spice")["aberration"] = 'XLT+S',
  (p: unknown) => fixtureRecord(p,"spice")["kernels"] = ['spice/lsk/naif0012.tls'], (p: unknown) => fixtureRecord(p,"spice")["kernels"] = [...kernels, '../elsewhere.bsp'],
  (p: unknown) => fixtureRecord(p,"spice","pixels")["row"] = 'X', (p: unknown) => fixtureRecord(p,"spice","pixels")["origin"] = 2, (p: unknown) => fixtureRecord(p,"spice","pixels","pixelPitch")["unit"] = 'nm',
  (p: unknown) => fixtureRecord(p,"spice")["target"] = -135, (p: unknown) => fixtureRecord(p,"spice","image")["plane"] = 0, (p: unknown) => fixtureRecord(p,"photometry")["model"] = 'minnaert']) {
  const changed = structuredClone(profile); alter(changed.raster.surfaceObservations[0]);
  assert.throws(() => parseTerrestrialProfile(changed), /source-bound|SPICE camera|spice block/);
 }
 // The cube format may not carry a spice block either.
 const mixed = structuredClone(profile); mixed.raster.surfaceObservations[0] = { ...cube, spice };
 assert.throws(() => parseTerrestrialProfile(mixed), /spice block/);
 // Limb refinement belongs to the camera formats and keeps its budget within bounds.
 const refined = structuredClone(profile);
 refined.raster.surfaceObservations[0].refinement = { method: 'mesh-limb', maximumCorrectionDegrees: 0.1, maximumResidualPixels: 2, minimumControls: 48, searchPixels: 256, maximumControls: 1500, minimumSharpness: 0.15 };
 assert.doesNotThrow(() => parseTerrestrialProfile(refined));
 for (const alter of [(r: unknown) => fixtureRecord(r)["method"] = 'landmarks', (r: unknown) => fixtureRecord(r)["maximumCorrectionDegrees"] = 5, (r: unknown) => fixtureRecord(r)["maximumResidualPixels"] = 0,
  (r: unknown) => fixtureRecord(r)["minimumControls"] = 8, (r: unknown) => fixtureRecord(r)["searchPixels"] = 1024, (r: unknown) => fixtureRecord(r)["maximumControls"] = 50, (r: unknown) => fixtureRecord(r)["minimumSharpness"] = 1]) {
  const changed = structuredClone(refined); alter(changed.raster.surfaceObservations[0].refinement);
  assert.throws(() => parseTerrestrialProfile(changed), /limb refinement/);
 }
 const cubeRefined = structuredClone(profile); cubeRefined.raster.surfaceObservations[0] = { ...cube, refinement: refined.raster.surfaceObservations[0].refinement };
 assert.throws(() => parseTerrestrialProfile(cubeRefined), /limb refinement/);
});

test('a cube declaration belongs only to the geometry-cube format', async () => {
 const profile = await read('comet-67p');
 profile.raster.surfaceObservations[0].cube = { collection: 'urn:x', target: 'x', observingSystem: [], quantity: 'x', planes: { image: 'a', x: 'b', y: 'c', z: 'd', incidence: 'e', emission: 'f', phase: 'g' } };
 assert.throws(() => parseTerrestrialProfile(profile), /source-bound/);
});
