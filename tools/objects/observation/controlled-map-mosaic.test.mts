import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();import assert from 'node:assert/strict';
import {areaSampler,parseControlledFrames,parseControlledMapProfile,controlledMapPoint,controlledMapBounds,samplePolarCell,matchControlledMapLevels} from './controlled-map-mosaic.mts';
const profile=parseControlledMapProfile({referenceRadiusMeters:100,wavelengthMicrometers:.611,filter:'CLEAR',displayRange:[0,2],polarBoundaryDegrees:78.75});
const base={id:'frame',path:'frame.tif',width:40,height:40,noData:-999,transform:[-20,1,0,20,0,-1],projection:'polar-stereographic',centerLongitude:0,poleLatitude:90};
test('area integration agrees with direct source-square intersections',()=>{
 const width=7,height=5,data=Float32Array.from({length:width*height},(_,i)=>i%6/4),sample=areaSampler(data,width,height,-999);
 for(const [x0,y0,x1,y1] of [[.1,.2,6.7,4.8],[1.2,.3,3.9,3.1],[0,0,7,5],[2,1,4,3]]){
  let sum=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)sum+=data[y*width+x]!*Math.max(0,Math.min(x+1,x1!)-Math.max(x,x0!))*Math.max(0,Math.min(y+1,y1!)-Math.max(y,y0!));
  assert.ok(Math.abs(sample((x0!+x1!)/2,(y0!+y1!)/2,x1!-x0!,y1!-y0!)!-sum/((x1!-x0!)*(y1!-y0!)))<1e-10);
 }
});
test('observed black remains valid; missing contributors and edges stay missing',()=>{
 const sample=areaSampler([0,2,4,-999],2,2,-999);
 assert.equal(sample(.5,.5,0,0),0);assert.equal(sample(1,.5,0,0),1);assert.equal(sample(1,1,2,2),null);assert.equal(sample(0,.5,0,0),null);
 assert.equal(areaSampler([0,2,4,8],2,2,0)(.5,.5,1,1),null);
 assert.equal(areaSampler([1,2,3,4],2,2,null)(1,1,2,2),2.5);
});
test('polar projection agrees with analytic cardinal positions in both hemispheres',()=>{
 const radius=100,rho=200*(2-Math.sqrt(3));
 for(const sign of [-1,1]){
  const frame=parseControlledFrames([{...base,poleLatitude:90*sign}])[0]!;
  for(const [lon,expected] of [[0,[0,-sign*rho]],[90,[rho,0]],[180,[0,sign*rho]],[270,[-rho,0]]] as const){
   const actual=controlledMapPoint(frame,radius,lon,sign*60);assert.ok(Math.hypot(actual[0]-expected[0],actual[1]-expected[1])<1e-12);
  }
  const bounds=controlledMapBounds(frame,radius);assert.equal(bounds.west,0);assert.equal(bounds.east,360);assert.equal(sign===1?bounds.north:bounds.south,90*sign);
 }
});
test('polar footprints preserve constants and the projected linear ramp',()=>{
 const frame=parseControlledFrames([base])[0]!,constant=areaSampler(new Float32Array(1600).fill(.5),40,40,-999);
 assert.equal(samplePolarCell(constant,frame,profile,50,88,.5),.5);
 const data=Float64Array.from({length:1600},(_,i)=>((i%40)+.5)/40),sample=areaSampler(data,40,40,-999);
 let reference=0;const n=200;
 for(let y=0;y<n;y++)for(let x=0;x<n;x++)reference+=(controlledMapPoint(frame,100,50+((x+.5)/n-.5)*.5,88+((y+.5)/n-.5)*.5)[0]+20)/40;
 assert.ok(Math.abs(samplePolarCell(sample,frame,profile,50,88,.5)!-reference/n**2)<1e-6);
});
test('projection and identity constraints reject unsupported recipes',()=>{
 assert.throws(()=>parseControlledFrames([{...base,poleLatitude:80}]));
 assert.throws(()=>parseControlledFrames([base,base]));
 assert.throws(()=>parseControlledFrames([{...base,transform:[0,0,0,0,0,-1]}]));
 assert.throws(()=>parseControlledMapProfile({referenceRadiusMeters:100,wavelengthMicrometers:.611,filter:'GREEN',displayRange:[0,2],polarBoundaryDegrees:78.75}));
});
test('photographic inserts preserve the global base and cap fitted exposure against native highlights',()=>{
 const width=8,height=4,count=width*height,base={rgb:new Uint8Array(count*3).fill(255),missing:new Uint8Array(count)};
 const result={values:new Float32Array(count),owners:new Uint16Array(count),rgb:new Uint8Array(count*3),missing:new Uint8Array(count).fill(1),
  report:{display:{range:[0,2]},frames:[{id:'image',nativeMaximum:.5}]}};
 for(let y=1;y<3;y++)for(let x=2;x<6;x++){const i=y*width+x;result.owners[i]=1;result.missing[i]=0;result.values[i]=.25;}
 // Missing reference pixels cannot determine the exposure. A valid black
 // photograph stays black, and a true gap in both observations stays missing.
 base.missing[10]=1;result.values[11]=0;base.missing[0]=1;
 const report=matchControlledMapLevels(result,base,width,height,{boundaryPixels:1});
 assert.equal(report.levels[0]!.requestedGain,8);assert.equal(report.levels[0]!.gain,4);
 assert.equal(result.rgb[12*3],188);assert.equal(result.rgb[11*3],0);
 assert.equal(result.rgb[3],255);assert.equal(result.missing[1],0);assert.equal(result.missing[0],1);
 assert.equal(result.values[12],.25,'Calibrated source value stays unchanged');
 assert.throws(()=>matchControlledMapLevels(result,base,width,height,{boundaryPixels:0}));
});
