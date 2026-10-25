import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizedCounts,surveyConfidence} from './young-density.mts';
import {liftShape} from './hybrid-model.mts';
import {volumeObject,planarBasis,density} from './catalogue-volume.mts';
import {makeRaster,type Sources} from './inputs.mts';
import {bodyToIcrs,skyOf} from './geometry.mts';
import {projectCatalogue,catalogueBasis} from './catalogue-render.mts';
import {outsideCamera} from './render.mts';
import type {CatalogueScene} from './catalogue-scene.mts';
test('normalized count smoothing bridges a survey gap without painting a dark stripe',()=>{
 const w=31,h=15,coverage=new Float64Array(w*h),counts=new Float64Array(w*h);coverage.fill(1);counts.fill(7);for(let y=0;y<h;y++)for(let x=13;x<=17;x++){coverage[y*w+x]=0;counts[y*w+x]=0;}
 const result=normalizedCounts(counts,coverage,w,h,3);for(let y=3;y<h-3;y++)for(let x=8;x<23;x++)assert.ok(Math.abs(result.density[y*w+x]-7)<1e-10);assert.ok(result.confidence[7*w+15]<1);
 counts[7*w+8]=700;const structured=normalizedCounts(counts,coverage,w,h,2);assert.ok(structured.density[7*w+8]>structured.density[7*w+25]*2,'A real overdensity must survive the smoothing');
});
test('the survey rectangle blends to the paper continuation before its boundary',()=>{
 assert.equal(surveyConfidence(1,0,20,60,60),0);assert.equal(surveyConfidence(1,-.01,20,60,60),0);assert.ok(surveyConfidence(1,.01,20,60,60)<.00001);assert.equal(surveyConfidence(1,20,20,60,60),1);
});
test('an irregular object shape becomes finite isotropic clumps with matching depth and sky widths',()=>{
 const [ra,dec]=skyOf(bodyToIcrs([0,0,0])),row={id:'test',kind:'nebula' as const,aliases:[],ra,dec,majorArcmin:12,minorArcmin:8,pa:30,logAge:null,ageStatus:'',weight:1,source:'fixture',notes:''},base=volumeObject({id:'test',owner:'test',kind:'ball',component:4,center:[0,0,0],axes:[.1,.1,.1],basis:planarBasis(0),color:[1,1,1],inner:0,weight:1,source:'fixture'}),cells=[];
 for(let y=0;y<12;y++)for(let x=0;x<12;x++){const u=(x+.5)/6-1,v=(y+.5)/6-1;if(Math.hypot(u,v)<.9&&(x<5||y>7))cells.push({u,v,value:1});}
 const result=liftShape(row,base,cells,12);assert.equal(result.clumps.length,cells.length*3);assert.ok(Math.abs(result.depthRmsKpc/result.skyRmsKpc-1)<.02);assert.ok(Math.abs(result.clumps.reduce((a,v)=>a+v.weight,0)-1)<1e-12);
 for(const v of result.clumps){assert.equal(v.axes[0],v.axes[1]);assert.equal(v.axes[1],v.axes[2]);assert.equal(density(v,[v.center[0]+2*v.axes[0],v.center[1],v.center[2]]),0);}
 assert.deepEqual(result,liftShape(row,base,cells,12),'The adopted depth placement must replay deterministically');
 const edge=liftShape(row,base,[{u:.89,v:.01,value:1},{u:.93,v:.03,value:10},{u:.91,v:.04,value:1}],4);assert.ok(Math.abs(edge.depthRmsKpc/edge.skyRmsKpc-1)<1e-10,'Boundary-clipped kernels must use their actual variance');
});
function scene():CatalogueScene {const zero=makeRaster(4,20);zero.mask.fill(1);const sources:Sources={warp:zero,dust:zero,young:[zero,zero,zero],youngCoverage:zero,youngFraction:0,oldColor:[1,1,1],gas:zero,metadata:{}},map=makeRaster(32,4);map.mask.fill(1);for(let y=0;y<32;y++)for(let x=0;x<32;x++)map.values[y*32+x]=x>=16?1:.01;
 return{objects:[],dust:[],owners:[],sources,colors:[[1,1,1],[1,1,1],[1,1,1],[1,1,1]],dustArea:0,molecularFraction:0,metadata:{},youngDensity:map};}
test('the measured young map reaches the renderer in a 150 pc layer',()=>{
 const s=scene(),face=projectCatalogue(s,outsideCamera(0,16,1.6),.1).smooth.planes[3];let left=0,right=0;for(let y=0;y<16;y++)for(let x=0;x<16;x++){if(x<7)left+=face[(y*16+x)*3];if(x>8)right+=face[(y*16+x)*3];}assert.ok(right>left*30,'Replacing the measured map with the smooth disc must fail');
 const edge=projectCatalogue(s,outsideCamera(90,32,1.6),.1).smooth.planes[3],at=(y:number)=>edge[(y*32+24)*3];assert.ok(at(11)/at(15)<.03,'The diffuse young component must stay thin');
});
test('the young-density owner has no photographic spatial input',async()=>{
 const source=await readFile(new URL('./young-density.mts',import.meta.url),'utf8');assert.doesNotMatch(source,/from ['"].*(?:photo|observation|hybrid)/u);
});
test('the diffuse population has one independent global brightness gain',()=>{
 const s=scene();s.youngOwner='diffuse';s.owners.push({id:'diffuse',kind:'population',component:3,prior:1,maximum:25,measuredAge:false,logAge:null,aliases:[]});const p=projectCatalogue(s,outsideCamera(0,12,1.6),.12);assert.equal(p.smooth.planes[3].reduce((a,b)=>a+b,0),0);assert.ok(p.objects[0].rgb.length>0);const a=catalogueBasis(p,s,Float64Array.of(1)).planes[3],b=catalogueBasis(p,s,Float64Array.of(.5)).planes[3];for(let i=0;i<a.length;i++)assert.equal(a[i]*.5,b[i]);
});
