import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';
import { requireArray, requireRecord, requireString } from '@cssearth/core';
import { buildCi, ciBuildPlan } from './build-ci.mts';
import { readCiSteps } from './check-ci.mts';

const root = resolve(import.meta.dirname, '../../..');
const source = readFileSync(resolve(root, '.github/workflows/universe.yml'), 'utf8');
const jobs = requireRecord(requireRecord(parse(source)).jobs);
const lane = requireRecord(jobs['universe-checks']);
const steps = requireArray(lane.steps).map(value => requireRecord(value));
const selected = "env.CI_LANE_SKIP != 'true'";
const testRun = requireString(steps.find(step => step.name === 'Test the selected folder lane')?.run);

function assertSkipGuards(values: readonly Record<string, unknown>[]) {
  for (const step of values) {
    if (step.uses !== undefined || step.id === 'ci-cache-key') {
      assert.ok(requireString(step.if).includes(selected), String(step.name ?? step.uses));
    } else {
      assert.match(requireString(step.run), /^if \[ "\$CI_LANE_SKIP" = true \]; then .*exit 0; fi/mu);
    }
  }
}

function shell(run: string, env: Record<string, string>) {
  // Execute the workflow's actual Bash selection, while commands record calls instead of building,
  // downloading, expanding this checkout or running application tests.
  const result = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', `
node() { printf 'CALL node %s\\n' "$*"; }
pnpm() { printf 'CALL pnpm %s\\n' "$*"; }
git() { printf 'CALL git %s\\n' "$*" >&2; }
${run}`], { env: { ...process.env, CI_TEST_FILES: '', ...env }, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout + result.stderr;
}

function assertVolumes(run: string) {
  for (const packages of ['bake', 'objects', 'volume-viewer', 'all', 'core bake renderer', 'objects core']) {
    const output = shell(run, { CI_UNIVERSE_LANE: 'packages', CI_TEST_PACKAGES: packages, CI_LANE_SKIP: 'false' });
    assert.match(output, /CALL node packages\/bake\/cli\/restore-source-inputs.mts --repository-volumes/u, packages);
    assert.match(output, /CALL git sparse-checkout add --stdin/u, packages);
    assert.match(output, /CALL git sparse-checkout add \/src\/objects\/\*\*\/\*\.shp/u, packages);
    assert.match(output, /CALL node \.github\/scripts\/ci\/test-shards\.mts --run/u);
  }
  for (const [lane, packages] of [['packages', 'core renderer'], ['packages', 'baker'], ['site', 'all']]) {
    const output = shell(run, { CI_UNIVERSE_LANE: lane!, CI_TEST_PACKAGES: packages!, CI_LANE_SKIP: 'false' });
    assert.doesNotMatch(output, /repository-volumes|CALL git/u);
    assert.match(output, /CALL node \.github\/scripts\/ci\/test-shards\.mts --run/u);
  }
}

test('skipped lanes retain successful jobs without checkout, caches or executable tooling', () => {
  assertSkipGuards(steps);
  assert.equal(requireRecord(requireRecord(lane.strategy).matrix).include, '${{ fromJSON(needs.changes.outputs.test_matrix).include }}');
  for (const name of ['packages', 'site']) {
    for (const step of steps.filter(step => step.run !== undefined && step.if === undefined)) {
      assert.doesNotMatch(shell(requireString(step.run), { CI_LANE_SKIP: 'true', CI_UNIVERSE_LANE: name }), /CALL /u);
    }
  }
  for (const [index, step] of steps.entries()) {
    const mutation = steps.map((value, at) => at === index ? { ...value, if: undefined,
      run: value.run === undefined ? undefined : requireString(value.run).replace(/^if \[ "\$CI_LANE_SKIP" = true \]; then .*exit 0; fi\n/mu, '') } : value);
    assert.throws(() => assertSkipGuards(mutation), Error, String(step.name ?? step.uses));
  }
});

test('volume restore and sparse expansion follow exact selected package tokens; mutations turn red', () => {
  assertVolumes(testRun);
  assert.throws(() => assertVolumes(testRun.replace('*" bake "*|', '')));
  assert.throws(() => assertVolumes(testRun.replace('node packages/bake/cli/restore-source-inputs.mts --repository-volumes', ':')));
  assert.throws(() => assertVolumes(testRun.replace('case " $CI_TEST_PACKAGES " in', 'case " all " in')));
});

function assertOrdering(text: string) {
  const commands = readCiSteps(text, 'universe');
  for (const name of ['packages', 'site']) {
    const run = commands.filter(step => step.env.CI_UNIVERSE_LANE === name && step.env.CI_TEST_SHARD === '1').map(step => step.run).join('\n');
    assert.equal([...run.matchAll(/build-ci\.mts packages/gu)].length, 1);
    assert.equal([...run.matchAll(/build-ci\.mts generators/gu)].length, 1);
    assert.doesNotMatch(run, /build-ci\.mts full/u);
    assert.ok(run.indexOf('build-ci.mts packages') < run.indexOf('prepare-ci-inputs.mts universe'));
    assert.ok(run.indexOf('prepare-ci-inputs.mts universe') < run.indexOf('build-ci.mts generators'));
    assert.ok(run.indexOf('setup:asset-data') < run.indexOf('build-ci.mts generators'));
    assert.ok(run.indexOf('build-ci.mts generators') < run.indexOf('prepare-feature-index.mts'));
  }
  const cache = text.indexOf('        id: prepared-cache');
  assert.ok(cache < text.indexOf('build-ci.mts packages'));
}

test('universe compiles before input restoration and generates exactly once after it', () => {
  assertOrdering(source);
  assert.throws(() => assertOrdering(source.replace('build-ci.mts packages', 'build-ci.mts full')));
  assert.throws(() => assertOrdering(source.replace('          node .github/scripts/ci/build-ci.mts generators', '          node .github/scripts/ci/build-ci.mts generators\n          node .github/scripts/ci/build-ci.mts generators')));
  for (const job of ['typecheck', 'typecheck-tests', 'universe-preparation-checks']) {
    assert.equal(readCiSteps(source, job).filter(step => step.run.includes('build-ci.mts full')).length, 1);
  }
});

test('split build preserves every full command and generator dependency, with packages completed first', async () => {
  const full = ciBuildPlan(root, 'full'), packages = ciBuildPlan(root, 'packages'), generators = ciBuildPlan(root, 'generators');
  assert.deepEqual(full.map(task => task.id), ['packages', 'titles', 'catalog', 'solar', 'icons', 'navigation', 'world', 'moon-labels', 'world-presentation']);
  assert.deepEqual(packages, full.filter(task => task.id === 'packages'));
  assert.deepEqual(generators, full.filter(task => task.id !== 'packages').map(task => ({ ...task, after: task.after.filter(id => id !== 'packages') })));
  const completed = new Set<string>();
  await buildCi({ root, mode: 'generators', run: async task => {
    assert.ok(task.after.every(id => completed.has(id)), task.id);
    completed.add(task.id);
  } });
  assert.deepEqual([...completed].sort(), generators.map(task => task.id).sort());
});

test('required aggregate succeeds for successful lanes and fails for any failed lane', () => {
  const aggregate = requireRecord(jobs.universe);
  assert.equal(aggregate.name, 'Prepared universe and shared renderer');
  assert.deepEqual(aggregate.needs, ['changes', 'universe-checks']);
  const step = requireRecord(requireArray(aggregate.steps)[0]);
  assert.equal(requireRecord(step.env).RESULT, '${{ needs.universe-checks.result }}');
  for (const result of ['success', 'failure', 'cancelled', 'skipped']) {
    const command = spawnSync('bash', ['-e', '-c', requireString(step.run)], { env: { ...process.env, RESULT: result } });
    assert.equal(command.status === 0, result === 'success');
  }
  const broken = source.replace('run: test "$RESULT" = success', 'run: true');
  assert.throws(() => readCiSteps(broken, 'universe'), /fail-closed/u);
});

test('safety timeouts retain twice the supplied observed durations', () => {
  for (const [job, minutes, seconds] of [['typecheck', 12, 291], ['typecheck-tests', 12, 249],
    ['universe-preparation-checks', 10, 210], ['nebula', 10, 255], ['astroquery', 12, 0]] as const) {
    assert.equal(requireRecord(jobs[job])['timeout-minutes'], minutes);
    assert.ok(minutes * 60 >= seconds * 2);
  }
});
