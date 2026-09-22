import {required} from "../../../../tools/contract/test-values.mts";
import {requireRecord} from "../../../../tools/sources/source-values.mts";
import {shape,array,text} from "../../../../tools/objects/geographic-pages/source-records.mts";
import {parsePreparedObjectRuntime} from "../../../../src/renderers/css/dist/index.js";
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { runtimeDefinition, PREPARED_EARTH_SCENE } from './prepared-fixture.mts';

const read=async (path: string):Promise<unknown>=>JSON.parse((await readFile(new URL(`../../../../${path}`,import.meta.url))).toString('utf8'));
test('Earth uses the same globe camera limits and drag as Mercury and Saturn in every lens',async()=>{
  for(const id of ['mercury','saturn']) {
    const {camera}=parsePreparedObjectRuntime(await read(`src/objects/${id}/prepared/runtime.json`));
    for(const key of ['minimumZoom','maximumZoom','defaultZoom'] as const) assert.equal(runtimeDefinition.camera[key],camera[key],`${id}: ${key}`);
    assert.equal(required(runtimeDefinition.camera.dolly).minimumDistanceRadii,required(camera.dolly).minimumDistanceRadii);
    assert.deepEqual(runtimeDefinition.camera.drag,camera.drag);
    assert.deepEqual(runtimeDefinition.camera.responsiveFit,camera.responsiveFit);
  }
  assert.equal(runtimeDefinition.camera.sceneScale,parsePreparedObjectRuntime(await read('src/objects/mercury/prepared/runtime.json')).camera.sceneScale);
  for(const variant of runtimeDefinition.variants) {
    const navigation=required(variant.navigation);assert.equal(navigation.maximumZoom,4);
    if (['enso', 'cross-section', 'mantle-tomography'].includes(String(variant.when.lensId))) {
      const camera=required(navigation.camera);assert.ok(Number.isFinite(camera.controlYaw));
      assert.equal(camera.zoom,1.1);
      assert.deepEqual(camera.transition, { durationMilliseconds: 650, preserveZoom: true });
    } else assert.equal(navigation.camera,null);
  }
});
test('Earth mount and delivery contain the authored globe views, without geographic residency',async()=>{
  const descriptor=shape({properties:shape({recipe:requireRecord})})(await read('src/objects/earth/object.json'));
  const content=requireRecord(await read('src/objects/earth/prepared/content.json'));
  assert.equal(descriptor.properties.recipe.paging,undefined);
  assert.equal(descriptor.properties.recipe.destinations,undefined);
  assert.equal(runtimeDefinition.destinations,undefined);
  assert.equal(content.destinations,undefined);
  assert.deepEqual(runtimeDefinition.pageLayers,[]);
  assert.equal(PREPARED_EARTH_SCENE.counts.cityPageLeafCount,0);
  assert.equal(PREPARED_EARTH_SCENE.counts.noisePageLeafCount,0);
  assert.deepEqual(required(runtimeDefinition.controls.lenses).controls.map(lens=>lens.id),['normal','clouds','topography','night-lights','enso','cross-section','mantle-tomography']);
  assert.doesNotMatch(JSON.stringify(content),/WorldCover|GeoNames|Buenos Aires/);
  const assets=shape({assets:array(shape({filename:text}))})(await read('src/objects/earth/runtime-assets.json'));
  assert.equal(assets.assets.some((asset: { filename: string; })=>/noise|places|city|wmts/.test(asset.filename)),false);
  for(const kind of ['surface','topography','night-lights','interior','atmosphere']) assert.ok(assets.assets.some((asset: { filename: string|string[]; })=>asset.filename.includes(kind)),kind);
});
