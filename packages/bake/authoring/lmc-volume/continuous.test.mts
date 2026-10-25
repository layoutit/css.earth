import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRaster,LOCAL,json,rec,array,type Sources} from './inputs.mts';
import {outsideCamera} from './render.mts';
import {projectCatalogue,catalogueBasis} from './catalogue-render.mts';
import {fitOuterGain} from './continuous-calibrate.mts';
import {buildContinuousScene,CONTINUOUS_SETTINGS} from './continuous-model.mts';
import {densityFromMembers} from './gaia-density.mts';
import {bodyToIcrs,skyOf} from './geometry.mts';
import type {CatalogueScene} from './catalogue-scene.mts';
function sources():Sources{const make=()=>{const m=makeRaster(8,20);m.mask.fill(1);return m;};return{warp:make(),dust:make(),young:[make(),make(),make()],youngCoverage:make(),youngFraction:0,oldColor:[1,1,1],gas:make(),metadata:{}};}
function scene():CatalogueScene{return{sources:sources(),objects:[],dust:[],owners:[],colors:[[1,1,1],[1,1,1],[1,1,1],[1,1,1]],dustArea:0,molecularFraction:0,metadata:{}};}
test('200 pc Gaia smoothing lowers association peaks while preserving total population counts',()=>{
 const [ra,dec]=skyOf(bodyToIcrs([2,1,0])),stars=Array.from({length:20},()=>({ra,dec})),s=sources(),a=densityFromMembers(stars,s,256,10,undefined,.15),b=densityFromMembers(stars,s,256,10,undefined,CONTINUOUS_SETTINGS.smoothingSigmaKpc),area=(20/256)**2;
 assert.ok(Math.max(...b.values)<.7*Math.max(...a.values));assert.ok(Math.abs(b.values.reduce((x,y)=>x+y,0)*area-1)<1e-6);assert.equal(CONTINUOUS_SETTINGS.smoothingSigmaKpc,.2);
});
test('the outskirts partition preserves l13 at unit gain and independently brightens the outer disc',()=>{
 const a=scene(),camera=outsideCamera(0,16),original=projectCatalogue(a,camera,.12);a.separateOutskirts=true;a.outskirtsTransitionKpc=CONTINUOUS_SETTINGS.outskirtsTransitionKpc;const split=projectCatalogue(a,camera,.12),base=catalogueBasis(split,a,new Float64Array());
 for(let i=0;i<base.planes[0].length;i++)assert.ok(Math.abs(base.planes[0][i]+base.planes[2][i]-original.smooth.planes[0][i]-original.smooth.planes[2][i])<1e-14);
 a.outskirtsGain=2;const brighter=catalogueBasis(split,a,new Float64Array());assert.deepEqual(brighter.planes[0],base.planes[0]);const pixel=8*16+12;assert.ok(brighter.planes[2][pixel*3]>base.planes[2][pixel*3]);assert.ok(brighter.planes[2][(8*16+8)*3]<1e-20);
 assert.equal(base.planes[2][(8*16+10)*3],0);assert.ok(base.planes[2][(8*16+11)*3]>0);
});
test('disc and bar gain changes leave fixed catalogue luminosities untouched',()=>{
 const s=scene();s.innerDiscGain=.5;s.barGain=1.5;s.owners=[{id:'old-cluster',kind:'cluster',component:0,prior:1,maximum:25,measuredAge:true,logAge:9,aliases:[]}];
 const p={smooth:{width:1,height:1,dustGain:1,planes:[Float64Array.of(2,2,2),Float64Array.of(3,3,3),new Float64Array(3),new Float64Array(3),new Float64Array(3)]},objects:[{owner:0,indices:Int32Array.of(0),rgb:Float64Array.of(5,5,5)}],metadata:{}},out=catalogueBasis(p,s,Float64Array.of(1));assert.deepEqual(Array.from(out.planes[0]),[6,6,6]);assert.deepEqual(Array.from(out.planes[1]),[4.5,4.5,4.5]);
});
test('independent Gaia RGB grading does not recolor catalogue young clusters',()=>{
 const s=scene();s.youngOwner='Gaia';s.youngTint=[2,3,4];s.owners=[{id:'Gaia',kind:'population',component:3,prior:1,maximum:25,measuredAge:false,logAge:null,aliases:[]},{id:'cluster',kind:'cluster',component:3,prior:1,maximum:25,measuredAge:false,logAge:null,aliases:[]}];
 const p={smooth:{width:2,height:1,dustGain:1,planes:Array.from({length:5},()=>new Float64Array(6))},objects:[{owner:0,indices:Int32Array.of(0),rgb:Float64Array.of(1,1,1)},{owner:1,indices:Int32Array.of(1),rgb:Float64Array.of(1,1,1)}],metadata:{}};assert.deepEqual(Array.from(catalogueBasis(p,s,Float64Array.of(1,1)).planes[3]),[2,3,4,1,1,1]);assert.deepEqual(Array.from(p.objects[0].rgb),[1,1,1]);
});
test('the outskirts fit reaches its target and discloses a bound it cannot satisfy',()=>{
 const fit=fitOuterGain(gain=>10+gain*20,60);assert.ok(Math.abs(fit.gain-2.5)<1e-7);assert.equal(fit.atBound,false);const bounded=fitOuterGain(gain=>10+gain*20,150);assert.equal(bounded.gain,4);assert.equal(bounded.atBound,true);assert.ok(bounded.errorPercent< -30);
});
test('the actual l14 builder uses the continuous population and preserves l13 catalogue geometry',async()=>{
 const previous=rec(await json(LOCAL+'versions/l13/structure.json')),s=await buildContinuousScene(),population=rec(rec(s.metadata.hybrid).youngPopulation);assert.equal(population.smoothingSigmaKpc,.2);assert.equal(population.layerSigmaKpc,.15);assert.equal(s.separateOutskirts,true);assert.deepEqual(s.objects,previous.objects);assert.deepEqual(s.dust,previous.dust);assert.equal(s.owners.length,array(previous.owners).length);
});
