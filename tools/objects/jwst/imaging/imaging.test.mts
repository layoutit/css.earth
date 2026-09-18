import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseImagingProgram, PROGRAMS } from './archive.mts';
import { bandOfHeader, JWST_BANDS } from './bands.mts';
import { gridResample } from './image3.mts';
import { toolchainPython } from '../mast.mts';
import { findPointSources } from '../../observation/point-sources.mts';

const member = (name: string, bytes = 1000) => ({ name, uri: `mast:JWST/product/${name}`, bytes });
const program = (overrides: Record<string, unknown> = {}) => ({
  schema: 'cssearth-jwst-imaging-program@1', id: 'test', programme: '2733', target: 'NGC-3132', crdsContext: 'jwst_1535.pmap',
  bands: [{ band: 'NIRCAM-F470N', observation: 'jw02733-o001_t001_nircam_f444w-f470n',
    level3: member('jw02733-o001_t001_nircam_f444w-f470n_i2d.fits'), association: member('jw02733-o001_20260726t151748_image3_00003_asn.json'),
    members: [member('jw02733001001_02103_00001_nrcblong_cal.fits')] }],
  ...overrides,
});

test('the pinned NGC 3132 program parses, and its reproduction receipt records a close match', async () => {
  const pinned = parseImagingProgram(JSON.parse(await readFile(join(PROGRAMS, 'ngc-3132-2733.json'), 'utf8')));
  for (const band of ['NIRCAM-F187N', 'NIRCAM-F470N']) assert.ok(pinned.bands.some(entry => entry.band === band), `${band} is pinned`);
  const receipt = JSON.parse(await readFile(join(PROGRAMS, 'ngc-3132-2733.NIRCAM-F470N.reproduction.json'), 'utf8')) as
    { crdsContext: string; mast: { calVer: string }; local: { calVer: string }; pixels: { ratioBins: { medianRatio: number }[] } };
  assert.equal(receipt.local.calVer, receipt.mast.calVer);
  // Up to the 99.9th brightness percentile the local mosaic's median brightness is within 0.2% of MAST's.
  for (const bin of receipt.pixels.ratioBins.slice(0, 4)) assert.ok(Math.abs(bin.medianRatio - 1) < 0.002, `ratio ${bin.medianRatio}`);
});

test('programs refuse unknown bands, non-level-2 members, foreign URIs and unsupported stage parameters', () => {
  assert.equal(parseImagingProgram(program()).bands.length, 1);
  assert.throws(() => parseImagingProgram(program({ bands: [{ ...program().bands[0], band: 'NIRCAM-F999W' }] })), /Unknown JWST band/u);
  assert.throws(() => parseImagingProgram(program({ bands: [{ ...program().bands[0], members: [member('x_rate.fits')] }] })), /level-2 _cal/u);
  assert.throws(() => parseImagingProgram(program({ bands: [{ ...program().bands[0], members: [{ ...member('a_cal.fits'), uri: 'mast:HST/product/a_cal.fits' }] }] })), /Invalid MAST file/u);
  assert.throws(() => parseImagingProgram(program({ image3: { source_catalog: { skip: false } } })), /Unsupported image3 step/u);
  assert.equal(parseImagingProgram(program({ image3: { tweakreg: { abs_refcat: 'GAIADR3' } } })).image3?.tweakreg?.abs_refcat, 'GAIADR3');
});

test('a product header names its band, with NIRCam narrow filters behind F444W in the pupil wheel', () => {
  assert.equal(bandOfHeader({ TELESCOP: 'JWST', INSTRUME: 'NIRCAM', FILTER: 'F444W', PUPIL: 'F470N' })?.id, 'NIRCAM-F470N');
  assert.equal(bandOfHeader({ TELESCOP: 'JWST', INSTRUME: 'NIRCAM', FILTER: 'F444W', PUPIL: 'CLEAR' })?.id, 'NIRCAM-F444W');
  assert.equal(bandOfHeader({ TELESCOP: 'JWST', INSTRUME: 'NIRCAM', FILTER: 'F187N', PUPIL: 'CLEAR' })?.id, 'NIRCAM-F187N');
  assert.equal(bandOfHeader({ TELESCOP: 'JWST', INSTRUME: 'MIRI', FILTER: 'F1130W' })?.id, 'MIRI-F1130W');
  assert.equal(bandOfHeader({ TELESCOP: 'HST', INSTRUME: 'NIRCAM', FILTER: 'F187N', PUPIL: 'CLEAR' }), undefined);
  assert.ok(Object.values(JWST_BANDS).every(entry => entry.instrument === 'MIRI' ? entry.pupil === undefined : entry.pupil !== undefined));
});

test('the recipe grid becomes the resample step’s 0-based reference pixel, centre and scale', () => {
  const grid = { width: 1024, height: 1024, fovDeg: 0.025, centerIcrsDegrees: [151.75735, -40.4364056] as [number, number] };
  const resample = gridResample(grid);
  assert.deepEqual(resample.shape, [1024, 1024]);
  assert.deepEqual(resample.crpix, [511, 511]);
  assert.deepEqual(resample.crval, [151.75735, -40.4364056]);
  // 0.025 degrees across 1024 pixels on the tangent plane, as the hips2fits grid defines it.
  assert.ok(Math.abs(resample.pixelScaleArcsec - 2 * Math.tan(0.0125 * Math.PI / 180) * 180 / Math.PI * 3600 / 1024) < 1e-12);
});

test('a star is masked and a filament of the same peak is not', () => {
  const width = 64, height = 64, plane = new Float32Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const sky = 10 + 0.05 * x + Math.sin(x * 1.7 + y * 2.3) * 0.2;
    const filament = 20 * Math.exp(-((x - 44) ** 2) / 8);
    const star = 400 * Math.exp(-((x - 16) ** 2 + (y - 20) ** 2) / 1.5);
    plane[y * width + x] = sky + filament + star;
  }
  const found = findPointSources(plane, width, height);
  assert.equal(found.mask[20 * width + 16], 1);
  assert.equal(found.mask[40 * width + 44], 0, 'the filament stays');
  assert.ok(found.cores >= 1 && found.maskedPixels < 80, `${found.cores} cores over ${found.maskedPixels} pixels`);
});

test('a Python run that passes its memory ceiling is stopped', async () => {
  const work = await mkdtemp(join(tmpdir(), 'jwst-ceiling-'));
  try {
    const toolchain = { python: 'python3', env: {} };
    const ok = await toolchainPython(toolchain, work, 'print("done")', [], join(work, 'ok.log'), { maxRssBytes: 512 * 2 ** 20 });
    assert.equal(ok.lastLine, 'done');
    await assert.rejects(toolchainPython(toolchain, work, 'import time\nblock = bytearray(900 * 2**20)\nfor i in range(0, len(block), 4096): block[i] = 1\ntime.sleep(5)', [],
      join(work, 'over.log'), { maxRssBytes: 256 * 2 ** 20 }), /memory ceiling/u);
  } finally { await rm(work, { recursive: true, force: true }); }
});

test('the diffraction spikes of a bright star are masked, and a nearby filament is not', () => {
  const width = 160, height = 160, plane = new Float32Array(width * height), cx = 60, cy = 70;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const r = Math.hypot(x - cx, y - cy), angle = Math.atan2(y - cy, x - cx);
    // Six thin spikes 60 degrees apart, falling slowly with radius, over a sky with a broad filament.
    const offAxis = Math.min(...[0, 1, 2, 3, 4, 5].map(k => Math.abs(Math.sin(angle - k * Math.PI / 3)) * r));
    const spike = r > 2 ? 30 * Math.exp(-(offAxis ** 2) / 0.8) * Math.exp(-r / 60) : 0;
    const filament = 15 * Math.exp(-((x - 130) ** 2) / 30);
    plane[y * width + x] = 10 + 0.3 * Math.sin(x * 1.3 + y * 0.7) + 5000 * Math.exp(-(r ** 2) / 2) + spike + filament;
  }
  const found = findPointSources(plane, width, height);
  assert.ok(found.spikeRays >= 6, `${found.spikeRays} spike rays`);
  // A point on the 0-degree spike 25 samples out, and one on the 60-degree spike.
  assert.equal(found.mask[cy * width + cx + 25], 1);
  assert.equal(found.mask[Math.round(cy + 25 * Math.sin(Math.PI / 3)) * width + Math.round(cx + 25 * Math.cos(Math.PI / 3))], 1);
  assert.equal(found.mask[40 * width + 130], 0, 'the filament stays');
  assert.equal(found.mask[(cy + 30) * width + cx + 5], 0, 'sky between spikes stays');
});
