import assert from 'node:assert/strict';
import { test } from 'node:test';
import { imageLayerDisc, imageLayerDiscDistanceKpc } from '@cssearth/bake/image-layers';

// M31's shape, rounded: a disc 776 kpc away, inclined 77.5° with its line of nodes at position angle 37.7°.
const disc = imageLayerDisc({ target: { centerRaDeg: 10.684, centerDecDeg: 41.269, distancePc: 776_000 },
  geometry: { kind: 'inclined-disk', inclinationDeg: 77.5, lineOfNodesPaDeg: 37.7, thicknessKpc: 1, supportRadiusKpc: 35, supportTaperFraction: 0.9,
    depthWeights: [1], depthScales: [1] } });
// The sky position `arcminutes` from the centre at position angle `paDeg` (east of north), exactly on the sphere.
const offset = (paDeg: number, arcminutes: number): [number, number] => {
  const pa = paDeg * Math.PI / 180, a = arcminutes / 60 * Math.PI / 180, dir = [0, 1, 2].map(k => Math.sin(pa) * disc.east[k]! + Math.cos(pa) * disc.north[k]!);
  const v = [0, 1, 2].map(k => Math.cos(a) * disc.target[k]! + Math.sin(a) * dir[k]!);
  return [(Math.atan2(v[1]!, v[0]!) * 180 / Math.PI + 360) % 360, Math.asin(v[2]!) * 180 / Math.PI];
};

test('the disc centre lies at the target distance', () => {
  assert.ok(Math.abs(imageLayerDiscDistanceKpc(disc, 10.684, 41.269) - 776) < 1e-9);
});

const rad = (deg: number) => deg * Math.PI / 180, inclination = rad(77.5);

test('the line of nodes lies across the sight line: a point on it is D / cos(offset) away along its own sight line', () => {
  for (const side of [37.7, 217.7]) {
    const expected = 776 / Math.cos(rad(1));
    assert.ok(Math.abs(imageLayerDiscDistanceKpc(disc, ...offset(side, 60)) - expected) < 1e-3, `position angle ${side}°`);
  }
});

test('the minor axis runs toward and away from us: its sides lie at D cos i / cos(i ± offset)', () => {
  const a = rad(20 / 60), sides = [127.7, 307.7].map(side => imageLayerDiscDistanceKpc(disc, ...offset(side, 20))).sort((x, y) => x - y);
  const expected = [776 * Math.cos(inclination) / Math.cos(inclination - a), 776 * Math.cos(inclination) / Math.cos(inclination + a)].sort((x, y) => x - y);
  sides.forEach((value, index) => assert.ok(Math.abs(value - expected[index]!) < 0.05, `${value} kpc, expected ${expected[index]}`));
});
