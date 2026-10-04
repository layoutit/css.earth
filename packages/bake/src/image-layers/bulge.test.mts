import assert from 'node:assert/strict';
import { test } from 'node:test';
import { imageLayerBulgeModel, imageLayerShapeModel, lowerEnvelope, imageLayerBodyModel } from '@cssearth/bake/image-layers';

// M31 with Dorman et al.'s (2013, Table 3) bulge-plus-disc fit, on a disc inclined 74.0°.
const model = imageLayerBulgeModel({ target: { centerRaDeg: 10.684, centerDecDeg: 41.269, distancePc: 776_000 },
  geometry: { kind: 'inclined-disk', inclinationDeg: 74, lineOfNodesPaDeg: 37.7, thicknessKpc: 1, supportRadiusKpc: 27.2, supportTaperFraction: 0.75,
    depthWeights: [1], depthScales: [1], bulge: { source: 'dorman-2013-m31-structural-decomposition', positionAngleDeg: 44.4, sersicIndex: 1.917,
      halfLightRadiusKpc: 0.778, surfaceBrightnessAtHalfLight: 17.849, skyEllipticity: 0.277,
      disc: { centralSurfaceBrightness: 18.901, scaleLengthKpc: 5.76, skyEllipticity: 0.725 }, extentKpc: { radius: 5, height: 2.5 } } } });

test('the bulge carries most of the light at the centre and little beyond a few kpc', () => {
  const along = (kpc: number) => model.share(kpc * Math.sin(44.4 * Math.PI / 180), kpc * Math.cos(44.4 * Math.PI / 180));
  assert.ok(along(0.5) > 0.8 && along(1) > 0.6, `${along(0.5)}, ${along(1)}`);
  assert.ok(along(4) < 0.05, `${along(4)}`);
});

test('the spheroid projects to the fitted sky ellipticity at the disc inclination', () => {
  const i = 74 * Math.PI / 180, qSky = Math.sqrt(Math.cos(i) ** 2 + model.q0 ** 2 * Math.sin(i) ** 2);
  assert.ok(Math.abs(qSky - (1 - 0.277)) < 1e-12, `${qSky}`);
});

test('the density falls outward and is flatter along the disc normal', () => {
  const n = model.disc.diskNormal, m = model.lineNodes;
  const at = (v: readonly number[], k: number) => model.density([v[0]! * k, v[1]! * k, v[2]! * k]);
  assert.ok(at(m, 0.5) > at(m, 1) && at(m, 1) > at(m, 2));
  assert.ok(at(n, 1) < at(m, 1));
});

// M81 with S4G's fit (Salo et al. 2015), whose high-index bulge keeps a share of the light far out: the share fades to
// nothing between extentKpc.fadeFrom and extentKpc.radius on the sky.
const m81 = (fadeFrom?: number) => imageLayerBulgeModel({ target: { centerRaDeg: 148.8883, centerDecDeg: 69.065278, distancePc: 3_614_099.2 },
  geometry: { kind: 'inclined-disk', inclinationDeg: 59, lineOfNodesPaDeg: 150.2, thicknessKpc: 2.208, supportRadiusKpc: 16.5, supportTaperFraction: 0.75,
    depthWeights: [1], depthScales: [1], bulge: { source: 'salo-2015-s4g-decompositions', positionAngleDeg: 145.02, sersicIndex: 3.557,
      halfLightRadiusKpc: 1.804, surfaceBrightnessAtHalfLight: 20.017, skyEllipticity: 0.346,
      disc: { centralSurfaceBrightness: 19.17, scaleLengthKpc: 2.684, skyEllipticity: 0.457, positionAngleDeg: 156.3 },
      extentKpc: { radius: 6, height: 4, ...(fadeFrom === undefined ? {} : { fadeFrom }) } } } });

test('a fading bulge keeps its share inside fadeFrom and gives none at the extent radius', () => {
  const plain = m81(), faded = m81(3), along = (model: typeof plain, kpc: number) => model.share(kpc * Math.sin(145.02 * Math.PI / 180), kpc * Math.cos(145.02 * Math.PI / 180));
  assert.ok(along(plain, 9) > 0.2, `S4G's bulge still holds ${along(plain, 9)} of the light at 9 kpc`);
  assert.equal(along(faded, 2), along(plain, 2));
  assert.ok(along(faded, 4.5) < along(plain, 4.5) && along(faded, 4.5) > 0);
  assert.equal(along(faded, 6), 0);
  assert.equal(along(faded, 9), 0);
});

// M94 with S4G's two-disc fit (Salo et al. 2015, model _bdd): the second disc's light is disc light, so it lowers the
// bulge's share where it is bright.
const m94 = (secondDisc: boolean) => imageLayerBulgeModel({ target: { centerRaDeg: 192.721248, centerDecDeg: 41.120303, distancePc: 4_337_105.6 },
  geometry: { kind: 'inclined-disk', inclinationDeg: 31.77, lineOfNodesPaDeg: 105, thicknessKpc: 0.00783, supportRadiusKpc: 5.862, supportTaperFraction: 0.75,
    depthWeights: [1], depthScales: [1], bulge: { source: 'salo-2015-s4g-decompositions', positionAngleDeg: 7.53, sersicIndex: 1.814,
      halfLightRadiusKpc: 0.4016, surfaceBrightnessAtHalfLight: 17.724, skyEllipticity: 0.037,
      disc: { centralSurfaceBrightness: 19.035, scaleLengthKpc: 1.0612, skyEllipticity: 0.268, positionAngleDeg: 96.08 },
      ...(secondDisc ? { secondDisc: { centralSurfaceBrightness: 23.007, scaleLengthKpc: 5.3381, skyEllipticity: 0.171, positionAngleDeg: 123.51 } } : {}),
      extentKpc: { radius: 2.6, height: 1.3 } } } });

test('a second disc adds to the disc light and lowers the bulge share, most where the first disc has faded', () => {
  const one = m94(false), two = m94(true);
  assert.ok(two.light(0, 2).disc > one.light(0, 2).disc && two.light(0, 2).bulge === one.light(0, 2).bulge);
  assert.ok(two.share(0, 0.2) < one.share(0, 0.2) && one.share(0, 0.2) - two.share(0, 0.2) < 0.01, `${one.share(0, 0.2)}, ${two.share(0, 0.2)}`);
  assert.ok((one.share(0, 2.5) - two.share(0, 2.5)) / one.share(0, 2.5) > 0.05, `${one.share(0, 2.5)}, ${two.share(0, 2.5)}`);
});

test('a fitted bar adds disc light inside its radius and none beyond it', () => {
  const bar = { centralSurfaceBrightness: 18.823, radiusKpc: 2, skyEllipticity: 0.544, positionAngleDeg: 57.29 };
  const base = { target: { centerRaDeg: 0, centerDecDeg: 0, distancePc: 10_000_000 }, geometry: { kind: 'inclined-disk' as const, inclinationDeg: 40, lineOfNodesPaDeg: 95, thicknessKpc: 0.01,
    supportRadiusKpc: 17, supportTaperFraction: 0.75, depthWeights: [1], depthScales: [1], bulge: { source: 'salo-2015-s4g-decompositions', positionAngleDeg: 86.11, sersicIndex: 2.655,
      halfLightRadiusKpc: 0.37, surfaceBrightnessAtHalfLight: 16.5, skyEllipticity: 0.152, disc: { centralSurfaceBrightness: 19.2, scaleLengthKpc: 4.2, skyEllipticity: 0.253, positionAngleDeg: 92.15 },
      extentKpc: { radius: 1.2, height: 0.8 } } } };
  const plain = imageLayerBulgeModel(base), barred = imageLayerBulgeModel({ ...base, geometry: { ...base.geometry, bulge: { ...base.geometry.bulge, bar } } });
  const along = (kpc: number): [number, number] => [kpc * Math.sin(57.29 * Math.PI / 180), kpc * Math.cos(57.29 * Math.PI / 180)];
  const centre = barred.light(0, 0).disc - plain.light(0, 0).disc;
  assert.ok(Math.abs(centre - 10 ** (-0.4 * 18.823)) < 1e-15, `${centre}`);
  assert.ok(barred.light(...along(1)).disc > plain.light(...along(1)).disc && barred.share(...along(1)) < plain.share(...along(1)));
  assert.equal(barred.light(...along(2.5)).disc, plain.light(...along(2.5)).disc);
});

test('a fading bulge ends on its own spheroid, in the disc plane and along the disc normal', () => {
  const plain = m81(), faded = m81(3), n = faded.disc.diskNormal, m = faded.lineNodes;
  const at = (model: typeof plain, v: readonly number[], k: number) => model.density([v[0]! * k, v[1]! * k, v[2]! * k]);
  assert.equal(at(faded, m, 2.9), at(plain, m, 2.9));
  assert.ok(at(faded, m, 4.5) > 0 && at(faded, m, 4.5) < at(plain, m, 4.5));
  assert.equal(at(faded, m, 6.001), 0);
  // Along the normal the spheroid is flatter by its intrinsic axis ratio: it ends at radius x q0.
  assert.ok(at(faded, n, 6 * faded.q0 * 0.9) > 0);
  assert.equal(at(faded, n, 6.001 * faded.q0), 0);
});

// The Sombrero (NGC 4594) with S4G's fit: a Sérsic bulge and an edge-on disc. Its picture stands flat, facing the Sun, so
// the spheroid takes the galaxy's own disc from `galaxyDisc`.
const sombrero = (galaxyDisc?: { inclinationDeg: number; lineOfNodesPaDeg: number; source: string; basis: string }) => imageLayerBulgeModel({ target: { centerRaDeg: 189.9976, centerDecDeg: -11.6231, distancePc: 9_384_259 },
  geometry: { kind: 'inclined-disk', inclinationDeg: 0.001, lineOfNodesPaDeg: 0, thicknessKpc: 1, supportRadiusKpc: 18.06, supportTaperFraction: 0.75, depthWeights: [1], depthScales: [1],
    bulge: { source: 'salo-2015-s4g-decompositions', lightFrom: 'fit', positionAngleDeg: 89.5, sersicIndex: 4.663, halfLightRadiusKpc: 8.208, surfaceBrightnessAtHalfLight: 20.9, skyEllipticity: 0.392,
      edgeDisc: { centralSurfaceBrightness: 16.9, scaleLengthKpc: 3.2, scaleHeightKpc: 0.3, positionAngleDeg: 89.5 }, ...(galaxyDisc ? { galaxyDisc } : {}), extentKpc: { radius: 18, height: 18, fadeFrom: 9 } } } });
const sombreroDisc = { inclinationDeg: 84, lineOfNodesPaDeg: 89.5, source: 'test', basis: 'test' };

test('a picture facing the Sun cannot hold a flattened bulge without the galaxy\'s own disc', () => {
  assert.throws(() => sombrero(), /cannot come from an oblate spheroid seen at inclination 0.001°/);
});

test('with the galaxy\'s own disc the spheroid is flattened along that disc\'s normal, not along the sight line', () => {
  const model = sombrero(sombreroDisc), i = 84 * Math.PI / 180;
  assert.ok(Math.abs(Math.sqrt(Math.cos(i) ** 2 + model.q0 ** 2 * Math.sin(i) ** 2) - (1 - 0.392)) < 1e-12);
  // The normal of a disc seen at 84° lies almost in the plane of the sky, across the line of nodes.
  assert.ok(Math.abs(model.spheroidNormal[2]) < 0.11 && Math.abs(model.disc.diskNormal[2]) > 0.999, `${model.spheroidNormal}`);
  const at = (v: readonly number[], k: number) => model.density([v[0]! * k, v[1]! * k, v[2]! * k]);
  // Along the sight line (the picture's normal) the bulge is as deep as it is long; along the galaxy's normal it is flatter.
  assert.ok(at([0, 0, 1], 4) > at(model.spheroidNormal, 4) * 1.5, `${at([0, 0, 1], 4)} against ${at(model.spheroidNormal, 4)}`);
  assert.ok(Math.abs(at([0, 0, 1], 4) / at(model.lineNodes, 4) - 1) < 0.05);
});

test('an edge-on disc is bright along its position angle and thin across it', () => {
  const model = sombrero(sombreroDisc), pa = 89.5 * Math.PI / 180, along = (kpc: number): [number, number] => [kpc * Math.sin(pa), kpc * Math.cos(pa)], across = (kpc: number): [number, number] => [-kpc * Math.cos(pa), kpc * Math.sin(pa)];
  const centre = model.light(0, 0).disc;
  assert.ok(Math.abs(centre - 10 ** (-0.4 * 16.9)) / centre < 1e-9);
  // One scale length along the disc: (r / hr) K1(r / hr) at 1 is 0.6019.
  assert.ok(Math.abs(model.light(...along(3.2)).disc / centre - 0.6019072) < 1e-5, `${model.light(...along(3.2)).disc / centre}`);
  // One scale height across it: sech²(1) = 0.41997.
  assert.ok(Math.abs(model.light(...across(0.3)).disc / centre - 0.4199743) < 1e-5, `${model.light(...across(0.3)).disc / centre}`);
  // So the bulge's share is small in the disc and large above it.
  assert.ok(model.share(...along(3.2)) < model.share(...across(3.2)));
});

// A nebula's published walls (geometry.shape): the Ring Nebula's main shell and lobe, pole along the sight line.
const walled = (polarTiltDeg: number) => imageLayerShapeModel({ source: 'test', basis: 'test', expansionKmSPerArcsec: 0.65,
  ring: { semiMajorArcsec: 44, semiMinorArcsec: 30, majorPaDeg: 60, polarTiltDeg, polarLeansToPaDeg: 240, expansionKmS: [19, 9, 9] },
  lobe: { source: 'test', radiusArcsec: 19.7, expansionKmS: [36, 28, 20] }, smoothPixels: 16 });
const ring = walled(0), along = (radius: number, paDeg: number): [number, number] => [radius * Math.sin(paDeg * Math.PI / 180), radius * Math.cos(paDeg * Math.PI / 180)];

test('a speed is a depth: each channel has its wall at its speed over the expansion law', () => {
  // On the axis the light is the lobe's: red light at 36 km/s lies 55.4 arcsec in front of the star and as far behind it.
  const red = ring.walls(0, 0, [1, 0, 0])!, blue = ring.walls(0, 0, [0, 0, 1])!, mixed = ring.walls(0, 0, [1, 0, 1])!;
  assert.ok(Math.abs(red.far - 36 / 0.65) < 1e-9 && Math.abs(red.near + 36 / 0.65) < 1e-9, `${red.near} ${red.far}`);
  assert.ok(Math.abs(blue.far - 20 / 0.65) < 1e-9, `${blue.far}`);
  // Mixed light lies between its channels' walls, by how much of it is each channel's.
  assert.ok(Math.abs(mixed.far - (36 + 20) / 2 / 0.65) < 1e-9, `${mixed.far}`);
  assert.ok(Math.abs(ring.reach - 36 / 0.65) < 1e-9, `${ring.reach}`);
});

test('outside the lobe the light is on the main shell, which meets the picture\'s plane at its outline', () => {
  // 35 arcsec out along the major axis: outside the lobe (19.7 arcsec), inside the shell (44 arcsec).
  const wall = ring.walls(...along(35, 60), [1, 0, 0])!;
  assert.ok(Math.abs(wall.far - 19 / 0.65 * Math.sqrt(1 - (35 / 44) ** 2)) < 1e-6 && Math.abs(wall.near + wall.far) < 1e-9, `${wall.near} ${wall.far}`);
  // Across the major axis the shell ends at 30 arcsec; at its outline the wall is in the picture's plane.
  assert.equal(ring.walls(...along(31, 150), [1, 0, 0]), null);
  assert.ok(Math.abs(ring.walls(...along(43.99, 60), [1, 0, 0])!.far) < 0.02);
  // A tipped pole whose near end leans south-west puts the shell's south-west side behind the star, and still meets the plane at the outline.
  const tipped = walled(6.5), southWest = tipped.walls(...along(30, 240), [1, 0, 0])!, northEast = tipped.walls(...along(30, 60), [1, 0, 0])!;
  assert.ok(southWest.near + southWest.far > 0 && northEast.near + northEast.far < 0, `${southWest.near + southWest.far} ${northEast.near + northEast.far}`);
  const edge = tipped.walls(...along(43.5, 240), [1, 0, 0])!; assert.ok(Math.abs(edge.near) < 0.5 && Math.abs(edge.far) < 0.5, `${edge.near} ${edge.far}`);
});

test('the lobe opens from the shell\'s inner lip', () => {
  const green = (radius: number) => ring.walls(...along(radius, 60), [0, 1, 0])!.far;
  // Well inside its outline the wall is the lobe's own; at the outline it has joined the shell's, with no step across it.
  assert.ok(Math.abs(green(10) - 28 / 0.65 * Math.sqrt(1 - (10 / 19.7) ** 2)) < 1e-6, `${green(10)}`);
  assert.ok(Math.abs(green(19.69) - 9 / 0.65 * Math.sqrt(1 - (19.69 / 44) ** 2)) < 0.05, `${green(19.69)}`);
  assert.ok(Math.abs(green(19.69) - green(19.71)) < 0.05);
});

test('the lower envelope stays under fine dark detail and ignores fine bright detail', () => {
  const width = 64, height = 64, map = new Float32Array(width * height).fill(1);
  map[32 * width + 20] = 5;   // a bright knot
  map[32 * width + 44] = 0.2; // a dark knot
  const envelope = lowerEnvelope(map, width, height, 4);
  assert.ok(Math.abs(envelope[10 * width + 10]! - 1) < 1e-6);
  assert.ok(envelope[32 * width + 20]! <= 1 + 1e-6, 'the bright knot is not followed');
  assert.ok(Math.abs(envelope[32 * width + 44]! - 0.2) < 1e-6, 'the envelope stays under the dark knot');
  for (let p = 0; p < map.length; p++) assert.ok(envelope[p]! <= map[p]! + 1e-6, `the envelope is above the map at ${p}`);
  assert.throws(() => lowerEnvelope(map, width, height, 0), /whole number of pixels/);
});

// A nebula's published filled body (geometry.body): the Owl Nebula's spheroid, envelope and cavities.
const owl = imageLayerBodyModel({ source: 'test', basis: 'test', semiPolarArcsec: 93, semiEquatorialArcsec: 83, polarTiltDeg: 25, polarLeansToPaDeg: 300,
  envelope: { source: 'test', radiusArcsec: 109 }, cavities: { source: 'test', emission: 0.3, sizeArcsec: 35, farBetweenPaDeg: [135, 210] } });

test('a sight line crosses the envelope, then the body inside it', () => {
  const centre = owl.along(0, 0)!, tilt = 25 * Math.PI / 180;
  // Through the star: the envelope's radius either side, and the spheroid along a line 25 degrees from its pole.
  assert.ok(Math.abs(centre.envelope![1] - 109) < 1e-9 && Math.abs(centre.envelope![0] + 109) < 1e-9);
  assert.ok(Math.abs(centre.body![1] - 1 / Math.hypot(Math.cos(tilt) / 93, Math.sin(tilt) / 83)) < 1e-9, `${centre.body}`);
  assert.ok(Math.abs(centre.cavityAt) < 1e-12);
  // 100 arcsec out there is only envelope; beyond 109 arcsec there is nothing.
  const outer = owl.along(...along(100, 20))!;
  assert.equal(outer.body, null);
  assert.ok(Math.abs(outer.envelope![1] - Math.sqrt(109 ** 2 - 100 ** 2)) < 1e-9);
  assert.equal(owl.along(...along(110, 20)), null);
  assert.ok(Math.abs(owl.reach - 109) < 1e-9);
});

test('the cavities run along the pole: toward the Sun to the north-west and the east, away from it to the south', () => {
  const depth = 20 / Math.tan(25 * Math.PI / 180);
  // The near pole leans north-west: 20 arcsec that way the pole's line is in front of the star.
  assert.ok(Math.abs(owl.along(...along(20, 300))!.cavityAt + depth) < 1e-9);
  // To the south-east the pole's line is behind the star, but the easterly lobe points toward the Sun.
  assert.ok(owl.along(...along(20, 100))!.cavityAt < 0);
  assert.ok(owl.along(...along(20, 170))!.cavityAt > 0);
  // The near lobe is led into the far one across position angle 135°: no wall stands between them.
  assert.ok(Math.abs(owl.along(...along(20, 135))!.cavityAt) < 1e-9);
  assert.ok(owl.along(...along(20, 128))!.cavityAt < 0 && owl.along(...along(20, 142))!.cavityAt > 0);
  assert.ok(Math.abs(owl.along(...along(20, 119))!.cavityAt + 20 * Math.abs(Math.cos((119 - 300) * Math.PI / 180)) / Math.tan(25 * Math.PI / 180)) < 1e-9);
  // The far range ends where the pole's line passes through the star's depth, so there is no step there.
  assert.ok(Math.abs(owl.along(...along(20, 210))!.cavityAt) < 1e-9);
  // The equatorial plane is at the star's depth across the lean, and behind the star where the near pole leans.
  assert.ok(Math.abs(owl.along(...along(20, 30))!.equatorAt) < 1e-9);
  assert.ok(Math.abs(owl.along(...along(20, 300))!.equatorAt - 20 * Math.tan(25 * Math.PI / 180)) < 1e-9);
});
