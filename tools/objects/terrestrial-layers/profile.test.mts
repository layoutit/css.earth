import { fixtureRecord } from '../../contract/test-values.mts';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {parseTerrestrialProfile} from './index.mts';
import {radialModelForLens} from './radial-models.mts';
const read = async (id: string) => JSON.parse(await readFile(new URL(`../../../src/objects/${id}/source/preparation/terrestrial.json`,import.meta.url), 'utf8'));
test('authored scientific body profiles dispatch without body-named executable recipes',async()=>{
 for(const id of ['dimorphos','bennu','vesta','ryugu','itokawa','eros'])assert.equal(parseTerrestrialProfile(await read(id)).namespace,id);
});
test('the ten-frame AMICA consumer remains bounded and rejects an eleventh frame', async () => {
 const profile = await read('itokawa');
 assert.doesNotThrow(() => parseTerrestrialProfile(profile));
 const recipe = profile.raster.surfaceObservations[0];
 recipe.frames.push({ ...recipe.frames[0], id: 'extra-frame' });
 assert.throws(() => parseTerrestrialProfile(profile), /source-bound/);
});
test('observation recipes reject ambiguous masks and fallback ordering',async()=>{
 const profile=await read('tethys');
 profile.raster.observations[0].validity.zeroValidity='dark';
 assert.throws(()=>parseTerrestrialProfile(profile),/channel/);
 const forward=await read('tethys');forward.raster.observations[1].monochromeBase='infrared';
 assert.throws(()=>parseTerrestrialProfile(forward),/ordering/);
});

test('a shape display requires a source mesh and consumer for the shared neutral material', async () => {
 const profile=await read('ida');
 profile.raster.observations=[];profile.raster.scientific=[];profile.raster.surfaceObservations=[];
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
 for (const alter of [(p: unknown) => fixtureRecord(p,"frames",0)["qualityPath"] = '../unbound.IMG', (p: unknown) => fixtureRecord(p)["allowLossy"] = undefined,
(p: unknown) => fixtureRecord(p,"transfer")["maximumEmissionDegrees"] = 90, (p: unknown) => fixtureRecord(p,"transfer")["visibilityToleranceMeters"] = 2,
(p: unknown) => fixtureRecord(p,"photometry")["maximumGain"] = 4, (p: unknown) => fixtureRecord(p,"photometry")["maximumIncidenceDegrees"] = 90,
(p: unknown) => fixtureRecord(p,"photometry")["referenceIncidenceDegrees"] = 30, (p: unknown) => fixtureRecord(p,"display")["percentiles"] = [99, 1]]) {
  const changed = structuredClone(profile); alter(changed.raster.surfaceObservations[0]);
  assert.throws(() => parseTerrestrialProfile(changed), /source-bound/);
 }
});

test('an alternative model owns its observation mesh and sampler state', async () => {
  const profile = await read('comet-67p');
  const alternative = structuredClone(profile.geometry.radialTerrain);
  profile.geometry.radialTerrainAlternatives = [{ ...alternative, lensId: 'osiris' }];
  assert.doesNotThrow(() => parseTerrestrialProfile(profile), 'OSIRIS samples its declared alternative mesh');
  // The OSIRIS lens validates against its own model, which must preserve the source mesh like the default.
  delete profile.geometry.radialTerrainAlternatives[0].simplification.method;
  assert.throws(() => parseTerrestrialProfile(profile), /source-bound/, 'the alternative mesh must preserve its source');

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

test('PDS4 geometry cubes declare their planes and identity and bind a lossless, labelled frame within its transfer limits', async () => {
 const profile = await read('dimorphos');
 assert.equal(fixtureRecord(parseTerrestrialProfile(profile),'raster','surfaceObservations',0).format, 'pds4-geometry-cube');
 for (const alter of [(p: unknown) => fixtureRecord(p,"frames",0)["labelPath"] = undefined, (p: unknown) => fixtureRecord(p,"frames",0)["qualityPath"] = 'observations/quality.fits',
(p: unknown) => fixtureRecord(p)["allowLossy"] = true, (p: unknown) => fixtureRecord(p)["cube"] = undefined, (p: unknown) => fixtureRecord(p,"frames",0)["cameraPath"] = 'observations/camera.json',
(p: unknown) => fixtureRecord(p,"transfer")["maximumEmissionDegrees"] = 90]) {
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
 assert.throws(() => parseTerrestrialProfile(profile), /source-bound/);
});

test('SPICE camera recipes declare their kernels, bodies, instrument and pixel axes and nothing of the archived-geometry formats', async () => {
 const profile = await read('dimorphos'), cube = profile.raster.surfaceObservations[0];
 const kernels = ['spice/lsk/naif0012.tls', 'spice/fk/dart_009.tf', 'spice/ik/dart_draco_003.ti', 'spice/sclk/dart_sclk_0204.tsc', 'spice/spk/dart_2022_269_2022_269_spc_v04.bsp', 'spice/ck/dart_2022_269_2022_269_spc_v04.bc'];
 const spice = { kernels, observer: -135, target: 120065803, bodyFrame: 'DIMORPHOS_FIXED', instrument: -135102, clock: { header: 'ACQTMSOC', spacecraft: -135 }, aberration: 'LT+S',
  pixels: { focalLength: { key: 'FOCAL_LENGTH', unit: 'mm' }, pixelPitch: { key: 'PIXEL_SIZE', unit: 'micrometre' }, center: 'DETECTOR_CENTER', boresight: 'BORESIGHT', samples: 'PIXEL_SAMPLES', lines: 'PIXEL_LINES', frame: 'FOV_FRAME', origin: 0, column: '-X', row: '-Y' },
  image: { quantity: 'I/F', plane: 1, missingValueKeys: ['MISPXVAL'], saturationKey: 'SATPXVAL' } };
 profile.raster.surfaceObservations[0] = { id: 'draco-spice', format: 'spice-camera', consumer: 'draco-spice', filter: cube.filter,
  frames: [{ id: 'draco-spice', path: cube.frames[0].path, startTime: cube.frames[0].startTime }], metadata: cube.metadata, spice, transfer: cube.transfer, photometry: cube.photometry, display: cube.display };
 assert.doesNotThrow(() => parseTerrestrialProfile(profile));
 for (const alter of [(p: unknown) => fixtureRecord(p)["spice"] = undefined, (p: unknown) => fixtureRecord(p,"frames",0)["labelPath"] = cube.frames[0].labelPath, (p: unknown) => fixtureRecord(p,"frames",0)["cameraPath"] = 'observations/camera.json',
  (p: unknown) => fixtureRecord(p)["allowLossy"] = true, (p: unknown) => fixtureRecord(p)["cube"] = cube.cube, (p: unknown) => fixtureRecord(p,"spice")["aberration"] = 'XLT+S',
  (p: unknown) => fixtureRecord(p,"spice")["kernels"] = ['spice/lsk/naif0012.tls'], (p: unknown) => fixtureRecord(p,"spice")["kernels"] = [...kernels, '../elsewhere.bsp'],
  (p: unknown) => fixtureRecord(p,"spice","pixels")["row"] = 'X', (p: unknown) => fixtureRecord(p,"spice","pixels")["origin"] = 2, (p: unknown) => fixtureRecord(p,"spice","pixels","pixelPitch")["unit"] = 'nm',
  (p: unknown) => fixtureRecord(p,"spice")["target"] = -135, (p: unknown) => fixtureRecord(p,"spice","image")["plane"] = 0, (p: unknown) => fixtureRecord(p,"photometry")["model"] = 'minnaert']) {
  const changed = structuredClone(profile); alter(changed.raster.surfaceObservations[0]);
  assert.throws(() => parseTerrestrialProfile(changed), /source-bound|SPICE camera/);
 }
 // The cube format may not carry a spice block either.
 const mixed = structuredClone(profile); mixed.raster.surfaceObservations[0] = { ...cube, spice };
 assert.throws(() => parseTerrestrialProfile(mixed), /source-bound/);
 // Limb refinement belongs to the camera formats and keeps its budget within bounds.
 const refined = structuredClone(profile);
 refined.raster.surfaceObservations[0].limbRefinement = { method: 'mesh-limb', maximumCorrectionDegrees: 0.1, maximumResidualPixels: 2, minimumControls: 48, searchPixels: 256, maximumControls: 1500, minimumSharpness: 0.15 };
 assert.doesNotThrow(() => parseTerrestrialProfile(refined));
 for (const alter of [(r: unknown) => fixtureRecord(r)["method"] = 'landmarks', (r: unknown) => fixtureRecord(r)["maximumCorrectionDegrees"] = 5, (r: unknown) => fixtureRecord(r)["maximumResidualPixels"] = 0,
  (r: unknown) => fixtureRecord(r)["minimumControls"] = 8, (r: unknown) => fixtureRecord(r)["searchPixels"] = 1024, (r: unknown) => fixtureRecord(r)["maximumControls"] = 50, (r: unknown) => fixtureRecord(r)["minimumSharpness"] = 1]) {
  const changed = structuredClone(refined); alter(changed.raster.surfaceObservations[0].limbRefinement);
  assert.throws(() => parseTerrestrialProfile(changed), /limb refinement/);
 }
 const cubeRefined = structuredClone(profile); cubeRefined.raster.surfaceObservations[0] = { ...cube, limbRefinement: refined.raster.surfaceObservations[0].limbRefinement };
 assert.throws(() => parseTerrestrialProfile(cubeRefined), /source-bound/);
});

test('a published photometric model block is accepted on the observation seam and the encounter route, and malformed blocks are refused', async () => {
 const published = { model: 'photometry/example-hapke.json', referenceDegrees: { incidence: 30, emission: 0, phase: 30 },
  limits: { maximumIncidenceDegrees: 80, maximumEmissionDegrees: 70, phaseDegrees: [1, 70], minimumGain: 0.2, maximumGain: 5 } };
 for (const body of ['dimorphos', 'comet-81p']) {
  const profile = await read(body), legacy = structuredClone(profile.raster.surfaceObservations[0].photometry);
  profile.raster.surfaceObservations[0].photometry = structuredClone(published);
  assert.doesNotThrow(() => parseTerrestrialProfile(profile), body);
  for (const alter of [
   (p: unknown) => fixtureRecord(p, 'referenceDegrees')['phase'] = 45,
   (p: unknown) => fixtureRecord(p, 'limits')['maximumEmissionDegrees'] = 89,
   (p: unknown) => fixtureRecord(p)['model'] = 'photometry/../elsewhere.json',
   (p: unknown) => fixtureRecord(p, 'limits')['phaseDegrees'] = [40, 70],
   (p: unknown) => fixtureRecord(p, 'limits')['minimumGain'] = 0,
   (p: unknown) => fixtureRecord(p)['maximumGain'] = 3,
  ]) {
   const changed = structuredClone(profile); alter(changed.raster.surfaceObservations[0].photometry);
   assert.throws(() => parseTerrestrialProfile(changed), /source-bound|photometr/i, `${body} accepted a malformed published block`);
  }
  // A historical block may not smuggle in a reference geometry either.
  const mixed = structuredClone(profile); mixed.raster.surfaceObservations[0].photometry = { ...legacy, referenceDegrees: published.referenceDegrees };
  assert.throws(() => parseTerrestrialProfile(mixed), /source-bound|photometr/i, `${body} accepted a mixed block`);
 }
});

test('a cube declaration belongs only to the geometry-cube format', async () => {
 const profile = await read('comet-67p');
 profile.raster.surfaceObservations[0].cube = { collection: 'urn:x', target: 'x', observingSystem: [], quantity: 'x', planes: { image: 'a', x: 'b', y: 'c', z: 'd', incidence: 'e', emission: 'f', phase: 'g' } };
 assert.throws(() => parseTerrestrialProfile(profile), /source-bound/);
});
