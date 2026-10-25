import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRaster,type Sources} from './inputs.mts';
import {ADOPTED_LAYERS,adoptedDepthFields,makeDepthModel,BAR_SIGMA_Z,type DepthFields} from './depth-model.mts';
import {HEIGHTS} from './photo-convert.mts';
import {sampleModel} from './model.mts';
import {rayInBody,type V3} from './geometry.mts';
const raster=(value:number)=>{const r=makeRaster(16,8);r.values.fill(value);r.mask.fill(1);return r;};
const sources=():Sources=>({warp:raster(0),dust:raster(0),young:[raster(0),raster(0),raster(0)],youngCoverage:raster(0),youngFraction:0,oldColor:[1,1,1],gas:raster(0),metadata:{}});
const fields=():DepthFields=>({maps:[raster(1),raster(0),raster(1),raster(1),raster(1)],clouds:Array.from({length:2},()=>Array.from({length:3},()=>raster(0))),regions:[],colors:[[1,1,1],[1,1,1],[1,1,1]],barNormalization:1,metadata:{priorNormalization:1}});
test('l10 uses the owner-adopted Gaussian sigmas through the actual sampler',()=>{
 const f=fields(),s=sources(),m=makeDepthModel(adoptedDepthFields(f),s),slots=[1,10,13,15],expected=[HEIGHTS.old,.15,.15,.25],sum=[0,0,0,0],moment=[0,0,0,0],out=new Float64Array(16);
 for(let z=-3;z<3;z+=.002){sampleModel(m,0,0,z,out);for(let k=0;k<slots.length;k++){const v=out[slots[k]]*.002;sum[k]+=v;moment[k]+=v*z*z;}}
 for(let k=0;k<slots.length;k++)assert.ok(Math.abs(Math.sqrt(moment[k]/sum[k])-expected[k])<1e-8,`Wrong actual sigma in slot ${slots[k]}`);
 assert.equal(ADOPTED_LAYERS.young,'gaussian');assert.equal(ADOPTED_LAYERS.version,10);assert.equal(BAR_SIGMA_Z,HEIGHTS.bar/.23*.35);
});
test('l10 changes no maps, knots, colors, or bar geometry',()=>{
 const f=fields(),g=adoptedDepthFields(f);assert.equal(g.maps,f.maps);assert.equal(g.clouds,f.clouds);assert.equal(g.regions,f.regions);assert.equal(g.colors,f.colors);assert.equal(g.barNormalization,f.barNormalization);
 const s=sources(),a=makeDepthModel(f,s),b=makeDepthModel(g,s),x=new Float64Array(16),y=new Float64Array(16);
 for(const z of [0,.2,.6]){sampleModel(a,.2,.3,z,x);sampleModel(b,.2,.3,z,y);for(let k=0;k<9;k++)assert.equal(x[k],y[k]);}
 for(const m of f.maps)m.values.fill(0);f.barNormalization=g.barNormalization=0;
 const observer=rayInBody([0,0,1]).origin,distance=Math.hypot(...observer);for(const group of f.clouds){group[0].values.fill(1);group[1].values.fill(.2);group[2].values.fill(distance);}
 const old=makeDepthModel(f,s),current=makeDepthModel(g,s);
 for(const p of [[0,0,0],[.02,.01,.05],[0,0,.4]] satisfies V3[]){sampleModel(old,...p,x);sampleModel(current,...p,y);assert.deepEqual(x,y);}
});
test('changing Gaussian widths preserves the component and dust columns',()=>{
 const f=fields(),s=sources(),models=[makeDepthModel(f,s),makeDepthModel(adoptedDepthFields(f),s)],integrals=models.map(()=>new Float64Array(3)),out=new Float64Array(16);
 for(let z=-11.99;z<11.99;z+=.01)for(let i=0;i<2;i++){sampleModel(models[i],0,0,z,out);for(let k=0;k<3;k++)integrals[i][k]+=out[[10,13,15][k]]*.01;}
 for(let k=0;k<3;k++)assert.ok(Math.abs(integrals[0][k]/integrals[1][k]-1)<3e-6,'The width change must not add column light or dust');
});
