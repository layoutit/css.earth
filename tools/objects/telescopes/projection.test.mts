import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { mkdir,mkdtemp,readFile,writeFile,rm,unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { parseGeometry,verifiedProduct,localOutput,projectOutput } from './projection.mts';
import { parseCli } from './cli.mts';
import { pinFile,writeProductRecord } from '../product-record.mts';
import { exportSphere } from './sphere.mts';
import { listArtifactOutputs } from './artifact-outputs.mts';
import { bodyMapFits } from '../jwst/cubes/body-map.mts';
import { formatBodyMapProduct,type BodyMapProduct } from '../body-map-product.mts';
import { sha256 } from '../../../src/platform/sha256.mts';
import sharp from 'sharp';
const geometry={schema:'cssearth-navigation-input@1',observer:'JWST',kernels:[{file:'rotation.tpc',role:'rotation',source:'https://naif.jpl.nasa.gov/'}],registration:{method:'wcs',explanation:'Header WCS; no independently fitted centre'},width:360,height:180,maximumEmissionDegrees:65};
const sourceRequest={target:'mercury',wavelengthMicrometres:[1,2],kind:'image',time:{any:true},angularResolutionArcsec:1,result:'telescope-product'};
const sourceAssessment={status:'unresolved',acceptance:'all-requested-constraints',constraints:{wavelength:{answer:'unknown',reason:'Fixture assessment.'}}};
const explorationContext={kind:'exploration',target:'mercury',discovery:{schema:'cssearth-telescope-exploration@1',observation:'observation',snapshot:'a'.repeat(64)},assessment:{status:'not-requested'}};
const fits=(value=1)=>bodyMapFits({width:4,height:2},{},[{name:'VALUE',units:'K',values:new Float32Array(8).fill(value)},{name:'SIGMA',units:'K',values:new Float32Array(8).fill(.1)}]);
async function measurementFixture(root:string){
  const native=resolve(root,'native.fits'),producer=resolve(root,'native.product.json');await writeFile(native,fits());
  await writeProductRecord(producer,{telescope:'Fixture',stage:'qualified-native',inputs:[],parameters:{},software:[]},[{path:'native.fits',file:native}]);
  const result=resolve(root,'result.json');await writeFile(result,JSON.stringify({schema:'cssearth-telescope-delivery@1',product:'native.fits',record:'native.product.json',receipt:'native.product.json',facts:{target:'mercury',verified:true},request:sourceRequest,satisfaction:sourceAssessment,files:[{path:'native.fits',...await pinFile(native)},{path:'native.product.json',...await pinFile(producer)}]}));
  const image=resolve(root,'image.fits'),record=resolve(root,'output.product.json');await writeFile(image,fits(2));
  await writeProductRecord(record,{telescope:'Fixture',stage:'telescope-output',inputs:[{role:'delivery',identity:result,...await pinFile(result)}],parameters:{selection:{kind:'image',hdu:1},definition:'Native image',metadata:{structure:'VALUE'},measurement:{unit:'K'},sourceRequest,sourceSatisfaction:sourceAssessment},software:[]},[{path:'image.fits',file:image}]);
  return {record,result,image};
}
async function mapFixture(root:string,target='mercury'){
  await mkdir(root,{recursive:true});
  const plane=fits(3),map:BodyMapProduct={schema:'cssearth-body-map@1',definition:{quantity:'Brightness temperature',units:'K',timeDependence:'instantaneous-state',method:{owner:'fixture'},source:'fixture'},frame:{body:target,radiusKm:2439.7,rotation:{model:'pck.tpc',bodyCode:199}},grid:{width:4,height:2,longitude:'east-positive-from-0',rows:'north-to-south'},planes:{file:'map.fits',value:'VALUE',uncertainty:'SIGMA'},mask:{maximumEmissionDegrees:65,missing:'NaN'},observations:[{id:'observation',telescope:'Fixture',instrument:'Camera',midTimeJd:2460000,rangeKm:1e8,subObserver:{latitudeDegrees:0,westLongitudeDegrees:0},angularResolution:{majorArcsec:1,minorArcsec:1,basis:'fixture'}}]};
  const files={map:resolve(root,'map.fits'),metadata:resolve(root,'map.fits.body-map.json'),texture:resolve(root,'texture.png'),poles:resolve(root,'poles.png'),navigation:resolve(root,'navigation.json'),record:resolve(root,'map.fits.product.json')};
  await writeFile(files.map,plane);await writeFile(files.metadata,formatBodyMapProduct(map));
  const png=await sharp({create:{width:2,height:2,channels:4,background:'#6688aaff'}}).png().toBuffer();await writeFile(files.texture,png);await writeFile(files.poles,png);
  await writeFile(files.navigation,JSON.stringify({radiiKm:[2439.7,2439.7,2439.7],shape:'reference ellipsoid',registration:{method:'disc'},uncertainty:'source uncertainty',normalization:{minimum:1,maximum:4,colormap:'viridis',missing:'#333941'},sourceContext:{...explorationContext,target}}));
  const outputs=[{path:'map.fits',file:files.map},{path:'map.fits.body-map.json',file:files.metadata},{path:'texture.png',file:files.texture},{path:'poles.png',file:files.poles},{path:'navigation.json',file:files.navigation}];
  await writeProductRecord(files.record,{telescope:'Fixture',stage:'body-map',inputs:[],parameters:{},software:[]},outputs);
  return {files,outputs};
}
test('navigation refuses implicit centering, unpinned disc registration and invalid map budgets',()=>{
  assert.equal(parseGeometry(geometry,'/tmp').registration.method,'wcs');
  for(const override of [{registration:{method:'automatic'}},{registration:{method:'disc',parameters:[0,0,4,0],explanation:'fit'}},{registration:{method:'wcs',explanation:'header',parameters:[0,0,4,0]}},{width:1000000},{maximumEmissionDegrees:90},{kernels:[]},{radius:1}])assert.throws(()=>parseGeometry({...geometry,...override},'/tmp'));
});
test('CLI separates measurement, navigation and sphere; selectors cannot leak between stages',()=>{
  assert.equal(parseCli(['project','output.product.json','--geometry','navigation.json','--out','map']).command,'project');
  assert.equal(parseCli(['export','output.product.json','--output','body-map','--geometry','navigation.json','--out','map']).command,'project');
  assert.equal(parseCli(['export','map.fits.product.json','--output','sphere','--out','sphere']).command,'sphere');
  assert.throws(()=>parseCli(['project','result.json','--hdu','1','--geometry','nav','--out','map']));
  assert.throws(()=>parseCli(['export','output.product.json','--output','body-map','--out','map']),/geometry/);
  assert.throws(()=>parseCli(['export','result.json','--output','image','--hdu','0','--geometry','nav','--out','image']),/geometry applies only/);
  assert.throws(()=>parseCli(['export','output.product.json','--output','body-map','--hdu','0','--geometry','nav','--out','map']),/Body map export takes/);
  assert.throws(()=>parseCli(['export','map.json','--output','sphere','--plane','1','--out','sphere']));
});
test('inspection and projection share intact measurement and source-delivery prerequisites',async()=>{
  const root=await mkdtemp(resolve(tmpdir(),'artifact-outputs-'));
  try{
    const measurement=await measurementFixture(root),measurementOutputs=await listArtifactOutputs(measurement.record);
    assert.equal(measurementOutputs.artifact,'telescope-output');
    assert.ok(measurementOutputs.outputs.some(output=>output.kind==='body-map'&&output.available));
    await unlink(measurement.result);
    const blocked=await listArtifactOutputs(measurement.record),choice=blocked.outputs.find(output=>output.kind==='body-map');assert.equal(choice?.available,false);assert.match(choice?.reason??'',/source delivery|ENOENT/);
    await assert.rejects(projectOutput(measurement.record,resolve(root,'unused-navigation.json'),resolve(root,'map')),/ENOENT/);
  }finally{await rm(root,{recursive:true,force:true});}
});
test('sphere inspection validates the map contract, navigation and existing sphere owner',async()=>{
  const root=await mkdtemp(resolve(tmpdir(),'sphere-outputs-'));
  try{
    const {files,outputs}=await mapFixture(root),ready=await listArtifactOutputs(files.record);
    assert.equal(ready.target,'mercury');assert.deepEqual(ready.sourceContext,explorationContext);assert.ok(ready.outputs.some(output=>output.kind==='sphere'&&output.available));
    await assert.rejects(listArtifactOutputs(files.record,'VALUE'),/structure applies only/);
    const sphere=await exportSphere(files.record,resolve(root,'sphere-ready')),receipt=JSON.parse(await readFile(sphere.receipt,'utf8'));
    assert.deepEqual(receipt.parameters.sourceContext,explorationContext);assert.deepEqual(sphere.sourceContext,explorationContext);
    await writeFile(files.metadata,'{}');await writeProductRecord(files.record,{telescope:'Fixture',stage:'body-map',inputs:[],parameters:{},software:[]},outputs);
    const malformed=await listArtifactOutputs(files.record);assert.ok(malformed.outputs.some(output=>output.kind==='sphere'&&!output.available));
    await assert.rejects(exportSphere(files.record,resolve(root,'sphere')),/body map schema|Unsupported body map/);
    const unsupported=await mapFixture(resolve(root,'unsupported'),'no-such-sphere'),answer=await listArtifactOutputs(unsupported.files.record);
    assert.ok(answer.outputs.some(output=>output.kind==='sphere'&&!output.available));
  }finally{await rm(root,{recursive:true,force:true});}
});
test('terminal products verify current output bytes without reopening historical sources',async()=>{
  const root=await mkdtemp(resolve(tmpdir(),'terminal-output-'));
  try{
    const html=resolve(root,'sphere.html');await writeFile(html,'<!doctype html>');const record=resolve(root,'sphere.product.json');
    await writeProductRecord(record,{telescope:'Fixture',stage:'telescope-sphere',inputs:[{role:'historical source',identity:resolve(root,'absent.fits'),bytes:1,sha256:'a'.repeat(64)}],parameters:{target:'mercury',sourceContext:explorationContext},software:[]},[{path:'sphere.html',file:html}]);
    const terminal=await listArtifactOutputs(record);assert.equal(terminal.terminal,true);assert.deepEqual(terminal.outputs,[]);
    await writeFile(html,'changed');await assert.rejects(listArtifactOutputs(record),/pins changed/);
  }finally{await rm(root,{recursive:true,force:true});}
});
test('projection and sphere cannot consume changed outputs or raw sky-image records',async()=>{
  const root=await mkdtemp(resolve(tmpdir(),'map-pins-'));
  try{
    const file=resolve(root,'image.fits'),record=resolve(root,'output.product.json');await writeFile(file,'original');
    await writeProductRecord(record,{telescope:'Fixture',stage:'telescope-output',inputs:[],parameters:{},software:[]},[{path:'image.fits',file}]);
    await assert.rejects(exportSphere(record,resolve(root,'sphere')),/registered body-map/);
    await writeFile(file,'changed');await assert.rejects(verifiedProduct(record),/pins changed/);
    assert.throws(()=>localOutput(root,'../outside'),/escapes/);
  }finally{await rm(root,{recursive:true,force:true});}
});
