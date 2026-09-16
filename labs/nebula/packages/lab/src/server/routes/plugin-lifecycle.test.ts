import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { reconstructionPlugin } from '../services/density-reconstruction.ts';
import { starRemovalPlugin } from '../services/star-removal.ts';

test('constructing plugin configuration does not initialize or recover job storage', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nebula-plugin-lifecycle-'));
  try {
    assert.equal(reconstructionPlugin(root).name, 'nebula-reconstruction');
    assert.equal(starRemovalPlugin(root).name, 'nebula-local-star-removal-nox');
    // The former eager initialization scheduled filesystem writes immediately.
    await setTimeout(50);
    assert.deepEqual(await readdir(root), []);
  } finally { await rm(root, { recursive: true, force: true }); }
});
