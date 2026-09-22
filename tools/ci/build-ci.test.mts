import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test, { type TestContext } from 'node:test';
import { buildCi, ciBuildPlan, type CiBuildTask } from './build-ci.mts';

const digest = 'a'.repeat(64);
function fixture(t: TestContext) {
  const root = mkdtempSync(resolve(tmpdir(), 'cssearth-build-ci-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (path: string, text: string) => { mkdirSync(dirname(resolve(root, path)), { recursive: true }); writeFileSync(resolve(root, path), text); };
  write('packages/astronomy/package.json', JSON.stringify({ scripts: { build: 'tsup' }, main: 'dist/index.cjs', module: 'dist/index.js', types: 'dist/index.d.ts' }));
  const executed: string[] = [];
  const run = async (task: CiBuildTask) => {
    executed.push(task.id);
    if (task.id === 'renderer') await new Promise<void>(accept => setImmediate(accept));
    if (task.id === 'catalog') assert.ok(readFileSync(resolve(root, 'src/renderers/css/dist/navigation.js')).length,
      'catalog discovery imports the compiled renderer; a warm checkout cannot satisfy this fixture');
    for (const output of task.outputs ?? []) for (const file of [...output.required, 'nested/chunk.js']) write(`${output.path}/${file}`, `compiled ${file}`);
  };
  return { root, executed, run, write };
}

test('cold lint builds every compiled owner and regenerates the complete minimal source prerequisites', async t => {
  const f = fixture(t), results = await buildCi({ ...f, mode: 'lint', digest });
  assert.deepEqual([...f.executed].sort(), ['catalog', 'packages', 'preparation', 'renderer', 'solar', 'titles']);
  assert.ok(results.every(result => !result.cached));
  assert.ok(f.executed.indexOf('packages') < f.executed.indexOf('renderer'));
  assert.ok(f.executed.indexOf('catalog') < f.executed.indexOf('solar'));
  assert.ok(f.executed.indexOf('solar') < f.executed.indexOf('preparation'));
  assert.ok(f.executed.indexOf('renderer') < f.executed.indexOf('preparation'));
});

test('an exact full hit reuses only compiled output while all generated source and shell preparation still runs', async t => {
  const f = fixture(t);
  await buildCi({ ...f, mode: 'lint', digest });
  f.executed.length = 0;
  const results = await buildCi({ ...f, mode: 'full', digest, cacheHit: true });
  assert.deepEqual(results.filter(result => result.cached).map(result => result.id).sort(), ['packages', 'preparation', 'renderer']);
  assert.deepEqual([...f.executed].sort(), ['astronomy-data', 'catalog', 'font', 'icons', 'moon-labels', 'navigation', 'overview-titles', 'solar', 'titles', 'wordmark', 'world']);
  assert.ok(f.executed.indexOf('world') < f.executed.indexOf('moon-labels'));
  assert.ok(f.executed.indexOf('world') < f.executed.indexOf('overview-titles'));
});

test('cache hits with missing JS, declarations, nested chunks or receipt rebuild the affected owner', async t => {
  const f = fixture(t);
  await buildCi({ ...f, mode: 'lint', digest });
  for (const file of ['index.js', 'index.d.ts', 'nested/chunk.js', '.ci-build-files.json']) {
    unlinkSync(resolve(f.root, 'src/renderers/css/dist', file));
    f.executed.length = 0;
    const results = await buildCi({ ...f, mode: 'lint', digest, cacheHit: true });
    assert.equal(results.find(result => result.id === 'renderer')?.cached, false, file);
    assert.ok(f.executed.includes('renderer'), file);
  }
});

test('a different exact identity or corrupted output cannot reuse compiled files', async t => {
  const f = fixture(t);
  await buildCi({ ...f, mode: 'lint', digest });
  f.write('tools/objects/dist/operations.js', 'wrong output');
  const corrupted = await buildCi({ ...f, mode: 'lint', digest, cacheHit: true });
  assert.equal(corrupted.find(result => result.id === 'preparation')?.cached, false);
  const different = await buildCi({ ...f, mode: 'lint', digest: 'b'.repeat(64), cacheHit: true });
  assert.ok(different.every(result => !result.cached));
});

test('exit zero without real compiled artifacts is failure and never produces a valid cache receipt', async t => {
  const f = fixture(t);
  await assert.rejects(buildCi({ root: f.root, mode: 'lint', digest, run: async () => {} }), /ENOENT|did not produce/);
  assert.throws(() => readFileSync(resolve(f.root, 'packages/astronomy/dist/.ci-build-files.json')), /ENOENT/);
  await assert.rejects(buildCi({ ...f, mode: 'lint', digest: '' }), /exact SHA-256/);
});

test('native package graph and the real renderer → catalogue dependency are preserved', t => {
  const f = fixture(t), plan = ciBuildPlan(f.root, 'full');
  assert.deepEqual(plan.find(task => task.id === 'packages')?.args, ['-r', '--filter', './packages/**', 'build']);
  assert.deepEqual(plan.find(task => task.id === 'renderer')?.after, ['packages']);
  assert.deepEqual(plan.find(task => task.id === 'catalog')?.after, ['renderer']);
  assert.deepEqual(plan.find(task => task.id === 'preparation')?.after, ['renderer', 'solar', 'titles']);
  assert.deepEqual(plan.find(task => task.id === 'world')?.after, ['preparation', 'navigation']);
});

test('CI-only changes can reuse package and renderer outputs while preparation keeps its full input identity', async t => {
  const f = fixture(t), packageDigest = 'b'.repeat(64), rendererDigest = 'c'.repeat(64);
  await buildCi({ ...f, mode: 'lint', digest, packageDigest, rendererDigest });
  f.executed.length = 0;
  const results = await buildCi({ ...f, mode: 'lint', digest: 'd'.repeat(64), packageDigest, rendererDigest,
    cacheHit: false, packageCacheHit: true, rendererCacheHit: true });
  assert.deepEqual(results.filter(result => result.cached).map(result => result.id).sort(), ['packages', 'renderer']);
  assert.ok(f.executed.includes('preparation'));
  unlinkSync(resolve(f.root, 'packages/astronomy/dist/index.d.ts'));
  const missing = await buildCi({ ...f, mode: 'lint', digest: 'd'.repeat(64), packageDigest, rendererDigest,
    cacheHit: true, packageCacheHit: true, rendererCacheHit: true });
  assert.equal(missing.find(result => result.id === 'packages')?.cached, false);
});

test('the runtime profile omits only preparation declarations and keeps every native build and generator dependency', t => {
  const f = fixture(t), typed = ciBuildPlan(f.root, 'full'), runtime = ciBuildPlan(f.root, 'full', false);
  assert.deepEqual(runtime.filter(task => task.id !== 'preparation'), typed.filter(task => task.id !== 'preparation'));
  const before = typed.find(task => task.id === 'preparation'), after = runtime.find(task => task.id === 'preparation');
  assert.ok(before && after);
  assert.deepEqual(after.args, [...before.args, '--no-dts']);
  assert.deepEqual(after.after, before.after);
  assert.deepEqual(after.outputs, [{ path: 'tools/objects/dist', required: ['operations.js', 'prepare-spatial-context.js'] }]);
  assert.ok(before.outputs?.[0]?.required.includes('operations.d.ts'), 'The default profile must retain declarations.');
});

test('a runtime preparation hit still proves its JS entrypoints and nested files', async t => {
  const f = fixture(t), options = { ...f, mode: 'full' as const, digest, preparationDts: false };
  await buildCi(options);
  assert.throws(() => readFileSync(resolve(f.root, 'tools/objects/dist/operations.d.ts')), /ENOENT/);
  const warm = await buildCi({ ...options, cacheHit: true });
  assert.deepEqual(warm.filter(result => result.cached).map(result => result.id).sort(), ['packages', 'preparation', 'renderer']);
  for (const file of ['operations.js', 'prepare-spatial-context.js', 'nested/chunk.js']) {
    unlinkSync(resolve(f.root, 'tools/objects/dist', file));
    const missing = await buildCi({ ...options, cacheHit: true });
    assert.equal(missing.find(result => result.id === 'preparation')?.cached, false, file);
  }
});

test('wrong-profile cache receipts rebuild preparation even if stale declarations remain beside JS', async t => {
  const f = fixture(t);
  await buildCi({ ...f, mode: 'lint', digest });
  const runtime = await buildCi({ ...f, mode: 'lint', digest, preparationDts: false, cacheHit: true });
  assert.equal(runtime.find(result => result.id === 'preparation')?.cached, false);
  // The fixture intentionally leaves these stale files: checking presence alone would accept the wrong build.
  assert.ok(readFileSync(resolve(f.root, 'tools/objects/dist/operations.d.ts')).length);
  const typed = await buildCi({ ...f, mode: 'lint', digest, cacheHit: true });
  assert.equal(typed.find(result => result.id === 'preparation')?.cached, false);
  assert.deepEqual(typed.filter(result => result.cached).map(result => result.id).sort(), ['packages', 'renderer']);
});
