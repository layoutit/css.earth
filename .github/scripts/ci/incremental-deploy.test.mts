/** Manual reuse stays opt-in, branch-scoped, and behind the existing publication gates. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { parse } from 'yaml';
import { requireArray, requireRecord, requireString } from '@cssearth/core';

type Workflow = Record<string, unknown>;
const workflow = requireRecord(parse(await readFile(new URL('../../workflows/deploy.yml', import.meta.url), 'utf8')));
const cachePath = 'output/incremental-build/astro-cache';
const stepsOf = (value: Workflow) => requireArray(requireRecord(requireRecord(value.jobs).deploy).steps).map(step => requireRecord(step));
const named = (steps: readonly Workflow[], name: string) => requireRecord(steps.find(step => step.name === name));
const expression = (value: unknown) => requireString(value).replace(/^\s*\$\{\{\s*|\s*\}\}\s*$/gu, '');

// These workflow expressions use the shared JavaScript/GitHub boolean and property subset.
// Evaluate the actual YAML values, including the implicit success guard on step conditions.
function context(event = 'workflow_dispatch', selected: unknown = false, overrides: Workflow = {}) {
  return { github: { event_name: event, ref: 'refs/heads/main', run_id: '100', run_attempt: '1' },
    inputs: { incremental_build: selected }, runner: { os: 'Linux', arch: 'X64' },
    steps: { 'incremental-cache-key': { outputs: { lockfile: 'lock-blob' } }, 'incremental-cache': { outputs: { 'cache-hit': '' } } }, ...overrides };
}
function evaluate(value: unknown, values: Workflow): unknown {
  return runInNewContext(expression(value).replace(/\.([A-Za-z_]\w*(?:-\w+)+)/gu, "['$1']"), values, { timeout: 1000 });
}
function enabled(step: Workflow, values: Workflow, success = true): boolean {
  const condition = step.if === undefined ? 'true' : expression(step.if);
  const explicitStatus = /\b(?:success|failure|cancelled|always)\s*\(/u.test(condition);
  return (explicitStatus || success) && Boolean(evaluate(condition, { ...values,
    success: () => success, failure: () => !success, cancelled: () => false, always: () => true }));
}
function expand(value: unknown, values: Workflow): string {
  return requireString(value).replace(/\$\{\{(.*?)\}\}/gu, (_, code: string) => String(evaluate(code, values)));
}
function assertSelection(value: Workflow): void {
  const input = requireRecord(requireRecord(requireRecord(requireRecord(value.on).workflow_dispatch).inputs).incremental_build);
  assert.equal(input.description, 'Use incremental build'); assert.equal(input.type, 'boolean');
  assert.equal(input.required, false); assert.equal(input.default, false);
  const steps = stepsOf(value), build = named(steps, 'Build the site');
  const env = requireRecord(build.env);
  const selectedSteps = ['Plan incremental static cache', 'Restore incremental static pages', 'Save validated incremental static pages'].map(name => named(steps, name));
  for (const event of ['workflow_dispatch', 'push', 'workflow_run', 'pull_request']) {
    for (const selected of [undefined, false, true]) {
      const values = context(event, selected), expected = event === 'workflow_dispatch' && selected === true;
      for (const flag of ['CSSEARTH_INCREMENTAL_BUILD', 'CSSEARTH_STATIC_STYLES']) assert.equal(evaluate(env[flag], values), expected ? '1' : '0', `${event}/${String(selected)}/${flag}`);
      for (const step of selectedSteps) assert.equal(enabled(step, values), expected, `${event}/${String(selected)}/${String(step.name)}`);
    }
  }
  assert.equal(build.if, undefined, 'Cold builds still execute when reuse is off or the cache is empty.');
}
function assertCache(value: Workflow): void {
  const steps = stepsOf(value), plan = named(steps, 'Plan incremental static cache');
  const restore = named(steps, 'Restore incremental static pages'), save = named(steps, 'Save validated incremental static pages');
  assert.match(requireString(plan.run), /git rev-parse HEAD:pnpm-lock\.yaml/u);
  assert.equal(plan.id, 'incremental-cache-key'); assert.equal(restore.id, 'incremental-cache');
  assert.match(requireString(restore.uses), /^actions\/cache\/restore@/u); assert.match(requireString(save.uses), /^actions\/cache\/save@/u);
  const inputs = requireRecord(restore.with), saved = requireRecord(save.with);
  assert.equal(inputs.path, cachePath); assert.equal(saved.path, cachePath);
  assert.notEqual(inputs['fail-on-cache-miss'], true); assert.notEqual(inputs['fail-on-cache-miss'], 'true');
  const key = requireString(inputs.key), prefixes = requireString(inputs['restore-keys']).trim().split(/\r?\n/u);
  assert.equal(prefixes.length, 1, 'No broad fallback may cross a branch or compatibility namespace.');
  const prefix = prefixes[0]!;
  assert.match(prefix, /^deploy-static-v\d+-/u, 'Deploy never consumes the static-build/share-build benchmark namespaces.');
  assert.equal(key, `${prefix}\${{ github.run_id }}-\${{ github.run_attempt }}`);
  assert.equal(saved.key, '${{ steps.incremental-cache.outputs.cache-primary-key }}');
  const baseline = context(), expanded = expand(prefix, baseline);
  for (const ref of ['refs/heads/main-extra', 'refs/heads/main/child']) {
    const sibling = context('workflow_dispatch', true, { github: { ref, run_id: '101', run_attempt: '1' } });
    assert.ok(!expand(key, sibling).startsWith(expanded), `Branch ${ref} must not match main's restore prefix.`);
  }
  for (const values of [context('workflow_dispatch', true, { runner: { os: 'Windows', arch: 'X64' } }),
    context('workflow_dispatch', true, { runner: { os: 'Linux', arch: 'ARM64' } }),
    context('workflow_dispatch', true, { steps: { 'incremental-cache-key': { outputs: { lockfile: 'different-lock' } } } }),
    context('workflow_dispatch', true, { github: { ref: 'refs/heads/feature' } })]) assert.notEqual(expand(prefix, values), expanded);
  const setup = steps.find(step => String(step.uses).startsWith('actions/setup-node@'));
  assert.match(prefix, new RegExp(`node${requireString(requireRecord(requireRecord(setup).with)['node-version'])}-`, 'u'));
  assert.notEqual(expand(key, baseline), expand(key, context('workflow_dispatch', true, { github: { ref: 'refs/heads/main', run_id: '101', run_attempt: '1' } })));
  assert.notEqual(expand(key, baseline), expand(key, context('workflow_dispatch', true, { github: { ref: 'refs/heads/main', run_id: '100', run_attempt: '2' } })));
  const buildAt = steps.indexOf(named(steps, 'Build the site'));
  assert.ok(steps.indexOf(plan) < steps.indexOf(restore) && steps.indexOf(restore) < buildAt);
  assert.ok(!enabled(save, context('workflow_dispatch', true), false), 'A failed build or validation must never save reusable pages.');
}
function assertGates(value: Workflow): void {
  const steps = stepsOf(value), build = named(steps, 'Build the site'), output = named(steps, 'Check the build output');
  const save = named(steps, 'Save validated incremental static pages'), publish = named(steps, 'Publish the prebuilt site to Cloudflare');
  assert.equal(requireRecord(build.env).CSSEARTH_ALLOW_MISSING_ASSETS, '0');
  const command = requireString(build.run);
  assert.match(command, /ASSET_ORIGIN=https:\/\/earth-assets\.lowpoly\.cc pnpm build:deploy/u);
  assert.ok(command.indexOf('pnpm check:deploy-assets') > command.indexOf('pnpm build:deploy'));
  assert.equal(output.if, undefined); assert.equal(publish.if, undefined); assert.equal(publish.run, 'pnpm deploy:cloudflare');
  assert.ok(steps.indexOf(build) < steps.indexOf(output) && steps.indexOf(output) < steps.indexOf(save) && steps.indexOf(save) < steps.indexOf(publish));
  for (const step of [build, output, publish]) assert.notEqual(step['continue-on-error'], true);
  assert.equal(requireRecord(value.permissions).contents, 'read');
  const triggers = requireRecord(value.on);
  assert.deepEqual(Object.keys(triggers).sort(), ['push', 'workflow_dispatch']);
  assert.deepEqual(triggers.push, { branches: ['main'], paths: ['src/objects/earth/source/science/mur/**'] });
  assert.equal(requireRecord(requireRecord(value.jobs).deploy).if, "github.event_name == 'workflow_dispatch' || github.event_name == 'push' || github.event.workflow_run.conclusion == 'success'");
}
function changeStep(value: Workflow, name: string, change: (step: Workflow) => void): Workflow {
  const changed = structuredClone(value), steps = stepsOf(changed); change(named(steps, name)); return changed;
}

test('manual boolean defaults off; both explicit flags and cache operations require the selected dispatch', () => assertSelection(workflow));
test('only compatible branch-scoped Astro pages are restored, with cold misses and unique validated saves', () => assertCache(workflow));
test('asset, output and source gates precede reuse saves and retain the original publication behavior', () => assertGates(workflow));

test('actual output gate rejects absent/truncated output and changed committed object sources', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'incremental-deploy-gate-')); t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, 'dist')); await writeFile(join(directory, 'dist/index.html'), '<html></html>');
  const run = requireString(named(stepsOf(workflow), 'Check the build output').run);
  const assertGate = (commandText: string) => {
    for (const [count, dirty, success] of [[900, false, true], [899, false, false], [900, true, false]] as const) {
      const command = `find() { for ((i=0;i<${count};i++)); do echo page.html; done; }\ndu() { :; }\ngit() { if [ \"$*\" = 'diff --quiet -- src/objects' ]; then return ${dirty ? '1' : '0'}; fi; return 0; }\n${commandText}`;
      const result = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', command], { cwd: directory, encoding: 'utf8' });
      assert.equal(result.status === 0, success, result.stdout + result.stderr);
    }
  };
  assertGate(run);
  assert.throws(() => assertGate(run.replace('git diff --quiet -- src/objects', ':')));
  assert.throws(() => assertGate(run.replace('min_pages=900', 'min_pages=0')));
  await rm(join(directory, 'dist/index.html'));
  assert.notEqual(spawnSync('bash', ['-e', '-o', 'pipefail', '-c', run], { cwd: directory }).status, 0);
});

test('deleting the default, opt-in, event guard or cache isolation properties turns the contract red', () => {
  const noDefault = structuredClone(workflow);
  delete requireRecord(requireRecord(requireRecord(requireRecord(noDefault.on).workflow_dispatch).inputs).incremental_build).default;
  assert.throws(() => assertSelection(noDefault));
  for (const name of ['Plan incremental static cache', 'Restore incremental static pages', 'Save validated incremental static pages']) {
    for (const deleted of ["github.event_name == 'workflow_dispatch' && ", ' && inputs.incremental_build == true']) {
      const changed = changeStep(workflow, name, step => { const before = requireString(step.if); step.if = before.replace(deleted, ''); assert.notEqual(step.if, before); });
      assert.throws(() => assertSelection(changed));
    }
  }
  for (const flag of ['CSSEARTH_INCREMENTAL_BUILD', 'CSSEARTH_STATIC_STYLES']) {
    assert.throws(() => assertSelection(changeStep(workflow, 'Build the site', step => { delete requireRecord(step.env)[flag]; })));
    for (const deleted of ["github.event_name == 'workflow_dispatch' && ", 'inputs.incremental_build == true && ']) {
      assert.throws(() => assertSelection(changeStep(workflow, 'Build the site', step => {
        const env = requireRecord(step.env), before = requireString(env[flag]); env[flag] = before.replace(deleted, ''); assert.notEqual(env[flag], before);
      })));
    }
  }
  for (const name of ['Restore incremental static pages', 'Save validated incremental static pages']) {
    assert.throws(() => assertCache(changeStep(workflow, name, step => { delete requireRecord(step.with).path; })));
    assert.throws(() => assertCache(changeStep(workflow, name, step => { requireRecord(step.with).path = 'output/'; })));
  }
  assert.throws(() => assertCache(changeStep(workflow, 'Restore incremental static pages', step => { requireRecord(step.with)['restore-keys'] = 'deploy-static-v1-'; })));
  assert.throws(() => assertCache(changeStep(workflow, 'Restore incremental static pages', step => {
    const inputs = requireRecord(step.with);
    for (const field of ['key', 'restore-keys']) inputs[field] = requireString(inputs[field]).replace('${{ github.ref }}:', '${{ github.ref }}-');
  })));
  assert.throws(() => assertCache(changeStep(workflow, 'Save validated incremental static pages', step => { step.if = 'always()'; })));
});

test('deleting asset validation or saving before output/source validation turns the contract red', () => {
  assert.throws(() => assertGates(changeStep(workflow, 'Build the site', step => { step.run = requireString(step.run).replace('pnpm check:deploy-assets', ''); })));
  const changed = structuredClone(workflow), job = requireRecord(requireRecord(changed.jobs).deploy), steps = stepsOf(changed);
  const save = named(steps, 'Save validated incremental static pages'), premature = steps.filter(step => step !== save);
  premature.splice(premature.indexOf(named(steps, 'Check the build output')), 0, save); job.steps = premature;
  assert.throws(() => assertGates(changed));
});
