import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { packTextureSheet, prepareTextureLevels } from './texture-levels.mts';

test('a map capped below the finest level reads its capped files there; other maps keep every level', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'texture-levels-'));
  const page = () => sharp({ create: { width: 32, height: 32, channels: 4, background: '#808080' } }).webp({ lossless: true }).toBuffer();
  await writeFile(join(directory, 'test-surface.webp'), await page());
  await writeFile(join(directory, 'test-topography.webp'), await page());
  const levels = await prepareTextureLevels({ publicDirectory: directory,
    config: { textureLevels: { widths: [16, 32], hysteresis: 0.2, texelsPerCssPixel: 2 }, atlas: { pageSize: 32, density: 16 },
      camera: { logicalBodyDiameter: 460 }, publicBase: '/scenes/test/', surface: { maps: [{ name: 'test-topography', maximumTextureWidth: 16 }] } },
    banks: [{ id: 'normal', urls: ['/scenes/test/test-surface.webp'] }, { id: 'topography', urls: ['/scenes/test/test-topography.webp'] }] });
  const [coarse, fine] = levels!.textureLevels.levels;
  assert.equal(fine!.resources['page:normal:0'], 'page:normal:0');
  assert.equal(fine!.resources['page:topography:0'], coarse!.resources['page:topography:0']);
  // A one-page bank's small level is its sheet: the whole page, as one tile.
  assert.equal(coarse!.resources['page:topography:0'], 'sheet:topography:level:16');
  assert.deepEqual(coarse!.tiles?.['page:topography:0'], { x: 0, y: 0, scale: 1 });
  assert.deepEqual(fine!.tiles?.['page:topography:0'], { x: 0, y: 0, scale: 1 });
  await assert.rejects(prepareTextureLevels({ publicDirectory: directory,
    config: { textureLevels: { widths: [16, 32], hysteresis: 0.2, texelsPerCssPixel: 2 }, atlas: { pageSize: 32, density: 16 },
      camera: { logicalBodyDiameter: 460 }, publicBase: '/scenes/test/', surface: { maps: [{ name: 'test-topography', maximumTextureWidth: 24 }] } },
    banks: [{ id: 'topography', urls: ['/scenes/test/test-topography.webp'] }] }), /test-topography: maximumTextureWidth 24 is not one of the texture level widths 16, 32/);
});

test('square pages pack into the smallest square sheet, largest first, each page at its own place', () => {
  const { side, positions } = packTextureSheet([32, 64, 32, 32, 32]);
  assert.equal(side, 96);
  assert.deepEqual(positions, [{ x: 64, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 64 }, { x: 32, y: 64 }, { x: 64, y: 64 }]);
  assert.throws(() => packTextureSheet([30]), /multiples of 16/);
});

test('a small level draws every page of a bank from one sheet; the finest level keeps the pages', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'texture-sheet-'));
  const page = (colour: string) => sharp({ create: { width: 32, height: 32, channels: 4, background: colour } }).webp({ lossless: true }).toBuffer();
  await writeFile(join(directory, 'test-surface.webp'), await page('#ff0000'));
  await writeFile(join(directory, 'test-surface-page-1.webp'), await page('#0000ff'));
  const levels = await prepareTextureLevels({ publicDirectory: directory,
    config: { textureLevels: { widths: [16, 32], hysteresis: 0.2, texelsPerCssPixel: 2 }, atlas: { pageSize: 32, density: 16 },
      camera: { logicalBodyDiameter: 460 }, publicBase: '/scenes/test/' },
    banks: [{ id: 'normal', urls: ['/scenes/test/test-surface.webp', '/scenes/test/test-surface-page-1.webp'] }] });
  const [coarse, fine] = levels!.textureLevels.levels;
  assert.equal(coarse!.resources['page:normal:0'], 'sheet:normal:level:16');
  assert.equal(coarse!.resources['page:normal:1'], 'sheet:normal:level:16');
  assert.deepEqual(coarse!.tiles, { 'page:normal:0': { x: 0, y: 0, scale: 2 }, 'page:normal:1': { x: 2, y: 0, scale: 2 } });
  assert.equal(fine!.resources['page:normal:1'], 'page:normal:1');
  const sheet = levels!.entries.find(entry => entry.key === 'sheet:normal:level:16')!;
  assert.equal(sheet.url, '/scenes/test/test-surface-sheet-16.webp');
  // The sheet is 32 canonical pixels square at half scale: the red page on the left, the blue on the right.
  const { data, info } = await sharp(join(directory, 'test-surface-sheet-16.webp')).raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 32);
  assert.deepEqual([...data.subarray(0, 3)], [255, 0, 0]);
  assert.deepEqual([...data.subarray((16 + 4) * info.channels, (16 + 4) * info.channels + 3)], [0, 0, 255]);
  assert.equal(levels!.entries.some(entry => entry.key.startsWith('page:normal:') && entry.key.includes(':level:')), false);
});
