import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import sharp from 'sharp';
import { parseImageLayerRecipe } from './config.ts';
import { prepareImageLayers } from './prepare.ts';
import { imageLayerRingsModel, imageLayerRingsSheet, RINGS_OPACITY_REACH_PIXELS } from './rings.ts';

type Leaf = { id: string; axis: string; texturePath: string; verticesUnits: number[][]; bytes: number };
type Texture = { data: Buffer; width: number; height: number; origin: number[]; right: number[]; down: number[] };

const SIZE = 64, rad = (degrees: number) => degrees * Math.PI / 180;
const toward = (paDeg: number, arcsec: number) => [arcsec * Math.sin(rad(paDeg)), arcsec * Math.cos(rad(paDeg))] as const;

/** A leaf's pixels and its outline on the sky: its top-left corner and its two edges, east and north. */
async function texture(directory: string, leaf: Leaf): Promise<Texture> {
  const { data, info } = await sharp(join(directory, leaf.texturePath)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const [topLeft, topRight, , bottomLeft] = leaf.verticesUnits as [number[], number[], number[], number[]];
  return { data, width: info.width, height: info.height, origin: topLeft, right: [topRight[0]! - topLeft[0]!, topRight[1]! - topLeft[1]!], down: [bottomLeft[0]! - topLeft[0]!, bottomLeft[1]! - topLeft[1]!] };
}

/** A leaf's light at a place on the sky, color times opacity in each channel and its opacity; nothing outside it. */
function light(leaf: Texture, x: number, y: number): [number, number, number, number] {
  const dx = x - leaf.origin[0]!, dy = y - leaf.origin[1]!, det = leaf.right[0]! * leaf.down[1]! - leaf.right[1]! * leaf.down[0]!;
  const i = Math.floor((dx * leaf.down[1]! - dy * leaf.down[0]!) / det * leaf.width), j = Math.floor((leaf.right[0]! * dy - leaf.right[1]! * dx) / det * leaf.height);
  if (i < 0 || j < 0 || i >= leaf.width || j >= leaf.height) return [0, 0, 0, 0];
  const at = 4 * (j * leaf.width + i), alpha = leaf.data[at + 3]! / 255;
  return [leaf.data[at]! * alpha, leaf.data[at + 1]! * alpha, leaf.data[at + 2]! * alpha, alpha];
}

test('a ring\'s plane comes toward the Sun where the far end of its axis points, and the two planes share the light between the published radii', () => {
  const { planes: [disc, ring] } = imageLayerRingsModel({ source: 'fixture', basis: 'fixture', disc: { radiusArcsec: 250, tiltDeg: 23, farAxisPaDeg: 288 }, ring: { radiusArcsec: 371, tiltDeg: 53, farAxisPaDeg: 168 } });
  // Depth is positive away from the Sun. The axis is the plane's normal, so the plane tips the other way.
  for (const [plane, tilt, pa] of [[disc, 23, 288], [ring, 53, 168]] as const) {
    const lean = 100 * Math.tan(rad(tilt));
    assert.ok(Math.abs(plane.depth(...toward(pa, 100)) + lean) < 1e-9, `${plane.id}: nearer under the axis' far end`);
    assert.ok(Math.abs(plane.depth(...toward(pa + 180, 100)) - lean) < 1e-9, `${plane.id}: farther opposite it`);
    assert.ok(Math.abs(plane.depth(...toward(pa + 90, 100))) < 1e-9, `${plane.id}: in the sky's plane across it`);
    assert.ok(Math.abs(plane.radius(...toward(pa, 100)) - 100 / Math.cos(rad(tilt))) < 1e-9 && Math.abs(plane.radius(...toward(pa + 90, 100)) - 100) < 1e-9, `${plane.id}: radius in its own plane`);
    assert.ok(Math.abs(Math.hypot(...plane.normal) - 1) < 1e-12 && plane.normal[2] > 0);
  }
  for (let pa = 0; pa < 360; pa += 15) for (const sky of [0, 100, 149, 200, 230, 250, 300, 340, 371, 400, 800]) {
    const place = toward(pa, sky), inDisc = disc.radius(...place), inRing = ring.radius(...place), share = disc.share(...place);
    assert.ok(Math.abs(share + ring.share(...place) - 1) < 1e-12, 'every sight line\'s light is on the planes, once');
    // Inside both planes' inner radius the disc has it all; where the disc's plane is met beyond the ring's radius, none.
    if (inDisc <= 250 && inRing <= 250) assert.equal(share, 1, `PA ${pa}, ${sky} arcsec`);
    if (inDisc >= 371) assert.equal(share, 0, `PA ${pa}, ${sky} arcsec`);
    // The ring's plane holds nothing inside the disc's radius in its own plane: its hole is a circle there.
    if (inRing <= 250) assert.equal(ring.share(...place), 0, `PA ${pa}, ${sky} arcsec`);
  }
  // On the line the two planes have in common a sight line meets both at one point: half way between the radii, half each.
  const common = [disc.normal[1] * ring.normal[2] - disc.normal[2] * ring.normal[1], disc.normal[2] * ring.normal[0] - disc.normal[0] * ring.normal[2], disc.normal[0] * ring.normal[1] - disc.normal[1] * ring.normal[0]] as const, length = Math.hypot(...common);
  const halfway = [common[0] / length * 310.5, common[1] / length * 310.5] as const;
  assert.ok(Math.abs(disc.depth(...halfway) - ring.depth(...halfway)) < 1e-9 && Math.abs(disc.radius(...halfway) - 310.5) < 1e-9 && Math.abs(disc.share(...halfway) - 0.5) < 1e-9, 'half each, half way, on the planes\' common line');
  // Under the ring's own circle where it crosses the disc's outline on the sky, both claim the light in full.
  const crossing = toward(168, 371 * Math.cos(rad(53)));
  assert.ok(disc.radius(...crossing) < 250 && Math.abs(ring.radius(...crossing) - 371) < 1e-9 && Math.abs(disc.share(...crossing) - 0.5) < 1e-9);
});

test('a ring sheet\'s opacity is evened out over its reach, its light over black is unchanged, and a star darkens no sky', () => {
  const size = 160, rgba = Buffer.alloc(size * size * 4), star = [130, 130] as const;
  // A grainy glow 30 px in radius, and a star alone in the dark.
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = 4 * (y * size + x), grain = (x * 7 + y * 13) % 5, lit = Math.hypot(x - 48, y - 48) < 30 ? 120 + 20 * grain : Math.hypot(x - star[0], y - star[1]) < 1.5 ? 255 : 0;
    rgba[i] = 200; rgba[i + 1] = 150 + 10 * grain; rgba[i + 2] = 90; rgba[i + 3] = lit;
  }
  const sheet = imageLayerRingsSheet(rgba, size, size);
  // The star keeps its own opacity and the sky around it stays clear: nothing there would hide what is behind the sheet.
  for (let y = star[1] - 20; y < size; y++) for (let x = star[0] - 20; x < size; x++) {
    const alpha = sheet[4 * (y * size + x) + 3]!;
    if (Math.hypot(x - star[0], y - star[1]) < 1.5) assert.equal(alpha, 255); else assert.ok(alpha <= 2, `${x}, ${y}: opacity ${alpha} beside the star`);
  }
  let roughBefore = 0, roughAfter = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = 4 * (y * size + x), own = rgba[i + 3]!, alpha = sheet[i + 3]!;
    assert.ok(alpha >= own, 'no pixel less opaque');
    for (let c = 0; c < 3; c++) assert.ok(Math.abs(sheet[i + c]! * alpha - rgba[i + c]! * own) <= alpha / 2 + 1e-9, `${x}, ${y}: the light over black, to rounding`);
    // Nothing beyond the reach of the picture's light becomes opaque.
    if (Math.hypot(x - 48, y - 48) > 30 + 4 * RINGS_OPACITY_REACH_PIXELS * Math.SQRT2 + 1 && Math.hypot(x - star[0], y - star[1]) > 4 * RINGS_OPACITY_REACH_PIXELS * Math.SQRT2 + 2) assert.equal(alpha, 0, `${x}, ${y}`);
    if (x && Math.hypot(x - 48, y - 48) < 20) { roughBefore += Math.abs(own - rgba[i - 1]!); roughAfter += Math.abs(alpha - sheet[i - 1]!); }
  }
  assert.ok(roughAfter < roughBefore / 20, `opacity steps ${roughAfter} for ${roughBefore}`);
});

test('a bank on rings puts the picture on its two planes, and from the Sun shows the picture', async () => {
  const root = await mkdtemp(join(tmpdir(), 'image-layer-rings-')), source = join(root, 'source');
  try {
    await mkdir(source);
    // 0.2° is 720 arcsec across 64 pixels: a glow 290 arcsec in radius, fading to nothing at its edge.
    const glow = Buffer.alloc(SIZE * SIZE * 3);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const radius = Math.hypot(x - 31.5, y - 31.5), at = 3 * (y * SIZE + x), lit = radius < 26 ? 200 * (1 - radius / 26) : 0;
      glow[at] = 0.4 * lit; glow[at + 1] = 0.8 * lit; glow[at + 2] = lit;
    }
    await writeFile(join(source, 'source.png'), await sharp(glow, { raw: { width: SIZE, height: SIZE, channels: 3 } }).png().toBuffer());
    await writeFile(join(source, 'provenance.json'), '{}\n');
    const rings = { source: 'fixture', basis: 'fixture', disc: { radiusArcsec: 120, tiltDeg: 30, farAxisPaDeg: 90 }, ring: { radiusArcsec: 200, tiltDeg: 60, farAxisPaDeg: 0 } };
    const flat = { schema: 'cssearth-image-layer-recipe@1', id: 'fixture', source: { path: 'source.png', dimensions: [SIZE, SIZE], originalDimensions: [SIZE, SIZE], publisherUrl: 'https://example.test', downloadUrl: 'https://example.test/a', credit: 'Fixture', license: 'CC-BY-4.0' },
      observation: { centerRaDeg: 10, centerDecDeg: 20, fieldOfViewDeg: [0.2, 0.2], northClockwiseDeg: 0 }, target: { centerRaDeg: 10, centerDecDeg: 20, distancePc: 1000 },
      geometry: { kind: 'inclined-disk', inclinationDeg: 0.001, lineOfNodesPaDeg: 0, thicknessKpc: 1e-7, supportRadiusKpc: 0.003, supportTaperFraction: 0.9, depthWeights: [0.25, 0.5, 0.25], depthScales: [1, 1, 1], unit: 'pc' },
      bake: { maxFacePixels: SIZE, diffuseFacePixels: 16, crossAxisSlices: 3, crossAxisAlongPixels: 16, crossAxisDepthPixels: 9, backgroundFloor: 0, edgeTaperFraction: 0.01, diffuseFraction: 0.6, diffuseSigmaPixels: 1, flat: true, encoding: { format: 'webp', quality: 100 } },
      provenance: { path: 'provenance.json' } };
    const ringed = { ...flat, geometry: { ...flat.geometry, rings } };
    const reference = await prepareImageLayers({ sourceDirectory: source, outputDirectory: join(root, 'flat'), recipe: parseImageLayerRecipe(flat) });
    const bank = await prepareImageLayers({ sourceDirectory: source, outputDirectory: join(root, 'ringed'), recipe: parseImageLayerRecipe(ringed) });
    const { planes } = imageLayerRingsModel(rings), leaves = bank.banks.find(entry => entry.axis === 'z')!.leaves as Leaf[];
    assert.deepEqual(leaves.map(leaf => leaf.id), ['z-disc', 'z-ring']);
    // Each bank shows the same planes; their pictures count once.
    for (const axis of ['x', 'y'] as const) {
      const side = bank.banks.find(entry => entry.axis === axis)!.leaves as Leaf[];
      assert.deepEqual(side.map(leaf => [leaf.id, leaf.texturePath, leaf.bytes]), leaves.map(leaf => [leaf.id.replace('z-', `${axis}-`), leaf.texturePath, 0]));
    }
    assert.deepEqual((bank.resources as { path: string }[]).map(resource => resource.path).sort(), ['layers/plane-disc.webp', 'layers/plane-ring.webp']);
    assert.deepEqual(JSON.parse(await readFile(join(root, 'ringed/image-layers.json'), 'utf8')).banks, JSON.parse(JSON.stringify(bank.banks)));
    // A leaf's corners are on its plane through the star.
    for (const leaf of leaves) {
      const plane = planes.find(entry => leaf.id.endsWith(entry.id))!;
      for (const vertex of leaf.verticesUnits) assert.ok(Math.abs(plane.normal[0] * vertex[0]! + plane.normal[1] * vertex[1]! + plane.normal[2] * vertex[2]!) < 1e-9, `${leaf.id}: off its plane`);
    }
    // The Sun's view, at the picture's pixel centres (11.25 arcsec apart, east to the left): one plane over the other gives
    // the light of the flat bake of the same picture.
    const [disc, ring] = await Promise.all(leaves.map(leaf => texture(join(root, 'ringed'), leaf)));
    const whole = await texture(join(root, 'flat'), (reference.banks.find(entry => entry.axis === 'z')!.leaves as Leaf[]).find(leaf => leaf.id === 'z-detail')!);
    const arcsec = 1000 * Math.PI / 648000, pixel = 720 / SIZE;
    let lit = 0, onDisc = 0, onRing = 0, onBoth = 0;
    for (let py = 1; py < SIZE; py += 2) for (let px = 1; px < SIZE; px += 2) {
      const east = (SIZE / 2 - 0.5 - px) * pixel, north = (SIZE / 2 - 0.5 - py) * pixel, x = east * arcsec, y = north * arcsec;
      const expected = light(whole, x, y), a = light(disc!, x, y), b = light(ring!, x, y);
      for (let c = 0; c < 3; c++) assert.ok(Math.abs(a[c]! + (1 - a[3]) * b[c]! - expected[c]!) < 4, `${east}, ${north}: channel ${c} ${a[c]} over ${b[c]} for ${expected[c]}`);
      if (!expected[3]) continue;
      lit++;
      const share = planes[0].share(east, north);
      if (share === 1) { assert.equal(b[3], 0, `${east}, ${north}: on the disc`); onDisc++; }
      else if (share === 0) { assert.equal(a[3], 0, `${east}, ${north}: on the ring's plane`); onRing++; }
      else if (a[3] && b[3]) onBoth++;
    }
    assert.ok(lit > 200 && onDisc > 20 && onRing > 60 && onBoth > 40, `${lit} lit: ${onDisc} on the disc, ${onRing} on the ring's plane, ${onBoth} on both`);
    assert.throws(() => parseImageLayerRecipe({ ...ringed, geometry: { ...ringed.geometry, rings: { ...rings, ring: { ...rings.ring, radiusArcsec: 100 } } } }), /must be over the disc's/u);
    assert.throws(() => parseImageLayerRecipe({ ...ringed, bake: { ...ringed.bake, flat: false } }), /geometry\.rings is for a flat bank/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});
