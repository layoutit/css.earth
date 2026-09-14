import assert from 'node:assert/strict';
import { copyFile, mkdtemp, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { finalizeObjectJson } from '../../tools/prepare-object-json.mts';
import { listSharedBankFiles } from '../../src/platform/prepared-shared-banks.mts';
import { requireRecord } from '../../tools/source-values.mts';
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
async function snapshot(objectDirectory: string) {
  const files = ['object.json', ...(await readdir(resolve(objectDirectory, 'prepared'), { withFileTypes: true }))
    .filter(entry => entry.isFile()).map(entry => `prepared/${entry.name}`)];
  return Promise.all(files.sort().map(async path => [path, digest(await readFile(resolve(objectDirectory, path)))]));
}

test('real Mimas finalization stays staged and reproduces its finalized runtime', async () => {
  const root = resolve(import.meta.dirname, '../..'), objectDirectory = resolve(root, 'src/objects/mimas');
  const original = await snapshot(objectDirectory), banks = await listSharedBankFiles(root);
  const runtime: unknown = JSON.parse(await readFile(resolve(objectDirectory, 'prepared/runtime.json'), 'utf8'));
  const stage = await mkdtemp(resolve(tmpdir(), 'cssearth-finalization-'));
  try {
    const preparedDirectory = resolve(stage, 'prepared'); await mkdir(preparedDirectory);
    await copyFile(resolve(objectDirectory, 'prepared/scene.json'), resolve(preparedDirectory, 'scene.json'));
    const finalized = await finalizeObjectJson('mimas', runtime, { projectRoot: root, objectDirectory, preparedDirectory,
      descriptorPath: resolve(stage, 'object.json'), sharedRoot: stage });
    assert.deepEqual(finalized.definition, runtime);
    const descriptor = requireRecord(JSON.parse(await readFile(resolve(stage, 'object.json'), 'utf8')));
    const payload = await readFile(resolve(preparedDirectory, 'object.json'));
    assert.equal(requireRecord(descriptor.prepared).sha256, digest(payload));
    assert.equal(requireRecord(requireRecord(descriptor.properties).page).metadata !== undefined, true);
    assert.deepEqual(await snapshot(objectDirectory), original);
    assert.deepEqual(await listSharedBankFiles(root), banks, 'finalization must not publish shared dependencies');
    assert.ok((await listSharedBankFiles(stage)).length > 0);
  } finally { await rm(stage, { recursive: true, force: true }); }
});
