import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { runtimeDefinition, PREPARED_EARTH_SCENE } from './prepared-fixture.mjs';

const read=async path=>JSON.parse(await readFile(new URL(`../../../../${path}`,import.meta.url)));
test('Earth uses the same globe camera limits and drag as Mercury and Saturn in every lens',async()=>{
  for(const id of ['mercury','saturn']) {
    const {camera}=await read(`src/planets/${id}/prepared/runtime.json`);
    for(const key of ['minimumZoom','maximumZoom','defaultZoom']) assert.equal(runtimeDefinition.camera[key],camera[key],`${id}: ${key}`);
    assert.equal(runtimeDefinition.camera.dolly.minimumDistanceRadii,camera.dolly.minimumDistanceRadii);
    assert.deepEqual(runtimeDefinition.camera.drag,camera.drag);
    assert.deepEqual(runtimeDefinition.camera.responsiveFit,camera.responsiveFit);
  }
  assert.equal(runtimeDefinition.camera.sceneScale,(await read('src/planets/mercury/prepared/runtime.json')).camera.sceneScale);
  for(const variant of runtimeDefinition.variants) {
    assert.equal(variant.navigation.maximumZoom,4);
    assert.equal(variant.navigation.camera,null);
  }
});
test('Earth mount and delivery contain only the four globe views, without geographic residency',async()=>{
  const descriptor=await read('src/planets/earth/object.json');
  const content=await read('src/planets/earth/prepared/content.json');
  assert.equal(descriptor.properties.recipe.paging,undefined);
  assert.equal(descriptor.properties.recipe.destinations,undefined);
  assert.equal(runtimeDefinition.destinations,undefined);
  assert.equal(content.destinations,undefined);
  assert.deepEqual(runtimeDefinition.pageLayers,[]);
  assert.equal(PREPARED_EARTH_SCENE.counts.cityPageLeafCount,0);
  assert.equal(PREPARED_EARTH_SCENE.counts.noisePageLeafCount,0);
  assert.deepEqual(runtimeDefinition.controls.lenses.controls.map(lens=>lens.id),['normal','topography','night-lights','cross-section']);
  assert.doesNotMatch(JSON.stringify(content),/WorldCover|GeoNames|Buenos Aires/);
  const assets=await read('src/planets/earth/runtime-assets.json');
  assert.equal(assets.assets.some(asset=>/noise|places|city|wmts/.test(asset.filename)),false);
  for(const kind of ['surface','topography','night-lights','interior','atmosphere']) assert.ok(assets.assets.some(asset=>asset.filename.includes(kind)),kind);
});
