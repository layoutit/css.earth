/** The named guardrails must fail when removed. Never changes the immutable tag or approved inputs. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {ROOT,need} from '../inputs.mts';
const path=ROOT+'packages/bake/authoring/lmc-volume/delivery/reference.mts',original=await readFile(path,'utf8'),out=ROOT+'output/lmc-approved-delivery/';await mkdir(out,{recursive:true});
for(const [name,pattern]of [['pin-guard',/need\(Number\.isFinite\(colorRatioChange\).*?;\n/u],['tag-guard',/need\(commit===APPROVED_COMMIT,'[^']*'\);/u]] as const){
 const changed=original.replace(pattern,'void 0;\n');need(changed!==original,'Mutation target disappeared');
 try{await writeFile(path,changed);const run=spawnSync(process.execPath,['--test','packages/bake/authoring/lmc-volume/delivery/reference.test.mts'],{cwd:ROOT,encoding:'utf8',timeout:60_000});await writeFile(out+name+'-mutation.log',run.stdout+run.stderr);need(run.status!==0&&run.stdout.includes('Missing expected exception'),'Removing '+name+' did not turn its behavior test red');}
 finally{await writeFile(path,original);}
}
console.log('NATIVE TAG AND PIN GUARD REMOVALS BOTH FAIL THEIR BEHAVIOR TESTS');
