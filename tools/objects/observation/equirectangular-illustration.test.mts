import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { createSurfaceInterpreter } from './interpret.mts';

const input = (path: string) => ({ path, id: path, origin: `https://example.test/${path}`, credit: 'Fixture', license: 'Fixture', acquisition: 'Fixture',
  redistribution: 'Fixture', sourceBinding: { kind: 'local', reason: 'Authored test fixture' }, consumers: ['lenses'] });

async function fixture(t: test.TestContext, width: number, height: number) {
  const sourceDirectory = await mkdtemp(join(tmpdir(), 'cssearth-illustration-'));
  t.after(() => rm(sourceDirectory, { recursive: true, force: true }));
  // Left half red, right half blue: the map's own 0° column must stay the left edge.
  const pixels = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) pixels.set(x < width / 2 ? [255, 0, 0] : [0, 0, 255], (y * width + x) * 3);
  await sharp(pixels, { raw: { width, height, channels: 3 } }).png().toFile(join(sourceDirectory, 'map.png'));
  await writeFile(join(sourceDirectory, 'manifest.json'), JSON.stringify({ schema: 'cssearth-authoritative-sources@2', inputs: [input('map.png')], generatedIntermediates: [], documents: [] }));
  return sourceDirectory;
}
const surface = { id: 'illustration', source: 'map.png', science: { kind: 'equirectangular-illustration' } };

test('an equirectangular illustration is resized unchanged with its left edge at 0°', async t => {
  const sourceDirectory = await fixture(t, 8, 4);
  const interpret = await createSurfaceInterpreter({ objectId: 'fixture', displayName: 'Fixture', sourceDirectory, recipe: { surfaces: [surface] } });
  const result = await interpret(surface, 16, 8, 1);
  assert.equal(result.channels, 4);
  assert.equal(result.plates, undefined, 'a lit body gets no plates');
  const at = (x: number, y: number) => [...result.data.subarray((y * 16 + x) * 4, (y * 16 + x) * 4 + 4)];
  assert.deepEqual(at(1, 4), [255, 0, 0, 255]);
  assert.deepEqual(at(14, 4), [0, 0, 255, 255]);
});

test('an emissive body gets transparent plates beside the illustration', async t => {
  const sourceDirectory = await fixture(t, 8, 4);
  const recipe = { surfaces: [surface], emission: { offLimbSize: 6, limbSize: 4, bodyDiameter: 4, offLimbOutput: 'context-{id}{suffix}.webp', limbOutput: 'limb-{id}{suffix}.webp', metadata: {} } };
  const interpret = await createSurfaceInterpreter({ objectId: 'fixture', displayName: 'Fixture', sourceDirectory, recipe });
  const { plates } = await interpret(surface, 16, 8, 1);
  assert.ok(plates);
  assert.ok(plates.offLimb.data.every((value: number) => value === 0) && plates.limb.data.every((value: number) => value === 0));
});

test('a map that is not 2:1 is refused with its object, lens, file and size', async t => {
  const sourceDirectory = await fixture(t, 8, 8);
  const interpret = await createSurfaceInterpreter({ objectId: 'fixture', displayName: 'Fixture', sourceDirectory, recipe: { surfaces: [surface] } });
  await assert.rejects(interpret(surface, 16, 8, 1), /fixture\/illustration: map\.png is 8 × 8, not a 2:1 equirectangular map/u);
});
