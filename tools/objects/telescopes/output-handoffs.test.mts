import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { cp,mkdtemp,writeFile,readFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { astroqueryToolchain } from '@cssearth/telescope/node';
import { pdsPackages } from '@cssearth/telescope/node';
import { writeProductRecord } from '@cssearth/telescope/node';
import { sha256File } from '@cssearth/core/node';
import { exportOutput,listOutputs } from './outputs.mts';
import { exportSpatialObject,inspectSpatialObject } from './spatial-handoff.mts';
import { parseCli } from './cli.mts';
import { listArtifactOutputs } from './artifact-outputs.mts';

test('PDS arrays retain integer flags, special constants and associated uncertainty through figure export',async()=>{
  const root=await mkdtemp(resolve(tmpdir(),'native-output-'));
  try{
    const context={kind:'exploration',target:'fixture',discovery:{schema:'cssearth-telescope-exploration@1',observation:'fixture-image',snapshot:'a'.repeat(64)},assessment:{status:'not-requested'}};
    const array=(name:string,offset:number,type:string,unit?:string,missing=false)=>`<Array_2D_Image><local_identifier>${name}</local_identifier><offset unit="byte">${offset}</offset><axes>2</axes><axis_index_order>Last Index Fastest</axis_index_order><Element_Array><data_type>${type}</data_type>${unit?`<unit>${unit}</unit>`:''}${name==='IMAGE'?'<scaling_factor>0.5</scaling_factor><value_offset>100</value_offset>':''}</Element_Array><Axis_Array><axis_name>Line</axis_name><elements>2</elements><sequence_number>1</sequence_number></Axis_Array><Axis_Array><axis_name>Sample</axis_name><elements>2</elements><sequence_number>2</sequence_number></Axis_Array>${missing?'<Special_Constants><missing_constant>-999</missing_constant></Special_Constants>':''}</Array_2D_Image>`;
    const xml=`<?xml version="1.0"?><Product_Observational xmlns="http://pds.nasa.gov/pds4/pds/v1"><File_Area_Observational><File><file_name>data.bin</file_name></File>${array('IMAGE',0,'IEEE754LSBSingle','W m-2',true)}${array('SIGMA_MAP_IMAGE',16,'IEEE754LSBSingle','W m-2')}${array('QUALITY_MAP_IMAGE',32,'UnsignedByte')}</File_Area_Observational></Product_Observational>`;
    const bytes=Buffer.alloc(36);[10,20,-999,40,1,2,3,4].forEach((v,i)=>bytes.writeFloatLE(v,i*4));bytes.set([0,2,0,0],32);
    const label=resolve(root,'label.xml'),data=resolve(root,'data.bin'),record=resolve(root,'input.json');await writeFile(label,xml);await writeFile(data,bytes);
    const decoded=await pdsPackages({operation:'decode-product',labelPath:label,arrayDirectory:resolve(root,'arrays')});
    assert.equal(decoded.decoded?.structures.find(s=>s.name==='QUALITY_MAP_IMAGE')?.dtype,'uint8');
    await writeProductRecord(record,{telescope:'Fixture',stage:'fixture',inputs:[],parameters:{observation:{decoder:'pds-product',labelPath:'label.xml'}},software:[]},[{path:'data.bin',file:data},{path:'label.xml',file:label}]);
    const result=resolve(root,'result.json');await writeFile(result,JSON.stringify({schema:'cssearth-telescope-delivery@3',product:'data.bin',record:'input.json',receipt:'input.json',facts:{target:'fixture',verified:true},context,files:await Promise.all(['data.bin','label.xml','input.json'].map(async path=>({path,...await sha256File(resolve(root,path))})))}));
    const choices=await listOutputs(result),image=choices.outputs.find(o=>o.kind==='image'&&o.available);assert.ok(image);assert.deepEqual(choices.sourceContext,context);assert.equal(image.unit?.value,'W m-2');assert.ok(image.limitations?.length);
    const output=await exportOutput(result,{kind:'image',hdu:0,structure:'IMAGE'},resolve(root,'export'));
    const tc=await astroqueryToolchain();
    execFileSync(tc.python,['-c',`import sys,numpy as np
from astropy.io import fits
from astropy import units as u
with fits.open(sys.argv[1]) as f:
 np.testing.assert_equal(f[0].data,[[105,np.nan],[np.nan,120]])
 np.testing.assert_equal(f['ERR'].data,[[1,np.nan],[np.nan,4]])
 assert u.Unit(f[0].header['BUNIT']).is_equivalent(u.W/u.m**2)
a=np.load(sys.argv[2]);assert a.dtype==np.dtype('uint8');np.testing.assert_equal(a,[[0,2],[0,0]])`,output.data,resolve(root,'arrays/native-2.npy')],{env:{...process.env,...tc.env}});
    const evidence=JSON.parse(await readFile(output.receipt,'utf8'));assert.deepEqual(evidence.parameters.sourceContext,context);assert.deepEqual(output.sourceContext,context);
    await writeFile(data,Buffer.alloc(36));await assert.rejects(listOutputs(result),/content pin mismatch/);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('large file-backed extraction crosses a row chunk boundary without losing the last samples',async()=>{
  const root=await mkdtemp(resolve(tmpdir(),'large-output-')),tc=await astroqueryToolchain();
  try{
    const file=resolve(root,'wide.fits');
    execFileSync(tc.python,['-c',`import sys,numpy as np
from astropy.io import fits
h=fits.PrimaryHDU(np.ones((2,1,1000003),dtype='float32'));h.data[1]*=3
for k,v in {'BUNIT':'Jy','CTYPE3':'WAVE','CUNIT3':'um','CRVAL3':1.,'CRPIX3':1.,'CDELT3':1.}.items():h.header[k]=v
h.writeto(sys.argv[1])`,file],{env:{...process.env,...tc.env}});
    const {sciencePackage}=await import('@cssearth/telescope/node');
    const answer=await sciencePackage({operation:'extract',path:file,hdu:0,kind:'band-image',band:[.5,2.5],arrayDirectory:resolve(root,'arrays')});
    assert.ok(!JSON.stringify(answer).includes('"values":['));
    execFileSync(tc.python,['-c',`import sys,numpy as np
a=np.load(sys.argv[1],mmap_mode='r');assert a.shape==(1,1000003);np.testing.assert_equal(a,2)`,resolve(root,'arrays/values.npy')],{env:{...process.env,...tc.env}});
  }finally{await rm(root,{recursive:true,force:true});}
});

test('physical handoffs refuse spectral deliveries and incompatible selectors',async()=>{
  const root=await mkdtemp(resolve(tmpdir(),'spatial-refusal-'));
  try{
    const path=resolve(root,'result.json');await writeFile(path,JSON.stringify({schema:'cssearth-telescope-delivery@1',facts:{kind:'cube'}}));
    await assert.rejects(exportSpatialObject(path,'volume',resolve(root,'output')),/does not establish depth/);
    assert.equal(parseCli(['export','object.json','--output','points','--out','out']).command,'spatial');
    assert.throws(()=>parseCli(['export','object.json','--output','volume','--hdu','1','--out','out']),/only/);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('physical inspection and export share the existing loader, frame and credit closure',async()=>{
  const root=await mkdtemp(resolve(tmpdir(),'spatial-inspection-')),source=resolve(import.meta.dirname,'../../../src/objects/stellar-neighbourhood'),copy=resolve(root,'stellar-neighbourhood');
  try{
    await cp(source,copy,{recursive:true});const object=resolve(copy,'object.json');
    const inspected=await inspectSpatialObject(object),ready=await listArtifactOutputs(object);assert.ok(ready.outputs.some(output=>output.kind==='points'&&output.available));
    const handoff=await exportSpatialObject(object,'points',resolve(root,'handoff')),receipt=JSON.parse(await readFile(handoff.receipt,'utf8'));
    assert.deepEqual(receipt.parameters.frame,inspected.frame);assert.deepEqual(receipt.parameters.provenance,inspected.provenance);
    const terminal=await listArtifactOutputs(handoff.receipt);assert.equal(terminal.terminal,true);assert.deepEqual(terminal.outputs,[]);
    await writeFile(handoff.object,'changed');await assert.rejects(listArtifactOutputs(handoff.receipt),/pins changed/);
    await writeFile(resolve(copy,'prepared/stars.bin'),'changed');
    const blocked=await listArtifactOutputs(object),choice=blocked.outputs.find(output=>output.kind==='points');assert.equal(choice?.available,false);assert.match(choice?.reason??'',/identity mismatch|pin mismatch/);
    await assert.rejects(exportSpatialObject(object,'points',resolve(root,'output')),/identity mismatch|pin mismatch/);
  }finally{await rm(root,{recursive:true,force:true});}
});


test('inactive sphere images are removed without changing geometry or active textures',async()=>{
 const {clearInactiveImageBindings}=await import('./sphere/sphere-assets.mts');
 const properties=[{name:'--surface-image',value:'url("/surface.webp")'},{name:'--interior-image',value:'url("/interior.webp"), url("/surface.webp")'},{name:'--transform',value:'rotateY(24deg) scale(2)'},{name:'--different-image',value:'url("/interior.webp-extra")'}];
 const original=structuredClone(properties),result=clearInactiveImageBindings(properties,[{url:'/interior.webp'}]);
 assert.deepEqual(result.inactiveImageProperties,['--interior-image']);
 assert.equal(result.properties[1].value,'none, url("/surface.webp")');
 for(const index of [0,2,3])assert.equal(result.properties[index],properties[index]);
 assert.deepEqual(properties,original);
});
