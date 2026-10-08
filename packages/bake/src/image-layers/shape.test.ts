import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import sharp from 'sharp';
import { imageLayerBodyModel } from './body.ts';
import { parseImageLayerRecipe } from './config.ts';
import { prepareImageLayers } from './prepare.ts';
import { imageLayerShapeModel, ringOutlineRadius } from './shape.ts';

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

test('an inner shell closes inside the main shell, and measured speeds say where the fine detail lies', async () => {
  const root = await mkdtemp(join(tmpdir(), 'image-layer-shape-inner-')), source = join(root, 'source');
  try {
    await mkdir(source);
    // A smooth glow 14.6 arcsec in radius (36 arcsec across 64 pixels) with four knots and a star at its middle.
    const pixel = 36 / SIZE, knots = { approaching: [28, 31], receding: [36, 33], resting: [31, 16], capped: [46, 32] } as const, rgb = Buffer.alloc(SIZE * SIZE * 3);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      let lit = Math.hypot(x - 31.5, y - 31.5) < 26 ? 90 : 0;
      for (const [kx, ky] of Object.values(knots)) lit += 150 * Math.exp(-((x - kx) ** 2 + (y - ky) ** 2) / 3);
      if ((x === 31 || x === 32) && (y === 31 || y === 32)) lit += 160;
      const at = 3 * (y * SIZE + x); rgb[at] = Math.min(255, lit); rgb[at + 1] = Math.min(255, 0.7 * lit); rgb[at + 2] = Math.min(255, 0.4 * lit);
    }
    await writeFile(join(source, 'source.png'), await sharp(rgb, { raw: { width: SIZE, height: SIZE, channels: 3 } }).png().toBuffer());
    await writeFile(join(source, 'provenance.json'), '{}\n');
    // North is up and east to the left: a knot's place from the star, in arcseconds, and its speed along the sight line.
    const sky = ([kx, ky]: readonly [number, number]) => [(31.5 - kx) * pixel, (31.5 - ky) * pixel] as const, speeds = { approaching: -20, receding: 20, resting: 0, capped: 10 };
    await writeFile(join(source, 'speeds.txt'), Object.entries(knots).map(([name, at]) => `${sky(at).map(value => value.toFixed(2)).join(' ')} skipped ${speeds[name as keyof typeof speeds]}`).join('\n') + '\n');
    // The main shell is a sphere of 12 arcsec (8 km/s at 12 arcsec); the inner shell is 5 by 4 arcsec on the sky and,
    // at 30 km/s under its own law of 5 km/s per arcsec, 6 arcsec along its pole, which points at the Sun.
    const flat = { schema: 'cssearth-image-layer-recipe@1', id: 'fixture', source: { path: 'source.png', dimensions: [SIZE, SIZE], originalDimensions: [SIZE, SIZE], publisherUrl: 'https://example.test', downloadUrl: 'https://example.test/a', credit: 'Fixture', license: 'CC-BY-4.0' },
      observation: { centerRaDeg: 10, centerDecDeg: 20, fieldOfViewDeg: [0.01, 0.01], northClockwiseDeg: 0 }, target: { centerRaDeg: 10, centerDecDeg: 20, distancePc: 1000 },
      geometry: { kind: 'inclined-disk', inclinationDeg: 0.001, lineOfNodesPaDeg: 0, thicknessKpc: 1e-7, supportRadiusKpc: 0.0001, supportTaperFraction: 0.9, depthWeights: [0.25, 0.5, 0.25], depthScales: [1, 1, 1], unit: 'pc' },
      bake: { maxFacePixels: SIZE, diffuseFacePixels: 16, crossAxisSlices: 3, crossAxisAlongPixels: 16, crossAxisDepthPixels: 9, backgroundFloor: 0, edgeTaperFraction: 0.01, diffuseFraction: 0.6, diffuseSigmaPixels: 1, flat: true, encoding: { format: 'webp', quality: 100 } },
      provenance: { path: 'provenance.json' } };
    const shape = { source: 'fixture', basis: 'fixture', expansionKmSPerArcsec: 8 / 12, ring: { semiMajorArcsec: 12, semiMinorArcsec: 12, majorPaDeg: 0, polarTiltDeg: 0, polarLeansToPaDeg: 0, expansionKmS: [8, 8, 8] },
      inner: { source: 'fixture', semiMajorArcsec: 5, semiMinorArcsec: 4, majorPaDeg: 0, expansionKmSPerArcsec: 5, expansionKmS: [30, 30, 30] },
      speeds: { source: 'fixture', basis: 'fixture', path: 'speeds.txt', columns: { east: 0, north: 1, kmS: 3 }, restKmS: 4, wallKmS: 10, reachArcsec: 0.8 }, starRadiusArcsec: 0.6, smoothPixels: 2 };
    const shaped = { ...flat, geometry: { ...flat.geometry, shape }, bake: { ...flat.bake, bulgeSlices: 25, bulgeFacePixels: 32, bulgeCrossSlices: 8 } };
    const reference = await prepareImageLayers({ sourceDirectory: source, outputDirectory: join(root, 'flat'), recipe: parseImageLayerRecipe(flat) });
    const bank = await prepareImageLayers({ sourceDirectory: source, outputDirectory: join(root, 'shaped'), recipe: parseImageLayerRecipe(shaped) });
    const leaves = bank.banks.find(entry => entry.axis === 'z')!.leaves as Leaf[], textures = await Promise.all(leaves.map(leaf => texture(join(root, 'shaped'), leaf)));
    const order = textures.map((leaf, index) => ({ leaf, id: leaves[index]!.id })).sort((a, b) => b.leaf.depth - a.leaf.depth), arcsec = 1000 * Math.PI / 648000;
    // Where a place's brightest light lies along the sight line, in arcseconds from the star: the terrace that shows the most of it.
    const depthOf = ([east, north]: readonly [number, number]) => { let best = { depth: NaN, light: -1 };
      for (const { leaf, id } of order) { const sample = id === 'z-detail' ? null : texel(leaf, east * arcsec, north * arcsec); if (sample && sample[0] * sample[3] > best.light) best = { depth: leaf.depth / arcsec, light: sample[0] * sample[3] }; }
      return best.depth; };
    // Inside the inner shell a knot is on the wall its speed gives: 6 arcsec along the pole, less toward the outline.
    const approaching = depthOf(sky(knots.approaching)), receding = depthOf(sky(knots.receding));
    assert.ok(approaching < -3 && approaching > -6.5, `the approaching knot is ${approaching} arcsec from the star's plane`);
    assert.ok(receding > 3 && receding < 6.5, `the receding knot is ${receding} arcsec from the star's plane`);
    // Outside it a knot at rest is on the equatorial plane, and one at the walls' speed on the main shell's far wall, 8.8 arcsec back there.
    const resting = depthOf(sky(knots.resting)), capped = depthOf(sky(knots.capped));
    assert.ok(Math.abs(resting) < 1.5, `the knot at rest is ${resting} arcsec from the plane`);
    assert.ok(capped > 6 && capped < 10, `the knot at the walls' speed is ${capped} arcsec behind the plane`);
    // The star's own light stays at the star, though the inner shell's walls stand 6 arcsec in front of it and behind.
    assert.ok(Math.abs(depthOf([0.28, 0.28])) < 1.5, `the star's light is ${depthOf([0.28, 0.28])} arcsec from the star`);
    const depths = order.filter(entry => entry.id !== 'z-detail').map(entry => entry.leaf.depth / arcsec);
    assert.ok(Math.max(...depths) > 10 && Math.min(...depths) < -10, `the main shell's walls reach ${Math.min(...depths)} to ${Math.max(...depths)} arcsec`);
    // The Sun's view: the leaves over one another, farthest first, against the flat bake of the same picture.
    const flatLeaf = reference.banks.find(entry => entry.axis === 'z')!.leaves[0] as Leaf, flatTexture = await texture(join(root, 'flat'), flatLeaf);
    let total = 0, count = 0, worst = 0;
    for (let row = 0; row < flatTexture.height; row++) for (let column = 0; column < flatTexture.width; column++) {
      const a = (column + 0.5) / flatTexture.width, b = (row + 0.5) / flatTexture.height, x = flatTexture.origin[0]! + a * flatTexture.right[0]! + b * flatTexture.down[0]!, y = flatTexture.origin[1]! + a * flatTexture.right[1]! + b * flatTexture.down[1]!, seen = [0, 0, 0];
      for (const { leaf } of order) { const sample = texel(leaf, x, y); if (!sample) continue; const alpha = sample[3] / 255; for (let channel = 0; channel < 3; channel++) seen[channel] = sample[channel]! * alpha + seen[channel]! * (1 - alpha); }
      const wanted = texel(flatTexture, x, y)!;
      for (let channel = 0; channel < 3; channel++) { const difference = Math.abs(seen[channel]! - wanted[channel]! * wanted[3] / 255); total += difference; worst = Math.max(worst, difference); count++; }
    }
    assert.ok(total / count < 4, `the mean difference from the flat picture is ${(total / count).toFixed(2)} of 255 (worst ${worst.toFixed(0)})`);
    assert.throws(() => parseImageLayerRecipe({ ...shaped, geometry: { ...shaped.geometry, shape: { ...shape, lobe: { source: 'fixture', radiusArcsec: 3, expansionKmS: [9, 9, 9] } } } }), /not both/u);
    assert.throws(() => parseImageLayerRecipe({ ...shaped, geometry: { ...shaped.geometry, shape: { ...shape, speeds: { ...shape.speeds, columns: { east: 0, north: 1 } } } } }), /columns\.kmS/u);
    await writeFile(join(source, 'speeds.txt'), '1.0 2.0 skipped fast\n');
    await assert.rejects(prepareImageLayers({ sourceDirectory: source, outputDirectory: join(root, 'broken'), recipe: parseImageLayerRecipe(shaped) }), /speeds\.txt has a row without its east, north and speed columns/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a shell with a measured rim follows it: its radius differs by direction, on the sky and along the sight line', () => {
  // A sphere of 20" (its speed under the law is 20" deep), its rim measured 10" to the north and south, 30" to the east and west.
  const outline = { source: 'test', basis: 'test', positionAnglesDeg: [0, 90, 180, 270], radiiArcsec: [10, 30, 10, 30], scale: 1 };
  const shape = { source: 'test', basis: 'test', expansionKmSPerArcsec: 1, smoothPixels: 4,
    ring: { semiMajorArcsec: 20, semiMinorArcsec: 20, majorPaDeg: 0, polarTiltDeg: 0, polarLeansToPaDeg: 0, expansionKmS: [20, 20, 20] as [number, number, number], outline } };
  const rim = ringOutlineRadius(outline);
  assert.ok(Math.abs(rim(0, 1) - 10) < 1e-9 && Math.abs(rim(1, 0) - 30) < 1e-9 && Math.abs(rim(0, -1) - 10) < 1e-9 && Math.abs(rim(-1, 0) - 30) < 1e-9);
  const model = imageLayerShapeModel(shape), mix = [1, 1, 1] as const;
  // Half way out to the rim each way, the shell is sqrt(R^2 - s^2) in front of the star and as far behind it.
  for (const [east, north, radius] of [[0, 5, 10], [15, 0, 30], [0, -5, 10], [-15, 0, 30]] as const) {
    const ends = model.walls(east, north, mix), deep = Math.sqrt(radius * radius - (east * east + north * north));
    assert.ok(ends, `a sight line ${east}" east, ${north}" north meets the shell`);
    assert.ok(Math.abs(ends.near + deep) < 1e-6 && Math.abs(ends.far - deep) < 1e-6, `at ${east}" east, ${north}" north the walls are at ±${deep.toFixed(2)}"; got ${ends.near.toFixed(2)}, ${ends.far.toFixed(2)}`);
  }
  // 15" out the shell holds the light to the east and not to the north: one radius would do both or neither.
  assert.ok(model.walls(15, 0, mix) && !model.walls(0, 15, mix));
  assert.ok(Math.abs(model.ringScale(0, 1) - .5) < 1e-9 && Math.abs(model.ringScale(1, 0) - 1.5) < 1e-9);
  assert.ok(model.reach >= 30, `the shell reaches 30" along the sight line where its rim is 30"; got ${model.reach}`);
});
