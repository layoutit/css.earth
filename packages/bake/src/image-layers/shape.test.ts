import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import sharp from 'sharp';
import { parseImageLayerRecipe } from './config.ts';
import { prepareImageLayers } from './prepare.ts';

type Leaf = { id: string; texturePath: string; verticesUnits: number[][] };
type Texture = { data: Buffer; width: number; height: number; origin: number[]; right: number[]; down: number[]; depth: number };

const SIZE = 64;

/** A leaf's pixels and its rectangle in the bank's frame: its top-left corner and its two edges. */
async function texture(directory: string, leaf: Leaf): Promise<Texture> {
  const { data, info } = await sharp(join(directory, leaf.texturePath)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const [topLeft, topRight, , bottomLeft] = leaf.verticesUnits as [number[], number[], number[], number[]];
  return { data, width: info.width, height: info.height, origin: topLeft, right: [topRight[0]! - topLeft[0]!, topRight[1]! - topLeft[1]!], down: [bottomLeft[0]! - topLeft[0]!, bottomLeft[1]! - topLeft[1]!],
    depth: leaf.verticesUnits.reduce((sum, vertex) => sum + vertex[2]!, 0) / 4 };
}

/** The nearest texel of a leaf at a place in the bank's frame, or null outside the leaf. */
function texel(leaf: Texture, x: number, y: number): [number, number, number, number] | null {
  const dx = x - leaf.origin[0]!, dy = y - leaf.origin[1]!, det = leaf.right[0]! * leaf.down[1]! - leaf.right[1]! * leaf.down[0]!;
  const i = Math.floor((dx * leaf.down[1]! - dy * leaf.down[0]!) / det * leaf.width), j = Math.floor((leaf.right[0]! * dy - leaf.right[1]! * dx) / det * leaf.height);
  if (i < 0 || j < 0 || i >= leaf.width || j >= leaf.height) return null;
  const at = 4 * (j * leaf.width + i);
  return [leaf.data[at]!, leaf.data[at + 1]!, leaf.data[at + 2]!, leaf.data[at + 3]!];
}

test('a shape\'s slices and the flat picture add up to the photograph along the Sun\'s sight line', async () => {
  const root = await mkdtemp(join(tmpdir(), 'image-layer-shape-')), source = join(root, 'source');
  try {
    await mkdir(source);
    // A smooth blue-green glow with a brighter orange ring, one bright knot and one dark knot.
    const rgb = Buffer.alloc(SIZE * SIZE * 3);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const radius = Math.hypot(x - 31.5, y - 31.5), glow = radius < 26 ? 150 : 0, ring = Math.abs(radius - 20) < 3 ? 90 : 0, at = 3 * (y * SIZE + x);
      const knot = x === 30 && y === 26 ? 1.5 : x === 36 && y === 34 ? 0.4 : 1;
      rgb[at] = Math.min(255, (0.2 * glow + ring) * knot); rgb[at + 1] = Math.min(255, (0.7 * glow + 0.5 * ring) * knot); rgb[at + 2] = Math.min(255, glow * knot);
    }
    await writeFile(join(source, 'source.png'), await sharp(rgb, { raw: { width: SIZE, height: SIZE, channels: 3 } }).png().toBuffer());
    await writeFile(join(source, 'provenance.json'), '{}\n');
    // 0.01° at 1000 pc is 0.175 pc across; the sphere is 0.05 pc in radius, inside the glow.
    const flat = { schema: 'cssearth-image-layer-recipe@1', id: 'fixture', source: { path: 'source.png', dimensions: [SIZE, SIZE], originalDimensions: [SIZE, SIZE], publisherUrl: 'https://example.test', downloadUrl: 'https://example.test/a', credit: 'Fixture', license: 'CC-BY-4.0' },
      observation: { centerRaDeg: 10, centerDecDeg: 20, fieldOfViewDeg: [0.01, 0.01], northClockwiseDeg: 20 }, target: { centerRaDeg: 10, centerDecDeg: 20, distancePc: 1000 },
      geometry: { kind: 'inclined-disk', inclinationDeg: 0.001, lineOfNodesPaDeg: 0, thicknessKpc: 1e-7, supportRadiusKpc: 0.0001, supportTaperFraction: 0.9, depthWeights: [0.25, 0.5, 0.25], depthScales: [1, 1, 1], unit: 'pc' },
      bake: { maxFacePixels: SIZE, diffuseFacePixels: 16, crossAxisSlices: 3, crossAxisAlongPixels: 16, crossAxisDepthPixels: 9, backgroundFloor: 0, edgeTaperFraction: 0.01, diffuseFraction: 0.6, diffuseSigmaPixels: 1, flat: true, encoding: { format: 'webp', quality: 100 } },
      provenance: { path: 'provenance.json' } };
    const shaped = { ...flat, geometry: { ...flat.geometry, shape: { source: 'fixture', basis: 'fixture', semiAxesKpc: { polar: 0.00005, major: 0.00005, minor: 0.00005 }, polarTiltDeg: 0, polarLeansToPaDeg: 0, majorPaDeg: 0, share: 1, smoothPixels: 2 } },
      bake: { ...flat.bake, bulgeSlices: 16, bulgeFacePixels: 32, bulgeCrossSlices: 8 } };
    const reference = await prepareImageLayers({ sourceDirectory: source, outputDirectory: join(root, 'flat'), recipe: parseImageLayerRecipe(flat) });
    const bank = await prepareImageLayers({ sourceDirectory: source, outputDirectory: join(root, 'shaped'), recipe: parseImageLayerRecipe(shaped) });
    const leaves = bank.banks.find(entry => entry.axis === 'z')!.leaves as Leaf[], slices = leaves.filter(leaf => leaf.id.startsWith('bulge-z-'));
    assert.ok(slices.length > 8 && slices.length <= 16, `${slices.length} slices`);
    for (const axis of ['x', 'y'] as const) assert.ok(bank.banks.find(entry => entry.axis === axis)!.leaves.some(leaf => leaf.id.startsWith(`bulge-${axis}-`)), `${axis} curtains`);
    const textures = await Promise.all(leaves.map(leaf => texture(join(root, 'shaped'), leaf)));
    // Farthest from the Sun first: the frame's z points away from it.
    const order = textures.map((leaf, index) => ({ leaf, id: leaves[index]!.id })).sort((a, b) => b.leaf.depth - a.leaf.depth);
    const picture = order.find(entry => entry.id === 'z-detail')!.leaf;
    assert.ok(order.some(entry => entry.leaf.depth < picture.depth) && order.some(entry => entry.leaf.depth > picture.depth), 'slices stand on both sides of the picture');
    // A browser keeps a slice's color premultiplied in 8 bits: every slice texel must premultiply to a whole number
    // whether the browser rounds or truncates, and the whole fill has one color where its light is not rounded away.
    let faint = 0;
    for (const { leaf, id } of order) { if (id === 'z-detail') continue;
      for (let at = 0; at < leaf.data.length; at += 4) { const alpha = leaf.data[at + 3]!; if (!alpha) continue; faint = Math.max(faint, alpha);
        for (let channel = 0; channel < 3; channel++) { const light = leaf.data[at + channel]! * alpha / 255; assert.equal(Math.floor(light), Math.round(light), `${id}: ${leaf.data[at + channel]} at alpha ${alpha}`); } } }
    assert.ok(faint > 0 && faint < 40, `slices are faint: the largest alpha is ${faint}`);
    // The Sun's view: the leaves over one another, farthest first, against the flat bake of the same picture.
    const flatLeaf = reference.banks.find(entry => entry.axis === 'z')!.leaves[0] as Leaf, flatTexture = await texture(join(root, 'flat'), flatLeaf);
    let total = 0, alone = 0, far = 0, count = 0, moved = 0;
    for (let row = 0; row < picture.height; row++) for (let column = 0; column < picture.width; column++) {
      const a = (column + 0.5) / picture.width, b = (row + 0.5) / picture.height, x = picture.origin[0]! + a * picture.right[0]! + b * picture.down[0]!, y = picture.origin[1]! + a * picture.right[1]! + b * picture.down[1]!;
      const seen = [0, 0, 0], own = [0, 0, 0]; let through = 0;
      for (const { leaf, id } of order) { const sample = texel(leaf, x, y); if (!sample) continue; const alpha = sample[3] / 255; if (id !== 'z-detail' && alpha) through++;
        for (let channel = 0; channel < 3; channel++) { seen[channel] = sample[channel]! * alpha + seen[channel]! * (1 - alpha); if (id === 'z-detail') own[channel] = sample[channel]! * alpha; } }
      const wanted = texel(flatTexture, x, y); if (!wanted) continue;
      if (!through) continue;
      moved++;
      for (let channel = 0; channel < 3; channel++) { const light = wanted[channel]! * wanted[3] / 255, difference = Math.abs(seen[channel]! - light); total += difference; alone += Math.abs(own[channel]! - light); if (difference > 8) far++; count++; }
    }
    assert.ok(moved > 200, `the sphere covers ${moved} pixels of the picture`);
    // Inside the sphere the flat picture alone is off by the light it gave; with the slices the sum is the photograph's.
    assert.ok(total / count < 4, `the mean difference from the flat picture is ${(total / count).toFixed(2)} of 255`);
    assert.ok(alone > 5 * total, `the picture alone differs by ${(alone / count).toFixed(2)} of 255, the sum by ${(total / count).toFixed(2)}`);
    assert.ok(far / count < 0.1, `${(100 * far / count).toFixed(1)}% of the samples differ by more than 8 of 255`);
    assert.match(bank.approximation.limitations.join(' '), /an even fill of the published ellipsoid, not a measurement/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
