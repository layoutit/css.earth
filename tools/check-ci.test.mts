import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {CI_ONLY_CONDITIONS,QUICK_SKIPPED_STEPS,quickSteps,readCiSteps,runCiSteps,sharedCodeChanged} from './check-ci.mts';

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
 assert.ok(readCiSteps(workflow,'typecheck-tests').some(step=>step.run.trim()==='pnpm typecheck:tests'));
 assert.ok(universe.length>10);
 assert.equal(universe.at(-1)?.run.trim(),'pnpm test:renderer');
 const universePreparation=readCiSteps(workflow,'universe-preparation');
 assert.ok(universePreparation.some(step=>step.run.includes('pnpm test:galaxy-field')));
 assert.ok(universePreparation.some(step=>step.run.includes('pnpm test:preparation --universe')));
 // A local run has no PR diff to scope the ownership check to, so it substitutes the always-correct --all rather
 // than failing on an expression only a real GitHub run (the `changes` job's output) can evaluate.
 const ownership=universe.find(step=>step.name.includes('runtime ownership'));
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
 assert.match(packageFile.scripts['setup:assets']??'',/node tools\/setup-volume-metadata\.mts/);
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
