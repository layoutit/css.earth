import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { projectRoot } from '@cssearth/core/node';

test('shapeLightingPath keeps output paths in the real checkout from another cwd and a symlink', async () => {
  const root = projectRoot(import.meta.url), temporary = await mkdtemp(resolve(tmpdir(), 'owner-paths-'));
  const alias = resolve(temporary, 'checkout');
  try {
    await symlink(root, alias, 'dir');
    const script = `
      import assert from 'node:assert/strict';
      import { resolve, relative } from 'node:path';
      const root = ${JSON.stringify(root)}, alias = ${JSON.stringify(alias)};
      const module = await import(${JSON.stringify(pathToFileURL(resolve(alias, 'packages/bake/src/refresh-shape-lighting/paths.ts')).href)});
      const values = ['src/objects/example/source', 'output/example', 'public/scenes/example', 'src/sources/example.json'].map(path => module.shapeLightingPath(path));
      assert.deepEqual(values, ['src/objects/example/source', 'output/example', 'public/scenes/example', 'src/sources/example.json'].map(path => resolve(root, path)));
      assert.ok(values.every(path => !relative(root, path).startsWith('../')));
      console.log('OWNER_PATHS_OK');
    `;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: temporary, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /OWNER_PATHS_OK/u);
  } finally { await rm(temporary, { recursive: true, force: true }); }
});
