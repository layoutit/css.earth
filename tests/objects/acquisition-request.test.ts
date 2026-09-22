import assert from 'node:assert/strict';
import { sourceTest } from './source-test.mts';
const test = sourceTest();
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {executeAcquisition,parseAcquisitionPlan} from '../../tools/objects/dist/operations.js';
import {execFileSync} from 'node:child_process';
import type {SourceManifest} from '../../tools/objects/dist/operations.js';

const json=async(path:string)=>JSON.parse(await readFile(resolve(path),'utf8'));
const temporary=async(work:(root:string)=>Promise<void>)=>{
 const root=await mkdtemp(join(tmpdir(),'terrestrial-request-acquisition-'));
 try{await work(root);}finally{await rm(root,{recursive:true,force:true});}
};
test('Mars refresh restores both pinned PSG products from intercepted source responses',()=>temporary(async root=>{
 const sourceRoot=resolve('src/objects/mars/source'),manifest:SourceManifest=await json('src/objects/mars/source/manifest.json');
 const authored=await json('src/objects/mars/source/preparation/acquisition.json');
 const plan=parseAcquisitionPlan({...authored,operations:authored.operations.filter((step:{kind:string})=>step.kind==='request-download')});
 assert.equal(plan.operations.length,2,'Configuration and spectrum are real acquisition operations, not verification aliases.');
 const configuration=await readFile(join(sourceRoot,'atmosphere/psg-mars-20260829.cfg'),'utf8');
 const spectrum=await readFile(join(sourceRoot,'atmosphere/psg-mars-r240-rif.txt'),'utf8');
 const calls:string[]=[];
 const transport={fetch:async(url:string,init?:RequestInit)=>{
  assert.equal(url,'https://psg.gsfc.nasa.gov/api.php');assert.equal(init?.method,'POST');
  const form=new URLSearchParams(String(init?.body));calls.push(String(form.get('type')));
  if(form.get('type')==='cfg'){
   assert.equal(form.get('file'),'<OBJECT-DATE>2026/08/29 12:00\n<OBJECT-NAME>Mars\n<GEOMETRY-REF>User');
   return new Response(configuration.split('<GENERATOR-RANGE1>')[0].trimEnd()+'\n\n');
  }
  assert.equal(form.get('type'),'rad');assert.equal(form.get('file'),configuration,'The spectrum request uses the newly restored, hash-verified configuration.');
  return new Response(spectrum);
 }};
 await executeAcquisition({sourceRoot:root,manifest,plan,transport});
 assert.deepEqual(calls,['cfg','rad']);
 assert.equal(await readFile(join(root,'atmosphere/psg-mars-20260829.cfg'),'utf8'),configuration);
 assert.equal(await readFile(join(root,'atmosphere/psg-mars-r240-rif.txt'),'utf8'),spectrum);
 await assert.rejects(executeAcquisition({sourceRoot:root,manifest,plan,transport:{fetch:async()=>new Response('upstream drift')}}),/size drifted|hash drifted/);
 assert.equal(await readFile(join(root,'atmosphere/psg-mars-20260829.cfg'),'utf8'),configuration);
 assert.deepEqual((await readdir(join(root,'atmosphere'))).sort(),['psg-mars-20260829.cfg','psg-mars-r240-rif.txt']);
}));
test('solid observation inputs have an acquisition operation or byte-verified Git source',async()=>{
 const tracked = new Set(execFileSync('git', ['ls-files', '-z', '--', 'src/objects/ceres/source', 'src/objects/io/source', 'src/objects/europa/source', 'src/objects/ganymede/source', 'src/objects/callisto/source'], {encoding:'utf8'}).split('\0'));
 for(const id of ['ceres','io','europa','ganymede','callisto']){
  const sourceRoot=`src/objects/${id}/source`;
  const manifest:SourceManifest=await json(`${sourceRoot}/manifest.json`),plan=parseAcquisitionPlan(await json(`${sourceRoot}/preparation/acquisition.json`));
  const paths=new Set(plan.operations.flatMap(step=>'path'in step?[step.path]:[]));
  for (const entry of manifest.inputs) {
   if (paths.has(entry.path)) continue;
   assert.ok(tracked.has(`${sourceRoot}/${entry.path}`), `${id}: ${entry.path} needs acquisition or a retained Git source`);
   assert.ok((await readFile(`${sourceRoot}/${entry.path}`)).length>0,entry.path);
  }
  for (const path of paths) assert.ok([...manifest.inputs,...manifest.generatedIntermediates,...manifest.documents].some(entry=>entry.path===path),`${id}: acquisition ${path} must be pinned`);
 }
});
