import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { parse, stringify } from 'yaml';
import { requireArray, requireRecord } from '@cssearth/core';
import { readCiSteps } from './check-ci.mts';
import { selectedTestFiles, shardFiles, universeTestMatrix } from './test-shards.mts';

const root = resolve(import.meta.dirname, '../../..');
const source = readFileSync(resolve(root, '.github/workflows/universe.yml'), 'utf8');
const all = { packages: 'all', files: '' };
const expected = [
  { lane: 'packages', shard: 1, total: 3 }, { lane: 'packages', shard: 2, total: 3 }, { lane: 'packages', shard: 3, total: 3 },
  { lane: 'site', shard: 1, total: 3 }, { lane: 'site', shard: 2, total: 3 }, { lane: 'site', shard: 3, total: 3 },
];

function contract(text: string) {
  const workflow = requireRecord(parse(text)), jobs = requireRecord(workflow.jobs);
  const changes = requireRecord(jobs.changes), outputs = requireRecord(changes.outputs);
  assert.equal(outputs.test_matrix, '${{ steps.shards.outputs.test_matrix }}');
  const step = requireArray(changes.steps).map(requireRecord).find(step => step.id === 'shards');
  assert.ok(step);
  assert.equal(step.run, 'node .github/scripts/ci/test-shards.mts --matrix');
  assert.deepEqual(step.env, { CI_TEST_PACKAGES: '${{ steps.affected.outputs.test_packages }}', CI_TEST_FILES: '${{ steps.affected.outputs.test_files }}' });
  const job = requireRecord(jobs['universe-checks']);
  assert.equal(job.name, 'Universe / ${{ matrix.lane }} / ${{ matrix.shard }} of ${{ matrix.total }}');
  assert.equal(requireRecord(job.env).CI_TEST_SHARD, '${{ matrix.shard }}');
  assert.equal(requireRecord(job.env).CI_TEST_SHARDS, '${{ matrix.total }}');
  const steps = readCiSteps(text);
  const tests = steps.filter(step => step.run.includes('node .github/scripts/ci/test-shards.mts --run'));
  assert.deepEqual(tests.map(step => ({ lane: step.env.CI_UNIVERSE_LANE, shard: Number(step.env.CI_TEST_SHARD), total: Number(step.env.CI_TEST_SHARDS) })), expected);
  assert.ok(tests.every(step => !step.run.includes('pnpm "test:')));
  assert.equal(requireRecord(jobs.universe).name, 'Prepared universe and shared renderer');
  return tests;
}

test('workflow and local CI execute exactly all five native shards with the maintained required aggregate', () => {
  contract(source);
  assert.deepEqual(universeTestMatrix(root, all), expected);
  const subset = { packages: 'core', files: '' };
  const rows = universeTestMatrix(root, subset);
  const local = readCiSteps(source, 'universe', { '${{ needs.changes.outputs.test_packages }}': subset.packages });
  assert.equal(local.filter(step => step.run.includes('test-shards.mts --run')).length, rows.length);
});

test('real script discovery partitions every selected file exactly once and ignores input/timing order', () => {
  for (const selection of [all, { packages: 'core renderer', files: 'integration/prepared-object-mount/navigable-object-mount.test.mts' }]) {
    for (const lane of ['packages', 'site'] as const) {
      const files = selectedTestFiles(root, lane, selection);
      assert.ok(files.length > 0);
      const rows = universeTestMatrix(root, selection).filter(row => row.lane === lane);
      const partition = rows.map(row => shardFiles(files, row.shard, row.total));
      assert.deepEqual(partition.flat().sort(), files, 'union equals the unsharded set');
      assert.equal(new Set(partition.flat()).size, files.length, 'no duplicate file');
      assert.deepEqual(rows.map(row => shardFiles([...files].reverse(), row.shard, row.total)), partition, 'completion order cannot change membership');
      assert.notDeepEqual(partition.slice(1).flat().sort(), files, 'deleting a shard loses coverage');
    }
  }
});

test('subset threshold is deterministic at 40/41 files and overlapping explicit files run once', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'ci-shard-selection-'));
  try {
    writeFileSync(resolve(directory, 'package.json'), JSON.stringify({ scripts: { 'test:packages': 'pnpm test:run "*.test.mts"', 'test:site': 'pnpm test:run "*.test.mts"' } }));
    for (let index = 0; index < 41; index++) writeFileSync(resolve(directory, `${index}.test.mts`), '');
    const selection = (count: number) => ({ packages: '', files: Array.from({ length: count }, (_, index) => `${index}.test.mts`).join(' ') });
    for (const [count, shards] of [[0, 1], [40, 1], [41, 2]])
      assert.equal(universeTestMatrix(directory, selection(count!)).filter(row => row.lane === 'packages').length, shards);
    assert.equal(universeTestMatrix(directory, all).filter(row => row.lane === 'packages').length, 3);
    assert.throws(() => selectedTestFiles(directory, 'packages', { packages: '', files: 'missing.test.mts' }), /outside/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
  const file = selectedTestFiles(root, 'packages', { packages: 'core', files: '' })[0]!;
  assert.ok(file);
  assert.deepEqual(selectedTestFiles(root, 'packages', { packages: 'core', files: file }), selectedTestFiles(root, 'packages', { packages: 'core', files: '' }));
});

test('native Node sharding agrees with sorted-index partition despite reversed creation and delayed tests', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'ci-native-shards-'));
  try {
    const names = Array.from({ length: 7 }, (_, index) => `${index}.test.mts`);
    for (const [index, name] of [...names].reverse().entries())
      writeFileSync(resolve(directory, name), `import { test } from 'node:test'; test('${name}', async () => { await new Promise(r => setTimeout(r, ${index * 3})); });\n`);
    const environment = { ...process.env };
    delete environment.NODE_TEST_CONTEXT;
    for (const total of [1, 2, 3]) for (let shard = 1; shard <= total; shard++) {
      const output = execFileSync(process.execPath, ['--test', '--test-reporter=tap', `--test-shard=${shard}/${total}`, '*.test.mts'], { cwd: directory, encoding: 'utf8', env: environment });
      const actual = [...output.matchAll(/^# Subtest: (\d+\.test\.mts)$/gmu)].map(match => match[1]!).sort();
      assert.deepEqual(actual, shardFiles(names, shard, total));
    }
    writeFileSync(resolve(directory, '0.test.mts'), "import { test } from 'node:test'; test('deliberate failure', () => { throw Error('mutation'); });\n");
    assert.notEqual(spawnSync(process.execPath, ['--test', '--test-shard=1/2', '*.test.mts'], { cwd: directory, env: environment }).status, 0);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('deleting a matrix shard or ignoring the shard aggregate makes the same contract red', () => {
  const workflow = requireRecord(parse(source)), jobs = requireRecord(workflow.jobs);
  const checks = requireRecord(jobs['universe-checks']), strategy = requireRecord(checks.strategy);
  const original = strategy.matrix;
  strategy.matrix = { include: expected.slice(1) };
  assert.throws(() => contract(stringify(workflow)), /maintained lane matrices/);
  strategy.matrix = original;
  const aggregate = requireRecord(jobs.universe), step = requireRecord(requireArray(aggregate.steps)[0]);
  step.run = 'true';
  assert.throws(() => contract(stringify(workflow)), /fail-closed/);
  step.run = 'test "$RESULT" = success';
  step.env = { RESULT: 'success' };
  assert.throws(() => contract(stringify(workflow)), /fail-closed/);
  const guard = 'test "$RESULT" = success';
  for (const result of ['failure', 'cancelled', 'skipped', ''])
    assert.notEqual(spawnSync('bash', ['-c', guard], { env: { ...process.env, RESULT: result } }).status, 0);
  assert.equal(spawnSync('bash', ['-c', guard], { env: { ...process.env, RESULT: 'success' } }).status, 0);
  contract(source);
});


test('production CLI passes native shard options and a deleted generated shard turns the matrix assertion red', () => {
  const directory = realpathSync(mkdtempSync(resolve(tmpdir(), 'ci-shard-cli-')));
  try {
    const environment: NodeJS.ProcessEnv = { ...process.env, CI_TEST_PACKAGES: 'all', CI_TEST_FILES: '', CI_UNIVERSE_LANE: 'site', CI_TEST_SHARD: '2', CI_TEST_SHARDS: '3',
      PATH: `${directory}:${process.env.PATH}`, SHARD_ARGUMENTS: resolve(directory, 'arguments.json'), GITHUB_OUTPUT: '' };
    delete environment.NODE_TEST_CONTEXT;
    writeFileSync(resolve(directory, 'pnpm'), `#!/usr/bin/env node\nrequire('node:fs').writeFileSync(process.env.SHARD_ARGUMENTS, JSON.stringify(process.argv.slice(2)));\n`);
    chmodSync(resolve(directory, 'pnpm'), 0o755);
    const run = (file: string, flag: string) => execFileSync(process.execPath, [file, flag], { env: environment, encoding: 'utf8' });
    run(resolve(root, '.github/scripts/ci/test-shards.mts'), '--run');
    assert.deepEqual(JSON.parse(readFileSync(resolve(directory, 'arguments.json'), 'utf8')), ['test:run', '--test-shard=2/3', ...selectedTestFiles(root, 'site', all)]);
    const original = readFileSync(resolve(root, '.github/scripts/ci/test-shards.mts'), 'utf8');
    const relocated = original.replace("'../../../packages/core/src/node/script-test-files.ts'", JSON.stringify(resolve(root, 'packages/core/src/node/script-test-files.ts')))
      .replace("resolve(import.meta.dirname, '../../..')", JSON.stringify(root));
    const mutant = resolve(directory, 'mutant.mts');
    writeFileSync(mutant, relocated.replace("length: 3 }, (_, index): TestShard => ({ lane: 'site'", "length: 2 }, (_, index): TestShard => ({ lane: 'site'"));
    const matrix = JSON.parse(run(mutant, '--matrix'));
    assert.throws(() => assert.deepEqual(matrix.include, expected), /AssertionError/, 'deleting site shard 2 must fail the canonical matrix contract');
    writeFileSync(mutant, relocated.replace('`--test-shard=${shard}/${total}`', "'--test-concurrency=4'"));
    run(mutant, '--run');
    assert.throws(() => assert.deepEqual(JSON.parse(readFileSync(resolve(directory, 'arguments.json'), 'utf8')), ['test:run', '--test-shard=2/3', ...selectedTestFiles(root, 'site', all)]), /AssertionError/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
