import { describe, expect, it } from 'vitest';
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
  it('reaches a small body from galactic range instead of freezing a few thousand kilometres out', () => {
    // Milky Way overview to Bennu: 2.9e21 m departure, 1,469 m arrival around a 245 m body.
    const body = [1.5e11, 0, 0] as const, bodies = [{ positionM: body, radiusM: 245 }];
    const far = createSelectionFlight({ from: pose([0, 0, 2.9e21]), to: pose([1.5e11, 0, 1469]), focusPositionM: body });
    let elapsed = 0, frames = 0;
    const out = createSelectionFlightSample();
    while (elapsed < far.durationS && frames++ < 5000) {
      const next = advanceSelectionFlightInto(far, bodies, elapsed, far.durationS, out);
      expect(next).toBeGreaterThan(elapsed);
      elapsed = next;
    }
    expect(elapsed).toBe(far.durationS);
    expect(distance(out.positionM, body)).toBeCloseTo(1469, 3);
  });


  it('bounds default departure movement even after a delayed paint, retaining the original curve', () => {
    expect(distance(sampleSelectionFlight(flight, 1 / 60).positionM, flight.from.positionM)).toBeGreaterThan(1e9);
    for (const requested of [1 / 60, 30]) {
      const out = createSelectionFlightSample();
      const elapsed = advanceSelectionFlightInto(flight, anchors, 0, requested, out);
      expect(elapsed).toBeGreaterThan(0);
      expect(elapsed).toBeLessThan(1 / 60);
      expect(distance(out.positionM, flight.from.positionM)).toBeLessThanOrEqual(
        (10 ** .1 - 1) * Math.min(clearance(flight.from.positionM), clearance(out.positionM)));
      expect(out).toEqual(sampleSelectionFlight(flight, elapsed));
    }
  });

  it('continues monotonically through ownership changes to the exact endpoint without a catch-up jump', () => {
    let elapsed = 0, previous = flight.from.positionM, frames = 0;
    let out = createSelectionFlightSample();
    while (elapsed < flight.durationS && frames++ < 1000) {
      if (frames === 30) out = createSelectionFlightSample(); // Incoming owner has its own scratch buffer.
      const next = advanceSelectionFlightInto(flight, anchors, elapsed, flight.durationS, out);
      expect(next).toBeGreaterThan(elapsed);
      expect(out).toEqual(sampleSelectionFlight(flight, next));
      expect(distance(out.positionM, previous)).toBeLessThanOrEqual(
        (10 ** .1 - 1) * Math.min(clearance(previous), clearance(out.positionM)) + 1e-5);
      previous = [...out.positionM]; elapsed = next;
    }
    expect(frames).toBeGreaterThan(30);
    expect(frames).toBeLessThan(1000);
    expect(out.positionM).toEqual(flight.to.positionM);
    expect(out.complete).toBe(true);
  });

  it('does not stall on a source surface or when the path crosses its centre', () => {
    const short = createSelectionFlight({ from: pose([10, 0, 0]), to: pose([100, 0, 0]), focusPositionM: [110, 0, 0] });
    const bodies = [{ positionM: [20, 0, 0] as const, radiusM: 10 }];
    const out = createSelectionFlightSample();
    let elapsed = 0, frames = 0;
    while (elapsed < short.durationS && frames++ < 100) {
      elapsed = advanceSelectionFlightInto(short, bodies, elapsed, short.durationS, out);
    }
    expect(out.positionM).toEqual(short.to.positionM);
    expect(frames).toBeLessThan(100);
  });

  it('rejects invalid external anchors and time ordering', () => {
    const out = createSelectionFlightSample();
    expect(() => advanceSelectionFlightInto(flight, [], 0, 1, out)).toThrow(TypeError);
    expect(() => advanceSelectionFlightInto(flight, [{ positionM: [0, 0, NaN], radiusM: 1 }], 0, 1, out)).toThrow(TypeError);
    expect(() => advanceSelectionFlightInto(flight, [{ positionM: [0, 0, 0], radiusM: 0 }], 0, 1, out)).toThrow(TypeError);
    expect(() => advanceSelectionFlightInto(flight, anchors, 1, .5, out)).toThrow(TypeError);
    expect(() => advanceSelectionFlightInto(flight, anchors, 0, Infinity, out)).toThrow(TypeError);
  });
});
