import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {test} from 'node:test';
import {loadShapeCameraImage,applySsiQuality,resolveCatalogCamera,controlledShapeCamera,loadCameraShape} from '../../../tools/objects/terrestrial-layers/shape-camera-mosaic.mjs';
export function checkGalileo(body,anchors,expectedQuality){
 const root=resolve('src/planets',body,'source');
 test(`${body}: calibrated pixels and archived bad-data blocks preserve source identity`,async()=>{
  const config=JSON.parse(await readFile(resolve(root,'preparation/terrestrial.json'))),recipe=config.raster.mosaics[0],frame=recipe.frames[0];
  const image=await loadShapeCameraImage(root,frame);
  assert.equal(image.offset,2880);assert.deepEqual(image.quality,expectedQuality);
  for(const [x,y,value] of anchors)assert.equal(image.data[y*800+x],value); // Independent Astropy primary-image decoding.
  const damaged=body==='ida'?379*800+400:301*800+10;assert.equal(image.missing[damaged],1);
  const valid=body==='ida'?160*800+510:450*800+130;assert.equal(image.missing[valid],0);
  image.data[valid]=0;applySsiQuality(image,await readFile(resolve(root,frame.quality.rawPath)),await readFile(resolve(root,frame.quality.badDataPath),'utf8'),frame.quality);
  assert.equal(image.missing[valid],0,'Finite calibrated darkness is not unavailable imagery');
  await assert.rejects(loadShapeCameraImage(root,{...frame,quality:{...frame.quality,filter:'WRONG'}}),/different observation/);
  assert.throws(()=>applySsiQuality(image,Buffer.alloc(10),'',frame.quality),/FITS/);
 });
 test(`${body}: published camera controls use the full original radial mesh`,async()=>{
  const config=JSON.parse(await readFile(resolve(root,'preparation/terrestrial.json'))),frame=await resolveCatalogCamera(root,config.raster.mosaics[0].frames[0]),camera=controlledShapeCamera(frame);
  assert.deepEqual(camera.project([0,0,0]),body==='ida'?[546,191]:[116.4,435]);
  assert.ok(Math.abs(frame.pixelAngleMicroradians-10.152967377580689)<1e-12);
  const mesh=await loadCameraShape(root,config.geometry.radialTerrain);assert.equal(mesh.faces,32040);assert.equal(mesh.positions.length,16022);
  for(const [x,y] of body==='ida'?[[510,160],[555,220],[605,230]]:[[100,370],[130,450],[175,425]]){
   const ray=camera.ray(x,y),hit=mesh.intersect(camera.position,ray);assert.ok(hit);
   const point=camera.position.map((n,k)=>n+ray[k]*hit.radius),pixel=camera.project(point);
   assert.ok(Math.hypot(pixel[0]-x,pixel[1]-y)<1e-8);
  }
  assert.equal(mesh.intersect(camera.position,camera.position.map(v=>v/Math.hypot(...camera.position))),null);
 });
}
