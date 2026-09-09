import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {OBJECTS} from '../../../site/objects.mjs';
import {validatePlanetData} from '../../../tools/object-package-contract.mjs';
import {auditObjectRuntimeOwnership} from '../../../tools/check-object-runtime-ownership.mjs';
import {loadPlanetBrowserProfile} from '../../../site/test/load-browser-profile.mjs';

const ids=['moon','europa','callisto','charon'],base='b3a0410f742501a1a1552dea14d9a3730fce7484';
const objects=OBJECTS.filter(object=>ids.includes(object.id));assert.equal(objects.length,4);
const frozen=execFileSync('git',['diff','--name-only',base,'--','src/renderers','site','src/navigation'],{encoding:'utf8'}).trim();
assert.equal(frozen,'','Renderer, shell, navigation and camera code stay fixed');
const report={status:'RUNNING',base,objects:[]};
for(const object of objects){
 const closure=await validatePlanetData(object);await loadPlanetBrowserProfile(object);
 const prefix=`src/planets/${object.id}/prepared/`;
 const scene=await readFile(prefix+'scene.json');
 const previous=execFileSync('git',['show',base+':'+prefix+'scene.json'],{maxBuffer:32*1024**2});
 assert.ok(scene.equals(previous),'Prepared scene geometry changed');
 const current=JSON.parse(await readFile(prefix+'runtime.json'));
 const old=JSON.parse(execFileSync('git',['show',base+':'+prefix+'runtime.json'],{maxBuffer:32*1024**2}));
 assert.deepEqual(current.tree,old.tree,'Retained runtime tree changed');
 report.objects.push({id:object.id,...closure,retainedTreeUnchanged:true,sceneSha256:createHash('sha256').update(scene).digest('hex')});
}
const audit=await auditObjectRuntimeOwnership({objects});assert.equal(audit.complete,true);
assert.ok(!audit.sharedClosure.includes('src/platform/source-manifest.mjs'),'Source verification must stay outside runtime');
report.runtimeOwnership=audit;report.status='PASS';
await mkdir('output/b6-qualification',{recursive:true});
await writeFile('output/b6-qualification/packages.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,runtimeOwnership:{complete:audit.complete}}));
