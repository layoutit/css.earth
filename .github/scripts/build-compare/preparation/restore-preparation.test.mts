/** Warm-cache wildcard membership must match the committed prepared inventory. */
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { prunePreparedExtras } from './restore-preparation.mts';
test('prune only uninventoried prepared files before restoring; preserve listed and source bytes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'comparison-cache-'));
  try {
    const directory = join(root, 'src/objects/body');
    await mkdir(join(directory, 'prepared/minimaps'), { recursive: true });
    await writeFile(join(directory, 'inventory.json'), JSON.stringify({ assets: [{ location: 'prepared', filename: 'minimaps/kept.webp' }] }));
    await writeFile(join(directory, 'object.json'), 'source');
    await writeFile(join(directory, 'prepared/minimaps/kept.webp'), 'pinned');
    await writeFile(join(directory, 'prepared/minimaps/obsolete.webp'), 'obsolete');
    assert.deepEqual(await prunePreparedExtras(root), ['body/prepared/minimaps/obsolete.webp']);
    assert.equal(await readFile(join(directory, 'prepared/minimaps/kept.webp'), 'utf8'), 'pinned');
    assert.equal(await readFile(join(directory, 'object.json'), 'utf8'), 'source');
    assert.deepEqual(await prunePreparedExtras(root), []);
    const source = await readFile(new URL('./restore-preparation.mts', import.meta.url), 'utf8');
    assert.ok(source.indexOf('await prunePreparedExtras(root)') < source.indexOf("await setupAssets(['--location=prepared'], root)"));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('prune removes a retired object the cache still carries, and keeps a live object without an inventory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'comparison-cache-'));
  try {
    const retired = join(root, 'src/objects/retired'), live = join(root, 'src/objects/live');
    await mkdir(join(retired, 'prepared'), { recursive: true });
    await writeFile(join(retired, 'prepared/controls.json'), '{}');
    await mkdir(join(live, 'prepared'), { recursive: true });
    await writeFile(join(live, 'README.md'), 'source');
    await writeFile(join(live, 'prepared/scene.json'), '{}');
    assert.deepEqual(await prunePreparedExtras(root), ['retired/']);
    await assert.rejects(readFile(join(retired, 'prepared/controls.json')));
    assert.equal(await readFile(join(live, 'prepared/scene.json'), 'utf8'), '{}');
  } finally { await rm(root, { recursive: true, force: true }); }
});
