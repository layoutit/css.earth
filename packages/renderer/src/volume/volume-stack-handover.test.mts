import {test} from 'node:test';
import assert from 'node:assert/strict';
import {axisWeights,completedStackOpacities,transparentStackOpacities,STACK_OPACITY_CEILING} from './prepared-volume-runtime.ts';
import type {PreparedCssVolume} from '@cssearth/objects';
const leaf:PreparedCssVolume['stacks'][number]['leaves'][number]={id:'sample',texturePath:'sample.png',widthPx:1,heightPx:1,centerUnits:[0,0,0],style:{width:'1px',height:'1px',transform:'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)',backgroundSize:'1px 1px',backgroundPosition:'0px 0px'}};
const stacks:PreparedCssVolume['stacks']=['x','y','z'].map(axis=>({axis:axis as 'x'|'y'|'z',leaves:[leaf]}));
function weights(elevation:number,azimuth:number,thickness=2.5){
 const e=elevation*Math.PI/180,a=azimuth*Math.PI/180,t=(Math.PI/2-e)/2,z=a/2;
 return axisWeights({positionUnits:[0,0,60],orientationXyzw:[Math.cos(z)*Math.sin(t),Math.sin(z)*Math.sin(t),Math.sin(z)*Math.cos(t),Math.cos(z)*Math.cos(t)]},stacks,{min:[-10,-10,-thickness/2],max:[10,10,thickness/2]});
}
test('thin volumes use only the thin-axis set at every oblique azimuth',()=>{
 for(let a=0;a<360;a++)for(const e of [10,20,30,45,60,80,90]){
  const w=weights(e,a);assert.equal(w[0]!.weight,0);assert.equal(w[1]!.weight,0);assert.equal(w[2]!.weight,1);
 }
 for(let a=0;a<360;a++)for(let e=0;e<10;e++)assert.ok(Math.abs(weights(e,a).reduce((n,w)=>n+w.weight,0)-1)<1e-12);
});
test('the shallow azimuth bisector cannot switch completed side images discontinuously',()=>{
 for(const a of[45,135,225,315])for(const e of[0,2,5,8]){
  const before=weights(e,a-.001,4),after=weights(e,a+.001,4);
  assert.ok(before[0]!.weight>0&&before[1]!.weight>0);
  assert.ok(Math.max(...before.map((w,i)=>Math.abs(w.weight-after[i]!.weight)))<.001);
 }
});
test('fading equal completed images preserves total light through either stack order and endpoint',()=>{
 for(let i=0;i<=1000;i++)for(const w of [[i/1000,1-i/1000,0],[0,i/1000,1-i/1000],[i/1000,0,1-i/1000]]){
  const o=completedStackOpacities(w);let light=0;
  for(const alpha of o)light=.37*alpha+light*(1-alpha);
  assert.ok(Math.abs(light-.37*STACK_OPACITY_CEILING)<1e-12,`${w}: ${light}`);
  assert.ok(o.every(v=>v>=0&&v<=STACK_OPACITY_CEILING+1e-12));
 }
});

test('thin handover rises continuously inside the frame as the observer approaches',()=>{
 const bounds={min:[-16,-16,-3.2] as const,max:[16,16,3.2] as const};
 const at=(distance:number,elevation:number)=>{const t=(Math.PI/2-elevation*Math.PI/180)/2;return axisWeights({positionUnits:[0,-distance,0],orientationXyzw:[Math.sin(t),0,0,Math.cos(t)]},stacks,bounds);};
 assert.equal(at(34,12)[2]!.weight,1,'far 12 degrees keeps the accepted Z view');
 assert.equal(at(6,12)[2]!.weight,0,'close 12 degrees uses the good side bank');
 assert.equal(at(6,40)[2]!.weight,1,'close steep views still reach Z');
 let prior=at(34,12)[2]!.weight;
 for(let distance=33.99;distance>=1;distance-=.01){const next=at(distance,12)[2]!.weight;assert.ok(Math.abs(next-prior)<.005,'zoom must not step between sets');prior=next;}
});

test('distance-driven three-stack handover preserves completed-image light at all distances',()=>{
 for(const distance of[.01,.2,.6,1,2,4,8,16,24,32,64])for(let a=0;a<=90;a+=3)for(let e=0;e<=45;e++){
  const el=e*Math.PI/180,az=a*Math.PI/180,t=(Math.PI/2-el)/2,z=az/2;
  const w=axisWeights({positionUnits:[0,-distance,0],orientationXyzw:[Math.cos(z)*Math.sin(t),Math.sin(z)*Math.sin(t),Math.sin(z)*Math.cos(t),Math.cos(z)*Math.cos(t)]},stacks,{min:[-16,-16,-3.2],max:[16,16,3.2]});
  const o=completedStackOpacities(w.map(v=>v.weight));let light=0;for(const alpha of o)light=.37*alpha+light*(1-alpha);
  assert.ok(Number.isFinite(light)&&Math.abs(light-.37*STACK_OPACITY_CEILING)<1e-12);
 }
});

test('an opt-in thin handover is wide and continuous, and leaves every other volume alone',()=>{
 const at=(elevation:number,handover?:readonly [number,number])=>{const t=(Math.PI/2-elevation*Math.PI/180)/2,z=15*Math.PI/360;return axisWeights({positionUnits:[0,-90,0],orientationXyzw:[Math.cos(z)*Math.sin(t),Math.sin(z)*Math.sin(t),Math.sin(z)*Math.cos(t),Math.cos(z)*Math.cos(t)]},stacks,{min:[-10,-10,-2.1],max:[10,10,2.1]},handover).map(w=>w.weight);};
 const wide=[.15,.65] as const,z=(cos:number,h?:readonly [number,number])=>at(Math.asin(cos)*180/Math.PI,h)[2]!;
 assert.equal(z(.6614,wide),1,'A stays on the thin stack alone');
 assert.ok(z(.4551,wide)>.5&&z(.4551,wide)<.8,'B shows both');
 assert.ok(z(.2492,wide)<.2,'C is mostly side stacks');
 assert.equal(z(.1,wide),0);
 for(const cos of [.6614,.4551,.2492])assert.equal(z(cos),1,'without the option the accepted rule holds');
 // Under the transparent rule a side stack's own opacity is its share: it rises from zero with the blend, instead of reaching one beneath the thin stack.
 let side=0;for(let e=52;e>=0;e-=.25){const o=transparentStackOpacities(at(e,wide));const next=o[0]!+o[1]!;assert.ok(next>=side-1e-9&&next-side<.02,'side fades in at '+e);side=next;}
 assert.ok(side>.99);
 let prior=at(0,wide);
 for(let e=.05;e<=50;e+=.05){const next=at(e,wide);assert.ok(Math.abs(next.reduce((n,v)=>n+v,0)-1)<1e-12,'shares stay whole');assert.ok(next.every((v,i)=>Math.abs(v-prior[i]!)<.004),'no jump at '+e);prior=next;}
});
