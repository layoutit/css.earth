import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,mkdir,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {containedPath,parseSourceManifest,verifySources,publishPinnedSource,collectRuntimeAssetUrls,prepareRuntimeManifest,assembleRuntimeAssets,restoreMissingSources} from '../../tools/objects/operations.js';
import type {SourceEntry,SourceManifest} from '../../tools/objects/operations.js';
import {executeAcquisition,parseAcquisitionPlan} from '../../tools/objects/operations-acquisition.js';
const sha=(data:Uint8Array)=>createHash('sha256').update(data).digest('hex');
const entry=(path:string,data:Uint8Array):SourceEntry=>({path,expectedBytes:data.length,expectedSha256:sha(data)});
const temporary=async(work:(root:string)=>Promise<void>)=>{const root=await mkdtemp(join(tmpdir(),'object-operations-'));try{await work(root);}finally{await rm(root,{recursive:true,force:true});}};
test('source verification rejects byte drift, undeclared files and escaping paths',()=>temporary(async root=>{
 const data=Buffer.from('pinned source'),source=entry('sample.dat',data),manifest:SourceManifest={schema:'cssearth-authoritative-sources@2',inputs:[{...source,id:'sample',origin:'https://example.org/sample',consumers:['raster']}],generatedIntermediates:[],documents:[]};
 await writeFile(join(root,'sample.dat'),data);assert.equal((await verifySources({sourceRoot:root,manifest})).verifiedCount,1);
 await writeFile(join(root,'sample.dat'),Buffer.from('mutant source'));await assert.rejects(verifySources({sourceRoot:root,manifest}),/hash drifted/);
 await writeFile(join(root,'sample.dat'),data);await writeFile(join(root,'extra.dat'),'undeclared');await assert.rejects(verifySources({sourceRoot:root,manifest}),/coverage failed/);
 for(const path of ['../escape','/absolute','C:\\escape','a/../escape'])assert.throws(()=>containedPath(root,path));
}));
test('pin mismatch leaves existing source untouched and no partial file',()=>temporary(async root=>{
 const pinned=Buffer.from('source'),source=entry('sample.dat',pinned);await writeFile(join(root,'sample.dat'),pinned);
 await assert.rejects(publishPinnedSource({sourceRoot:root,entry:source,bytes:Buffer.from('mutant')}),/hash drifted/);
 assert.deepEqual(await readFile(join(root,'sample.dat')),pinned);assert.deepEqual(await readdir(root),['sample.dat']);
}));
test('runtime inventory comes from nested JSON and CSS image addresses with exact closure',()=>temporary(async root=>{
 const data=Buffer.from('a'),other=Buffer.from('b');await writeFile(join(root,'one.webp'),data);await writeFile(join(root,'two.webp'),other);
 const values=[{url:'/scenes/open-body/one.webp',style:'background-image:url("/scenes/open-body/two.webp")',external:'/scenes/different/ignored.webp'}];
 assert.deepEqual(collectRuntimeAssetUrls('open-body',...values),['/scenes/open-body/one.webp','/scenes/open-body/two.webp']);
 const objectDirectory=join(root,'..',`object-${Date.now()}`);await mkdir(objectDirectory,{recursive:true});
 try{
  const manifest=await prepareRuntimeManifest({id:'open-body',publicRoot:root,objectDirectory,values});assert.equal(manifest.assets.length,2);
  await assert.rejects(prepareRuntimeManifest({id:'open-body',publicRoot:root,objectDirectory,values:[values[0].url]}),/closure/);
  const subset=await prepareRuntimeManifest({id:'open-body',publicRoot:root,objectDirectory,values:[values[0].url],allowPreparationArtifacts:true});
  assert.deepEqual(subset.assets.map(asset=>asset.filename),['one.webp']);
  await assert.rejects(prepareRuntimeManifest({id:'open-body',publicRoot:root,objectDirectory,values:['/scenes/open-body/missing.webp'],allowPreparationArtifacts:true}),/not a regular file|ENOENT/);
  await writeFile(join(root,'leftover.webp'),'leftover');await assembleRuntimeAssets({id:'open-body',manifest,productionRoot:root});assert.deepEqual(await readdir(root),['one.webp','two.webp']);
  await writeFile(join(root,'one.webp'),'corrupt');await writeFile(join(root,'evidence.txt'),'keep');await assert.rejects(assembleRuntimeAssets({id:'open-body',manifest,productionRoot:root}),/drifted/);assert.equal(await readFile(join(root,'evidence.txt'),'utf8'),'keep');
 }finally{await rm(objectDirectory,{recursive:true,force:true});}
}));
test('acquisition runs declared groups and validates downloaded bytes before publication',()=>temporary(async root=>{
 const data=Buffer.from('remote pin'),source={...entry('acquired.txt',data),origin:'https://example.org/source'},manifest:SourceManifest={schema:'cssearth-authoritative-sources@2',inputs:[source],generatedIntermediates:[],documents:[]};
 const plan=parseAcquisitionPlan({schema:'cssearth-acquisition-plan@1',operations:[{kind:'download',groups:['refresh'],path:'acquired.txt',url:source.origin}]});
 assert.equal((await executeAcquisition({sourceRoot:root,manifest,plan,transport:{fetch:async()=>new Response(data)}})).operationCount,1);
 await assert.rejects(executeAcquisition({sourceRoot:root,manifest,plan,transport:{fetch:async()=>new Response('unexpected')}}),/size drifted|hash drifted/);
 assert.deepEqual(await readFile(join(root,'acquired.txt')),data);await assert.rejects(executeAcquisition({sourceRoot:root,manifest,plan,group:'undeclared'}),/undeclared/);
}));
test('source manifest validates provenance as well as hashes',()=>{
 const source={...entry('input.bin',Buffer.from('x')),id:'source',origin:'https://example.org/source',consumers:['raster'],credit:'Example lab',license:'CC0',acquisition:'Pinned download',redistribution:'Allowed',sourceBinding:{kind:'local',reason:'Authored test fixture'}};
 const value={schema:'cssearth-authoritative-sources@2',inputs:[source],generatedIntermediates:[],documents:[]};assert.equal(parseSourceManifest(value,'open-body').inputs.length,1);
 assert.throws(()=>parseSourceManifest({...value,inputs:[{...source,credit:''}]},'open-body'),/lacks credit/);
 assert.throws(()=>parseSourceManifest({...value,inputs:[source,source]},'open-body'),/Duplicate/);
});
test('default acquisition restores only missing declared pins',()=>temporary(async root=>{
 const existing=Buffer.from('existing'),missing=Buffer.from('missing');await writeFile(join(root,'one.txt'),existing);
 const manifest:SourceManifest={schema:'cssearth-authoritative-sources@2',inputs:[entry('one.txt',existing),entry('two.txt',missing)],documents:[],generatedIntermediates:[]};
 const plan=parseAcquisitionPlan({schema:'cssearth-acquisition-plan@1',operations:['one','two'].map(name=>({kind:'download',path:`${name}.txt`,url:`https://example.org/${name}`,groups:['refresh']}))});
 const calls:string[]=[];
 await restoreMissingSources({sourceRoot:root,manifest,plan,missing:['two.txt'],transport:{fetch:async url=>{calls.push(String(url));return new Response(missing);}}});
 assert.deepEqual(calls,['https://example.org/two']);assert.deepEqual(await readFile(join(root,'one.txt')),existing);
 await assert.rejects(restoreMissingSources({sourceRoot:root,manifest,plan,missing:['unknown.txt']}),/No authored acquisition restores/);
}));
test('missing-source restoration transfers only the missing pin; a stale existing pin surfaces on verification instead',()=>temporary(async root=>{
 // Existing bytes are verified afterwards (verifySources), so a stale pin never blocks a download: restoreMissingSources itself restores only `missing`.
 const existing=Buffer.from('existing'),missing=Buffer.from('missing');await writeFile(join(root,'one.txt'),Buffer.from('modified'));
 const manifest:SourceManifest={schema:'cssearth-authoritative-sources@2',inputs:[entry('one.txt',existing),entry('two.txt',missing)],documents:[],generatedIntermediates:[]};
 const plan=parseAcquisitionPlan({schema:'cssearth-acquisition-plan@1',operations:[{kind:'download',path:'two.txt',url:'https://example.org/two',groups:['refresh']}]});
 let transfers=0;
 assert.equal((await restoreMissingSources({sourceRoot:root,manifest,plan,missing:['two.txt'],transport:{fetch:async()=>{transfers++;return new Response(missing);}}})).operationCount,1);
 assert.equal(transfers,1);assert.deepEqual(await readFile(join(root,'two.txt')),missing);assert.deepEqual(await readFile(join(root,'one.txt')),Buffer.from('modified'));
 await assert.rejects(verifySources({sourceRoot:root,manifest}),/hash drifted/);
}));
