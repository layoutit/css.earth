import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeEquinox} from './qualify-gas.mts';
import {tone,inverseTone,validateGrade,gradedPrediction,type Grade} from './grade.mts';
import {makeRaster,type Sources} from './inputs.mts';
import {createModel,sampleModel,gasFootpoint,gaussian,HEIGHT_DISC} from './model.mts';
import {bodyToIcrs,rayInBody,add,mul,type V3} from './geometry.mts';
import {project,outsideCamera} from './render.mts';
import {nativeWeight} from './native.mts';
const grade:Grade={coefficients:[[1,1,1],[1,1,1],[1,1,1],[1,1,1]],dustStrength:1,dustTint:[1,1,1],stretch:0,saturation:1,score:0};
function card(key:string,value:string){return `${key.padEnd(8)}= ${value}`.padEnd(80);}
test('DeMCELS duplicate metadata is normalized without changing the source bytes',()=>{
  const bytes=Buffer.from(card('EQUINOX','2000.0')+card('CRPIX1','4350.5')+card('EQUINOX','2000.0000')+card('CRPIX1','165.5')+'END'.padEnd(80)),copy=Buffer.from(bytes),normalized=normalizeEquinox(bytes);
  assert.deepEqual(bytes,copy);assert.equal(normalized.bytes.length,bytes.length);assert.equal(normalized.cards.length,2);
  assert.equal(normalized.bytes.toString('ascii',0,7),'COMMENT');assert.equal(normalized.bytes.toString('ascii',80,87),'COMMENT');
  assert.ok(normalized.bytes.toString('ascii').includes(card('CRPIX1','165.5')));
  assert.throws(()=>normalizeEquinox(Buffer.from(card('EQUINOX','2000')+card('EQUINOX','1950')+'END'.padEnd(80))),/Conflicting duplicate/u);
  assert.throws(()=>normalizeEquinox(Buffer.from(card('ORIGIN',"'https://one'")+card('ORIGIN',"'https://two'")+'END'.padEnd(80))),/Conflicting duplicate/u);
});
test('native astrometry has a radial presentation limit, independent of survey polygons',()=>{
  assert.equal(nativeWeight(0),1);assert.equal(nativeWeight(7),1);assert.equal(nativeWeight(9),0);assert.equal(nativeWeight(8.75),.5);
});
test('Bell attenuation cannot be erased by calibration',()=>{
  assert.throws(()=>validateGrade({...grade,dustStrength:0}),/positive/u);assert.doesNotThrow(()=>validateGrade({...grade,dustStrength:.25}));
});
test('component RGB grading is global and isolates the named component',()=>{
  const planes=Array.from({length:5},()=>new Float64Array(6));planes[0].set([1,1,1,2,2,2]);planes[1].set([3,3,3,6,6,6]);
  const basis={width:2,height:1,planes,dustGain:0},base=gradedPrediction(basis,grade),changed=gradedPrediction(basis,{...grade,coefficients:[[1,1,1],[2,1,1],[1,1,1],[1,1,1]]});
  assert.equal(changed[0]-base[0],3);assert.equal(changed[3]-base[3],6);assert.equal(changed[1],base[1]);assert.equal(changed[2],base[2]);
});
test('the one display curve has a reversible unclipped mapping',()=>{
  const original=[.2,.17,.13],mapped=tone(...original as [number,number,number],6,1.6),recovered=inverseTone(new Float64Array(mapped),6,1.6);
  for(let c=0;c<3;c++)assert.ok(Math.abs(recovered[c]-original[c])<1e-12);
});
function fixture():Sources {
  const field=(v:number)=>{const m=makeRaster(16,20);m.values.fill(v);m.mask.fill(1);return m;};
  return {warp:field(1),dust:field(.2),young:[field(0),field(0),field(0)],youngCoverage:field(1),gas:field(0),youngFraction:.15,oldColor:[1,1,1],metadata:{}};
}
test('native stars reach the renderer individually, with only a four-pixel footprint',()=>{
  const s=fixture();s.nativeStars={count:1,positions:new Float64Array([.12,.07,1]),rgb:new Float64Array([1,1,1]),earthTau:new Float32Array([.2]),metadata:{}};
  const model=createModel(5,[1,2,3,4,5],s),p=project(model,outsideCamera(0,32,8),.2,0),plane=p.planes[3];
  let nonzero=0,flux=0;for(let i=1;i<plane.length;i+=3){if(plane[i]>0)nonzero++;flux+=plane[i]*.25;}
  assert.equal(nonzero,4);assert.ok(Math.abs(flux-s.youngFraction*model.youngBudget)<1e-12);
  const sample=new Float64Array(16);sampleModel(model,.12,.07,1,sample);assert.equal(sample[10],0,'Regional light must not double-count individual stars');
});
test('conditional H-alpha depth preserves its measured angular structure',()=>{
  const s=fixture();for(let y=0;y<s.gas.n;y++)for(let x=0;x<s.gas.n;x++)s.gas.values[y*s.gas.n+x]=x+2*y+1;
  const model=createModel(7,[1,2,3,4,5,6,7],s),anchor:V3=[2,1,1],out=new Float64Array(16);let previous:number|undefined;
  const p=bodyToIcrs(anchor),norm=Math.hypot(...p),r=rayInBody([p[0]/norm,p[1]/norm,p[2]/norm]);
  for(const z of [-.2,.2,1.5]){const t=(z-r.origin[2])/r.direction[2],point=add(r.origin,mul(r.direction,t)),q=gasFootpoint(model,...point);assert.ok(Math.hypot(q[0]-anchor[0],q[1]-anchor[1])<1e-10);
    sampleModel(model,...point,out);const column=out[12]/gaussian(z-1,HEIGHT_DISC/2);if(previous!==undefined)assert.ok(Math.abs(column-previous)<1e-10);previous=column;
  }
});
test('warp and outskirts survive all the way to the integrated image',()=>{
  const s=fixture(),all=createModel(4,[1,2,3,4],s),camera=outsideCamera(90,32,20),full=project(all,camera,.2,0);
  for(const removed of [3,4]){
    const ablated=project({...all,kept:all.kept.filter(v=>v!==removed)},camera,.2,0);let delta=0;
    for(let component=0;component<3;component++)for(let i=0;i<full.planes[component].length;i++)delta+=Math.abs(full.planes[component][i]-ablated.planes[component][i]);
    assert.ok(delta>1e-5,`Removing stage ${removed} must change rendered pixels`);
  }
});
