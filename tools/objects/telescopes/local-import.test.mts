import assert from 'node:assert/strict';
import test from 'node:test';
import { copyFile, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { readProductRecord } from '../product-record.mts';
import { importLocalArtifact, parseLocalImportSpec } from './local-import.mts';
import { listArtifactOutputs } from './artifact-outputs.mts';
import { executeFamilyOperation } from './family-operation.mts';
import { main, type CliIo } from './cli.mts';

const spec=(path:string,limits={maxMembers:4,maxBytes:4096,maxFileBytes:2048})=>({schema:'cssearth-telescope-local-import-spec@1',datasetId:'local-fixture',sources:[{path,role:'science',name:'observation'}],declarations:{target:'eris',units:'counts',calibrationState:'unknown'},limits});

test('bounded local directory import pins every member, records absent origin and only proposes content-matched handlers',async()=>{
  const root=await mkdtemp(resolve(tmpdir(),'telescope-import-')),source=resolve(root,'source'),out=resolve(root,'out');
  try{
    await mkdir(source);await writeFile(resolve(source,'image.fits'),Buffer.concat([Buffer.from('SIMPLE  ='),Buffer.alloc(151)]));await writeFile(resolve(source,'notes.txt'),'support');
    const result=await importLocalArtifact(spec(source),out),manifest=JSON.parse(await readFile(result.manifest,'utf8')),record=await readProductRecord(result.receipt);
    assert.equal(manifest.members.length,2);assert.deepEqual(manifest.proposedProfiles,[{handlerId:'raster-f01-f02',profileId:'fits-image-array@1'}]);assert.match(manifest.issues[0].reason,/No archive origin/u);
    assert.equal(record?.stage,'telescope-local-import');assert.equal(record?.inputs.length,2);assert.equal(record?.outputs.length,3);assert.ok(record?.outputs.every(output=>/^[a-f0-9]{64}$/u.test(output.sha256)));
  }finally{await rm(root,{recursive:true,force:true});}
});

test('local import specification is data-only and exact',()=>{
  assert.throws(()=>parseLocalImportSpec({...spec('/tmp/file'),command:'run-me'}),/unsupported field command/u);
  assert.throws(()=>parseLocalImportSpec({...spec('/tmp/file'),sources:[{path:'/tmp/file',role:'science',command:'run-me'}]}),/unsupported field command/u);
  assert.throws(()=>parseLocalImportSpec(spec('/tmp/file',{maxMembers:1,maxBytes:1,maxFileBytes:2})),/cannot exceed/u);
});

test('local import refuses bounds and symbolic links before publishing a destination',async()=>{
  const root=await mkdtemp(resolve(tmpdir(),'telescope-import-refuse-')),file=resolve(root,'large.bin'),link=resolve(root,'link.bin');
  try{
    await writeFile(file,Buffer.alloc(32));await symlink(file,link);
    await assert.rejects(importLocalArtifact(spec(file,{maxMembers:1,maxBytes:16,maxFileBytes:16}),resolve(root,'too-large')),/file limit exceeded/u);
    await assert.rejects(importLocalArtifact(spec(link),resolve(root,'linked')),/symbolic link/u);
    await assert.rejects(readFile(resolve(root,'too-large','import.json')));
  }finally{await rm(root,{recursive:true,force:true});}
});

test('a real supported local FITS crosses import, outputs, family export and product readback without a hand-authored descriptor',async()=>{
  const root=await mkdtemp(resolve(tmpdir(),'telescope-import-family-')),source=resolve(import.meta.dirname,'../../../tests/fixtures/telescope-families/f13-stokes/rm-lite-documented-full-stokes.fits'),copy=resolve(root,'full-stokes.fits'),out=resolve(root,'imported'),specification=resolve(root,'import-spec.json'),parameters=resolve(root,'parameters.json');
  try{
    await copyFile(source,copy);
    await writeFile(specification,JSON.stringify({schema:'cssearth-telescope-local-import-spec@1',datasetId:'rm-lite-import',sources:[{path:copy,role:'science',name:'full-stokes.fits'}],declarations:{familyHints:['F02']},limits:{maxMembers:1,maxBytes:8192,maxFileBytes:8192}}));
    const call=async(args:string[])=>{let stdout='';const io:CliIo={stdinIsTTY:false,stdoutIsTTY:false,write:text=>stdout+=text,error:()=>{},question:async()=>undefined,close:()=>{}};const code=await main(args,root,text=>stdout+=text,io);return{code,value:JSON.parse(stdout)};};
    const imported=await call(['import',specification,'--out',out,'--json']);assert.equal(imported.code,0);const result=imported.value;
    assert.equal(result.descriptor,resolve(out,'descriptor.json'));assert.equal(result.value.descriptor?.path,'descriptor.json');
    const output=await call(['outputs',result.manifest,'--json']);assert.equal(output.code,0);const inspected=output.value;assert.equal(inspected.source,result.descriptor);assert.ok(inspected.familyOperations?.some((operation:any)=>operation.id==='nd-spectrum'&&operation.available));
    await writeFile(parameters,JSON.stringify({operationId:'nd-spectrum',x:0,y:0,slice:{'axis-0':0,'axis-1':1}}));const family=await call(['family-run',inspected.source,'nd-spectrum','--params',parameters,'--out',resolve(root,'exported'),'--json']);assert.equal(family.code,0);const exported=family.value,record=await readProductRecord(exported.record);
    assert.equal(record?.stage,'telescope-family-operation');assert.equal(record?.outputs[0]?.path,'mixed-nd.json');assert.deepEqual(JSON.parse(await readFile(exported.product,'utf8')).shape,[3]);
    await writeFile(resolve(out,'files/full-stokes.fits'),'changed');await assert.rejects(executeFamilyOperation(inspected.source,{operationId:'nd-inspect'},resolve(root,'tampered-member')),/member pin changed/u);
    await writeFile(result.descriptor!,'{}');await assert.rejects(listArtifactOutputs(result.manifest),/descriptor pin changed/u);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('local HEALPix import reuses its Astropy-owned descriptor and operations',async()=>{
  const root=await mkdtemp(resolve(tmpdir(),'telescope-import-healpix-')),source=resolve(import.meta.dirname,'../../../tests/fixtures/telescope-families/f14-healpix/bayestar.fits.gz'),copy=resolve(root,'bayestar.fits.gz'),out=resolve(root,'imported');
  try{
    await copyFile(source,copy);const result=await importLocalArtifact({schema:'cssearth-telescope-local-import-spec@1',datasetId:'bayestar-import',sources:[{path:copy,role:'science'}],declarations:{familyHints:['F14']},limits:{maxMembers:1,maxBytes:200000,maxFileBytes:200000}},out),inspected=await listArtifactOutputs(result.manifest);
    assert.equal(result.value.descriptor?.path,'descriptor.json');assert.ok('familyOperations' in inspected);assert.ok(inspected.familyOperations?.some(operation=>operation.id==='healpix-select'&&operation.available));
  }finally{await rm(root,{recursive:true,force:true});}
});
