import assert from 'node:assert/strict';
import test from 'node:test';
import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { compilerFrame, type CompilerStarInput } from '../compiler/bake.ts';
import { readCompilerBakeResult, validCompilerStarSprites, type PreparedCompilerStar } from '@cssearth/bake/volume';
import { COMPILER_STAR_PROFILE_PATH, prepareCompilerStarSprites } from '../../../adapters/application/star-sprites.ts';
import { prepareSampledSceneStars } from './compile.ts';

test('sampled final scene prepares every spectral star color after merging materials and retains the neutral atlas', async t => {
  const root = await mkdtemp(join(tmpdir(), 'sampled-final-stars-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(dirname(join(root, COMPILER_STAR_PROFILE_PATH)), { recursive: true });
  await copyFile(COMPILER_STAR_PROFILE_PATH, join(root, COMPILER_STAR_PROFILE_PATH));
  const sourceStars: CompilerStarInput[] = [{ id: 'field-star', positionArcsec: [12, 22, 32], rgb: [255, 220, 180], diameterUnits: 2, alpha: .5,
    materials: { optical: { rgb: [120, 180, 255], diameterUnits: 1.5, alpha: .4 }, radio: { rgb: [70, 150, 90], diameterUnits: 1, alpha: .2 } } },
  { id: 'named-pulsar', positionArcsec: [13, 23, 33], rgb: [250, 250, 255], diameterUnits: 1, alpha: .7,
    materials: { optical: { rgb: [250, 250, 255], diameterUnits: 1, alpha: .7 }, radio: { rgb: [0, 0, 0], diameterUnits: 1, alpha: 0 } } }];
  const boundsArcsec = { min: [10, 20, 30] as [number, number, number], max: [14, 24, 34] as [number, number, number] };
  const { frame, origin } = compilerFrame(boundsArcsec);
  const neutralStars: PreparedCompilerStar[] = sourceStars.map(({ positionArcsec, materials: _materials, ...star }) => ({ ...star,
    positionUnits: [positionArcsec[0] - origin[0], positionArcsec[1] - origin[1], positionArcsec[2] - origin[2]] }));
  const sprites = await prepareCompilerStarSprites(root, 'neutral', neutralStars);
  const registered = readCompilerBakeResult({ schema: 'cssearth-compiler-bake@1', id: 'fixture', fieldIdentity: 'a'.repeat(64), frame, boundsArcsec,
    skyBoundsArcsec: { min: [10, 20], max: [14, 24] }, spanArcsec: 4, sourceImage: { width: 512, height: 512 },
    coordinates: { axes: ['west', 'north', 'away'], localOriginArcsec: origin, earthView: 'observer-at-negative-z-looking-away' },
    neutral: { path: 'registered/neutral/volume.json', sha256: 'b'.repeat(64) }, alphaSha256: 'c'.repeat(64),
    lenses: ['radio', 'optical'].map(id => ({ id, label: id, volume: { path: `registered/${id}/volume.json`, sha256: 'd'.repeat(64) },
      alphaSha256: 'e'.repeat(64), coverage: { positiveAlphaTexels: 1, recoloredTexels: 1, outsideImageTexels: 0 } })),
    stars: neutralStars, ...sprites, sampling: { sliceCounts: { x: 2, y: 2, z: 2 }, imageWidth: 512, samplesPerSlab: 4 } });
  assert.ok(registered.starSprites);
  const neutralBytes = await readFile(join(root, registered.starSprites.atlas.path)), before = JSON.stringify({ registered, sourceStars });
  const merged = neutralStars.map((star, index) => ({ ...star, materials: sourceStars[index]!.materials }));
  assert.throws(() => readCompilerBakeResult({ ...registered, stars: merged }), /star sprites/, 'The original final assembly fails for spectral colors absent from its neutral atlas.');
  const scene = await prepareSampledSceneStars(root, 'final-stars', registered, [...sourceStars].reverse());
  assert.deepEqual(scene.stars, merged); assert.ok(scene.starSprites && validCompilerStarSprites(scene.starSprites, scene.stars));
  assert.notEqual(scene.starSprites.atlas.path, registered.starSprites.atlas.path);
  assert.deepEqual(await readFile(join(root, registered.starSprites.atlas.path)), neutralBytes);
  assert.equal(JSON.stringify({ registered, sourceStars }), before);
  const { starSprites: _old, stars: _neutral, ...oldCloud } = registered;
  const { starSprites: _new, stars: _spectral, ...newCloud } = scene;
  assert.deepEqual(newCloud, oldCloud);
  const { data, info } = await sharp(join(root, scene.starSprites.atlas.path)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (const star of scene.stars) for (const material of [star, ...Object.values(star.materials ?? {})]) {
    const tile: { x: number; y: number } | undefined = scene.starSprites.entries[material.rgb.join(',')]; assert.ok(tile);
    const x: number = tile.x + Math.floor(scene.starSprites.tileSize / 2), y: number = tile.y + Math.floor(scene.starSprites.tileSize / 2);
    assert.deepEqual([...data.subarray((y * info.width + x) * 4, (y * info.width + x) * 4 + 3)], material.rgb);
  }
  const wrong = structuredClone(sourceStars); wrong[0]!.id = 'another-star';
  await assert.rejects(prepareSampledSceneStars(root, 'invalid-stars', registered, wrong), /identity is missing/);
});
