import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { staleBuilds } from './check-stale-builds.mts';

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
