import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { committedSocialImages, billboardSocialImages, availableSocialImages } from './social-images.mts';
test('captures require Earth, recognize lowercase jpg only, and override arrival billboards', async t => {
  const root = await mkdtemp(join(tmpdir(), 'social-characterization-')); t.after(() => rm(root, { recursive: true, force: true }));
  const dir = join(root, 'public/social'); await mkdir(dir, { recursive: true });
  assert.throws(() => committedSocialImages(root), /must contain the earth capture/);
  for (const name of ['earth.jpg', 'mars.jpg', 'a.jpg.png', 'ignored.JPG', 'other.webp']) await writeFile(join(dir, name), 'fixture');
  assert.deepEqual([...committedSocialImages(root)].sort(), ['earth', 'mars']);
  const arrival = { defaultDataset: 'normal', datasetIds: ['normal'], rotation: [0, 0, 0] as const, billboard: { dataset: 'normal', rotation: [0, 0, 0] as const, url: '/arrival', size: 1, focalPixels: 1, distanceM: 2 } };
  const objects = [{ id: 'earth', discovery: { featured: false, imagery: true, illustration: false, arrival } }, { id: 'moon', discovery: { featured: false, imagery: true, illustration: false, arrival } }, { id: 'plain', discovery: { featured: false, imagery: false, illustration: false } }];
  assert.deepEqual([...billboardSocialImages(objects, committedSocialImages(root))], [['moon', '/arrival']]);
  assert.deepEqual([...availableSocialImages(objects, root)].sort(), ['earth', 'mars', 'moon']);
});
