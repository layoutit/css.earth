// The outer-ejecta stages' own numerical helpers, against NumPy 2.5.4 and Astropy 8.0.1 values computed once (literals).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { npRound } from './cloud-points.mts';
import { leastSquares3 } from './hubble-epochs.mts';
import { lineFit, roundHalfEven } from './hubble-motions.mts';
import { knotDepth, spectrumPeaks, tileOf, isClean } from './knots.mts';
import { tubeRecord } from './records.mts';
import { gridProjection, ICRS_TO_FK5, rotateDirection } from './sky-grid.mts';
import { centreline, frame, radius, tubeResiduals } from './tube.mts';

const close = (a: number, b: number, tolerance: number, what: string) => assert.ok(Math.abs(a - b) <= tolerance, `${what}: ${a} vs ${b}`);

test('numpy.round and Python round() halve to even, after numpy scales by the power of ten', () => {
  const cases: [number, number, number][] = [[2.675, 2, 2.68], [0.5, 0, 0], [1.5, 0, 2], [-2.5, 0, -2], [0.0005, 3, 0], [1.0005, 3, 1], [123.4565, 3, 123.456]];
  for (const [x, d, want] of cases) assert.equal(npRound(x, d), want, `npRound(${x}, ${d})`);
  assert.ok(Object.is(npRound(-0.5, 0), -0));
  assert.deepEqual([0.5, 1.5, 2.5, -0.5, 2.4999].map(roundHalfEven), [0, 2, 2, 0, 2]);
});

test('lineFit is numpy.polyfit(x, y, 1) and leastSquares3 recovers an exact affine', () => {
  const [slope, intercept] = lineFit([-20.6, 0, 5.53, 3.97, -9.05], [1.2, 0, -0.4, 0.1, 0.9]);
  close(slope, -0.05817991437416819, 1e-15, 'slope'); close(intercept, 0.12553494507210217, 1e-15, 'intercept');
  const P = [[10, 20], [300, 40], [55, 900], [700, 650], [1200, 30]] as const, c = [0.9999, 2e-4, -1.37];
  const fitted = leastSquares3(P.map(([y, x]) => [y, x, 1] as [number, number, number]), P.map(([y, x]) => c[0]! * y + c[1]! * x + c[2]!));
  fitted.forEach((value, i) => close(value, c[i]!, 1e-11, `coefficient ${i}`));
});

test('the grid and the ICRS-to-FK5 bias are where Astropy puts them', () => {
  const grid = gridProjection(), want: [number, number, number, number][] = [[0, 0, 161.30055092944352, -59.70247474529006], [2599, 100, 161.22900055446004, -59.70108585679934], [1300, 1300, 161.2647612421497, -59.68442405555483]];
  for (const [x, y, ra, dec] of want) { const [r, d] = grid.skyOf(x, y); close(r, ra, 1e-11, 'ra'); close(d, dec, 1e-11, 'dec'); }
  const [ra, dec] = rotateDirection(ICRS_TO_FK5, 161.264775, -59.684431);
  close(ra, 161.2647889253948, 1e-11, 'FK5 ra'); close(dec, -59.68443516933367, 1e-11, 'FK5 dec');
  const [back, backDec] = rotateDirection(ICRS_TO_FK5, ra, dec, true); close(back, 161.264775, 1e-12, 'round trip'); close(backDec, -59.684431, 1e-12, 'round trip');
});

test('a knot moving straight out has depth / rho = v_los / v_tan, and only clean outward tiles count', () => {
  assert.equal(knotDepth(10, 300, 600), 5); assert.equal(knotDepth(10, -600, 300), -20);
  // A tile 30 pixels east of the star moving east (x decreasing) at 0.1 pixel a year: radial, sigma and rms small.
  const outward = tileOf([1270, 1300, -0.1, 0, 0.01, 8, 20, 0.5]), inward = tileOf([1270, 1300, 0.1, 0, 0.01, 8, 20, 0.5]), noisy = tileOf([1270, 1300, -0.1, 0, 0.2, 8, 20, 0.5]);
  close(outward.east, 1.5, 1e-12, 'east'); close(outward.muEast, 0.005, 1e-15, 'mu east'); close(outward.radial, 1, 1e-12, 'radial');
  assert.deepEqual([outward, inward, noisy].map(isClean), [true, false, false]);
});

test('spectrum peaks: above the channel before, at least the one after, over the level, 230 to 3200 km/s either way; the ends are neighbours', () => {
  const v = [-4000, -3000, -1000, -200, 0, 200, 500, 1000, 3100, 3500], sm = [9, 1, 5, 9, 1, 1, 7, 7, 4, 1];
  // -4000 is a maximum but outside the speeds; -1000 rises into -200 (not a peak); -200 is under 230; 500 ties 1000 (>= after) and counts; 1000 is not above 500.
  assert.deepEqual(spectrumPeaks(sm, v, 2), [6]);
  // Channel 0's neighbour before it is the last channel (2), so it is no peak; 3, 5 and 9 are under 230 km/s or over 3200.
  assert.deepEqual(spectrumPeaks([1, 2, 1, 5, 1, 3, 1, 1, 1, 2], v, 0), [1]);
  assert.deepEqual(spectrumPeaks([3, 2, 1, 5, 1, 3, 1, 1, 1, 2], [500, ...v.slice(1)], 0), [0]);
  assert.deepEqual(spectrumPeaks([3, 2, 1, 5, 1, 3, 1, 1, 1, 4], [500, ...v.slice(1)], 0), []);   // the last channel is above the first
  assert.deepEqual(spectrumPeaks(sm, v, 7), []);
});

test('a straight tube: its frame is orthonormal, a point on its wall has no residual, and traced cells are unique and sorted', () => {
  const rad = Math.PI / 180, q = [310 * rad, 41 * rad, 0, 0, 1, -2, 0.5, 10, 16], { a, u, w } = frame(q[0]!, q[1]!);
  const dot = (x: number[], y: number[]) => x[0]! * y[0]! + x[1]! * y[1]! + x[2]! * y[2]!;
  for (const [x, y, want] of [[a, a, 1], [u, u, 1], [w, w, 1], [a, u, 0], [a, w, 0], [u, w, 0]] as const) close(dot(x, y), want, 1e-15, 'frame');
  assert.equal(radius(q, -15), 10); assert.equal(radius(q, 15), 16); assert.equal(radius(q, 0), 13); assert.equal(radius(q, -40), 10);
  const C = centreline(q), at = 120;   // the sample at s = 0
  const onWall = [0, 1, 2].map(i => C[at]![i]! + 13 * u[i]!), outside = [0, 1, 2].map(i => C[at]![i]! + 17 * w[i]!);
  const res = tubeResiduals(q, Float64Array.from([...onWall, ...outside]), Float64Array.from([1, 2]));
  close(res[0]!, 0, 1e-12, 'on the wall'); close(res[1]!, 8, 1e-12, "four arcsec out, weight 2");
  const record = tubeRecord(q, Float64Array.from([...onWall, ...onWall, ...outside]), 'test') as { traced: { value: bigint }[][]; centreline: number[][]; radius: number[] };
  assert.equal(record.traced.length, 1); assert.equal(record.centreline.length, 181); assert.equal(record.radius.length, 181);
  assert.deepEqual(record.traced[0]!.map(cell => Number(cell.value)), onWall.map(value => npRound(value, 0)));
});
