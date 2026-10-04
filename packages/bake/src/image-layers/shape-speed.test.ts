import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import sharp from 'sharp';
import { parseImageLayerRecipe } from './config.ts';
import { prepareImageLayers } from './prepare.ts';
import { broadLight } from './shape.ts';

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

test('the broad light is the map blurred much farther: a level map stays level, and a knot is spread thin', () => {
  const size = 80, level = broadLight(new Float32Array(size * size).fill(0.4), size, size, 3);
  assert.ok(level.every(value => Math.abs(value - 0.4) < 1e-6));
  const knot = new Float32Array(size * size); for (let y = 36; y < 44; y++) for (let x = 36; x < 44; x++) knot[y * size + x] = 1;
  const spread = broadLight(knot, size, size, 3), total = spread.reduce((sum, value) => sum + value, 0);
  // Its light is kept, within what reading between the squares' middles loses at the edges, and its peak is a small part of it.
  assert.ok(Math.abs(total - 64) < 8, `the spread knot holds ${total.toFixed(1)} of 64`);
  assert.ok(spread[40 * size + 40]! < 0.2 && spread[40 * size + 40]! > spread[40 * size + 60]! && spread[40 * size + 60]! > 0, `its peak is ${spread[40 * size + 40]}`);
});
