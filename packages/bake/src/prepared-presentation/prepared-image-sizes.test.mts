import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import sharp from 'sharp';

import { withImageSizes } from './prepared-image-sizes.ts';

const image = (file: string, width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: '#808080' } }).webp().toFile(file);

test('every image entry states the width and height of the file the bake published', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cssearth-image-sizes-'));
  await image(join(directory, 'io-surface.webp'), 520, 96);
  await image(join(directory, 'io-poles.webp'), 64, 32);
  const file = (url: string) => join(directory, basename(url));
  const definition = { id: 'io', schema: 'kept', assets: { pools: ['kept'], startup: ['surface'], entries: [
    { key: 'surface', url: '/scenes/io/io-surface.webp', pool: 'pages', decodedBytes: 520 * 96 * 4 },
    { key: 'surface:again', url: '/scenes/io/io-surface.webp', pool: 'pages' },
    { key: 'poles', url: '/scenes/io/io-poles.webp', pool: 'warm' },
  ] } };
  const sized = await withImageSizes(definition, file);
  assert.deepEqual(sized.assets.entries, [
    { key: 'surface', url: '/scenes/io/io-surface.webp', pool: 'pages', decodedBytes: 520 * 96 * 4, width: 520, height: 96 },
    { key: 'surface:again', url: '/scenes/io/io-surface.webp', pool: 'pages', width: 520, height: 96 },
    { key: 'poles', url: '/scenes/io/io-poles.webp', pool: 'warm', width: 64, height: 32 },
  ]);
  // Everything else is carried as it was, and a second pass over its own output changes nothing.
  assert.deepEqual([sized.schema, sized.assets.pools, sized.assets.startup], ['kept', ['kept'], ['surface']]);
  assert.deepEqual(await withImageSizes(sized, file), sized);
  // A stated byte count that is not the file's is refused with the body, the entry, the file and both numbers.
  await assert.rejects(withImageSizes({ id: 'io', assets: { entries: [{ key: 'surface', url: '/scenes/io/io-surface.webp', pool: 'pages', decodedBytes: 4 }] } }, file),
    /io: image surface \(\/scenes\/io\/io-surface\.webp\) is 520 x 96, 199680 decoded bytes, and its entry states 4\./);
  // A file the bake did not publish is refused with where it was looked for.
  await assert.rejects(withImageSizes({ id: 'io', assets: { entries: [{ key: 'gone', url: '/scenes/io/gone.webp', pool: 'pages' }] } }, file),
    new RegExp(`io: image gone \\(/scenes/io/gone\\.webp\\) could not be read at ${join(directory, 'gone.webp').replaceAll('/', '\\/')}`));
});
