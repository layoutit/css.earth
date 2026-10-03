import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { readContextObjects } from './catalog-directory.js';

// Temporary checkouts the tests make, removed once the file's tests finish.
const temporary: string[] = [];
after(() => Promise.all(temporary.map(path => rm(path, { recursive: true, force: true }))));

const zoom = { enter: { distancePc: 1 }, returnBelow: { distancePc: 0.5 }, frame: { distance: { distancePc: 2 } } };
async function objects(packages: Record<string, Record<string, unknown>>) {
  const root = await mkdtemp(join(tmpdir(), 'cssearth-context-objects-'));
  temporary.push(root);
  for (const [id, properties] of Object.entries(packages)) {
    await mkdir(join(root, id), { recursive: true });
    await writeFile(join(root, id, 'object.json'), JSON.stringify({ schema: 'cssearth-object@2', id, type: 'x', properties }));
  }
  return root;
}

test('a bank and an object seen from inside are context objects; an ordinary object is not', async () => {
  const root = await objects({ galaxy: { catalog: {}, zoom }, bank: { host: 'galaxy' }, star: { catalog: {} } });
  assert.deepEqual((await readContextObjects(root)).map(object => object.id), ['bank', 'galaxy']);
});
