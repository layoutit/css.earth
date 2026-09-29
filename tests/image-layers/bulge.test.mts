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
      disc: { centralSurfaceBrightness: 19.833, scaleLengthKpc: 2.684, skyEllipticity: 0.457, positionAngleDeg: 156.3 },
      extentKpc: { radius: 6, height: 4, ...(fadeFrom === undefined ? {} : { fadeFrom }) } } } });

test('a fading bulge keeps its share inside fadeFrom and gives none at the extent radius', () => {
  const plain = m81(), faded = m81(3), along = (model: typeof plain, kpc: number) => model.share(kpc * Math.sin(145.02 * Math.PI / 180), kpc * Math.cos(145.02 * Math.PI / 180));
  assert.ok(along(plain, 9) > 0.2, `S4G's bulge still holds ${along(plain, 9)} of the light at 9 kpc`);
  assert.equal(along(faded, 2), along(plain, 2));
  assert.ok(along(faded, 4.5) < along(plain, 4.5) && along(faded, 4.5) > 0);
  assert.equal(along(faded, 6), 0);
  assert.equal(along(faded, 9), 0);
});
