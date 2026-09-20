import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';

// CI invokes this file directly. Bundle the typed cases just as the preparation runner does,
// so renderer-source .js imports resolve to their TypeScript owners without a runtime loader.
test('objects executes all 6 typed application cases', async t => {
  const root = process.cwd(), parent = resolve(root, '.local/nebula-application-tests');
  await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(resolve(parent, 'objects-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const outfile = resolve(directory, 'cases.test.mjs');
  await build({ entryPoints: [resolve(root, 'tools/nebula/application/objects.cases.ts')], outfile,
    bundle: true, platform: 'node', format: 'esm', target: 'node22', packages: 'external',
    plugins: [{ name: 'retain-native-modules', setup(builder) {
      builder.onResolve({ filter: /\.m[jt]s$/ }, args => ({ path: resolve(args.resolveDir, args.path), external: true }));
    } }],
  });
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, ['--test', outfile], { cwd: root, env, encoding: 'utf8', timeout: 30000 });
  if (result.error) throw result.error;
  const output = result.stdout + result.stderr;
  assert.equal(result.status, 0, output);
  assert.match(output, /# tests 6\b/, output);
  assert.match(output, /# pass 6\b/, output);
  assert.match(output, /# fail 0\b/, output);
  console.log(output);
});
