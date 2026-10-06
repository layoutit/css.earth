import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import sharp from 'sharp';
import { parseImageLayerRecipe } from './config.ts';
import { prepareImageLayers } from './prepare.ts';
import { distanceFromSurface, imageLayerStreamsModel, STREAM_CLAIM_REACH, SURFACE_MARGIN_CELLS } from './streams.ts';

type Leaf = { id: string; axis: string; texturePath: string; verticesUnits: number[][]; bytes: number };

// Zhao, Morris, Goss & An (2009, ApJ 699, 186), Table 5: the three ionized streams of Sagittarius A West, each one
// Keplerian orbit about Sgr A* at 8 kpc with 4.2 million solar masses. The semi-major axes are the table's thousands of
// astronomical units as angles at 8 kpc; the true anomalies are the ranges the paper calculates the streams over, but
// for the Western Arc's end: the paper runs it to 420°, through the Northern Arm, and its last measured place is at 301°.
const ZHAO = { source: 'fixture', basis: 'fixture', dispersion: 0.25, streams: [
  { id: 'northern-arm', semiMajorArcsec: 205 / 8, eccentricity: 0.83, ascendingNodeDeg: 64, argumentOfPerifocusDeg: 132, inclinationDeg: 139, trueAnomalyDeg: [192, 460] as [number, number] },
  { id: 'eastern-arm', semiMajorArcsec: 289 / 8, eccentricity: 0.82, ascendingNodeDeg: -42, argumentOfPerifocusDeg: -280, inclinationDeg: 122, trueAnomalyDeg: [195, 430] as [number, number] },
  { id: 'western-arc', semiMajorArcsec: 236 / 8, eccentricity: 0.20, ascendingNodeDeg: 71, argumentOfPerifocusDeg: 22, inclinationDeg: 117, trueAnomalyDeg: [130, 302] as [number, number] },
] };
// The same paper's Table 3: 17 places on each stream, arcseconds east and north of Sgr A*, and the H92α radial velocity
// there, km/s, positive away from the Sun.
const MEASURED: Record<string, [number, number, number][]> = {
  'northern-arm': [[4.05, 32.40, 78], [5.05, 29.80, 100], [5.95, 27.20, 82], [6.75, 24.50, 92], [7.35, 21.90, 92], [7.95, 19.10, 100], [8.05, 16.30, 84], [7.95, 13.50, 130], [7.65, 10.70, 120], [7.35, 7.90, 96], [6.85, 5.10, 67], [5.85, 2.50, 43], [4.65, 0.00, 8], [2.95, -2.10, -60], [0.95, -3.80, -140], [-1.55, -4.70, -240], [-3.95, -4.30, -270]],
  'eastern-arm': [[25.00, 18.5, 77], [24.15, 10.0, 91], [23.15, 5.50, 110], [21.55, 2.00, 100], [19.75, -0.75, 110], [17.55, -3.0, 130], [15.25, -4.7, 140], [13.05, -6.2, 160], [10.45, -6.80, 160], [7.95, -7.00, 160], [5.45, -6.70, 120], [2.95, -5.80, 93], [0.95, -4.50, 54], [-1.15, -3.00, -17], [-3.55, -1.50, -39], [-5.75, -0.00, -110], [-7.55, 2.25, -160]],
  'western-arc': [[-9.55, -32.50, -75], [-12.55, -32.75, -94], [-14.65, -30.50, -94], [-16.75, -28.00, -93], [-18.25, -24.50, -92], [-18.75, -21.50, -73], [-18.85, -18.60, -64], [-18.75, -15.00, -42], [-18.00, -8.80, -33], [-16.85, -5.50, -22], [-15.75, -1.50, -22], [-14.75, 2.00, -8], [-13.15, 5.00, -11], [-11.75, 7.80, 17], [-7.75, 13.50, 20], [-2.75, 19.00, 52], [-0.25, 22.00, 90]],
};
/** How far the orbits may miss the measured places (arcseconds) and speeds (km/s), root mean square. Measured
 * 2026-10-05: 0.19, 0.61 and 0.35 arcsec; 36, 40 and 21 km/s. The lines are 35 to 214 km/s wide. */
const WITHIN = { 'northern-arm': [0.25, 40], 'eastern-arm': [0.7, 45], 'western-arc': [0.45, 25] } as const;
const rad = (degrees: number) => degrees * Math.PI / 180, ARCSEC_PER_PC = 206264.806 / 8000, GM = 4.30091e-3 * 4.2e6;

/** A place and its speed along the sight line on a stream's middle orbit, by the textbook's rotations: arcseconds east,
 * north and away from the Sun, km/s away. */
function onOrbit(stream: typeof ZHAO.streams[number], anomalyDeg: number) {
  const a = stream.semiMajorArcsec / ARCSEC_PER_PC, p = a * (1 - stream.eccentricity ** 2), f = rad(anomalyDeg), r = p / (1 + stream.eccentricity * Math.cos(f)), h = Math.sqrt(GM / p);
  const u = rad(stream.argumentOfPerifocusDeg) + f, node = rad(stream.ascendingNodeDeg), tilt = rad(stream.inclinationDeg);
  return { east: r * (Math.cos(node) * Math.cos(u) - Math.sin(node) * Math.sin(u) * Math.cos(tilt)) * ARCSEC_PER_PC, north: r * (Math.sin(node) * Math.cos(u) + Math.cos(node) * Math.sin(u) * Math.cos(tilt)) * ARCSEC_PER_PC, away: r * Math.sin(u) * Math.sin(tilt) * ARCSEC_PER_PC,
    kmS: (h * stream.eccentricity * Math.sin(f) * Math.sin(u) + h * (1 + stream.eccentricity * Math.cos(f)) * Math.cos(u)) * Math.sin(tilt) };
}

test('the published orbits pass the paper\'s measured places with its measured speeds, and each stream\'s plane holds its orbit', () => {
  const { planes } = imageLayerStreamsModel(ZHAO);
  assert.deepEqual(planes.map(plane => plane.id), ['northern-arm', 'eastern-arm', 'western-arc', 'sky']);
  for (const [index, stream] of ZHAO.streams.entries()) {
    const plane = planes[index]!, track = []; for (let anomaly = stream.trueAnomalyDeg[0]; anomaly <= stream.trueAnomalyDeg[1]; anomaly += 0.1) track.push(onOrbit(stream, anomaly));
    let places = 0, speeds = 0;
    for (const [east, north, kmS] of MEASURED[stream.id]!) {
      const nearest = track.reduce((best, point) => Math.hypot(point.east - east, point.north - north) < Math.hypot(best.east - east, best.north - north) ? point : best);
      places += (nearest.east - east) ** 2 + (nearest.north - north) ** 2; speeds += (nearest.kmS - kmS) ** 2;
      // A measured place is inside its stream's bundle, on the gas's part of the orbit.
      const at = plane.place(east, north); assert.ok(at.across < 1 && at.beyond === 0, `${stream.id}: ${east}, ${north} is ${at.across} dispersions from the middle orbit`);
    }
    const [arcsec, kmS] = WITHIN[stream.id as keyof typeof WITHIN];
    assert.ok(Math.sqrt(places / 17) < arcsec, `${stream.id}: places missed by ${Math.sqrt(places / 17)} arcsec`);
    assert.ok(Math.sqrt(speeds / 17) < kmS, `${stream.id}: speeds missed by ${Math.sqrt(speeds / 17)} km/s`);
    // The orbit lies in the plane, on the bundle's middle: the plane's depth under each of its places is the orbit's own.
    for (const point of track.filter((_, step) => step % 50 === 0)) {
      assert.ok(Math.abs(plane.depth(point.east, point.north) - point.away) < 1e-9, `${stream.id}: depth`);
      const at = plane.place(point.east, point.north); assert.ok(at.across < 1e-9 && at.beyond < 1e-9, `${stream.id}: on its middle orbit`);
    }
    assert.ok(Math.abs(Math.hypot(...plane.normal) - 1) < 1e-12);
  }
  // The paper: the Northern Arm and Western Arc are nearly coplanar, the Eastern Arm's plane nearly perpendicular to theirs,
  // and where the two arms meet south-west of Sgr A* the gas is behind it.
  const between = (a: readonly number[], b: readonly number[]) => Math.acos(Math.abs(a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!)) * 180 / Math.PI;
  assert.ok(between(planes[0]!.normal, planes[2]!.normal) < 30 && between(planes[0]!.normal, planes[1]!.normal) > 70 && between(planes[1]!.normal, planes[2]!.normal) > 70);
  for (const [east, north] of [[0.95, -3.80], [-1.55, -4.70]] as const) assert.ok(planes[0]!.depth(east, north) > 0 && planes[1]!.depth(east, north) > 0, 'the Bar is behind Sgr A*');
  assert.ok(planes[1]!.depth(25, 18.5) < -40, 'the Eastern Arm\'s outer end is in front');
});

test('a sight line\'s light is on the streams that claim it and otherwise on the plane of the sky', () => {
  const model = imageLayerStreamsModel(ZHAO), [north, east, , sky] = model.planes;
  for (let x = -50; x <= 50; x += 2.5) for (let y = -50; y <= 50; y += 2.5) { const shares = model.shares(x, y); assert.ok(Math.abs(shares.reduce((sum, share) => sum + share, 0) - 1) < 1e-12 && shares.every(share => share >= 0), `${x}, ${y}`); }
  // At the centre and far outside every stream nothing is claimed.
  assert.equal(sky!.share(0, 0), 1); assert.equal(sky!.share(48, -48), 1);
  // The Northern Arm alone holds its own measured places north of the centre; so does the Eastern Arm east of it.
  assert.equal(north!.share(7.95, 19.10), 1); assert.equal(east!.share(21.55, 2.00), 1);
  // Where the two arms cross, between the Northern Arm's fifteenth measured place and the Eastern Arm's thirteenth, they
  // share the light, and none is left on the sky.
  const crossing = model.shares(0.95, -4.15); assert.ok(crossing[0]! > 0.1 && crossing[1]! > 0.1 && crossing[3] === 0, `${crossing}`);
  // Past a bundle's edge the claim fades: all inside one dispersion, less between, none at the reach.
  const stream = ZHAO.streams[1]!, middle = onOrbit(stream, 230), outward = (factor: number) => { const point = onOrbit({ ...stream, semiMajorArcsec: stream.semiMajorArcsec * factor }, 230); return east!.share(point.east, point.north) / (1 - north!.share(point.east, point.north)); };
  assert.equal(east!.share(middle.east, middle.north), 1);
  assert.equal(outward(1 + 0.9 * ZHAO.dispersion), 1);
  const faded = outward(1 + 1.5 * ZHAO.dispersion); assert.ok(faded > 0.3 && faded < 0.7, `${faded}`);
  assert.equal(outward(1 + (STREAM_CLAIM_REACH + 0.01) * ZHAO.dispersion), 0);
  // Past the end of the gas along the orbit the claim fades over one dispersion of arc.
  const before = onOrbit(stream, stream.trueAnomalyDeg[0] - 0.5 * ZHAO.dispersion * 180 / Math.PI), wellBefore = onOrbit(stream, stream.trueAnomalyDeg[0] - 1.1 * ZHAO.dispersion * 180 / Math.PI);
  assert.ok(east!.share(before.east, before.north) > 0.3 && east!.share(before.east, before.north) < 0.7); assert.equal(east!.share(wellBefore.east, wellBefore.north), 0);
});

test('a stream with a published surface also holds the sight lines inside it, fading past its edge', () => {
  // A surface of 20 by 20 cells of one arcsecond, its top left cell 30 arcsec east and 10 north of the centre: east of
  // the Northern Arm's bundle, where the arm alone claims nothing.
  const cells = { width: 40, height: 40, cover: new Float32Array(1600) }; for (let y = 10; y < 30; y++) for (let x = 10; x < 30; x++) cells.cover[y * 40 + x] = 1;
  const surface = { source: 'fixture', basis: 'fixture', path: 'surface.png', cellArcsec: 1, centreCell: [40, 20] as [number, number] };
  const withSurface = { ...ZHAO, streams: ZHAO.streams.map((stream, index) => index === 2 ? { ...stream, surface } : stream) };
  assert.throws(() => imageLayerStreamsModel(withSurface), /were not read/u);
  const plain = imageLayerStreamsModel(ZHAO), model = imageLayerStreamsModel(withSurface, { 'western-arc': cells }), inside = [20.5, 0.5] as const;
  assert.equal(plain.planes[2]!.share(...inside), 0);
  assert.ok(model.planes[2]!.share(...inside) > 0.5, 'inside the surface the stream claims the sight line');
  assert.ok(Math.abs(model.shares(...inside).reduce((sum, share) => sum + share, 0) - 1) < 1e-12);
  // Past its edge the claim fades over a dispersion of the distance from the centre: here about 9 arcsec.
  const justOutside = [20.5, 13] as const, reach = ZHAO.dispersion * (STREAM_CLAIM_REACH - 1) * model.planes[2]!.radius(...justOutside);
  assert.ok(reach > 6 && reach < 14, `${reach}`);
  assert.ok(model.planes[2]!.outside(...justOutside) > 2 && model.planes[2]!.outside(...justOutside) < 4);
  const held = model.planes[2]!.share(...justOutside) / model.planes[2]!.share(...inside); assert.ok(held > 0.4 && held < 0.99, `${held}`);
  assert.equal(model.planes[2]!.share(45, 40), plain.planes[2]!.share(45, 40));
  const away = distanceFromSurface(cells);
  assert.equal(away.width, 40 + 2 * SURFACE_MARGIN_CELLS);
  assert.equal(away.cells[(SURFACE_MARGIN_CELLS + 20) * away.width + SURFACE_MARGIN_CELLS + 20], 0);
  assert.equal(away.cells[(SURFACE_MARGIN_CELLS + 20) * away.width + SURFACE_MARGIN_CELLS + 34], 5);
  assert.ok(Math.abs(away.cells[(SURFACE_MARGIN_CELLS + 6) * away.width + SURFACE_MARGIN_CELLS + 7]! - 5) < 1e-6, 'three across and four up from the corner');
});

test('a bank on streams puts the picture on their planes and the sky\'s, and from the Sun shows the picture', async () => {
  const root = await mkdtemp(join(tmpdir(), 'image-layer-streams-')), source = join(root, 'source'), SIZE = 64;
  try {
    await mkdir(source);
    // 100 arcsec across 64 pixels: a glow 45 arcsec in radius, fading to nothing at its edge.
    const glow = Buffer.alloc(SIZE * SIZE * 3);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) { const at = 3 * (y * SIZE + x), radius = Math.hypot(x - 31.5, y - 31.5), lit = radius < 29 ? 220 * (1 - radius / 29) : 0; glow[at] = lit; glow[at + 1] = 0.6 * lit; glow[at + 2] = 0.3 * lit; }
    await writeFile(join(source, 'source.png'), await sharp(glow, { raw: { width: SIZE, height: SIZE, channels: 3 } }).png().toBuffer());
    await writeFile(join(source, 'provenance.json'), '{}\n');
    const flat = { schema: 'cssearth-image-layer-recipe@1', id: 'fixture', source: { path: 'source.png', dimensions: [SIZE, SIZE], originalDimensions: [SIZE, SIZE], publisherUrl: 'https://example.test', downloadUrl: 'https://example.test/a', credit: 'Fixture', license: 'NASA-MAST' },
      observation: { centerRaDeg: 10, centerDecDeg: 20, fieldOfViewDeg: [100 / 3600, 100 / 3600], northClockwiseDeg: 0 }, target: { centerRaDeg: 10, centerDecDeg: 20, distancePc: 8000 },
      geometry: { kind: 'inclined-disk', inclinationDeg: 0.001, lineOfNodesPaDeg: 0, thicknessKpc: 1e-7, supportRadiusKpc: 0.003, supportTaperFraction: 0.9, depthWeights: [0.25, 0.5, 0.25], depthScales: [1, 1, 1], unit: 'pc' },
      bake: { maxFacePixels: SIZE, diffuseFacePixels: 16, crossAxisSlices: 3, crossAxisAlongPixels: 16, crossAxisDepthPixels: 9, backgroundFloor: 0, edgeTaperFraction: 0.01, diffuseFraction: 0.6, diffuseSigmaPixels: 1, flat: true, encoding: { format: 'webp', quality: 100 } },
      provenance: { path: 'provenance.json' } };
    const streamed = { ...flat, geometry: { ...flat.geometry, streams: ZHAO } };
    const reference = await prepareImageLayers({ sourceDirectory: source, outputDirectory: join(root, 'flat'), recipe: parseImageLayerRecipe(flat) });
    const bank = await prepareImageLayers({ sourceDirectory: source, outputDirectory: join(root, 'streamed'), recipe: parseImageLayerRecipe(streamed) });
    const { planes } = imageLayerStreamsModel(ZHAO), leaves = bank.banks.find(entry => entry.axis === 'z')!.leaves as Leaf[];
    assert.deepEqual(leaves.map(leaf => leaf.id), ['z-northern-arm', 'z-eastern-arm', 'z-western-arc', 'z-sky']);
    assert.deepEqual((bank.resources as { path: string }[]).map(resource => resource.path).sort(), ['layers/plane-eastern-arm.webp', 'layers/plane-northern-arm.webp', 'layers/plane-sky.webp', 'layers/plane-western-arc.webp']);
    assert.match(bank.approximation.model, /3 tilted planes through the centre/u);
    // A leaf's corners are on its plane through the centre.
    for (const leaf of leaves) { const plane = planes.find(entry => leaf.id === `z-${entry.id}`)!; for (const vertex of leaf.verticesUnits) assert.ok(Math.abs(plane.normal[0] * vertex[0]! + plane.normal[1] * vertex[1]! + plane.normal[2] * vertex[2]!) < 1e-9, `${leaf.id}: off its plane`); }
    // The Sun's view at the picture's pixel centres: the four planes over one another give the light of the flat bake.
    const read = async (directory: string, leaf: Leaf) => { const { data, info } = await sharp(join(directory, leaf.texturePath)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }), [topLeft, topRight, , bottomLeft] = leaf.verticesUnits as [number[], number[], number[], number[]];
      return { data, width: info.width, height: info.height, origin: topLeft, right: [topRight[0]! - topLeft[0]!, topRight[1]! - topLeft[1]!], down: [bottomLeft[0]! - topLeft[0]!, bottomLeft[1]! - topLeft[1]!] }; };
    const light = (leaf: Awaited<ReturnType<typeof read>>, x: number, y: number) => { const dx = x - leaf.origin[0]!, dy = y - leaf.origin[1]!, det = leaf.right[0]! * leaf.down[1]! - leaf.right[1]! * leaf.down[0]!, i = Math.floor((dx * leaf.down[1]! - dy * leaf.down[0]!) / det * leaf.width), j = Math.floor((leaf.right[0]! * dy - leaf.right[1]! * dx) / det * leaf.height);
      if (i < 0 || j < 0 || i >= leaf.width || j >= leaf.height) return [0, 0]; const at = 4 * (j * leaf.width + i), alpha = leaf.data[at + 3]! / 255; return [leaf.data[at]! * alpha, alpha]; };
    const sheets = await Promise.all(leaves.map(leaf => read(join(root, 'streamed'), leaf))), whole = await read(join(root, 'flat'), (reference.banks.find(entry => entry.axis === 'z')!.leaves as Leaf[]).find(leaf => leaf.id === 'z-detail')!);
    const pcPerArcsec = 8000 * Math.PI / 648000, pixel = 100 / SIZE; let lit = 0, onStreams = 0, onSky = 0;
    for (let py = 1; py < SIZE; py += 2) for (let px = 1; px < SIZE; px += 2) {
      const east = (SIZE / 2 - 0.5 - px) * pixel, north = (SIZE / 2 - 0.5 - py) * pixel, expected = light(whole, east * pcPerArcsec, north * pcPerArcsec);
      let red = 0, clear = 1; for (const sheet of sheets) { const [r, alpha] = light(sheet, east * pcPerArcsec, north * pcPerArcsec); red += clear * r!; clear *= 1 - alpha!; }
      assert.ok(Math.abs(red - expected[0]!) < 4, `${east}, ${north}: ${red} for ${expected[0]}`);
      if (!expected[1]) continue; lit++;
      const shares = imageLayerStreamsModel(ZHAO).shares(east, north); if (shares[3] === 1) onSky++; else if (shares[3] === 0) onStreams++;
    }
    assert.ok(lit > 400 && onStreams > 100 && onSky > 60, `${lit} lit: ${onStreams} on the streams, ${onSky} on the sky's plane`);
    const first = ZHAO.streams[0]!;
    assert.throws(() => parseImageLayerRecipe({ ...streamed, geometry: { ...streamed.geometry, streams: { ...ZHAO, streams: [{ ...first, inclinationDeg: 90 }] } } }), /edge-on/u);
    assert.throws(() => parseImageLayerRecipe({ ...streamed, geometry: { ...streamed.geometry, streams: { ...ZHAO, streams: [first, first] } } }), /once each/u);
    assert.throws(() => parseImageLayerRecipe({ ...streamed, geometry: { ...streamed.geometry, streams: { ...ZHAO, streams: [{ ...first, id: 'sky' }] } } }), /not "sky"/u);
    assert.throws(() => parseImageLayerRecipe({ ...streamed, geometry: { ...streamed.geometry, streams: { ...ZHAO, streams: [{ ...first, trueAnomalyDeg: [200, 100] }] } } }), /ends after it starts/u);
    assert.throws(() => parseImageLayerRecipe({ ...streamed, geometry: { ...streamed.geometry, streams: { ...ZHAO, dispersion: 1.5 } } }), /fraction of the semi-major axis/u);
    assert.throws(() => parseImageLayerRecipe({ ...streamed, bake: { ...streamed.bake, flat: false } }), /geometry\.streams is for a flat bank/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});
