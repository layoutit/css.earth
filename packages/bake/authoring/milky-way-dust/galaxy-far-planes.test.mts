import assert from 'node:assert/strict';
import { test } from 'node:test';
import { flattenAxisPixels } from './galaxy-far-planes.mts';

const layer = (values: number[], x = 0) => ({ pixels: Uint8Array.from(values), width: values.length / 4, height: 1, x, y: 0 });
function encode(light: readonly number[], alpha: number): number[] {
  return [...light.map(value => alpha > 0 ? Math.round(value / alpha) : 0), Math.round(alpha * 255)];
}
test('gain-1 flattening retains straight color and composite alpha, including crop offsets', () => {
  const layers = [layer([240, 30, 10, 210, 90, 180, 30, 120]), layer([10, 120, 250, 180], 1)];
  const pixels = flattenAxisPixels(layers, 3, 1, 1);
  // Independent runtime equation: each premerged alpha is scaled by the quantized gain-1 leaf opacity, 1/3.
  const a = 120 / 255 / 3, b = 180 / 255 / 3;
  const expected = [...encode([240, 30, 10].map(value => value * 210 / 255 / 3), 210 / 255 / 3),
    ...encode([10 * b + 90 * a * (1 - b), 120 * b + 180 * a * (1 - b), 250 * b + 30 * a * (1 - b)], b + a * (1 - b)), 0, 0, 0, 0];
  assert.deepEqual([...pixels], expected);
  assert.notDeepEqual([...flattenAxisPixels([...layers].reverse(), 3, 1, 1)], expected, 'depth order changes colored extinction');
  assert.notDeepEqual([...flattenAxisPixels(layers, 3, 1, 3)], expected, 'gain 3 is a distinct endpoint');
});

test('gain-1 and gain-3 pictures fit bounded intermediate source-over light on the picture grid', async () => {
  const { fitGainBlend } = await import('./galaxy-far-planes.mts');
  const layers = [layer([240, 70, 30, 90, 50, 120, 240, 220]), layer([30, 90, 220, 170, 240, 60, 10, 110])];
  const low = flattenAxisPixels(layers, 2, 1, 1), high = flattenAxisPixels(layers, 2, 1, 3);
  const samples = fitGainBlend(layers, 2, 1, low, high);
  const light = (pixels: Uint8Array) => [0, 4].reduce((sum, i) => sum + (pixels[i]! + pixels[i + 1]! + pixels[i + 2]!) * pixels[i + 3]! / 255, 0);
  for (const [gain, t] of samples) {
    assert.ok(t >= .001 && t <= .999);
    let actual = 0;
    for (const i of [0, 4]) {
      const base = (low[i]! + low[i + 1]! + low[i + 2]!) * low[i + 3]! / 255 * .999;
      actual += (high[i]! + high[i + 1]! + high[i + 2]!) * high[i + 3]! / 255 * t + base * (1 - high[i + 3]! / 255 * t);
    }
    assert.ok(Math.abs(actual / light(flattenAxisPixels(layers, 2, 1, gain)) - 1) < .005);
  }
});

test('black-matted completed pictures mix without adding equal-image light', () => {
  const picture = flattenAxisPixels([layer([200, 80, 20, 255])], 1, 1, 1);
  const weights = [.2, .3, .5], ceiling = .999;
  let front = 0;
  const opacities = weights.map(() => 0);
  for (let index = 2; index >= 0; index--) {
    const share = weights[index]! * ceiling;
    opacities[index] = share / (1 - front); front += share;
  }
  for (let channel = 0; channel < 3; channel++) {
    let light = 0;
    for (const opacity of opacities) light = picture[channel]! * opacity + light * (1 - opacity);
    assert.ok(Math.abs(light - picture[channel]! * ceiling) < 1e-10);
    assert.ok(light <= picture[channel]!);
  }
});

test('the real picture producer sorts physical depth, fixes the plane at the centre and leaves input bytes intact', async () => {
  const { mkdtempSync, mkdirSync, readFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { resolve } = await import('node:path');
  const { default: sharp } = await import('sharp');
  const { prepareGalaxyFarPlanes } = await import('./galaxy-far-planes.mts');
  const { validatePreparedCssVolume } = await import('@cssearth/objects');
  const directory = mkdtempSync(resolve(tmpdir(), 'far-picture-'));
  try {
    const axes = ['x', 'y', 'z'] as const, resources: { path: string; bytes: number; width: number; height: number }[] = [];
    const originals = new Map<string, Buffer>();
    const stacks = [];
    for (const [coordinate, axis] of axes.entries()) {
      const leaves = [];
      for (const [index, depth] of [1, -1, 0].entries()) {
        const texturePath = `${axis}/${index}.png`; mkdirSync(resolve(directory, axis), { recursive: true });
        await sharp(Uint8Array.from([[12, 24, 250, 210], [240, 30, 12, 180], [24, 250, 36, 90]][index]!), { raw: { width: 1, height: 1, channels: 4 } }).png().toFile(resolve(directory, texturePath));
        const bytes = readFileSync(resolve(directory, texturePath)); originals.set(texturePath, bytes);
        resources.push({ path: texturePath, bytes: bytes.length, width: 1, height: 1 });
        const cssAxis = coordinate === 0 ? 1 : coordinate === 1 ? 0 : 2;
        const u = coordinate === 0 ? [1, 0, 0] : [0, 1, 0], v = coordinate === 2 ? [1, 0, 0] : [0, 0, 1];
        const translation = [0, 0, 0]; translation[cssAxis] = depth * 50;
        const transform = `matrix3d(${[...u, 0, ...v, 0, 0, 0, 1, 0, ...translation, 1].join(',')})`;
        const centerUnits: [number, number, number] = [0, 0, 0]; centerUnits[coordinate] = depth;
        leaves.push({ id: `${axis}-${index}`, centerUnits, widthPx: 1, heightPx: 1, texturePath,
          style: { width: '50px', height: '50px', transform, backgroundSize: '50px 50px', backgroundPosition: '0px 0px' } });
      }
      stacks.push({ axis, leaves });
    }
    const volume = validatePreparedCssVolume({ schema: 'cssearth-css-volume@1', id: 'fixture', mergedOpticalCopies: 3,
      frame: { referenceFrame: 'fixture', epochJdTt: 123, originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 1,
        boundsUnits: { min: [-2, -2, -2], max: [2, 2, 2] } }, anchors: [], stacks, resources, provenance: {}, approximation: {} });
    const { mergedOpticalCopies, ...unmerged } = volume;
    assert.equal(mergedOpticalCopies, 3);
    await assert.rejects(prepareGalaxyFarPlanes(unmerged, directory), /three-copy merged/);
    const far = await prepareGalaxyFarPlanes(volume, directory);
    const colors = [[240, 30, 12, 180], [24, 250, 36, 90], [12, 24, 250, 210]];
    const light = [0, 1, 2].map(channel => {
      let light = 0;
      for (const color of colors) { const alpha = color[3]! / 255 / 3; light = color[channel]! * alpha + light * (1 - alpha); }
      return light;
    });
    let alpha = 0;
    for (const color of colors) { const a = color[3]! / 255 / 3; alpha = a + alpha * (1 - a); }
    const expected = encode(light, alpha);
    assert.equal(far.farPlanes!.stacks.length, 1);
    assert.equal(far.farPlanes!.side.views, 16);
    assert.equal(far.farPlanes!.side.coefficients.length, 16);
    for (const [index, stack] of far.farPlanes!.stacks.entries()) {
      const picture = stack.leaves[0]!;
      const pixels = await sharp(resolve(directory, picture.texturePath)).raw().toBuffer();
      assert.deepEqual([...pixels], expected);
      const high = await sharp(resolve(directory, stack.leaves[1]!.texturePath)).raw().toBuffer();
      let highAlpha = 0;
      const highLight = [0, 0, 0];
      for (const color of colors) {
        const a = color[3]! / 255 * .999;
        highAlpha = a + highAlpha * (1 - a);
        for (let channel = 0; channel < 3; channel++) highLight[channel] = color[channel]! * a + highLight[channel]! * (1 - a);
      }
      assert.deepEqual([...high], encode(highLight, highAlpha), 'high endpoint uses saturated slab opacity');
      assert.equal(stack.leaves.length, 2);
      assert.ok(far.farPlanes!.gainBlend[index]!.samples.length >= 2);
      assert.equal(picture.centerUnits[2], 0);
      const matrix = picture.style.transform.slice(9, -1).split(',').map(Number);
      assert.equal(matrix[14], 0);
    }
    for (const [path, bytes] of originals) assert.deepEqual(readFileSync(resolve(directory, path)), bytes);
    assert.deepEqual(far.stacks, volume.stacks);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
