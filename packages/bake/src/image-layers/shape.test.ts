import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import sharp from 'sharp';
import { imageLayerBodyModel } from './body.ts';
import { parseImageLayerRecipe } from './config.ts';
import { prepareImageLayers } from './prepare.ts';

type Leaf = { id: string; texturePath: string; verticesUnits: number[][]; style: { width: string; height: string; transform: string } };
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

test('a nebula\'s walls hold the light inside their outline and add up to the photograph along the Sun\'s sight line', async () => {
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
    // 0.01° is 36 arcsec across 64 pixels. The shell is 12 arcsec in radius on the sky; at 1 km/s per arcsec its walls,
    // moving at 8 km/s, stand 8 arcsec in front of the star and behind it: 0.0388 pc at 1000 pc.
    const flat = { schema: 'cssearth-image-layer-recipe@1', id: 'fixture', source: { path: 'source.png', dimensions: [SIZE, SIZE], originalDimensions: [SIZE, SIZE], publisherUrl: 'https://example.test', downloadUrl: 'https://example.test/a', credit: 'Fixture', license: 'CC-BY-4.0' },
      observation: { centerRaDeg: 10, centerDecDeg: 20, fieldOfViewDeg: [0.01, 0.01], northClockwiseDeg: 20 }, target: { centerRaDeg: 10, centerDecDeg: 20, distancePc: 1000 },
      geometry: { kind: 'inclined-disk', inclinationDeg: 0.001, lineOfNodesPaDeg: 0, thicknessKpc: 1e-7, supportRadiusKpc: 0.0001, supportTaperFraction: 0.9, depthWeights: [0.25, 0.5, 0.25], depthScales: [1, 1, 1], unit: 'pc' },
      bake: { maxFacePixels: SIZE, diffuseFacePixels: 16, crossAxisSlices: 3, crossAxisAlongPixels: 16, crossAxisDepthPixels: 9, backgroundFloor: 0, edgeTaperFraction: 0.01, diffuseFraction: 0.6, diffuseSigmaPixels: 1, flat: true, encoding: { format: 'webp', quality: 100 } },
      provenance: { path: 'provenance.json' } };
    const shaped = { ...flat, geometry: { ...flat.geometry, shape: { source: 'fixture', basis: 'fixture', expansionKmSPerArcsec: 1, ring: { semiMajorArcsec: 12, semiMinorArcsec: 12, majorPaDeg: 0, polarTiltDeg: 0, polarLeansToPaDeg: 0, expansionKmS: [8, 8, 8] }, smoothPixels: 2 } },
      bake: { ...flat.bake, bulgeSlices: 17, bulgeFacePixels: 32, bulgeCrossSlices: 8 } };
    const reference = await prepareImageLayers({ sourceDirectory: source, outputDirectory: join(root, 'flat'), recipe: parseImageLayerRecipe(flat) });
    const bank = await prepareImageLayers({ sourceDirectory: source, outputDirectory: join(root, 'shaped'), recipe: parseImageLayerRecipe(shaped) });
    const leaves = bank.banks.find(entry => entry.axis === 'z')!.leaves as Leaf[], terraces = leaves.filter(leaf => leaf.id.startsWith('shape-z-'));
    assert.ok(terraces.length > 8 && terraces.length <= 17, `${terraces.length} terraces`);
    for (const axis of ['x', 'y'] as const) assert.ok(bank.banks.find(entry => entry.axis === axis)!.leaves.some(leaf => leaf.id.startsWith(`shape-${axis}-`)), `${axis} curtains`);
    // A parsec bank's leaves are drawn on their quads: the box each style gives, through its matrix, is its quad's size at
    // 50 CSS pixels per unit. Drawn beyond their quads, terraces that share a pixel's light overlap as rings.
    for (const entry of bank.banks) for (const leaf of entry.leaves as Leaf[]) {
      const [corner, right, , down] = leaf.verticesUnits as [number[], number[], number[], number[]], matrix = /matrix3d\(([^)]+)\)/.exec(leaf.style.transform)![1]!.split(',').map(Number);
      const drawn = [parseFloat(leaf.style.width) * Math.hypot(matrix[0]!, matrix[1]!, matrix[2]!), parseFloat(leaf.style.height) * Math.hypot(matrix[4]!, matrix[5]!, matrix[6]!)];
      const quad = [right, down].map(vertex => 50 * Math.hypot(...vertex.map((value, axis) => value - corner[axis]!)));
      assert.ok(Math.abs(drawn[0]! - quad[0]!) < 0.01 && Math.abs(drawn[1]! - quad[1]!) < 0.01, `${leaf.id}: drawn ${drawn.map(value => value.toFixed(3)).join(' x ')} CSS px for a quad of ${quad.map(value => value.toFixed(3)).join(' x ')}`);
    }
    const textures = await Promise.all(leaves.map(leaf => texture(join(root, 'shaped'), leaf)));
    // Farthest from the Sun first: the frame's z points away from it.
    const order = textures.map((leaf, index) => ({ leaf, id: leaves[index]!.id })).sort((a, b) => b.leaf.depth - a.leaf.depth);
    const depths = order.filter(entry => entry.id !== 'z-detail').map(entry => entry.leaf.depth);
    // The walls reach 8 arcsec either side of the picture's plane, as far in front as behind.
    const reach = 8 * 1000 * Math.PI / 648000;
    assert.ok(Math.abs(Math.max(...depths) - reach) < reach / 8 && Math.abs(Math.min(...depths) + reach) < reach / 8, `${Math.min(...depths)} to ${Math.max(...depths)}, for ${reach}`);
    // The Sun's view: the leaves over one another, farthest first, against the flat bake of the same picture.
    const flatLeaf = reference.banks.find(entry => entry.axis === 'z')!.leaves[0] as Leaf, flatTexture = await texture(join(root, 'flat'), flatLeaf);
    let total = 0, alone = 0, far = 0, count = 0, moved = 0;
    for (let row = 0; row < flatTexture.height; row++) for (let column = 0; column < flatTexture.width; column++) {
      const a = (column + 0.5) / flatTexture.width, b = (row + 0.5) / flatTexture.height, x = flatTexture.origin[0]! + a * flatTexture.right[0]! + b * flatTexture.down[0]!, y = flatTexture.origin[1]! + a * flatTexture.right[1]! + b * flatTexture.down[1]!;
      const seen = [0, 0, 0], own = [0, 0, 0]; let through = 0;
      for (const { leaf, id } of order) { const sample = texel(leaf, x, y); if (!sample) continue; const alpha = sample[3] / 255; if (id !== 'z-detail' && alpha) through++;
        for (let channel = 0; channel < 3; channel++) { seen[channel] = sample[channel]! * alpha + seen[channel]! * (1 - alpha); if (id === 'z-detail') own[channel] = sample[channel]! * alpha; } }
      const wanted = texel(flatTexture, x, y)!;
      if (!through) continue;
      moved++;
      for (let channel = 0; channel < 3; channel++) { const light = wanted[channel]! * wanted[3] / 255, difference = Math.abs(seen[channel]! - light); total += difference; alone += own[channel]!; if (difference > 8) far++; count++; }
    }
    // Inside the outline the light is on the walls, none of it left on the flat picture, and the walls add up to the
    // photograph, within what the lossy color subsampling moves at this fixture's hard edges.
    assert.ok(moved > 1000, `the walls cover ${moved} pixels of the picture`);
    assert.ok(alone / count < 1, `the flat picture keeps ${(alone / count).toFixed(2)} of 255 inside the outline`);
    assert.ok(total / count < 4, `the mean difference from the flat picture is ${(total / count).toFixed(2)} of 255`);
    assert.ok(far / count < 0.1, `${(100 * far / count).toFixed(1)}% of the samples differ by more than 8 of 255`);
    assert.match(bank.approximation.limitations.join(' '), /ellipsoids from published expansion speeds/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a nebula\'s filled body holds the light inside its outline, carves its cavities where the picture is dim, and adds up to the photograph', async () => {
  const root = await mkdtemp(join(tmpdir(), 'image-layer-body-')), source = join(root, 'source');
  try {
    await mkdir(source);
    // 0.01° is 36 arcsec across 64 pixels. An evenly filled spheroid in an envelope, with two dim patches 5 arcsec from the
    // star: one where the near pole leans (position angle 300°), one to the south. A faint glow lies around the envelope.
    const body = { source: 'fixture', basis: 'fixture', semiPolarArcsec: 14, semiEquatorialArcsec: 12, polarTiltDeg: 25, polarLeansToPaDeg: 300,
      envelope: { source: 'fixture', radiusArcsec: 16 }, cavities: { source: 'fixture', emission: 0.3, sizeArcsec: 5, farBetweenPaDeg: [135, 210] as [number, number] } };
    const model = imageLayerBodyModel(body), scale = 36 / SIZE, dim = (30 / 50) ** 2, sky = (x: number, y: number): [number, number] => [(31.5 - x) * scale, (31.5 - y) * scale];
    const place = (radius: number, paDeg: number): [number, number] => [31.5 - radius * Math.sin(paDeg * Math.PI / 180) / scale, 31.5 - radius * Math.cos(paDeg * Math.PI / 180) / scale];
    const eyes = [place(5, 300), place(5, 180)], rgb = Buffer.alloc(SIZE * SIZE * 3);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const line = model.along(...sky(x, y)), at = 3 * (y * SIZE + x);
      if (!line) { if (Math.hypot(...sky(x, y)) < 17.5) { rgb[at] = 6; rgb[at + 1] = 14; rgb[at + 2] = 26; } continue; }
      const path = dim * (line.envelope![1] - line.envelope![0]) + (line.body ? (1 - dim) * (line.body[1] - line.body[0]) : 0), dip = eyes.some(([ex, ey]) => Math.hypot(x - ex, y - ey) < 3) ? 0.7 : 1;
      const light = 1 - Math.exp(-0.04 * path * dip);
      rgb[at] = Math.round(60 * light); rgb[at + 1] = Math.round(140 * light); rgb[at + 2] = Math.round(255 * light);
    }
    await writeFile(join(source, 'source.png'), await sharp(rgb, { raw: { width: SIZE, height: SIZE, channels: 3 } }).png().toBuffer());
    await writeFile(join(source, 'provenance.json'), '{}\n');
    const flat = { schema: 'cssearth-image-layer-recipe@1', id: 'fixture', source: { path: 'source.png', dimensions: [SIZE, SIZE], originalDimensions: [SIZE, SIZE], publisherUrl: 'https://example.test', downloadUrl: 'https://example.test/a', credit: 'Fixture', license: 'CC-BY-4.0' },
      observation: { centerRaDeg: 10, centerDecDeg: 20, fieldOfViewDeg: [0.01, 0.01], northClockwiseDeg: 0 }, target: { centerRaDeg: 10, centerDecDeg: 20, distancePc: 1000 },
      geometry: { kind: 'inclined-disk', inclinationDeg: 0.001, lineOfNodesPaDeg: 0, thicknessKpc: 1e-7, supportRadiusKpc: 0.0001, supportTaperFraction: 0.9, depthWeights: [0.25, 0.5, 0.25], depthScales: [1, 1, 1], unit: 'pc' },
      bake: { maxFacePixels: SIZE, diffuseFacePixels: 16, crossAxisSlices: 3, crossAxisAlongPixels: 16, crossAxisDepthPixels: 9, backgroundFloor: 0, edgeTaperFraction: 0.01, diffuseFraction: 0.6, diffuseSigmaPixels: 1, flat: true, encoding: { format: 'webp', quality: 100 } },
      provenance: { path: 'provenance.json' } };
    const filled = { ...flat, geometry: { ...flat.geometry, body }, bake: { ...flat.bake, bulgeSlices: 12, bulgeFacePixels: SIZE, bulgeCrossSlices: 8 } };
    assert.throws(() => parseImageLayerRecipe({ ...filled, geometry: { ...filled.geometry, body: { ...body, polarTiltDeg: 90 } } }), /from 0 to under 90/);
    const reference = await prepareImageLayers({ sourceDirectory: source, outputDirectory: join(root, 'flat'), recipe: parseImageLayerRecipe(flat) });
    const bank = await prepareImageLayers({ sourceDirectory: source, outputDirectory: join(root, 'filled'), recipe: parseImageLayerRecipe(filled) });
    const leaves = bank.banks.find(entry => entry.axis === 'z')!.leaves as Leaf[], slabs = leaves.filter(leaf => leaf.id.startsWith('shape-z-'));
    assert.equal(slabs.length, 12);
    for (const axis of ['x', 'y'] as const) assert.ok(bank.banks.find(entry => entry.axis === axis)!.leaves.some(leaf => leaf.id.startsWith(`shape-${axis}-`)), `${axis} curtains`);
    const textures = await Promise.all(leaves.map(leaf => texture(join(root, 'filled'), leaf)));
    const order = textures.map((leaf, index) => ({ leaf, id: leaves[index]!.id })).sort((a, b) => b.leaf.depth - a.leaf.depth);
    const flatLeaf = reference.banks.find(entry => entry.axis === 'z')!.leaves[0] as Leaf, flatTexture = await texture(join(root, 'flat'), flatLeaf);
    const where = (column: number, row: number): [number, number] => { const a = (column + 0.5) / flatTexture.width, b = (row + 0.5) / flatTexture.height; return [flatTexture.origin[0]! + a * flatTexture.right[0]! + b * flatTexture.down[0]!, flatTexture.origin[1]! + a * flatTexture.right[1]! + b * flatTexture.down[1]!]; };
    // The optical depth a sight line has in front of the star and behind it.
    const halves = (column: number, row: number) => { const [x, y] = where(column, row); let front = 0, back = 0;
      for (const { leaf, id } of order) { const sample = id === 'z-detail' ? null : texel(leaf, x, y); if (!sample) continue; const depth = -Math.log(1 - sample[3] / 255); if (leaf.depth < 0) front += depth; else back += depth; }
      return { front, back }; };
    // Where the near pole leans the cavity is in front of the star; to the south it is behind; away from both the body is even.
    const northWest = halves(Math.round(eyes[0]![0]), Math.round(eyes[0]![1])), south = halves(Math.round(eyes[1]![0]), Math.round(eyes[1]![1])), even = halves(...(place(5, 30).map(Math.round) as [number, number]));
    assert.ok(northWest.front < 0.75 * northWest.back, `north-west: ${northWest.front} in front, ${northWest.back} behind`);
    assert.ok(south.back < 0.75 * south.front, `south: ${south.front} in front, ${south.back} behind`);
    assert.ok(Math.abs(even.front - even.back) < 0.15 * even.back, `on the equator: ${even.front} in front, ${even.back} behind`);
    // The Sun's view, as a browser draws it (each leaf's color times its opacity, in whole numbers rounded down).
    let total = 0, alone = 0, count = 0, moved = 0;
    for (let row = 0; row < flatTexture.height; row++) for (let column = 0; column < flatTexture.width; column++) {
      const [x, y] = where(column, row), seen = [0, 0, 0], own = [0, 0, 0]; let through = 0;
      for (const { leaf, id } of order) { const sample = texel(leaf, x, y); if (!sample) continue; const alpha = sample[3] / 255; if (id !== 'z-detail' && alpha) through++;
        for (let channel = 0; channel < 3; channel++) { seen[channel] = Math.floor(sample[channel]! * alpha) + seen[channel]! * (1 - alpha); if (id === 'z-detail') own[channel] = sample[channel]! * alpha; } }
      if (!through) continue;
      const wanted = texel(flatTexture, x, y)!; moved++;
      for (let channel = 0; channel < 3; channel++) { total += Math.abs(seen[channel]! - wanted[channel]! * wanted[3] / 255); alone += own[channel]!; count++; }
    }
    assert.ok(moved > 2000, `the body covers ${moved} pixels of the picture`);
    assert.ok(alone / count < 1, `the flat picture keeps ${(alone / count).toFixed(2)} of 255 inside the outline`);
    assert.ok(total / count < 4, `the mean difference from the flat picture is ${(total / count).toFixed(2)} of 255`);
    assert.match(bank.approximation.limitations.join(' '), /published outline, pole and cavity emission/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
