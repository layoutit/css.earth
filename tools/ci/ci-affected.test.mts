import assert from 'node:assert/strict';
import test from 'node:test';
import {execFileSync,spawnSync} from 'node:child_process';
import {access,copyFile,mkdir,mkdtemp,readFile,writeFile,rename,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {
  affectedJobNames, classifyAffectedChanges, classifyAffectedPaths, loadCiAreasConfig, localChangedPaths, needsProductionBuild, parseCiAreasConfig, patternToRegExp,
} from './ci-affected.mts';
import type { CiAreasConfig } from './ci-affected.mts';

const CONFIG: CiAreasConfig = {
  shared: ['package.json', 'tools/prepare/prepare-catalog.mts', 'tools/objects/**'],
  areas: [
    { id: 'object', patterns: ['src/objects/*/**'], jobs: [] },
    { id: 'renderer', patterns: ['src/renderers/**'], jobs: ['typecheck', 'universe'] },
    { id: 'site', patterns: ['site/**'], jobs: ['typecheck', 'universe'] },
    { id: 'tooling', patterns: ['tools/**', 'packages/**', 'labs/nebula/**'], jobs: ['typecheck', 'nebula'] },
    { id: 'docs', patterns: ['**/*.md', 'docs/**', 'LICENSE*'], jobs: [] },
  ],
};

test('patternToRegExp: ** matches any depth, * matches within one segment', () => {
  assert.equal(patternToRegExp('tools/**').test('tools/a.mts'), true);
  assert.equal(patternToRegExp('tools/**').test('tools/nested/deep/a.mts'), true);
  assert.equal(patternToRegExp('tools/**').test('other/a.mts'), false);
  assert.equal(patternToRegExp('src/objects/*/**').test('src/objects/earth/README.md'), true);
  assert.equal(patternToRegExp('src/objects/*/**').test('src/objects/earth/source/x.png'), true);
  assert.equal(patternToRegExp('src/objects/*/**').test('src/objects/earth'), false);
  assert.equal(patternToRegExp('**/*.md').test('README.md'), true);
  assert.equal(patternToRegExp('**/*.md').test('docs/deep/guide.md'), true);
  assert.equal(patternToRegExp('**/*.md').test('README.mdx'), false);
  assert.equal(patternToRegExp('LICENSE*').test('LICENSE'), true);
  assert.equal(patternToRegExp('LICENSE*').test('LICENSE.md'), true);
  assert.equal(patternToRegExp('LICENSE*').test('docs/LICENSE.md'), false);
  assert.equal(patternToRegExp('tsconfig*.json').test('tsconfig.tests.json'), true);
});

test('classifyAffectedPaths: an object-only change needs no heavy job', () => {
  const result = classifyAffectedPaths(['src/objects/earth/README.md', 'src/objects/earth/source/a.png'], CONFIG);
  assert.equal(result.shared, false);
  assert.deepEqual(result.areaIds, ['object']);
  assert.deepEqual([...result.jobs], []);
});

test('classifyAffectedPaths: a renderer-only change needs typecheck and universe, not nebula or preparation', () => {
  const result = classifyAffectedPaths(['src/renderers/css/dist-src/thing.ts'], CONFIG);
  assert.equal(result.shared, false);
  assert.deepEqual(result.areaIds, ['renderer']);
  assert.deepEqual([...result.jobs].sort(), ['typecheck', 'universe']);
});

test('classifyAffectedPaths: mixing object and renderer paths unions their jobs', () => {
  const result = classifyAffectedPaths(['src/objects/mars/README.md', 'src/renderers/css/camera.ts'], CONFIG);
  assert.deepEqual(result.areaIds, ['object', 'renderer']);
  assert.deepEqual([...result.jobs].sort(), ['typecheck', 'universe']);
});

test('classifyAffectedPaths: a tooling-only change needs typecheck and nebula, not universe or preparation', () => {
  const result = classifyAffectedPaths(['tools/fits/fits.mts', 'packages/astronomy/src/a.ts'], CONFIG);
  assert.deepEqual([...result.areaIds].sort(), ['tooling']);
  assert.deepEqual([...result.jobs].sort(), ['nebula', 'typecheck']);
});

test('classifyAffectedPaths: a docs-only change needs no heavy job', () => {
  const result = classifyAffectedPaths(['README.md', 'docs/guide.md'], CONFIG);
  assert.deepEqual(result.areaIds, ['docs']);
  assert.deepEqual([...result.jobs], []);
});

test('classifyAffectedPaths: a shared path forces every heavy job even alongside an object path', () => {
  // Mutation check: one shared file among many otherwise-narrow paths must flip the whole verdict, not just be
  // counted alongside it — the same shape as classify-changes.mts's docs-only mutation check.
  const result = classifyAffectedPaths(['src/objects/earth/README.md', 'package.json'], CONFIG);
  assert.equal(result.shared, true);
  assert.deepEqual([...result.jobs].sort(), ['nebula', 'typecheck', 'universe', 'universePreparation']);
});

test('classifyAffectedPaths: preparation pipeline core under tools/objects/ is shared, not tooling', () => {
  const result = classifyAffectedPaths(['tools/objects/terrestrial-layers/operations.mts'], CONFIG);
  assert.equal(result.shared, true);
});

test('classifyAffectedPaths: a path matching no area is treated as shared ("unsure means shared")', () => {
  const result = classifyAffectedPaths(['netlify/functions/search.ts'], CONFIG);
  assert.equal(result.shared, true);
  assert.deepEqual([...result.jobs].sort(), ['nebula', 'typecheck', 'universe', 'universePreparation']);
});

test('classifyAffectedPaths: an empty diff is shared, never a reason to skip', () => {
  const result = classifyAffectedPaths([], CONFIG);
  assert.equal(result.shared, true);
  assert.deepEqual([...result.jobs].sort(), ['nebula', 'typecheck', 'universe', 'universePreparation']);
});

test('classifyAffectedChanges: an unresolved push base is treated as shared', async () => {
  const result = await classifyAffectedChanges('push', '0000000000000000000000000000000000000000', {
    changedPaths: async () => undefined,
    config: async () => CONFIG,
  });
  assert.equal(result.shared, true);
});

test('classifyAffectedChanges: computes paths and config through the injected collaborators', async () => {
  const result = await classifyAffectedChanges('pr', 'origin/main', {
    changedPaths: async () => ['src/objects/venus/README.md'],
    config: async () => CONFIG,
  });
  assert.deepEqual(result.areaIds, ['object']);
  assert.deepEqual([...result.jobs], []);
});

test('parseCiAreasConfig: rejects an area that names an unrecognized job', () => {
  assert.throws(() => parseCiAreasConfig({
    shared: [], areas: [{ id: 'bad', patterns: ['x/**'], jobs: ['not-a-job'] }],
  }), /not a recognized job/);
});

test('parseCiAreasConfig: rejects a config missing required fields', () => {
  assert.throws(() => parseCiAreasConfig({ shared: [] }));
  assert.throws(() => parseCiAreasConfig({ areas: [] }));
  assert.throws(() => parseCiAreasConfig(null));
});

test('the checked-in .github/ci-areas.json parses and classifies as documented', async () => {
  const config = await loadCiAreasConfig();
  assert.ok(config.areas.length >= 5, 'expected at least the object, renderer, site, tooling and docs areas');
  const object = classifyAffectedPaths(['src/objects/pluto/README.md'], config);
  assert.equal(object.shared, false);
  assert.deepEqual([...object.jobs], []);
  const renderer = classifyAffectedPaths(['src/renderers/css/navigation/camera.ts'], config);
  assert.deepEqual([...renderer.jobs].sort(), ['typecheck', 'universe', 'universePreparation']);
  const lockfile = classifyAffectedPaths(['pnpm-lock.yaml'], config);
  assert.equal(lockfile.shared, true);
});

test('real owner map routes defects to their test lane, not the unrelated lab', async () => {
  const config = await loadCiAreasConfig();
  for (const path of ['tools/fits/fits.mts', 'tools/oracles/test-fits.mts']) {
    const jobs = classifyAffectedPaths([path], config).jobs;
    assert.equal(jobs.has('universe'), true, path);
    assert.equal(jobs.has('nebula'), false, path);
  }
  const preparation = classifyAffectedPaths(['src/renderers/css/preparation/volume.ts'], config);
  assert.equal(preparation.jobs.has('universePreparation'), true);
  assert.equal(preparation.jobs.has('nebula'), false);
  const object = classifyAffectedPaths(['src/objects/mars/prepared-assets.json'], config);
  assert.equal(object.jobs.has('universe'), true, 'changed package integrity must be exercised');
  assert.equal(classifyAffectedPaths(['tools/new-unmapped-owner.mts'], config).shared, true);
});

test('one plan includes test types and nebula locally, and selects production with the same paths', async () => {
  const config = await loadCiAreasConfig();
  const jobs = affectedJobNames(classifyAffectedPaths(['package.json'], config));
  // `audit` is the advisory repository-completeness job: it runs on every change beside `lint`, and reports
  // rather than gates (docs/ci-cd.md, "Gate on what ships").
  assert.deepEqual(jobs, ['lint', 'audit', 'typecheck', 'typecheck-tests', 'universe', 'universe-preparation', 'nebula']);
  assert.equal(needsProductionBuild(['site/router.mts'], config), true);
  assert.equal(needsProductionBuild(['README.md'], config), false);
  assert.equal(needsProductionBuild([], config), true);
  assert.equal(needsProductionBuild(['netlify/new-function.mts'], config), true, 'unknown ownership is fail-closed for production too');
});

test('the local plan includes committed renames, staged/unstaged edits and untracked paths', async t => {
  const root=await mkdtemp(join(tmpdir(),'ci-plan-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const git=(...args:string[])=>execFileSync('git',args,{cwd:root,encoding:'utf8'});
  git('init','-q');git('config','user.name','CI fixture');git('config','user.email','fixture@example.invalid');
  for(const file of ['before.txt','staged.txt','working.txt'])await writeFile(join(root,file),'old');
  git('add','.');git('commit','-qm','base');git('branch','base');
  await rename(join(root,'before.txt'),join(root,'after.txt'));git('add','.');git('commit','-qm','rename');
  await writeFile(join(root,'staged.txt'),'new');git('add','staged.txt');
  await writeFile(join(root,'working.txt'),'new');await writeFile(join(root,'new file.mts'),'new');
  assert.deepEqual((await localChangedPaths('base',root)).sort(),['after.txt','before.txt','new file.mts','staged.txt','working.txt']);
  await assert.rejects(localChangedPaths('missing-base',root),'unresolved local refs must not silently skip checks');
});

test('real sparse checkouts classify absent paths and preserve runtime and object scope', async t => {
  const root=await mkdtemp(join(tmpdir(),'ci-sparse-plan-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const git=(...args:string[])=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});
  const put=async(path:string,text:string)=>{
    await mkdir(dirname(join(root,path)),{recursive:true});
    await writeFile(join(root,path),text);
  };
  git('init','-q');git('config','user.name','CI fixture');git('config','user.email','fixture@example.invalid');
  await mkdir(join(root,'tools'));
  await mkdir(join(root,'.github'));
  // Use the actual built-in-only executable closure and owner map; there are no installed dependencies.
  for(const file of ['ci-affected.mts','classify-changes.mts','source-values.mts','scope-runtime-ownership-check.mts','object-scope-gate.mts']) {
    await copyFile(new URL(file,import.meta.url),join(root,'tools',file));
  }
  await copyFile(new URL('../../.github/ci-areas.json',import.meta.url),join(root,'.github/ci-areas.json'));
  const earth='src/objects/earth/source/record.json',mars='src/objects/mars/source/record.json';
  const shared='src/platform/shared.mts';
  await put(earth,'{"pinned":"same bytes across a cross-object rename"}');
  await put(shared,'export const value = 1;');
  git('add','.');git('commit','-qm','base');git('branch','base');
  await mkdir(dirname(join(root,mars)),{recursive:true});
  await rename(join(root,earth),join(root,mars));
  git('add','.');git('commit','-qm','cross-object rename');git('branch','body');

  const run=async(script:string,args:string[])=>{
    const output=join(root,'.git','fixture-outputs');
    await writeFile(output,'');
    const result=spawnSync(process.execPath,[`tools/${script}`,...args],{
      cwd:root,encoding:'utf8',env:{...process.env,GITHUB_OUTPUT:output},
    });
    if(result.error)throw result.error;
    assert.equal(result.signal,null);
    return {status:result.status,stdout:result.stdout,stderr:result.stderr,outputs:await readFile(output,'utf8')};
  };
  const decisions=async(ref:string)=>({
    pr:await run('ci-affected.mts',['pr',ref]),
    push:await run('ci-affected.mts',['push',ref]),
    docs:await run('classify-changes.mts',['pr',ref]),
    ownership:await run('scope-runtime-ownership-check.mts',[ref]),
    scope:await run('object-scope-gate.mts',[ref,'[]']),
    labeledScope:await run('object-scope-gate.mts',[ref,'[{"name":"pipeline-change"}]']),
  });
  const verifySparse=async(ref:string,paths:string[],expected:{shared:boolean;ownership:string;objects:number;scopeStatus:number})=>{
    const full=await decisions(ref);
    assert.equal(full.pr.status,0);assert.equal(full.push.status,0);assert.equal(full.docs.status,0);
    assert.match(full.pr.stdout,new RegExp(`Touched ${paths.length} file\\(s\\)\\.`));
    assert.equal(full.pr.outputs,[
      `run_typecheck=${expected.shared}`,'run_universe=true',`run_universe_preparation=${expected.shared}`,
      `run_nebula=${expected.shared}`,'docs_only=false',`run_production=${expected.shared}`,'',
    ].join('\n'));
    assert.equal(full.push.outputs,full.pr.outputs);
    assert.equal(full.ownership.status,0);assert.equal(full.ownership.stdout,`${expected.ownership}\n`);
    assert.equal(full.scope.status,expected.scopeStatus);
    assert.match(full.scope.stdout,new RegExp(`Touched ${expected.objects} object director`));
    assert.equal(full.labeledScope.status,0);
    execFileSync('git',['sparse-checkout','set','--no-cone','--stdin'],{
      cwd:root,input:'/tools/*.mts\n/.github/ci-areas.json\n',encoding:'utf8',stdio:['pipe','pipe','pipe'],
    });
    for(const path of paths)await assert.rejects(access(join(root,path)),{code:'ENOENT'});
    assert.deepEqual(git('diff','--no-renames','--name-only','-z',`${ref}...HEAD`).split('\0').filter(Boolean).sort(),[...paths].sort());
    assert.deepEqual(await decisions(ref),full,'All CLI decisions must be identical without the changed paths on disk.');
    return full;
  };

  const body=await verifySparse('base',[earth,mars],{shared:false,ownership:'--object earth --object mars',objects:2,scopeStatus:0});
  // Mutation-check the actual CLI in the isolated checkout: filesystem-filtered diffs must fail this comparison.
  const classifier=join(root,'tools/ci/ci-affected.mts'),original=await readFile(classifier,'utf8');
  const mutation=original.replace("import { appendFileSync } from 'node:fs';","import { appendFileSync, existsSync } from 'node:fs';")
    .replace("return stdout.split('\\0').filter(Boolean);","return stdout.split('\\0').filter(Boolean).filter(path => existsSync(resolve(root, path)));");
  assert.notEqual(mutation,original);
  await writeFile(classifier,mutation);
  try {
    const mutated=await run('ci-affected.mts',['pr','base']);
    assert.equal(mutated.status,0,'The mutation must execute, not merely break imports.');
    assert.match(mutated.stdout,/Touched 0 file\(s\)/);
    assert.notDeepEqual(mutated.outputs,body.pr.outputs,'Dropping absent paths must not satisfy the real fixture verdict.');
  } finally { await writeFile(classifier,original); }

  git('sparse-checkout','disable');
  await put(shared,'export const value = 2;');git('add','.');git('commit','-qm','shared runtime change');git('branch','shared');
  await verifySparse('base',[earth,mars,shared],{shared:true,ownership:'--all',objects:2,scopeStatus:0});
  git('sparse-checkout','disable');
  const wide=Array.from({length:13},(_,index)=>`src/objects/body-${String.fromCharCode(97+index)}/object.json`);
  for(const path of wide)await put(path,'{}');
  git('add','.');git('commit','-qm','wide object change');
  await verifySparse('shared',wide,{
    shared:false,ownership:wide.map(path=>`--object ${path.split('/')[2]}`).join(' '),objects:13,scopeStatus:1,
  });
});
