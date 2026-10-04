import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCatalogueSpheroid, placeSpheroidRows } from './catalogue-spheroid.ts';

const PC_M = 3.0856775814913673e16;
// A round spheroid 10 pc in half-light radius, 8 kpc away toward +x, ending at two half-light radii.
const spheroid = parseCatalogueSpheroid({ centerRaDeg: 0, centerDecDeg: 0, distancePc: 8000, halfLightRadiusKpc: 0.01, sersicIndex: 2, axisRatio: 1,
  axisPositionAngleDeg: 0, cutoffHalfLightRadii: 2, source: 'a-fit', basis: 'A test fit.' }, 'frame.spheroid');
// Sight lines 0 to 9.9 pc from the centre, all inside the 20 pc reach.
const sky = Array.from({ length: 100 }, (_, index) => [index * 0.1 / 8000 * 180 / Math.PI, 0] as const);

test('a spheroid placement keeps each row on its sight line, inside the spheroid, the same on every run', () => {
  const placed = placeSpheroidRows({ sky, spheroid, id: 'bank', at: 'frame.spheroid' });
  assert.deepEqual(placed, placeSpheroidRows({ sky, spheroid, id: 'bank', at: 'frame.spheroid' }));
  for (const [index, [x = 0, y = 0, z = 0]] of placed.points.entries()) {
    assert.ok(Math.abs(Math.atan2(y, x) - sky[index]![0] * Math.PI / 180) < 2e-5 && z === 0, `row ${index} stays on its sight line`);
    assert.ok(Math.hypot(x - 8, y, z) <= 0.02 + 1e-4, `row ${index} lies within the spheroid's 20 pc reach`);
  }
  assert.ok(placed.maxDistanceKpc > 8 && placed.maxDistanceKpc < 8.02);
  assert.notDeepEqual(placed.points, placeSpheroidRows({ sky, spheroid, id: 'other', at: 'frame.spheroid' }).points, 'the draw is seeded by the bank');
});

test('a placement around an object writes parsecs from the spheroid\'s centre and refuses an origin that is not the centre', () => {
  const origin = [8000 * PC_M, 0, 0];
  const around = placeSpheroidRows({ sky, spheroid, id: 'bank', aroundOriginM: origin, at: 'frame.spheroid' });
  const sunCentred = placeSpheroidRows({ sky, spheroid, id: 'bank', at: 'frame.spheroid' });
  for (const [index, [x = 0, y = 0]] of around.points.entries()) {
    assert.ok(Math.hypot(x, y) <= 20 + 1e-3, `row ${index} lies within 20 pc of the origin`);
    // The same step of the same draw: within one step (0.1 pc) of the Sun-centred placement, which rounds to 0.1 pc.
    assert.ok(Math.abs(x - (sunCentred.points[index]![0]! - 8) * 1000) <= 0.2, `row ${index} keeps its depth step`);
  }
  assert.ok(new Set(around.points.map(([x = 0]) => Math.round(x * 1e4) % 1000)).size > 50, 'depths are not on the steps\' middles');
  assert.throws(() => placeSpheroidRows({ sky, spheroid, id: 'bank', aroundOriginM: [8000.1 * PC_M, 0, 0], at: 'frame.spheroid' }), /frame\.spheroid is centred 0\.1000 pc from the origin/);
});

test('a spheroid needs its numbers, a source and a basis', () => {
  assert.throws(() => parseCatalogueSpheroid({ centerRaDeg: 0 }, 'frame.spheroid'), /needs its fit's numbers, a source and a basis/);
  assert.throws(() => parseCatalogueSpheroid({ centerRaDeg: 0, source: 's', basis: 'b' }, 'frame.spheroid'), /frame\.spheroid\.centerDecDeg must be a finite number/);
});

// A round system 800 kpc away toward +x whose projected density falls as R^-0.8 inside 5 kpc, R^-2.9 to 25 kpc and
// R^-2.4 out to 150 kpc.
const halo = parseCatalogueSpheroid({ centerRaDeg: 0, centerDecDeg: 0, distancePc: 800_000, projectedPowerLaw: { indices: [-0.8, -2.9, -2.4], breaksKpc: [5, 25], endKpc: 150 },
  source: 'two-fits', basis: 'Test power laws.' }, 'frame.spheroid');
const sightLines = (impactKpc: number) => Array.from({ length: 400 }, () => [impactKpc / 800 * 180 / Math.PI, 0] as const);

test('a halo placement keeps each row on its sight line, inside the halo, as deep as it is wide, the same on every run', () => {
  const depths = (impactKpc: number) => {
    const placed = placeSpheroidRows({ sky: sightLines(impactKpc), spheroid: halo, id: 'halo', at: 'frame.spheroid' });
    assert.deepEqual(placed, placeSpheroidRows({ sky: sightLines(impactKpc), spheroid: halo, id: 'halo', at: 'frame.spheroid' }));
    return placed.points.map(([x = 0, y = 0, z = 0]) => {
      assert.ok(Math.abs(Math.atan2(y, x) - impactKpc / 800) < 1e-6 && z === 0, 'the row stays on its sight line');
      assert.ok(Math.hypot(x - 800, y, z) <= 150 + 1e-3, 'the row lies within the halo');
      return Math.abs(x - 800);
    }).sort((a, b) => a - b);
  };
  // The median depth grows with the impact radius: rows near the centre stay near it, rows far out spread far.
  const inner = depths(1)[200]!, middle = depths(15)[200]!, outer = depths(80)[200]!;
  assert.ok(inner < 2 && middle > 2 && middle < 15 && outer > 15 && outer < 80, `median depths ${inner}, ${middle}, ${outer} kpc at 1, 15 and 80 kpc`);
  // A sight line outside the halo stays where it passes closest to the centre.
  const outside = placeSpheroidRows({ sky: [[200 / 800 * 180 / Math.PI, 0]], spheroid: halo, id: 'halo', at: 'frame.spheroid' }).points[0]!;
  assert.ok(Math.abs(Math.hypot(...outside) - 800 * Math.cos(200 / 800)) < 1e-3);
});

test('a halo placement around an object writes parsecs from the centre', () => {
  const around = placeSpheroidRows({ sky: sightLines(10), spheroid: halo, id: 'halo', aroundOriginM: [800_000 * PC_M, 0, 0], at: 'frame.spheroid' });
  const sunCentred = placeSpheroidRows({ sky: sightLines(10), spheroid: halo, id: 'halo', at: 'frame.spheroid' });
  for (const [index, [x = 0, y = 0]] of around.points.entries()) {
    assert.ok(Math.abs(x - (sunCentred.points[index]![0]! - 800) * 1000) <= 0.2 && Math.abs(y - sunCentred.points[index]![1]! * 1000) <= 0.2, `row ${index} is the same place in parsecs`);
  }
});

test('a halo needs falling power laws, their breaks in order and an end', () => {
  const law = (projectedPowerLaw: unknown) => () => parseCatalogueSpheroid({ centerRaDeg: 0, centerDecDeg: 0, distancePc: 8e5, projectedPowerLaw, source: 's', basis: 'b' }, 'frame.spheroid');
  assert.throws(law({ indices: [-1, -2], breaksKpc: [], endKpc: 100 }), /frame\.spheroid\.projectedPowerLaw needs negative indices, one more than its rising breaksKpc.*"breaksKpc":\[\]/);
  assert.throws(law({ indices: [-1, -2], breaksKpc: [30], endKpc: 20 }), /an endKpc beyond the last break/);
  assert.throws(law({ indices: [1], breaksKpc: [], endKpc: 20 }), /needs negative indices/);
});
