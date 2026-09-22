import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { restoreObjectJson } from './restore-object-json.mts';

test('restores a missing transport from its pinned runtime without rebaking or repinning', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'cssearth-json-restore-'));
  try {
    const directory = resolve(root, 'src/objects/thetis');
    await mkdir(resolve(directory, 'prepared'), { recursive: true });
    for (const file of ['object.json', 'prepared/runtime.json']) {
      await copyFile(new URL(`../../src/objects/thetis/${file}`, import.meta.url), resolve(directory, file));
    }
    const descriptorBytes = await readFile(resolve(directory, 'object.json'));
    const descriptor = JSON.parse(descriptorBytes.toString('utf8'));
    const target = resolve(directory, descriptor.prepared.url);
    assert.deepEqual(await restoreObjectJson(['thetis'], root), { objects: 1, written: 1, skipped: 0, reused: 0 });
    const bytes = await readFile(target);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), descriptor.prepared.sha256);
    await utimes(target, 1, 1);
    assert.deepEqual(await restoreObjectJson(['thetis'], root), { objects: 1, written: 0, skipped: 0, reused: 1 });
    assert.equal((await stat(target)).mtimeMs, 1000);
    const runtimePath = resolve(directory, 'prepared/runtime.json');
    const runtime = JSON.parse(await readFile(runtimePath, 'utf8'));
    await writeFile(runtimePath, JSON.stringify({ ...runtime, changed: true }));
    await assert.rejects(restoreObjectJson(['thetis'], root), /does not reproduce.*pin/);
    assert.deepEqual(await readFile(target), bytes, 'a mismatch must not replace the transport');
    assert.deepEqual(await readFile(resolve(directory, 'object.json')), descriptorBytes, 'restoration never changes descriptor pins');
  } finally { await rm(root, { recursive: true, force: true }); }
});
