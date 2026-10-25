import test from 'node:test';
import assert from 'node:assert/strict';
import {BODY_X,BODY_Y,BODY_Z,bodyToSky,skyToBody,dot,DEG,BAR_ANGLE,BAR_OFFSET,bodyToIcrs,rayPlane,earthRayOfBody,ORIGIN_ICRS,DISTANCE} from './geometry.mts';
import {makeRaster,at,type Sources} from './inputs.mts';
import {sampleModel,SIGMA_DISC,HEIGHT_DISC,discSurface,exponentialSurface,projectedBarAxes,createModel,type Model} from './model.mts';
import {calibrateVersion,type Fit} from './render.mts';
function fixture():Sources {
  const field=(value:number)=>{const m=makeRaster(16,20);m.values.fill(value);m.mask.fill(1);return m;};
  return {warp:field(1),dust:field(.2),young:[field(.002),field(.001),field(.003)],youngCoverage:field(1),gas:field(.02),youngFraction:.15,oldColor:[1.4,1,.7],metadata:{}};
}
test('published inclination and PA are transported without mirroring',()=>{
  for(const v of [BODY_X,BODY_Y,BODY_Z])assert.ok(Math.abs(dot(v,v)-1)<1e-12);
  assert.ok(Math.abs(dot(BODY_X,BODY_Y))<1e-12);assert.ok(Math.abs(dot(BODY_Y,BODY_Z))<1e-12);
  const recovered=skyToBody(bodyToSky([2,0,0]));for(let c=0;c<3;c++)assert.ok(Math.abs(recovered[c]-(c===0?2:0))<1e-12);
  const p=bodyToSky([Math.cos(BAR_ANGLE),Math.sin(BAR_ANGLE),0]);
  const pa=(Math.atan2(-p[0],p[1])/DEG+360)%180;assert.ok(Math.abs(pa-121.26)<1e-10);
  assert.ok(Math.abs(Math.hypot(...BAR_OFFSET)-.76*49.59/49.9)<1e-12);
});
test('Earth rays recover their measured plane positions',()=>{
  for(const p of [[0,0,0],[2,3,0],[-4,1,0]] as [number,number,number][]){const q=rayPlane(earthRayOfBody(p));for(let c=0;c<3;c++)assert.ok(Math.abs(q[c]-p[c])<1e-10);}
  assert.ok(Math.hypot(...bodyToIcrs([0,0,0]))>49);
});
test('the binary distance anchors the disc center after the offset bar is placed',()=>{
  assert.ok(Math.abs(Math.hypot(...ORIGIN_ICRS)-DISTANCE)<1e-10);
});
test('Kacharov Gaussian is normalized and is not replaced by the historical exponential',()=>{
  let flux=0;for(let r=.001;r<20;r+=.002)flux+=discSurface(r)*2*Math.PI*r*.002;
  assert.ok(Math.abs(flux-1)<1e-5);assert.ok(Math.abs(HEIGHT_DISC/SIGMA_DISC-.23)<1e-15);
  assert.ok(discSurface(0)<exponentialSurface(0));assert.ok(discSurface(2)>exponentialSurface(2));
});
test('the selected bar deprojection recovers the published projected axis ratio',()=>{
  const [a,b]=projectedBarAxes(.38,.23,25*DEG,-61.3*DEG);assert.ok(Math.abs(b/a-.37)<.005);
});
test('removing each physical addition changes its own field',()=>{
  const sources=fixture(),all=createModel(7,[1,2,3,4,5,6,7],sources),out=new Float64Array(16),removed=new Float64Array(16);
  for(const stage of [2,3,4,5,6,7]){
    const point:[number,number,number]=stage===4?[12,0,1]:[.3,.5,1];sampleModel(all,...point,out);sampleModel({...all,kept:all.kept.filter(s=>s!==stage)},...point,removed);
    assert.ok(out.some((v,i)=>Math.abs(v-removed[i])>1e-12),`l${stage} component deletion must go red`);
  }
});
test('missing source cells cannot be interpreted as observed zero or interpolated across',()=>{
  const map=makeRaster(4,2);map.values.fill(5);map.mask.fill(1);assert.equal(at(map,0,0),5);map.mask[5]=0;assert.equal(at(map,0,0),0);
});
test('the far-outskirts normalization cannot be inferred from photographic numerical tails',()=>{
  const planes=Array.from({length:5},()=>new Float64Array(3));planes[2].fill(1e-40);
  const initial:Fit={gains:[1,1,9,1,1],red:1,blue:1,dust:0,loss:0,iterations:0};
  const basis={width:1,height:1,planes,dustGain:0};
  for(const brightness of [0,1,100]){
    const fit=calibrateVersion(basis,{data:new Float64Array(3).fill(brightness),train:new Uint8Array([1]),holdout:new Uint8Array([0])},initial,4);
    assert.equal(fit.gains[2],1);
  }
});
test('unobserved population cells preserve their smooth stellar parent instead of painting survey gaps',()=>{
  const sources=fixture();sources.youngCoverage.values.fill(0);for(const m of sources.young)m.values.fill(0);
  const out=new Float64Array(16),parent=new Float64Array(16);
  sampleModel(createModel(5,[1,2,5],sources),.3,.5,0,out);
  sampleModel(createModel(2,[1,2],sources),.3,.5,0,parent);
  for(let c=0;c<6;c++)assert.ok(Math.abs(out[c]-parent[c])<1e-14);
});
test('the faint outer population does not introduce an artificial hollow ring',()=>{
  const sources=fixture(),m=createModel(4,[1,4],sources),out=new Float64Array(16);let previous=Infinity;
  for(let r=0;r<19;r+=.05){sampleModel(m,r,0,0,out);const total=out[1]+out[7];assert.ok(total<=previous+1e-14,`Spurious outward brightening at ${r} kpc`);previous=total;}
});
