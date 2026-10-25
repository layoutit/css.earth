import test from 'node:test';import assert from 'node:assert/strict';
import {oldPhase,oldQuery,polygonSql,insidePolygon,RGB_POLYGON,RC_POLYGON} from './gaia-old.mts';
import {gaiaColor,splitOldDensity} from './gaia-old-model.mts';
import {makeRaster,at,type Sources} from './inputs.mts';
import {projectCatalogue,catalogueBasis} from './catalogue-render.mts';
import {outsideCamera} from './render.mts';
import {stellarBasisFamily,stellarBasis} from './stellar-grade.mts';
import {gaiaWarpLocator} from './gaia-plane.mts';
import {bodyToIcrs,skyOf,earthRayOfBody} from './geometry.mts';
import type {CatalogueScene} from './catalogue-scene.mts';
import {mkdtemp,writeFile,rm,stat} from 'node:fs/promises';import {L20} from './gaia-old.mts';
import {saveGaiaPoints,loadSavedOldPopulation} from './gaia-old-model.mts';
import {densityFromMembers} from './gaia-density.mts';
test('Luri RGB and RC archive predicates reproduce the Euclidean published CMD polygons',()=>{
 for(const polygon of [RGB_POLYGON,RC_POLYGON]){const sql=polygonSql(polygon).replaceAll('phot_g_mean_mag','g').replaceAll('phot_bp_mean_mag-phot_rp_mean_mag','x').replaceAll('AND','&&').replaceAll('OR','||'),predicate=new Function('x','g','return '+sql);for(let g=15.311;g<20.5;g+=.073)for(let x=.733;x<2.5;x+=.047)assert.equal(predicate(x,g),insidePolygon(x,g,polygon));}
 assert.ok(oldPhase(19,1.1));assert.equal(oldPhase(17,0),null);assert.match(oldQuery('density'),/random_index<100000000/u);assert.doesNotMatch(oldQuery('points'),/random_index/u);assert.match(oldQuery('points'),/phot_g_mean_mag<18/u);assert.match(oldQuery('density'),/81\.28,-69\.78,20/u);
});
test('Gaia point colors follow individual AB-corrected RP/G/BP photometry',()=>{
 const a=gaiaColor({g:17,bp:17,rp:17}),b=gaiaColor({g:17,bp:18,rp:16});assert.equal(a[1],1);assert.ok(b[0]>a[0]*2.5&&b[2]<a[2]*.4);assert.ok(Math.abs(a[0]-10**(-.4*(.3561-.1136)))<1e-12);assert.throws(()=>gaiaColor({g:17,bp:null,rp:17}));
});
test('the measured density partition preserves every cell and retains non-elliptical edges',()=>{
 const total=makeRaster(64,8);total.mask.fill(1);for(let y=0;y<64;y++)for(let x=0;x<64;x++)total.values[y*64+x]=Math.exp(-Math.hypot(x-32,y-32)/10)+(y>29&&y<34&&x>20&&x<42?.5:0);const split=splitOldDensity(total);for(let i=0;i<total.values.length;i++)assert.ok(Math.abs(split.disc.values[i]+split.bar.values[i]-total.values[i])<1e-7);assert.ok(split.bar.values[31*64+37]>split.bar.values[37*64+31]);assert.ok(split.barMass>0&&split.discMass>0);
});
function fixture():CatalogueScene{const z=makeRaster(8,20);z.mask.fill(1);const sources:Sources={warp:z,dust:z,young:[z,z,z],youngCoverage:z,youngFraction:0,oldColor:[1,1,1],gas:z,metadata:{}},disc=makeRaster(16,2),bar=makeRaster(16,2);disc.mask.fill(1);bar.mask.fill(1);return{sources,objects:[],dust:[],owners:[],colors:[[1,1,1],[1,1,1],[1,1,1],[1,1,1]],dustArea:0,molecularFraction:0,oldPopulation:{disc,bar,points:{count:1,positions:Float64Array.from([.2,-.1,.4]),rgb:Float32Array.from([.4,.2,.1]),components:Uint8Array.from([0])},oldFraction:.1,youngFraction:.05},metadata:{}};}
test('old light reaches the canonical renderer from Gaia maps and points, with no analytic old-light fallback',()=>{
 const scene=fixture(),camera=outsideCamera(0,16,2),a=projectCatalogue(scene,camera,.12);assert.equal(a.smooth.planes[0].reduce((a,b)=>a+b,0),0);assert.equal(a.smooth.planes[1].reduce((a,b)=>a+b,0),0);assert.equal(a.smooth.planes[2].reduce((a,b)=>a+b,0),0);assert.ok(a.grain&&a.grain[0].reduce((a,b)=>a+b,0)>0);scene.oldPopulation!.disc.values.fill(.1);const b=projectCatalogue(scene,camera,.12);assert.ok(b.smooth.planes[0].reduce((a,b)=>a+b,0)>0);const sum=[0,0,0];for(let i=0;i<a.grain[0].length;i++)sum[i%3]+=a.grain[0][i];assert.ok(Math.abs(sum[0]/sum[1]-2)<1e-6&&Math.abs(sum[2]/sum[1]-.5)<1e-6);
 const amplitudes=new Float64Array(0),mixed=catalogueBasis(b,scene,amplitudes);for(let i=0;i<mixed.planes[0].length;i++)assert.ok(Math.abs(mixed.planes[0][i]-(b.smooth.planes[0][i]*.9+b.grain![0][i]*.1))<1e-10,'Resolved light must replace an equal share of unresolved light');const family=stellarBasisFamily(b,scene,amplitudes);for(const [old,young] of [[0,0],[.13,.07],[1,1]]){scene.oldPopulation!.oldFraction=old;scene.oldPopulation!.youngFraction=young;const direct=catalogueBasis(b,scene,amplitudes),cached=stellarBasis(family,old,young);for(let k=0;k<5;k++)for(let i=0;i<direct.planes[k].length;i++)assert.ok(Math.abs(direct.planes[k][i]-cached.planes[k][i])<1e-10);}
});
test('adopted stellar heights preserve sky position while reaching the warped plane in 3D',()=>{
 const scene=fixture(),map=scene.sources.warp;for(let y=0;y<map.n;y++)for(let x=0;x<map.n;x++)map.values[y*map.n+x]=.3*(x/map.n-.5);const locate=gaiaWarpLocator(scene.sources),[ra,dec]=skyOf(bodyToIcrs([1,.5,0]));for(const h of [-.82,-.367,0,.367,.82]){const p=locate(ra,dec,h,.41);assert.ok(Math.abs(p[2]-at(map,p[0],p[1])-h)<1e-6);const u=earthRayOfBody(p),v=earthRayOfBody(bodyToIcrs([0,0,0]));assert.ok(u.every(Number.isFinite));const [a,b]=skyOf(bodyToIcrs(p));assert.ok(Math.abs(a-ra)+Math.abs(b-dec)<1e-9);}
});
test('saved finite points replay only their retained array views, without the discarded tail',async()=>{
 const directory=await mkdtemp(L20+'point-io-')+'/',scene=fixture(),pop=scene.oldPopulation!;try{pop.points.positions=new Float64Array([.2,-.1,.4,999,999,999]).subarray(0,3);pop.points.rgb=new Float32Array([.4,.2,.1,999,999,999]).subarray(0,3);await saveGaiaPoints(directory,pop.points);await writeFile(directory+'old-population.json',JSON.stringify({n:16,halfKpc:2,points:1}));for(const [name,map]of [['old-disc',pop.disc],['old-bar',pop.bar]] as const)await writeFile(directory+name+'.f32le',Buffer.from(map.values.buffer));assert.equal((await stat(directory+'points-positions.f64le')).size,24);const restored=await loadSavedOldPopulation(directory,.1,.05);assert.deepEqual(restored.points,pop.points);}finally{await rm(directory,{recursive:true,force:true});}
});
test('measured G weights control luminosity density while conserving its area normalization',()=>{const scene=fixture(),stars=[[-1,0,0],[1,0,0]].map(p=>{const [ra,dec]=skyOf(bodyToIcrs([p[0],p[1],p[2]]));return{ra,dec};}),map=densityFromMembers(stars,scene.sources,128,4,undefined,.1,Float64Array.from([4,1]));assert.ok(Math.abs(at(map,-1,0)/at(map,1,0)-4)<1e-5);assert.ok(Math.abs(map.values.reduce((a,b)=>a+b,0)*(8/128)**2-1)<1e-6);});
