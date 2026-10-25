import test from 'node:test';import assert from 'node:assert/strict';
import {heritageProjectionHeader,loadHeritage} from './heritage-input.mts';
import {sampleDensity,normalizeToBell} from './heritage-layer.mts';
import {makeRaster} from './inputs.mts';
import {loadObservation} from './observation.mts';
import {contrast} from './dust-contrast.mts';
import {projectCatalogue} from './catalogue-render.mts';
import {outsideCamera} from './render.mts';
import type {CatalogueScene} from './catalogue-scene.mts';
import {volumeObject,planarBasis} from './catalogue-volume.mts';
import {loadParent,parentRung} from './sequence-state.mts';
import {readGrade,gradedPrediction} from './grade.mts';
import {catalogueBasis} from './catalogue-render.mts';
import {earthCamera} from './render.mts';
import {metrics,targetOf} from './report.mts';
import {normalized} from './grade-report.mts';
import {rec,num} from './inputs.mts';
test('HERITAGE uses the log-density HDU, preserves holes and qualifies its exact TAN WCS',async()=>{
 const {image,wcs,summary}=await loadHeritage();assert.equal(image.header.EXTNAME,'log_sigma_mass');assert.equal(summary.finite,86690);assert.ok(Math.abs(summary.pixelArcsec-56)<1e-8);const center=wcs.skyOf(301.6786,265.6786);assert.ok(Math.abs(center[0]-79.7)<1e-10&&Math.abs(center[1]+68.7)<1e-10);for(const p of [[40,40],[200,300],[500,500]]){const q=wcs.pixelOf(...wcs.skyOf(p[0],p[1]));assert.ok(q&&Math.hypot(q[0]-p[0],q[1]-p[1])<1e-8);}assert.throws(()=>heritageProjectionHeader({...image.header,PV2_1:.1}));assert.equal(image.header.PV2_1,0);
 const q=sampleDensity(Float64Array.from([0,1,1,0]),2,2,.5,.5);assert.equal(q.value,5.5);assert.equal(q.coverage,1);assert.equal(sampleDensity(Float64Array.from([NaN,NaN,NaN,NaN]),2,2,.5,.5).coverage,0);
});
test('Bell fixes one global column normalization while preserving measured relative structure',()=>{
 const map=makeRaster(64,8),bell=makeRaster(64,8);map.mask.fill(1);bell.mask.fill(1);for(let i=0;i<map.values.length;i++){map.values[i]=.03*(1+i%7);bell.values[i]=map.values[i]*1.7;}const old=map.values.slice(),result=normalizeToBell(map,bell);assert.ok(Math.abs(result.factor-1.7)<1e-6);for(let i=0;i<old.length;i++)assert.ok(Math.abs(map.values[i]/old[i]-1.7)<1e-6);
});
test('the new dust column attenuates and reddens, while retained molecular geometry remains effective',()=>{
 const z=makeRaster(4,20);z.mask.fill(1);const dustColumn=makeRaster(8,10);dustColumn.mask.fill(1);dustColumn.values.fill(1);const star=volumeObject({id:'s',owner:'s',kind:'ball',component:3,center:[0,0,-.5],axes:[.1,.1,.1],basis:planarBasis(0),inner:0,color:[1,1,1],weight:1,source:'fixture'}),cloud=volumeObject({...star,id:'d',kind:'dust',center:[0,0,0],axes:[.4,.4,.1],weight:10}),scene:CatalogueScene={objects:[star],dust:[cloud],owners:[{id:'s',kind:'cluster',component:3,prior:1,maximum:1,measuredAge:false,logAge:null,aliases:[]}],sources:{warp:z,dust:z,gas:z,young:[z,z,z],youngCoverage:z,youngFraction:0,oldColor:[1,1,1],metadata:{}},colors:[[1,1,1],[1,1,1],[1,1,1],[1,1,1]],dustArea:1,molecularFraction:1,dustLayer:{column:dustColumn,strength:1},metadata:{}};
 const render=()=>projectCatalogue(scene,outsideCamera(0,16,2),.03).objects[0].rgb,layer=render();scene.dust=[];assert.deepEqual(render(),layer,'A replacement layer must not double-count the molecular column');const rgb=[0,0,0];for(let i=0;i<layer.length;i++)rgb[i%3]+=layer[i];assert.ok(rgb[0]>rgb[2]);scene.dust=[cloud];scene.dustLayer!.retainMolecular=true;assert.ok(render().reduce((a,b)=>a+b,0)<layer.reduce((a,b)=>a+b,0)*.5);scene.dustLayer!.strength=0;assert.throws(render,/bounded/u);
});
test('a bar crop inherits registration and display calibration; masked convolution cannot invent dark holes',async()=>{
 const full=await loadObservation(1),window={x0:.3,y0:.3,width:.3,height:.3},crop=await loadObservation(8,window,{sky:full.metadata.sky.rgbLinearDisplay,commonFactor:full.metadata.normalization.commonFactor}),a=crop.rayAt(256,192),b=full.rayAt((.3+.15)*64,(.3+.15)*48);assert.ok(a.every((v,i)=>Math.abs(v-b[i])<1e-12));assert.deepEqual(crop.metadata.sky.rgbLinearDisplay,full.metadata.sky.rgbLinearDisplay);const rgb=new Float64Array(512*384*3).fill(.4),mask=new Uint8Array(512*384).fill(1);for(let y=100;y<160;y++)for(let x=100;x<160;x++)mask[y*512+x]=0;const flat=contrast(rgb,crop,mask);assert.ok(flat.power<1e-20);for(let y=0;y<384;y++)for(let x=0;x<512;x++)for(let c=0;c<3;c++)rgb[(y*512+x)*3+c]*=1-.2*Math.sin(x*.5);assert.ok(contrast(rgb,crop,mask).power>1e-6);
});
test('the unchanged parent still exactly reproduces the saved l18 tiny residuals',async()=>{const {scene}=await loadParent(18),o=await loadObservation(1),parent=await parentRung(18,true,scene),grade=readGrade(parent.result.grade),prediction=gradedPrediction(catalogueBasis(projectCatalogue(scene,earthCamera(o.width,o.height,o.rayAt,o.pixelOf),.12),scene,parent.amplitudes),grade),m=metrics(normalized(prediction,o),targetOf(o),o),saved=rec(parent.result.residuals);assert.ok(Math.abs(m.trainRelativeRms-num(saved.trainRelativeRms))<1e-8);assert.ok(Math.abs(m.heldoutRelativeRms-num(saved.heldoutRelativeRms))<1e-8);});
