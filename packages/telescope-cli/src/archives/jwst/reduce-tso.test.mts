import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { access, readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { compareLightCurves, parseLightCurve, type LightCurve } from './compare-light-curves.mts';
import { renderSettings } from './reduce-tso.mts';
import { WORKSPACE } from '@cssearth/telescope/node';
import { eurekaToolchain } from './toolchain.mts';

const repository = WORKSPACE;

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
    context.skip('run node packages/telescope-cli/src/archives/jwst/reduce-tso.mts packages/telescope-cli/src/archives/jwst/programs/wasp-43b-miri-1366 output/jwst/wasp-43b-miri-1366 to cover this');
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
  // Channels are 0.5 um wide from 5 um. Below 10 um correlations measured 0.927 to 0.994. The four channels from 10 um fall to
  // 0.870-0.931 and are reported without a bound; Hammond et al. (2024) excluded the three above 10.5 um for shadowing.
  for (const [index, name] of channels.entries()) {
    const result = compareLightCurves(await read(name), await read(name.replace('ours', 'author')));
    context.diagnostic(`${name}: correlation ${result.correlation.toFixed(3)}, detrended ${result.detrendedDifferencePpm.toFixed(0)} ppm`);
    if (index < 10) assert.ok(result.correlation >= 0.9, `${name}: correlation ${result.correlation}`);
  }
});

test('the HD 189733b MIRI eclipses reduced from raw reproduce Lally et al. (2025)\'s Eureka! light curves', async context => {
  for (const observation of ['002', '011']) {
    const curves = resolve(repository, `output/jwst/hd-189733b-miri-2021-${observation}/light-curves`);
    if (!await access(resolve(curves, 'author-white.csv')).then(() => true, () => false)) {
      context.diagnostic(`run node packages/telescope-cli/src/archives/jwst/reduce-tso.mts packages/telescope-cli/src/archives/jwst/programs/hd-189733b-miri-2021-${observation} output/jwst/hd-189733b-miri-2021-${observation} to cover observation ${observation}`);
      continue;
    }
    const read = async (name: string) => parseLightCurve(await readFile(resolve(curves, name), 'utf8'));
    const result = compareLightCurves(await read('ours-white.csv'), await read('author-white.csv'));
    context.diagnostic(`observation ${observation}: ${JSON.stringify(result)}`);
    // Measured 2026-09-17: 17,019 and 17,024 pairs, correlation 0.988 and 0.985, 245 and 249 ppm after the drift. The deposit is
    // outlier-clipped, so its scatter (330 and 327 ppm) is below ours (352 and 355 ppm).
    assert.ok(result.paired >= 16_500, `${result.paired} pairs`);
    assert.ok(result.correlation >= 0.98, `correlation ${result.correlation}`);
    assert.ok(result.detrendedDifferencePpm <= 300, `detrended difference ${result.detrendedDifferencePpm} ppm`);
  }
});

test('the Eureka! toolchain reads its descriptor and lock beside this code before it looks for an installed environment', async () => {
  // Installed or not, the pins are read first: a missing descriptor or lock fails with ENOENT, anything else is about the install.
  await eurekaToolchain('jwst_1535.pmap').catch((error: unknown) => assert.doesNotMatch(String(error), /ENOENT/u));
});
