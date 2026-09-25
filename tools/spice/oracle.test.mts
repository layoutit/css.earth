import assert from 'node:assert/strict';
import { sourceLoad, sourceTest } from '../../tests/objects/source-test.mts';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadKernelSet } from './kernel-set.mts';
import { utcToEt, etToUtc, encodeClock, clockToEt, etToClock, apply, transpose } from '@cssearth/spice';
import { spiceCamera } from './camera.mts';
import { requireRecord, requireArray, requireString, requireFiniteNumber } from '@cssearth/core';
import { readOracleFixture, assertPinnedInputs, ORACLE_ROOT } from '../oracles/fixture.mts';

/**
 * The SPICE toolkit as the oracle. tools/oracles/spice/dart-draco.py runs
 * SpiceyPy over the same pinned DART kernels and writes what CSPICE computes;
 * this test loads the same kernels through tools/spice/ and compares. The
 * fixture names the toolkit version and the sha256 of every kernel, so the
 * comparison is bound to exact inputs.
 */
const loaded = await sourceLoad(async () => {
  const fixture = await readOracleFixture('spice/dart-draco.json');
  const cases = fixture.cases;
  // The kernels in load order; the cube and label that supplied the intercepts follow them.
  const kernels = fixture.inputs.filter(entry => entry.path.includes('/source/spice/'));
  const numbers = (value: unknown) => requireArray(value).map(v => requireFiniteNumber(v));
  const set = await loadKernelSet(kernels.map(entry => resolve(ORACLE_ROOT, entry.path)));
  const clock = set.clock(-135);
  const close = (a: readonly number[], b: readonly number[], tolerance: number) => a.every((v, i) => Math.abs(v - b[i]) <= tolerance);
  return { fixture, cases, kernels, numbers, set, clock, close };
});
const test = sourceTest(null, loaded);
const { fixture, cases, kernels, numbers, set, clock, close } = loaded.values;
test('the fixture was generated from the pinned kernels by a named SPICE toolkit', async () => {
  assert.equal(fixture.oracle, 'spiceypy');
  assert.match(requireString(fixture.tool.cspice), /^CSPICE_N\d{4}$/);
  await assertPinnedInputs(fixture.inputs);
  assert.equal(kernels.length, 15);
  assert.deepEqual(set.kernels.map(kernel => kernel.path), kernels.map(entry => entry.path), 'the same kernels in the same order');
  assert.equal(fixture.inputs.length, 17, 'fifteen kernels, the cube and its label');
});

test('leap seconds, TDB and the spacecraft clock agree with CSPICE to a microsecond', () => {
  for (const raw of requireArray(cases.times)) {
    const entry = requireRecord(raw), et = requireFiniteNumber(entry.et), utc = requireString(entry.utc);
    assert.ok(Math.abs(utcToEt(set.leapSeconds, utc) - et) < 1e-6, `utc ${utc} -> ${utcToEt(set.leapSeconds, utc)} vs ${et}`);
    // etToUtc rounds to the millisecond: going back through utcToEt must land within half a millisecond of ET.
    assert.ok(Math.abs(utcToEt(set.leapSeconds, etToUtc(set.leapSeconds, et)) - et) < 6e-4, `et ${et} -> ${etToUtc(set.leapSeconds, et)} (CSPICE ${utc})`);
    if (typeof entry.sclk === 'string' && typeof entry.sclkEt === 'number') {
      assert.ok(Math.abs(clockToEt(clock, set.leapSeconds, encodeClock(clock, entry.sclk)) - entry.sclkEt) < 1e-6, `sclk ${entry.sclk}`);
      const ticks = etToClock(clock, set.leapSeconds, et);
      assert.ok(Math.abs(ticks - encodeClock(clock, entry.sclk)) < 1, `et -> sclk ${entry.sclk}: ${ticks} ticks vs ${encodeClock(clock, entry.sclk)}`);
    }
  }
});

test('geometric, light-time and aberrated states agree with CSPICE in J2000 and in the body frame', () => {
  let checked = 0;
  for (const raw of requireArray(cases.states)) {
    const entry = requireRecord(raw), target = requireFiniteNumber(entry.target), observer = requireFiniteNumber(entry.observer), et = requireFiniteNumber(entry.et);
    const correction = requireString(entry.correction), frame = requireString(entry.frame), position = numbers(entry.position), velocity = numbers(entry.velocity);
    let ours: readonly number[], lightTime = 0;
    // Velocities agree to 1e-10 km/s except inside the terminal type 13 segment, whose Hermite evaluation differs from CSPICE by 6e-8 km/s and 3e-8 km.
    if (correction === 'NONE') { const state = set.ephemeris.state(target, observer, et); ours = state.position; if (frame === 'J2000') assert.ok(close(state.velocity, velocity, 1e-7), `velocity of ${target} from ${observer} at ${et}: ${state.velocity} vs ${velocity}`); }
    else { const apparent = set.ephemeris.apparent(target, observer, et, { lightTime: true, stellarAberration: correction.endsWith('+S'), converged: correction.startsWith('CN') }); ours = apparent.position; lightTime = apparent.lightTimeSeconds; }
    // SPICE evaluates a body-fixed output frame at the observer's epoch when the frame is centred on the observer, else at emission.
    const frameCentre = frame === 'DIMORPHOS_FIXED' ? 120065803 : null;
    if (frame !== 'J2000') ours = apply(set.rotation(frame, correction === 'NONE' || frameCentre === observer ? et : et - lightTime), ours);
    assert.ok(close(ours, position, 1e-6), `${correction} position of ${target} from ${observer} in ${frame} at ${et}: ${ours} vs ${position}`);
    if (correction !== 'NONE') assert.ok(Math.abs(lightTime - requireFiniteNumber(entry.lightTime)) < 1e-9, 'light time');
    checked++;
  }
  assert.ok(checked > 60, `${checked} states checked`);
});

test('every frame class in the DART set agrees with CSPICE to a nanoradian', () => {
  let checked = 0;
  for (const raw of requireArray(cases.frames)) {
    const entry = requireRecord(raw), frame = requireString(entry.frame), et = requireFiniteNumber(entry.et), matrix = requireArray(entry.matrix).map(row => numbers(row));
    const ours = set.rotation(frame, et);
    for (let i = 0; i < 3; i++) assert.ok(close(ours[i], matrix[i], 1e-9), `${frame} at ${et} row ${i}: ${ours[i]} vs ${matrix[i]}`);
    checked++;
  }
  assert.ok(checked >= 18, `${checked} frames checked`);
});

test('archived DRACO intercepts appear where CSPICE places them through the DART_DRACO frame with LT+S', () => {
  const exposure = requireRecord(cases.exposure), et = requireFiniteNumber(exposure.et);
  const pixels = { focalLength: { key: 'FOCAL_LENGTH', unit: 'mm' as const }, pixelPitch: { key: 'PIXEL_SIZE', unit: 'micrometre' as const }, center: 'DETECTOR_CENTER', boresight: 'BORESIGHT', samples: 'PIXEL_SAMPLES', lines: 'PIXEL_LINES', frame: 'FOV_FRAME', origin: 0, column: '-X', row: '-Y' };
  const camera = spiceCamera({ pool: set.pool, ephemeris: set.ephemeris, rotation: set.rotation, observer: -135, target: 120065803, bodyFrame: 'DIMORPHOS_FIXED', instrument: -135102, et, aberration: 'LT+S', pixels });
  // Our camera folds one aberration rotation at the target; CSPICE aberrates each point: they agree to a few thousandths of a pixel.
  const f = camera.report.focalLengthPixels, [cx, cy] = camera.report.center;
  let checked = 0, worst = 0;
  for (const raw of requireArray(cases.surface)) {
    const entry = requireRecord(raw), xyz = numbers(entry.xyz), direction = numbers(entry.directionInDraco), pixel = numbers(entry.pixel);
    const spicePixel = [cx + f * (-direction[0] / -direction[2]), cy + f * (-direction[1] / -direction[2])];
    const h = camera.matrix.map(row => row[0] * xyz[0] + row[1] * xyz[1] + row[2] * xyz[2] + row[3]), ours = [h[0] / h[2], h[1] / h[2]];
    const separation = Math.hypot(ours[0] - spicePixel[0], ours[1] - spicePixel[1]);
    worst = Math.max(worst, separation);
    assert.ok(separation < 0.03, `intercept at pixel ${pixel}: ours ${ours} vs CSPICE ${spicePixel}`);
    assert.ok(Math.hypot(spicePixel[0] - pixel[0], spicePixel[1] - pixel[1]) < 1, `CSPICE itself lands the archived intercept within a pixel of ${pixel}`);
    checked++;
  }
  assert.ok(checked >= 20, `${checked} intercepts checked`);
});
