import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { preparePagedEllipsoidAssetsInParallel } from '@cssearth/bake/objects/layers/paged-ellipsoid';

// A stand-in for asset-worker.mts: it names each file its job would write, or fails the job it is told to.
const WORKER = `import { parentPort, workerData } from 'node:worker_threads';
const { objectDirectory, publicDirectory, job } = workerData;
if (job.mode === 'maps' && job.surfaceMapNames[0] === 'broken') throw new Error('broken map');
const name = job.mode === 'maps' ? job.surfaceMapNames[0] : job.mode === 'materials' ? \`material-\${job.materialSlice.index}-of-\${job.materialSlice.count}\` : 'extras';
parentPort.postMessage([\`\${publicDirectory}/\${name}\`, \`\${objectDirectory}/\${name}\`]);
`;

async function fixtureWorker(t: test.TestContext) {
  const directory = await mkdtemp(join(tmpdir(), 'paged-asset-worker-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'worker.mjs');
  await writeFile(path, WORKER);
  return pathToFileURL(path);
}

test('the host worker runs every surface map, the extras and each material slice once', async t => {
  const worker = await fixtureWorker(t);
  const { assets } = await preparePagedEllipsoidAssetsInParallel({ worker, objectDirectory: 'object', publicDirectory: 'public', mapNames: ['day', 'night'] });
  const materials = assets.filter(asset => asset.startsWith('public/material-'));
  const count = materials.length;
  assert.ok(count >= 1);
  assert.deepEqual(materials, Array.from({ length: count }, (_, index) => `public/material-${index}-of-${count}`).sort());
  assert.deepEqual(assets.filter(asset => asset.startsWith('public/') && !asset.startsWith('public/material-')), ['public/day', 'public/extras', 'public/night']);
  assert.equal(assets.length, 2 * (count + 3));
});

test('materials only runs the material slices alone', async t => {
  const worker = await fixtureWorker(t);
  const { assets } = await preparePagedEllipsoidAssetsInParallel({ worker, objectDirectory: 'object', publicDirectory: 'public', mapNames: ['day'], materialsOnly: true });
  assert.ok(assets.length > 0 && assets.every(asset => /\/material-\d+-of-\d+$/u.test(asset)));
});

test('a failed job fails the preparation with its job named', async t => {
  const worker = await fixtureWorker(t);
  await assert.rejects(preparePagedEllipsoidAssetsInParallel({ worker, objectDirectory: 'object', publicDirectory: 'public', mapNames: ['broken'] }),
    /object: asset job \{"mode":"maps","surfaceMapNames":\["broken"\]\} failed: broken map/u);
});
