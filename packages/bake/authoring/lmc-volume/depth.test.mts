import test from 'node:test';
import assert from 'node:assert/strict';
import {cloudProfile,sechProfile,splitClouds,makeDepthFields,makeDepthModel,CEPHEID_SKY_SECH_SCALE,CEPHEID_NORMAL_SECH_SCALE,BAR_SIGMA_Z,BAR_QZ_LIMIT,BAR_VERTICAL_OFFSET,BLEND_PIXELS} from './depth-model.mts';
import {makeRaster,at,type Sources} from './inputs.mts';
import {distanceToEdge,type PhotoSky,HEIGHTS} from './photo-convert.mts';
import {bodyToIcrs,normalize,rayInBody,add,mul,INCLINATION,BAR_OFFSET,BAR_ANGLE,type V3} from './geometry.mts';
import {SIGMA_BAR,BAR_RATIO,sampleModel} from './model.mts';
import {project,outsideCamera} from './render.mts';
const raster=(v:number,n=64,half=8)=>{const m=makeRaster(n,half);m.values.fill(v);m.mask.fill(1);return m;};
const sources=():Sources=>({warp:raster(0),dust:raster(.05,64,4),young:[raster(0),raster(0),raster(0)],youngCoverage:raster(0),youngFraction:0,oldColor:[1.4,1,.55],gas:raster(0),metadata:{}});
function photo(size=96){
 const colors:V3[]=[[1.4,1,.55],[.7,1,1.47],[2.08,1,1.06]],valid=new Uint8Array(size*size).fill(1),rgb=new Float64Array(size*size*3),values=new Float32Array(size*size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const q=.3*Math.exp(-((x-size*.45)**2+(y-size*.55)**2)/45);values[y*size+x]=q;for(let c=0;c<3;c++)rgb[(y*size+x)*3+c]=.01*(colors[0][c]+colors[1][c])+q*colors[2][c];}
 const sky:PhotoSky={width:size,height:size,valid,rgb,distance:distanceToEdge(valid,size,size),rawDust:new Float32Array(size*size).fill(.1),colors,metadata:{}};
 const mapping={rayAt:(x:number,y:number)=>normalize(bodyToIcrs([((x/size)*2-1)*8,(1-y/size*2)*8,0])),pixelOf:(p:readonly number[]):[number,number]=>{const r=rayInBody(normalize([p[0],p[1],p[2]])),q=add(r.origin,mul(r.direction,-r.origin[2]/r.direction[2]));return [(q[0]/8+1)*size/2,(1-q[1]/8)*size/2];}};
 return{sky,values,mapping};
}
test('Cepheid depth retains the published sech-squared definition and coordinate conversion',()=>{
 assert.equal(CEPHEID_SKY_SECH_SCALE,1.94);assert.ok(Math.abs(CEPHEID_NORMAL_SECH_SCALE-1.94*Math.cos(INCLINATION))<1e-12);
 let sum=0,m=0;for(let z=-18;z<18;z+=.003){const v=sechProfile(z)*.003;sum+=v;m+=v*z*z;}assert.ok(Math.abs(sum-1)<1e-7);assert.ok(Math.abs(Math.sqrt(m/sum)-Math.PI*CEPHEID_NORMAL_SECH_SCALE/Math.sqrt(12))<1e-4);assert.ok(sechProfile(2)>sechProfile(0)*.2,'The 100 pc sheet cannot pass');
});
test('a compact cloud has unit integrated light and the declared line-of-sight variance',()=>{
 const h=.4;let sum=0,m=0;for(let q=-h;q<h;q+=.0002){const v=cloudProfile(q,h)*.0002;sum+=v;m+=v*q*q;}assert.ok(Math.abs(sum-1)<1e-8);assert.ok(Math.abs(m-h*h/7)<1e-8);assert.equal(cloudProfile(.401,h),0);
});
test('measured regions have equal sky and depth RMS, centres on the plane and shrinking cross sections',()=>{
 const {sky,values,mapping}=photo(),s=sources(),split=splitClouds(values,sky,mapping,s.warp,'gas');assert.ok(split.regions.length>0);
 for(const r of split.regions){assert.ok(Math.abs(r.losSigmaKpc/r.skySigmaKpc-1)<1e-6);assert.equal(r.centerKpc[2],0);assert.ok(r.halfDepthMaxKpc>r.losSigmaKpc);}
 const nonzero=Array.from(split.halfDepth).filter(v=>v>0);assert.ok(Math.max(...nonzero)>Math.min(...nonzero)*1.5,'A repeated image with constant thickness must fail');
 for(let i=0;i<values.length;i++)assert.ok(split.light[i]<=values[i]+1e-7,'Converting clouds cannot create or duplicate light');
});
test('the bar is an ellipsoid at its own published limit, with no fabricated global offset',()=>{
 assert.equal(BAR_QZ_LIMIT,.35);assert.equal(BAR_VERTICAL_OFFSET,0);assert.ok(Math.abs(BAR_SIGMA_Z-SIGMA_BAR*.35)<1e-12);
 const s=sources(),{sky,mapping}=photo(),f=makeDepthFields(sky,mapping,s,64),model=makeDepthModel(f,s),a=new Float64Array(16),b=new Float64Array(16);
 sampleModel(model,...BAR_OFFSET,a);sampleModel(model,BAR_OFFSET[0],BAR_OFFSET[1],BAR_SIGMA_Z,b);assert.ok(Math.abs(b[4]/a[4]-Math.exp(-.5))<1e-10);
 f.maps[1].values.fill(0);sampleModel(model,...BAR_OFFSET,b);assert.ok(Math.abs(a[4]-b[4])<1e-12,'The bar must not depend on a repeated photo layer');
});
test('the wide blend keeps a stellar continuation and the depth model reaches the renderer',()=>{
 assert.ok(BLEND_PIXELS>=60);const s=sources(),{sky,mapping}=photo(),fields=makeDepthFields(sky,mapping,s,64),model=makeDepthModel(fields,s);
 assert.ok(at(fields.maps[0],7.8,0)>0);assert.ok(fields.regions.some(r=>r.component==='gas'));
 const camera=outsideCamera(90,24,4),basis=project(model,camera,.075,1);assert.ok(basis.planes[1].some(v=>v>0));assert.ok(basis.planes[3].some(v=>v>0));assert.ok(basis.planes[4].some(v=>v>0));
 const outside=new Float64Array(16);sampleModel(model,13,0,0,outside);assert.ok(outside[1]>0,'The stellar profile cannot stop at the working map rectangle');assert.equal(outside[10],0);assert.equal(outside[13],0);
 const remove=model.sampleField;model.sampleField=(x,y,z,out)=>{remove!(x,y,z,out);out[9]=out[10]=out[11]=out[12]=out[13]=out[14]=0;};const empty=project(model,camera,.075,1);assert.ok(empty.planes[3].every(v=>v===0));assert.ok(empty.planes[4].every(v=>v===0));
});
test('finite cloud emission reaches the ray integrator and is removed rather than duplicated',()=>{
 const s=sources(),{sky,mapping}=photo(),fields=makeDepthFields(sky,mapping,s,96),model=makeDepthModel(fields,s),camera=outsideCamera(0,32,4);
 const withClouds=project(model,camera,.025,1).planes[4];
 for(const group of fields.clouds)for(const m of group)m.values.fill(0);
 const diffuse=project(model,camera,.025,1).planes[4];let extra=0;for(let i=0;i<withClouds.length;i++)extra+=withClouds[i]-diffuse[i];assert.ok(extra>.01,'Removing finite clouds from the model must go red');
 const again=project(model,camera,.025,1).planes[4];assert.deepEqual(again,diffuse,'The removed flat contribution must not be added back by a fallback path');
});
test('a cloud centre converges onto the measured warp while preserving its Earth ray',()=>{
 const {sky,values,mapping}=photo(),s=sources();for(let y=0;y<s.warp.n;y++)for(let x=0;x<s.warp.n;x++)s.warp.values[y*s.warp.n+x]=.6+.4*((x+.5)/s.warp.n*2-1)*s.warp.half;
 const split=splitClouds(values,sky,mapping,s.warp,'gas');assert.ok(split.regions.length>0);for(const r of split.regions)assert.ok(Math.abs(r.centerKpc[2]-at(s.warp,r.centerKpc[0],r.centerKpc[1]))<1e-7);
});
test('the wider footprint fade preserves Bell through one fixed column normalization',()=>{
 const {sky,mapping}=photo(),s=sources(),a=makeDepthFields(sky,mapping,s,64),record=a.metadata.bellFinal;assert.ok(record&&typeof record==='object'&&!Array.isArray(record));
 assert.ok('meanObservedLosTauV' in record&&'meanInferredLosTauV' in record&&typeof record.meanObservedLosTauV==='number'&&typeof record.meanInferredLosTauV==='number');assert.ok(Math.abs(record.meanObservedLosTauV/record.meanInferredLosTauV-1)<1e-12);
 s.dust.values.forEach((v,i)=>s.dust.values[i]=v*2);const b=makeDepthFields(sky,mapping,s,64);for(let i=0;i<a.maps[4].values.length;i++)if(a.maps[4].values[i]>0)assert.ok(Math.abs(b.maps[4].values[i]/a.maps[4].values[i]-2)<1e-5);
});
