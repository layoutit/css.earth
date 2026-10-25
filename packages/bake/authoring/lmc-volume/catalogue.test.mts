import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {volumeObject,planarBasis,density,chord,column,columnTo,emissionNodes,type VolumeObject} from './catalogue-volume.mts';
import {projectObject,projectCatalogue} from './catalogue-render.mts';
import {outsideCamera} from './render.mts';
import {normalize,add,mul,type V3} from './geometry.mts';
import {makeRaster,loadSources,type Sources} from './inputs.mts';
import {buildCatalogueScene,type CatalogueScene} from './catalogue-scene.mts';
import {catalogueRows} from './catalogue-data.mts';
import {calibrateObjects} from './catalogue-calibrate.mts';
function ball(change:Partial<VolumeObject>={}):VolumeObject{return volumeObject({id:'test',owner:'test',kind:'ball',component:3,center:[0,0,0],basis:planarBasis(.3),axes:[.6,.4,.5],inner:0,color:[1,1,1],weight:1,source:'fixture',...change});}
test('finite density and analytic chord agree in every direction',()=>{
 for(const kind of ['ball','shell'] as const){const v=ball({kind,inner:kind==='shell'?.72:0});assert.equal(density(v,[3,0,0]),0);assert.equal(density(v,[0,0,0])===0,kind==='shell');
  const directions:V3[]=[[0,0,-1],[0,-1,0],[1,2,3]];for(const d of directions){const dir=normalize(d),origin=mul(dir,-3),c=chord(v,origin,dir);assert.ok(c);let integral=0;const ds=.00005;for(let t=2;t<4;t+=ds)integral+=density(v,add(origin,mul(dir,t+ds/2)))*ds;assert.ok(Math.abs(integral/column(v,c)-1)<.002);
   assert.equal(columnTo(v,c,-100),0);assert.ok(Math.abs(columnTo(v,c,100)-column(v,c))<1e-12);const nodes=emissionNodes(v,c);assert.ok(nodes.every(n=>n.fraction>0&&n.t>=c.center-c.half&&n.t<=c.center+c.half));assert.ok(Math.abs(nodes.reduce((a,n)=>a+n.fraction,0)-1)<1e-12);
  }
 }
});
test('a half-shell has a real open side, while conserving its luminosity',()=>{
 const v=ball({kind:'shell',inner:.72,halfSpace:[0,0,1]}),dir:V3=[0,0,-1],c=chord(v,[0,0,3],dir);assert.ok(c);assert.equal(density(v,[0,0,.45]),0);assert.ok(density(v,[0,0,-.45])>0);assert.ok(emissionNodes(v,c).every(n=>n.t>=3));
 const full=ball({kind:'shell',inner:.72}),a=chord(full,[0,0,3],dir);assert.ok(a);assert.ok(Math.abs(column(v,c)/column(full,a)-1)<1e-12);
});
test('object luminosity is conserved face-on, tilted and edge-on, without an Earth-axis extrusion',()=>{
 const v=ball({axes:[.45,.45,.45]});for(const angle of [0,26,45,90]){const camera=outsideCamera(angle,64,2),pixels=projectObject(v,camera),mass=pixels.reduce((a,p)=>a+p.value*camera.areaAt!(v.center),0);assert.ok(Math.abs(mass-1)<1e-10);}
 assert.equal(density(v,[0,0,.46]),0);assert.equal(density(v,[.46,0,0]),0);assert.ok(Math.abs(density(v,[.2,0,0])-density(v,[0,0,.2]))<1e-12);
 assert.equal(projectObject(ball({center:[50,0,0]}),outsideCamera(45,32)).length,0);
});
function emptySources():Sources {const map=makeRaster(4,20);map.mask.fill(1);return{warp:map,dust:map,young:[map,map,map],youngCoverage:map,youngFraction:0,oldColor:[1,1,1],gas:map,metadata:{}};}
test('a molecular cloud attenuates a source behind it, not one in front of it',()=>{
 const object=ball({center:[0,0,-.5],axes:[.08,.08,.08]}),dust=ball({kind:'dust',axes:[.3,.3,.1]}),scene:CatalogueScene={objects:[object],dust:[dust],owners:[{id:'test',kind:'cluster',component:3,prior:1,maximum:25,measuredAge:false,logAge:null,aliases:[]}],sources:emptySources(),colors:[[1,1,1],[1,1,1],[1,1,1],[1,1,1]],dustArea:.3,molecularFraction:1,metadata:{}};
 const sum=()=>projectCatalogue(scene,outsideCamera(0,24,1),.12).objects[0].rgb.reduce((a,b)=>a+b,0),behind=sum();object.center=[0,0,.5];const front=sum();assert.ok(front>behind*2);assert.ok(front>0);
});
test('published identities, missing ages and molecular refinements survive import',async()=>{
 const {rows,metadata}=await catalogueRows();assert.equal(rows.filter(r=>r.id.startsWith('DEM121-row')).length,2);assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);assert.ok(rows.filter(r=>r.logAge!==null).length>1100);assert.ok(rows.filter(r=>r.kind==='association'&&r.logAge===null).length>2000);assert.deepEqual(metadata.rejectedKimShells,[9,10,18]);
 const n11=rows.find(r=>r.id==='DEM34'),n10=rows.find(r=>r.id==='DEM35');assert.ok(n11&&n10);assert.ok(n11.dec< -66.3&&n10.dec> -66.1,'An exact DEM identity must beat a broad Henize alias');
 const refined=new Set(rows.filter(r=>r.source.includes('MAGMA')).flatMap(r=>r.parentIds??[]));assert.ok(refined.size>100);assert.ok(rows.filter(r=>r.id.startsWith('NANTEN-')).every(r=>!refined.has(Number(r.id.slice(7)))));
});
test('geometry and density owners cannot import photographic spatial fields',async()=>{
 for(const name of ['catalogue-volume','catalogue-scene','catalogue-render']){const source=await readFile(new URL(`./${name}.mts`,import.meta.url),'utf8');assert.doesNotMatch(source,/from ['"].*(?:photo-convert|photo-model|observation|catalogue-calibrate)/u);assert.doesNotMatch(source,/rawRgb|rawRGB|photoSky|sky\.maps/u);}
});
test('one object gain uses its complete pixel footprint and cannot change geometry',()=>{
 const v=ball(),scene:CatalogueScene={objects:[v],dust:[],owners:[{id:'test',kind:'cluster',component:3,prior:1,maximum:25,measuredAge:false,logAge:null,aliases:[]}],sources:emptySources(),colors:[[1,1,1],[1,1,1],[1,1,1],[1,1,1]],dustArea:1,molecularFraction:0,metadata:{}},geometry=JSON.stringify(scene.objects),planes=Array.from({length:5},()=>new Float64Array(6)),target={data:Float64Array.from([.1,.1,.1,.5,.5,.5]),train:Uint8Array.from([1,0]),holdout:Uint8Array.from([0,1])};
 const fit=calibrateObjects({smooth:{width:2,height:1,planes,dustGain:1},objects:[{owner:0,indices:Int32Array.from([0,1]),rgb:Float64Array.from([1,1,1,1,1,1])}],metadata:{}},scene,target,{coefficients:[[1,1,1],[1,1,1],[1,1,1],[1,1,1]],dustStrength:1,dustTint:[1,1,1],stretch:0,saturation:1,score:1});
 assert.ok(fit.prediction[3]>.12,'Ignoring the other half of the aperture fits 0.1 instead');assert.equal(fit.amplitudes.length,1);assert.equal(JSON.stringify(scene.objects),geometry);assert.ok(fit.amplitudes[0]>=0&&fit.amplitudes[0]<=25);
});
test('the actual scene contains the catalogue populations and 30 Dor shell/filament complex',async()=>{
 const scene=await buildCatalogueScene(await loadSources(512,20)),tara=scene.objects.filter(v=>v.owner==='BicaNeb-1252');assert.equal(scene.dust.length,424);assert.equal(scene.objects.filter(v=>v.id.startsWith('KDS-SGS')).length,20);assert.ok(scene.owners.length>6000);assert.ok(tara.some(v=>v.id.includes('published-bowl')&&v.kind==='shell'&&v.halfSpace));assert.ok(tara.filter(v=>v.kind==='filament').length>10);assert.ok(tara.filter(v=>v.id.includes('ha-bubble')).length>0);assert.ok(scene.owners.some(o=>o.aliases.includes('R136')));assert.equal(scene.metadata.unknownAges,4906);
 for(const v of scene.objects.filter(v=>v.kind!=='filament'))assert.ok(Math.abs(v.axes[2]/Math.sqrt(v.axes[0]*v.axes[1])-1)<1e-8,'Compact objects must have a finite width-based depth in the galaxy frame');
});
