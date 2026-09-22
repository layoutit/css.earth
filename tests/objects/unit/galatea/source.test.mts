import {required} from '../../../../tools/contract/test-values.mts';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('galatea');
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parsePdsRadiusTable} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import sharp from 'sharp';
const root=new URL('../../../../src/objects/galatea/',import.meta.url);
test('Galatea ellipsoid retains Karkoschka published axes at independent cardinal anchors',async()=>{
 const recipe=JSON.parse((await readFile(new URL('source/preparation/terrestrial.json',root))).toString('utf8'));
 const shape=parsePdsRadiusTable(await readFile(new URL('source/shape/ellipsoid.tab',root),'utf8'),recipe.geometry.radialTerrain.grid);
 for(const [lon,lat,radius] of [[0,0,102000],[90,0,92000],[180,0,102000],[270,0,92000],[0,90,72000],[0,-90,72000]] as const)
  assert.ok(Math.abs(required(shape.sample(lon,lat))-radius)<0.001,`${lon},${lat}`);
 // The reference sphere controls scene units; it must not rescale the measured axes.
 assert.equal(recipe.geometry.radiusKm,88);
 assert.ok(Math.abs(Math.cbrt(102*92*72)-88)<.3);
});
test('Galatea unavailable imagery is represented by the existing no-data grid recipe',async()=>{
 const recipe=JSON.parse((await readFile(new URL('source/preparation/terrestrial.json',root))).toString('utf8'));
 const image=await sharp(new URL('source/material/neutral.png',root).pathname).raw().toBuffer({resolveWithObject:true});
 assert.equal(image.info.width,64);assert.equal(image.info.height,32);
 assert.equal(recipe.raster.observations[0].validity.noData,160);
 for(const value of image.data)assert.equal(value,160);
 const inventory=JSON.parse((await readFile(new URL('source/survey/opus-finest.json',root))).toString('utf8'));
 assert.equal(inventory.page[0][0],'vg-iss-2-n-c1135055');
 assert.equal(Number(inventory.page[0][3]),18.66229);
 const metadata=JSON.parse((await readFile(new URL('source/survey/1135055-metadata.json',root))).toString('utf8'));
 assert.equal(Number(metadata['Voyager ISS Constraints'].duration),15.36);
});
