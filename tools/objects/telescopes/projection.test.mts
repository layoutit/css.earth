import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { parseGeometry,verifiedProduct,localOutput } from './projection.mts';
import { parseCli } from './cli.mts';
import { writeProductRecord } from '../product-record.mts';
import { exportSphere } from './sphere.mts';
const geometry={schema:'cssearth-navigation-input@1',observer:'JWST',kernels:[{file:'rotation.tpc',role:'rotation',bytes:10,sha256:'a'.repeat(64),source:'https://naif.jpl.nasa.gov/'}],registration:{method:'wcs',explanation:'Header WCS; no independently fitted centre'},width:360,height:180,maximumEmissionDegrees:65};
test('navigation refuses implicit centering, unpinned disc registration and invalid map budgets',()=>{
  assert.equal(parseGeometry(geometry,'/tmp').registration.method,'wcs');
  for(const override of [{registration:{method:'automatic'}},{registration:{method:'disc',parameters:[0,0,4,0],explanation:'fit'}},{registration:{method:'wcs',explanation:'header',parameters:[0,0,4,0]}},{width:1000000},{maximumEmissionDegrees:90},{kernels:[]},{radius:1}])assert.throws(()=>parseGeometry({...geometry,...override},'/tmp'));
});
test('CLI separates measurement, navigation and sphere; selectors cannot leak between stages',()=>{
  assert.equal(parseCli(['project','output.product.json','--geometry','navigation.json','--out','map']).command,'project');
  assert.equal(parseCli(['export','map.fits.product.json','--output','sphere','--out','sphere']).command,'sphere');
  assert.throws(()=>parseCli(['project','result.json','--hdu','1','--geometry','nav','--out','map']));
  assert.throws(()=>parseCli(['export','map.json','--output','sphere','--plane','1','--out','sphere']));
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
