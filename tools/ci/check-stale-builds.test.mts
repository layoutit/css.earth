import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { mkdtemp, mkdir, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rebuildStale, staleBuilds } from './check-stale-builds.mts';

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
