import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ImageLayerRecipe } from './config.ts';
import { imageLayerSurfaceCrossings, imageLayerSurfaceWalls, RIM_JOINS_PIXELS, stlTriangles, SURFACE_MOST_CROSSINGS } from './surface.ts';

type Surface = NonNullable<ImageLayerRecipe['geometry']['surface']>;

const SIZE = 120, PIXEL = 0.5, MOST = SURFACE_MOST_CROSSINGS;
/** A face pixel's offset from the star, east and north in arcseconds: north up, east to the left, the star in the middle. */
const sky = (px: number, py: number) => [(SIZE / 2 - px - 0.5) * PIXEL, (SIZE / 2 - py - 0.5) * PIXEL] as const;
const pixelOf = (east: number, north: number) => Math.round(SIZE / 2 - north / PIXEL - 0.5) * SIZE + Math.round(SIZE / 2 - east / PIXEL - 0.5);

/** A binary STL of spheres: each a centre and a radius, in the file's units. */
function spheres(balls: readonly { centre: readonly [number, number, number]; radius: number }[], steps = 48): Buffer {
  const triangles: number[][] = [];
  for (const { centre, radius } of balls) { const at = (i: number, j: number) => { const polar = Math.PI * i / steps, turn = 2 * Math.PI * j / steps; return [centre[0] + radius * Math.sin(polar) * Math.cos(turn), centre[1] + radius * Math.sin(polar) * Math.sin(turn), centre[2] + radius * Math.cos(polar)]; };
    for (let i = 0; i < steps; i++) for (let j = 0; j < steps; j++) { triangles.push([...at(i, j), ...at(i + 1, j), ...at(i + 1, j + 1)]); triangles.push([...at(i, j), ...at(i + 1, j + 1), ...at(i, j + 1)]); } }
  const bytes = Buffer.alloc(84 + 50 * triangles.length); bytes.writeUInt32LE(triangles.length, 80);
  for (const [index, triangle] of triangles.entries()) for (let value = 0; value < 9; value++) bytes.writeFloatLE(triangle[value]!, 84 + 50 * index + 12 + 4 * value);
  return bytes;
}
const surface = (pole: Surface['pole'], starRadiusArcsec?: number): Surface => ({ source: 'fixture', basis: 'fixture', path: 'fixture.stl', arcsecPerUnit: 10, originUnits: [0, 0, 0], pole, fitArcsec: 0.5, ...(starRadiusArcsec === undefined ? {} : { starRadiusArcsec }) });

test('a binary STL is read as its triangles, and a file that is not one is refused by name', () => {
  const bytes = spheres([{ centre: [0, 0, 0], radius: 1 }], 8), triangles = stlTriangles(bytes, 'fixture.stl');
  assert.equal(triangles.length, 9 * 2 * 8 * 8);
  assert.throws(() => stlTriangles(bytes.subarray(0, bytes.length - 10), 'fixture.stl'), /fixture\.stl is not a binary STL file: its header counts 128 triangles, 6484 bytes, and the file holds 6474/u);
  assert.throws(() => stlTriangles(Buffer.alloc(20), 'short.stl'), /short\.stl is not a binary STL file/u);
});

test('a sight line crosses a placed surface where the surface is, nearest the Sun first, each crossing on its lobe', () => {
  // A ball of 10 arcsec about the star: its pole 60 degrees from the sight line, the receding end toward the north.
  const crossings = imageLayerSurfaceCrossings(surface({ tiltDeg: 60, paDeg: 0, rollDeg: 25, receding: '+z' }), stlTriangles(spheres([{ centre: [0, 0, 0], radius: 1 }]), 'fixture.stl'), SIZE, SIZE, sky);
  const middle = pixelOf(0, 0), off = pixelOf(6, 0), outside = pixelOf(11, 0);
  assert.ok(Math.abs(crossings.depths[MOST * middle]! + 10) < 0.1 && Math.abs(crossings.depths[MOST * middle + 1]! - 10) < 0.1 && Number.isNaN(crossings.depths[MOST * middle + 2]!), `through the star: ${crossings.depths.slice(MOST * middle, MOST * middle + 3)}`);
  assert.ok(Math.abs(crossings.depths[MOST * off]! + 8) < 0.2 && Math.abs(crossings.depths[MOST * off + 1]! - 8) < 0.2, `6 arcsec east: ${crossings.depths.slice(MOST * off, MOST * off + 2)}`);
  // The plane through the star across the pole parts the ball: through the star the sight line enters by the approaching lobe and leaves by the receding one.
  assert.deepEqual([...crossings.lobes.slice(MOST * middle, MOST * middle + 2)], [0, 1]);
  assert.throws(() => imageLayerSurfaceCrossings(surface({ tiltDeg: 90, paDeg: 0, rollDeg: 0, receding: '+z' }), new Float32Array(9), SIZE, SIZE, sky), /a pole across the sight line/u);
  assert.ok(Number.isNaN(crossings.depths[MOST * outside]!));
  // The receding end is north and behind: north of the star the sight line leaves by the receding lobe; south of it, it enters by the approaching one.
  assert.equal(crossings.lobes[MOST * pixelOf(0, 6) + 1], 1); assert.equal(crossings.lobes[MOST * pixelOf(0, -6)], 0);
  assert.throws(() => imageLayerSurfaceCrossings(surface({ tiltDeg: 0, paDeg: 0, rollDeg: 0, receding: '+z' }), new Float32Array(9), SIZE, SIZE, sky), /a pole along the sight line/u);
});

test('the picture lies on the surface\'s sides: every side shows it, and from the Sun they are the photograph', () => {
  // Two balls of 10 arcsec along the pole, 12 arcsec either side of the star; the pole 25 degrees from the sight line,
  // so on the sky the approaching one stands partly in front of the receding one: within 4.9 arcsec north and south of the star.
  const placed = surface({ tiltDeg: 25, paDeg: 0, rollDeg: 0, receding: '+z' }, 0.5), crossings = imageLayerSurfaceCrossings(placed, stlTriangles(spheres([{ centre: [0, 0, 1.2], radius: 1 }, { centre: [0, 0, -1.2], radius: 1 }]), 'fixture.stl'), SIZE, SIZE, sky);
  // A picture: the bodies glow, brighter to the north, over a faint sky, with a bright star in the middle; opaque where it is bright.
  const base = Buffer.alloc(SIZE * SIZE * 4), photograph = new Float32Array(SIZE * SIZE * 3);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) { const p = y * SIZE + x, [east, north] = sky(x, y), level = Number.isNaN(crossings.depths[MOST * p]!) ? 6 : Math.min(250, 120 + 3 * north + 130 * Math.exp(-(east * east + north * north) / 2)), alpha = Math.max(6, Math.min(254, Math.round(level)));
    base[4 * p] = Math.min(255, Math.round(level * 255 / alpha)); base[4 * p + 1] = Math.round(0.8 * base[4 * p]!); base[4 * p + 2] = Math.round(0.5 * base[4 * p]!); base[4 * p + 3] = alpha;
    for (let c = 0; c < 3; c++) photograph[3 * p + c] = base[4 * p + c]! * alpha / 255; }
  const walls = imageLayerSurfaceWalls(base, SIZE, SIZE, crossings, 1, PIXEL, (px, py) => Math.hypot(...sky(px, py)), placed.starRadiusArcsec);
  // Two balls, each a side that faces the Sun and one that faces away; the approaching ball's first.
  assert.equal(walls.layers.length, 4);
  const [nearIn, nearOut, farIn, farOut] = walls.layers as [typeof walls.layers[0], typeof walls.layers[0], typeof walls.layers[0], typeof walls.layers[0]];
  const south = pixelOf(0, -9), north = pixelOf(0, 9), both = pixelOf(0, 2.5);
  assert.ok(nearIn.depth[south]! < -15 && nearOut.depth[south]! > nearIn.depth[south]! && Number.isNaN(farIn.depth[south]!), `the approaching ball south of the star: ${nearIn.depth[south]} to ${nearOut.depth[south]}`);
  assert.ok(farIn.depth[north]! > 0 && farOut.depth[north]! > farIn.depth[north]! && Number.isNaN(nearIn.depth[north]!), `the receding ball north of it: ${farIn.depth[north]} to ${farOut.depth[north]}`);
  assert.ok(!Number.isNaN(nearIn.depth[both]!) && !Number.isNaN(farIn.depth[both]!) && nearOut.depth[both]! < farIn.depth[both]!, 'where one stands in front of the other the sight line crosses both');
  // Every side is lit, so each ball is closed from every side.
  for (const [layer, p] of [[nearIn, south], [nearOut, south], [farIn, north], [farOut, north], [farIn, both], [farOut, both], [nearIn, both], [nearOut, both]] as const) assert.ok(layer.tau[p]! > 0.2, `a side holds too little light: ${layer.tau[p]}`);
  // At a ball's outline, a fold, its two sides stand at one depth, and each knows how the other goes on past it.
  let rim = -1; for (let x = 0; x < SIZE && rim < 0; x++) if (!Number.isNaN(farIn.depth[north - SIZE / 2 + x]!)) rim = north - SIZE / 2 + x;
  assert.ok(rim >= 0 && Math.abs(farIn.depth[rim]! - farOut.depth[rim]!) < 1e-6, 'the two sides end apart'); assert.ok(Math.abs(farOut.depth[rim + RIM_JOINS_PIXELS + 2]! - farIn.depth[rim + RIM_JOINS_PIXELS + 2]!) > 4);
  assert.ok(Number.isNaN(farIn.depth[rim - 3]!) && Math.abs(farIn.around![rim - 3]! - farOut.depth[rim + 3]!) < 1e-6, `past the outline the entering side goes on as the leaving one: ${farIn.around![rim - 3]} and ${farOut.depth[rim + 3]}`);
  // The star's own light stays on the flat picture: no side holds light at the star, and the flat picture is as it was.
  const star = pixelOf(0.25, 0.25); for (const layer of walls.layers) assert.equal(layer.tau[star], 0); assert.ok(base[4 * star + 3]! > 200);
  // The Sun's view: the flat picture, then the sides from the farthest to the nearest, against the photograph.
  let worst = 0, total = 0;
  for (let p = 0; p < SIZE * SIZE; p++) for (let c = 0; c < 3; c++) { let seen = base[4 * p + c]! * base[4 * p + 3]! / 255;
    for (const layer of [...walls.layers].reverse()) { const alpha = 1 - Math.exp(-layer.tau[p]!); seen = layer.hue[3 * p + c]! * alpha + seen * (1 - alpha); }
    const error = Math.abs(seen - photograph[3 * p + c]!); worst = Math.max(worst, error); total += error; }
  assert.ok(worst < 4 && total / (3 * SIZE * SIZE) < 0.6, `from the Sun the worst difference is ${worst.toFixed(1)} of 255, the mean ${(total / (3 * SIZE * SIZE)).toFixed(2)}`);
});

test('where a sight line enters by one lobe and leaves by the other, the sides run on and the picture stays whole', () => {
  // One ball of 10 arcsec about the star, its pole 70 degrees from the sight line: the plane across the pole parts it into two lobes.
  const placed = surface({ tiltDeg: 70, paDeg: 0, rollDeg: 0, receding: '+z' }), crossings = imageLayerSurfaceCrossings(placed, stlTriangles(spheres([{ centre: [0, 0, 0], radius: 1 }]), 'fixture.stl'), SIZE, SIZE, sky);
  const base = Buffer.alloc(SIZE * SIZE * 4), photograph = new Float32Array(SIZE * SIZE * 3);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) { const p = y * SIZE + x, [east, north] = sky(x, y), level = Number.isNaN(crossings.depths[MOST * p]!) ? 6 : 150 + 4 * north + 3 * east; base[4 * p] = 255; base[4 * p + 1] = 200; base[4 * p + 2] = 120; base[4 * p + 3] = Math.round(level);
    for (let c = 0; c < 3; c++) photograph[3 * p + c] = base[4 * p + c]! * base[4 * p + 3]! / 255; }
  const walls = imageLayerSurfaceWalls(base, SIZE, SIZE, crossings, 1, PIXEL, (px, py) => Math.hypot(...sky(px, py)));
  // Four sides: each lobe's that faces the Sun and its one that faces away. The nearest and the farthest run whole across
  // the middle, where a sight line enters by one lobe and leaves by the other: no side ends there, and none is led to another.
  assert.equal(walls.layers.length, 4);
  const near = walls.layers[0]!, far = walls.layers[3]!, star = pixelOf(0, 0);
  for (const east of [-6, -3, 0, 3, 6]) { const p = pixelOf(east, 0); assert.ok(Math.abs(near.depth[p]! + Math.sqrt(100 - east * east)) < 0.3 && Math.abs(far.depth[p]! - Math.sqrt(100 - east * east)) < 0.3, `${east} arcsec east: ${near.depth[p]} and ${far.depth[p]}`); assert.ok(near.tau[p]! > 0.2 && far.tau[p]! > 0.2); }
  // The plane between the lobes is no surface: the two other sides end at it, and past it each goes on as the side that continues it.
  const [, nearRest, farRest] = walls.layers; assert.ok(Number.isNaN(nearRest!.depth[star]!) && Number.isNaN(farRest!.depth[star]!));
  const north = pixelOf(0, 8), south = pixelOf(0, -8); assert.ok(!Number.isNaN(nearRest!.depth[north]!) && Math.abs(near.around![north]! - nearRest!.depth[north]!) < 1e-6, `the nearest side past the plane: ${near.around![north]} and ${nearRest!.depth[north]}`);
  assert.ok(!Number.isNaN(farRest!.depth[south]!) && Math.abs(far.around![south]! - farRest!.depth[south]!) < 1e-6, `the farthest side past the plane: ${far.around![south]} and ${farRest!.depth[south]}`);
  let worst = 0, total = 0;
  for (let p = 0; p < SIZE * SIZE; p++) for (let c = 0; c < 3; c++) { let seen = base[4 * p + c]! * base[4 * p + 3]! / 255;
    for (const layer of [...walls.layers].reverse()) { const alpha = 1 - Math.exp(-layer.tau[p]!); seen = layer.hue[3 * p + c]! * alpha + seen * (1 - alpha); }
    const error = Math.abs(seen - photograph[3 * p + c]!); worst = Math.max(worst, error); total += error; }
  assert.ok(worst < 4 && total / (3 * SIZE * SIZE) < 0.6, `from the Sun the worst difference is ${worst.toFixed(1)} of 255, the mean ${(total / (3 * SIZE * SIZE)).toFixed(2)}`);
});
