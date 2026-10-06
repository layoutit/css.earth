import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { createSelectionFlight, createSelectionFlightSample, sampleSelectionFlight } from './selection-flight.js';
import type { PositionM } from './selection-flight.js';
import { advanceSelectionFlightInto } from './selection-flight-step.js';

const pose = (positionM: PositionM) => ({ positionM, orientationXyzw: [0, 0, 0, 1] as const });
const anchors = [{ positionM: [0, 0, 0] as const, radiusM: 2e6 },
  { positionM: [1e11, 0, 0] as const, radiusM: 6e6 }];
const flight = createSelectionFlight({ from: pose([0, 0, 1.2e7]), to: pose([1e11, 0, 3e7]),
  focusPositionM: anchors[1].positionM });
const distance = (a: PositionM, b: PositionM) => Math.hypot(...a.map((value, axis) => value - b[axis]));
const clearance = (position: PositionM) => Math.min(...anchors.map(anchor =>
  Math.max(anchor.radiusM, distance(position, anchor.positionM) - anchor.radiusM)));

describe('selection flight continuity', () => {
  it('leaves a small body for a far star instead of stalling on its first frame', () => {
    // Itokawa to TRAPPIST-1 (live, 2026-10-01): positions measured from a focus 3.85e17 m away resolve to 64 m, more
    // than the step allowed beside a 165 m body, so no curve time after zero was ever permitted.
    for (const rangeM of [4e16, 3.85e17, 5.2e18]) {
      const body = [2.1e11, 4e10, 1e10] as const, star = [rangeM * .6, rangeM * .7, rangeM * .39] as const;
      const bodies = [{ positionM: body, radiusM: 165 }, { positionM: star, radiusM: 8e7 }];
      const leaving = createSelectionFlight({ from: pose([body[0] + 400, body[1] + 300, body[2] + 100]),
        to: pose([star[0] + 6e8, star[1], star[2]]), focusPositionM: star });
      let elapsed = 0, frames = 0;
      const out = createSelectionFlightSample();
      while (elapsed < leaving.durationS && frames++ < 5000) {
        const next = advanceSelectionFlightInto(leaving, bodies, elapsed, leaving.durationS, out);
        assert.ok(next > elapsed, `stalled at ${elapsed} s of ${leaving.durationS} s, ${rangeM} m from the star`);
        elapsed = next;
      }
      assert.equal(elapsed, leaving.durationS);
      // Capped steps grow the clearance by a quarter each: the whole range is a few hundred frames.
      assert.ok(frames < 400, `${frames} frames`);
    }
  });
  it('leaves a planet for a framing billions of light-years out instead of stalling on its first frame', () => {
    // The Galaxies pill pressed on Saturn's page (live, 2026-10-06), with the poses that flight had: the curve's first
    // sample rounds to 1.2e10 m from the start pose, more than the step's floor, so no time that moved the camera was allowed.
    const saturn = [1390634722841.8352, 245138173773.5476, 41364624140.6779] as const;
    const focus = [-8.593969355465693e+24, -7.047032806046394e+23, -4.348655659863507e+23] as const;
    const orientationXyzw = [0.09627295644801497, 0.5685264563603395, 0.7582765518477641, 0.30418063250801997] as const;
    const leaving = createSelectionFlight({ focusPositionM: focus, durationS: .35,
      from: { positionM: [1390871876228.572, 245525640035.8693, 41526151238.89276], orientationXyzw,
        focusOffset: { originM: saturn, offsetM: [237153386.73682132, 387466262.3216939, 161527098.21485683] } },
      to: { positionM: [1.490196918028024e+25, 3.7683462325854434e+25, 1.5568409039260555e+25], orientationXyzw,
        focusOffset: { originM: focus, offsetM: [2.3495938535745934e+25, 3.8388165606459075e+25, 1.6003274605246906e+25] } } });
    const bodies = [{ positionM: saturn, radiusM: 60268000 }], out = createSelectionFlightSample();
    let elapsed = 0, frames = 0, place: readonly number[] = leaving.from.positionM;
    while (elapsed < leaving.durationS && frames++ < 5000) {
      elapsed = advanceSelectionFlightInto(leaving, bodies, elapsed, leaving.durationS, out);
      assert.ok(out.positionM.some((value, axis) => value !== place[axis]), `held in place at ${elapsed} s of ${leaving.durationS} s`);
      place = [...out.positionM];
    }
    assert.equal(elapsed, leaving.durationS);
    assert.ok(frames < 400, `${frames} frames`);
  });
  it('reaches a small body from galactic range instead of freezing a few thousand kilometres out', () => {
    // Milky Way overview to Bennu: 2.9e21 m departure, 1,469 m arrival around a 245 m body.
    const body = [1.5e11, 0, 0] as const, bodies = [{ positionM: body, radiusM: 245 }];
    const far = createSelectionFlight({ from: pose([0, 0, 2.9e21]), to: pose([1.5e11, 0, 1469]), focusPositionM: body });
    let elapsed = 0, frames = 0;
    const out = createSelectionFlightSample();
    while (elapsed < far.durationS && frames++ < 5000) {
      const next = advanceSelectionFlightInto(far, bodies, elapsed, far.durationS, out);
      assert.ok(next > elapsed);
      elapsed = next;
    }
    assert.equal(elapsed, far.durationS);
    assert.ok(Math.abs(distance(out.positionM, body) - (1469)) < 10 ** -3 / 2, `${distance(out.positionM, body)} is not close to ${1469}`);
  });

  it('leaves a planet for a galactic overview instead of freezing at departure', () => {
    // Earth to the Nearby Universe overview and the Moon to the Milky Way: 1e24 and 3e21 m destinations.
    for (const [startM, radiusM, endM] of [[1.5e7, 6.4e6, 1e24], [8e6, 1.7e6, 2.9e21]] as const) {
      const body = [1.5e11, 0, 0] as const, bodies = [{ positionM: body, radiusM }];
      const out_ = createSelectionFlight({ from: pose([1.5e11, 0, startM]), to: pose([1.5e11, 0, endM]), focusPositionM: body });
      let elapsed = 0, frames = 0;
      const out = createSelectionFlightSample();
      while (elapsed < out_.durationS && frames++ < 5000) {
        const next = advanceSelectionFlightInto(out_, bodies, elapsed, out_.durationS, out);
        assert.ok(next > elapsed);
        elapsed = next;
      }
      assert.equal(elapsed, out_.durationS);
    }
  });


  it('bounds default departure movement even after a delayed paint, retaining the original curve', () => {
    assert.ok(distance(sampleSelectionFlight(flight, 1 / 60).positionM, flight.from.positionM) > 1e9);
    for (const requested of [1 / 60, 30]) {
      const out = createSelectionFlightSample();
      const elapsed = advanceSelectionFlightInto(flight, anchors, 0, requested, out);
      assert.ok(elapsed > 0);
      assert.ok(elapsed < 1 / 60);
      assert.ok(distance(out.positionM, flight.from.positionM) <= (10 ** .1 - 1) * Math.min(clearance(flight.from.positionM), clearance(out.positionM)));
      assert.deepEqual(out, sampleSelectionFlight(flight, elapsed));
    }
  });

  it('continues monotonically through ownership changes to the exact endpoint without a catch-up jump', () => {
    let elapsed = 0, previous = flight.from.positionM, frames = 0;
    let out = createSelectionFlightSample();
    while (elapsed < flight.durationS && frames++ < 1000) {
      if (frames === 30) out = createSelectionFlightSample(); // Incoming owner has its own scratch buffer.
      const next = advanceSelectionFlightInto(flight, anchors, elapsed, flight.durationS, out);
      assert.ok(next > elapsed);
      assert.deepEqual(out, sampleSelectionFlight(flight, next));
      assert.ok(distance(out.positionM, previous) <= (10 ** .1 - 1) * Math.min(clearance(previous), clearance(out.positionM)) + 1e-5);
      previous = [...out.positionM]; elapsed = next;
    }
    assert.ok(frames > 30);
    assert.ok(frames < 1000);
    assert.deepEqual(out.positionM, flight.to.positionM);
    assert.equal(out.complete, true);
  });

  it('does not stall on a source surface or when the path crosses its centre', () => {
    const short = createSelectionFlight({ from: pose([10, 0, 0]), to: pose([100, 0, 0]), focusPositionM: [110, 0, 0] });
    const bodies = [{ positionM: [20, 0, 0] as const, radiusM: 10 }];
    const out = createSelectionFlightSample();
    let elapsed = 0, frames = 0;
    while (elapsed < short.durationS && frames++ < 100) {
      elapsed = advanceSelectionFlightInto(short, bodies, elapsed, short.durationS, out);
    }
    assert.deepEqual(out.positionM, short.to.positionM);
    assert.ok(frames < 100);
  });

  it('rejects invalid external anchors and time ordering', () => {
    const out = createSelectionFlightSample();
    assert.throws(() => advanceSelectionFlightInto(flight, [], 0, 1, out), TypeError);
    assert.throws(() => advanceSelectionFlightInto(flight, [{ positionM: [0, 0, NaN], radiusM: 1 }], 0, 1, out), TypeError);
    assert.throws(() => advanceSelectionFlightInto(flight, [{ positionM: [0, 0, 0], radiusM: 0 }], 0, 1, out), TypeError);
    assert.throws(() => advanceSelectionFlightInto(flight, anchors, 1, .5, out), TypeError);
    assert.throws(() => advanceSelectionFlightInto(flight, anchors, 0, Infinity, out), TypeError);
  });
});
