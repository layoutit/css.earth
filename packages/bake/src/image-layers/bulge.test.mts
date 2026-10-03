import assert from 'node:assert/strict';
import { test } from 'node:test';
import { imageLayerBulgeModel } from '@cssearth/bake/image-layers';

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
