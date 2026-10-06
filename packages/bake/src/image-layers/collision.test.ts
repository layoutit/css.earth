import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import sharp from 'sharp';
import { parseImageLayerRecipe } from './config.ts';
import { imageLayerCollision, imageLayerCollisionAccount, imageLayerCollisionLeaves } from './collision.ts';

// A sky of one arcsecond a pixel, east to the left: a place is its arcseconds east and north of the frame's middle.
const W = 240, H = 160;
const sky = (px: number, py: number): [number, number] => [W / 2 - .5 - px, H / 2 - .5 - py], pixel = (east: number, north: number): [number, number] => [W / 2 - .5 - east, H / 2 - .5 - north];
/** Two balls of even gas on one line: the main cloud, 30 arcsec in radius, 40 east of the middle, and the subcluster's, 12 in radius, 76 west of it. */
const MAIN = { east: 40, radius: 30, emits: .02 }, SUB = { east: -36, radius: 12, emits: .05 }, HUE = [1, .3, .5];
/** A halo of mass, a ball 20 arcsec in radius ahead of the subcluster's cloud, blue. */
const MASS = { east: -50, radius: 20, emits: .03, hue: [.08, .3, 1] };
const chord = (ball: { east: number; radius: number }, east: number, north: number) => 2 * Math.sqrt(Math.max(0, ball.radius ** 2 - (east - ball.east) ** 2 - north ** 2));
const recipe = (tiltDeg: number, more: Record<string, unknown> = {}, mass = false) => parseImageLayerRecipe({ schema: 'cssearth-image-layer-recipe@1', id: 'fixture-layers',
  source: { path: 'photograph.png', dimensions: [W, H], originalDimensions: [W, H], publisherUrl: 'https://example.org/', downloadUrl: 'https://example.org/photograph.png', credit: 'fixture', license: 'NASA-SAO' },
  observation: { centerRaDeg: 0, centerDecDeg: 0, fieldOfViewDeg: [W / 3600, H / 3600], northClockwiseDeg: 0 }, target: { centerRaDeg: 0, centerDecDeg: 0, distancePc: 1e9 },
  geometry: { kind: 'inclined-disk', inclinationDeg: 0, lineOfNodesPaDeg: 0, thicknessKpc: 1, depthWeights: [.25, .5, .25], supportRadiusKpc: 1000, supportTaperFraction: .9, depthScales: [1, 1, 1],
    collision: { source: 'fixture', basis: 'fixture', tiltDeg, gas: { source: 'fixture', path: 'gas.png', from: { raDeg: MAIN.east, decDeg: 0 }, to: { raDeg: SUB.east, decDeg: 0 } }, ...(mass ? { mass: { source: 'fixture', path: 'mass.png', from: { raDeg: 60, decDeg: 0 }, to: { raDeg: MASS.east, decDeg: 0 } } } : {}) } },
  bake: { maxFacePixels: W, diffuseFacePixels: 80, crossAxisSlices: 8, crossAxisAlongPixels: 64, crossAxisDepthPixels: 16, backgroundFloor: 0, edgeTaperFraction: .04, diffuseFraction: .5, diffuseSigmaPixels: 2, flat: true,
    bulgeSlices: 32, bulgeFacePixels: 240, bulgeCrossSlices: 24, encoding: { format: 'webp', quality: 80 }, ...more }, provenance: { path: 'provenance.json' } });
/** The model of the two balls' picture, the line tipped `tiltDeg`, with the mass picture if asked. */
const modelled = async (tiltDeg: number, mass = false) => { const directory = await mkdtemp(join(tmpdir(), 'collision-')), rgb = Buffer.alloc(3 * W * H);
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) { const [east, north] = sky(px, py), depth = MAIN.emits * chord(MAIN, east, north) + SUB.emits * chord(SUB, east, north); for (let c = 0; c < 3; c++) rgb[3 * (py * W + px) + c] = Math.round(255 * (1 - Math.exp(-depth * HUE[c]!))); }
  await sharp(rgb, { raw: { width: W, height: H, channels: 3 } }).png().toFile(join(directory, 'gas.png'));
  if (mass) { const blue = Buffer.alloc(3 * W * H); for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) { const [east, north] = sky(px, py); for (let c = 0; c < 3; c++) blue[3 * (py * W + px) + c] = Math.round(255 * (1 - Math.exp(-MASS.emits * chord(MASS, east, north) * MASS.hue[c]!))); }
    await sharp(blue, { raw: { width: W, height: H, channels: 3 } }).png().toFile(join(directory, 'mass.png')); }
  try { return await imageLayerCollision({ recipe: recipe(tiltDeg, {}, mass), sourceDirectory: directory, width: W, height: H, sky, pixel }); } finally { await rm(directory, { recursive: true }); } };
/** The cell of a model's grid that holds a place on the sky: the grid covers the pictures' light, not the frame. */
const cellAt = (model: Awaited<ReturnType<typeof modelled>>, east: number, north: number) => { const [u0, u1, v0, v1] = model.window, [px, py] = pixel(east, north), u = 2 * (px + .5) / W - 1, v = 1 - 2 * (py + .5) / H;
  return Math.floor((v0 - v) / (v0 - v1) * model.rows) * model.columns + Math.floor((u - u0) / (u1 - u0) * model.columns); };
/** The gas body's emission by station along its line (from the main cloud, toward the subcluster's), offset across it and depth. */
const gasOf = (model: Awaited<ReturnType<typeof modelled>>) => (along: number, across: number, depth: number) => model.bodies[0]!.emission(MAIN.east - along, across, depth);
/** Where a sight line's gas lies and how deep it reaches: the mean depth of its emission and the depths that hold all but a hundredth of it. */
const alongLine = (emission: (along: number, across: number, depth: number) => number, along: number, across: number) => { let sum = 0, moment = 0; const values: number[] = [];
  for (let depth = -80; depth <= 80; depth += .5) { const value = emission(along, across, depth); values.push(value); sum += value; moment += value * depth; }
  let low = 0, high = values.length - 1, cut = 0; while (cut + values[low]! < .005 * sum) cut += values[low++]!; cut = 0; while (cut + values[high]! < .005 * sum) cut += values[high--]!;
  return { mean: moment / sum, near: -80 + low * .5, far: -80 + high * .5 }; };

test('the gas a body of revolution adds up to is found again from its picture', async () => {
  const model = await modelled(0);
  const gas = model.bodies[0]!; assert.ok(gas.differs < .02, `two sides of a round body differ by ${gas.differs}`); assert.ok(gas.refused < .03, `a round body asked for ${gas.refused} of its light below nothing`);
  // Through the main cloud's middle the gas reaches the ball's radius either side; 20 arcsec off the line, as far as the ball does there.
  const middle = alongLine(gasOf(model), 0, 0), off = alongLine(gasOf(model), 0, 20);
  assert.ok(Math.abs(middle.mean) < 1 && Math.abs(middle.near + 30) < 3 && Math.abs(middle.far - 30) < 3, JSON.stringify(middle));
  assert.ok(Math.abs(off.near + Math.sqrt(500)) < 3 && Math.abs(off.far - Math.sqrt(500)) < 3, JSON.stringify(off));
  // The subcluster's cloud is its own size, not the main one's.
  const sub = alongLine(gasOf(model), 76, 0); assert.ok(Math.abs(sub.near + 12) < 3 && Math.abs(sub.far - 12) < 3, JSON.stringify(sub));
});

test('a tipped line puts the subcluster\'s gas behind the photograph\'s plane and leaves the main cloud on it', async () => {
  const model = await modelled(10), turn = Math.PI / 18;
  assert.ok(Math.abs(alongLine(gasOf(model), 76 * Math.cos(turn), 0).mean - 76 * Math.sin(turn)) < 2); assert.ok(Math.abs(alongLine(gasOf(model), 0, 0).mean) < 1);
});

test('from the Sun the slabs add up to the gas picture, and the curtains stand where the gas is', async () => {
  const model = await modelled(10), leaves = imageLayerCollisionLeaves(model, recipe(10).bake), slabs = leaves.filter(leaf => leaf.axis === 'z').sort((a, b) => a.corners[0][2] - b.corners[0][2]);
  assert.ok(slabs.length > 8 && leaves.some(leaf => leaf.axis === 'x') && leaves.some(leaf => leaf.axis === 'y'));
  // Nearest slab first, each seen through those in front of it, as a browser keeps it: color times opacity in whole numbers.
  // The sum is the picture to within a step of 255 a channel, and the most a texel may hold, 254 of 255.
  for (const [east, north] of [[40, 0], [40, 18], [-36, 0], [20, 5]] as const) { const t = cellAt(model, east, north), seen = [0, 0, 0]; let clear = 1; assert.ok(model.cells[t]!.lights[0]![0]! > .05);
    for (const slab of slabs) { const alpha = slab.rgba[4 * t + 3]! / 255; for (let c = 0; c < 3; c++) seen[c]! += clear * Math.floor(slab.rgba[4 * t + c]! * slab.rgba[4 * t + 3]! / 255) / 255; clear *= 1 - alpha; }
    for (let c = 0; c < 3; c++) assert.ok(Math.abs(seen[c]! - model.cells[t]!.lights[0]![c]!) < .012, `at ${east}, ${north} channel ${c}: the slabs show ${seen[c]}, the picture ${model.cells[t]!.lights[0]![c]}`); }
  // Every slab is the same rectangle, and a curtain reaches as far along the sight line either way as the body does.
  assert.ok(slabs.every(slab => slab.width === model.columns && slab.height === model.rows));
  const curtain = leaves.find(leaf => leaf.axis === 'x')!; assert.deepEqual([curtain.corners[0][2], curtain.corners[2][2]], [model.reachArcsec, -model.reachArcsec]);
});

test('the mass has its own line and its own body, and from the Sun adds to the gas as a screen does', async () => {
  const model = await modelled(10, true), mass = model.bodies[1]!, turn = Math.PI / 18, slabs = imageLayerCollisionLeaves(model, recipe(10).bake).filter(leaf => leaf.axis === 'z').sort((a, b) => a.corners[0][2] - b.corners[0][2]);
  // The halo, 110 arcsec along the mass's line: a ball of its own size, behind the plane by the tilt.
  const halo = alongLine((along, across, depth) => mass.emission(60 - along, across, depth), 110 * Math.cos(turn), 0); assert.ok(Math.abs(halo.mean - 110 * Math.sin(turn)) < 2.5 && Math.abs(halo.far - halo.near - 40) < 6, JSON.stringify(halo));
  // Where the halo and the subcluster's cloud lie on one sight line, and where the halo is alone.
  for (const [east, north] of [[-40, 0], [-36, 6], [-60, 0]] as const) { const t = cellAt(model, east, north), cell = model.cells[t]!, seen = [0, 0, 0]; let clear = 1; assert.ok(cell.lights[1]![2]! > .1);
    for (const slab of slabs) { const alpha = slab.rgba[4 * t + 3]! / 255; for (let c = 0; c < 3; c++) seen[c]! += clear * Math.floor(slab.rgba[4 * t + c]! * slab.rgba[4 * t + 3]! / 255) / 255; clear *= 1 - alpha; }
    for (let c = 0; c < 3; c++) assert.ok(Math.abs(seen[c]! - (1 - (1 - cell.lights[0]![c]!) * (1 - cell.lights[1]![c]!))) < .012, `at ${east}, ${north} channel ${c}: the slabs show ${seen[c]}, the screen of gas ${cell.lights[0]![c]} and mass ${cell.lights[1]![c]}`); }
});

test('a collision is refused on a bank that is not flat, and tipped past 45 degrees', () => {
  assert.throws(() => recipe(10, { flat: false }), /geometry\.collision is for a flat bank/u);
  assert.throws(() => recipe(60), /geometry\.collision\.tiltDeg is the lines' angle from the plane of the sky, from 0 to 45; got 60/u);
});

/** An ellipsoid of even gas about the frame's middle: 40 arcsec along its long axis on the sky, at position angle 30
 * degrees, 0.8 times that across, and 1.5 times that along the sight line. */
const SHELLS = { long: 40, axisRatio: .8, majorAxisPaDeg: 30, elongation: 1.5, emits: .012 };
const shell = (east: number, north: number) => { const pa = SHELLS.majorAxisPaDeg * Math.PI / 180; return Math.hypot(east * Math.sin(pa) + north * Math.cos(pa), (north * Math.sin(pa) - east * Math.cos(pa)) / SHELLS.axisRatio); };
const ellipsoidRecipe = (body: Record<string, unknown> = {}, more: Record<string, unknown> = {}) => { const { geometry, ...rest } = recipe(0), { collision: _line, ...flat } = geometry;
  return parseImageLayerRecipe({ ...rest, geometry: { ...flat, ...more, ellipsoid: { source: 'fixture', basis: 'fixture', gas: { source: 'fixture', path: 'gas.png', centre: { raDeg: 0, decDeg: 0 }, axisRatio: SHELLS.axisRatio, majorAxisPaDeg: SHELLS.majorAxisPaDeg, elongation: SHELLS.elongation, ...body } } } }); };
const shelled = async () => { const directory = await mkdtemp(join(tmpdir(), 'ellipsoid-')), rgb = Buffer.alloc(3 * W * H);
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) { const [east, north] = sky(px, py), chord = 2 * SHELLS.elongation * Math.sqrt(Math.max(0, SHELLS.long ** 2 - shell(east, north) ** 2)); for (let c = 0; c < 3; c++) rgb[3 * (py * W + px) + c] = Math.round(255 * (1 - Math.exp(-SHELLS.emits * chord * HUE[c]!))); }
  await sharp(rgb, { raw: { width: W, height: H, channels: 3 } }).png().toFile(join(directory, 'gas.png'));
  try { return await imageLayerCollision({ recipe: ellipsoidRecipe(), sourceDirectory: directory, width: W, height: H, sky, pixel }); } finally { await rm(directory, { recursive: true }); } };

test('an ellipsoid\'s shells are found again from its picture, as long along the sight line as published', async () => {
  const model = await shelled(), gas = model.bodies[0]!, pa = SHELLS.majorAxisPaDeg * Math.PI / 180, deep = SHELLS.elongation * SHELLS.long;
  assert.ok(gas.differs < .03, `the light differs from its shell's mean by ${gas.differs}`); assert.ok(gas.refused < .03, `even shells asked for ${gas.refused} of their light below nothing`);
  // The frame holds the ellipsoid whole, with the fade outside it; the body reaches the ellipsoid's length along the sight line.
  assert.ok(gas.wholeArcsec * .75 > SHELLS.long, `the largest whole shell is ${gas.wholeArcsec}`); assert.ok(Math.abs(model.reachArcsec - deep) < 3, `the body reaches ${model.reachArcsec}`);
  const through = (east: number, north: number) => alongLine((_along, _across, depth) => gas.emission(east, north, depth), 0, 0);
  const middle = through(0, 0); assert.ok(Math.abs(middle.mean) < 1 && Math.abs(middle.near + deep) < 3 && Math.abs(middle.far - deep) < 3, JSON.stringify(middle));
  // Half way out along the long axis and half way out along the short one are the same shell: the same reach along the sight line.
  const half = deep * Math.sqrt(.75), along = through(20 * Math.sin(pa), 20 * Math.cos(pa)), across = through(16 * Math.cos(pa), -16 * Math.sin(pa));
  for (const line of [along, across]) assert.ok(Math.abs(line.mean) < 1 && Math.abs(line.near + half) < 3 && Math.abs(line.far - half) < 3, JSON.stringify(line));
});

test('from the Sun an ellipsoid\'s slabs add up to its picture, and its account names the shells', async () => {
  const model = await shelled(), leaves = imageLayerCollisionLeaves(model, ellipsoidRecipe().bake), slabs = leaves.filter(leaf => leaf.axis === 'z').sort((a, b) => a.corners[0][2] - b.corners[0][2]);
  assert.ok(slabs.length > 8 && leaves.some(leaf => leaf.axis === 'x') && leaves.some(leaf => leaf.axis === 'y'));
  for (const [east, north] of [[0, 0], [10, 17], [14, -8], [-20, -20]] as const) { const t = cellAt(model, east, north), seen = [0, 0, 0]; let clear = 1; assert.ok(model.cells[t]!.lights[0]![0]! > .05);
    for (const slab of slabs) { const alpha = slab.rgba[4 * t + 3]! / 255; for (let c = 0; c < 3; c++) seen[c]! += clear * Math.floor(slab.rgba[4 * t + c]! * slab.rgba[4 * t + 3]! / 255) / 255; clear *= 1 - alpha; }
    for (let c = 0; c < 3; c++) assert.ok(Math.abs(seen[c]! - model.cells[t]!.lights[0]![c]!) < .012, `at ${east}, ${north} channel ${c}: the slabs show ${seen[c]}, the picture ${model.cells[t]!.lights[0]![c]}`); }
  const account = imageLayerCollisionAccount(model); assert.match(account.model, /ellipsoidal shells of a published shape/u);
  assert.match(account.limitations[0]!, /ellipses 0\.8 as wide as long, the long axis at position angle 30 degrees, and 1\.5 times as long along the sight line/u);
});

test('from the side the curtains add up toward white as a screen does, from either side alike', async () => {
  const model = await shelled(), curtains = imageLayerCollisionLeaves(model, ellipsoidRecipe().bake).filter(leaf => leaf.axis === 'x'), { width, height } = curtains[0]!, p = (height >> 1) * width + (width >> 1);
  // The sight line through the ellipsoid's middle, across the curtains: each over those behind it, color times opacity in whole numbers.
  const seen = (stack: typeof curtains) => { const sum = [0, 0, 0]; for (const curtain of stack) { const alpha = curtain.rgba[4 * p + 3]! / 255; for (let c = 0; c < 3; c++) sum[c] = Math.floor(curtain.rgba[4 * p + c]! * curtain.rgba[4 * p + 3]! / 255) / 255 + sum[c]! * (1 - alpha); } return sum; };
  const one = seen(curtains), other = seen([...curtains].reverse());
  // The gas's red is the strongest channel: its optical depth on this line gives what green (0.3 of it) and blue (0.5) add up to.
  const red = -Math.log(1 - one[0]! / (240 / 255)) * (240 / 255); assert.ok(red > .5, `the line through the middle holds ${red} of red`);
  for (const [c, share] of [[1, HUE[1]!], [2, HUE[2]!]] as const) { const screen = (1 - Math.exp(-share * red)) / (1 - Math.exp(-red)) * one[0]!, thin = share * one[0]!;
    assert.ok(Math.abs(one[c]! - screen) < .02, `channel ${c} shows ${one[c]}; a screen gives ${screen}, the light spread thin ${thin}`); assert.ok(screen - thin > .03); assert.ok(Math.abs(other[c]! - one[c]!) < .02, `from the other side channel ${c} shows ${other[c]}, not ${one[c]}`); }
});

test('an ellipsoid is refused beside a collision, and with shells wider than they are long', () => {
  assert.throws(() => ellipsoidRecipe({}, { collision: recipe(0).geometry.collision }), /geometry\.ellipsoid is for a flat bank without .* a collision/u);
  assert.throws(() => ellipsoidRecipe({ axisRatio: 1.2 }), /axisRatio is the shells' short axis on the sky over their long one, at most 1; got 1\.2/u);
});
