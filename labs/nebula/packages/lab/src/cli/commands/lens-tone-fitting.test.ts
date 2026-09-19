import test from 'node:test';
import assert from 'node:assert/strict';
import { composeToneCurve, coreDisc, fitCorrection, highlightExposureBound, identityToneCurve, monotone, pairedPixels, reexposeProjection, solveExposure,
  splitFootprint, toneScore, TOLERANCE } from './lens-tone-fitting.ts';
import { lensLevelStatistics } from '../../server/services/lens-levels.ts';

test('monotone pooling never lets a bright bin map below a fainter one', () => {
  assert.deepEqual(monotone([1, 3, 2, 4], [1, 1, 1, 1]), [1, 2.5, 2.5, 4]);
  assert.deepEqual(monotone([5, 1], [3, 1]), [4, 4]);
});

test('the footprint splits into two disjoint checkerboard halves', () => {
  const mask = new Uint8Array(64 * 64).fill(1), { fit, heldOut } = splitFootprint(mask, 64, 64);
  assert.ok(fit.every((v, i) => v + heldOut[i]! === 1));
  assert.equal(fit.reduce((a, b) => a + b, 0), 64 * 32);
});

test('one fit step from paired pixels moves a mid-tone bend back onto the target and held-out follows', () => {
  // A neutral synthetic lens whose render is the source bent by a gamma: bright mid-tones, matched ends.
  const width = 64, height = 64, n = width * height, projection = new Uint8Array(n), source = new Float64Array(n * 3), mask = new Uint8Array(n).fill(1);
  for (let p = 0; p < n; p++) {
    // The first eighth is empty sky, so the 5% sky pedestal is zero and the bend is the only mismatch.
    const x = p % width, s = x < 8 ? 0 : 10 + 240 * (x - 8) / (width - 9);
    projection[p] = Math.round(255 * Math.pow(s / 255, .8));
    for (let c = 0; c < 3; c++) source[p * 3 + c] = s;
  }
  const grid = { width, height, projection, source, mask }, halves = splitFootprint(mask, width, height);
  const none = { channelGain: null, toneCurve: null };
  const before = lensLevelStatistics({ ...grid, mask: halves.heldOut }, none);
  const pairs = pairedPixels(grid, none, halves.fit, 1);
  const { curve, pinned } = composeToneCurve(identityToneCurve(), pairs.map(fitCorrection));
  assert.deepEqual(pinned, [[], [], []]);
  const after = lensLevelStatistics({ ...grid, mask: halves.heldOut }, { channelGain: null, toneCurve: curve });
  const err = (s: typeof before) => Math.max(...s.channels.map(c => Math.abs(c.p50Ratio - 1)));
  assert.ok(err(after) < err(before) / 3, `held-out p50 error ${err(before).toFixed(3)} → ${err(after).toFixed(3)}`);
  assert.ok(curve.channels.every(ch => ch.every((v, i) => i === 0 || v >= ch[i - 1]!)), 'monotone');
});

/** A neutral radial nebula: exposure-free integral I(r) with a bright core; the first eighth of columns is empty sky. */
function radialLens(width = 96, height = 96, exposure = 1) {
  const n = width * height, integral = new Float64Array(n), mask = new Uint8Array(n).fill(1);
  for (let p = 0; p < n; p++) {
    const x = p % width, y = Math.floor(p / width), r2 = (x - 52) ** 2 + (y - 48) ** 2;
    integral[p] = x < 8 ? 0 : .05 + 2 * Math.exp(-r2 / (2 * 18 ** 2));
  }
  const projection = Uint8Array.from(integral, v => Math.round(255 * (1 - Math.exp(-exposure * v))));
  return { width, height, mask, integral, projection };
}

test('the objective sees a core that plateaus even when p50 and p90 match', () => {
  // The render rides the opacity shoulder above the brightest ~4%, while the image keeps rising there — the LMC defect.
  const { width, height, mask, projection } = radialLens(), n = width * height, source = new Float64Array(n * 3), matched = new Float64Array(n * 3);
  const knee = [...projection].sort((a, b) => a - b)[Math.floor(n * .96)]!;
  for (let p = 0; p < n; p++) for (let c = 0; c < 3; c++) {
    const v = projection[p]!;
    source[p * 3 + c] = v <= knee ? v : Math.min(255, knee + (v - knee) * 4); matched[p * 3 + c] = v;
  }
  const grid = { width, height, projection, source, mask }, none = { channelGain: null, toneCurve: null }, core = coreDisc(grid);
  const score = toneScore(grid, none, mask, 1, core);
  for (const ch of score.channels) {
    assert.ok(Math.abs(ch.p50 - 1) <= TOLERANCE.ratio && Math.abs(ch.p90 - 1) <= TOLERANCE.ratio, `mid-tones match (${ch.p50}, ${ch.p90})`);
    assert.ok(ch.p999 < 1 - TOLERANCE.peakRatio, `p99.9 reads the plateau (${ch.p999})`);
  }
  assert.equal(score.inside, false, 'a plateaued core is not a match');
  assert.match(score.worst, /p99|core/);
  // The same lens against an image without the rise is inside: the terms flag the highlights, not the lens.
  assert.equal(toneScore({ ...grid, source: matched }, none, mask, 1, core).inside, true);
});

test('re-exposure from the byte recovers the projection at another exposure', () => {
  const at1 = radialLens(96, 96, 1), at2 = radialLens(96, 96, 2.2), again = reexposeProjection(at1.projection, 2.2);
  let worst = 0;
  for (let p = 0; p < again.length; p++) if (at1.projection[p]! < 250) worst = Math.max(worst, Math.abs(again[p]! - at2.projection[p]!));
  assert.ok(worst <= 3, `byte re-exposure within quantisation (${worst})`);
});

test('exposure is solved jointly with the curve when the core rides the opacity shoulder', () => {
  // Projected at exposure 1; the image wants the look of exposure 3 at 99% — its core sits above what
  // opacity 1 can carry, so only more exposure (and a curve that dims the mid-tones back) reaches it.
  const { width, height, mask, integral, projection } = radialLens(), n = width * height, source = new Float64Array(n * 3);
  for (let p = 0; p < n; p++) for (let c = 0; c < 3; c++) source[p * 3 + c] = .99 * 255 * (1 - Math.exp(-3 * integral[p]!));
  const grid = { width, height, projection, source, mask }, halves = splitFootprint(mask, width, height), core = coreDisc(grid);
  const before = toneScore(grid, { channelGain: null, toneCurve: null }, mask, 1, core);
  const bound = highlightExposureBound(grid, 1), solved = solveExposure(grid, null, halves, 1, core, .5, 4);
  assert.ok(bound > 1.25, `the highlights need more exposure (${bound})`);
  assert.ok(solved.k > 1.25, `solved ratio ${solved.k}`);
  assert.ok(solved.full.score < before.score / 3, `score ${before.score} → ${solved.full.score}`);
  assert.ok(solved.heldOut.score < before.score / 3, `held-out follows (${solved.heldOut.score})`);
  assert.ok(solved.full.channels.every(ch => Math.abs(ch.p99 - 1) <= TOLERANCE.highlightRatio && Math.abs(ch.core - 1) <= TOLERANCE.coreRatio), JSON.stringify(solved.full.channels));
  assert.ok(solved.curve.channels.every(ch => ch.every((v, i) => i === 0 || v >= ch[i - 1]!)), 'monotone');
});
