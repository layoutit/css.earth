import { fixtureRecord } from '../../test-values.mts';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {parseTerrestrialProfile} from './index.mts';
import {radialModelForLens} from './radial-models.mts';
const read = async (id: string) => JSON.parse(await readFile(new URL(`../../../src/planets/${id}/source/preparation/terrestrial.json`,import.meta.url), 'utf8'));
test('authored scientific body profiles dispatch without body-named executable recipes',async()=>{
 for(const id of ['mars','ceres','io','europa','ganymede','callisto'])assert.equal(parseTerrestrialProfile(await read(id)).namespace,id);
});
test('observation recipes reject ambiguous masks and fallback ordering',async()=>{
 const profile=await read('io');
 profile.raster.observations[0].validity.zeroValidity='dark';
 assert.throws(()=>parseTerrestrialProfile(profile),/channel/);
 const reverse=await read('io');reverse.raster.observations.reverse();reverse.presentation.defaultLens='enhanced';
 assert.throws(()=>parseTerrestrialProfile(reverse),/ordering/);
});
test('disk normalization rejects unsupported physical or display assumptions',async()=>{
 for(const alter of [(p: unknown) =>fixtureRecord(p,"profile")["phaseNormalization"]=true,(p: unknown) =>fixtureRecord(p,"profile","observationWeights")["14ESGLOCOL01"]=1.1,
(p: unknown) =>fixtureRecord(p,"profile")["maximumIncidenceDegrees"]=90,(p: unknown) =>fixtureRecord(p,"levels")["luminance"]=[1,1,1],(p: unknown) =>fixtureRecord(p,"vectors")["sun"]='../unbound.json']){
  const profile=await read('europa');alter(profile.raster.observedColors[0].photometry);
  assert.throws(()=>parseTerrestrialProfile(profile),/source-bound/);
 }
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
  profile.geometry.radialTerrain.simplification.maximumErrorMeters = 49;
  profile.geometry.radialTerrainAlternatives = [{ ...alternative, lensId: 'osiris' }];
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
