import assert from 'node:assert/strict';
import { mkdtemp, realpath, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { projectRoot } from '@cssearth/core/node';
import { checkoutRoot, root } from '@cssearth/bake/sources/astronomy-data';

test('bake checkout paths agree with core and objects module locations through a symlinked checkout', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'bake-checkout-link-'));
  try {
    const actual = await realpath(projectRoot(import.meta.url)), link = join(temporary, 'checkout');
    await symlink(actual, link);
    assert.equal(checkoutRoot, actual);
    assert.equal(root, resolve(actual, 'src/sources/astronomy-data'));
    for (const module of ['packages/bake/src/sources/astronomy-data/model.ts', 'packages/objects/src/node/source-test.ts']) {
      assert.equal(projectRoot(pathToFileURL(join(link, module))), checkoutRoot, module);
    }
  } finally { await rm(temporary, { recursive: true, force: true }); }
});
