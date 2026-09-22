import {required} from '../../../../tools/contract/test-values.mts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parsePdsRadiusTable} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import {controlledShapeCamera, decodeCalibratedCamera} from '../../../../tools/objects/terrestrial-layers/shape-camera-mosaic.mts';
const root=new URL('../../../../src/objects/methone/source/',import.meta.url);

test('Methone shape preserves the published semi-axes in physical metres',async()=>{
 const config=JSON.parse((await readFile(new URL('preparation/terrestrial.json',root))).toString('utf8'));
 const shape=parsePdsRadiusTable(await readFile(new URL('shape/ellipsoid.tab',root),'utf8'),config.geometry.radialTerrain.grid);
 for(const[lon,lat,metres]of[[0,0,1940],[90,0,1290],[180,0,1940],[270,0,1290],[0,90,1210],[0,-90,1210]] as const)assert.ok(Math.abs(required(shape.sample(lon,lat))-metres)<.001);
});

test('Methone camera follows source north orientation and decodes calibrated I/F',async()=>{
 const config=JSON.parse((await readFile(new URL('preparation/terrestrial.json',root))).toString('utf8')),frame=config.raster.surfaceObservations[0].frames[0];
 const record=JSON.parse((await readFile(new URL('survey/source-camera.json',root))).toString('utf8'));
 const matrix=record.bodyToCamera,north=[matrix[0][2],matrix[1][2],matrix[2][2]];
 const expected=(Math.atan2(-north[0],north[1])*180/Math.PI+360)%360;
 assert.ok(Math.abs(frame.northAzimuthDegrees-expected)<1e-9);
 const camera=controlledShapeCamera(frame),center=camera.project([0,0,0]);assert.deepEqual(center,frame.center);
 const sample=decodeCalibratedCamera(await readFile(new URL(frame.path,root)));
 assert.equal(sample.offset,8192);assert.equal(sample.width,1024);assert.equal(sample.height,1024);
 // The observed illuminated interior is finite linear I/F, not header bytes.
 const brightness=sample.data[660*1024+500];assert.ok(brightness>.1&&brightness<.7);
});
