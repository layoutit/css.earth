import {test} from 'node:test';
import assert from 'node:assert/strict';
import {alignCameraBands} from './band-alignment.mts';
import {requireRecord,requireArray,requireFiniteNumber} from '../../sources/source-values.mts';

test('a wider pointing search recovers an independently shifted image under the same holdout limits',()=>{
 const size=224,dx=18,dy=-14;
 const signal=(x:number,y:number)=>{let n=Math.imul(x,73856093)^Math.imul(y,19349663);n=Math.imul(n^(n>>>16),0x45d9f3b);return 1+(n>>>0)/0xffffffff;};
 const make=(xShift:number,yShift:number,gain:number)=>({width:size,height:size,data:Float32Array.from({length:size*size},(_,i)=>gain*signal(i%size-xShift,Math.floor(i/size)-yShift))});
 const mesh={positions:[[-200,-200,0],[200,-200,0],[200,200,0]],indices:[[0,1,2]],intersect:(origin:readonly number[],direction:readonly number[])=>direction[2]<0?{radius:-origin[2]/direction[2],faceId:0}:null};
 const camera=(value:unknown)=>{
  const f=requireRecord(value),center=requireArray(f.center).map(n=>requireFiniteNumber(n)),roll=requireFiniteNumber(f.northAzimuthDegrees)*Math.PI/180,c=Math.cos(roll),s=Math.sin(roll);
  return {position:[0,0,1000],sun:[0,0,1],ray(x:number,y:number){const v=[(x-center[0])/1000,(y-center[1])/1000,-1],n=Math.hypot(...v);return v.map(p=>p/n);},
   project(point:readonly number[]){const x=point[0]*1000/(1000-point[2]),y=point[1]*1000/(1000-point[2]);return[center[0]+c*x-s*y,center[1]+s*x+c*y];}};
 };
 const reference={frame:{id:'reference',center:[size/2,size/2],northAzimuthDegrees:0},image:make(0,0,1),sha256:'reference'},
  targets=[{filter:'test',frame:{id:'shifted',center:[size/2,size/2],northAzimuthDegrees:0},image:make(dx,dy,1.7),sha256:'shifted'}];
 const job={mesh,camera,reference,targets,checkOnly:false};
 const narrow=alignCameraBands(job);assert.equal(narrow.searchRadiusPixels,9);assert.equal(narrow.reports[0].accepted,false);
 const wide=alignCameraBands({...job,searchRadiusPixels:24}),r=wide.reports[0];
 assert.equal(wide.searchRadiusPixels,24);assert.equal(r.accepted,true,JSON.stringify({fit:r.fit,holdout:r.holdout,reason:r.reason}));assert.ok(r.correctedCamera&&r.holdout);
 assert.ok(Math.abs(r.correctedCamera.center[0]-size/2-dx)<.1);assert.ok(Math.abs(r.correctedCamera.center[1]-size/2-dy)<.1);
 assert.ok(r.holdout.count>=6&&r.holdout.rmsPixels<.1);
 assert.throws(()=>alignCameraBands({...job,searchRadiusPixels:65}),/search radius/);
});
