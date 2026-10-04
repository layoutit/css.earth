import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { projectRoot } from '@cssearth/core/node';

test('skyAuthorPaths keeps output paths in the real checkout from another cwd and a symlink', async () => {
  const root = projectRoot(import.meta.url), temporary = await mkdtemp(resolve(tmpdir(), 'owner-paths-'));
  const alias = resolve(temporary, 'checkout');
  try {
    await symlink(root, alias, 'dir');
    const script = `
      import assert from 'node:assert/strict';
      import { resolve, relative } from 'node:path';
      const root = ${JSON.stringify(root)}, alias = ${JSON.stringify(alias)};
      const module = await import(${JSON.stringify(pathToFileURL(resolve(alias, 'packages/telescope-cli/src/sky/author-sky-bands.mts')).href)});
      const recipe = module.skyAuthorPaths('package.json');
      assert.equal(recipe.root, root);
      assert.equal(recipe.recipePath, resolve(root, 'package.json'));
      assert.equal(recipe.cache, resolve(root, '.local/nebula-lab/sky-bands'));
      assert.deepEqual(module.skyAuthorPaths(resolve(alias, 'package.json')), recipe);
      assert.equal(module.skyAuthorPaths('package.json', 'output/cache').cache, resolve(root, 'output/cache'));
      assert.ok(!relative(recipe.root, recipe.recipePath).startsWith('../'));
      console.log('OWNER_PATHS_OK');
    `;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: temporary, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /OWNER_PATHS_OK/u);
  } finally { await rm(temporary, { recursive: true, force: true }); }
});
