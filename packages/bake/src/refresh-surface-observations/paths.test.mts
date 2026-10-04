import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { projectRoot } from '@cssearth/core/node';

test('refreshObservationControls reads its descriptor in the real checkout from another cwd and a symlink', async () => {
  const root = projectRoot(import.meta.url), temporary = await mkdtemp(resolve(tmpdir(), 'owner-paths-'));
  const alias = resolve(temporary, 'checkout');
  try {
    await symlink(root, alias, 'dir');
    const script = `
      import assert from 'node:assert/strict';
      import { resolve, relative } from 'node:path';
      const root = ${JSON.stringify(root)}, alias = ${JSON.stringify(alias)};
      const module = await import(${JSON.stringify(pathToFileURL(resolve(alias, 'packages/bake/dist/refresh-surface-observations.js')).href)});
      await assert.rejects(module.refreshObservationControls('nonexistent-path-fixture', [], new Map()), error => {
        assert.equal(error.code, 'ENOENT');
        assert.equal(error.path, resolve(root, 'src/objects/nonexistent-path-fixture/object.json'));
        return true;
      });
      await assert.rejects(module.refreshObservationControls('nonexistent-path-fixture', [], new Map(), resolve(root, 'output')), error => {
        assert.equal(error.code, 'ENOENT');
        assert.equal(error.path, resolve(root, 'output/src/objects/nonexistent-path-fixture/object.json'));
        return true;
      });
      console.log('OWNER_PATHS_OK');
    `;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: temporary, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /OWNER_PATHS_OK/u);
  } finally { await rm(temporary, { recursive: true, force: true }); }
});
