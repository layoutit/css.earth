import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {test} from 'node:test';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {astroqueryToolchain} from '../../astronomy-packages/toolchain.mts';
import {pinFile,readProductRecord} from '../../product-record.mts';
import {executeFamilyOperation} from '../family-operation.mts';
import {importLocalArtifact} from '../local-import.mts';
import {cropPhysicalCartesianGrid,inspectPhysicalCartesianGrid,type PhysicalGridContext} from './f16-cartesian-grid.mts';

const context:PhysicalGridContext={frame:'galactic-cartesian',quantity:'dust extinction density',unit:'mag pc-1',meanHdu:1,uncertaintyHdu:2,uncertaintyForm:'standard-deviation'};
const fixture=String.raw`import numpy as np,sys
from astropy.io import fits
path=sys.argv[1]; a=np.zeros((4,5,6),np.float32); a[0,0,0]=0.; a[1,2,3]=17.; a[2,1,1]=np.nan; s=np.full_like(a,.25); s[3,4,5]=np.nan
# FITS axes are Y, X, Z, with a rotated/reflected XY block.  The fixture is deliberately asymmetric.
h=fits.Header();h['CTYPE1']='Y';h['CTYPE2']='X';h['CTYPE3']='Z';h['CUNIT1']='pc';h['CUNIT2']='pc';h['CUNIT3']='pc';h['CRPIX1']=1.;h['CRPIX2']=1.;h['CRPIX3']=1.;h['CRVAL1']=20.;h['CRVAL2']=-10.;h['CRVAL3']=5.;h['CDELT1']=2.;h['CDELT2']=3.;h['CDELT3']=4.;h['PC1_1']=0.;h['PC1_2']=1.;h['PC1_3']=0.;h['PC2_1']=-1.;h['PC2_2']=0.;h['PC2_3']=0.;h['PC3_1']=0.;h['PC3_2']=0.;h['PC3_3']=1.
fits.HDUList([fits.PrimaryHDU(),fits.ImageHDU(a,header=h,name='MEAN'),fits.ImageHDU(s,header=h,name='STDDEV')]).writeto(path)`;
async function create(path:string){const toolchain=await astroqueryToolchain(),run=spawnSync(toolchain.python,['-c',fixture,path],{env:{...process.env,...toolchain.env},encoding:'utf8'});if(run.status!==0)throw new Error(run.stderr);}
async function reopen(path:string){const toolchain=await astroqueryToolchain(),code=String.raw`import json,sys,numpy as np
from astropy.io import fits
h=fits.open(sys.argv[1]);m=h[1].data;s=h[2].data;print(json.dumps({'mean0':float(m[0,0,0]),'std0':float(s[0,0,0]),'shape':list(m.shape),'crval':[float(h[1].header['CRVAL'+str(i)]) for i in range(1,4)],'finite':int((np.isfinite(m)&np.isfinite(s)).sum())}))`,run=spawnSync(toolchain.python,['-c',code,path],{env:{...process.env,...toolchain.env},encoding:'utf8'});if(run.status!==0)throw new Error(run.stderr);return JSON.parse(run.stdout);}

test('F16 physical Cartesian grid keeps valid zero, finite mask, affine rotation and bounded crop',async()=>{const work=await mkdtemp(resolve(tmpdir(),'f16-grid-'));try{const file=resolve(work,'grid.fits');await create(file);const pin={path:file,...await pinFile(file)},inspection=await inspectPhysicalCartesianGrid(pin,context);assert.deepEqual(inspection.shape,[5,6,4]);assert.equal(inspection.validSamples,118);assert.equal(inspection.affine.rightHanded,true);assert.ok(inspection.affine.determinant>0);assert.deepEqual(inspection.axes.map(axis=>axis.ctype),['X','Y','Z']);const crop=await cropPhysicalCartesianGrid(pin,context,{start:[0,0,0],shape:[2,3,2]},resolve(work,'crop.fits'));assert.equal(crop.crop.validSamples>0,true);assert.equal((await readFile(resolve(work,'crop.fits'))).subarray(0,6).toString('latin1'),'SIMPLE');const reopened=await reopen(resolve(work,'crop.fits'));assert.deepEqual(reopened.shape,[2,3,2]);assert.equal(reopened.mean0,0);assert.equal(reopened.std0,.25);assert.equal(reopened.finite,12);assert.deepEqual(reopened.crval,crop.affine.worldAtPixelZero);}finally{await rm(work,{recursive:true,force:true});}});

test('F16 refuses missing source context and mismatch uncertainty, then qualifies public local import/crop',async()=>{const work=await mkdtemp(resolve(tmpdir(),'f16-grid-public-'));try{const file=resolve(work,'grid.fits');await create(file);const bad=resolve(work,'bad.fits');const toolchain=await astroqueryToolchain();const code=String.raw`from astropy.io import fits
import numpy as np,sys
h=fits.Header();h['CTYPE1']='X';h['CTYPE2']='Y';h['CTYPE3']='Z';h['CUNIT1']='pc';h['CUNIT2']='pc';h['CUNIT3']='pc';fits.HDUList([fits.PrimaryHDU(),fits.ImageHDU(np.zeros((2,2,2)),header=h,name='MEAN'),fits.ImageHDU(np.zeros((2,2,3)),header=h,name='STDDEV')]).writeto(sys.argv[1])`;
assert.equal(spawnSync(toolchain.python,['-c',code,bad],{env:{...process.env,...toolchain.env}}).status,0);await assert.rejects(inspectPhysicalCartesianGrid({path:bad,...await pinFile(bad)},context),/identical shape/u);
const imported=await importLocalArtifact({schema:'cssearth-telescope-local-import-spec@1',datasetId:'asymmetric-grid',sources:[{path:file,role:'science'}],declarations:{target:'fixture',familyHints:['F16'],physicalContext:context},limits:{maxMembers:1,maxBytes:100000,maxFileBytes:100000}},resolve(work,'import'));assert.ok(imported.descriptor,JSON.stringify(imported.value.issues));const result=await executeFamilyOperation(imported.descriptor!,{operationId:'physical-grid-crop',crop:{start:[1,1,1],shape:[2,2,2]}},resolve(work,'output'));assert.equal((await readProductRecord(result.record))?.outputs.some(output=>output.path==='physical-grid.fits'),true);assert.ok(await readFile(resolve(result.directory,'physical-grid.fits')));const missing=await importLocalArtifact({schema:'cssearth-telescope-local-import-spec@1',datasetId:'context-refusal',sources:[{path:file,role:'science'}],declarations:{familyHints:['F16']},limits:{maxMembers:1,maxBytes:100000,maxFileBytes:100000}},resolve(work,'missing'));assert.match(missing.value.issues.map(issue=>issue.reason).join('\n'),/physicalContext/u);}finally{await rm(work,{recursive:true,force:true});}});
