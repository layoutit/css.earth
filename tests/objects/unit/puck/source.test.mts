import {array,number,shape,text} from '../../../../tools/objects/terrestrial-layers/source-records.mts';
import {required} from '../../../../tools/contract/test-values.mts';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('puck');
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parsePdsRadiusTable} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import {decodeCalibratedCamera,controlledShapeCamera} from '../../../../tools/objects/terrestrial-layers/shape-camera-mosaic.mts';

const root=new URL('../../../../src/objects/puck/source/',import.meta.url);

test('Puck decodes the actual Voyager calibrated HALF raster without consuming header bytes',async()=>{
  const bytes=await readFile(new URL('observations/C2683716_GEOMED.IMG',root));
  const image=decodeCalibratedCamera(bytes);
  assert.equal(image.width,1000);assert.equal(image.height,1000);assert.equal(image.offset,2000);
  for(const [x,y] of [[0,0],[427,700],[420,690],[999,999]] as const){
    const index=y*1000+x;
    assert.ok(Math.abs(image.data[index]-bytes.readInt16LE(2000+index*2)*0.0001)<1e-8);
  }
  assert.ok(image.data[700*1000+427]>0.01,'the independently selected disc center contains source signal');
});

test('Puck camera scale and north roll agree with the source matrix and 81 km reference sphere',async()=>{
  const recipe=JSON.parse((await readFile(new URL('preparation/terrestrial.json',root))).toString('utf8'));
  const registration=JSON.parse((await readFile(new URL('geometry/registration.json',root))).toString('utf8'));
  const frame=recipe.raster.surfaceObservations[0].frames[0];
  const shape=parsePdsRadiusTable(await readFile(new URL('shape/ellipsoid.tab',root),'utf8'),recipe.geometry.radialTerrain.grid);
  for(const [lon,lat] of [[0,0],[90,0],[180,0],[0,90],[0,-90]] as const)assert.ok(Math.abs(required(shape.sample(lon,lat))-81000)<1e-6);
  const evidence=registration.frames[0].rollEvidence;
  const pole=array(array(number))(evidence.cameraMatrix).map(row=>row.reduce((sum: number,x: number,i: number)=>sum+x*evidence.poleIcrf[i],0));
  assert.ok(Math.abs(Math.atan2(pole[0],-pole[1])*180/Math.PI-frame.northAzimuthDegrees)<1e-8);
  const camera=controlledShapeCamera(frame);
  assert.deepEqual(camera.project([0,0,0]),frame.center);
  const apparentRadius=81000/(frame.rangeKm*1000*Math.tan(frame.pixelAngleMicroradians*1e-6));
  assert.ok(apparentRadius>20&&apparentRadius<20.1,'corrected source disc is approximately 40 pixels across');
});
