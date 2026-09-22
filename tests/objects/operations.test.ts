import { sourceTest } from './source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,mkdir,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {containedPath,parseSourceManifest,verifySources,publishPinnedSource,collectRuntimeAssetUrls,prepareRuntimeManifest,assembleRuntimeAssets,restoreMissingSources} from '../../tools/objects/dist/operations.js';
import type {SourceEntry,SourceManifest} from '../../tools/objects/dist/operations.js';
import {executeAcquisition,parseAcquisitionPlan} from '../../tools/objects/dist/operations.js';
const sha=(data:Uint8Array)=>createHash('sha256').update(data).digest('hex');
const entry=(path:string,_data:Uint8Array):SourceEntry=>({path});
const temporary=async(work:(root:string)=>Promise<void>)=>{const root=await mkdtemp(join(tmpdir(),'object-operations-'));try{await work(root);}finally{await rm(root,{recursive:true,force:true});}};
test('source verification rejects byte drift, undeclared files and escaping paths',()=>temporary(async root=>{
 const data=Buffer.from('pinned source'),source=entry('sample.dat',data),manifest:SourceManifest={schema:'cssearth-authoritative-sources@2',inputs:[{...source,id:'sample',origin:'https://example.org/sample',consumers:['raster']}],generatedIntermediates:[],documents:[]};
 await writeFile(join(root,'sample.dat'),data);assert.equal((await verifySources({sourceRoot:root,manifest})).verifiedCount,1);
 await writeFile(join(root,'sample.dat'),Buffer.from('mutant source'));await assert.rejects(verifySources({sourceRoot:root,manifest}),/hash drifted/);
 await writeFile(join(root,'sample.dat'),data);await writeFile(join(root,'extra.dat'),'undeclared');await assert.rejects(verifySources({sourceRoot:root,manifest}),/coverage failed/);
 for(const path of ['../escape','/absolute','C:\\escape','a/../escape'])assert.throws(()=>containedPath(root,path));
}));
test('default acquisition restores only missing declared pins',()=>temporary(async root=>{
 const existing=Buffer.from('existing'),missing=Buffer.from('missing');await writeFile(join(root,'one.txt'),existing);
 const manifest:SourceManifest={schema:'cssearth-authoritative-sources@2',inputs:[entry('one.txt',existing),entry('two.txt',missing)],documents:[],generatedIntermediates:[]};
 const plan=parseAcquisitionPlan({schema:'cssearth-acquisition-plan@1',operations:['one','two'].map(name=>({kind:'download',path:`${name}.txt`,url:`https://example.org/${name}`,groups:['refresh']}))});
 const calls:string[]=[];
 await restoreMissingSources({sourceRoot:root,manifest,plan,missing:['two.txt'],transport:{fetch:async url=>{calls.push(String(url));return new Response(missing);}}});
 assert.deepEqual(calls,['https://example.org/two']);assert.deepEqual(await readFile(join(root,'one.txt')),existing);
 await assert.rejects(restoreMissingSources({sourceRoot:root,manifest,plan,missing:['unknown.txt']}),/No authored acquisition restores/);
}));
