import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import sharp from 'sharp';
import { prepareSearchThumbnails } from './prepare-search-thumbnails.ts';

const rotation = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const picture = (red: number, green: number, blue: number) => sharp({ create: {
  width: 64, height: 64, channels: 4, background: { r: red, g: green, b: blue, alpha: 1 },
} }).extend({ top: 8, bottom: 8, left: 8, right: 8, background: '#00000000' }).webp({ lossless: true }).toBuffer();

test('featured-star previews reuse arrival pixels, including an older restored arrival, while other markers stay unchanged', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cssearth-search-preview-'));
  try {
    await Promise.all(['site', 'public/navigation', 'public/scenes/star'].map(path => mkdir(join(root, path), { recursive: true })));
    const context = await picture(240, 80, 40), arrival = join(root, 'public/scenes/star/arrival.webp');
    await Promise.all([
      writeFile(join(root, 'public/navigation/star-context.webp'), context),
      writeFile(join(root, 'public/navigation/other-context.webp'), context),
      writeFile(arrival, await picture(120, 120, 120)),
      writeFile(join(root, 'site/prepared-navigation-markers.mjs'), `export const PREPARED_NAVIGATION_MARKERS = ${JSON.stringify({
        star: { context: { url: '/navigation/star-context.webp' } }, other: { context: { url: '/navigation/other-context.webp' } },
      })};`),
      writeFile(join(root, 'site/prepared-catalogue.mjs'), `export const CATALOGUE_ENTRIES = ${JSON.stringify([
        { kind: 'scene', descriptor: { id: 'star', properties: { catalog: { classification: 'star' } } },
          discovery: { featured: true, imagery: false, illustration: false, arrival: { defaultDataset: 'color', datasetIds: ['color'], rotation,
            billboard: { url: '/scenes/star/arrival.webp', size: 80, focalPixels: 50, distanceM: 100, dataset: 'color', rotation } } } },
        { kind: 'scene', descriptor: { id: 'other', properties: { catalog: { classification: 'planet' } } } },
      ])};`),
    ]);
    assert.equal((await prepareSearchThumbnails(root)).written, 2);
    const starPath = join(root, 'public/navigation/search/star@2x.webp'), otherPath = join(root, 'public/navigation/search/other@2x.webp');
    const star = await sharp(starPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(star.info.width, 80);
    assert.equal(star.info.height, 80);
    const centre = 4 * (40 * 80 + 40);
    assert.ok(Math.abs(star.data[centre]! - star.data[centre + 1]!) < 3, 'arrival colour replaces the red catalogue disc');
    const other = await readFile(otherPath);
    await writeFile(arrival, await picture(190, 190, 190));
    await utimes(arrival, new Date(0), new Date(0));
    assert.equal((await prepareSearchThumbnails(root)).written, 1, 'an older restored arrival cannot preserve the stale preview');
    assert.deepEqual(await readFile(otherPath), other, 'unrelated previews keep their exact bytes');
    assert.equal((await prepareSearchThumbnails(root)).written, 0, 'repeated preparation is reproducible');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
