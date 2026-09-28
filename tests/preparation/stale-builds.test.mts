import assert from 'node:assert/strict';
import { sourceTest } from '../objects/source-test.mts';
const test = sourceTest();
import { mkdtemp, mkdir, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BUILD_RULES, rebuildStale, staleBuilds, staleInstall } from '@cssearth/bake/preparation';

test('a build is stale when a compiled source is newer than its output or the output is missing', async () => {
  const root = await mkdtemp(join(tmpdir(), 'stale-builds-'));
  try {
    await mkdir(join(root, 'pkg/src/nested'), { recursive: true }); await mkdir(join(root, 'pkg/dist'), { recursive: true });
    await writeFile(join(root, 'pkg/src/nested/a.ts'), 'export {}'); await writeFile(join(root, 'pkg/dist/index.js'), '');
    await writeFile(join(root, 'pkg/src/nested/a.test.ts'), 'test');
    const rules = [{ name: 'pkg', command: 'build pkg', sources: ['pkg/src'], output: 'pkg/dist/index.js' },
      { name: 'missing', command: 'build missing', sources: ['pkg/src'], output: 'nowhere/index.js' }];
    await utimes(join(root, 'pkg/src/nested/a.ts'), 1000, 1000); await utimes(join(root, 'pkg/src/nested/a.test.ts'), 5000, 5000);
    await utimes(join(root, 'pkg/dist/index.js'), 2000, 2000);
    assert.deepEqual((await staleBuilds(root, rules)).map(build => build.name), ['missing'], 'an output newer than its sources is current; test files do not count');
    await utimes(join(root, 'pkg/src/nested/a.ts'), 3000, 3000);
    const stale = await staleBuilds(root, rules);
    assert.deepEqual(stale.map(build => [build.name, build.command]), [['pkg', 'build pkg'], ['missing', 'build missing']]);
    assert.match(stale[0]!.reason, /pkg\/src changed after pkg\/dist\/index.js/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('--run rebuilds only the stale builds, in rule order, and nothing when they are current', async () => {
  const root = await mkdtemp(join(tmpdir(), 'rebuild-stale-'));
  try {
    await mkdir(join(root, 'a/src'), { recursive: true }); await mkdir(join(root, 'a/dist'), { recursive: true });
    await mkdir(join(root, 'b/src'), { recursive: true }); await mkdir(join(root, 'b/dist'), { recursive: true });
    await writeFile(join(root, 'a/src/a.ts'), 'export {}'); await writeFile(join(root, 'a/dist/index.js'), '');
    await writeFile(join(root, 'b/src/b.ts'), 'export {}'); await writeFile(join(root, 'b/dist/index.js'), '');
    const rules = [{ name: 'a', command: 'build a', sources: ['a/src'], output: 'a/dist/index.js' },
      { name: 'b', command: 'build b', sources: ['b/src'], output: 'b/dist/index.js' },
      { name: 'c', command: 'build c', sources: ['a/src'], output: 'nowhere/index.js' }];

    // `a` is current, `b` has a newer source, `c` has no output at all.
    await utimes(join(root, 'a/src/a.ts'), 1000, 1000); await utimes(join(root, 'a/dist/index.js'), 2000, 2000);
    await utimes(join(root, 'b/src/b.ts'), 3000, 3000); await utimes(join(root, 'b/dist/index.js'), 2000, 2000);
    const ran: string[] = [];
    const rebuilt = await rebuildStale(root, rules, async command => { ran.push(command); });
    // Rule order is preserved so a dependent build never runs before its dependency.
    assert.deepEqual(ran, ['build b', 'build c'], 'only the stale rules run, in rule order');
    assert.deepEqual(rebuilt.map(build => build.name), ['b', 'c']);

    // Nothing stale: no command is dispatched at all. This is the warm `pnpm dev` path.
    await utimes(join(root, 'b/dist/index.js'), 4000, 4000);
    const current: string[] = [];
    assert.deepEqual(await rebuildStale(root, rules.slice(0, 2), async command => { current.push(command); }), []);
    assert.deepEqual(current, [], 'a current tree dispatches no build');

    // A failing build propagates rather than being reported as rebuilt.
    await utimes(join(root, 'b/src/b.ts'), 9000, 9000);
    await assert.rejects(rebuildStale(root, rules.slice(0, 2), async () => { throw new Error('tsup failed'); }), /tsup failed/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a package rule follows the rules of the workspace packages it depends on, so --run never builds it first', async () => {
  const order = new Map(BUILD_RULES.map((rule, index) => [rule.name, index]));
  for (const rule of BUILD_RULES.filter(rule => rule.name.startsWith('@cssearth/'))) {
    const manifest = JSON.parse(await readFile(new URL(`../../packages/${rule.name.slice('@cssearth/'.length)}/package.json`, import.meta.url), 'utf8')) as
      { dependencies?: Record<string, string> };
    for (const dependency of Object.keys(manifest.dependencies ?? {}).filter(name => order.has(name)))
      assert.ok(order.get(dependency)! < order.get(rule.name)!, `${rule.name} is rebuilt before its dependency ${dependency}.`);
  }
});

test('with the engine and the bake both stale, --run rebuilds the engine first', async () => {
  const root = await mkdtemp(join(tmpdir(), 'rebuild-stale-order-'));
  try {
    for (const rule of BUILD_RULES) {
      for (const source of rule.sources) { await mkdir(join(root, source), { recursive: true }); await writeFile(join(root, source, 'index.ts'), 'export {}'); await utimes(join(root, source, 'index.ts'), 1000, 1000); }
      await mkdir(join(root, rule.output, '..'), { recursive: true }); await writeFile(join(root, rule.output), '');
      await utimes(join(root, rule.output), 2000, 2000);
      if (rule.inputs) { await writeFile(join(root, rule.inputs), JSON.stringify({ inputs: {} })); await utimes(join(root, rule.inputs), 2000, 2000); }
    }
    for (const name of ['engine', 'bake']) await utimes(join(root, `packages/${name}/src/index.ts`), 3000, 3000);
    const ran: string[] = [];
    await rebuildStale(root, BUILD_RULES, async command => { ran.push(command); });
    assert.deepEqual(ran, ['pnpm --filter @cssearth/engine build', 'pnpm build:bake']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('every root script a build rule runs exists in package.json', async () => {
  const { scripts } = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')) as { scripts: Record<string, string> };
  for (const rule of BUILD_RULES) {
    const script = /^pnpm (?!--)(\S+)$/u.exec(rule.command)?.[1];
    if (script) assert.ok(script in scripts, `${rule.name} runs "${rule.command}", but package.json has no "${script}" script.`);
  }
});

test('a bundle is stale when any file its last build read changed, even outside the declared directories', async () => {
  const root = await mkdtemp(join(tmpdir(), 'stale-metafile-'));
  try {
    await mkdir(join(root, 'tools/bundle/dist'), { recursive: true }); await mkdir(join(root, 'site'), { recursive: true });
    await mkdir(join(root, 'packages/engine'), { recursive: true });
    await writeFile(join(root, 'tools/bundle/entry.ts'), 'export {}'); await writeFile(join(root, 'site/imported.mts'), 'export {}');
    await writeFile(join(root, 'tools/bundle/dist/index.js'), '');
    // tsup runs from the engine package, so the metafile's paths are relative to it; node_modules inputs are not ours.
    await writeFile(join(root, 'tools/bundle/dist/metafile-esm.json'), JSON.stringify({ inputs: {
      '../../tools/bundle/entry.ts': {}, '../../site/imported.mts': {}, '../../node_modules/x/index.js': {} } }));
    const rules = [{ name: 'bundle', command: 'build bundle', sources: ['tools/bundle'], output: 'tools/bundle/dist/index.js', inputs: 'tools/bundle/dist/metafile-esm.json', base: 'packages/engine' }];
    await utimes(join(root, 'tools/bundle/entry.ts'), 1000, 1000); await utimes(join(root, 'site/imported.mts'), 1000, 1000);
    await utimes(join(root, 'tools/bundle/dist/index.js'), 2000, 2000);
    assert.deepEqual(await staleBuilds(root, rules), [], 'every input is older than the output');

    await utimes(join(root, 'site/imported.mts'), 3000, 3000);
    const stale = await staleBuilds(root, rules);
    assert.match(stale[0]!.reason, /site\/imported\.mts changed after/u, 'an import outside tools/bundle marks it stale');

    await rm(join(root, 'tools/bundle/dist/metafile-esm.json'));
    assert.match((await staleBuilds(root, rules))[0]!.reason, /metafile-esm\.json is missing/u, 'a build without its input record is stale');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a bake build whose tsc pass failed reads stale: tsup wrote the JavaScript, but the declaration stub is missing', async () => {
  const root = await mkdtemp(join(tmpdir(), 'stale-bake-types-'));
  try {
    const rule = BUILD_RULES.find(candidate => candidate.name === '@cssearth/bake');
    assert.ok(rule);
    await mkdir(join(root, 'packages/bake/src'), { recursive: true }); await mkdir(join(root, 'packages/bake/dist'), { recursive: true });
    await writeFile(join(root, 'packages/bake/src/index.ts'), 'export {}');
    // tsup cleaned dist and wrote the bundle and its metafile; `tsc` then failed, so no declarations or stubs were written.
    await writeFile(join(root, 'packages/bake/dist/volume.js'), ''); await writeFile(join(root, 'packages/bake/dist/metafile-esm.json'), '{"inputs":{}}');
    await utimes(join(root, 'packages/bake/src/index.ts'), 1000, 1000);
    for (const file of ['volume.js', 'metafile-esm.json']) await utimes(join(root, 'packages/bake/dist', file), 2000, 2000);
    assert.deepEqual((await staleBuilds(root, [rule])).map(build => build.reason), ['packages/bake/dist/volume.d.ts is missing']);
    await writeFile(join(root, 'packages/bake/dist/volume.d.ts'), '');
    await utimes(join(root, 'packages/bake/dist/volume.d.ts'), 2000, 2000);
    assert.deepEqual(await staleBuilds(root, [rule]), [], 'with the stub written last, the build is current');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('an install older than pnpm-lock.yaml is named with the command that fixes it, before a tool fails on a missing package', async () => {
  const root = await mkdtemp(join(tmpdir(), 'stale-install-'));
  try {
    assert.equal(await staleInstall(root), null, 'a directory without a lockfile is not a pnpm checkout');
    await writeFile(join(root, 'pnpm-lock.yaml'), "lockfileVersion: '9.0'\n");
    assert.equal(await staleInstall(root), 'node_modules holds no pnpm install; run pnpm install --frozen-lockfile');
    await mkdir(join(root, 'node_modules/.pnpm'), { recursive: true });
    await writeFile(join(root, 'node_modules/.pnpm/lock.yaml'), "lockfileVersion: '9.0'\n");
    assert.equal(await staleInstall(root), null);
    // main added a workspace package (@cssearth/telescope) that this install never linked.
    await writeFile(join(root, 'pnpm-lock.yaml'), "lockfileVersion: '9.0'\nimporters:\n  .:\n    dependencies:\n      '@cssearth/telescope':\n        specifier: workspace:*\n");
    assert.equal(await staleInstall(root), 'pnpm-lock.yaml changed after the last install; run pnpm install --frozen-lockfile');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the stale-build check loads from source with Node built-ins alone, so it runs while the bake itself is unbuilt', async () => {
  const importsOf = async (path: string) => [...(await readFile(new URL(`../../${path}`, import.meta.url), 'utf8'))
    .matchAll(/^\s*(?:import|export)\b[^'"]*?\bfrom\s+['"]([^'"]+)['"]|^\s*import\s+['"]([^'"]+)['"]/gmu)].map(match => match[1] ?? match[2]);
  const library = await importsOf('packages/bake/src/preparation/stale-builds.ts');
  assert.ok(library.length > 0, 'the library imports Node built-ins');
  assert.deepEqual(library.filter(specifier => !specifier!.startsWith('node:')), [], 'stale-builds.ts imports only node: built-ins');
  assert.deepEqual(await importsOf('packages/bake/cli/check-stale-builds.mts'), ['../src/preparation/stale-builds.ts'],
    'the command loads the library from source, not through the built entry');
});

test('a build command streams to the terminal, so no output size fails it, and a failing build still fails', async () => {
  // The runner inherits its caller's stdio; run it in a child whose output this test drains, as a terminal would.
  const { spawnSync } = await import('node:child_process');
  const runner = (command: string) => spawnSync(process.execPath, ['--input-type=module', '-e',
    `import { runBuildCommand } from '@cssearth/bake/preparation'; await runBuildCommand(${JSON.stringify(command)});`],
  { cwd: new URL('../..', import.meta.url), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const node = JSON.stringify(process.execPath);
  const large = runner(`${node} -e "process.stdout.write('x'.repeat(3 * 1024 * 1024))"`);
  assert.equal(large.status, 0, large.stderr);
  assert.equal(large.stdout.length, 3 * 1024 * 1024, 'the 3 MiB of build output reached the terminal');
  const failing = runner(`${node} -e "process.exit(3)"`);
  assert.notEqual(failing.status, 0);
  assert.match(failing.stderr, /exited with status 3/u);
});
