import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { readOverviews } from './catalog-directory.js';

// Temporary checkouts the tests make, removed once the file's tests finish.
const temporary: string[] = [];
after(() => Promise.all(temporary.map(path => rm(path, { recursive: true, force: true }))));

const zoom = { enter: { distancePc: 1 }, returnBelow: { distancePc: 0.5 }, frame: { distance: { distancePc: 2 } } };
async function objects(packages: Record<string, unknown>) {
  const root = await mkdtemp(join(tmpdir(), 'cssearth-overviews-'));
  temporary.push(root);
  for (const [id, overview] of Object.entries(packages)) {
    await mkdir(join(root, id), { recursive: true });
    await writeFile(join(root, id, 'object.json'), JSON.stringify({ schema: 'cssearth-object@2', id, type: 'x', properties: overview === null ? {} : { overview } }));
  }
  return root;
}
const level = (order: number, classifications: string[], packages: string[] = []) =>
  ({ order, zoom, holds: [{ classifications }], packages });

test('reads the overviews the packages author, from the nearest level out', async () => {
  const root = await objects({ outer: level(2, ['galaxy-cluster']), inner: level(1, ['nebula'], ['stars']), stars: null });
  const overviews = await readOverviews(root);
  assert.deepEqual(overviews.map(overview => [overview.id, overview.level.order]), [['inner', 1], ['outer', 2]]);
});

test('refuses levels that share an order, a classification or draw a missing package, naming them', async () => {
  await assert.rejects(readOverviews(await objects({ a: level(1, ['nebula']), b: level(1, ['galaxy']) })), /a and b share order 1/);
  await assert.rejects(readOverviews(await objects({ a: level(1, ['galaxy']), b: level(2, ['galaxy']) })), /a and b both hold galaxy/);
  await assert.rejects(readOverviews(await objects({ a: level(1, ['nebula'], ['stars']) })), /a draws package stars/);
});
