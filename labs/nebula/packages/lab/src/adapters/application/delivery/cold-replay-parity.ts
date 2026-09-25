import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { validatePreparedCssVolume } from '../../../../../../../../src/renderers/css/volume/validation.ts';
import type { CompilerBakeResult } from '@cssearth/bake/volume';

export const replaySha = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

/** Output locations may change; scientific identities, frame and appearance may not. */
export function assertReplayScene(actual: CompilerBakeResult, expected: CompilerBakeResult): void {
  for (const key of ['fieldIdentity', 'frame', 'boundsArcsec', 'skyBoundsArcsec', 'spanArcsec',
    'sourceImage', 'coordinates', 'sampling', 'stars', 'alphaSha256'] as const)
    assert.deepEqual(actual[key], expected[key], `Cold replay changed ${key}`);
  assert.deepEqual(actual.lenses.map(({ volume: _volume, ...lens }) => lens),
    expected.lenses.map(({ volume: _volume, ...lens }) => lens), 'Cold replay changed lens metadata');
  const sprite = (scene: CompilerBakeResult) => scene.starSprites && {
    ...scene.starSprites, atlas: { path: scene.starSprites.atlas.path },
  };
  assert.deepEqual(sprite(actual), sprite(expected), 'Cold replay changed stellar sprites');
}

/** Hash actual encoded pixels, including all three axes, rather than trusting descriptor claims. */
export async function verifyReplayFiles(root: string, scene: CompilerBakeResult): Promise<number> {
  let count = 0;
  for (const pin of [scene.neutral, ...scene.lenses.map(lens => lens.volume)]) {
    const bytes = await readFile(resolve(root, pin.path));
    const volume = validatePreparedCssVolume(JSON.parse(bytes.toString()));
    assert.ok(volume.resources.length > 0);
    for (const resource of volume.resources) {
      const pixels = await readFile(resolve(root, dirname(pin.path), resource.path));
      assert.equal(replaySha(pixels), resource.sha256, `Changed pixels: ${resource.path}`);
      assert.equal(pixels.length, resource.bytes);
      count++;
    }
  }
  if (scene.starSprites) {
    const bytes = await readFile(resolve(root, scene.starSprites.atlas.path));
    assert.ok(bytes.length > 0, 'Stellar sprite atlas is empty');
  }
  return count;
}
