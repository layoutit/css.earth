import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { readCompactCompiler } from './compact-compiler.ts';
import { assertReplayScene } from './cold-replay-parity.ts';

test('cold parity rejects independent field, frame, star, lens and alpha mutations', async () => {
  const input = readCompactCompiler(JSON.parse(gunzipSync(await readFile('src/objects/m42/source/bake-inputs.json.gz')).toString()));
  const expected = input.scene;
  assertReplayScene(structuredClone(expected), expected);
  for (const mutate of [
    (scene: typeof expected) => { scene.fieldIdentity = '0'.repeat(64); },
    (scene: typeof expected) => { scene.frame = { ...scene.frame, metersPerUnit: scene.frame.metersPerUnit * 2 }; },
    (scene: typeof expected) => { scene.coordinates.localOriginArcsec[0] += 1; },
    (scene: typeof expected) => { assert.ok(scene.stars[0]); scene.stars[0].positionUnits[0] += 1; },
    (scene: typeof expected) => { assert.ok(scene.lenses[0]); scene.lenses[0].coverage.recoloredTexels += 1; },
    (scene: typeof expected) => { scene.alphaSha256 = '0'.repeat(64); },
  ]) {
    const changed = structuredClone(expected); mutate(changed);
    assert.throws(() => assertReplayScene(changed, expected), /Cold replay changed/);
  }
});
