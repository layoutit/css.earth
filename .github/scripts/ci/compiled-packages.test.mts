import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test, type TestContext } from 'node:test';
import { parse } from 'yaml';
import type { CacheRuntime } from './ci-cache-key.mts';
import type { CiBuildTask } from './build-ci.mts';

const moduleRoot = process.env.CI_CACHE_TEST_MODULES ?? import.meta.dirname;
const { compiledCiCacheKeys } = await import(pathToFileURL(resolve(moduleRoot, 'ci-cache-key.mts')).href) as typeof import('./ci-cache-key.mts');
const { buildCi, packageRebuildClosure, compiledOutputsValid } = await import(pathToFileURL(resolve(moduleRoot, 'build-ci.mts')).href) as typeof import('./build-ci.mts');
const runtime: CacheRuntime = { node: '22.23.2', platform: 'linux', arch: 'x64', environment: {} };
const put = (root: string, path: string, text: string) => {
  mkdirSync(dirname(resolve(root, path)), { recursive: true }); writeFileSync(resolve(root, path), text);
};
function fixture(t: TestContext) {
  const root = mkdtempSync(resolve(tmpdir(), 'compiled-packages-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  execFileSync('git', ['init', '-q'], { cwd: root });
  put(root, 'package.json', JSON.stringify({ packageManager: 'pnpm@10.30.3', devDependencies: { typescript: '5.9.3' } }));
  put(root, 'tsconfig.base.json', '{"compilerOptions":{"target":"es2022"}}');
  put(root, 'site/unrelated.mts', 'export const value = 1;');
  put(root, 'docs/unrelated.md', '# Guide');
  for (const [name, dependencies] of [['a', []], ['b', ['a']], ['c', ['b']], ['d', []]] as const) {
    put(root, `packages/${name}/package.json`, JSON.stringify({ name, scripts: { build: 'tsup' },
      main: './dist/index.js', types: './dist/index.d.ts', dependencies: Object.fromEntries(dependencies.map(dep => [dep, 'workspace:*'])) }));
    put(root, `packages/${name}/src/index.ts`, 'export const value = 1;');
    // These configs MUST NOT execute (no installed tsup, and a deliberate throw).
    put(root, `packages/${name}/tsup.config.ts`, "import { defineConfig } from 'tsup';\nthrow new Error('config executed');\nexport default defineConfig(() => ({entry:['src/index.ts'],shims:true,removeNodeProtocol:false}));");
  }
  put(root, 'pnpm-lock.yaml', JSON.stringify({ lockfileVersion: '9.0', importers: Object.fromEntries(['.', ...['a', 'b', 'c', 'd'].map(name => `packages/${name}`)].map(name => [name, {}])), packages: {}, snapshots: {} }));
  execFileSync('git', ['add', '.'], { cwd: root });
  return root;
}
const digests = (result: Awaited<ReturnType<typeof compiledCiCacheKeys>>) => Object.fromEntries(result.packages.map(pkg => [pkg.name, pkg.digest]));

test('unrelated site and docs edits leave every package digest unchanged', async t => {
  const root = fixture(t), before = await compiledCiCacheKeys({ root, runtime });
  put(root, 'site/unrelated.mts', 'export const value = 2;');
  put(root, 'docs/unrelated.md', '# Changed');
  const after = await compiledCiCacheKeys({ root, runtime });
  assert.deepEqual(digests(after), digests(before));
  assert.equal(after.packageDigest, before.packageDigest);
  assert.deepEqual(after.fallbackReasons, []);
});
test('package source edits change only that package and its transitive dependents', async t => {
  const root = fixture(t), before = digests(await compiledCiCacheKeys({ root, runtime }));
  put(root, 'packages/a/src/index.ts', 'export const value = 2;');
  const after = digests(await compiledCiCacheKeys({ root, runtime }));
  for (const name of ['a', 'b', 'c']) assert.notEqual(after[name], before[name], name);
  assert.equal(after.d, before.d);
  put(root, 'packages/d/src/index.ts', 'export const value = 3;');
  const last = digests(await compiledCiCacheKeys({ root, runtime }));
  for (const name of ['a', 'b', 'c']) assert.equal(last[name], after[name], name);
  assert.notEqual(last.d, after.d);
});
test('root config input changes every package digest', async t => {
  const root = fixture(t), before = digests(await compiledCiCacheKeys({ root, runtime }));
  put(root, 'tsconfig.base.json', '{"compilerOptions":{"target":"esnext"}}');
  const after = digests(await compiledCiCacheKeys({ root, runtime }));
  for (const name of ['a', 'b', 'c', 'd']) assert.notEqual(after[name], before[name], name);
});
test('declaration and sourcemap modes use distinct package identities', async t => {
  const root = fixture(t), before = digests(await compiledCiCacheKeys({ root, runtime }));
  for (const environment of [{ CSSEARTH_SKIP_DECLARATIONS: '1' }, { CSSEARTH_PERFORMANCE_SOURCEMAPS: '1' }]) {
    const after = digests(await compiledCiCacheKeys({ root, runtime: { ...runtime, environment } }));
    for (const name of ['a', 'b', 'c', 'd']) assert.notEqual(after[name], before[name]);
  }
});
test('literal config imports are hashed without execution and dynamic imports stay package-local', async t => {
  const root = fixture(t);
  put(root, 'build-options.mts', 'export default {shims:true};');
  put(root, 'packages/d/tsup.config.ts', "import options from '../../build-options.mts'; export default () => options; import(process.env.CONFIG);");
  execFileSync('git', ['add', '.'], { cwd: root });
  const before = digests(await compiledCiCacheKeys({ root, runtime }));
  put(root, 'build-options.mts', 'export default {shims:false};');
  const after = digests(await compiledCiCacheKeys({ root, runtime }));
  assert.notEqual(after.d, before.d);
  for (const name of ['a', 'b', 'c']) assert.equal(after[name], before[name]);
});
test('lockfile closure excludes unrelated importers and includes transitive external resolutions', async t => {
  const root = fixture(t);
  const lock = JSON.parse(readFileSync(resolve(root, 'pnpm-lock.yaml'), 'utf8'));
  lock.importers['packages/d'] = { dependencies: { external: { version: '1.0.0', specifier: '1.0.0' } } };
  lock.packages['external@1.0.0'] = { resolution: { tarball: 'local-one' } };
  lock.snapshots['external@1.0.0'] = {};
  put(root, 'pnpm-lock.yaml', JSON.stringify(lock));
  const before = digests(await compiledCiCacheKeys({ root, runtime }));
  lock.packages['external@1.0.0'].resolution.tarball = 'local-two';
  put(root, 'pnpm-lock.yaml', JSON.stringify(lock));
  const after = digests(await compiledCiCacheKeys({ root, runtime }));
  assert.notEqual(after.d, before.d);
  for (const name of ['a', 'b', 'c']) assert.equal(after[name], before[name]);
});
test('equal receipts skip builds; mismatches and incomplete restores rebuild exactly the dependent closure', async t => {
  const root = fixture(t), { packages } = await compiledCiCacheKeys({ root, runtime });
  const calls: CiBuildTask[] = [], first = () => calls[0]!;
  const run = async (task: CiBuildTask) => {
    calls.push(task);
    for (const output of task.outputs ?? []) {
      const name = output.path.split('/')[1]!;
      if (!task.args.includes(name)) continue;
      for (const path of output.required) put(root, `${output.path}/${path}`, 'compiled');
    }
  };
  await buildCi({ root, mode: 'packages', packages, run });
  assert.deepEqual(calls[0]!.args, ['-r', '--filter', 'a', '--filter', 'b', '--filter', 'c', '--filter', 'd', 'build']);
  calls.splice(0);
  assert.equal((await buildCi({ root, mode: 'packages', packages, run }))[0]!.cached, true);
  assert.deepEqual(calls, []);
  const receiptFile = resolve(root, 'packages/a/dist/.ci-build-files.json');
  const original = readFileSync(receiptFile, 'utf8'), receipt = JSON.parse(original);
  receipt.digest = 'wrong'; writeFileSync(receiptFile, JSON.stringify(receipt));
  await buildCi({ root, mode: 'packages', packages, run });
  assert.deepEqual(first().args, ['-r', '--filter', 'a', '--filter', 'b', '--filter', 'c', 'build']);
  calls.splice(0);
  put(root, 'packages/a/dist/extra.js', 'stale');
  assert.equal(compiledOutputsValid(root, { path: 'packages/a/dist', required: ['index.js'] }, packages[0]!.digest), false);
  rmSync(resolve(root, 'packages/a/dist/extra.js'));
  rmSync(resolve(root, 'packages/a/dist/index.d.ts'));
  await buildCi({ root, mode: 'packages', packages, run });
  assert.deepEqual(first().args, ['-r', '--filter', 'a', '--filter', 'b', '--filter', 'c', 'build']);
  assert.deepEqual(packageRebuildClosure(packages, ['a']), ['a', 'b', 'c']);
});

test('a command that returns successfully without compiled outputs never writes valid receipts', async t => {
  const root = fixture(t), { packages } = await compiledCiCacheKeys({ root, runtime });
  await assert.rejects(buildCi({ root, mode: 'packages', packages, run: async () => {} }), /ENOENT/);
  assert.equal(compiledOutputsValid(root, { path: 'packages/a/dist', required: ['index.js'] }, packages[0]!.digest), false);
});

const record = (value: unknown): Record<string, unknown> => {
  assert.ok(value !== null && typeof value === 'object' && !Array.isArray(value)); return value as Record<string, unknown>;
};
test('all package consumers restore v3; exactly one lane saves; nebula uses receipts; aggregator remains strict', () => {
  const workflow = record(parse(readFileSync(resolve(import.meta.dirname, '../../workflows/universe.yml'), 'utf8')));
  const jobs = record(workflow.jobs);
  let consumers = 0, savers = 0;
  for (const [name, value] of Object.entries(jobs)) {
    const job = record(value), steps = job.steps;
    assert.ok(Array.isArray(steps));
    for (const value of steps) {
      const step = record(value);
      if (!step.with || record(step.with).path !== 'packages/*/dist') continue;
      const options = record(step.with);
      assert.equal(options.key, 'compiled-packages-v3-${{ steps.ci-cache-key.outputs.package_digest }}');
      if (String(step.uses).startsWith('actions/cache/save@')) { savers++; assert.equal(name, 'lint'); }
      else { consumers++; assert.match(String(step.uses), /^actions\/cache\/restore@/u); assert.equal(options['restore-keys'], 'compiled-packages-v3-'); }
    }
  }
  assert.equal(consumers, 6); assert.equal(savers, 1);
  const nebula = record(jobs.nebula);
  assert.ok((nebula.steps as unknown[]).some(value => record(value).run === 'node .github/scripts/ci/build-ci.mts packages'));
  const aggregator = record(jobs.universe);
  assert.equal(aggregator.name, 'Prepared universe and shared renderer');
  assert.deepEqual(aggregator.needs, ['changes', 'universe-checks']);
  assert.equal(record((aggregator.steps as unknown[])[0]).run, 'test "$RESULT" = success');
});

test('source mutations remove closure, root input and package isolation and each turns a regression red', { skip: Boolean(process.env.CI_CACHE_TEST_MODULES) }, t => {
  mkdirSync(resolve(import.meta.dirname, '../../../output'), { recursive: true });
  const directory = mkdtempSync(resolve(import.meta.dirname, '../../../output/ci-cache-mutants-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const cacheSource = readFileSync(resolve(import.meta.dirname, 'ci-cache-key.mts'), 'utf8');
  const buildSource = readFileSync(resolve(import.meta.dirname, 'build-ci.mts'), 'utf8');
  for (const [label, owner, from, to, pattern] of [
    ['closure', 'build', 'let changed = true;', 'let changed = false;', 'equal receipts'],
    ['root input', 'cache', 'selected: new Set(shared)', 'selected: new Set<string>()', 'root config input'],
    ['whole tree', 'cache', 'const digest = gitKey(root, canonical([identity, [...pkg.selected].sort().map(inputState), lockInputs(lock, pkg.directory), upstream]));', 'const digest = ciCacheKeys({ root, runtime }).buildDigest;', 'unrelated site'],
  ]) {
    const source = owner === 'build' ? buildSource : cacheSource;
    assert.ok(source.includes(from!), label);
    writeFileSync(resolve(directory, 'ci-cache-key.mts'), owner === 'cache' ? source.replace(from!, to!) : cacheSource);
    writeFileSync(resolve(directory, 'build-ci.mts'), owner === 'build' ? source.replace(from!, to!) : buildSource);
    const childEnvironment: NodeJS.ProcessEnv = { ...process.env, CI_CACHE_TEST_MODULES: directory };
    delete childEnvironment.NODE_TEST_CONTEXT;
    const result = spawnSync(process.execPath, ['--test', `--test-name-pattern=${pattern}`, resolve(import.meta.dirname, 'compiled-packages.test.mts')],
      { encoding: 'utf8', env: childEnvironment });
    assert.equal(result.status, 1, `${label}: ${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /not ok/u, label);
    assert.doesNotMatch(result.stderr, /SyntaxError|ERR_MODULE_NOT_FOUND/u, label);
  }
});
