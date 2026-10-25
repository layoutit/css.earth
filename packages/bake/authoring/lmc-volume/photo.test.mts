import test from 'node:test';
import assert from 'node:assert/strict';
import {solve3,splitPixel,transmission,transfer,HEIGHTS,distanceToEdge,type PhotoSky} from './photo-convert.mts';
import {makePhotoFields,makePhotoModel,photoFootpoint} from './photo-model.mts';
import {makeRaster,type Sources} from './inputs.mts';
import {sampleModel,gaussian,EXTINCTION_RGB} from './model.mts';
import {project,outsideCamera} from './render.mts';
import {bodyToIcrs,normalize,rayInBody,add,mul,type V3} from './geometry.mts';
const colors:V3[]=[[1.4,1,.55],[.7,1,1.47],[7.44,1,3.17]];
const field=(v:number,n=32,half=12)=>{const m=makeRaster(n,half);m.values.fill(v);m.mask.fill(1);return m;};
function sources():Sources{return{warp:field(.2),dust:field(.1,32,4),young:[field(0),field(0),field(0)],youngCoverage:field(0),youngFraction:.15,oldColor:[1.4,1,.55],gas:field(0),metadata:{}};}
test('the spectral inverse directly recovers known component intensities',()=>{
  const weights=[.2,.3,.01],rgb:V3=[0,0,0];for(let c=0;c<3;c++)for(let k=0;k<3;k++)rgb[c]+=colors[k][c]*weights[k];
  const result=solve3(colors,rgb);for(let k=0;k<3;k++)assert.ok(Math.abs(result[k]-weights[k])<1e-12);
});
test('Gordon attenuation and component-specific heights enter the direct color split',()=>{
  const tau=.3,fb=.4,weights=[.2,.3,.01],rgb:V3=[0,0,0];
  for(let c=0;c<3;c++)for(let k=0;k<3;k++)rgb[c]+=weights[k]*colors[k][c]*(k===0?(1-fb)*transfer(0,tau,c)+fb*transfer(1,tau,c):transfer(k+1,tau,c));
  const split=splitPixel(rgb,colors,tau,fb);for(let k=0;k<3;k++)assert.ok(Math.abs(split.weights[k]-weights[k])<1e-12);
  assert.ok(transmission(.5,.1,EXTINCTION_RGB[2])<transmission(.5,.1,EXTINCTION_RGB[0]));
  assert.ok(HEIGHTS.old>HEIGHTS.dust&&HEIGHTS.dust>HEIGHTS.young&&HEIGHTS.young===HEIGHTS.gas);
});
test('out-of-cone colors remain nonnegative and conserve observed total RGB light',()=>{
  const rgb:V3=[0,1,0],r=splitPixel(rgb,colors,.3,0);assert.equal(r.clipped,true);assert.ok(r.weights.every(v=>v>=0));assert.ok(Math.abs(r.reconstructed.reduce((a,b)=>a+b,0)-1)<1e-12);
});
test('the cleaning footprint fades at actual observed boundaries',()=>{
  const mask=new Uint8Array(16*16).fill(1);mask[8*16+8]=0;const d=distanceToEdge(mask,16,16);assert.equal(d[0],0);assert.equal(d[8*16+8],0);assert.equal(d[8*16+7],1);assert.ok(d[4*16+4]>2);
});
function mapping(size=64,half=8){return {rayAt:(x:number,y:number)=>normalize(bodyToIcrs([((x/size)*2-1)*half,(1-y/size*2)*half,0])),pixelOf:(p:readonly number[]):[number,number]|null=>{const r=rayInBody(normalize([p[0],p[1],p[2]])),q=add(r.origin,mul(r.direction,-r.origin[2]/r.direction[2]));return [(q[0]/half+1)*size/2,(1-q[1]/half)*size/2];}};}
function photo():PhotoSky {
  const size=64,valid=new Uint8Array(size*size).fill(1),rgb=new Float64Array(size*size*3);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const r=Math.hypot(x-32,y-32),a=.02+.2*Math.exp(-r*r/200);for(let c=0;c<3;c++)rgb[(y*size+x)*3+c]=a*(colors[0][c]+colors[1][c])/2;}
  return {width:size,height:size,valid,rgb,distance:distanceToEdge(valid,size,size),rawDust:new Float32Array(size*size).fill(.2),colors,metadata:{}};
}
test('survey appearance maps cannot change l8 detail and the paper profile continues outside the photo',()=>{
  const s=sources(),sky=photo(),a=makePhotoFields(sky,mapping(),s,64,12);
  for(const m of [...s.young,s.youngCoverage,s.gas])m.values.fill(1000);
  const b=makePhotoFields(sky,mapping(),s,64,12);for(let k=0;k<5;k++)assert.deepEqual(a.maps[k].values,b.maps[k].values);
  const x=Math.floor((10/12+1)*32),y=32;assert.ok(a.maps[0].values[y*64+x]>0,'Removing the exterior profile must fail');
  assert.ok(a.maps.every(m=>m.mask.every(v=>v===1)),'A survey mask cannot cut holes into the photo field');
});
test('the photo model reaches the existing renderer and retains real component thickness',()=>{
  const s=sources(),maps=[field(1),field(0),field(1),field(0),field(0)],model=makePhotoModel({maps,colors,metadata:{priorNormalization:1}},s),out=new Float64Array(16),changed=new Float64Array(16);
  sampleModel(model,0,0,.2,out);maps[0].values.fill(2);sampleModel(model,0,0,.2,changed);assert.ok(Math.abs(changed[1]/out[1]-2)<1e-12);
  const camera=outsideCamera(90,48,2),p=project(model,camera,.06,1),moments=(component:number)=>{let sum=0,m=0;for(let y=0;y<48;y++)for(let x=0;x<48;x++){const z=camera.ray(x+.5,y+.5).origin[2],v=p.planes[component][(y*48+x)*3+1];sum+=v;m+=v*(z-s.warp.values[0])**2;}return m/sum;};
  assert.ok(moments(0)>moments(3)*4,'Equal-depth photographic extrusion must fail');
});
test('warp placement preserves the measured ray while moving its depth anchor',()=>{
  const s=sources(),p:V3=[2,1,s.warp.values[0]],v=bodyToIcrs(p),r=rayInBody(normalize(v));for(const z of [-.4,.8]){const q=add(r.origin,mul(r.direction,(z-r.origin[2])/r.direction[2])),anchor=photoFootpoint(s.warp,...q);assert.ok(Math.hypot(anchor[0]-p[0],anchor[1]-p[1],anchor[2]-p[2])<1e-10);}
});
test('depth changes cannot sample a different on-sky column at fixed disc coordinates',()=>{
  const s=sources(),maps=[field(0),field(0),field(1),field(0),field(.1)];
  for(let y=0;y<maps[2].n;y++)for(let x=0;x<maps[2].n;x++)maps[2].values[y*maps[2].n+x]=y+1;
  const model=makePhotoModel({maps,colors,metadata:{priorNormalization:1}},s),a=new Float64Array(16),b=new Float64Array(16),center=s.warp.values[0];
  sampleModel(model,1,1,center-.1,a);sampleModel(model,1,1,center+.1,b);
  assert.ok(Math.abs(a[10]/b[10]-1)<1e-12,'Observer-ray texture extrusion must fail');assert.ok(Math.abs(a[15]/b[15]-1)<1e-12);
});
test('Bell changes only one global column normalization, without supplying spatial holes',()=>{
  const s=sources(),sky=photo();for(let y=0;y<sky.height;y++)for(let x=0;x<sky.width;x++)sky.rawDust[y*sky.width+x]=.1+x/sky.width*.2;
  const a=makePhotoFields(sky,mapping(),s,64,12);s.dust.values.forEach((v,i)=>s.dust.values[i]=2*v);const b=makePhotoFields(sky,mapping(),s,64,12);
  for(let y=25;y<39;y+=3)for(let x=25;x<39;x+=3){const i=y*64+x;assert.ok(a.maps[4].values[i]>0);assert.ok(Math.abs(b.maps[4].values[i]/a.maps[4].values[i]-2)<1e-6);}
  for(let i=0;i<s.dust.mask.length;i++)if(i%3===0)s.dust.mask[i]=0;
  const c=makePhotoFields(sky,mapping(),s,64,12),ratio=c.maps[4].values[32*64+32]/b.maps[4].values[32*64+32];
  for(let y=25;y<39;y+=3)for(let x=25;x<39;x+=3){const i=y*64+x;assert.ok(Math.abs(c.maps[4].values[i]/b.maps[4].values[i]-ratio)<1e-6);}
});
test('one global gas grade prevents pure pink light being assigned old-star depth',async()=>{
  const {makePhotoSky}=await import('./photo-convert.mts'),{tone}=await import('./grade.mts'),w=32,h=32,valid=new Uint8Array(w*h).fill(1),rgb=new Float64Array(w*h*3),input:V3[]=[[.14,.1,.055],[.07,.1,.147],[.18,.1,.11]];
  for(let i=0;i<w*h;i++){const v=tone(...input[i%3],0,1.6);for(let c=0;c<3;c++)rgb[i*3+c]=v[c];}
  const sky=await makePhotoSky(rgb,valid,w,h);assert.ok(sky.colors[2][0]<3,'Removing the global publisher-color calibration must fail');const split=splitPixel(input[2],sky.colors,0,0);assert.ok(split.weights[0]<1e-6);assert.ok(split.weights[2]>.09999);
});
