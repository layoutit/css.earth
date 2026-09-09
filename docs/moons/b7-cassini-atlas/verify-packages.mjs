import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {relative} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {OBJECTS} from '../../../site/objects.mjs';
import {validatePlanetData} from '../../../tools/object-package-contract.mjs';
import {auditObjectRuntimeOwnership} from '../../../tools/check-object-runtime-ownership.mjs';
import {loadPlanetBrowserProfile} from '../../../site/test/load-browser-profile.mjs';
import {serializeObjectJson} from '../../../tools/prepare-object-json.mjs';

const ids=['titan','dione','rhea'],base=process.env.B7_QUALIFICATION_BASE ?? 'a5a34bdefa849801d092f10755cf81f6f3f23f5e';
const objects=OBJECTS.filter(object=>ids.includes(object.id));assert.equal(objects.length,3);
const frozen=execFileSync('git',['diff','--name-only',base,'--','src/renderers','src/platform','packages','site','src/navigation'],{encoding:'utf8'}).trim();
assert.equal(frozen,'','Renderer, shell, navigation and camera code stay fixed');
const report={status:'RUNNING',base,objects:[]};
for(const object of objects){
 const closure=await validatePlanetData(object);await loadPlanetBrowserProfile(object);
 const prefix=`src/planets/${object.id}/prepared/`;
 const scene=await readFile(prefix+'scene.json');
 const previous=execFileSync('git',['show',base+':'+prefix+'scene.json'],{maxBuffer:64*1024**2});
 assert.ok(scene.equals(previous),'Prepared scene geometry changed');
 const current=JSON.parse(await readFile(prefix+'runtime.json'));
 const old=JSON.parse(execFileSync('git',['show',base+':'+prefix+'runtime.json'],{maxBuffer:64*1024**2}));
 assert.deepEqual(current.tree,old.tree,'Retained runtime tree changed');
 report.objects.push({id:object.id,...closure,retainedTreeUnchanged:true,sceneSha256:createHash('sha256').update(scene).digest('hex')});
}
const audit=await auditObjectRuntimeOwnership({objects,strict:false});
assert.ok(!audit.sharedClosure.includes('src/platform/source-manifest.mjs'),'Source verification must stay outside runtime');
assert.ok(audit.entries.every(entry=>entry.migrated),'A selected object violates runtime ownership');
report.runtimeOwnership=audit;
if(!audit.complete){
 const readBase=file=>execFileSync('git',['show',base+':'+file],{encoding:'utf8',maxBuffer:64*1024**2});
 const baseline=await auditObjectRuntimeOwnership({objects,strict:false,readText:async path=>{
  const file=relative(process.cwd(),path);
  if(file.startsWith('node_modules/'))return readFile(path,'utf8');
  if(/^src\/planets\/[^/]+\/prepared\/object.json$/.test(file)){
   return serializeObjectJson(JSON.parse(readBase(file.replace('prepared/object.json','object.json'))),
     JSON.parse(readBase(file.replace('object.json','runtime.json')))).toString();
  }
  return readBase(file);
 }});
 assert.deepEqual(audit.sharedViolations,baseline.sharedViolations,'New shared runtime ownership violation');
 report.baselineRuntimeOwnership=baseline;
}
report.status=audit.complete?'PASS':'SELECTED_PACKAGES_PASS_SHARED_AUDIT_BLOCKED_ON_BASELINE';
await mkdir('output/b7-qualification',{recursive:true});
await writeFile('output/b7-qualification/packages.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,base,objects:report.objects,
 runtimeOwnership:{complete:audit.complete,sharedViolations:audit.sharedViolations},
 baselineSharedViolationsMatch:!audit.complete}));
