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
  write('packages/renderer/package.json', JSON.stringify({ scripts: { build: 'tsup' }, main: 'dist/index.js', module: 'dist/index.js', types: 'dist/index.d.ts' }));
  const executed: string[] = [];
  const run = async (task: CiBuildTask) => {
    executed.push(task.id);
    if (task.id === 'packages') await new Promise<void>(accept => setImmediate(accept));
    if (task.id === 'catalog') assert.ok(readFileSync(resolve(root, 'packages/renderer/dist/index.js')).length,
      'catalog discovery imports the compiled renderer package; a warm checkout cannot satisfy this fixture');
    for (const output of task.outputs ?? []) for (const file of [...output.required, 'nested/chunk.js']) write(`${output.path}/${file}`, `compiled ${file}`);
  };
  return { root, executed, run, write };
}

test('cold lint builds every compiled owner and regenerates the complete minimal source prerequisites', async t => {
  const f = fixture(t), results = await buildCi({ ...f, mode: 'lint', digest });
  assert.deepEqual([...f.executed].sort(), ['catalog', 'packages', 'preparation', 'solar', 'titles']);
  assert.ok(results.every(result => !result.cached));
  assert.ok(f.executed.indexOf('packages') < f.executed.indexOf('catalog'));
  assert.ok(f.executed.indexOf('catalog') < f.executed.indexOf('solar'));
  assert.ok(f.executed.indexOf('solar') < f.executed.indexOf('preparation'));
  assert.ok(f.executed.indexOf('packages') < f.executed.indexOf('preparation'));
});

test('an exact full hit reuses only compiled output while all generated source and shell preparation still runs', async t => {
  const f = fixture(t);
  await buildCi({ ...f, mode: 'lint', digest });
  f.executed.length = 0;
  const results = await buildCi({ ...f, mode: 'full', digest, cacheHit: true });
  assert.deepEqual(results.filter(result => result.cached).map(result => result.id).sort(), ['packages', 'preparation']);
  assert.deepEqual([...f.executed].sort(), ['astronomy-data', 'catalog', 'icons', 'moon-labels', 'navigation', 'solar', 'titles', 'world', 'world-presentation']);
  assert.ok(f.executed.indexOf('world') < f.executed.indexOf('moon-labels'));
  assert.ok(f.executed.indexOf('world') < f.executed.indexOf('world-presentation'));
});

test('cache hits with missing JS, declarations, nested chunks or receipt rebuild the affected owner', async t => {
  const f = fixture(t);
  await buildCi({ ...f, mode: 'lint', digest });
  for (const file of ['index.js', 'index.d.ts', 'nested/chunk.js', '.ci-build-files.json']) {
    unlinkSync(resolve(f.root, 'packages/renderer/dist', file));
    f.executed.length = 0;
    const results = await buildCi({ ...f, mode: 'lint', digest, cacheHit: true });
    assert.equal(results.find(result => result.id === 'packages')?.cached, false, file);
    assert.ok(f.executed.includes('packages'), file);
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

test('native package graph and the real renderer package → catalogue dependency are preserved', t => {
  const f = fixture(t), plan = ciBuildPlan(f.root, 'full');
  assert.deepEqual(plan.find(task => task.id === 'packages')?.args, ['-r', '--filter', './packages/**', 'build']);
  assert.equal(plan.find(task => task.id === 'renderer'), undefined, 'the renderer builds with the other packages');
  assert.deepEqual(plan.find(task => task.id === 'packages')?.outputs?.find(output => output.path === 'packages/renderer/dist')?.required, ['index.js', 'index.d.ts']);
  assert.deepEqual(plan.find(task => task.id === 'catalog')?.after, ['packages']);
  assert.deepEqual(plan.find(task => task.id === 'preparation')?.after, ['packages', 'solar', 'titles']);
  assert.deepEqual(plan.find(task => task.id === 'world')?.after, ['preparation', 'navigation']);
  assert.deepEqual(plan.find(task => task.id === 'icons')?.after, ['packages']);
});

test('CI-only changes can reuse package outputs, the renderer included, while preparation keeps its full input identity', async t => {
  const f = fixture(t), packageDigest = 'b'.repeat(64);
  await buildCi({ ...f, mode: 'lint', digest, packageDigest });
  f.executed.length = 0;
  const results = await buildCi({ ...f, mode: 'lint', digest: 'd'.repeat(64), packageDigest,
    cacheHit: false, packageCacheHit: true });
  assert.deepEqual(results.filter(result => result.cached).map(result => result.id).sort(), ['packages']);
  assert.ok(f.executed.includes('preparation'));
  unlinkSync(resolve(f.root, 'packages/astronomy/dist/index.d.ts'));
  const missing = await buildCi({ ...f, mode: 'lint', digest: 'd'.repeat(64), packageDigest,
    cacheHit: true, packageCacheHit: true });
  assert.equal(missing.find(result => result.id === 'packages')?.cached, false);
});

test('a preparation hit still proves its JS entrypoints and nested files', async t => {
  const f = fixture(t), options = { ...f, mode: 'full' as const, digest };
  await buildCi(options);
  const warm = await buildCi({ ...options, cacheHit: true });
  assert.deepEqual(warm.filter(result => result.cached).map(result => result.id).sort(), ['packages', 'preparation']);
  for (const file of ['operations.js', 'prepare-spatial-context.js', 'nested/chunk.js']) {
    unlinkSync(resolve(f.root, 'tools/objects/dist', file));
    const missing = await buildCi({ ...options, cacheHit: true });
    assert.equal(missing.find(result => result.id === 'preparation')?.cached, false, file);
  }
});

test('an exports-only package lists each compiled output once', t => {
  const f = fixture(t);
  f.write('packages/bake/package.json', JSON.stringify({ scripts: { build: 'tsup' }, exports: {
    './volume': { types: './dist/volume.d.ts', import: './dist/volume.js', default: './dist/volume.js' },
    './volume/node': { types: './dist/volume/node.d.ts', import: './dist/volume/node.js', default: './dist/volume/node.js' },
  } }));
  const packages = ciBuildPlan(f.root, 'lint').find(task => task.id === 'packages');
  assert.deepEqual(packages?.outputs?.find(output => output.path === 'packages/bake/dist')?.required,
    ['volume.d.ts', 'volume.js', 'volume/node.d.ts', 'volume/node.js']);
});
