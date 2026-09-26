import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'vitest';
import {requireVariants} from './presentation.js';
import type {PreparedTree} from '../rendering/prepared-presentation.js';
import type {ObjectControls} from '../runtime/object-contract.js';
import {prepareScientificNavigation} from '../../../../tools/objects/terrestrial-layers/scientific-focus.mts';
import {preparedScenePitch} from '@cssearth/engine';
import {requireCamera} from './camera-controls.js';
import {requireRecord,requireString} from '@cssearth/core';

// This small prepared carrier is independent of the focus helper's frame math.
// No body raster preparation, browser, or complete runtime document is needed.
const raw = requireRecord(JSON.parse(await readFile(new URL('../../../../src/objects/europa/prepared/scene.json', import.meta.url), 'utf8')), 'Europa scene');
const camera = raw.camera; requireCamera(camera);
const scene = {camera, systemTransform:requireString(raw.systemTransform, 'Europa transform')};
const focus = {longitudeDegrees:142, latitudeDegrees:-43.7, zoom:4};
const tree:PreparedTree = {nodes:[
  {parent:-1,tag:'div',className:'polycss-camera',style:'',properties:[],attributes:{}},
  {parent:0,tag:'div',className:'polycss-scene',style:'',properties:[],attributes:{}},
], properties:[], camera:0, scene:1, stageClasses:[]};
const controls:ObjectControls = {lenses:{defaultLens:'elevation',controls:[{id:'elevation',label:'Elevation'}]}, settings:{controls:[
  {name:'shadows',kind:'toggle',label:'Shadows',checked:true},
  {name:'orbit',kind:'toggle',label:'Orbit',checked:true},
]}};
function variants() {
  const navigation = prepareScientificNavigation('europa', focus, scene.camera);
  return [false,true].flatMap(shadows => [false,true].map(orbit => ({
    when:{lensId:'elevation',shadows,orbit}, required:[], writes:[
      {kind:'class',target:-1,name:'focus-shadows',value:shadows},
      {kind:'class',target:-1,name:'focus-orbit',value:orbit},
    ], materials:[], navigation,
  })));
}
const validate = (value:unknown) => requireVariants(value, tree, new Set(), [], controls, scene.camera);

test('scientific focus emits the complete navigation contract for every lens toggle variant', () => {
  const value = variants();
  assert.doesNotThrow(() => validate(value));
  for (const variant of value) {
    assert.equal(variant.navigation.maximumZoom, scene.camera.maximumZoom);
    assert.equal(variant.navigation.camera.zoom, 4);
  }
  const omitted = structuredClone(value);
  delete (omitted[0].navigation as {maximumZoom?:number}).maximumZoom;
  assert.throws(() => validate(omitted), /navigation maximum zoom must be finite/);
  const tooLow = structuredClone(value);
  tooLow[0].navigation.maximumZoom = 3;
  assert.throws(() => validate(tooLow), /navigation camera must be bounded/);
  assert.throws(() => prepareScientificNavigation('europa', {...focus,zoom:5}, scene.camera), /supported camera zoom/);
});

test('a displayed toggle must select a distinct prepared effect', () => {
  const unbound = [{...structuredClone(variants()[0]),when:{lensId:'elevation'}}];
  assert.throws(() => validate(unbound), /setting shadows has no prepared variant/);
  const inert = variants().map(variant => ({...variant,writes:[]}));
  assert.throws(() => validate(inert), /setting shadows has no prepared effect/);
});

test('Agenor navigation centres the actual emitted PolyCSS XY-swapped carrier at its established pose', () => {
  const navigation = prepareScientificNavigation('europa', focus, scene.camera);
  const camera = navigation.camera, r = Math.PI/180;
  // Europa's systemTransform is solved into the corrected frame (#294); re-pinned to the new pose.
  assert.ok(Math.abs(camera.controlPitch - 26.308446037891912) < 1e-10);
  assert.ok(Math.abs(camera.controlYaw - 160.70824354572926) < 1e-10);
  const longitude = focus.longitudeDegrees*r, latitude = focus.latitudeDegrees*r;
  const source = [Math.cos(latitude)*Math.cos(longitude), Math.cos(latitude)*Math.sin(longitude), Math.sin(latitude)];
  const local = [source[1],source[0],source[2]];
  const match = /^matrix3d\(([^)]+)\)$/.exec(scene.systemTransform);
  assert.ok(match, 'Prepared physical carrier must be an explicit matrix');
  const matrix = match[1].split(',').map(Number);
  assert.equal(matrix.length,16);
  const [x,y,z] = [0,1,2].map(row => local.reduce((sum,n,column) => sum+n*matrix[column*4+row],matrix[12+row]));
  const yaw = camera.controlYaw*r, pitch = preparedScenePitch(camera.controlPitch,scene.camera)*r;
  const xx = x*Math.cos(yaw)+z*Math.sin(yaw), zz = -x*Math.sin(yaw)+z*Math.cos(yaw);
  const yy = y*Math.cos(pitch)-zz*Math.sin(pitch), facing = y*Math.sin(pitch)+zz*Math.cos(pitch);
  assert.ok(Math.abs(xx)<1e-12);
  assert.ok(Math.abs(yy)<1e-12);
  assert.ok(facing>.999999999999);
});
