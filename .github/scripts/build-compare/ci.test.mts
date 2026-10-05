/** CI declaration and recipe validation, plus executable workflow contract coverage. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { parse } from 'yaml';
import { refactorDeclaration, preparationCommand, requireFreshDeclaration, toolSource, effectiveDeclaration, enforcedMode, skipLockfile, skipToolchain, comparisonPreparation } from './ci.mts';
import { readCiSteps } from '../ci/check-ci.mts';

test('ordinary PRs report while explicit refactors enforce validated modes and moves', () => {
  assert.deepEqual(refactorDeclaration(undefined), { mode: 'report', moves: {} });
  assert.deepEqual(refactorDeclaration({ mode: 'pure-move', moves: { 'site/a.mts': 'site/world/a.mts', 'site/deleted.mts': null } }),
    { mode: 'pure-move', moves: { 'site/a.mts': 'site/world/a.mts', 'site/deleted.mts': null } });
  assert.equal(refactorDeclaration({ mode: 'semantic', moves: {} }).mode, 'semantic');
  for (const value of [null, [], {}, { mode: 'report', moves: {} }, { mode: 'semantic', moves: [] },
    { mode: 'semantic', moves: { '../escape': 'site/a' } }, { mode: 'semantic', moves: { a: 'b', c: 'b' } },
    { mode: 'semantic', moves: { a: 'a' } }, { mode: 'semantic', moves: { a: 'b', b: 'c' } },
    { mode: 'semantic', moves: {}, extra: true }]) assert.throws(() => refactorDeclaration(value));
});
test('CI uses only preparation before the production build boundary', () => {
  assert.equal(preparationCommand({ scripts: { 'build:deploy': 'pnpm build:packages && pnpm setup:asset-data && astro build && node post.mts' } }),
    'pnpm build:packages && pnpm setup:asset-data');
  for (const value of [{}, { scripts: {} }, { scripts: { 'build:deploy': 'astro build' } },
    { scripts: { 'build:deploy': 'a && astro build && b && astro build && c' } }]) assert.throws(() => preparationCommand(value));
});
test('workflow always gates refactors and executes selector from merge-base', async () => {
  const source = await readFile(new URL('../../workflows/site-safety-net.yml', import.meta.url), 'utf8');
  const workflow = parse(source);
  assert.equal(workflow.jobs.gate.if, undefined);
  assert.equal(workflow.jobs.gate.name, 'Refactor declaration gate');
  for (const name of ['gate', 'changes']) {
    const commands = readCiSteps(source, name);
    assert.ok(commands.some(step => step.run.includes('git archive "$comparison_base"')));
    assert.ok(commands.at(-1)?.run.includes('$RUNNER_TEMP/comparison-gate/'));
  }
  assert.equal(workflow.jobs['build-compare'].if, "needs.changes.outputs.run_production == 'true'");
  const steps = workflow.jobs['build-compare'].steps;
  assert.equal(steps.filter((step: { uses?: string }) => step.uses?.startsWith('actions/checkout@')).length, 1);
  assert.ok(steps.some((step: { run?: string }) => step.run?.includes('git worktree add')));
  assert.ok(!steps.some((step: { uses?: string }) => step.uses?.startsWith('actions/cache/save@')));
  const bank = steps.find((step: { with?: { key?: string } }) => step.with?.key?.startsWith('prepared-files-v2-'));
  assert.equal(bank.with.path, 'src/objects/*/prepared');
  assert.equal(bank.with.key, "prepared-files-v2-${{ hashFiles('src/objects/*/inventory.json') }}");
  assert.ok(steps.findIndex((step: { run?: string }) => step.run?.includes('worktree add')) < steps.indexOf(bank));
  assert.ok(steps.some((step: { uses?: string; with?: { package_json_file?: string } }) => step.uses?.startsWith('pnpm/action-setup@') && step.with?.package_json_file === 'package.json'));
  assert.ok(!steps.find((step: { uses?: string }) => step.uses?.startsWith('actions/setup-node@')).with.cache);
  assert.equal(workflow.concurrency['cancel-in-progress'], "${{ github.event_name == 'pull_request' && github.event.action == 'synchronize' }}");
});

test('preparation boundary accepts reordered steps and whitespace, rejects ambiguous recipes', () => {
  assert.equal(preparationCommand({ scripts: { 'build:deploy': 'pnpm b&& pnpm a &&astro build&&node post' } }), 'pnpm b && pnpm a');
  assert.throws(() => preparationCommand({ scripts: { 'build:deploy': 'pnpm a && astro build --mode production && node post' } }), /standalone astro build/u);
});
test('workflow has no scenes cache, uses Node 24 throughout, and limits ordinary PR cost', async () => {
  const source = await readFile(new URL('../../workflows/site-safety-net.yml', import.meta.url), 'utf8');
  assert.ok(!source.includes('public/scenes'));
  assert.ok(source.includes('--select'));
  assert.ok((await readFile(new URL('./gate.mts', import.meta.url), 'utf8')).includes('compare-build'));
  assert.ok(source.includes('prepared-files-v2-'));
  const workflow = parse(source);
  for (const job of Object.values(workflow.jobs)) {
    assert.ok(job && typeof job === 'object' && 'steps' in job && Array.isArray(job.steps));
    for (const step of job.steps) if (step.uses?.startsWith('actions/setup-node@')) assert.equal(step.with['node-version'], '24');
  }
});

test('declarations must belong to this diff and identical base declarations fail', () => {
  const declaration = { mode: 'pure-move', moves: {} };
  assert.throws(() => requireFreshDeclaration('', declaration, undefined), /added or changed/u);
  assert.throws(() => requireFreshDeclaration('M\t.github/site-refactor.json', declaration, declaration), /identical/u);
  assert.doesNotThrow(() => requireFreshDeclaration('A\t.github/site-refactor.json', declaration, undefined));
  assert.doesNotThrow(() => requireFreshDeclaration('M\t.github/site-refactor.json', declaration, { mode: 'semantic', moves: {} }));
});
test('tool trust defaults to merge-base and changes only through explicit opt-in', () => {
  assert.equal(toolSource(refactorDeclaration(undefined), []), 'merge-base');
  assert.equal(toolSource(refactorDeclaration(undefined), ['compare-build']), 'merge-base');
  assert.equal(toolSource(refactorDeclaration(undefined), ['tool-change']), 'head');
  assert.equal(toolSource(refactorDeclaration(undefined), [], false), 'bootstrap', 'a merge base without tools: only the introducing pull request');
  assert.equal(toolSource(refactorDeclaration({ mode: 'pure-move', moves: {}, tools: 'head' }), [], false), 'head');
  assert.equal(toolSource(refactorDeclaration({ mode: 'pure-move', moves: {}, tools: 'head' }), []), 'head');
});

test('reordering declaration keys cannot renew a stale declaration', () => {
  assert.throws(() => requireFreshDeclaration('M\t.github/site-refactor.json', { mode: 'pure-move', moves: { a: 'b', c: 'd' } }, { moves: { c: 'd', a: 'b' }, mode: 'pure-move' }), /identical/u);
});

test('stale declarations choose report without parsing the stale schema', () => {
  assert.deepEqual(effectiveDeclaration('', { oldSchema: true }, undefined), { mode: 'report', moves: {} });
  assert.equal(effectiveDeclaration('A\t.github/site-refactor.json', { mode: 'semantic', moves: {} }, undefined).mode, 'semantic');
});
test('rename-only changes force pure-move, even for semantic declarations', () => {
  assert.equal(enforcedMode('semantic', true), 'pure-move');
  assert.equal(enforcedMode('semantic', false), 'semantic');
  assert.throws(() => enforcedMode('report', true), /pure-move declaration/u);
});
test('report mode alone skips unequal lockfiles, including same-length byte changes', () => {
  assert.equal(skipLockfile('report', Buffer.from('aa'), Buffer.from('ab')), true);
  assert.equal(skipLockfile('report', Buffer.from('aa'), Buffer.from('aa')), false);
  assert.equal(skipLockfile('semantic', Buffer.from('aa'), Buffer.from('ab')), false);
});
test('report mode head toolchain mismatch skips without swallowing other failures', () => {
  assert.equal(skipToolchain('report', 'head', '{}'), true);
  for (const [mode, label, failure] of [['semantic', 'head', '{}'], ['report', 'base', '{}'], ['report', 'head', undefined]] as const) assert.equal(skipToolchain(mode, label, failure), false);
});
test('asset restore substitution fails loudly if the production recipe changes', () => {
  assert.equal(comparisonPreparation({ scripts: { 'build:deploy': 'pnpm build:packages && pnpm setup:asset-data && astro build' } }), 'pnpm build:packages && node .github/scripts/build-compare/restore-preparation.mts --checkout .');
  for (const restore of ['pnpm setup:assets', 'pnpm setup:asset-data --location=all', 'pnpm setup:asset-data && pnpm setup:asset-data']) assert.throws(() => comparisonPreparation({ scripts: { 'build:deploy': `pnpm a && ${restore} && astro build` } }), /exactly one standalone/u);
});
test('semantic output declarations validate reasons and layout', () => {
  const value = { mode: 'semantic', moves: {}, outputs: [{ glob: 'earth/**/*.html', reason: 'Earth content changes' }], layout: 'changes' };
  assert.deepEqual(refactorDeclaration(value).outputs, value.outputs);
  assert.equal(refactorDeclaration(value).layout, 'changes');
  for (const extra of [{ outputs: [{ glob: '../bad', reason: 'escape' }] }, { outputs: [{ glob: 'index.html', reason: '' }] }, { layout: 'any' }]) assert.throws(() => refactorDeclaration({ mode: 'semantic', moves: {}, ...extra }));
});

test('comparison excludes nebula re-inventory and refuses unknown variants', () => {
  const recipe = 'pnpm a && pnpm setup:asset-data && node packages/bake/cli/prepare-nebulae.mts --if-missing && astro build';
  assert.ok(!comparisonPreparation({ scripts: { 'build:deploy': recipe } }).includes('prepare-nebulae'));
  assert.throws(() => comparisonPreparation({ scripts: { 'build:deploy': recipe.replace('--if-missing', '--allow-missing') } }), /Unknown nebula/u);
});
test('tracked preparation mutations fail even in report mode; summary includes dimensions and environments', async () => {
  const { requireUnchangedTracked, jobSummary } = await import('./ci.mts');
  assert.doesNotThrow(() => requireUnchangedTracked('prior tool edit', 'prior tool edit'));
  assert.throws(() => requireUnchangedTracked('prior tool edit', 'inventory rewritten'), /modified tracked/u);
  const summary = jobSummary({ diagnostics: { environments: { 'prerender-0': { modules: 121 }, 'client-0': { imports: 2 } }, emittedBytesEqual: { html: true } }, closure: { modules: { count: 3 } } }, [{ stage: 'compare', seconds: 110, exitCode: 0 }], 'report', 'bootstrap');
  for (const value of ['prerender-0 | 121', 'client-0 | 2', 'modules | 121', '110.0', 'modules=3', 'tools: bootstrap', 'Mode: report']) assert.ok(summary.includes(value), value);
  const source = await readFile(new URL('./ci.mts', import.meta.url), 'utf8');
  assert.ok(source.includes('requireUnchangedTracked(beforePreparation, await trackedDiff())'));
  assert.ok(source.includes('appendFile(process.env.GITHUB_STEP_SUMMARY'));
});

test('L2 runs after comparison, shares the selected tools and publishes bounded evidence without making uploads mandatory', async () => {
  const source = await readFile(new URL('./ci.mts', import.meta.url), 'utf8');
  assert.ok(source.indexOf("stage('compare'") < source.indexOf('await serverStage('));
  assert.ok(source.includes("join(headTools ? head : base, '.github/scripts/server-answers')"));
  assert.ok(source.includes('await cp(answerRoot, destination'));
  assert.ok(source.includes('return comparisonExit || answerExit'));
  const workflow = parse(await readFile(new URL('../../workflows/site-safety-net.yml', import.meta.url), 'utf8'));
  const upload = workflow.jobs['build-compare'].steps.find((step: { uses?: string }) => step.uses?.startsWith('actions/upload-artifact@'));
  assert.equal(upload.with['if-no-files-found'], 'warn');
  for (const path of ['server-answers.json', 'server-answers/*.log', 'server-answers/artifacts/']) assert.ok(upload.with.path.includes(path));
  assert.ok(!upload.with.path.includes('server-answers/base/'));
  assert.ok(!upload.with.path.includes('server-answers/head/'));
});

test('a declaration names its own change, so two refactors never share one and the freshness check stays meaningful', () => {
  const first = { mode: 'semantic', moves: {}, change: 'S3-2 extract the registry type aliases' };
  assert.equal(refactorDeclaration(first).change, first.change);
  assert.equal(refactorDeclaration({ mode: 'semantic', moves: {} }).change, undefined);
  for (const change of ['', '   ', 7, 'x'.repeat(201)]) assert.throws(() => refactorDeclaration({ mode: 'semantic', moves: {}, change }), /change/u);
  assert.throws(() => requireFreshDeclaration('M\t.github/site-refactor.json', first, { ...first }), /identical/u);
  assert.doesNotThrow(() => requireFreshDeclaration('M\t.github/site-refactor.json', { ...first, change: 'S3-3 extract the navigation contracts' }, first));
  assert.doesNotThrow(() => requireFreshDeclaration('M\t.github/site-refactor.json', first, { mode: 'semantic', moves: {} }));
});
