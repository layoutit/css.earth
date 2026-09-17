import assert from 'node:assert/strict';
import { test } from 'node:test';
import { access, readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { compareLightCurves, parseLightCurve, type LightCurve } from './compare-light-curves.mts';
import { readProgram, renderSettings } from './reduce-tso.mts';

const repository = resolve(import.meta.dirname, '../../..');
const program = resolve(import.meta.dirname, 'programs/wasp-43b-miri-1366');

test('the WASP-43b MIRI program pins 30 raw segments, its CRDS context, its control files and the Bell et al. deposit', async () => {
  const pinned = await readProgram(program);
  assert.equal(pinned.segments.length, 30);
  assert.equal(pinned.segments.reduce((sum, segment) => sum + segment.bytes, 0), 44_168_699_520);
  // Three exposures of the visit, each split into ten segments.
  assert.deepEqual(pinned.segments.map(segment => /_(\d{5})-seg(\d{3})_/u.exec(segment.name)!.slice(1).join('/')), ['00001', '00002', '00003'].flatMap(exposure => Array.from({ length: 10 }, (_, i) => `${exposure}/${String(i + 1).padStart(3, '0')}`)));
  assert.equal(pinned.crdsContext, 'jwst_1535.pmap');
  assert.match(pinned.oracle.sha256, /^[0-9a-f]{64}$/u);
  for (const template of Object.values(pinned.stages)) {
    const text = await readFile(resolve(program, template), 'utf8');
    assert.doesNotMatch(text, /\/Users\//u, `${template} carries no local path`);
    assert.match(text, /^topdir\s+WORK_DIRECTORY\//mu);
  }
  // One worker: two Stage 1 processes or a multi-core ramp fit would not fit in memory.
  assert.match(await readFile(resolve(program, pinned.stages.S1), 'utf8'), /^maximum_cores\s+'none'/mu);
});

test('rendering a control file sets its directories and keeps every other line', () => {
  const template = "# comment\ntopdir   WORK_DIRECTORY/\ninputdir  Stage2   # where from\noutputdir Stage3\nncpu 1\n";
  const rendered = renderSettings(template, { topdir: '/work/', inputdir: 'Stage2_all', outputdir: 'Stage3' });
  assert.equal(rendered, "# comment\ntopdir   /work/  \ninputdir  Stage2_all  # where from\noutputdir Stage3  \nncpu 1\n");
  assert.throws(() => renderSettings('ncpu 1\n', { topdir: '/w/', inputdir: 'a', outputdir: 'b' }), /no topdir line/u);
});

test('a light-curve comparison pairs integrations by time, skips masks, and separates a slow drift from noise', () => {
  const n = 2000, time = Float64Array.from({ length: n }, (_, i) => 60000 + i * 10 / 86400);
  const noise = (seed: number) => { let state = seed; return () => { state = (state * 1103515245 + 12345) % 2147483648; return state / 2147483648 - 0.5; }; };
  const signal = Array.from(time, t => 1 + 0.002 * Math.sin((t - 60000) * 20));
  const randomA = noise(1), randomB = noise(2);
  const curve = (flux: number[], mask: (i: number) => boolean, jitter: number): LightCurve => ({ time: Float64Array.from(time, t => t + jitter / 86400), flux: Float64Array.from(flux), err: new Float64Array(n).fill(3e-4), mask: Uint8Array.from({ length: n }, (_, i) => (mask(i) ? 1 : 0)) });
  const ours = curve(signal.map((value, i) => value + 3e-4 * randomA() + 1e-3 * (time[i]! - 60000)), i => i === 5, 0.2);
  const author = curve(signal.map(value => value + 3e-4 * randomB()), i => i === 9, 0);
  const result = compareLightCurves(ours, author);
  assert.equal(result.paired, n - 2);
  assert.ok(result.correlation > 0.95, `correlation ${result.correlation}`);
  // The slope's own uncertainty over 0.23 days of 122 ppm noise is about 41 ppm per day.
  assert.ok(Math.abs(result.driftPpmPerDay - 1000) < 150, `drift ${result.driftPpmPerDay}`);
  // Uniform noise of width 3e-4 has a standard deviation of 87 ppm; two curves' worth is 122 ppm.
  assert.ok(Math.abs(result.detrendedDifferencePpm - 122) < 10, `detrended ${result.detrendedDifferencePpm}`);
  assert.throws(() => compareLightCurves(ours, { ...author, time: Float64Array.from(time, t => t + 1) }), /pair/u);
  assert.equal(parseLightCurve('time,flux,err,mask,centroid_y,psf_width_y\n1,1.0,0.1,0,2,3\n2,nan,0.1,1,2,3\n').mask[1], 1);
});

test('the WASP-43b MIRI reduction from raw reproduces Bell et al. (2024)\'s Eureka! v1 light curves', async context => {
  const curves = resolve(repository, 'output/jwst/wasp-43b-miri-1366/light-curves');
  if (!await access(resolve(curves, 'ours-white.csv')).then(() => true, () => false)) {
    context.skip('run node tools/objects/jwst/reduce-tso.mts tools/objects/jwst/programs/wasp-43b-miri-1366 output/jwst/wasp-43b-miri-1366 to cover this');
    return;
  }
  const read = async (name: string) => parseLightCurve(await readFile(resolve(curves, name), 'utf8'));
  const white = compareLightCurves(await read('ours-white.csv'), await read('author-white.csv'));
  context.diagnostic(`white: ${JSON.stringify(white)}`);
  // Measured on the lab run of 2026-09-17: 9,194 pairs, correlation 0.990, 172 ppm after the drift, scatter 342 against 373 ppm.
  assert.ok(white.paired >= 9000, `${white.paired} pairs`);
  assert.ok(white.correlation >= 0.98, `correlation ${white.correlation}`);
  assert.ok(white.detrendedDifferencePpm <= 250, `detrended difference ${white.detrendedDifferencePpm} ppm`);
  assert.ok(white.scatterPpm.ours <= white.scatterPpm.author * 1.05, `scatter ${white.scatterPpm.ours} against ${white.scatterPpm.author} ppm`);
  const channels = (await readdir(curves)).filter(name => /^ours-ch\d{2}\.csv$/u.test(name)).sort();
  assert.equal(channels.length, 14);
  for (const name of channels) {
    const result = compareLightCurves(await read(name), await read(name.replace('ours', 'author')));
    context.diagnostic(`${name}: correlation ${result.correlation.toFixed(3)}, detrended ${result.detrendedDifferencePpm.toFixed(0)} ppm`);
  }
});
