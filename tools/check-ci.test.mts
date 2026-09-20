import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parse} from 'yaml';
import {execFileSync,spawnSync} from 'node:child_process';
import {requireArray,requireRecord,requireString} from './source-values.mts';
import {CI_ONLY_CONDITIONS,QUICK_SKIPPED_STEPS,SHARED_TYPECHECK_STEP,quickSteps,readCiSteps,reuseLocalPreparation,runCiSteps,sharedCodeChanged} from './check-ci.mts';

test('local CI reads the actual workflow jobs in order, including strict TypeScript and renderer gates',async()=>{
 const workflow=await readFile(new URL('../.github/workflows/universe.yml',import.meta.url),'utf8');
 const lint=readCiSteps(workflow,'lint'),typecheck=readCiSteps(workflow,'typecheck'),universe=readCiSteps(workflow);
 assert.equal(lint[0]?.name,'Check documentation links and organization');
 assert.ok(lint.some(step=>step.run.includes('check-object-runtime-ownership.mts --receipts')));
 const gate=lint.find(step=>step.run.includes('check:assets-published'));
 assert.equal(gate?.env.GH_TOKEN,undefined,'the workflow token is dropped locally');
 assert.match(gate?.run??'',/--added-since-last-green --report-only/,'a push to main never fails on assets');
 assert.ok(typecheck.some(step=>step.run.includes('pnpm typecheck:pr')&&step.env.NODE_OPTIONS==='--max-old-space-size=4096'));
 assert.ok(!typecheck.some(step=>step.run.includes('typecheck:tests')),'PRs skip the test-file typecheck');
 assert.equal(readCiSteps(workflow,'typecheck-tests').at(-1)?.run.trim(),'pnpm typecheck:tests --extendedDiagnostics');
 assert.ok(universe.some(step=>step.run.includes('prepare-ci-inputs.mts universe')));
 assert.deepEqual([...new Set(universe.map(step=>step.env.CI_UNIVERSE_LANE))],['sources','runtime','shell','renderer']);
 for(const lane of ['sources','runtime','shell','renderer']){
  const last=universe.filter(step=>step.env.CI_UNIVERSE_LANE===lane).at(-1);
  assert.match(last?.run??'',/pnpm "test:universe:\$CI_UNIVERSE_LANE"/);
  assert.match(last?.run??'',/pnpm test:sources:pr/);
 }
 const universePreparation=readCiSteps(workflow,'universe-preparation');
 assert.deepEqual([...new Set(universePreparation.map(step=>step.env.CI_PREPARATION_LANE))],['publication','world']);
 assert.ok(universePreparation.some(step=>step.run.includes('pnpm test:galaxy-field')));
 assert.ok(universePreparation.some(step=>step.run.includes('pnpm test:ci-preparation')));
 // A local run has no PR diff to scope the ownership check to, so it substitutes the always-correct --all rather
 // than failing on an expression only a real GitHub run (the `changes` job's output) can evaluate.
 const ownership=universe.find(step=>step.env.RUNTIME_OWNERSHIP_ARGS!==undefined);
 assert.equal(ownership?.env.RUNTIME_OWNERSHIP_ARGS,'--all');
});
test('the deploy consumes installed assets, rebuilds only catalogues and rejects uninventoried output',async()=>{
 const workflow=await readFile(new URL('../.github/workflows/deploy.yml',import.meta.url),'utf8');
 const packageFile=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')) as {scripts:Record<string,string>};
 assert.match(workflow,/pnpm build:deploy/);
 assert.match(workflow,/pnpm check:deploy-assets/);
 assert.match(workflow,/git diff --quiet -- src\/objects/);
 assert.doesNotMatch(workflow,/ASSET_ORIGIN=https:\/\/earth-assets\.lowpoly\.cc pnpm build(?:\s|$)/);
 assert.match(packageFile.scripts['prepare:deploy']??'',/node tools\/nebula\/prepare\.mts --if-missing/);
 assert.doesNotMatch(packageFile.scripts['prepare:deploy']??'',/pnpm prepare:galaxy-field:data/);
 assert.match(packageFile.scripts['prepare:deploy']??'',/pnpm prepare:deploy-catalogues/);
 assert.equal(packageFile.scripts['prepare:deploy-catalogues'],'node tools/prepare-facilities.mts --catalog-only');
 assert.match(packageFile.scripts['setup:assets']??'',/pnpm setup:asset-data/);
 assert.match(packageFile.scripts['setup:asset-data']??'',/node tools\/setup-volume-metadata\.mts/);
 assert.doesNotMatch(packageFile.scripts['prepare:deploy']??'',/prepare:(?:facilities|provenance|nebulae)(?:\s|$)/);
});
test('the PR asset-origin check exercises the exact deploy build path',async()=>{
 const workflow=await readFile(new URL('../.github/workflows/nightly.yml',import.meta.url),'utf8');
 const steps=readCiSteps(workflow,'asset-origin-build');
 const build=steps.find(step=>step.name==='Build the site with the production asset origin and reject metadata drift');
 assert.equal(build?.env.ASSET_ORIGIN,'https://earth-assets.lowpoly.cc');
 assert.equal(build?.run.trim(),'pnpm build:deploy\npnpm check:deploy-assets');
});
test('--quick skips only the network and documentation steps, and refuses a job without them',async()=>{
 const lint=readCiSteps(await readFile(new URL('../.github/workflows/universe.yml',import.meta.url),'utf8'),'lint');
 const quick=quickSteps(lint);
 assert.deepEqual(lint.filter(step=>!quick.includes(step)).map(step=>step.name),QUICK_SKIPPED_STEPS);
 assert.throws(()=>quickSteps(lint.filter(step=>step.name!==QUICK_SKIPPED_STEPS[1])),/--quick expects a step/);
});
test('--typecheck appends the typecheck only when shared code changed',()=>{
 assert.equal(sharedCodeChanged(['src/objects/ceres/README.md','docs/README.md']),false);
 for(const path of ['tools/check-ci.mts','site/objects.mts','src/platform/a.mts','src/renderers/css/b.ts','packages/astronomy/c.ts'])
  assert.equal(sharedCodeChanged([path]),true,path);
});
test('appended --typecheck restores declarations and prepared inputs after a no-DTS lane, despite local reuse',async()=>{
 const root=await mkdtemp(join(tmpdir(),'ci-typecheck-order-'));
 const fixtures=`
node() {
 test "$*" = 'tools/build-ci.mts full'
 printf '%s' "$CI_PREPARATION_DTS" > "$RUNNER_TEMP/declarations"
}
pnpm() {
 case "$*" in
  prepare:typecheck) printf prepared > "$RUNNER_TEMP/inputs" ;;
  typecheck) test "$(cat "$RUNNER_TEMP/declarations")" = true; test "$(cat "$RUNNER_TEMP/inputs")" = prepared; printf checked > "$RUNNER_TEMP/checked" ;;
  *) return 1 ;;
 esac
}
`;
 try{
  const typed={name:'earlier typed build',run:'node tools/build-ci.mts full',env:{CI_PREPARATION_DTS:'true'}};
  const untyped={name:'later no-DTS lane',run:'node tools/build-ci.mts full',env:{CI_PREPARATION_DTS:'false'}};
  const plan=reuseLocalPreparation([typed,untyped,SHARED_TYPECHECK_STEP]);
  assert.equal(plan.at(-1),SHARED_TYPECHECK_STEP,'The appended typed prerequisite cannot be removed by local reuse.');
  await runCiSteps(plan.map(step=>({...step,run:fixtures+step.run})),root,root);
  assert.equal(await readFile(join(root,'checked'),'utf8'),'checked');
  assert.deepEqual(SHARED_TYPECHECK_STEP.run.split('\n'),['node tools/build-ci.mts full','pnpm prepare:typecheck','pnpm typecheck']);
  assert.equal(SHARED_TYPECHECK_STEP.env.CI_PREPARATION_DTS,'true');
  // Removing the declaration rebuild reproduces the real failure even if prepared inputs still exist.
  const mutated={...SHARED_TYPECHECK_STEP,run:SHARED_TYPECHECK_STEP.run.replace('node tools/build-ci.mts full\n','')};
  await assert.rejects(runCiSteps([untyped,mutated].map(step=>({...step,run:fixtures+step.run})),root,root),/Typecheck \(shared code changed\) failed/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('only the workflow token expression is dropped; any other expression still refuses a local run',()=>{
 const step=(value:string)=>`jobs:\n  universe:\n    steps:\n      - name: t\n        env:\n          VALUE: ${value}\n        run: echo t\n`;
 assert.deepEqual(readCiSteps(step("${{ github.token }}")),[{name:'t',run:'echo t',env:{}}]);
 assert.throws(()=>readCiSteps(step("${{ secrets.OTHER }}")),/cannot evaluate GitHub expressions/);
});
test('local CI passes the step environment and stops on failure without executing later steps',async()=>{
 const root=await mkdtemp(join(tmpdir(),'ci-runner-test-'));
 try{
  await assert.rejects(runCiSteps([
   {name:'environment',run:'printf "%s" "$CHECK_CI_FIXTURE" > "$RUNNER_TEMP/proof"',env:{CHECK_CI_FIXTURE:'observed'}},
   {name:'failure',run:'false | true',env:{}},
   {name:'must not run',run:'touch late',env:{}},
  ],root,root),/failure failed/);
  assert.equal(await readFile(join(root,'proof'),'utf8'),'observed');
  await assert.rejects(readFile(join(root,'late')),{code:'ENOENT'});
 }finally{await rm(root,{recursive:true,force:true});}
});
test('unsupported GitHub execution policies cannot silently produce a local pass',()=>{
 for(const policy of ['if: false','continue-on-error: true','working-directory: elsewhere','uses: unsupported/action@v1']){
  const step=policy.startsWith('uses:')?`      - ${policy}`:`      - name: test\n        run: true\n        ${policy}`;
  assert.throws(()=>readCiSteps(`jobs:\n  universe:\n    steps:\n${step}\n`));
 }
});
test('a selected job uses its own steps and inherited environment',()=>{
 const workflow='env:\n  SHARED: shared\njobs:\n  universe:\n    steps:\n      - name: main\n        run: echo main\n  nebula:\n    env:\n      SUBJECT: cloud\n    steps:\n      - name: lab\n        run: echo lab\n';
 assert.deepEqual(readCiSteps(workflow,'nebula'),[{name:'lab',run:'echo lab',env:{SHARED:'shared',SUBJECT:'cloud'}}]);
 assert.throws(()=>readCiSteps(workflow,'absent'),/Unknown CI job/);
});

const matrixCases=[
 {aggregate:'universe',job:'universe-checks',laneEnv:'CI_UNIVERSE_LANE',output:'run_universe',lanes:['sources','runtime','shell','renderer']},
 {aggregate:'universe-preparation',job:'universe-preparation-checks',laneEnv:'CI_PREPARATION_LANE',output:'run_universe_preparation',lanes:['publication','world']},
];
const matrixWorkflow=(run?:string,configuration=matrixCases[0]!)=>({
 env:{SHARED:'workflow'},jobs:{
  [configuration.job]:{
   needs:'changes',
   if:"${{ github.event_name != 'pull_request' || needs.changes.outputs."+configuration.output+" == 'true' }}",
   strategy:{'fail-fast':false,matrix:{lane:configuration.lanes}},
   env:{[configuration.laneEnv]:'${{ matrix.lane }}',INHERITED:'job'},
   steps:[{name:'lane checks',run:run??`printf "%s\\n" "$${configuration.laneEnv}" >> "$RUNNER_TEMP/lanes"`,env:{STEP:'step'}}],
  },
  [configuration.aggregate]:{
   needs:['changes',configuration.job],
   if:"${{ always() && (github.event_name != 'pull_request' || needs.changes.outputs."+configuration.output+" == 'true') }}",
   steps:[{name:'Require every lane',env:{RESULT:'${{ needs.'+configuration.job+'.result }}'},run:'test "$RESULT" = success'}],
  },
 },
});

test('native matrix lanes expand completely and execute with their own inherited environment',async()=>{
 for(const configuration of matrixCases){
 const fixture=matrixWorkflow(undefined,configuration),steps=readCiSteps(JSON.stringify(fixture),configuration.aggregate);
 const lanes=configuration.lanes;
 assert.deepEqual(steps.map(step=>step.env[configuration.laneEnv]),lanes);
 assert.deepEqual(steps.map(step=>step.name),lanes.map(lane=>`[${lane}] lane checks`));
 for(const [index,step] of steps.entries())assert.deepEqual(step.env,{
  SHARED:'workflow',[configuration.laneEnv]:lanes[index],INHERITED:'job',STEP:'step',
 });
 assert.deepEqual(steps,readCiSteps(JSON.stringify(fixture),configuration.job));
 assert.ok(steps.every(step=>step.env.RESULT===undefined),'A local verdict never fabricates a successful dependency result.');
 const root=await mkdtemp(join(tmpdir(),'ci-matrix-test-'));
 try{
  await runCiSteps(steps,root,root);
  assert.equal(await readFile(join(root,'lanes'),'utf8'),lanes.join('\n')+'\n');
 }finally{await rm(root,{recursive:true,force:true});}
 }
});

test('the maintained aggregate command accepts success only, never failed, cancelled or skipped matrix children',async()=>{
 const workflow=requireRecord(parse(await readFile(new URL('../.github/workflows/universe.yml',import.meta.url),'utf8')));
 // readCiSteps validates the dependency, condition, result binding and exact fail-closed command first.
 for(const configuration of matrixCases){
 readCiSteps(JSON.stringify(workflow),configuration.aggregate);
 const aggregate=requireRecord(requireRecord(workflow.jobs)[configuration.aggregate]),step=requireRecord(requireArray(aggregate.steps)[0]);
 for(const result of ['success','failure','cancelled','skipped','']){
  const executed=spawnSync('bash',['--noprofile','--norc','-e','-o','pipefail','-c',requireString(step.run)],{
   env:{...process.env,RESULT:result},encoding:'utf8',
  });
  assert.equal(executed.status,result==='success'?0:1,result);
 }
 }
});

test('the actual workflow dispatches every native lane command locally and retains main authoring',async()=>{
 const workflow=await readFile(new URL('../.github/workflows/universe.yml',import.meta.url),'utf8');
 const expanded=readCiSteps(workflow),lanes=['sources','runtime','shell','renderer'];
 const commands=lanes.map(lane=>{
  const step=expanded.filter(step=>step.env.CI_UNIVERSE_LANE===lane).at(-1);
  assert.ok(step,`${lane}: local commands must exist`);
  return {...step,env:{...step.env,GITHUB_EVENT_NAME:'pull_request'},run:[
   'pnpm() { printf "pnpm %s\\n" "$*" >> "$RUNNER_TEMP/dispatch"; }',
   'node() { printf "node %s\\n" "$*" >> "$RUNNER_TEMP/dispatch"; }',step.run,
  ].join('\n')};
 });
 const root=await mkdtemp(join(tmpdir(),'ci-real-matrix-'));
 try{
  await runCiSteps(commands,root,root);
  assert.equal(await readFile(join(root,'dispatch'),'utf8'),[
   'pnpm test:sources:pr',
   ...['runtime','shell','renderer'].flatMap(lane=>['node tools/prepare-facilities.mts --catalog-only',`pnpm test:universe:${lane}`]),'',
  ].join('\n'));
  const source=commands[0]!;
  await runCiSteps([{...source,env:{...source.env,GITHUB_EVENT_NAME:'push'}}],root,root);
  assert.ok((await readFile(join(root,'dispatch'),'utf8')).endsWith('pnpm test:sources\n'));
 }finally{await rm(root,{recursive:true,force:true});}
});

test('preparation dispatch keeps the browser with publication and the galaxy writer before world checks',async()=>{
 const workflow=await readFile(new URL('../.github/workflows/universe.yml',import.meta.url),'utf8');
 const expanded=readCiSteps(workflow,'universe-preparation');
 const commands=['publication','world'].map(lane=>{
  const step=expanded.filter(step=>step.env.CI_PREPARATION_LANE===lane).at(-1);
  assert.ok(step,`${lane}: preparation commands must exist`);
  return {...step,run:'pnpm() { printf "%s %s\\n" "$CI_PREPARATION_LANE" "$*" >> "$RUNNER_TEMP/dispatch"; }\n'+step.run};
 });
 const root=await mkdtemp(join(tmpdir(),'ci-preparation-matrix-'));
 try{
  await runCiSteps(commands,root,root);
  assert.equal(await readFile(join(root,'dispatch'),'utf8'),[
   'publication exec playwright install --with-deps --only-shell chromium',
   'publication test:ci-preparation:publication',
   'world test:galaxy-field','world test:ci-preparation:world','',
  ].join('\n'));
 }finally{await rm(root,{recursive:true,force:true});}
});

test('a failing or cancelled local matrix lane cannot execute later lanes or report a successful aggregate',async()=>{
 for(const configuration of matrixCases)for(const stop of ['exit 1','kill -TERM $$']){
  const root=await mkdtemp(join(tmpdir(),'ci-matrix-stop-'));
  const fixture=matrixWorkflow(`if [ "$${configuration.laneEnv}" = ${configuration.lanes[1]} ]; then ${stop}; fi\nprintf "%s\\n" "$${configuration.laneEnv}" >> "$RUNNER_TEMP/lanes"`,configuration);
  try{
   await assert.rejects(runCiSteps(readCiSteps(JSON.stringify(fixture),configuration.aggregate),root,root),/lane checks failed/);
   assert.equal(await readFile(join(root,'lanes'),'utf8'),configuration.lanes[0]+'\n');
  }finally{await rm(root,{recursive:true,force:true});}
 }
});

test('unsupported matrix shapes and expressions cannot silently omit lanes',()=>{
 const invalid:((job:Record<string,unknown>)=>void)[]=[
  job=>{job.strategy={matrix:{lane:['sources']}};},
  job=>{job.strategy={'fail-fast':true,matrix:{lane:['sources']}};},
  job=>{job.strategy={'fail-fast':false,matrix:{lane:[]}};},
  job=>{job.strategy={'fail-fast':false,matrix:{lane:['sources','sources']}};},
  job=>{job.strategy={'fail-fast':false,matrix:{lane:['${{ inputs.lane }}']}};},
  job=>{job.strategy={'fail-fast':false,matrix:{lane:['sources'],include:[{lane:'renderer'}]}};},
  job=>{job.strategy={'fail-fast':false,matrix:{lane:['sources'],exclude:[{lane:'sources'}]}};},
  job=>{job.strategy={'fail-fast':false,matrix:{lane:['sources'],node:['22']}};},
  job=>{job['continue-on-error']=true;},
  job=>{job.if='${{ inputs.run_checks }}';},
  job=>{job.needs=['changes','unknown-writer'];},
  job=>{job.env={CI_UNIVERSE_LANE:'${{ matrix.unknown }}'};},
  job=>{job.steps=[{name:'unknown expression',run:'echo ${{ matrix.unknown }}'}];},
  job=>{
   const lane=Object.keys(requireRecord(job.env)).find(key=>key.endsWith('_LANE'));assert.ok(lane);
   job.steps=[{name:'constant lane',run:'true',env:{[lane]:'sources'}}];
  },
  job=>{job.steps=[];},
  job=>{job.steps=[{uses:'actions/checkout@v4'}];},
  job=>{delete job.strategy;},
 ];
 for(const configuration of matrixCases)for(const mutate of invalid){
  const fixture=matrixWorkflow(undefined,configuration);mutate(requireRecord(fixture.jobs[configuration.job]));
  assert.throws(()=>readCiSteps(JSON.stringify(fixture),configuration.aggregate));
 }
});

test('aggregate recognition fails closed when its dependency or success-only guarantee is removed',()=>{
 const invalid:((job:Record<string,unknown>)=>void)[]=[
  job=>{job.needs=['changes'];},
  job=>{job.if="${{ always() }}";},
  job=>{job['continue-on-error']=true;},
  job=>{job.steps=[{name:'always green',run:'true'}];},
  job=>{job.steps=[{name:'ignores cancellations',env:{RESULT:'${{ needs.universe-checks.result }}'},run:'test "$RESULT" != failure'}];},
  job=>{job.steps=[{name:'constant result',env:{RESULT:'success'},run:'test "$RESULT" = success'}];},
  job=>{job.steps=[{name:'ignored failure',env:{RESULT:'${{ needs.universe-checks.result }}'},run:'test "$RESULT" = success','continue-on-error':true}];},
 ];
 for(const configuration of matrixCases)for(const mutate of invalid){
  const fixture=matrixWorkflow(undefined,configuration);mutate(requireRecord(fixture.jobs[configuration.aggregate]));
  assert.throws(()=>readCiSteps(JSON.stringify(fixture),configuration.aggregate));
 }
});

test('the lint prerequisite and run-cancel steps are CI-only; any other condition still refuses a local run',async()=>{
 const workflow=await readFile(new URL('../.github/workflows/universe.yml',import.meta.url),'utf8');
 for(const job of ['typecheck','typecheck-tests','universe','universe-preparation','nebula']){
  const names=readCiSteps(workflow,job).map(step=>step.name);
  assert.ok(!names.includes('Stop when Contract lint did not pass')&&!names.includes('Cancel the rest of the run'),job);
 }
 const step=(condition:string)=>`jobs:\n  universe:\n    steps:\n      - name: t\n        if: ${condition}\n        run: echo t\n`;
 for(const condition of CI_ONLY_CONDITIONS)assert.deepEqual(readCiSteps(step(`"${condition}"`)),[]);
 assert.throws(()=>readCiSteps(step('success()')),/explicit support/);
});
test('a cache-hit-gated step always runs locally instead of being skipped',()=>{
 const workflow="jobs:\n  universe:\n    steps:\n      - name: generate\n        if: steps.build-tools-cache.outputs.cache-hit != 'true'\n        run: echo generate\n";
 assert.deepEqual(readCiSteps(workflow),[{name:'generate',run:'echo generate',env:{}}]);
 // Mutation check: a condition that merely looks similar (a different outputs path) must still refuse, so this
 // allowance cannot silently swallow an unrelated `if:`.
 const other="jobs:\n  universe:\n    steps:\n      - name: t\n        if: steps.x.outputs.something != 'true'\n        run: echo t\n";
 assert.throws(()=>readCiSteps(other),/explicit support/);
});

test('required lanes depend only on required classification; lint cannot manufacture downstream failures',async()=>{
 const workflow=requireRecord(parse(await readFile(new URL('../.github/workflows/universe.yml',import.meta.url),'utf8')));
 const jobs=requireRecord(workflow.jobs);
 const expectedNames={changes:'Classify changes',lint:'Contract lint',typecheck:'Typecheck',universe:'Prepared universe and shared renderer','universe-preparation':'Prepared universe preparation and galaxy field',nebula:'Internal nebula packages and isolated controls'};
 for(const [id,name] of Object.entries(expectedNames))assert.equal(requireRecord(jobs[id]).name,name,'preserve the live required check context');
 for(const id of ['typecheck','typecheck-tests','universe-checks','universe-preparation-checks','nebula']){
  const job=requireRecord(jobs[id]);
  assert.equal(job.needs,'changes',id);
  assert.match(requireString(job.if),/^\$\{\{ github\.event_name != 'pull_request' \|\| needs\.changes\.outputs\.run_[a-z_]+ == 'true' \}\}$/);
  assert.ok(requireArray(job.steps).every(value=>!JSON.stringify(value).includes('needs.lint')),id);
 }
 for(const configuration of matrixCases){
  assert.deepEqual(requireRecord(jobs[configuration.aggregate]).needs,['changes',configuration.job]);
  assert.equal(requireRecord(requireRecord(jobs[configuration.job]).strategy)['fail-fast'],false);
 }
});

test('parallel compiler lanes cannot reserve or restore one another\'s incomplete cache',async()=>{
 const workflow=requireRecord(parse(await readFile(new URL('../.github/workflows/universe.yml',import.meta.url),'utf8')));
 const jobs=requireRecord(workflow.jobs);
 const namespaces=['tsbuildinfo-app-','tsbuildinfo-tests-'];
 for(const [index,id] of ['typecheck','typecheck-tests'].entries()){
  const steps=requireArray(requireRecord(jobs[id]).steps).map(value=>requireRecord(value));
  const caches=steps.filter(step=>step.with!==undefined&&requireRecord(step.with).path==='output/tsbuildinfo');
  assert.equal(caches.length,1,id);
  const options=requireRecord(caches[0]!.with);
  const key=requireString(options.key),prefix=namespaces[index]!;
  assert.ok(key.startsWith(prefix),id);
  const restores=requireString(options['restore-keys']).trim().split('\n');
  assert.equal(restores.length,2,id);
  for(const restore of restores)assert.ok(restore.startsWith(prefix),`${id}: ${restore}`);
  assert.ok(restores.every(restore=>restore.includes('steps.ci-cache-key.outputs.tsconfig_digest')));
  assert.doesNotMatch(key,/hashFiles/,'compiler keys must not scan installed dependency trees');
 }
});

test('local preparation is reused only for identical prerequisites, never tests or a changed environment',()=>{
 const build={name:'build',run:'pnpm build:tools',env:{}},testStep={name:'test',run:'pnpm test:renderer',env:{}};
 const production={...build,env:{ASSET_ORIGIN:'https://example.invalid'}};
 assert.deepEqual(reuseLocalPreparation([build,testStep,build,testStep,production]),[build,testStep,testStep,production]);
});

test('an explicit single-job invocation cannot present itself as a full PR verdict',()=>{
 const output=execFileSync(process.execPath,[new URL('./check-ci.mts',import.meta.url).pathname,'--job=lint','--base=HEAD','--list'],{encoding:'utf8'});
 assert.match(output,/\[ci subset\] Only lint; this is not a complete PR verdict/);
});

test('compiler jobs and preparation tests cannot restore the global texture bank through a cache or script',async()=>{
 const source=await readFile(new URL('../.github/workflows/universe.yml',import.meta.url),'utf8');
 const jobs=requireRecord(requireRecord(parse(source)).jobs);
 for(const id of ['typecheck','typecheck-tests','universe-preparation']){
  const job=requireRecord(jobs[id==='universe-preparation'?'universe-preparation-checks':id]);
  assert.doesNotMatch(JSON.stringify(job),/prepared-assets-v1|public\/scenes/,'even cache transfers must stay scoped');
  const runs=readCiSteps(source,id).map(step=>step.run).join('\n');
  assert.doesNotMatch(runs,/pnpm setup:assets|pnpm prepare:object-json|restore-object-json/);
  assert.match(runs,id==='universe-preparation'?/prepare-ci-inputs\.mts universe-preparation/:/pnpm prepare:typecheck/);
 }
});

test('shared preparation expands to each expensive task once, in dependency order',async()=>{
 const data=requireRecord(JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'))),scripts=requireRecord(data.scripts);
 const expand=(name:string,stack:string[]=[]):string[]=>{
  assert.ok(!stack.includes(name),'script dependency cycle');
  return requireString(scripts[name]).split(' && ').flatMap(command=>{
   const child=/^pnpm ([\w:-]+)$/.exec(command)?.[1];
   return child&&scripts[child]!==undefined?expand(child,[...stack,name]):[command];
  });
 };
 for(const name of ['build:tools','prepare:deploy']){
  const commands=expand(name);
  for(const task of ['node tools/prepare-catalog.mts','node tools/prepare-shell-titles.mts','node tools/prepare-overview-titles.mts'])
   assert.equal(commands.filter(command=>command===task).length,1,`${name}: ${task}`);
  const world=commands.findIndex(command=>command.includes('prepare-spatial-context.js'));
  const overview=commands.indexOf('node tools/prepare-overview-titles.mts');
  assert.ok(world>=0&&world<overview,'world context must exist before overview titles');
 }
 for(const filename of ['nightly.yml','deploy.yml']){
  const source=await readFile(new URL(`../.github/workflows/${filename}`,import.meta.url),'utf8');
  assert.doesNotMatch(source,/run: pnpm install --frozen-lockfile\s*\n/,'postinstall would build tools a second time');
  assert.doesNotMatch(source,/run: pnpm setup:assets/,'build:deploy owns asset restoration');
 }
});
