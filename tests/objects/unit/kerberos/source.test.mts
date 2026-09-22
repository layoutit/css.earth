import {requireRecord} from '../../../../tools/sources/source-values.mts';
import {required} from '../../../../tools/contract/test-values.mts';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('kerberos');
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parsePdsRadiusTable} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import sharp from 'sharp';
const root=new URL('../../../../src/objects/kerberos/',import.meta.url);
test('Kerberos keeps the published 2025 semi-axes independently of its scene reference radius',async()=>{
 const recipe=JSON.parse((await readFile(new URL('source/preparation/terrestrial.json',root))).toString('utf8'));
 const shape=parsePdsRadiusTable(await readFile(new URL('source/shape/ellipsoid.tab',root),'utf8'),recipe.geometry.radialTerrain.grid);
 for(const [lon,lat,radius] of [[0,0,7250],[90,0,4100],[180,0,7250],[270,0,4100],[0,90,3600],[0,-90,3600]] as const)
  assert.ok(Math.abs(required(shape.sample(lon,lat))-radius)<.001,`${lon},${lat}`);
 assert.equal(recipe.geometry.radiusKm,4.75);
 assert.ok(Math.abs(Math.cbrt(7.25*4.1*3.6)-4.75)<.05);
});
test('Kerberos unregistered few-pixel imagery remains no-data, including both resolved epochs',async()=>{
 const recipe=JSON.parse((await readFile(new URL('source/preparation/terrestrial.json',root))).toString('utf8'));
 const image=await sharp(new URL('source/material/neutral.png',root).pathname).raw().toBuffer({resolveWithObject:true});
 assert.equal(image.info.width,64);assert.equal(image.info.height,32);
 assert.equal(recipe.raster.observations[0].validity.noData,160);
 for(const value of image.data)assert.equal(value,160);
 const inventory=JSON.parse((await readFile(new URL('source/survey/opus-finest.json',root))).toString('utf8'));
 assert.equal(inventory.page[0][0],'nh-lorri-lor_0299153805');
 assert.equal(Number(inventory.page[0][1]),1.96379);
 const qualified=JSON.parse((await readFile(new URL('source/survey/qualification.json',root))).toString('utf8'));
 assert.deepEqual(qualified.inspectedObservations.map((x:unknown)=>requireRecord(x).opusId),['nh-lorri-lor_0299153805','nh-lorri-lor_0299136735']);
});
