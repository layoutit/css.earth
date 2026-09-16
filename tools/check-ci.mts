import {readFile, mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve, join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {parse} from 'yaml';
import {requireArray, requireRecord, requireString} from './source-values.mts';

interface CiStep {name:string;run:string;env:Record<string,string>;}
/** Execute the maintained job's commands, so local checks cannot drift from CI. */
export function readCiSteps(source:string,jobName='universe'):CiStep[] {
 const workflow=requireRecord(parse(source)),jobs=requireRecord(workflow.jobs);
 if(!Object.hasOwn(jobs,jobName))throw new Error(`Unknown CI job: ${jobName}`);
 const job=requireRecord(jobs[jobName]);
 const decodeEnvironment=(value:unknown)=>Object.fromEntries(Object.entries(value===undefined?{}:requireRecord(value))
   .map(([key,value])=>[key,requireString(value,`CI environment ${key}`)]));
 const inherited={...decodeEnvironment(workflow.env),...decodeEnvironment(job.env)};
 return requireArray(job.steps).flatMap(value=>{
  const step=requireRecord(value);
  if(step.run===undefined){
   const action=requireString(step.uses);
   if(!/^(actions\/checkout|actions\/setup-node|pnpm\/action-setup)@/u.test(action))
    throw new Error(`Local CI does not implement action ${action}`);
   return [];
  }
  if(step.if!==undefined||step['working-directory']!==undefined||step['continue-on-error']!==undefined||step.shell!==undefined)
   throw new Error('Local CI needs explicit support for this step execution policy.');
  const result={name:requireString(step.name),run:requireString(step.run),env:{...inherited,...decodeEnvironment(step.env)}};
  if(JSON.stringify(result).includes('${{'))throw new Error('Local CI cannot evaluate GitHub expressions.');
  return [result];
 });
}

export async function runCiSteps(steps:readonly CiStep[],root:string,runnerTemp:string):Promise<void> {
 for(const [index,step] of steps.entries()){
  const started=performance.now();
  console.log(`[ci ${index+1}/${steps.length}] ${step.name}`);
  await new Promise<void>((accept,reject)=>{
   const child=spawn('bash',['--noprofile','--norc','-e','-o','pipefail','-c',step.run],{
    cwd:root,stdio:'inherit',env:{...process.env,CI:'true',...step.env,RUNNER_TEMP:runnerTemp},
   });
   child.once('error',reject);
   child.once('exit',(code,signal)=>code===0?accept():reject(new Error(`${step.name} failed (${signal??`exit ${code}`}).`)));
  });
  console.log(`[ci PASS] ${step.name} (${Math.round((performance.now()-started)/1000)}s)`);
 }
 console.log(`[ci PASS] All ${steps.length} workflow command steps passed.`);
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const root=resolve(import.meta.dirname,'..'),args=process.argv.slice(2);
 if(args.some(arg=>arg!=='--list'&&!/^--job=[a-z][a-z0-9-]*$/.test(arg))||new Set(args.map(arg=>arg.split('=')[0])).size!==args.length)
  throw new Error('Usage: pnpm check:ci [--job=universe|nebula] [--list]');
 const jobName=args.find(arg=>arg.startsWith('--job='))?.slice(6)??'universe';
 const steps=readCiSteps(await readFile(resolve(root,'.github/workflows/universe.yml'),'utf8'),jobName);
 if(args.includes('--list')){
  console.log(steps.map((step,index)=>`${index+1}. ${step.name}\n${step.run.trim()}`).join('\n\n'));
 }else{
  // The workflow pins Node 22; the checkout's engines range is what contributors have.
  const major=Number(process.versions.node.split('.')[0]);
  if(major<22)throw new Error('Use Node 22.18+ or Node 24 (the CI runner uses Node 22).');
  if(major!==22)console.log(`NODE ${process.versions.node}: the CI runner uses Node 22; results may differ.`);
  const temporary=await mkdtemp(join(tmpdir(),'cssearth-ci-'));
  try{await runCiSteps(steps,root,temporary);}finally{await rm(temporary,{recursive:true,force:true});}
 }
}
