import {readFile, mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve, join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync, spawn} from 'node:child_process';
import {parse} from 'yaml';
import {requireArray, requireRecord, requireString} from './source-values.mts';

interface CiStep {name:string;run:string;env:Record<string,string>;}
/** The workflow's own token; a local run uses the contributor's `gh` login instead. */
const WORKFLOW_TOKEN='${{ github.token }}';
/** Step conditions that only mean something inside a GitHub run: skip the step when Contract lint failed, or cancel
 * the rest of the run after a failure. */
export const CI_ONLY_CONDITIONS=["needs.lint.result != 'success'",'failure()'];
/** Execute the maintained job's commands, so local checks cannot drift from CI. */
export function readCiSteps(source:string,jobName='universe'):CiStep[] {
 const workflow=requireRecord(parse(source)),jobs=requireRecord(workflow.jobs);
 if(!Object.hasOwn(jobs,jobName))throw new Error(`Unknown CI job: ${jobName}`);
 const job=requireRecord(jobs[jobName]);
 const decodeEnvironment=(value:unknown)=>Object.fromEntries(Object.entries(value===undefined?{}:requireRecord(value))
   .map(([key,value])=>[key,requireString(value,`CI environment ${key}`)]).filter(([,value])=>value!==WORKFLOW_TOKEN));
 const inherited={...decodeEnvironment(workflow.env),...decodeEnvironment(job.env)};
 return requireArray(job.steps).flatMap(value=>{
  const step=requireRecord(value);
  if(step.run===undefined){
   const action=requireString(step.uses);
   // Caches only speed CI up; a local run keeps whatever the checkout already has.
   if(!/^(actions\/checkout|actions\/setup-node|pnpm\/action-setup|actions\/cache(\/restore|\/save)?)@/u.test(action))
    throw new Error(`Local CI does not implement action ${action}`);
   return [];
  }
  // CI-only housekeeping: a local run executes Contract lint first and stops at its first failure, so it has no
  // failed prerequisite to report and no parallel job to cancel.
  if(step.if!==undefined&&CI_ONLY_CONDITIONS.includes(String(step.if).trim()))return [];
  if(step.if!==undefined||step['working-directory']!==undefined||step['continue-on-error']!==undefined||step.shell!==undefined)
   throw new Error('Local CI needs explicit support for this step execution policy.');
  const result={name:requireString(step.name),run:requireString(step.run),env:{...inherited,...decodeEnvironment(step.env)}};
  if(JSON.stringify(result).includes('${{'))throw new Error('Local CI cannot evaluate GitHub expressions.');
  return [result];
 });
}

/** `--quick` (the pre-push hook) skips the steps that need the network or take longest; nothing else. */
export const QUICK_SKIPPED_STEPS=['Check documentation links and organization','Check published assets this change adds'];
export function quickSteps(steps:readonly CiStep[]):CiStep[] {
 for(const name of QUICK_SKIPPED_STEPS)if(!steps.some(step=>step.name===name))throw new Error(`--quick expects a step named "${name}".`);
 return steps.filter(step=>!QUICK_SKIPPED_STEPS.includes(step.name));
}

/** Paths whose change can break types outside one object package: `--typecheck` appends `pnpm typecheck` for them. */
export const SHARED_CODE=/^(?:tools|site|src\/platform|src\/renderers|packages)\//u;
export function sharedCodeChanged(paths:readonly string[]):boolean {return paths.some(path=>SHARED_CODE.test(path));}

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
 const flags=['--list','--quick','--typecheck'];
 if(args.some(arg=>!flags.includes(arg)&&!/^--job=[a-z][a-z0-9-]*$/.test(arg))||new Set(args.map(arg=>arg.split('=')[0])).size!==args.length)
  throw new Error('Usage: pnpm check:ci [--job=lint|typecheck|typecheck-tests|universe|nebula] [--quick] [--typecheck] [--list]');
 // Without --job, run every job the shared-universe checks need, in the order that fails fastest.
 const jobName=args.find(arg=>arg.startsWith('--job='))?.slice(6),jobNames=jobName?[jobName]:['lint','typecheck','typecheck-tests','universe'];
 const workflow=await readFile(resolve(root,'.github/workflows/universe.yml'),'utf8');
 let steps=jobNames.flatMap(jobName=>readCiSteps(workflow,jobName));
 if(args.includes('--quick'))steps=quickSteps(steps);
 if(args.includes('--typecheck')){
  const changed=[...execFileSync('git',['diff','--name-only','origin/main...HEAD'],{cwd:root,encoding:'utf8'}).split('\n'),
   ...execFileSync('git',['diff','--name-only','HEAD'],{cwd:root,encoding:'utf8'}).split('\n')].filter(Boolean);
  if(sharedCodeChanged(changed))steps.push({name:'Typecheck (shared code changed)',run:'pnpm typecheck',env:{NODE_OPTIONS:'--max-old-space-size=4096'}});
  else console.log('[ci] --typecheck: no shared code changed against origin/main; skipping pnpm typecheck.');
 }
 if(args.includes('--list')){
  console.log(steps.map((step,index)=>`${index+1}. ${step.name}\n${step.run.trim()}`).join('\n\n'));
 }else{
  // The workflow pins Node 22; the checkout's engines range is what contributors have.
  const major=Number(process.versions.node.split('.')[0]);
  if(major<22)throw new Error('Use Node 22.18+ or Node 24 (the CI runner uses Node 22).');
  if(major!==22)console.log(`NODE ${process.versions.node}: the CI runner uses Node 22; results may differ.`);
  if(args.includes('--quick'))console.log(`[ci] --quick skips: ${QUICK_SKIPPED_STEPS.join('; ')}.`);
  const temporary=await mkdtemp(join(tmpdir(),'cssearth-ci-'));
  try{await runCiSteps(steps,root,temporary);}finally{await rm(temporary,{recursive:true,force:true});}
 }
}
