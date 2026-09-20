import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { astroqueryToolchain } from '../astronomy-packages/toolchain.mts';
import { readProductScience } from './product-science.mts';
import { calibrationDependencies, verifyCalibrationDependencies, calibrationOrigin } from './calibration-dependencies.mts';
import { qualifySourceProduct } from './qualify-source.mts';
import { pinFile, writeProductRecord, productRecordPath } from '../product-record.mts';
import { recordQualification, QUALIFICATION_SCHEMA, type QualificationResult } from './qualify.mts';
import { loadQualifiedObservations } from './qualified-observations.mts';
import type { SourceProduct } from './source-products.mts';
let root:string;
before(async()=>{
  root=await mkdtemp(resolve(tmpdir(),'science-readback-'));
  const tc=await astroqueryToolchain();
  execFileSync(tc.python,['-c',String.raw`
import sys
import numpy as np
from astropy.io import fits
from pathlib import Path
root=Path(sys.argv[1])
def image(name='SCI',version=1):
    h=fits.ImageHDU(np.ones((3,2,2),dtype='float32'),name=name); h.header['EXTVER']=version
    h.header['BUNIT']='erg / (s cm2 Angstrom)' if name=='SCI' else 'erg / (s cm2 Angstrom)'
    if name=='SCI':
        for k,v in {'CTYPE1':'RA---TAN','CTYPE2':'DEC--TAN','CTYPE3':'WAVE','CUNIT1':'deg','CUNIT2':'deg','CUNIT3':'nm','CRPIX1':1,'CRPIX2':1,'CRPIX3':1,'CRVAL1':0,'CRVAL2':0,'CRVAL3':1000,'CDELT1':.1,'CDELT2':.1,'CDELT3':100}.items():h.header[k]=v
    return h
def save(name,rows):fits.HDUList([fits.PrimaryHDU()]+rows).writeto(root/name)
sci=image();err=image('ERR');dq=image('DQ');dq.data=np.zeros((3,2,2),dtype='uint16');del dq.header['BUNIT'];dq.data[1]=1
save('masked.fits',[sci,err,dq]);save('output.fits',[sci,err,dq])
primary=fits.PrimaryHDU(np.ones((1,1,2,2),dtype='float32'));primary.header['BUNIT']='Jy/beam';primary.header['BMAJ']=.001;primary.header['BMIN']=.0005
primary.writeto(root/'singleton.fits')
raw=(root/'singleton.fits').read_bytes();i=raw.index(b'EXTEND  =');raw=raw[:i]+b"MEMBEROUS= 'uid://A001/X35f5/Xa'".ljust(80)+raw[i+80:];(root/'warning.fits').write_bytes(raw)
a=sci.copy();a.name='A';b=sci.copy();b.name='B';save('ambiguous.fits',[a,b,err])
invalid=err.copy();invalid.header['BUNIT']='K';save('bad-unit.fits',[sci,invalid])
invalid=err.copy();invalid.data=np.ones((2,2),dtype='float32');save('bad-shape.fits',[sci,invalid])
invalid=err.copy();invalid.data[0,0,0]=-1;save('negative.fits',[sci,invalid])
invalid=err.copy();del invalid.header['BUNIT'];save('missing-unit.fits',[sci,invalid])
var=err.copy();var.name='VAR';var.header['BUNIT']='erg2 / (s2 cm4 Angstrom2)';save('variance.fits',[sci,var])
ivar=err.copy();ivar.name='IVAR';ivar.header['BUNIT']='s2 cm4 Angstrom2 / erg2';ivar.data[1]=0;save('ivar.fits',[sci,ivar])
other=image(version=2);other.header['CRVAL3']=1100;save('multi.fits',[sci,err,other,image('ERR',2)])
log=sci.copy();log.header['CTYPE3']='FREQ-LOG';log.header['CUNIT3']='Hz';log.header['CRVAL3']=3e14;log.header['CDELT3']=1e12;save('log.fits',[log])
tab=sci.copy();tab.header['CTYPE3']='WAVE-TAB';tab.header['CUNIT3']='um';tab.header['CRVAL3']=1.;tab.header['CDELT3']=1.;tab.header['PS3_0']='WCS-TAB';tab.header['PS3_1']='WAVE';tab.header['PV3_1']=1;tab.header['PV3_3']=1
col=fits.Column(name='WAVE',format='3D',dim='(1,3)',array=np.array([[[1.],[1.3],[1.9]]]))
table=fits.BinTableHDU.from_columns([col],name='WCS-TAB');table.header['EXTVER']=1;save('tab.fits',[tab,table])
beam=sci.copy();beam.header['BUNIT']='mJy/beam'
columns=[fits.Column(name='BMAJ',format='E',unit='arcsec',array=[1.,2.,3.]),fits.Column(name='BMIN',format='E',unit='arcsec',array=[.5,1.,1.5]),fits.Column(name='CHAN',format='J',array=[0,1,2]),fits.Column(name='POL',format='J',array=[0,0,0])]
beams=fits.BinTableHDU.from_columns(columns,name='BEAMS');save('beams.fits',[beam,beams])
beams.data['CHAN'][2]=1;save('bad-beams.fits',[beam,beams])
` ,root],{env:{...process.env,...tc.env}});
});
after(async()=>{await rm(root,{recursive:true,force:true});});
const read=(name:string)=>readProductScience(root,{file:name,format:'fits',target:'test'},{resolveCalibrations:false});
test('Astropy units and associated ERR/DQ control sampled coverage',async()=>{
 const f=await read('masked.fits');assert.equal(f.nativeMetadata?.uncertainty?.status,'validated');assert.equal(f.nativeMetadata?.quality?.usable,8);assert.equal(f.nativeMetadata?.quality?.flagged,4);
 assert.deepEqual(f.nativeMetadata?.spectral?.usableBands,[true,false,true]);assert.equal(f.wavelengthIntervalsMicrometres?.length,2);assert.equal(f.nativeMetadata?.units?.value,'erg / (s cm2 Angstrom)');
});
test('shape, unit and unmasked negative uncertainty contradictions are refused',async()=>{
 await assert.rejects(read('ambiguous.fits'),/Ambiguous science association/);
 await assert.rejects(read('bad-unit.fits'),/units disagree/);await assert.rejects(read('bad-shape.fits'),/shape mismatch/);await assert.rejects(read('negative.fits'),/Negative unmasked/);
 const unknown=await read('missing-unit.fits');assert.equal(unknown.nativeMetadata?.uncertainty?.status,'unknown');assert.equal(unknown.nativeMetadata?.quality?.usable,0);assert.deepEqual(unknown.wavelengthIntervalsMicrometres,[]);
});
test('variance and inverse variance carry correct dimensional checks',async()=>{
 assert.equal((await read('variance.fits')).nativeMetadata?.uncertainty?.kind,'variance');
 const f=await read('ivar.fits');assert.equal(f.nativeMetadata?.uncertainty?.kind,'inverse-variance');assert.deepEqual(f.nativeMetadata?.spectral?.usableBands,[true,false,true]);
});
test('multiple science EXTVERs preserve separate facts and use intersection, not an invented mosaic',async()=>{
 const f=await read('multi.fits');assert.equal(f.nativeMetadata?.structures?.length,2);assert.ok(f.wavelengthIntervalsMicrometres![0][0]>1.04);assert.ok(f.wavelengthIntervalsMicrometres![0][1]<1.26);
});
test('nonlinear and tabulated spectral coordinates are owned by WCSLIB',async()=>{
 const log=await read('log.fits');assert.equal(log.nativeMetadata?.spectral?.centersMicrometres.length,3);assert.ok(log.nativeMetadata!.spectral!.centersMicrometres[0]>log.nativeMetadata!.spectral!.centersMicrometres[1]);
 const tab=await read('tab.fits');assert.deepEqual(tab.nativeMetadata?.spectral?.centersMicrometres,[1,1.3,1.9]);assert.equal(tab.wavelengthIntervalsMicrometres,undefined);
});
test('per-plane beams require complete channel identity and use the worst usable major axis',async()=>{
 assert.equal((await read('beams.fits')).angularResolutionArcsec,3);await assert.rejects(read('bad-beams.fits'),/every channel/);
});
test('source and reducer paths publish identical scientific metadata and reducer mutations are refused',async()=>{
 const name='masked.fits',pin=await pinFile(resolve(root,name));
 const source:SourceProduct={id:'test-source',target:'test',telescope:'Fixture',mode:'cube',kind:'cube',archiveProductId:'test',decoder:'fits-image',identity:{SIMPLE:true},units:'not used',meaning:'test',citation:'https://example.org',limitations:[],files:[{role:'science',path:name,origin:'https://example.org/masked.fits',...pin}]};
 await qualifySourceProduct(root,source);const report=JSON.parse(await readFile(resolve(root,'output/telescopes/test/test-source/decoded.json'),'utf8'));
 const file=resolve(root,name),receipt=productRecordPath(file);await writeProductRecord(receipt,{telescope:'Fixture',stage:'fixture',inputs:[],parameters:{},software:[]},[{path:name,file}]);
 const result:QualificationResult={schema:QUALIFICATION_SCHEMA,target:'test',telescope:'Fixture',mode:'cube',observation:'test',program:'test',product:file,receipt,configuration:{kind:'spitzer-irac-channel' as const,channel:1}};
 await recordQualification(root,result);const loaded=(await loadQualifiedObservations(root,'test'))[0];assert.deepEqual(loaded.facts.nativeMetadata,report.facts.nativeMetadata);assert.deepEqual(loaded.facts.wavelengthIntervalsMicrometres,report.facts.wavelengthIntervalsMicrometres);
 await writeFile(file,'changed');await assert.rejects(recordQualification(root,result),/pins are invalid/);
});
test('exact calibration references are pinned, bounded, and cannot be silently repinned after mutation',async()=>{
 assert.equal(calibrationOrigin('$cassini/../other'),undefined);assert.equal(calibrationOrigin('crds://jwst_bad/../../secret'),undefined);
 const refs=[{field:'test',value:'$cassini/calibration/test.cub'}];let count=0;
 const fetcher:typeof fetch=async()=>{count++;return new Response('calibration bytes');};
 const first=await calibrationDependencies(root,refs,{}, {fetcher});assert.equal(first[0].status,'pinned');assert.ok(await verifyCalibrationDependencies(root,first));
 await calibrationDependencies(root,refs,{}, {fetcher});assert.equal(count,1);
 await writeFile(resolve(root,first[0].file!),'changed');assert.equal(await verifyCalibrationDependencies(root,first),false);await assert.rejects(calibrationDependencies(root,refs,{}, {fetcher}),/integrity mismatch/);
 const large=await calibrationDependencies(root,[{field:'test',value:'$cassini/calibration/large.cub'}],{}, {maxFileBytes:2,fetcher:async()=>new Response('too big',{headers:{'Content-Length':'7'}})});assert.equal(large[0].status,'unresolved');
});

test('singleton ancillary FITS axes remain an image and unrelated malformed keyword warnings are retained',async()=>{
 const f=await read('singleton.fits');assert.equal(f.kind,'image');assert.equal(f.nativeMetadata?.quality?.usable,4);
 const warning=await read('warning.fits');assert.equal(warning.kind,'image');assert.ok(warning.nativeMetadata?.limitations.some(l=>l.includes('MEMBEROUS')));
});

test('delivery outputs preserve masked spectrum gaps, label plots, and refuse changed evidence',async()=>{
 const {listOutputs,exportOutput}=await import('./outputs.mts');
 const file=resolve(root,'output.fits'),record=resolve(root,'output-input.product.json'),result=resolve(root,'result.json');
 await writeProductRecord(record,{telescope:'Fixture',stage:'fixture',inputs:[],parameters:{},software:[]},[{path:'output.fits',file}]);
 await writeFile(result,JSON.stringify({schema:'cssearth-telescope-delivery@1',product:'output.fits',record:'output-input.product.json',receipt:'output-input.product.json',facts:{target:'test',verified:true},request:{target:'test',wavelengthMicrometres:[1,2],kind:'cube',time:{any:true},angularResolutionArcsec:1,result:'telescope-product'},satisfaction:{status:'unresolved',acceptance:'all-requested-constraints',constraints:{wavelength:{answer:'unknown',reason:'Fixture assessment.'}}},files:[{path:'output.fits',...await pinFile(file)},{path:'output-input.product.json',...await pinFile(record)}]}));
 const options=await listOutputs(result);assert.ok(options.outputs.some(o=>o.kind==='spectrum'&&o.available));assert.ok(options.outputs.some(o=>o.kind==='sphere'&&!o.available));
 await assert.rejects(exportOutput(result,{kind:'image',hdu:1},resolve(root,'missing-plane')),/explicit/);
 const image=await exportOutput(result,{kind:'image',hdu:1,plane:0},resolve(root,'image-output'));
 assert.equal((await readFile(image.figure)).subarray(1,4).toString(),'PNG');assert.equal(JSON.parse(await readFile(image.receipt,'utf8')).telescope,'Fixture');
 const spectrum=await exportOutput(result,{kind:'spectrum',hdu:1,pixel:[0,0]},resolve(root,'spectrum-output'));
 const rows=(await readFile(spectrum.values,'utf8')).trim().split(/\r?\n/u);assert.equal(rows.length,4);assert.match(rows[2],/,,/);
 const tc=await astroqueryToolchain();execFileSync(tc.python,['-c',String.raw`
import sys
from astropy.table import QTable
from astropy import units as u
t=QTable.read(sys.argv[1]);assert list(t['value'].mask)==[False,True,False]
assert list(t['standard_deviation'].mask)==[False,True,False]
assert t['wavelength'].unit==u.um and t['value'].unit==u.erg/(u.s*u.cm**2*u.AA)
`,spectrum.data],{env:{...process.env,...tc.env}});
 await writeFile(file,'changed');await assert.rejects(listOutputs(result),/pin mismatch/);
});

test('output CLI selections remain explicit and sampling is reproducible',async()=>{
 const {parseCli}=await import('./cli.mts');const {shuffled}=await import('./survey-delivery.mts');
 const args=['export','result.json','--output','spectrum','--hdu','1','--pixel','25,27','--out','chart'];
 const parsed=parseCli(args);assert.equal(parsed.command,'export');if(parsed.command==='export')assert.deepEqual(parsed.selection,{kind:'spectrum',hdu:1,pixel:[25,27]});
 assert.throws(()=>parseCli(['export','result.json','--output','image','--hdu','-1','--out','chart']),/nonnegative/);
 assert.deepEqual(shuffled([1,2,3,4,5,6],'seed'),shuffled([1,2,3,4,5,6],'seed'));assert.equal(new Set(shuffled([1,2,3,4,5,6],'seed')).size,6);
});
