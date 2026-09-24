import assert from 'node:assert/strict';
import { after } from 'node:test';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest(), { before } = test;
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { astroqueryToolchain } from '../astronomy-packages/toolchain.mts';
import { sciencePackage } from '../astronomy-packages/science.mts';
import { requireArray, requireRecord } from '@cssearth/core';
import { writeProductRecord } from '../product-record.mts';
import { sha256File } from '@cssearth/core/node';
import { exportOutput, listOutputs, validateOutputRequest, type OutputRequest } from './outputs.mts';
import { parseCli } from './cli.mts';
let root:string;
const sourceRequest={target:'fixture',wavelengthMicrometres:[1,6],kind:'cube',time:{any:true},angularResolutionArcsec:1,result:'telescope-product'};
const sourceAssessment={status:'unresolved',acceptance:'all-requested-constraints',constraints:{wavelength:{answer:'unknown',reason:'Fixture assessment.'}}};
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
sky=h.copy()
for k,v in {'CTYPE1':'RA---TAN','CTYPE2':'DEC--TAN','CUNIT1':'deg','CUNIT2':'deg','CRPIX1':2,'CRPIX2':1,'CRVAL1':12.,'CRVAL2':-3.,'CDELT1':-.001,'CDELT2':.001,'RADESYS':'ICRS'}.items():sky.header[k]=v
fits.HDUList([fits.PrimaryHDU(),sky,err,dq]).writeto(root/'sky.fits')
sky.header['PC1_3']=.1
fits.HDUList([fits.PrimaryHDU(),sky,err,dq]).writeto(root/'coupled.fits')
del sky.header['PC1_3'];sky.header['CUNIT1']='kg'
fits.HDUList([fits.PrimaryHDU(),sky,err,dq]).writeto(root/'invalid-wcs.fits')
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
  await writeFile(resolve(root,'result.json'),JSON.stringify({schema:'cssearth-telescope-delivery@3',product:'cube.fits',record:'input.product.json',receipt:'input.product.json',facts:{target:'fixture',verified:true},context:{kind:'scientific-request',request:sourceRequest,assessment:sourceAssessment},files:[{path:'cube.fits',...await sha256File(file)},{path:'input.product.json',...await sha256File(record)}]}));
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
 const native=options.outputs.find(o=>o.kind==='image'&&o.hdu===1);assert.equal(native?.unit?.value,'MJy/sr');assert.equal(native?.spectral?.centersMicrometres.length,6);near(native?.spectral?.centersMicrometres.at(-1),6);assert.ok(native?.limitations?.length);
 for(const selection of [band,aperture,feature]){
  assert.ok(options.outputs.some(o=>o.kind===selection.kind&&o.available));
  const exported=await exportOutput(result,selection,resolve(root,selection.kind));
  assert.equal((await readFile(exported.figure)).subarray(1,4).toString(),'PNG');
  const receipt=JSON.parse(await readFile(exported.receipt,'utf8'));assert.deepEqual(receipt.parameters.selection,selection);assert.equal(receipt.parameters.sourceContext.assessment.status,'unresolved');assert.equal(receipt.parameters.measurement.uncertaintyPolicy,'independent');assert.ok((await readFile(exported.values,'utf8')).includes('standard_deviation'));
  assert.ok(receipt.outputs.some((o:{path:string})=>o.path===exported.data.split('/').at(-1)));
  const tc=await astroqueryToolchain();
  execFileSync(tc.python,['-c',String.raw`
import sys
import numpy as np
from astropy.io import fits
from astropy.table import QTable
from astropy import units as u
path,kind=sys.argv[1:]
if kind=='aperture-spectrum':
 t=QTable.read(path)
 assert t['wavelength'].unit==u.um and t['value'].unit==u.MJy/u.sr
 np.testing.assert_allclose(t['value'].value,10)
 np.testing.assert_allclose(t['standard_deviation'].value,2)
 assert t.meta['uncertainty']=='independent' and t.meta['selection']['background']==[2,0,4,1]
else:
 with fits.open(path,checksum=True) as f:
  assert f[0].data.shape==(2,4) and f['MASK'].data[1,3]==1 and np.isnan(f[0].data[1,3])
  assert u.Unit(f[0].header['BUNIT'])==(u.MJy*u.um/u.sr if kind=='feature-map' else u.MJy/u.sr)
  np.testing.assert_allclose(f['ERR'].data[0,0],np.sqrt(12 if kind=='feature-map' else 2))
  assert 'CTYPE1' not in f[0].header
  assert f[0].verify_checksum()==1
`,exported.data,selection.kind],{env:{...process.env,...tc.env}});
  assert.equal(receipt.parameters.software.presentation.coordinates.kind,selection.kind==='aperture-spectrum'?'spectral':'pixel');
  if(process.env.CSSEARTH_ORACLE_PYTHON){const {compareOutput}=await import('./output-oracle.mts');assert.equal((await compareOutput(exported.directory,process.env.CSSEARTH_ORACLE_PYTHON,resolve(root,selection.kind+'-oracle'))).passed,true);}
 }
});
test('CLI accepts new selectors and refuses incomplete or silently ignored selections',()=>{
 const args=['export','result.json','--hdu','1','--out','chart'];
 const parsed=parseCli([...args,'--output','feature-map','--band','2.5,4.5','--continuum','0.5,2.5,4.5,6.5','--uncertainty','independent']);assert.equal(parsed.command,'export');if(parsed.command==='export')assert.deepEqual(parsed.selection,feature);
 assert.throws(()=>parseCli([...args,'--output','aperture-spectrum','--aperture','0,0,2,1']),/background/);
 assert.throws(()=>parseCli([...args,'--output','band-image','--band','2,3','--pixel','1,2']),/not valid/);
 assert.throws(()=>validateOutputRequest({...band,band:[2,2]}),/positive increasing/);
 const opaque=parseCli([...args,'--output','band-image','--band','2.5,4.5','--figure-background','opaque']);assert.equal(opaque.command==='export'&&opaque.selection.figureBackground,'opaque');
 assert.throws(()=>parseCli([...args,'--output','band-image','--band','2.5,4.5','--figure-background','white']),/transparent or opaque/);
});

test('Astropy output retains the source sky grid and records when celestial projection is inapplicable',async()=>{
 const {plotProduct}=await import('../astronomy-packages/plots.mts');
 const {mkdir}=await import('node:fs/promises');
 const tc=await astroqueryToolchain();
 const data=await extract({...band,uncertainty:'omit'});
 for(const file of ['sky','coupled','invalid-wcs']){
  const dir=resolve(root,file);await mkdir(dir);
  const run=plotProduct(dir,'fixture',data,resolve(root,file+'.fits'),{...band,uncertainty:'omit'});
  if(file==='invalid-wcs'){await assert.rejects(run,/InvalidTransform|mismatched units/);continue;}
  const result=await run,coordinates=requireRecord(requireRecord(result.presentation).coordinates);
  assert.equal(coordinates.kind,file==='sky'?'celestial':'pixel');
  if(file==='coupled'){assert.match(String(coordinates.reason),/beyond/);continue;}
  const {PNG}=await import('pngjs'),corner=async(path:string)=>[...PNG.sync.read(await readFile(path)).data.subarray(0,4)];
  assert.equal(requireRecord(requireRecord(result.presentation).png).background,'transparent');assert.equal((await corner(resolve(dir,'figure.png')))[3],0);
  const solidDir=resolve(root,file+'-opaque');await mkdir(solidDir);const solid=await plotProduct(solidDir,'fixture',data,resolve(root,file+'.fits'),{...band,uncertainty:'omit',figureBackground:'opaque'});
  assert.equal(requireRecord(requireRecord(solid.presentation).png).background,'opaque');assert.deepEqual(await corner(resolve(solidDir,'figure.png')),[0x18,0x1b,0x1f,255]);assert.match(await readFile(resolve(solidDir,'figure.svg'),'utf8'),/<g id="figure_1">\s*<g id="patch_1">\s*<path[^>]*fill: #181b1f/);
  assert.equal(coordinates.frame,'<ICRS Frame>');
  execFileSync(tc.python,['-c',String.raw`
import sys
import numpy as np
from astropy.io import fits
from astropy.wcs import WCS
with fits.open(sys.argv[1],checksum=True) as f:
 w=WCS(f[0].header,f)
 assert w.pixel_n_dim==2
 np.testing.assert_allclose(w.pixel_to_world_values(1,0),[12.,-3.],atol=1e-10)
 ra,dec=w.pixel_to_world_values(2,0)
 assert ra<12 and abs(dec+3)<1e-6
 assert 'ERR' not in f and np.isnan(f[0].data[1,3]) and f['MASK'].data[1,3]==1
`,resolve(dir,'image.fits')],{env:{...process.env,...tc.env}});
 }
});
