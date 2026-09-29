import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { validatePreparedCssVolume } from '@cssearth/renderer/volume/validation.ts';
import type { CompilerBakeResult } from '@cssearth/bake/volume';

/** Output locations may change; scientific identities, frame and appearance may not. */
export function assertReplayScene(actual: CompilerBakeResult, expected: CompilerBakeResult): void {
  for (const key of ['fieldIdentity', 'frame', 'boundsArcsec', 'skyBoundsArcsec', 'spanArcsec',
    'sourceImage', 'coordinates', 'sampling', 'stars'] as const)
    assert.deepEqual(actual[key], expected[key], `Cold replay changed ${key}`);
  assert.deepEqual(actual.lenses.map(({ volume: _volume, ...lens }) => lens),
    expected.lenses.map(({ volume: _volume, ...lens }) => lens), 'Cold replay changed lens metadata');
  const sprite = (scene: CompilerBakeResult) => scene.starSprites && {
    ...scene.starSprites, atlas: { path: scene.starSprites.atlas.path },
  };
  assert.deepEqual(sprite(actual), sprite(expected), 'Cold replay changed stellar sprites');
}

/** Read every encoded texture, including all three axes, and check it has the size its descriptor records. */
export async function verifyReplayFiles(root: string, scene: CompilerBakeResult): Promise<number> {
  let count = 0;
  for (const pin of [scene.neutral, ...scene.lenses.map(lens => lens.volume)]) {
    const bytes = await readFile(resolve(root, pin.path));
    const volume = validatePreparedCssVolume(JSON.parse(bytes.toString()));
    assert.ok(volume.resources.length > 0);
    for (const resource of volume.resources) {
      const pixels = await readFile(resolve(root, dirname(pin.path), resource.path));
      assert.equal(pixels.length, resource.bytes, `Replayed texture ${resource.path} has ${pixels.length} bytes, not ${resource.bytes}`);
      count++;
    }
  }
  if (scene.starSprites) {
    const bytes = await readFile(resolve(root, scene.starSprites.atlas.path));
    assert.ok(bytes.length > 0, 'Stellar sprite atlas is empty');
  }
  return count;
}
