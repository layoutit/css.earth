import assert from 'node:assert/strict';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {mkdtemp,writeFile,rename,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {
  affectedJobNames, classifyAffectedChanges, classifyAffectedPaths, loadCiAreasConfig, localChangedPaths, needsProductionBuild, parseCiAreasConfig, patternToRegExp,
} from './ci-affected.mts';
import type { CiAreasConfig } from './ci-affected.mts';

const CONFIG: CiAreasConfig = {
  shared: ['package.json', 'tools/prepare-catalog.mts', 'tools/objects/**'],
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
  const result = classifyAffectedPaths(['tools/fits.mts', 'packages/astronomy/src/a.ts'], CONFIG);
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
  for (const path of ['tools/fits.mts', 'tools/oracles/test-fits.mts']) {
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
  assert.deepEqual(jobs, ['lint', 'typecheck', 'typecheck-tests', 'universe', 'universe-preparation', 'nebula']);
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
