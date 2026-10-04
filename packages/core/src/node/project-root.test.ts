import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { projectRoot } from './index.js';

it('projectRoot walks up to the directory that holds pnpm-workspace.yaml', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
  assert.equal(projectRoot(import.meta.url), root);
  assert.equal(projectRoot(pathToFileURL(join(root, 'packages/core/src/index.ts'))), root);
});

it('projectRoot resolves a symlinked checkout before walking to its workspace marker', async () => {
  const temporary = await realpath(await mkdtemp(join(tmpdir(), 'project-root-link-')));
  try {
    const checkout = join(temporary, 'checkout'), link = join(temporary, 'linked-checkout');
    await mkdir(join(checkout, 'packages/core/src'), { recursive: true });
    await mkdir(join(checkout, 'packages/bake/dist'), { recursive: true });
    await mkdir(join(checkout, 'packages/objects/src/node'), { recursive: true });
    await writeFile(join(checkout, 'pnpm-workspace.yaml'), 'packages: [packages/*]\n');
    await symlink(checkout, link);
    for (const module of ['packages/core/src/index.ts', 'packages/bake/dist/sources.js', 'packages/objects/src/node/source-test.ts']) {
      assert.equal(projectRoot(pathToFileURL(join(link, module))), checkout, module);
    }
  } finally { await rm(temporary, { recursive: true, force: true }); }
});
