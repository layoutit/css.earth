/** The deposited HD 189733b map (Lally et al. 2025, Zenodo 15103479, output_E.npy): its values, the longitudes ThERESA shows, and
 * whether the map, turned by this package's own orbit and synchronous rotation, fits the deposited MIRI eclipses better than a
 * uniform planet and than its own east-west mirror. Like the authors' ThERESA configuration, the geometry has no light travel time. */
import assert from 'node:assert/strict';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('hd-189733b');
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { BODIES, hostedOrbit, starAstrometry } from '@cssearth/astronomy';
import { readNpyObject } from '../../../../tools/objects/terrestrial-layers/npy-pickle.mts';
import { npyArrayAt, theresaVisibleLongitudes } from '../../../../tools/objects/terrestrial-layers/npy-dictionary-map.mts';
import { mapPhaseCurve, mirrorGrid, type EmissionGrid } from '../../../../tools/objects/eclipse-map/phase-curve.mts';

const deposit = resolve(import.meta.dirname, '../../../../src/objects/hd-189733b/source/science/lally-2025/output_E.npy');
const load = async () => {
  const root = readNpyObject(await readFile(deposit));
  const floats = (name: string) => { const array = npyArrayAt(root, [name]); assert.ok(array.data instanceof Float64Array); return array; };
  const latitudes = new Float64Array(288), longitudes = new Float64Array(288);
  for (let row = 0; row < 12; row++) for (let column = 0; column < 24; column++) { latitudes[row * 24 + column] = -90 + (row + 0.5) * 15; longitudes[row * 24 + column] = -180 + (column + 0.5) * 15; }
  const grid = (name: string): EmissionGrid => { const array = floats(name); assert.deepEqual(array.shape, [12, 24]); return { width: 24, height: 12, values: array.data as Float64Array, latitudes, longitudes }; };
  return { flux: grid('fmap'), temperature: grid('tmap'), time: floats('time').data as Float64Array, data: floats('flux').data as Float64Array, error: floats('ferr').data as Float64Array };
};

test('the deposited map\'s hottest cell, dayside mean and observed longitudes', async () => {
  const { temperature, time } = await load(), orbit = hostedOrbit('hd-189733b');
  let hottest = 0, sum = 0, weight = 0;
  temperature.values.forEach((value, i) => {
    if (value > temperature.values[hottest]!) hottest = i;
    if (Math.abs(temperature.longitudes[i]!) < 90) { const w = Math.cos(temperature.latitudes[i]! * Math.PI / 180); sum += w * value; weight += w; }
  });
  // Lally et al. (2025) report the hot spot 33.0 +0.7/-0.9 degrees east; the grid's cells are 15 degrees.
  assert.deepEqual([temperature.longitudes[hottest], temperature.latitudes[hottest]], [37.5, 7.5]);
  assert.ok(Math.abs(temperature.values[hottest]! - 1334.88) < 0.01);
  assert.ok(Math.abs(sum / weight - 1142.4) < 0.1, `dayside mean ${sum / weight}`);
  // 14,760 and 12,870 MIRI samples and 880 Spitzer samples, against the deposited configuration's t0 and period.
  assert.equal(time.length, 28510);
  const [minimum, maximum] = theresaVisibleLongitudes(time, orbit.transitTimeBmjdTdb, orbit.periodDays);
  assert.ok(Math.abs(minimum + 109.85) < 0.01 && Math.abs(maximum - 179.65) < 0.01, `visible ${minimum}, ${maximum}`);
  const shown = [...Array(24).keys()].filter(column => { const centre = -180 + (column + 0.5) * 15; return centre + 7.5 > minimum && centre - 7.5 < maximum; });
  assert.equal(shown.length * 12, 240);
  const values = temperature.values.filter((_, i) => shown.includes(i % 24));
  assert.ok(Math.abs(Math.min(...values) - 969.59) < 0.01 && Math.abs(Math.max(...values) - 1334.88) < 0.01, 'the lens range 950-1350 K holds every shown cell');
});

/** Weighted least squares per MIRI eclipse: offset, linear trend, an exponential ramp for the first eclipse (its time constant from a
 * grid, as the configuration's linexp baseline), and the map's planet flux with a free scale. */
function eclipseChiSquared(planet: Float64Array, time: Float64Array, data: Float64Array, error: Float64Array) {
  const solve = (a: number[][], b: number[]) => {
    const n = b.length;
    for (let k = 0; k < n; k++) {
      let p = k; for (let i = k + 1; i < n; i++) if (Math.abs(a[i]![k]!) > Math.abs(a[p]![k]!)) p = i;
      [a[k], a[p]] = [a[p]!, a[k]!]; [b[k], b[p]] = [b[p]!, b[k]!];
      for (let i = k + 1; i < n; i++) { const f = a[i]![k]! / a[k]![k]!; for (let j = k; j < n; j++) a[i]![j]! -= f * a[k]![j]!; b[i]! -= f * b[k]!; }
    }
    const x = new Array<number>(n).fill(0);
    for (let i = n - 1; i >= 0; i--) { let s = b[i]!; for (let j = i + 1; j < n; j++) s -= a[i]![j]! * x[j]!; x[i] = s / a[i]![i]!; }
    return x;
  };
  let total = 0, samples = 0;
  for (const [start, end, ramp] of [[59870, 59871, true], [60125, 60127, false]] as const) {
    const index = [...time.keys()].filter(i => time[i]! > start && time[i]! < end), t0 = time[index[0]!]!;
    let best = Infinity;
    for (const tau of ramp ? [0.003, 0.005, 0.01, 0.02, 0.04, 0.08] : [0]) {
      const columns = (i: number) => [1, time[i]! - t0, ...(ramp ? [Math.exp(-(time[i]! - t0) / tau)] : []), planet[i]!];
      const k = columns(index[0]!).length, normal = Array.from({ length: k }, () => new Array<number>(k).fill(0)), rhs = new Array<number>(k).fill(0);
      for (const i of index) { const c = columns(i), w = 1 / error[i]! ** 2; for (let p = 0; p < k; p++) { rhs[p]! += w * c[p]! * data[i]!; for (let q = 0; q < k; q++) normal[p]![q]! += w * c[p]! * c[q]!; } }
      const x = solve(normal, rhs);
      let chi = 0; for (const i of index) chi += ((columns(i).reduce((s, v, j) => s + v * x[j]!, 0) - data[i]!) / error[i]!) ** 2;
      best = Math.min(best, chi);
    }
    total += best; samples += index.length;
  }
  return { chiSquared: total, samples };
}

test('the deposited map fits the deposited MIRI eclipses through the package orbit and rotation better than a uniform planet or its east-west mirror', async () => {
  const { flux, time, data, error } = await load();
  const orbit = hostedOrbit('hd-189733b'), host = starAstrometry('hd-189733'), radiusRatio = BODIES['hd-189733b'].meanRadiusKm / BODIES['hd-189733'].meanRadiusKm;
  const fit = (grid: EmissionGrid) => eclipseChiSquared(mapPhaseCurve(grid, orbit, host, radiusRatio, time), time, data, error);
  const mean = flux.values.reduce((sum, value) => sum + value, 0) / flux.values.length;
  const deposited = fit(flux), eastWest = fit(mirrorGrid(flux, 'longitude')), uniform = fit({ ...flux, values: new Float64Array(flux.values.length).fill(mean) });
  // Measured 2026-09-17 over 27,630 MIRI samples with the deposited errors: 43,415.4 deposited, 44,125.1 uniform, 45,782.7 mirrored.
  assert.equal(deposited.samples, 27630);
  assert.ok(Math.abs(deposited.chiSquared - 43415.4) < 1, `deposited ${deposited.chiSquared}`);
  assert.ok(uniform.chiSquared - deposited.chiSquared > 500, `uniform ${uniform.chiSquared}`);
  assert.ok(eastWest.chiSquared - deposited.chiSquared > 2000, `east-west mirror ${eastWest.chiSquared}`);
});
