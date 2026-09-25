import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { prepareTextureLevels } from './texture-levels.mts';

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
  assert.equal(coarse!.resources['page:topography:0'], 'page:topography:0:level:16');
  await assert.rejects(prepareTextureLevels({ publicDirectory: directory,
    config: { textureLevels: { widths: [16, 32], hysteresis: 0.2, texelsPerCssPixel: 2 }, atlas: { pageSize: 32, density: 16 },
      camera: { logicalBodyDiameter: 460 }, publicBase: '/scenes/test/', surface: { maps: [{ name: 'test-topography', maximumTextureWidth: 24 }] } },
    banks: [{ id: 'topography', urls: ['/scenes/test/test-topography.webp'] }] }), /test-topography: maximumTextureWidth 24 is not one of the texture level widths 16, 32/);
});
