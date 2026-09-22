import {requireRecord} from '../../../../tools/source-values.mts';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {readPreparedFixture} from '../../fixtures.mts';
const sourceRoot=new URL('../../../../src/objects/saturn/source/',import.meta.url);
const catalog=JSON.parse(await readFile(new URL('moons/saturn-moons.json',sourceRoot),'utf8'));
const manifest=JSON.parse(await readFile(new URL('manifest.json',sourceRoot),'utf8'));
const expectedMoons=['mimas','enceladus','tethys','dione','rhea','titan','hyperion','iapetus'];
// The old billboard/orbit/shadow banks were never consumed by the accepted
// Saturn scene. Their removal must not erase the authoritative moon catalog.
test('retains the 293 authoritative moons and eight named major moon orbits',()=>{
 assert.deepEqual(catalog.counts,{confirmed:293,withJplMeanElements:291,discoveryOnly:2});
 assert.equal(catalog.moons.length,293);
 assert.equal(new Set(catalog.moons.map((moon:unknown)=>requireRecord(moon).id)).size,293);
 for(const id of expectedMoons){
  const moon=catalog.moons.find((moon: { id: string; })=>moon.id===id);
  assert.ok(moon,id);assert.ok(moon.semiMajorAxisKm>0);assert.ok(moon.periodDays>0);
  assert.ok(Number.isFinite(moon.inclinationDeg));assert.ok(Number.isFinite(moon.ascendingNodeDeg));
 }
 const titan=catalog.moons.find((moon: { id: string; })=>moon.id==='titan');
 assert.equal(titan.semiMajorAxisKm,1221900);assert.equal(titan.periodDays,15.945448);
});
test('retains every pinned moon source image and catalog byte',async()=>{
 const sources=manifest.inputs.filter((entry: { path: string; })=>entry.path.startsWith('moons/'));
 assert.ok(sources.length>=8);
 for(const entry of sources){const bytes=await readFile(new URL(entry.path,sourceRoot));assert.equal(bytes.length,entry.expectedBytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.expectedSha256);}
});
test('keeps dormant moon billboards, orbit guides and shadow banks outside the parent runtime',async()=>{
 const [definition,scene]=await Promise.all([readPreparedFixture('saturn','runtime'),readPreparedFixture('saturn','scene')]);
 const assets=JSON.parse(await readFile(new URL('../../../../src/objects/saturn/inventory.json',import.meta.url),'utf8'));
 assert.doesNotMatch(JSON.stringify(definition),/saturn-moon|PREPARED_SATURN_MOON|mountPreparedOrbitGuide|createPreparedOrbitGuideInteraction/);
 assert.ok(assets.assets.every((asset: { filename: string|string[]; })=>!asset.filename.includes('moon')));
 assert.ok(Object.keys(scene.counts).every(key=>!key.startsWith('moon')));
 const css=await readFile(new URL('../../../../src/renderers/css/styles/saturn-surfaces.css',import.meta.url),'utf8');
 assert.doesNotMatch(css,/saturn-moon/);
});
