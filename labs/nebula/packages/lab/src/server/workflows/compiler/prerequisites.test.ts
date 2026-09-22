import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { geometrySha } from '../geometry/registered-source.ts';
import { compilerLayersReady } from './prerequisites.ts';

test('compiler restores missing derived layers but refuses modified evidence', async t => {
  const root = await mkdtemp(join(tmpdir(), 'compiler-prerequisites-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, '.local/nebula-lab'), { recursive: true });
  const bytes = Buffer.from('source-owned fixture bytes'), sha256 = geometrySha(bytes);
  const layer = (name: string) => ({ path: `.local/nebula-lab/${name}`, width: 8, height: 8, sha256 });
  const layers = { original: layer('original.png'), diffuse: layer('diffuse.png'), stars: layer('stars.png') };
  const catalogue = { schema: 'cssearth-nebula-observations@1', id: 'fixture',
    frame: { width: 8, height: 8, fieldArcminutes: [1, 1], centerIcrsDegrees: [10, 0], northUp: true },
    images: ['first', 'second'].map(id => ({ id, label: id,
      source: { width: 8, height: 8, url: 'https://example.test/source', sha256, credit: 'Fixture', page: 'https://example.test/page' },
      layers, imageToFrame: [1, 0, 0, 1, 0, 0],
      registration: { status: 'verified', matchedStars: 10, rmsPixels: .1, maxResidualPixels: .2 } })) };
  for (const value of Object.values(layers)) await writeFile(join(root, value.path), bytes);
  assert.equal(await compilerLayersReady(root, catalogue), true);
  await rm(join(root, layers.diffuse.path));
  assert.equal(await compilerLayersReady(root, catalogue), false);
  await writeFile(join(root, layers.diffuse.path), bytes);
});
