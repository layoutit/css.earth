import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import {hriiCamera,hriiControlResidual} from './hrii-camera.mts';
const header={GEOMSTAT:'OK',GEOMQUAL:'RECONSTRUCTED',INSTRUME:'HRIIR',DNAXIS1:'+WAVELENGTH',DNAXIS2:'UP, -Yinstr',TARSCRX:10,TARSCRY:0,TARSCRZ:0,TARSUNRX:149597870.7,TARSUNRY:0,TARSUNRZ:0,BORERA:180,BOREDEC:0,CELESTN:0,PXLSCALE:10,TARSCR:10,NAXIS2:64};
const control={bodyToJ2000:[[1,0,0],[0,1,0],[0,0,1]],offsetPixels:[2,-3]};
test('a known right-handed slit camera preserves native detector axes and scale',()=>{
 const camera=hriiCamera(header,control),pixel=camera.project([0,50,-20])!;
 assert.ok(Math.abs(pixel[0]-7)<1e-10);assert.ok(Math.abs(pixel[1]-26.5)<1e-10);
 assert.ok(Math.abs(camera.heliocentricDistanceAu-1)<1e-12);
 const ray=camera.ray(26.5,7),distance=Math.hypot(10000,50,20);
 [-10000,50,-20].forEach((v,i)=>assert.ok(Math.abs(ray[i]-v/distance)<1e-12));
});
test('terrain holdouts use fractional scan frame numbers, not wavelength columns',()=>{
 const a=hriiCamera(header,{...control,offsetPixels:[0,0]}),b=hriiCamera(header,{...control,offsetPixels:[0,2]});
 const result=hriiControlResidual([a,b],[111,112],{frame:111.5,row:32.5,sourcePointMeters:[0,0,0]});
 assert.ok(result.distancePixels<1e-10);
 assert.throws(()=>hriiControlResidual([a,b],[111,112],{frame:110,row:32,sourcePointMeters:[0,0,0]}),/outside/);
});
test('unreconstructed pointing, mirrored body frames and excessive corrections fail',()=>{
 assert.throws(()=>hriiCamera({...header,GEOMQUAL:'PREDICTED'},control),/pointing/);
 assert.throws(()=>hriiCamera(header,{...control,offsetPixels:[33,0]}),/correction/);
 assert.throws(()=>hriiCamera(header,{...control,bodyToJ2000:[[-1,0,0],[0,1,0],[0,0,1]]}),/handedness/);
});
