import {readFile, mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve, join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {parse} from 'yaml';
import {requireArray, requireRecord, requireString} from './source-values.mts';
import {affectedJobNames, classifyAffectedPaths, HEAVY_JOBS, loadCiAreasConfig, localChangedPaths, needsProductionBuild} from './ci-affected.mts';
import {evaluateObjectScopeGate} from './object-scope-gate.mts';
import {selectRuntimeOwnershipArgs} from './scope-runtime-ownership-check.mts';

interface CiStep {name:string;run:string;env:Record<string,string>;}
/** The workflow's own token; a local run uses the contributor's `gh` login instead. */
const WORKFLOW_TOKEN='${{ github.token }}';
/** Expressions only a real GitHub run can evaluate (a cross-job `needs` output, computed from the PR's diff): a
 * local run has no such diff, so it substitutes the most thorough, always-correct value instead of failing. */
const LOCAL_EXPRESSION_SUBSTITUTIONS:Record<string,string>={
 '${{ needs.changes.outputs.runtime_ownership_args }}':'--all',
 '${{ steps.build-tools-cache.outputs.cache-hit }}':'false',
 '${{ steps.ci-cache-key.outputs.build_digest }}':'',
 '${{ steps.package-cache.outputs.cache-hit }}':'false',
 '${{ steps.ci-cache-key.outputs.package_digest }}':'',
 '${{ steps.renderer-cache.outputs.cache-hit }}':'false',
 '${{ steps.ci-cache-key.outputs.renderer_digest }}':'',
};
/** Step conditions that only mean something inside a GitHub run: skip the step when Contract lint failed, or cancel
 * the rest of the run after a failure. */
export const CI_ONLY_CONDITIONS=["needs.lint.result != 'success'",'failure()'];
/** A step guarded by `actions/cache`'s `cache-hit` output skips work CI already has cached from an earlier run. A
 * local run has no such cache to consult, so — like LOCAL_EXPRESSION_SUBSTITUTIONS below — it substitutes the
 * always-correct answer (never skip) instead of failing: the condition is stripped and the step always runs. */
const CACHE_HIT_CONDITION=/^steps\.[\w-]+\.outputs\.cache-hit(?:-\w+)? != 'true'$/u;
const MATRIX_LANE='${{ matrix.lane }}';
const SUPPORTED_MATRICES=[
 {aggregate:'universe',job:'universe-checks',laneEnv:'CI_UNIVERSE_LANE',output:'run_universe'},
 {aggregate:'universe-preparation',job:'universe-preparation-checks',laneEnv:'CI_PREPARATION_LANE',output:'run_universe_preparation'},
] as const;
type SupportedMatrix=typeof SUPPORTED_MATRICES[number];
const selectedMatrixCondition=(matrix:SupportedMatrix)=>`github.event_name != 'pull_request' || needs.changes.outputs.${matrix.output} == 'true'`;
/** These maintained aggregates are verdicts, not additional suites. Every local lane must finish successfully;
 * never substitute a synthetic success result for a GitHub dependency expression. */
function requireMatrixAggregate(job:Record<string,unknown>,matrix:SupportedMatrix):void {
 const needs=requireArray(job.needs).map(value=>requireString(value)).sort();
 const steps=requireArray(job.steps),step=steps.length===1?requireRecord(steps[0]):{};
 if(JSON.stringify(needs)!==JSON.stringify(['changes',matrix.job])||
    requireString(job.if).trim().replace(/\s+/gu,' ')!=='${{ always() && ('+selectedMatrixCondition(matrix)+') }}'||
    job.strategy!==undefined||job.env!==undefined||job['continue-on-error']!==undefined||
    step.if!==undefined||step.uses!==undefined||step.shell!==undefined||step['working-directory']!==undefined||step['continue-on-error']!==undefined||
    typeof step.run!=='string'||step.run.trim()!=='test "$RESULT" = success'||
    JSON.stringify(step.env)!==JSON.stringify({RESULT:'${{ needs.'+matrix.job+'.result }}'}))
  throw new Error('Local CI needs the explicit fail-closed maintained matrix aggregate.');
}
/** Execute the maintained job's commands, so local checks cannot drift from CI. */
export function readCiSteps(source:string,jobName='universe', substitutions:Record<string,string>={}):CiStep[] {
 const workflow=requireRecord(parse(source)),jobs=requireRecord(workflow.jobs);
 if(!Object.hasOwn(jobs,jobName))throw new Error(`Unknown CI job: ${jobName}`);
 const job=requireRecord(jobs[jobName]);
 const aggregate=SUPPORTED_MATRICES.find(matrix=>matrix.aggregate===jobName);
 if(aggregate&&Object.hasOwn(jobs,aggregate.job)){
  requireMatrixAggregate(job,aggregate);
  return readCiSteps(source,aggregate.job,substitutions);
 }
 const supported=SUPPORTED_MATRICES.find(matrix=>matrix.job===jobName);
 if(job.strategy!==undefined){
  const strategy=requireRecord(job.strategy),matrix=requireRecord(strategy.matrix);
  if(!supported||Object.keys(strategy).sort().join(',')!=='fail-fast,matrix'||strategy['fail-fast']!==false||
     Object.keys(matrix).join(',')!=='lane'||job['continue-on-error']!==undefined||
     job.needs!=='changes'||requireString(job.if).trim().replace(/\s+/gu,' ')!=='${{ '+selectedMatrixCondition(supported)+' }}'||
     requireRecord(job.env)[supported.laneEnv]!==MATRIX_LANE)
   throw new Error('Local CI supports only the explicit maintained lane matrices with fail-fast disabled.');
  const lanes=requireArray(matrix.lane).map(value=>requireString(value));
  if(!lanes.length||new Set(lanes).size!==lanes.length||lanes.some(lane=>!/^[a-z][a-z0-9-]*$/u.test(lane)))
   throw new Error('Local CI needs unique, nonempty literal matrix lanes.');
  return lanes.flatMap(lane=>{
   const steps=readJobSteps(workflow,job,{...substitutions,[MATRIX_LANE]:lane});
   if(!steps.length||steps.some(step=>step.env[supported.laneEnv]!==lane))
    throw new Error('Local CI needs executable commands for every matrix lane without lane overrides.');
   return steps.map(step=>({...step,name:`[${lane}] ${step.name}`}));
  });
 }
 if(supported)throw new Error('Local CI needs the maintained lane matrix, not a single replacement job.');
 return readJobSteps(workflow,job,substitutions);
}

function readJobSteps(workflow:Record<string,unknown>,job:Record<string,unknown>,substitutions:Record<string,string>):CiStep[] {
 const decodeEnvironment=(value:unknown)=>Object.fromEntries(Object.entries(value===undefined?{}:requireRecord(value))
   .map(([key,value])=>[key,requireString(value,`CI environment ${key}`)])
   .filter(([,value])=>value!==WORKFLOW_TOKEN)
   .map(([key,value])=>[key,substitutions[value]??LOCAL_EXPRESSION_SUBSTITUTIONS[value]??value]));
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
  const cacheGated=step.if!==undefined&&CACHE_HIT_CONDITION.test(String(step.if).trim());
  if((step.if!==undefined&&!cacheGated)||step['working-directory']!==undefined||step['continue-on-error']!==undefined||step.shell!==undefined)
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
// Matrix lanes share a checkout locally: a later no-DTS build may have cleaned declarations from an earlier
// typed build. Keep these prerequisites with their consumer so command deduplication cannot discard them.
export const SHARED_TYPECHECK_STEP:CiStep={
 name:'Typecheck (shared code changed)',
 run:'node tools/build-ci.mts full\npnpm prepare:typecheck\npnpm typecheck',
 env:{NODE_OPTIONS:'--max-old-space-size=4096',CI_PREPARATION_DTS:'true'},
};

/** CI jobs have separate disks; the local plan shares one checkout. Reuse only explicit common prerequisites,
 * never tests, audits, or a production build with a different environment. */
export function reuseLocalPreparation(steps:readonly CiStep[]):CiStep[] {
 const reusable=new Set(['pnpm install --frozen-lockfile --ignore-scripts','pnpm build:tools','node tools/build-ci.mts full','node tools/ci-cache-key.mts','pnpm prepare:typecheck']);
 const seen=new Set<string>();
 return steps.filter(step=>{
  if(!reusable.has(step.run.trim()))return true;
  const key=JSON.stringify([step.run.trim(),Object.entries(step.env).sort(([left],[right])=>left.localeCompare(right))]);
  if(seen.has(key))return false;
  seen.add(key);return true;
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
 const flags=['--list','--quick','--typecheck','--all','--pipeline-change'];
 if(args.some(arg=>!flags.includes(arg)&&!/^--job=[a-z][a-z0-9-]*$/.test(arg)&&!/^--base=.+$/.test(arg))||new Set(args.map(arg=>arg.split('=')[0])).size!==args.length)
  throw new Error('Usage: pnpm check:pr [--base=origin/main] [--all | --job=<id>] [--pipeline-change] [--quick] [--typecheck] [--list]');
 const jobName=args.find(arg=>arg.startsWith('--job='))?.slice(6),base=args.find(arg=>arg.startsWith('--base='))?.slice(7)??'origin/main';
 if(jobName&&args.includes('--all'))throw new Error('Choose --all or --job, not both.');
 if(args.includes('--quick')&&jobName!=='lint')throw new Error('--quick is an explicit lint subset: use --job=lint --quick.');
 const config=await loadCiAreasConfig(),changed=await localChangedPaths(base,root),affected=classifyAffectedPaths(changed,config);
 const jobNames=jobName?[jobName]:affectedJobNames(args.includes('--all')?{...affected,jobs:new Set(HEAVY_JOBS)}:affected);
 const production=!jobName&&(args.includes('--all')||needsProductionBuild(changed,config));
 console.log(`[ci plan] ${changed.length} changed paths against ${base} (including working tree); ${jobNames.join(', ')}${production?', production-build':''}.`);
 if(jobName)console.log(`[ci subset] Only ${jobName}; this is not a complete PR verdict (lint, scope and other selected jobs may be omitted).`);
 if(!jobName){
  const scope=evaluateObjectScopeGate(changed,args.includes('--pipeline-change')?[{name:'pipeline-change'}]:[]);
  if(!scope.ok)throw new Error(`Object-scope gate: ${scope.count} objects exceed ${scope.limit}; split the PR or use --pipeline-change with the matching PR label.`);
 }
 const workflow=await readFile(resolve(root,`.github/workflows/${jobName==='asset-origin-build'?'nightly':'universe'}.yml`),'utf8');
 const substitutions={'${{ needs.changes.outputs.runtime_ownership_args }}':args.includes('--all')?'--all':selectRuntimeOwnershipArgs(changed).join(' ')};
 let steps=jobNames.flatMap(jobName=>readCiSteps(workflow,jobName,substitutions));
 if(production)steps.push(...readCiSteps(await readFile(resolve(root,'.github/workflows/nightly.yml'),'utf8'),'asset-origin-build'));
 // Select the same PR documentation/publish diff locally, including uncommitted changes in the documentation audit.
 // Pass through env, never interpolate an arbitrary ref into shell source.
 steps=steps.map(step=>({...step,env:{...step.env,GITHUB_BASE_REF:base.startsWith('origin/')?base.slice(7):base,CI_BASE_REF:base,GITHUB_EVENT_NAME:'pull_request'}}));
 if(args.includes('--quick'))steps=quickSteps(steps);
 if(args.includes('--typecheck')){
  if(sharedCodeChanged(changed))steps.push(SHARED_TYPECHECK_STEP);
  else console.log('[ci] --typecheck: no shared code changed against origin/main; skipping pnpm typecheck.');
 }
 steps=reuseLocalPreparation(steps);
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
