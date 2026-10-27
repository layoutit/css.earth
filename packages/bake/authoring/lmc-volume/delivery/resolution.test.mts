import test from 'node:test';
import assert from 'node:assert/strict';
import {cropCamera,equalOutside} from './resolution-cameras.mts';
import {projectObject,catalogueBasis,projectCatalogue} from '../catalogue-render.mts';
import {volumeObject,planarBasis} from '../catalogue-volume.mts';
import {pixelDelta} from './resolution-pilot.mts';
import {makeRaster,type Sources} from '../inputs.mts';
import type {CatalogueScene} from '../catalogue-scene.mts';
import {loadObservation} from '../observation.mts';
import {earthCamera} from '../render.mts';
import {rayPlane} from '../geometry.mts';
import {gradedPrediction,type Grade} from '../grade.mts';
import {imageBytes} from '../report.mts';
import {normalized} from '../grade-report.mts';

test('equal-scale camera crops preserve physical pixel pitch and exact parent rays',()=>{
 const camera=equalOutside(45,1024,9.472846397112237),crop=cropCamera(camera,300,200,128,128);
 assert.deepEqual(crop.ray(27.5,68.5),camera.ray(327.5,268.5));
 const a=camera.ray(0,0).origin,b=camera.ray(1,0).origin;
 assert.ok(Math.abs(Math.hypot(...a.map((v,i)=>v-b[i]))*1000-9.250826559679918)<1e-9);
 assert.deepEqual(crop.pixelOf!([0,0,0]),[212,312]);assert.throws(()=>cropCamera(camera,1000,0,128,128));
});
test('finite spherical object resolution is identical from face, oblique and edge views',()=>{
 const object=volumeObject({id:'isotropic',owner:'isotropic',kind:'ball',component:4,center:[0,0,0],basis:planarBasis(0),axes:[.08,.08,.08],inner:0,color:[1,1,1],weight:1,source:'Numerical fixture'}),images=[0,45,90].map(a=>{const camera=equalOutside(a,32,.5),pixels=projectObject(object,camera,4),out=new Float64Array(32*32);for(const p of pixels)out[p.pixel]=p.value;return out;});
 assert.deepEqual(projectObject(object,equalOutside(0,32,.5),4,new Uint8Array(32*32)),[],'Unselected objects must not be rasterized');
 for(const image of images.slice(1))for(let i=0;i<image.length;i++)assert.ok(Math.abs(image[i]-images[0][i])<1e-8,'The rasterizer must not soften another camera');
});
test('resolution convergence measures the complete linear image, including faint pixels',()=>{
 assert.equal(pixelDelta(Float64Array.from([1,2,3]),Float64Array.from([1,2,3])),0);
 assert.equal(pixelDelta(Float64Array.from([1,2,2]),Float64Array.from([1,2,3])),1/6);
 assert.throws(()=>pixelDelta(new Float64Array(1),new Float64Array(2)));
});
test('tiles retain the complete camera and reproduce its normalized finite-object projection exactly',()=>{
 const r=makeRaster(8,4);r.mask.fill(1);const sources:Sources={warp:r,dust:r,young:[r,r,r],youngCoverage:r,youngFraction:0,oldColor:[1,1,1],gas:r,metadata:{}},object=volumeObject({id:'isotropic',owner:'o',kind:'ball',component:4,center:[.03,0,.02],basis:planarBasis(0),axes:[.15,.15,.15],inner:0,color:[1,1,1],weight:1,source:'Numerical fixture'}),scene:CatalogueScene={sources,objects:[object],dust:[],owners:[{id:'o',kind:'region',component:4,prior:1,maximum:2,measuredAge:false,logAge:null,aliases:[]}],colors:[[0,0,0],[0,0,0],[0,0,0],[0,0,0]],dustArea:0,molecularFraction:0,metadata:{}},camera=equalOutside(45,16,1),sampling={objectSubpixels:4 as const,cacheFinishedDust:true},whole=catalogueBasis(projectCatalogue(scene,camera,.015,undefined,undefined,sampling),scene,Float64Array.from([1])),joined=whole.planes.map(p=>new Float64Array(p.length));
 for(let tile=0;tile<4;tile++){const mask=new Uint8Array(16*16);for(let y=0;y<16;y++)for(let x=0;x<16;x++)if(Math.floor(x/8)+2*Math.floor(y/8)===tile)mask[y*16+x]=1;const part=catalogueBasis(projectCatalogue(scene,camera,.015,mask,undefined,sampling),scene,Float64Array.from([1]));for(let c=0;c<5;c++)for(let i=0;i<joined[c].length;i++)joined[c][i]+=part.planes[c][i];}
 assert.deepEqual(joined,whole.planes);
});
test('complete Earth tiles preserve smooth light, dust, old/young grain, nonlinear grade and sky encoding',async()=>{
 const o=await loadObservation(1),camera=earthCamera(o.width,o.height,o.rayAt,o.pixelOf),map=makeRaster(16,20);map.mask.fill(1);map.values.fill(.002);const dustMap=makeRaster(16,20);dustMap.mask.fill(1);dustMap.values.fill(.02);
 const a=rayPlane(o.rayAt(32,16)),b=rayPlane(o.rayAt(16,32)),source=volumeObject({id:'hii',owner:'gas',kind:'ball',component:4,center:a,basis:planarBasis(0),axes:[.25,.2,.15],inner:0,color:[1,.4,.7],weight:.01,source:'Numerical fixture'}),dust=volumeObject({...source,id:'dust',kind:'dust',center:[a[0],a[1],.3],weight:.003}),sources:Sources={warp:makeRaster(16,20),dust:dustMap,young:[map,map,map],youngCoverage:map,youngFraction:0,oldColor:[1,1,1],gas:map,metadata:{}},owner=(id:string,component:3|4)=>({id,kind:'fixture',component,prior:1,maximum:2,measuredAge:false,logAge:null,aliases:[]}),scene:CatalogueScene={sources,objects:[source],dust:[],owners:[owner('gas',4),owner('young',3)],colors:[[1,.8,.5],[1,.7,.4],[.5,1,1.5],[1,.4,.7]],youngOwner:'young',youngDensity:map,youngTint:[.6,1,1.4],dustArea:0,molecularFraction:0,dustLayer:{column:dustMap,strength:1,retainMolecular:false,clouds:[dust],cloudExtinctionRgb:Float32Array.from([.25,1,1.8])},oldPopulation:{disc:map,bar:map,oldFraction:.1,youngFraction:.05,points:{count:2,positions:Float64Array.from([...a,...b]),rgb:Float32Array.from([.001,.001,.0005,.0005,.001,.0018]),components:Uint8Array.from([0,3])}},metadata:{}},sampling={objectSubpixels:4 as const,cacheFinishedDust:true,gaussianTailSigma:10 as const},amplitudes=Float64Array.from([1,1]),grade:Grade={coefficients:[[.3,.2,.1],[.3,.4,.2],[.2,.4,.6],[.7,.2,.4]],dustStrength:1,dustTint:[1,1,1],stretch:20,saturation:.8,score:0,youngColor:{tint:[.6,1,1.5],saturation:2}};
 const whole=gradedPrediction(catalogueBasis(projectCatalogue(scene,camera,.015,undefined,undefined,sampling),scene,amplitudes),grade),joined=new Float64Array(whole.length),encoded=Buffer.alloc(whole.length);
 for(let top=0;top<48;top+=16)for(let left=0;left<64;left+=16){const mask=new Uint8Array(64*48);for(let y=top;y<top+16;y++)mask.fill(1,y*64+left,y*64+left+16);const part=gradedPrediction(catalogueBasis(projectCatalogue(scene,camera,.015,mask,undefined,sampling),scene,amplitudes),grade,mask),tile=new Float64Array(16*16*3);for(let y=0;y<16;y++)for(let x=0;x<16;x++)for(let c=0;c<3;c++){const full=((top+y)*64+left+x)*3+c;joined[full]=part[full];tile[(y*16+x)*3+c]=part[full];}const bytes=imageBytes(normalized(tile,o),o,true);for(let y=0;y<16;y++)encoded.set(bytes.subarray(y*16*3,(y+1)*16*3),((top+y)*64+left)*3);}
 assert.deepEqual(joined,whole);assert.deepEqual(encoded,imageBytes(normalized(whole,o),o,true));
});
