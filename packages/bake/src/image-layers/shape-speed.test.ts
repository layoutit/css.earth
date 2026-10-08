import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import sharp from 'sharp';
import { parseImageLayerRecipe } from './config.ts';
import { prepareImageLayers } from './prepare.ts';
import { imageLayerShapePatches } from './shape-patches.ts';
import { imageLayerShapeWalls } from './shape-walls.ts';
import { broadLight, imageLayerShapeModel, type MeasuredSpeed } from './shape.ts';

type Leaf = { id: string; texturePath: string; widthPx: number; heightPx: number; verticesUnits: number[][]; uvs: number[][] };
type Texture = { data: Buffer; atlasWidth: number; left: number; top: number; width: number; height: number; corners: number[][] };

const SIZE = 96, FIELD_ARCSEC = 48, PIXEL = FIELD_ARCSEC / SIZE, ARCSEC = 1000 * Math.PI / 648000;

/** A leaf's texels (its rectangle of its atlas) and its corners in the bank's frame. */
async function texture(directory: string, leaf: Leaf, atlases: Map<string, { data: Buffer; width: number; height: number }>): Promise<Texture> {
  let atlas = atlases.get(leaf.texturePath);
  if (!atlas) { const { data, info } = await sharp(join(directory, leaf.texturePath)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); atlases.set(leaf.texturePath, atlas = { data, width: info.width, height: info.height }); }
  return { data: atlas.data, atlasWidth: atlas.width, left: Math.round(leaf.uvs[0]![0]! * atlas.width), top: Math.round(leaf.uvs[0]![1]! * atlas.height), width: leaf.widthPx, height: leaf.heightPx, corners: leaf.verticesUnits };
}

/** The texel of a leaf on the sight line through a place of the bank's frame, with the leaf's depth there; null outside it. */
function texel(leaf: Texture, x: number, y: number): { rgba: [number, number, number, number]; depth: number } | null {
  const [origin, topRight, , bottomLeft] = leaf.corners as [number[], number[], number[], number[]], right = [topRight[0]! - origin[0]!, topRight[1]! - origin[1]!, topRight[2]! - origin[2]!], down = [bottomLeft[0]! - origin[0]!, bottomLeft[1]! - origin[1]!, bottomLeft[2]! - origin[2]!];
  const dx = x - origin[0]!, dy = y - origin[1]!, det = right[0]! * down[1]! - right[1]! * down[0]!, a = (dx * down[1]! - dy * down[0]!) / det, b = (right[0]! * dy - right[1]! * dx) / det;
  const i = Math.floor(a * leaf.width), j = Math.floor(b * leaf.height);
  if (i < 0 || j < 0 || i >= leaf.width || j >= leaf.height) return null;
  const at = 4 * ((leaf.top + j) * leaf.atlasWidth + leaf.left + i);
  return { rgba: [leaf.data[at]!, leaf.data[at + 1]!, leaf.data[at + 2]!, leaf.data[at + 3]!], depth: origin[2]! + a * right[2]! + b * down[2]! };
}

test('a measured speed is its own depth: its detail lies there, the smooth light on the shell, the rest on the plane', async () => {
  const root = await mkdtemp(join(tmpdir(), 'image-layer-shape-speed-')), source = join(root, 'source');
  try {
    await mkdir(source);
    // A smooth glow with three knots: one measured approaching, one receding, one that no measurement is near.
    const knots = { approaching: [30, 40], receding: [66, 52], unmeasured: [48, 76] } as const, rgb = Buffer.alloc(SIZE * SIZE * 3);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      let lit = Math.hypot(x - 47.5, y - 47.5) < 40 ? 60 : 0;
      for (const [kx, ky] of Object.values(knots)) lit += 170 * Math.exp(-((x - kx) ** 2 + (y - ky) ** 2) / 4);
      const at = 3 * (y * SIZE + x); rgb[at] = Math.min(255, lit); rgb[at + 1] = Math.min(255, 0.7 * lit); rgb[at + 2] = Math.min(255, 0.4 * lit);
    }
    await writeFile(join(source, 'source.png'), await sharp(rgb, { raw: { width: SIZE, height: SIZE, channels: 3 } }).png().toBuffer());
    await writeFile(join(source, 'provenance.json'), '{}\n');
    // North is up and east to the left: a place from the picture's middle in arcseconds. 2 km/s is an arcsecond of depth.
    const sky = ([kx, ky]: readonly [number, number]) => [(47.5 - kx) * PIXEL, (47.5 - ky) * PIXEL] as const, around = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const;
    const rows = (at: readonly [number, number], speed: number) => around.map(([de, dn]) => { const [east, north] = sky(at); return `${(east + de).toFixed(2)} ${(north + dn).toFixed(2)} ${speed}`; });
    await writeFile(join(source, 'speeds.txt'), [...rows(knots.approaching, -12), ...rows(knots.receding, 16)].join('\n') + '\n');
    const flat = { schema: 'cssearth-image-layer-recipe@1', id: 'fixture', source: { path: 'source.png', dimensions: [SIZE, SIZE], originalDimensions: [SIZE, SIZE], publisherUrl: 'https://example.test', downloadUrl: 'https://example.test/a', credit: 'Fixture', license: 'CC-BY-4.0' },
      observation: { centerRaDeg: 10, centerDecDeg: 20, fieldOfViewDeg: [FIELD_ARCSEC / 3600, FIELD_ARCSEC / 3600], northClockwiseDeg: 0 }, target: { centerRaDeg: 10, centerDecDeg: 20, distancePc: 1000 },
      geometry: { kind: 'inclined-disk', inclinationDeg: 0.001, lineOfNodesPaDeg: 0, thicknessKpc: 1e-7, supportRadiusKpc: 0.00011, supportTaperFraction: 0.9, depthWeights: [0.25, 0.5, 0.25], depthScales: [1, 1, 1], unit: 'pc' },
      bake: { maxFacePixels: SIZE, diffuseFacePixels: 16, crossAxisSlices: 3, crossAxisAlongPixels: 16, crossAxisDepthPixels: 9, backgroundFloor: 0, edgeTaperFraction: 0.01, diffuseFraction: 0.6, diffuseSigmaPixels: 1, flat: true, encoding: { format: 'webp', quality: 100 } },
      provenance: { path: 'provenance.json' } };
    const shape = { source: 'fixture', basis: 'fixture', expansionKmSPerArcsec: 2, ring: { semiMajorArcsec: 16, semiMinorArcsec: 16, majorPaDeg: 0, polarTiltDeg: 0, polarLeansToPaDeg: 0, expansionKmS: [32, 32, 32] },
      speeds: { source: 'fixture', basis: 'fixture', path: 'speeds.txt', columns: { east: 0, north: 1, kmS: 2 }, reachArcsec: 1.5, depth: 'speed' }, smoothPixels: 4 };
    const shaped = { ...flat, geometry: { ...flat.geometry, shape }, bake: { ...flat.bake, bulgeSlices: 25, bulgeFacePixels: 32, bulgeCrossSlices: 8 } };
    const reference = await prepareImageLayers({ sourceDirectory: source, outputDirectory: join(root, 'flat'), recipe: parseImageLayerRecipe(flat) });
    const bank = await prepareImageLayers({ sourceDirectory: source, outputDirectory: join(root, 'shaped'), recipe: parseImageLayerRecipe(shaped) });
    // One stack, the same from every side: the flat picture as a scene of its own, then the meshes' scenes.
    const stack = (axis: string) => bank.banks.find(entry => entry.axis === axis)!, z = stack('z') as unknown as { leaves: Leaf[]; scenes?: number[] };
    assert.equal(stack('x').leaves.length, 0); assert.equal(stack('y').leaves.length, 0);
    const lifted = z.leaves.filter(leaf => leaf.id.startsWith('shape-')), level = z.leaves.filter(leaf => !leaf.id.startsWith('shape-'));
    assert.ok(lifted.length >= 4 && level.some(leaf => leaf.id === 'z-detail'), `${lifted.length} patches, ${level.length} flat leaves`);
    assert.deepEqual(z.leaves.slice(0, level.length), level);
    assert.equal(z.scenes![0], level.length); assert.equal(z.scenes!.reduce((total, size) => total + size, 0), z.leaves.length);
    assert.ok(lifted.every(leaf => /^layers\/shape-\d+\.webp$/u.test(leaf.texturePath)));
    const atlases = new Map<string, { data: Buffer; width: number; height: number }>(), textures = await Promise.all(z.leaves.map(leaf => texture(join(root, 'shaped'), leaf, atlases)));
    const patches = textures.slice(level.length), planes = textures.slice(0, level.length);
    // Where a knot's light is drawn off the flat picture: the depth of the patch that shows the most of it, in arcseconds.
    const liftedAt = (at: readonly [number, number]) => { const [east, north] = sky(at); let best = { depth: NaN, light: 0 };
      for (const patch of patches) { const sample = texel(patch, east * ARCSEC, north * ARCSEC); if (sample && sample.rgba[0] * sample.rgba[3] > best.light) best = { depth: sample.depth / ARCSEC, light: sample.rgba[0] * sample.rgba[3] }; }
      return best; };
    const approaching = liftedAt(knots.approaching), receding = liftedAt(knots.receding), unmeasured = liftedAt(knots.unmeasured), toward = Math.sign(approaching.depth);
    // 12 km/s toward the Sun is 6 arcsec in front of the picture's plane; 16 km/s away is 8 arcsec behind it.
    assert.ok(Math.abs(Math.abs(approaching.depth) - 6) < 0.5, `the approaching knot is ${approaching.depth} arcsec from the plane`);
    assert.ok(Math.abs(Math.abs(receding.depth) - 8) < 0.5 && Math.sign(receding.depth) === -toward, `the receding knot is ${receding.depth} arcsec from the plane`);
    // The knot nothing measures stays on the picture's plane, which the measured ones left.
    const onPlane = (at: readonly [number, number]) => { const [east, north] = sky(at); return Math.max(...planes.map(plane => { const sample = texel(plane, east * ARCSEC, north * ARCSEC); return sample ? sample.rgba[0] * sample.rgba[3] / 255 : 0; })); };
    assert.ok(onPlane(knots.unmeasured) > 100, `the plane holds ${onPlane(knots.unmeasured)} of the unmeasured knot`);
    for (const [name, knot] of [['approaching', approaching], ['receding', receding]] as const) assert.ok(onPlane(knots[name]) < 20 && knot.light / 255 > 100, `the plane holds ${onPlane(knots[name])} of the ${name} knot and a patch ${knot.light / 255}`);
    // The glow is the shell's, as far in front of the plane as behind it: on the near wall half of its broad part, which here is nearly all of it, on the far wall the rest of its 60.
    // (A sphere of 16 arcsec is 13.4 from the plane there; patches no smaller than 16 arcsec follow so small a sphere only roughly.)
    const [glowEast, glowNorth] = sky([47, 30]), glow = patches.flatMap(patch => { const sample = texel(patch, glowEast * ARCSEC, glowNorth * ARCSEC); return sample && sample.rgba[3] ? [{ light: sample.rgba[0] * sample.rgba[3] / 255, depth: sample.depth / ARCSEC }] : []; });
    assert.ok(onPlane([47, 30]) < 10, `the plane holds ${onPlane([47, 30])} of the glow`);
    const side = (sign: number) => glow.filter(wall => sign * wall.depth > 0), lightOf = (walls: typeof glow) => walls.reduce((sum, wall) => sum + wall.light, 0), depthOf = (walls: typeof glow) => walls.reduce((sum, wall) => sum + wall.depth * wall.light, 0) / lightOf(walls);
    assert.ok(side(1).length > 0 && side(-1).length > 0 && [1, -1].every(sign => Math.abs(depthOf(side(sign))) > 4 && Math.abs(depthOf(side(sign))) < 16) && Math.abs(depthOf(side(1)) + depthOf(side(-1))) < 1
      && lightOf(side(toward)) > 8 && lightOf(side(toward)) < 36 && lightOf(side(-toward)) >= lightOf(side(toward)) && Math.abs(lightOf(glow) - 60) < 12, `the glow lies at ${JSON.stringify(glow)}`);
    // The Sun's view: the leaves over one another in the order the stack paints them, against the flat bake of the same picture.
    assert.ok(toward !== 0);
    const flatLeaf = reference.banks.find(entry => entry.axis === 'z')!.leaves[0] as unknown as Leaf, wanted = await texture(join(root, 'flat'), flatLeaf, new Map());
    let total = 0, count = 0, worst = 0;
    for (let row = 0; row < wanted.height; row++) for (let column = 0; column < wanted.width; column++) {
      const a = (column + 0.5) / wanted.width, b = (row + 0.5) / wanted.height, [origin, topRight, , bottomLeft] = wanted.corners as [number[], number[], number[], number[]];
      const x = origin[0]! + a * (topRight[0]! - origin[0]!) + b * (bottomLeft[0]! - origin[0]!), y = origin[1]! + a * (topRight[1]! - origin[1]!) + b * (bottomLeft[1]! - origin[1]!), seen = [0, 0, 0];
      for (const leaf of textures) { const sample = texel(leaf, x, y); if (!sample) continue; const alpha = sample.rgba[3] / 255; for (let channel = 0; channel < 3; channel++) seen[channel] = sample.rgba[channel]! * alpha + seen[channel]! * (1 - alpha); }
      const flatSample = texel(wanted, x, y)!.rgba;
      for (let channel = 0; channel < 3; channel++) { const difference = Math.abs(seen[channel]! - flatSample[channel]! * flatSample[3] / 255); total += difference; worst = Math.max(worst, difference); count++; }
    }
    assert.ok(total / count < 4, `the mean difference from the flat picture is ${(total / count).toFixed(2)} of 255 (worst ${worst.toFixed(0)})`);
    assert.throws(() => parseImageLayerRecipe({ ...shaped, geometry: { ...shaped.geometry, shape: { ...shape, speeds: { ...shape.speeds, depth: 'shell' } } } }), /geometry\.shape\.speeds\.depth/u);
    // The speeds that say which wall a feature is on have no meaning here.
    assert.throws(() => parseImageLayerRecipe({ ...shaped, geometry: { ...shaped.geometry, shape: { ...shape, speeds: { ...shape.speeds, wallKmS: 32 } } } }), /speeds\.wallKmS says which wall/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('beyond the ring a measured knot is placed at its depth and the picture is drawn out to it; an unmeasured one stays on the plane', async () => {
  const root = await mkdtemp(join(tmpdir(), 'image-layer-beyond-ring-')), source = join(root, 'source');
  try {
    await mkdir(source);
    // A glow 20 arcsec across about a ring of 12: a knot 19 arcsec east of the star, measured approaching, and one 13
    // arcsec east that no measurement is near. North is up and east to the left.
    const knots = { measured: [9.5, 47.5], unmeasured: [21.5, 47.5] } as const, rgb = Buffer.alloc(SIZE * SIZE * 3);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      let lit = Math.hypot(x - 47.5, y - 47.5) < 40 ? 40 : 0;
      for (const [kx, ky] of Object.values(knots)) lit += 190 * Math.exp(-((x - kx) ** 2 + (y - ky) ** 2) / 4);
      const at = 3 * (y * SIZE + x); rgb[at] = Math.min(255, lit); rgb[at + 1] = Math.min(255, 0.7 * lit); rgb[at + 2] = Math.min(255, 0.4 * lit);
    }
    await writeFile(join(source, 'source.png'), await sharp(rgb, { raw: { width: SIZE, height: SIZE, channels: 3 } }).png().toBuffer());
    await writeFile(join(source, 'provenance.json'), '{}\n');
    const sky = ([kx, ky]: readonly [number, number]) => [(47.5 - kx) * PIXEL, (47.5 - ky) * PIXEL] as const, [east, north] = sky(knots.measured);
    // 10 km/s toward the Sun under 2 km/s an arcsecond: 5 arcsec in front of the plane.
    await writeFile(join(source, 'speeds.txt'), [[0, 0], [0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]].map(([de, dn]) => `${(east + de!).toFixed(2)} ${(north + dn!).toFixed(2)} -10`).join('\n') + '\n');
    // The support radius is the ring's, 12 arcsec at 1 kpc, fading from 11.
    const recipe = (beyondRing: boolean) => parseImageLayerRecipe({ schema: 'cssearth-image-layer-recipe@1', id: 'fixture', source: { path: 'source.png', dimensions: [SIZE, SIZE], originalDimensions: [SIZE, SIZE], publisherUrl: 'https://example.test', downloadUrl: 'https://example.test/a', credit: 'Fixture', license: 'CC-BY-4.0' },
      observation: { centerRaDeg: 10, centerDecDeg: 20, fieldOfViewDeg: [FIELD_ARCSEC / 3600, FIELD_ARCSEC / 3600], northClockwiseDeg: 0 }, target: { centerRaDeg: 10, centerDecDeg: 20, distancePc: 1000 },
      geometry: { kind: 'inclined-disk', inclinationDeg: 0.001, lineOfNodesPaDeg: 0, thicknessKpc: 1e-7, supportRadiusKpc: 12 * ARCSEC / 1000, supportTaperFraction: 11 / 12, depthWeights: [0.25, 0.5, 0.25], depthScales: [1, 1, 1], unit: 'pc',
        shape: { source: 'fixture', basis: 'fixture', expansionKmSPerArcsec: 2, ring: { semiMajorArcsec: 12, semiMinorArcsec: 12, majorPaDeg: 0, polarTiltDeg: 0, polarLeansToPaDeg: 0, expansionKmS: [24, 24, 24] },
          speeds: { source: 'fixture', basis: 'fixture', path: 'speeds.txt', columns: { east: 0, north: 1, kmS: 2 }, reachArcsec: 1.5, depth: 'speed', ...(beyondRing ? { beyondRing: true } : {}) }, smoothPixels: 4 } },
      bake: { maxFacePixels: SIZE, diffuseFacePixels: 16, crossAxisSlices: 3, crossAxisAlongPixels: 16, crossAxisDepthPixels: 9, backgroundFloor: 0, edgeTaperFraction: 0.01, diffuseFraction: 0.6, diffuseSigmaPixels: 1, flat: true, encoding: { format: 'webp', quality: 100 }, bulgeSlices: 25, bulgeFacePixels: 32, bulgeCrossSlices: 8 },
      provenance: { path: 'provenance.json' } });
    const where = async (beyondRing: boolean) => {
      const directory = join(root, beyondRing ? 'beyond' : 'cut'), bank = await prepareImageLayers({ sourceDirectory: source, outputDirectory: directory, recipe: recipe(beyondRing) });
      const leaves = (bank.banks.find(entry => entry.axis === 'z') as unknown as { leaves: Leaf[] }).leaves, atlases = new Map<string, { data: Buffer; width: number; height: number }>();
      const textures = await Promise.all(leaves.map(leaf => texture(directory, leaf, atlases))), patches = textures.filter((_, index) => leaves[index]!.id.startsWith('shape-')), planes = textures.filter((_, index) => !leaves[index]!.id.startsWith('shape-'));
      const lifted = (at: readonly [number, number]) => { const [e, n] = sky(at); let best = { depth: NaN, light: 0 };
        for (const patch of patches) { const sample = texel(patch, e * ARCSEC, n * ARCSEC); if (sample && sample.rgba[0] * sample.rgba[3] / 255 > best.light) best = { depth: sample.depth / ARCSEC, light: sample.rgba[0] * sample.rgba[3] / 255 }; }
        return best; };
      const onPlane = (at: readonly [number, number]) => { const [e, n] = sky(at); return Math.max(0, ...planes.map(plane => { const sample = texel(plane, e * ARCSEC, n * ARCSEC); return sample ? sample.rgba[0] * sample.rgba[3] / 255 : 0; })); };
      return { measured: lifted(knots.measured), measuredOnPlane: onPlane(knots.measured), unmeasured: lifted(knots.unmeasured), unmeasuredOnPlane: onPlane(knots.unmeasured) };
    };
    const beyond = await where(true), cut = await where(false);
    assert.ok(Math.abs(Math.abs(beyond.measured.depth) - 5) < 0.5 && beyond.measured.light > 100, `the measured knot beyond the ring is ${beyond.measured.depth} arcsec from the plane, holding ${beyond.measured.light}`);
    // The plane keeps only the smooth light there, the knot's blurred share with the glow: no shell holds it outside the ring.
    assert.ok(beyond.measuredOnPlane < beyond.unmeasuredOnPlane - 80, `the plane keeps ${beyond.measuredOnPlane} of the measured knot and ${beyond.unmeasuredOnPlane} of the unmeasured one`);
    assert.ok(beyond.unmeasuredOnPlane > 100 && beyond.unmeasured.light < 20, `the plane holds ${beyond.unmeasuredOnPlane} of the unmeasured knot, a patch ${beyond.unmeasured.light}`);
    // Without it the picture ends at the ring, as before: neither knot is drawn.
    assert.ok(cut.measured.light < 1 && cut.measuredOnPlane < 1 && cut.unmeasuredOnPlane < 1, `without beyondRing: ${JSON.stringify(cut)}`);
    assert.throws(() => parseImageLayerRecipe({ ...JSON.parse(JSON.stringify(recipe(true))), geometry: { ...recipe(true).geometry, shape: { ...recipe(true).geometry.shape!, speeds: { source: 'fixture', basis: 'fixture', path: 'speeds.txt', columns: { east: 0, north: 1, kmS: 2 }, reachArcsec: 1.5, restKmS: 1, wallKmS: 2, beyondRing: true } } } }), /beyondRing/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the broad light is the map blurred much farther: a level map stays level, and a knot is spread thin', () => {
  const size = 80, level = broadLight(new Float32Array(size * size).fill(0.4), size, size, 3);
  assert.ok(level.every(value => Math.abs(value - 0.4) < 1e-6));
  const knot = new Float32Array(size * size); for (let y = 36; y < 44; y++) for (let x = 36; x < 44; x++) knot[y * size + x] = 1;
  const spread = broadLight(knot, size, size, 3), total = spread.reduce((sum, value) => sum + value, 0);
  // Its light is kept, within what reading between the squares' middles loses at the edges, and its peak is a small part of it.
  assert.ok(Math.abs(total - 64) < 8, `the spread knot holds ${total.toFixed(1)} of 64`);
  assert.ok(spread[40 * size + 40]! < 0.2 && spread[40 * size + 40]! > spread[40 * size + 60]! && spread[40 * size + 60]! > 0, `its peak is ${spread[40 * size + 40]}`);
});

test('a bright thin filament where measurements place ejecta lies on the measured surface, not on the shell that holds the smooth light', async () => {
  const root = await mkdtemp(join(tmpdir(), 'image-layer-filament-')), source = join(root, 'source');
  try {
    await mkdir(source);
    // A smooth glow of 60 in a disc, and a filament 2 px wide and 170 brighter down the column x = 40, measured approaching.
    const rgb = Buffer.alloc(SIZE * SIZE * 3), FILAMENT_X = 40;
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const lit = (Math.hypot(x - 47.5, y - 47.5) < 40 ? 60 : 0) + (Math.abs(x - FILAMENT_X) < 1 && Math.abs(y - 47.5) < 20 ? 170 : 0);
      const at = 3 * (y * SIZE + x); rgb[at] = Math.min(255, lit); rgb[at + 1] = Math.min(255, 0.7 * lit); rgb[at + 2] = Math.min(255, 0.4 * lit);
    }
    await writeFile(join(source, 'source.png'), await sharp(rgb, { raw: { width: SIZE, height: SIZE, channels: 3 } }).png().toBuffer());
    await writeFile(join(source, 'provenance.json'), '{}\n');
    const sky = ([kx, ky]: readonly [number, number]) => [(47.5 - kx) * PIXEL, (47.5 - ky) * PIXEL] as const;
    // Measurements all over the middle of the disc, 12 km/s toward the Sun: 6 arcsec in front of the plane.
    const rows: string[] = []; for (let y = 24; y <= 72; y += 2) for (let x = 24; x <= 72; x += 2) { const [east, north] = sky([x, y]); rows.push(`${east.toFixed(2)} ${north.toFixed(2)} -12`); }
    await writeFile(join(source, 'speeds.txt'), rows.join('\n') + '\n');
    const recipe = (glow: boolean) => parseImageLayerRecipe({ schema: 'cssearth-image-layer-recipe@1', id: 'fixture', source: { path: 'source.png', dimensions: [SIZE, SIZE], originalDimensions: [SIZE, SIZE], publisherUrl: 'https://example.test', downloadUrl: 'https://example.test/a', credit: 'Fixture', license: 'CC-BY-4.0' },
      observation: { centerRaDeg: 10, centerDecDeg: 20, fieldOfViewDeg: [FIELD_ARCSEC / 3600, FIELD_ARCSEC / 3600], northClockwiseDeg: 0 }, target: { centerRaDeg: 10, centerDecDeg: 20, distancePc: 1000 },
      geometry: { kind: 'inclined-disk', inclinationDeg: 0.001, lineOfNodesPaDeg: 0, thicknessKpc: 1e-7, supportRadiusKpc: 0.00011, supportTaperFraction: 0.9, depthWeights: [0.25, 0.5, 0.25], depthScales: [1, 1, 1], unit: 'pc',
        shape: { source: 'fixture', basis: 'fixture', expansionKmSPerArcsec: 2, ring: { semiMajorArcsec: 16, semiMinorArcsec: 16, majorPaDeg: 0, polarTiltDeg: 0, polarLeansToPaDeg: 0, expansionKmS: [32, 32, 32] },
          speeds: { source: 'fixture', basis: 'fixture', path: 'speeds.txt', columns: { east: 0, north: 1, kmS: 2 }, reachArcsec: 1.5, depth: 'speed', ...(glow ? { glow: 'starlet' } : {}) }, smoothPixels: 8 } },
      bake: { maxFacePixels: SIZE, diffuseFacePixels: 16, crossAxisSlices: 3, crossAxisAlongPixels: 16, crossAxisDepthPixels: 9, backgroundFloor: 0, edgeTaperFraction: 0.01, diffuseFraction: 0.6, diffuseSigmaPixels: 1, flat: true, encoding: { format: 'webp', quality: 100 }, bulgeSlices: 25, bulgeFacePixels: 32, bulgeCrossSlices: 8 },
      provenance: { path: 'provenance.json' } });
    const directory = join(root, 'bank'), bank = await prepareImageLayers({ sourceDirectory: source, outputDirectory: directory, recipe: recipe(true) });
    const leaves = (bank.banks.find(entry => entry.axis === 'z') as unknown as { leaves: Leaf[] }).leaves, atlases = new Map<string, { data: Buffer; width: number; height: number }>();
    const patches = (await Promise.all(leaves.map(leaf => texture(directory, leaf, atlases)))).filter((_, index) => leaves[index]!.id.startsWith('shape-'));
    // The light at a place on the shell's walls (more than 9 arcsec from the plane) and on the measured surface (6 in front).
    const lightAt = (at: readonly [number, number]) => { const [east, north] = sky(at); let walls = 0, measured = 0;
      for (const patch of patches) { const sample = texel(patch, east * ARCSEC, north * ARCSEC); if (!sample || !sample.rgba[3]) continue; const light = sample.rgba[0] * sample.rgba[3] / 255, depth = Math.abs(sample.depth / ARCSEC);
        if (depth > 9) walls += light; else if (Math.abs(depth - 6) < 1.5) measured = Math.max(measured, light); }
      return { walls, measured }; };
    // Beside it: as far from the star on the other side, where the sphere is as deep.
    const on = lightAt([FILAMENT_X, 47.5]), beside = lightAt([95 - FILAMENT_X, 47.5]);
    assert.ok(on.measured > 120, `the measured surface holds ${on.measured.toFixed(0)} of the filament`);
    assert.ok(Math.abs(on.walls - beside.walls) < 8, `the shell holds ${on.walls.toFixed(0)} on the filament and ${beside.walls.toFixed(0)} beside it`);
    assert.throws(() => parseImageLayerRecipe({ ...JSON.parse(JSON.stringify(recipe(true))), geometry: { ...recipe(true).geometry, shape: { ...recipe(true).geometry.shape!, speeds: { ...recipe(true).geometry.shape!.speeds!, glow: 'blur' } } } }), /speeds\.glow/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('sparse knots past the ring are a surface of their own: the mesh does not stretch from the inner surface to them, and a lone one far from a place does not set its depth', () => {
  // A picture 64 arcsec across, a face pixel a quarter of one; a shell of 4 arcsec about the star, so everything below
  // is past the ring. North is up and east to the left. 2 km/s is an arcsecond of depth.
  const size = 256, pixel = 0.25, reach = 1.5, sky = (px: number, py: number) => [(size / 2 - px - .5) * pixel, (size / 2 - py - .5) * pixel] as const;
  // A dense inner surface 2 arcsec in front of the plane, from 8 to 13 arcsec east; three reaches east of it a cluster
  // of knots 60 arcsec in front, as Cassiopeia A's north-east knots stand by its [Ar II] rim; and one lone knot 60
  // arcsec in front, 14 arcsec north of the inner surface's middle.
  const rows: MeasuredSpeed[] = [];
  for (let north = -6; north <= 6; north += .5) { for (let east = 8; east <= 13; east += .5) rows.push([east, north, -4]); for (let east = 17.5; east <= 21; east += .5) rows.push([east, north, -120, true]); }
  rows.push([10.5, 14, -120, true]);
  const shape = { source: 'fixture', basis: 'fixture', expansionKmSPerArcsec: 2, smoothPixels: 4,
    ring: { semiMajorArcsec: 4, semiMinorArcsec: 4, majorPaDeg: 0, polarTiltDeg: 0, polarLeansToPaDeg: 0, expansionKmS: [8, 8, 8] as [number, number, number] },
    speeds: { source: 'fixture', basis: 'fixture', path: 'speeds.txt', columns: { east: 0, north: 1, kmS: 2, surface: 3 }, reachArcsec: reach, depth: 'speed' as const, beyondRing: true as const } };
  // Fine detail everywhere over a faint glow.
  const count = size * size, glow = 0.15, light = new Float32Array(count);
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) light[py * size + px] = glow + 0.5 * (Math.sin(px / 2.1) * Math.sin(py / 2.7)) ** 2;
  const surfaces = (tagged: boolean) => {
    const model = imageLayerShapeModel(shape, tagged ? rows : rows.map(([east, north, kmS]) => [east, north, kmS] as const)), base = Buffer.alloc(4 * count, 255);
    for (let p = 0; p < count; p++) base[4 * p + 3] = Math.round(255 * light[p]!);
    const floor = new Float32Array(count).fill(glow), walls = imageLayerShapeWalls(base, size, size, [light, light, light], [floor, floor, floor], model, sky, 1, [floor, floor, floor]);
    // The measured patches past the ring, with light enough to see: each one's slope (arcsec of depth an arcsec across).
    return { model, patches: imageLayerShapePatches(walls, size, size, pixel, reach).patches.flatMap(patch => {
      const [east, north] = sky(patch.left + patch.width / 2, patch.top + patch.height / 2);
      if (Math.hypot(east, north) < 6 || !patch.rgba.some((value, index) => index % 4 === 3 && value > 8)) return [];
      // Its depth at a place it covers, else NaN.
      const at = (e: number, n: number) => { const x = size / 2 - .5 - e / pixel - patch.left, y = size / 2 - .5 - n / pixel - patch.top; return x >= 0 && y >= 0 && x <= patch.width && y <= patch.height ? patch.depth + patch.right * x + patch.down * y : NaN; };
      return [{ slope: Math.hypot(patch.right, patch.down) / pixel, at }]; }) };
  };
  const steepest = (patches: { slope: number }[]) => Math.max(...patches.map(patch => patch.slope));
  // One surface through the inner rows and the knots is a cliff: the mesh stretches across it.
  const joined = surfaces(false);
  assert.ok(steepest(joined.patches) > 5, `with the knots on the inner surface the steepest patch rises ${steepest(joined.patches).toFixed(1)} arcsec an arcsec`);
  const apart = surfaces(true);
  assert.ok(steepest(apart.patches) <= 3, `the steepest patch rises ${steepest(apart.patches).toFixed(1)} arcsec an arcsec: ${JSON.stringify(apart.patches.filter(patch => patch.slope > 3).slice(0, 4))}`);
  // Each surface keeps its own depth: the inner one 2 arcsec in front by the knots, the knots 60.
  const depths = (east: number, north: number) => apart.patches.map(patch => patch.at(east, north)).filter(depth => !Number.isNaN(depth));
  assert.ok(depths(12.5, 0).some(depth => Math.abs(depth + 2) < 1) && depths(12.5, 0).every(depth => Math.abs(depth + 2) < 1 || Math.abs(depth + 60) < 3), `by the knots the surfaces are ${depths(12.5, 0)} arcsec deep`);
  assert.ok(depths(18.5, 0).some(depth => Math.abs(depth + 60) < 3), `on the knots the surfaces are ${depths(18.5, 0)} arcsec deep`);
  // A lone knot is the outer surface where it is, not two reaches from it: there most of the detail stays on the plane.
  const lone = apart.model.detail(10.5, 14 - 2 * reach, 0, 0), joinedLone = joined.model.detail(10.5, 14 - 2 * reach, 0, 0);
  assert.ok(joinedLone.near > 0.9, `without its own surface the lone knot holds ${joinedLone.near} of the detail two reaches from it`);
  assert.ok((lone.outer?.near ?? 0) < 0.25 && lone.mid > 0.75, `two reaches from the lone knot its surface holds ${lone.outer?.near} of the detail and the plane ${lone.mid}`);
});

test('a picture faded on its outline whose light fills only part of its frame stops inside that part, not inside the frame', async () => {
  const root = await mkdtemp(join(tmpdir(), 'image-layer-filled-part-')), source = join(root, 'source');
  try {
    await mkdir(source);
    // Light everywhere, with a dot every 4 px that the plane keeps as fine detail, the shell's rim far past the frame: only
    // the frame, or the filled part standing for it, stops the picture.
    const rgb = Buffer.alloc(SIZE * SIZE * 3); for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) rgb.fill(x % 4 === 0 && y % 4 === 0 ? 240 : 100, 3 * (y * SIZE + x), 3 * (y * SIZE + x) + 3);
    await writeFile(join(source, 'source.png'), await sharp(rgb, { raw: { width: SIZE, height: SIZE, channels: 3 } }).png().toBuffer());
    await writeFile(join(source, 'provenance.json'), '{}\n');
    await writeFile(join(source, 'speeds.txt'), '0 0 0\n');
    const outline = { source: 'fixture', basis: 'fixture', positionAnglesDeg: [0, 90, 180, 270], radiiArcsec: [60, 60, 60, 60], scale: 1 };
    // A diamond with its corners at the middles of the frame's sides, as a mosaic laid square in a rectangle.
    const recipe = (filled: boolean) => parseImageLayerRecipe({ schema: 'cssearth-image-layer-recipe@1', id: 'fixture', source: { path: 'source.png', dimensions: [SIZE, SIZE], originalDimensions: [SIZE, SIZE], publisherUrl: 'https://example.test', downloadUrl: 'https://example.test/a', credit: 'Fixture', license: 'CC-BY-4.0' },
      observation: { centerRaDeg: 10, centerDecDeg: 20, fieldOfViewDeg: [FIELD_ARCSEC / 3600, FIELD_ARCSEC / 3600], northClockwiseDeg: 0 }, target: { centerRaDeg: 10, centerDecDeg: 20, distancePc: 1000 },
      geometry: { kind: 'inclined-disk', inclinationDeg: 0.001, lineOfNodesPaDeg: 0, thicknessKpc: 1e-7, supportRadiusKpc: 12 * ARCSEC / 1000, supportTaperFraction: 11 / 12, depthWeights: [0.25, 0.5, 0.25], depthScales: [1, 1, 1], unit: 'pc',
        fadeAt: 'outline', fadeOutline: { outward: 1, featherArcsec: 2, frameMarginArcsec: 1, smoothDeg: 10, ...(filled ? { filledCornersPixels: [[SIZE / 2, 0], [SIZE, SIZE / 2], [SIZE / 2, SIZE], [0, SIZE / 2]] } : {}) },
        shape: { source: 'fixture', basis: 'fixture', expansionKmSPerArcsec: 2, ring: { semiMajorArcsec: 12, semiMinorArcsec: 12, majorPaDeg: 0, polarTiltDeg: 0, polarLeansToPaDeg: 0, expansionKmS: [24, 24, 24], outline },
          speeds: { source: 'fixture', basis: 'fixture', path: 'speeds.txt', columns: { east: 0, north: 1, kmS: 2 }, reachArcsec: 1.5, depth: 'speed' }, smoothPixels: 4 } },
      bake: { maxFacePixels: SIZE, diffuseFacePixels: 16, crossAxisSlices: 3, crossAxisAlongPixels: 16, crossAxisDepthPixels: 9, backgroundFloor: 0, edgeTaperFraction: 0.01, diffuseFraction: 0.6, diffuseSigmaPixels: 1, flat: true, encoding: { format: 'webp', quality: 100 }, bulgeSlices: 25, bulgeFacePixels: 32, bulgeCrossSlices: 8 },
      provenance: { path: 'provenance.json' } });
    const light = async (filled: boolean) => {
      const directory = join(root, filled ? 'filled' : 'frame'), bank = await prepareImageLayers({ sourceDirectory: source, outputDirectory: directory, recipe: recipe(filled) });
      const leaves = (bank.banks.find(entry => entry.axis === 'z') as unknown as { leaves: Leaf[] }).leaves, atlases = new Map<string, { data: Buffer; width: number; height: number }>();
      const textures = await Promise.all(leaves.map(leaf => texture(directory, leaf, atlases)));
      // The most opacity any leaf draws on the sight line through a pixel of the picture.
      return (x: number, y: number) => Math.max(0, ...textures.map(leaf => texel(leaf, (SIZE / 2 - x) * PIXEL * ARCSEC, (SIZE / 2 - y) * PIXEL * ARCSEC)?.rgba[3] ?? 0));
    };
    const filled = await light(true), frame = await light(false);
    // 8 px in from the frame's corner is 11 arcsec outside the diamond: the frame draws it and the filled part does not.
    assert.ok(frame(8, 8) > 100, `the frame draws ${frame(8, 8)} near its corner`);
    assert.equal(filled(8, 8), 0, `the filled part draws ${filled(8, 8)} outside itself`);
    assert.ok(filled(16, SIZE / 2) > 100 && filled(SIZE / 2, 16) > 100, `inside the diamond it draws ${filled(16, SIZE / 2)} and ${filled(SIZE / 2, 16)}`);
    assert.throws(() => parseImageLayerRecipe({ ...JSON.parse(JSON.stringify(recipe(true))), geometry: { ...recipe(true).geometry, fadeOutline: { ...recipe(true).geometry.fadeOutline!, filledCornersPixels: [[0, 0], [SIZE, SIZE], [SIZE, 0], [0, SIZE]] } } }), /convex polygon/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});
