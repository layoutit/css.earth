import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { astroqueryToolchain } from '../astronomy-packages/toolchain.mts';
import { sciencePackage } from '../astronomy-packages/science.mts';
import { requireArray, requireRecord } from '../../source-values.mts';
import { pinFile, writeProductRecord } from '../product-record.mts';
import { exportOutput, listOutputs, validateOutputRequest, type OutputRequest } from './outputs.mts';
import { parseCli } from './cli.mts';
let root:string;
before(async()=>{
  root=await mkdtemp(resolve(tmpdir(),'cube-outputs-'));
  const tc=await astroqueryToolchain();
  execFileSync(tc.python,['-c',String.raw`
import sys
import numpy as np
from astropy.io import fits
from pathlib import Path
root=Path(sys.argv[1])
a=np.broadcast_to(np.array([3.,5.,11.,13.,11.,13.])[:,None,None],(6,2,4)).copy();a[:,0,:2]+=10
h=fits.ImageHDU(a,name='SCI');h.header['BUNIT']='MJy/sr'
for k,v in {'CTYPE3':'WAVE','CUNIT3':'um','CRPIX3':1,'CRVAL3':1.,'CDELT3':1.}.items():h.header[k]=v
err=fits.ImageHDU(np.full_like(a,2),name='ERR');err.header['BUNIT']='MJy/sr'
dq=fits.ImageHDU(np.zeros(a.shape,dtype='uint16'),name='DQ');dq.data[2,1,3]=1
fits.HDUList([fits.PrimaryHDU(),h,err,dq]).writeto(root/'cube.fits')
h.data=h.data[::-1];err.data=err.data[::-1];dq.data=dq.data[::-1];h.header['CRVAL3']=6.;h.header['CDELT3']=-1.
fits.HDUList([fits.PrimaryHDU(),h,err,dq]).writeto(root/'descending.fits')
fits.HDUList([fits.PrimaryHDU(),h]).writeto(root/'no-error.fits')
h.header['CTYPE3']='WAVE-TAB';h.header['CUNIT3']='um';h.header['CRVAL3']=1.;h.header['CDELT3']=1.;h.header['PS3_0']='WCS-TAB';h.header['PS3_1']='WAVE';h.header['PV3_1']=1;h.header['PV3_3']=1
col=fits.Column(name='WAVE',format='6D',dim='(1,6)',array=np.arange(1.,7.).reshape(1,6,1))
table=fits.BinTableHDU.from_columns([col],name='WCS-TAB');table.header['EXTVER']=1
fits.HDUList([fits.PrimaryHDU(),h,table]).writeto(root/'tab.fits')
`,root],{env:{...process.env,...tc.env}});
  const file=resolve(root,'cube.fits'),record=resolve(root,'input.product.json');
  await writeProductRecord(record,{telescope:'Fixture',stage:'fixture',inputs:[],parameters:{},software:[]},[{path:'cube.fits',file}]);
  await writeFile(resolve(root,'result.json'),JSON.stringify({schema:'cssearth-telescope-delivery@1',product:'cube.fits',record:'input.product.json',receipt:'input.product.json',facts:{target:'fixture',verified:true},request:{target:'fixture'},satisfaction:{status:'unresolved'},files:[{path:'cube.fits',...await pinFile(file)},{path:'input.product.json',...await pinFile(record)}]}));
});
after(async()=>{await rm(root,{recursive:true,force:true});});
async function extract(selection:OutputRequest,file='cube.fits'){
 const answer=await sciencePackage({operation:'extract',path:resolve(root,file),...selection});
 return requireRecord(requireRecord(requireArray(answer.structures)[0]).extraction);
}
const band:OutputRequest={kind:'band-image',hdu:1,band:[2.5,4.5],uncertainty:'independent'};
const feature:OutputRequest={kind:'feature-map',hdu:1,band:[2.5,4.5],continuum:[.5,2.5,4.5,6.5],uncertainty:'independent'};
const aperture:OutputRequest={kind:'aperture-spectrum',hdu:1,aperture:[0,0,2,1],background:[2,0,4,1],uncertainty:'independent'};
const near=(actual:unknown,expected:number)=>assert.ok(typeof actual==='number'&&Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);
test('band means use bin overlap, preserve missing samples and support descending axes',async()=>{
 const a=await extract(band),b=await extract(band,'descending.fits');assert.deepEqual(a.values,b.values);
 const v=requireArray(a.values),e=requireArray(a.sigma);near(requireArray(v[0])[0],22);near(requireArray(v[1])[0],12);assert.equal(requireArray(v[1])[3],null);near(requireArray(e[0])[0],Math.sqrt(2));
 const partial=await extract({...band,band:[2.75,4]});near(requireArray(requireArray(partial.values)[1])[0],11.8);
 await assert.rejects(extract({...band,band:[.4,1]}),/outside/);
 await assert.rejects(extract({...band,uncertainty:'omit'},'tab.fits'),/bin edges/);
 await assert.rejects(extract(band,'no-error.fits'),/validated sample uncertainties/);
});
test('continuum subtraction cancels a slope and propagates continuum errors',async()=>{
 const a=await extract(feature);near(requireArray(requireArray(a.values)[0])[0],8);near(requireArray(requireArray(a.sigma)[0])[0],Math.sqrt(12));assert.match(String(a.unit),/um/);
 const reversed=requireArray((await extract(feature,'descending.fits')).values);
 for(const [y,row] of requireArray(a.values).entries())for(const [x,v] of requireArray(row).entries()){const other=requireArray(reversed[y])[x];if(v===null)assert.equal(other,null);else near(other,Number(v));}
 await assert.rejects(extract({...feature,continuum:[1,3,4,5]}),/bracket/);
});
test('fixed aperture subtracts mean background, requires full footprints and explicit error assumptions',async()=>{
 const a=await extract(aperture);for(const v of requireArray(a.values))near(v,10);for(const v of requireArray(a.sigma))near(v,2);
 const masked=await extract({...aperture,aperture:[2,1,4,2],background:'none',uncertainty:'omit'});assert.equal(requireArray(masked.values)[2],null);assert.ok(requireArray(masked.sigma).every(v=>v===null));
 await assert.rejects(extract({...aperture,background:[1,0,3,1]}),/overlap/);
 await assert.rejects(extract({...aperture,aperture:[0,0,5,1]}),/in bounds/);
});
test('all three exports publish figures, CSV and selections with source satisfaction preserved',async()=>{
 const result=resolve(root,'result.json'),options=await listOutputs(result);
 for(const selection of [band,aperture,feature]){
  assert.ok(options.outputs.some(o=>o.kind===selection.kind&&o.available));
  const exported=await exportOutput(result,selection,resolve(root,selection.kind));
  assert.equal((await readFile(exported.figure)).subarray(1,4).toString(),'PNG');
  const receipt=JSON.parse(await readFile(exported.receipt,'utf8'));assert.deepEqual(receipt.parameters.selection,selection);assert.equal(receipt.parameters.sourceSatisfaction.status,'unresolved');assert.equal(receipt.parameters.measurement.uncertaintyPolicy,'independent');assert.ok((await readFile(exported.values,'utf8')).includes('standard_deviation'));
  if(process.env.CSSEARTH_ORACLE_PYTHON){const {compareOutput}=await import('./output-oracle.mts');assert.equal((await compareOutput(exported.directory,process.env.CSSEARTH_ORACLE_PYTHON,resolve(root,selection.kind+'-oracle'))).passed,true);}
 }
});
test('CLI accepts new selectors and refuses incomplete or silently ignored selections',()=>{
 const args=['export','result.json','--hdu','1','--out','chart'];
 const parsed=parseCli([...args,'--output','feature-map','--band','2.5,4.5','--continuum','0.5,2.5,4.5,6.5','--uncertainty','independent']);assert.equal(parsed.command,'export');if(parsed.command==='export')assert.deepEqual(parsed.selection,feature);
 assert.throws(()=>parseCli([...args,'--output','aperture-spectrum','--aperture','0,0,2,1']),/background/);
 assert.throws(()=>parseCli([...args,'--output','band-image','--band','2,3','--pixel','1,2']),/not valid/);
 assert.throws(()=>validateOutputRequest({...band,band:[2,2]}),/positive increasing/);
});
