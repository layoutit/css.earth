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
