import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { readProductRecord } from '../product-record.mts';
import { importLocalArtifact, parseLocalImportSpec } from './local-import.mts';

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
