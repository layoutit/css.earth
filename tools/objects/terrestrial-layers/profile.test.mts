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

test('DRACO geometry cubes bind their PDS4 label to an unfiltered, lossless I/F frame within the mesh transfer bound', async () => {
 const profile = await read('dimorphos');
 assert.equal(fixtureRecord(parseTerrestrialProfile(profile),'raster','surfaceObservations',0).format, 'draco-geo');
 for (const alter of [(p: unknown) => fixtureRecord(p)["labelPath"] = undefined, (p: unknown) => fixtureRecord(p)["qualityPath"] = 'observations/quality.fits',
(p: unknown) => fixtureRecord(p)["allowLossy"] = true, (p: unknown) => fixtureRecord(p)["filter"] = 'V', (p: unknown) => fixtureRecord(p)["cameraPath"] = 'observations/camera.json',
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
