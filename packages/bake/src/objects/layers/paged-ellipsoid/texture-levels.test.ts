import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { keepTextureLevelBanks, packTextureSheet, prepareTextureLevels } from '@cssearth/bake/objects/layers/paged-ellipsoid';
import { requirePreparedData } from '@cssearth/bake/presentation';

test('a map capped below the finest level reads its capped files there; other maps keep every level', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'texture-levels-'));
  const page = () => sharp({ create: { width: 32, height: 32, channels: 4, background: '#808080' } }).webp({ lossless: true }).toBuffer();
  await writeFile(join(directory, 'test-surface.webp'), await page());
  await writeFile(join(directory, 'test-topography.webp'), await page());
  const levels = await prepareTextureLevels({ publicDirectory: directory,
    config: { textureLevels: { widths: [16, 32], hysteresis: 0.2, texelsPerCssPixel: 2 }, atlas: { pageSize: 32, density: 16 },
      camera: { logicalBodyDiameter: 460 }, publicBase: '/scenes/test/', surface: { maps: [{ name: 'test-topography', maximumTextureWidth: 16 }] } },
    banks: [{ id: 'normal', urls: ['/scenes/test/test-surface.webp'] }, { id: 'topography', urls: ['/scenes/test/test-topography.webp'] }] });
  // The levels travel in the prepared presentation, whose contract takes plain, unshared JSON only.
  requirePreparedData(levels!.textureLevels);
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
  requirePreparedData(levels!.textureLevels);
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

test('a bank prepared at lower density places its pages on the same CSS offsets as the full bank', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'texture-sheet-density-'));
  const page = (size: number, colour: string) => sharp({ create: { width: size, height: size, channels: 4, background: colour } }).webp({ lossless: true }).toBuffer();
  await writeFile(join(directory, 'test-surface.webp'), await page(32, '#ff0000'));
  await writeFile(join(directory, 'test-surface-page-1.webp'), await page(32, '#0000ff'));
  await writeFile(join(directory, 'test-outer.webp'), await page(16, '#00ff00'));
  await writeFile(join(directory, 'test-outer-page-1.webp'), await page(16, '#ffff00'));
  const levels = await prepareTextureLevels({ publicDirectory: directory,
    config: { textureLevels: { widths: [16, 32], hysteresis: 0.2, texelsPerCssPixel: 2 }, atlas: { pageSize: 32, density: 16 },
      camera: { logicalBodyDiameter: 460 }, publicBase: '/scenes/test/' },
    banks: [{ id: 'normal', urls: ['/scenes/test/test-surface.webp', '/scenes/test/test-surface-page-1.webp'] },
      { id: 'outer', urls: ['/scenes/test/test-outer.webp', '/scenes/test/test-outer-page-1.webp'] }] });
  const [coarse] = levels!.textureLevels.levels;
  // Earth's cutaway shell: its pages are a quarter of the surface's width, but tile the same CSS pages.
  assert.deepEqual(coarse!.tiles?.['page:outer:1'], { ...coarse!.tiles?.['page:normal:1'], scale: coarse!.tiles?.['page:outer:1']?.scale });
  assert.equal(coarse!.tiles?.['page:outer:1']?.x, coarse!.tiles?.['page:normal:1']?.x);
});

test('a reuse run keeps the published levels of the banks it still declares and drops a removed dataset\'s', () => {
  const entry = (key: string, url: string) => ({ key, url, decodedBytes: 4, pool: 'pages' });
  const published = { maximumDecodedBytes: 8, entries: [entry('page:normal:0', '/a.webp'), entry('sheet:cut:level:16', '/cut-sheet.webp'), entry('poles:cut', '/cut-poles.webp')],
    textureLevels: { hysteresis: 0.2, levels: [{ minimumDiameter: 0, resources: { 'page:normal:0': 'page:normal:0', 'page:cut:0': 'sheet:cut:level:16' },
      tiles: { 'page:cut:0': { x: 0, y: 0, scale: 1 } } }] },
    provenance: { schema: 'cssearth-prepared-texture-levels@1', kernel: 'lanczos3', encoding: 'source-webp-encoding', texelsPerCssPixel: 2,
      receipts: [], sheets: [{ url: '/cut-sheet.webp', side: 16, pages: [] }] } };
  const kept = keepTextureLevelBanks(published as never, new Set(['normal']), new Set(['normal']));
  assert.deepEqual(kept.entries.map(item => item.key), ['page:normal:0']);
  assert.deepEqual(kept.textureLevels.levels[0], { minimumDiameter: 0, resources: { 'page:normal:0': 'page:normal:0' }, tiles: {} });
  assert.deepEqual(kept.provenance.sheets, []);
});
