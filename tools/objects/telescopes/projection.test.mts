import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { parseGeometry,verifiedProduct,localOutput } from './projection.mts';
import { parseCli } from './cli.mts';
import { writeProductRecord } from '../product-record.mts';
import { exportSphere } from './sphere.mts';
import { listArtifactOutputs } from './artifact-outputs.mts';
const geometry={schema:'cssearth-navigation-input@1',observer:'JWST',kernels:[{file:'rotation.tpc',role:'rotation',bytes:10,sha256:'a'.repeat(64),source:'https://naif.jpl.nasa.gov/'}],registration:{method:'wcs',explanation:'Header WCS; no independently fitted centre'},width:360,height:180,maximumEmissionDegrees:65};
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
  assert.throws(()=>parseCli(['export','map.json','--output','sphere','--plane','1','--out','sphere']));
});
test('one output inspector advances verified artifacts through image, map and sphere stages',async()=>{
  const root=await mkdtemp(resolve(tmpdir(),'artifact-outputs-'));
  try{
    const image=resolve(root,'image.fits');await writeFile(image,'image');
    const measurement=resolve(root,'output.product.json');
    await writeProductRecord(measurement,{telescope:'Fixture',stage:'telescope-output',inputs:[],parameters:{sourceRequest:{target:'Europa'},sourceSatisfaction:{status:'unresolved'}},software:[]},[{path:'image.fits',file:image}]);
    const measurementOutputs=await listArtifactOutputs(measurement);
    assert.equal(measurementOutputs.artifact,'telescope-output');
    assert.ok(measurementOutputs.outputs.some(output=>output.kind==='body-map'&&output.available));

    const navigation=resolve(root,'navigation.json');await writeFile(navigation,JSON.stringify({target:'Europa',sourceRequest:{target:'Europa'},sourceSatisfaction:{status:'unresolved'}}));
    const map=resolve(root,'map.fits');await writeFile(map,'map');
    const metadata=resolve(root,'map.fits.body-map.json'),texture=resolve(root,'texture.png'),poles=resolve(root,'poles.png');
    await Promise.all([writeFile(metadata,'metadata'),writeFile(texture,'texture'),writeFile(poles,'poles')]);
    const mapRecord=resolve(root,'map.fits.product.json');
    await writeProductRecord(mapRecord,{telescope:'Fixture',stage:'body-map',inputs:[],parameters:{},software:[]},[{path:'map.fits',file:map}]);
    const incomplete=await listArtifactOutputs(mapRecord);assert.ok(incomplete.outputs.some(output=>output.kind==='sphere'&&!output.available));
    await writeProductRecord(mapRecord,{telescope:'Fixture',stage:'body-map',inputs:[],parameters:{},software:[]},[{path:'map.fits',file:map},{path:'map.fits.body-map.json',file:metadata},{path:'texture.png',file:texture},{path:'poles.png',file:poles},{path:'navigation.json',file:navigation}]);
    const mapOutputs=await listArtifactOutputs(mapRecord);
    assert.equal(mapOutputs.target,'Europa');assert.deepEqual(mapOutputs.sourceSatisfaction,{status:'unresolved'});
    assert.ok(mapOutputs.outputs.some(output=>output.kind==='sphere'&&output.available));

    const html=resolve(root,'sphere.html');await writeFile(html,'<!doctype html>');
    const sphereRecord=resolve(root,'sphere.product.json');
    await writeProductRecord(sphereRecord,{telescope:'Fixture',stage:'telescope-sphere',inputs:[],parameters:{target:'Europa',sourceSatisfaction:{status:'unresolved'}},software:[]},[{path:'sphere.html',file:html}]);
    const sphereOutputs=await listArtifactOutputs(sphereRecord);assert.equal(sphereOutputs.terminal,true);assert.deepEqual(sphereOutputs.outputs,[]);
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
