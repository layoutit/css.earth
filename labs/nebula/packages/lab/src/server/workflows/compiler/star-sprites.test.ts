import assert from 'node:assert/strict';
import test from 'node:test';
import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { COMPILER_STAR_PROFILE_PATH, prepareCompilerStarSprites } from '../../../adapters/application/star-sprites.ts';
import { validCompilerStarSprites, type CompilerStarSprites, type PreparedCompilerStar } from '@cssearth/bake/volume';

const stars: PreparedCompilerStar[] = [
  { id: 'bright', positionUnits: [1, 2, 3], rgb: [255, 220, 180], diameterUnits: 3, alpha: .7,
    materials: { infrared: { rgb: [120, 180, 255], diameterUnits: 2, alpha: .4 } } },
  { id: 'faint', positionUnits: [4, 5, 6], rgb: [155, 210, 255], diameterUnits: 1, alpha: .08,
    materials: { infrared: { rgb: [255, 220, 180], diameterUnits: 1, alpha: .1 } } },
];
async function setup(t: { after(fn: () => Promise<unknown>): void }) {
  const root = await mkdtemp(join(tmpdir(), 'compiler-star-sprites-')); t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(dirname(join(root, COMPILER_STAR_PROFILE_PATH)), { recursive: true });
  await copyFile(COMPILER_STAR_PROFILE_PATH, join(root, COMPILER_STAR_PROFILE_PATH)); return root;
}
test('real prepared site profile replaces disks with a soft core/halo and conserves every color-channel light', async t => {
  const root = await setup(t), before = JSON.stringify(stars), { starSprites: sprites } = await prepareCompilerStarSprites(root, 'sprites', stars);
  assert.ok(sprites); assert.ok(validCompilerStarSprites(sprites, stars)); assert.equal(JSON.stringify(stars), before);
  const { data, info } = await sharp(await readFile(join(root, sprites.atlas.path))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, sprites.width); assert.equal(info.height, sprites.height);
  for (const star of stars) for (const appearance of [star, ...Object.values(star.materials ?? {})]) {
    const tile: CompilerStarSprites['entries'][string] = sprites.entries[appearance.rgb.join(',')]!;
    const sums = [0, 0, 0]; let alphaSum = 0, intermediate = 0;
    for (let y = 0; y < sprites.tileSize; y++) for (let x = 0; x < sprites.tileSize; x++) {
      const at = ((tile.y + y) * info.width + tile.x + x) * 4, alpha = data[at + 3]! / 255;
      alphaSum += alpha; if (alpha > 0 && alpha < 1) intermediate++;
      for (let c = 0; c < 3; c++) sums[c]! += alpha * data[at + c]! / 255;
    }
    assert.ok(intermediate > sprites.tileSize ** 2 / 3, 'PSF must have a substantial smooth profile, not a binary disk.');
    const size = appearance.diameterUnits! * sprites.diameterScale;
    for (let c = 0; c < 3; c++) {
      const flux: number = sums[c]! / sprites.tileSize ** 2 * size ** 2 * appearance.alpha * sprites.alphaScale;
      const originalDiskFlux = appearance.rgb[c]! / 255 * Math.PI * appearance.diameterUnits! ** 2 / 4 * appearance.alpha;
      assert.ok(Math.abs(flux - originalDiskFlux) < 1e-10, 'Decoded sprite must preserve the prior observed channel light.');
    }
    assert.ok(Math.abs(alphaSum / sprites.tileSize ** 2 - Math.PI / 4) > .1,
      'Removing offline extent compensation must fail this same light-preservation assertion.');
    const at = (y: number, x: number): number => data[((tile.y + y) * info.width + tile.x + x) * 4 + 3]!;
    assert.equal(at(0, 0), 0); assert.ok(at(16, 16) > 250); assert.ok(at(16, 24) > 0 && at(16, 24) < 40);
  }
});
test('sprite contract rejects missing colors, invalid atlas pins and fake photometric compensation', async t => {
  const root = await setup(t), { starSprites } = await prepareCompilerStarSprites(root, 'sprites', stars); assert.ok(starSprites);
  assert.equal(validCompilerStarSprites({ ...starSprites, diameterScale: 1 }, stars), false);
  assert.equal(validCompilerStarSprites({ ...starSprites, atlas: { ...starSprites.atlas, path: '../escape.png' } }, stars), false);
  const missing = structuredClone(starSprites); delete missing.entries['155,210,255'];
  assert.equal(validCompilerStarSprites(missing, stars), false);
  assert.equal(validCompilerStarSprites({ ...starSprites, entries: { '255,220,180': { x: starSprites.width, y: 0 } } }, stars), false);
  assert.deepEqual(await prepareCompilerStarSprites(root, 'empty', []), {});
});
