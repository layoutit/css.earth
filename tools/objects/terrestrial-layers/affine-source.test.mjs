import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {parseAffineProfile} from './affine-source.mts';
import {parseEllipsoidProfile} from './ellipsoid-geometry.mts';
import {parsePhotographicAtmosphere} from './photographic-atmosphere-source.mts';
import {parseReferenceCelestialSource} from './reference-celestial-source.mts';
const read=async path=>JSON.parse(await readFile(new URL(`../../../src/planets/mars/source/${path}`,import.meta.url),'utf8'));
test('Mars preparation boundaries preserve measured parameters and provenance records',async()=>{
 for(const [path,parse] of [['preparation/terrestrial.json',parseAffineProfile],['preparation/ellipsoid.json',parseEllipsoidProfile],
  ['preparation/atmosphere.json',parsePhotographicAtmosphere],['sky/google-earth-pro-contract.json',parseReferenceCelestialSource]]) {
  const value=await read(path),before=JSON.stringify(value);assert.equal(parse(value),value,path);assert.equal(JSON.stringify(value),before,path);
 }
});
test('source boundaries reject incomplete measured directions and calibration intervals',async()=>{
 const reference=await read('sky/google-earth-pro-contract.json');reference.sun.bodyDirectionAtReference.pop();
 assert.throws(()=>parseReferenceCelestialSource(reference),TypeError);
 const atmosphere=await read('preparation/atmosphere.json');atmosphere.reference.limbAnnulus[0]='0.96';
 assert.throws(()=>parsePhotographicAtmosphere(atmosphere),TypeError);
 const profile=await read('preparation/terrestrial.json');profile.lenses.plans[1].coverage.kind='assume-valid';
 assert.throws(()=>parseAffineProfile(profile),TypeError);
});
