import { projectRoot } from '@cssearth/core/node';
import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';

// CI invokes this file directly. Bundle the typed cases just as the preparation runner does,
// while keeping native modules external.
test('element-budget executes all 9 typed application cases', async t => {
  const root = projectRoot(import.meta.url), parent = resolve(root, '.local/nebula-application-tests');
  await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(resolve(parent, 'element-budget-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const outfile = resolve(directory, 'cases.test.mjs');
  await build({ entryPoints: [resolve(root, 'packages/bake/src/nebula/fixtures/element-budget.cases.mts')], outfile,
    bundle: true, platform: 'node', format: 'esm', target: 'node22', packages: 'external',
    plugins: [{ name: 'retain-native-modules', setup(builder) {
      builder.onResolve({ filter: /\.m[jt]s$/ }, args => args.kind === 'entry-point' ? undefined : ({ path: resolve(args.resolveDir, args.path), external: true }));
    } }],
  });
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, ['--test', outfile], { cwd: root, env, encoding: 'utf8', timeout: 30000 });
  if (result.error) throw result.error;
  const output = result.stdout + result.stderr;
  assert.equal(result.status, 0, output);
  assert.match(output, /(?:#|ℹ) tests 9\b/, output);
  assert.match(output, /(?:#|ℹ) pass 9\b/, output);
  assert.match(output, /(?:#|ℹ) fail 0\b/, output);
  console.log(output);
});
