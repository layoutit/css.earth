import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { test, type TestContext } from 'node:test';
import { sourceCheckMode, sourceTestGeneratedPaths } from './source-test-inputs.mts';
import { requireRecord, requireString } from './source-values.mts';

test('source input mode remains explicit and unknown modes cannot suppress assertions', () => {
  assert.equal(sourceCheckMode('author'), 'author');
  assert.equal(sourceCheckMode('published'), 'published');
  assert.throws(() => sourceCheckMode('fast'), /Unknown source check mode/);
});

test('published closure exceptions allow only consumed provenance metadata, never other inventoried assets', async () => {
  const paths = await sourceTestGeneratedPaths('published');
  assert.ok(paths.length > 0, 'The real prepared source packages must be consumed.');
  // A body's page.json is written from its restored runtime on every checkout; a package's two metadata records are the other consumed generated inputs.
  for (const path of paths) assert.match(path, /^src\/objects\/[^/]+\/prepared\/(page|provenance|presentation)\.json$/u);
});

async function fixture(t: TestContext) {
  const root = await mkdtemp(resolve(tmpdir(), 'cssearth-native-source-tests-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const write = async (path: string, source: string) => {
    await mkdir(dirname(resolve(root, path)), { recursive: true });
    await writeFile(resolve(root, path), source);
  };
  const packageJson = requireRecord(JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')));
  const scripts = requireRecord(packageJson.scripts);
  await write('package.json', JSON.stringify({ private: true, type: 'module', packageManager: requireString(packageJson.packageManager), scripts: {
    ...Object.fromEntries(['test:sources', 'test:sources:pr', 'test:sources:checks'].map(name => [name, requireString(scripts[name])])),
    'prepare:catalog': 'node tools/fixture-prepare.mts catalogue',
    'prepare:sources': 'node tools/fixture-prepare.mts author',
  } }));
  await write('tools/fixture-prepare.mts', "import { appendFileSync } from 'node:fs'; appendFileSync('events.log', process.argv[2] + '\\n');");
  await write('tools/prepare/prepare-facilities.mts', "import assert from 'node:assert/strict'; import { appendFileSync } from 'node:fs'; assert.deepEqual(process.argv.slice(2), ['--catalog-only']); appendFileSync('events.log', 'published\\n');");
  const run = (script: string) => new Promise<{ code: number; output: string }>((accept, reject) => {
    // Remove node:test's inherited child-process marker: this fixture launches a genuinely independent
    // native runner, rather than becoming an unreported nested test process inside the parent suite.
    const { NODE_TEST_CONTEXT: _context, ...env } = process.env;
    execFile('pnpm', ['run', script], { cwd: root, env, maxBuffer: 1024 * 1024, timeout: 30_000 }, (error, stdout, stderr) => {
      if (!error) accept({ code: 0, output: stdout + stderr });
      else if (typeof error.code === 'number') accept({ code: error.code, output: stdout + stderr });
      else reject(error);
    });
  });
  return { root, write, run };
}

test('native quoted globs automatically execute a newly added matching test and propagate its failure', async t => {
  const { write, run } = await fixture(t);
  await write('src/platform/source-existing.test.mts', "import test from 'node:test'; test('native-existing-sentinel', () => {});");
  const first = await run('test:sources:checks');
  assert.equal(first.code, 0, first.output);
  assert.match(first.output, /ok \d+ - native-existing-sentinel/u);
  await write('tools/source-new-contract.test.mts', "import test from 'node:test'; import assert from 'node:assert/strict'; test('native-new-file-sentinel', () => assert.fail('native-discovery-failure'));");
  const added = await run('test:sources:checks');
  assert.notEqual(added.code, 0, added.output);
  assert.match(added.output, /not ok \d+ - native-new-file-sentinel/u);
  assert.match(added.output, /native-discovery-failure/u);
});

test('native discovery covers every configured source family without admitting volume or context authoring', async t => {
  const { write, run } = await fixture(t);
  const samples = ['src/platform/exploration-future.test.mts', 'tools/future-factsheet.test.mts',
    'tools/future-provenance-contract.test.mts', 'site/test/future-sources.test.mts',
    'site/test/future-facilities.test.mts', 'tools/objects/surface-observations/future.test.mts'];
  for (const [index, path] of samples.entries()) await write(path,
    `import test from 'node:test'; test('native-family-${index}', () => {});`);
  // This legacy filename crosses the provenance-contract family. It is an explicit execution exception,
  // not a filename inventory of the suite; new ordinary checks belong to the matching naming families.
  await write('tools/contract/object-provenance.test.mts', "import test from 'node:test'; test('native-legacy-provenance', () => {});");
  for (const path of ['tools/contract/context-provenance.test.mts', 'tools/prepare/prepare-volume-provenance.test.mts'])
    await write(path, "throw new Error('authoring-only-must-not-run');");
  const result = await run('test:sources:checks');
  assert.equal(result.code, 0, result.output);
  for (const index of samples.keys()) assert.match(result.output, new RegExp(`ok \\d+ - native-family-${index}`, 'u'));
  assert.match(result.output, /ok \d+ - native-legacy-provenance/u);
  assert.doesNotMatch(result.output, /authoring-only-must-not-run/u);
});

test('actual pnpm source gates run identical discovered assertions after distinct real-mode prerequisites', async t => {
  const { root, write, run } = await fixture(t);
  await write('src/platform/source-mode.test.mts', `import test from 'node:test'; import { appendFileSync } from 'node:fs';
    test('native-source-mode-sentinel', () => appendFileSync('events.log', 'assertions:' + process.env.CSSEARTH_SOURCE_CHECK_MODE + '\\n'));`);
  for (const [script, mode] of [['test:sources', 'author'], ['test:sources:pr', 'published']]) {
    await write('events.log', '');
    const result = await run(script!);
    assert.equal(result.code, 0, result.output);
    assert.match(result.output, /ok \d+ - native-source-mode-sentinel/u);
    assert.deepEqual((await readFile(resolve(root, 'events.log'), 'utf8')).trim().split('\n'), ['catalogue', mode, `assertions:${mode}`]);
  }
});
