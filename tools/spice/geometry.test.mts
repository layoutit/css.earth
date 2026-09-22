import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { Ephemeris, stelab, SPEED_OF_LIGHT_KM_S } from './geometry.mts';
import type { SpkSegment } from './spk.mts';

const segment = (target: number, center: number, at: (et: number) => number[], start = -1e9, stop = 1e9): SpkSegment =>
  ({ name: `${target}`, target, center, frame: 1, type: 0, start, stop, state: et => { const p = at(et); return { position: [p[0], p[1], p[2]], velocity: [p[3], p[4], p[5]] }; } });

test('states chain through centers and later-loaded segments take precedence', () => {
  const ephemeris = new Ephemeris([
    segment(3, 0, et => [1000, 0, 0, 0, 30, 0]),        // Earth barycenter about the SSB
    segment(399, 3, et => [0, 5, 0, 0, 0, 0]),          // Earth about its barycenter
    segment(-99, 399, et => [10 + et, 0, 0, 1, 0, 0]),  // a spacecraft about Earth
  ]);
  assert.deepEqual(ephemeris.state(-99, 0, 2).position, [1012, 5, 0]);
  assert.deepEqual(ephemeris.state(-99, 3, 2).velocity, [1, 0, 0]);
  ephemeris.load([segment(399, 3, () => [0, 6, 0, 0, 0, 0])]);
  assert.deepEqual(ephemeris.state(399, 3, 0).position, [0, 6, 0], 'the later Earth segment wins');
  assert.throws(() => ephemeris.state(499, 0, 0), /No SPK coverage for body 499/);
  assert.deepEqual(ephemeris.covered(0).sort(), [-99, 3, 399]);
});

test('light time evaluates the target at emission and stellar aberration tilts the direction by v/c', () => {
  const c = SPEED_OF_LIGHT_KM_S;
  const ephemeris = new Ephemeris([
    segment(10, 0, () => [0, 0, 0, 0, 0, 0]),
    segment(-99, 0, () => [0, 0, 0, 0, 30, 0]),               // observer at the origin moving +Y at 30 km/s
    segment(499, 0, et => [c * 100 + et, 0, 0, 1, 0, 0]),     // target 100 light-seconds away, drifting +X at 1 km/s
  ]);
  const geometric = ephemeris.state(499, -99, 0).position;
  assert.equal(geometric[0], c * 100);
  const noAberration = ephemeris.apparent(499, -99, 0, { stellarAberration: false, converged: true });
  // The converged one-way light time solves lt = (100 c - lt) / c, since the target drifts 1 km/s toward the past.
  const lt = 100 / (1 + 1 / c);
  assert.ok(Math.abs(noAberration.lightTimeSeconds - lt) < 1e-9, `light time ${noAberration.lightTimeSeconds}`);
  assert.ok(Math.abs(noAberration.position[0] - (c * 100 - lt)) < 1e-6, 'target seen where it was one light time earlier');
  // SPICE's plain LT takes one iteration from the geometric light time and reports the light time of the corrected position.
  const single = ephemeris.apparent(499, -99, 0, { stellarAberration: false });
  assert.ok(Math.abs(single.position[0] - (c * 100 - 100)) < 1e-6 && Math.abs(single.lightTimeSeconds - (c * 100 - 100) / c) < 1e-12, `one light-time iteration: ${single.position[0]}, ${single.lightTimeSeconds}`);
  const apparent = ephemeris.apparent(499, -99, 0, { converged: true });
  const angle = Math.atan2(apparent.position[1], apparent.position[0]);
  assert.ok(Math.abs(angle - 30 / c) < 1e-9, `aberration angle ${angle} vs ${30 / c}`);
  assert.ok(Math.abs(Math.hypot(...apparent.position) - Math.hypot(...noAberration.position)) < 1e-6, 'length preserved');
  assert.deepEqual(stelab([1, 0, 0], [0, 0, 0]), [1, 0, 0]);
});
