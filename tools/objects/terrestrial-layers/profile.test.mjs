import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {parseTerrestrialProfile} from './index.mts';
const read = async id => JSON.parse(await readFile(new URL(`../../../src/planets/${id}/source/preparation/terrestrial.json`,import.meta.url)));
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
 for(const alter of [p=>p.profile.phaseNormalization=true,p=>p.profile.observationWeights['14ESGLOCOL01']=1.1,
   p=>p.profile.maximumIncidenceDegrees=90,p=>p.levels.luminance=[1,1,1],p=>p.vectors.sun='../unbound.json']){
  const profile=await read('europa');alter(profile.raster.observedColors[0].photometry);
  assert.throws(()=>parseTerrestrialProfile(profile),/source-bound/);
 }
});

test('a shape display requires a source mesh and consumer for the shared no-imagery grid', async () => {
 const profile=await read('ida');
 profile.raster.observations=[];profile.raster.scientific=[];
 profile.raster.shapeViews=[{id:'shape',label:'Shape',consumer:'geometry'}];
 profile.presentation.defaultLens='shape';
 assert.equal(parseTerrestrialProfile(profile).presentation.defaultLens,'shape');
 assert.throws(()=>parseTerrestrialProfile({...profile,geometry:{...profile.geometry,radialTerrain:undefined}}),/pinned mesh/);
 profile.raster.shapeViews[0].consumer='';
 assert.throws(()=>parseTerrestrialProfile(profile),/source consumer/);
});

test('georeferenced photographs bind quality, physical distances and bounded disk normalization', async () => {
 const profile = await read('comet-67p');
 assert.equal(parseTerrestrialProfile(profile).raster.surfaceObservations[0].id, 'osiris');
 for (const alter of [p => p.qualityPath = '../unbound.IMG', p => p.allowLossy = undefined,
   p => p.transfer.maximumSourceDistanceMeters = 51, p => p.transfer.visibilityToleranceMeters = 2,
   p => p.photometry.maximumGain = 4, p => p.photometry.maximumIncidenceDegrees = 90,
   p => p.photometry.referenceIncidenceDegrees = 30, p => p.displayPercentiles = [99, 1]]) {
  const changed = structuredClone(profile); alter(changed.raster.surfaceObservations[0]);
  assert.throws(() => parseTerrestrialProfile(changed), /source-bound/);
 }
});
