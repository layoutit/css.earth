/** From raw JWST exposures to an eclipse map: HD 189733b's two MIRI eclipses (program 2021, observations 002 and 011), reduced from
 * raw by tools/objects/jwst/reduce-tso.mts, fitted here with Lally et al. (2025)'s model and compared with the map they deposited
 * (Zenodo 15103479, output_E.npy). The run's outputs are ignored files, so the test runs where they are present.
 *
 * The model follows their ThERESA configuration, MIRI only: degree 5 with 3 eigencurves and positive emission; eclipse 1 clipped
 * before MJD 59870.774302437036 with a linear baseline, an exponential ramp and decorrelation vectors (ours: the trace's centroid and
 * width), eclipse 2 clipped before 60125.93127846887 with a linear baseline; their planet (t0 59838.6863112, period 2.21857567 d,
 * radius 0.116795376 solar radii around a 0.752 solar-radius star, 0.030994811518716577 au, inclination 85.71 degrees). The ramp's
 * timescale is chosen from a grid by chi-squared, since the fit is linear. Each eclipse's errors are scaled to its point-to-point
 * scatter, because Eureka! 1.4's error estimate (227 ppm) is below our measured scatter (352 ppm); the deposit's errors need
 * a factor of 0.95 to 0.99. Their map also fits Spitzer, so the comparison is on shape and position, not exact values. */
import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HostedOrbit } from '@cssearth/astronomy';
import { continuousHotspot, eigenBasis, equalAngleGrid, evaluateFit, fitEigenmap } from './eigenmap-fit.mts';

const repository = resolve(import.meta.dirname, '../../..');
const run = (observation: string) => resolve(repository, `output/jwst/hd-189733b-miri-2021-${observation}/light-curves`);
const orbit: HostedOrbit = {
  periodDays: 2.21857567, semiMajorAxisStellarRadii: 0.030994811518716577 * 215.032155 / 0.752, inclinationDegrees: 85.71, eccentricity: 0,
  transitTimeBmjdTdb: 59838.6863112, ascendingNodePositionAngleDegrees: 0,
  sources: { period: 'Lally et al. 2025', shape: 'Lally et al. 2025', phase: 'Lally et al. 2025', orientation: 'not used: disc-integrated flux does not depend on it' },
};
const HOST = { rightAscensionDegrees: 300.18212, declinationDegrees: 22.70974 }, RADIUS_RATIO = 0.116795376 / 0.752;
const CLIPS = [59870.774302437036, 60125.93127846887] as const;

/** time, flux, err and decorrelation vectors of one eclipse, clipped, with errors scaled to the eclipse's point-to-point scatter. */
async function eclipse(path: string, clip: number, vectors: readonly string[]) {
  const [header, ...lines] = (await readFile(path, 'utf8')).trim().split('\n');
  const names = header!.split(','), column = (name: string) => names.indexOf(name);
  const rows = lines.map(line => line.split(',').map(Number)).filter(row => Number.isFinite(row[column('flux')]!) && !row[column('mask')] && row[column('time')]! >= clip);
  const flux = rows.map(row => row[column('flux')]!), steps = flux.slice(1).map((value, i) => value - flux[i]!);
  const mean = steps.reduce((sum, value) => sum + value, 0) / steps.length;
  const scatter = Math.sqrt(steps.reduce((sum, value) => sum + (value - mean) ** 2, 0) / steps.length) / Math.SQRT2;
  const errors = rows.map(row => row[column('err')]!).sort((a, b) => a - b), scale = scatter / errors[errors.length >> 1]!;
  return { time: rows.map(row => row[column('time')]!), flux, err: rows.map(row => row[column('err')]! * scale), vectors: vectors.map(name => rows.map(row => row[column(name)]!)) };
}

async function fitMap(first: Awaited<ReturnType<typeof eclipse>>, second: Awaited<ReturnType<typeof eclipse>>) {
  const time = Float64Array.from([...first.time, ...second.time]), data = Float64Array.from([...first.flux, ...second.flux]), error = Float64Array.from([...first.err, ...second.err]);
  const n1 = first.time.length, n = time.length, grid = equalAngleGrid(45, 90), basis = eigenBasis(5, grid, orbit, HOST, RADIUS_RATIO, time);
  const median = (values: number[]) => [...values].sort((a, b) => a - b)[values.length >> 1]!;
  const columns = (tauDays: number) => {
    const inFirst = (build: (i: number) => number) => Float64Array.from({ length: n }, (_, i) => (i < n1 ? build(i) : 0));
    const inSecond = (build: (i: number) => number) => Float64Array.from({ length: n }, (_, i) => (i >= n1 ? build(i - n1) : 0));
    const mid1 = (first.time[0]! + first.time.at(-1)!) / 2, mid2 = (second.time[0]! + second.time.at(-1)!) / 2;
    // The model's stellar term is eclipse 1's offset; eclipse 2 gets its own.
    return [
      inFirst(i => first.time[i]! - mid1), inFirst(i => Math.exp(-(first.time[i]! - first.time[0]!) / tauDays)),
      ...first.vectors.map(vector => { const m = median(vector); return inFirst(i => vector[i]! - m); }),
      inSecond(() => 1), inSecond(i => second.time[i]! - mid2),
    ];
  };
  let best: { tau: number; fit: ReturnType<typeof fitEigenmap> } | undefined;
  for (const minutes of [5, 10, 20, 40, 80]) {
    const fit = fitEigenmap(basis, 3, data, error, () => true, { systematics: columns(minutes / 1440) });
    if (!best || fit.chiSquared < best.fit.chiSquared) best = { tau: minutes, fit };
  }
  return { ...best!, grid, map: evaluateFit(basis, best!.fit, grid.latitudes, grid.longitudes), hotspot: continuousHotspot(basis, best!.fit, 0.5) };
}

/** Correlation with the deposited 12 x 24 flux map over its dayside cells (longitude within 90 degrees of the substellar point),
 * and the deposited map's brightest dayside cell. ThERESA grids run south to north and west to east from -180 degrees. */
function compareWithDeposit(fitted: Awaited<ReturnType<typeof fitMap>>, deposit: number[][]) {
  const ours: number[] = [], theirs: number[] = [];
  let peak = { value: -Infinity, latitude: 0, longitude: 0 };
  deposit.forEach((row, r) => row.forEach((value, c) => {
    const latitude = -90 + (r + 0.5) * 180 / deposit.length, longitude = -180 + (c + 0.5) * 360 / row.length;
    if (Math.abs(longitude) >= 90) return;
    const gr = Math.min(fitted.grid.height - 1, Math.floor((latitude + 90) / 180 * fitted.grid.height)), gc = Math.min(fitted.grid.width - 1, Math.floor((longitude + 180) / 360 * fitted.grid.width));
    ours.push(fitted.map[gr * fitted.grid.width + gc]!); theirs.push(value);
    if (value > peak.value) peak = { value, latitude, longitude };
  }));
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length, ma = mean(ours), mb = mean(theirs);
  const correlation = ours.reduce((sum, value, i) => sum + (value - ma) * (theirs[i]! - mb), 0) / Math.sqrt(ours.reduce((sum, value) => sum + (value - ma) ** 2, 0) * theirs.reduce((sum, value) => sum + (value - mb) ** 2, 0));
  return { correlation, peak };
}

test('a map fitted to HD 189733b\'s two MIRI eclipses reduced from raw reproduces Lally et al. (2025)\'s deposited map', async context => {
  const paths = [resolve(run('002'), 'ours-white.csv'), resolve(run('011'), 'ours-white.csv'), resolve(run('002'), 'author-map.json'), resolve(run('002'), 'author-white.csv'), resolve(run('011'), 'author-white.csv')];
  if (!(await Promise.all(paths.map(path => access(path).then(() => true, () => false)))).every(Boolean)) {
    context.skip('reduce programs hd-189733b-miri-2021-002 and -011 with tools/objects/jwst/reduce-tso.mts to cover this');
    return;
  }
  const deposit = (JSON.parse(await readFile(paths[2]!, 'utf8')) as { fmap: number[][] }).fmap;
  const raw = await fitMap(await eclipse(paths[0]!, CLIPS[0], ['centroid_y', 'psf_width_y']), await eclipse(paths[1]!, CLIPS[1], []));
  const author = await fitMap(await eclipse(paths[3]!, CLIPS[0], ['d1', 'd2', 'd3']), await eclipse(paths[4]!, CLIPS[1], []));
  const rawMatch = compareWithDeposit(raw, deposit), authorMatch = compareWithDeposit(author, deposit);
  for (const [name, fitted, match] of [['raw', raw, rawMatch], ['their curves', author, authorMatch]] as const) {
    context.diagnostic(`${name}: reduced chi2 ${(fitted.fit.chiSquared / fitted.fit.samples).toFixed(3)}, ramp ${fitted.tau} min, hot spot ${fitted.hotspot.longitude.toFixed(1)} E ${fitted.hotspot.latitude.toFixed(1)} N, dayside correlation ${match.correlation.toFixed(3)}`);
  }
  // Measured 2026-09-17. From raw: reduced chi-squared 1.061, hot spot 41.3 E 7.3 N, correlation 0.938. From their curves: 1.052,
  // 44.0 E 6.0 N, 0.898. Their map's brightest cell is centred at 37.5 E 7.5 N (15-degree cells); the paper gives 33.0 E.
  assert.ok(raw.fit.positive && raw.fit.chiSquared / raw.fit.samples < 1.2, 'the raw eclipses fit to within their scatter');
  assert.ok(rawMatch.correlation >= 0.9, `dayside correlation ${rawMatch.correlation}`);
  assert.ok(rawMatch.correlation >= authorMatch.correlation - 0.05, 'the map from raw matches the deposit about as well as a fit to the deposited curves does');
  assert.ok(Math.abs(raw.hotspot.longitude - rawMatch.peak.longitude) <= 7.5 && Math.abs(raw.hotspot.latitude - rawMatch.peak.latitude) <= 7.5,
    `hot spot ${raw.hotspot.longitude.toFixed(1)} E ${raw.hotspot.latitude.toFixed(1)} N lies in the deposited map's brightest cell (${rawMatch.peak.longitude} E ${rawMatch.peak.latitude} N)`);
});
