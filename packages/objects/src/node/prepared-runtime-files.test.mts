import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { LEAF_BOXES_FILE, joinPreparedRuntimeText, readPreparedRuntimeText, splitPreparedRuntimeText, storePreparedRuntime } from './prepared-runtime-files.ts';

const boxes = [{ node: 5, density: 0.003155, box: [65, 65], matrix: 'matrix3d(6.802554092307693,-0.6699933538461539,0,0)' }, { node: 6, box: [1e-7, -0.5] }];
const runtime = (bindings: unknown[]) => `${JSON.stringify({ schema: 'cssearth-object-runtime@5', camera: {}, viewBindings: bindings, id: 'body', motion: [] })}\n`;
const baked = runtime([{ kind: 'silhouette-fit', target: 1 }, { kind: 'silhouette-step-property', levels: [1], boxes }, { kind: 'interior-disc' }]);

test('a runtime splits into a reference and its leaf boxes, and joins back byte for byte', async () => {
  const split = splitPreparedRuntimeText(baked);
  assert.ok(split);
  assert.equal(split.leafBoxes, `${JSON.stringify(boxes)}\n`);
  assert.equal(split.runtime.includes('matrix3d'), false);
  assert.deepEqual(JSON.parse(split.runtime).viewBindings[1].boxes, { file: LEAF_BOXES_FILE });
  assert.equal(await joinPreparedRuntimeText(split.runtime, () => split.leafBoxes), baked);
  assert.equal(await joinPreparedRuntimeText(baked, () => { throw new Error('an inline runtime reads no file'); }), baked);
});

test('a runtime without exactly one list of leaf boxes is not split', () => {
  assert.equal(splitPreparedRuntimeText(runtime([{ kind: 'silhouette-fit' }])), null);
  assert.equal(splitPreparedRuntimeText(runtime([{ boxes }, { boxes }])), null);
  assert.equal(splitPreparedRuntimeText(splitPreparedRuntimeText(baked)!.runtime), null);
});

test('a prepared directory stores the split form and reads back the baked text', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'prepared-runtime-'));
  t.after(() => rm(directory, { recursive: true }));
  await storePreparedRuntime(directory);
  assert.deepEqual(await readdir(directory), []);
  await writeFile(join(directory, 'runtime.json'), baked);
  assert.equal(await readPreparedRuntimeText(directory), baked);
  await storePreparedRuntime(directory);
  const stored = await readFile(join(directory, 'runtime.json'), 'utf8');
  assert.equal(await readFile(join(directory, LEAF_BOXES_FILE), 'utf8'), `${JSON.stringify(boxes)}\n`);
  assert.equal(await readPreparedRuntimeText(directory), baked);
  await storePreparedRuntime(directory);
  assert.equal(await readFile(join(directory, 'runtime.json'), 'utf8'), stored);
  // A rebake without a list leaves no file of the earlier one.
  await writeFile(join(directory, 'runtime.json'), runtime([]));
  await storePreparedRuntime(directory);
  assert.deepEqual(await readdir(directory), ['runtime.json']);
});
