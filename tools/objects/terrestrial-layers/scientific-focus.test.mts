import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import {readFile} from 'node:fs/promises';
import {prepareScientificFocus} from './scientific-focus.mts';
import {prepareEclipticPresentationFrame} from '../../../src/platform/solar-presentation-frame.mts';
import {preparedScenePitch} from '@cssearth/engine';
import {parseScientificCamera} from './source-records.mts';
import {requireRecord} from '../../sources/source-values.mts';
test('Agenor focus puts its body-fixed direction at the camera centre',async()=>{
  const camera=parseScientificCamera(requireRecord(JSON.parse(await readFile(new URL('../../../src/objects/europa/prepared/scene.json',import.meta.url), 'utf8')), 'Europa scene').camera);
  const focus={longitudeDegrees:142,latitudeDegrees:-43.7,zoom:4};
  const result=prepareScientificFocus('europa',focus,camera),r=Math.PI/180;
  const [x,y,z]=prepareEclipticPresentationFrame('europa').toPresentation([
    Math.cos(focus.latitudeDegrees*r)*Math.cos(focus.longitudeDegrees*r),
    Math.cos(focus.latitudeDegrees*r)*Math.sin(focus.longitudeDegrees*r),Math.sin(focus.latitudeDegrees*r)]);
  const a=result.controlYaw*r,b=preparedScenePitch(result.controlPitch,camera)*r;
  const xx=x*Math.cos(a)+z*Math.sin(a), zz=-x*Math.sin(a)+z*Math.cos(a);
  assert.ok(Math.abs(xx)<1e-12);assert.ok(Math.abs(y*Math.cos(b)-zz*Math.sin(b))<1e-12);
  assert.ok(y*Math.sin(b)+zz*Math.cos(b)>.999999999999);
  assert.equal(result.zoom,4);
  for(const patch of [{zoom:5},{latitudeDegrees:91},{longitudeDegrees:-1}])assert.throws(()=>prepareScientificFocus('europa',{...focus,...patch},camera),TypeError);
});
