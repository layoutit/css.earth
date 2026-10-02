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
