import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { projectRoot } from '@cssearth/core/node';
import { loadObjectTestDefinition } from '@cssearth/objects/node/contract';

const required: { loadObjectTestDefinition: typeof loadObjectTestDefinition } = createRequire(import.meta.url)('@cssearth/objects/node/contract');
for (const [format, load] of [['ESM', loadObjectTestDefinition], ['CJS', required.loadObjectTestDefinition]] as const) {
  test(`${format} object contract resolves its default checkout and accepts an explicit root`, async () => {
    // A missing fixture must reach the filesystem, rather than fail on an undefined import.meta.url.
    await assert.rejects(load('missing-contract-fixture'), (error: unknown) => error instanceof Error && 'code' in error && error.code === 'ENOENT' && 'path' in error
      && error.path === resolve(projectRoot(import.meta.url), 'src/objects/missing-contract-fixture/prepared/runtime.json'));
    const root = await mkdtemp(resolve(tmpdir(), 'object-contract-'));
    try {
      const directory = resolve(root, 'src/objects/fixture/prepared');
      await mkdir(directory, { recursive: true });
      await writeFile(resolve(directory, 'runtime.json'), '{"fixture":true}');
      assert.deepEqual(await load('fixture', root), { fixture: true });
    } finally { await rm(root, { recursive: true, force: true }); }
  });
}
