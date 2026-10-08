import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import {readFile} from 'node:fs/promises';
import {prepareScientificFocus} from '@cssearth/bake/objects/layers/terrestrial';
import {prepareEclipticPresentationFrame} from '@cssearth/bake/objects/scene';
import {preparedScenePitch} from '@cssearth/engine';
import {parseScientificCamera} from '@cssearth/bake/objects/raster';
import {requireRecord} from '@cssearth/core';
import * as solarGeometry from '../../platform/solar-geometry.mts';
test('False color focus puts its body-fixed direction at the camera centre',async()=>{
  const camera=parseScientificCamera(requireRecord(JSON.parse(await readFile(new URL('../../../src/objects/europa/prepared/runtime.json',import.meta.url), 'utf8')), 'Europa runtime').camera);
  const focus={longitudeDegrees:143.5,latitudeDegrees:2.3,zoom:1.1};
  const result=prepareScientificFocus(solarGeometry,'europa',focus,camera),r=Math.PI/180;
  const [x,y,z]=prepareEclipticPresentationFrame(solarGeometry, 'europa').toPresentation([
    Math.cos(focus.latitudeDegrees*r)*Math.cos(focus.longitudeDegrees*r),
    Math.cos(focus.latitudeDegrees*r)*Math.sin(focus.longitudeDegrees*r),Math.sin(focus.latitudeDegrees*r)]);
  const a=result.controlYaw*r,b=preparedScenePitch(result.controlPitch,camera)*r;
  const xx=x*Math.cos(a)+z*Math.sin(a), zz=-x*Math.sin(a)+z*Math.cos(a);
  assert.ok(Math.abs(xx)<1e-12);assert.ok(Math.abs(y*Math.cos(b)-zz*Math.sin(b))<1e-12);
  assert.ok(y*Math.sin(b)+zz*Math.cos(b)>.999999999999);
  assert.equal(result.zoom,1.1);
  for(const patch of [{zoom:5},{latitudeDegrees:91},{longitudeDegrees:-1}])assert.throws(()=>prepareScientificFocus(solarGeometry,'europa',{...focus,...patch},camera),TypeError);
});
