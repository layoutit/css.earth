import assert from 'node:assert/strict';
import { sourceTest } from '../../../../tests/objects/source-test.mts';
const test = sourceTest();
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { bandOfFilters, parseImagingProgram, PROGRAMS, type ImagingBand, type ImagingProgram } from './archive.mts';
import { bandMode, bandOfHeader, isCubeBand, JWST_BANDS } from './bands.mts';
import { assertCubeMembers, spec3Steps } from '../cubes/spec3.mts';
import { gridResample, imagingProductRun, pipelineSoftware, recordProductEvidence } from './image3.mts';
import { evidenceFor, productRecordPath, readProductRecord, runDigest, writeProductRecord } from '../../product-record.mts';
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

test('the pinned HIP 65426 coronagraphy reproduces MAST’s PSF subtraction beyond the mask', async () => {
  const pinned = parseImagingProgram(JSON.parse(await readFile(join(PROGRAMS, 'hip-65426-1386.json'), 'utf8')));
  assert.deepEqual(pinned.bands.map(entry => [entry.band, entry.stage, entry.members.length, entry.references?.length]), [['NIRCAM-F444W-MASK335R', 'coron3', 2, 9]]);
  const receipt = JSON.parse(await readFile(join(PROGRAMS, 'hip-65426-1386.NIRCAM-F444W-MASK335R.reproduction.json'), 'utf8')) as
    { schema: string; differentWcs: string[]; mast: { calVer: string }; local: { calVer: string }; pixels: { annuli: { bins: { arcsec: number[]; correlation: number }[] } } };
  assert.equal(receipt.schema, 'cssearth-jwst-coron3-reproduction@1');
  assert.equal(receipt.local.calVer, receipt.mast.calVer);
  assert.deepEqual(receipt.differentWcs, [], 'MAST’s grid');
  // Inside 0.5″ the star sits under the mask and the residual is noise; HIP 65426 b is at 0.78″.
  const [under, ...beyond] = receipt.pixels.annuli.bins;
  assert.deepEqual(under!.arcsec, [0, 0.5]);
  for (const bin of beyond) assert.ok(bin.correlation > 0.9, `${bin.arcsec.join('–')}″: ${bin.correlation}`);
  assert.ok(beyond[0]!.correlation > 0.99, 'the planet’s annulus');
});

test('programs refuse unknown bands, non-level-2 members, foreign URIs and unsupported stage parameters', () => {
  assert.equal(parseImagingProgram(program()).bands.length, 1);
  assert.throws(() => parseImagingProgram(program({ bands: [{ ...program().bands[0], band: 'NIRCAM-F999W' }] })), /Unknown JWST band/u);
  assert.throws(() => parseImagingProgram(program({ bands: [{ ...program().bands[0], members: [member('x_rate.fits')] }] })), /level-2 _cal/u);
  assert.throws(() => parseImagingProgram(program({ bands: [{ ...program().bands[0], members: [{ ...member('a_cal.fits'), uri: 'mast:HST/product/a_cal.fits' }] }] })), /Invalid MAST file/u);
  assert.throws(() => parseImagingProgram(program({ image3: { source_catalog: { skip: false } } })), /Unsupported image3 step/u);
  assert.equal(parseImagingProgram(program({ image3: { tweakreg: { abs_refcat: 'GAIADR3' } } })).image3?.tweakreg?.abs_refcat, 'GAIADR3');
});

const coron = (overrides: Record<string, unknown> = {}) => program({ bands: [{ band: 'NIRCAM-F444W-MASK335R', observation: 'jw01386-c1020_t001_nircam_f444w-maskrnd-sub320a335r',
  level3: member('jw01386-c1020_t001_nircam_f444w-maskrnd-sub320a335r_i2d.fits'), association: member('jw01386-c1020_20260801t084051_coron3_00001_asn.json'),
  stage: 'coron3', members: [member('jw01386002001_0310a_00001_nrcalong_calints.fits')], references: [member('jw01386001001_0310e_00001_nrcalong_calints.fits')], ...overrides }] });

test('coronagraph bands are built by coron3 from _calints exposures and PSF references, and only they', () => {
  const parsed = parseImagingProgram(coron()).bands[0]!;
  assert.equal(parsed.stage, 'coron3');
  assert.equal(parsed.references?.length, 1);
  assert.throws(() => parseImagingProgram(coron({ references: [] })), /references are level-2 _calints/u);
  assert.throws(() => parseImagingProgram(coron({ members: [member('a_cal.fits')] })), /level-2 _calints/u);
  assert.throws(() => parseImagingProgram(coron({ association: member('jw01386-c1020_20260801t084051_image3_00001_asn.json') })), /coron3 association/u);
  assert.throws(() => parseImagingProgram(coron({ stage: undefined, references: undefined, members: [member('a_cal.fits')], association: member('a_image3_00001_asn.json') })), /built by coron3/u);
  assert.throws(() => parseImagingProgram(program({ bands: [{ ...program().bands[0], references: [member('a_calints.fits')] }] })), /only a coron3 band/u);
  assert.throws(() => parseImagingProgram(coron({ band: 'NIRCAM-F444W' })), /built by coron3/u);
});

test('the archive’s filter lists resolve coronagraph bands; the mask comes from the product header', () => {
  assert.equal(bandOfFilters('NIRCAM', 'F444W;MASKRND', 'jw01386-c1020_t001_nircam_f444w-maskrnd-sub320a335r').id, 'NIRCAM-F444W-MASK335R');
  assert.equal(bandOfFilters('NIRCAM', 'F182M;MASKRND', 'jw02780-c1014_t001_nircam_f182m-maskrnd-sub320a335r').id, 'NIRCAM-F182M-MASK335R');
  assert.equal(bandOfFilters('NIRCAM', 'F335M;MASKBAR', 'jw04451-c1001_t001_nircam_f335m-maskbar-sub320alwb').id, 'NIRCAM-F335M-MASKLWB');
  assert.equal(bandOfFilters('NIRCAM', 'F460M;MASKBAR', 'jw01194-c1001_t001_nircam_f460m-maskbar-sub400x256alwb').id, 'NIRCAM-F460M-MASKLWB');
  // A full-frame coronagraph observation names no occulter, and a bar is not behind the round Lyot stop.
  assert.throws(() => bandOfFilters('NIRCAM', 'F444W;MASKRND', 'jw01193-c1031_t015_nircam_f444w-maskrnd'), /does not say which occulter/u);
  assert.throws(() => bandOfFilters('NIRCAM', 'F444W;MASKRND', 'jw01193-c1031_t015_nircam_f444w-maskrnd-sub320alwb'), /does not say which occulter/u);
  assert.equal(bandOfFilters('NIRCAM', 'F444W;CLEAR').id, 'NIRCAM-F444W');
  assert.equal(bandOfFilters('MIRI', 'F1130W').id, 'MIRI-F1130W');
  // MIRI coronagraphy is not a band: its PSF alignment does not converge (coron3.mts).
  assert.throws(() => bandOfFilters('MIRI', 'F1140C;4QPM_1140'), /No JWST band/u);
  assert.equal(bandOfHeader({ TELESCOP: 'JWST', INSTRUME: 'NIRCAM', FILTER: 'F444W', PUPIL: 'MASKRND', CORONMSK: 'MASKA335R' })?.id, 'NIRCAM-F444W-MASK335R');
  assert.equal(bandOfHeader({ TELESCOP: 'JWST', INSTRUME: 'NIRCAM', FILTER: 'F444W', PUPIL: 'MASKRND', CORONMSK: 'MASKA430R' })?.id, 'NIRCAM-F444W-MASK430R');
  assert.equal(bandOfHeader({ TELESCOP: 'JWST', INSTRUME: 'NIRCAM', FILTER: 'F444W', PUPIL: 'MASKRND', CORONMSK: 'MASKB335R' }), undefined);
});

test('a product header names its band, with NIRCam narrow filters behind F444W in the pupil wheel', () => {
  assert.equal(bandOfHeader({ TELESCOP: 'JWST', INSTRUME: 'NIRCAM', FILTER: 'F444W', PUPIL: 'F470N' })?.id, 'NIRCAM-F470N');
  assert.equal(bandOfHeader({ TELESCOP: 'JWST', INSTRUME: 'NIRCAM', FILTER: 'F444W', PUPIL: 'CLEAR' })?.id, 'NIRCAM-F444W');
  assert.equal(bandOfHeader({ TELESCOP: 'JWST', INSTRUME: 'NIRCAM', FILTER: 'F187N', PUPIL: 'CLEAR' })?.id, 'NIRCAM-F187N');
  assert.equal(bandOfHeader({ TELESCOP: 'JWST', INSTRUME: 'MIRI', FILTER: 'F1130W' })?.id, 'MIRI-F1130W');
  assert.equal(bandOfHeader({ TELESCOP: 'HST', INSTRUME: 'NIRCAM', FILTER: 'F187N', PUPIL: 'CLEAR' }), undefined);
  assert.ok(Object.values(JWST_BANDS).every(entry => entry.instrument === 'NIRCAM' ? entry.pupil !== undefined : entry.pupil === undefined));
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

const LOCK = 'astropy==6.1.0\njwst==2.0.1\nstcal==1.20.0\nstpipe==1.1.0\nunpinned-thing\n';
const digested = (name: string, hash: string) => ({ ...member(name), sha256: hash });
const pinnedProgram = (overrides: Record<string, unknown> = {}) => parseImagingProgram(program({
  bands: [{ ...program().bands[0], members: [digested('jw02733001001_02103_00001_nrcblong_cal.fits', 'a'.repeat(64))] }], ...overrides }));
const toolchain = { toolchainDigest: 'b'.repeat(64), software: pipelineSoftware(LOCK) };
const imageRun = (pinned: ImagingProgram, parameters: Record<string, unknown> = {}, band: ImagingBand = pinned.bands[0]!) =>
  imagingProductRun(pinned, band, 'image3', { image3: pinned.image3 ?? {}, grid: null, ...parameters }, toolchain);

test('an image3 run is identified by the exposures it was given, its settings and the pinned pipeline', () => {
  const pinned = pinnedProgram({ image3: { tweakreg: { abs_refcat: 'GAIADR3' } } });
  const run = imageRun(pinned);
  assert.equal(run.telescope, 'JWST');
  assert.equal(run.stage, 'image3');
  assert.deepEqual(run.inputs, [{ role: 'level-2 exposure', identity: 'mast:JWST/product/jw02733001001_02103_00001_nrcblong_cal.fits', bytes: 1000, sha256: 'a'.repeat(64) }]);
  assert.equal(run.parameters.crdsContext, 'jwst_1535.pmap');
  assert.deepEqual(run.parameters.image3, { tweakreg: { abs_refcat: 'GAIADR3' } });
  // The lock pins the environment eurekaToolchain refuses to run without, so these are the versions a run had.
  assert.deepEqual(run.software, [{ name: 'jwst', version: '2.0.1' }, { name: 'stcal', version: '1.20.0' }, { name: 'stpipe', version: '1.1.0' }]);
  assert.equal(run.toolchainDigest, 'b'.repeat(64));
  // Another CRDS context, another grid, another exposure or another pipeline pin is another run, so the mosaic is made again.
  const base = runDigest(run);
  assert.notEqual(runDigest(imageRun(pinnedProgram({ crdsContext: 'jwst_1400.pmap', image3: { tweakreg: { abs_refcat: 'GAIADR3' } } }))), base);
  assert.notEqual(runDigest(imageRun(pinned, { grid: gridResample({ width: 1024, height: 1024, fovDeg: 0.025, centerIcrsDegrees: [151.75735, -40.4364056] as [number, number] }) })), base);
  assert.notEqual(runDigest(imagingProductRun(pinned, pinned.bands[0]!, 'image3', { image3: pinned.image3 ?? {}, grid: null },
    { ...toolchain, toolchainDigest: 'c'.repeat(64) })), base);
  // A member with no digest is not a pin, and a lock that pins no pipeline is not a version.
  assert.throws(() => imageRun(parseImagingProgram(program())), /no digest/u);
  assert.throws(() => pipelineSoftware('astropy==6.1.0\n'), /no jwst pipeline version/u);
});

test('archive agreement is added to the record beside the exact product, and a product with no record is refused', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'jwst-record-'));
  try {
    const pinned = pinnedProgram(), mosaic = join(directory, 'jw02733-o001_t001_nircam_f444w-f470n_i2d.fits');
    const receipt = join(directory, 'test.NIRCAM-F470N.reproduction.json'), agreement = 'The re-run reproduces MAST’s own mosaic of this observation.';
    await writeFile(mosaic, 'mosaic');
    // The comparing stage adds evidence; it does not invent the record, so a product no stage recorded is refused.
    await assert.rejects(recordProductEvidence(mosaic, 'archive-agreement', receipt, agreement), /no product record at/u);
    await writeProductRecord(productRecordPath(mosaic), imageRun(pinned), [{ path: basename(mosaic), file: mosaic, units: 'MJy/sr' }]);
    assert.deepEqual((await readProductRecord(productRecordPath(mosaic)))!.evidence, [], 'the producing run states no evidence of its own');
    await writeFile(receipt, '{}');
    const record = await recordProductEvidence(mosaic, 'archive-agreement', receipt, agreement);
    assert.equal(evidenceFor(record, basename(mosaic), 'archive-agreement').length, 1);
    assert.equal(evidenceFor(record, basename(mosaic), 'geometric-registration').length, 0, 'agreement with MAST places nothing');
    assert.ok(record.evidence[0]!.receiptPin);
    assert.ok(record.evidence[0]!.receipt.endsWith('.evidence.json'));
    assert.deepEqual(record.inputs, imageRun(pinned).inputs, 'the run facts stay the ones the run recorded');
    // The same comparison run twice replaces its own entry, so the record keeps the same bytes.
    const again = await recordProductEvidence(mosaic, 'archive-agreement', receipt, agreement);
    assert.equal(again.evidence.length, 1);
    await writeFile(mosaic, 'another mosaic');
    await assert.rejects(recordProductEvidence(mosaic, 'archive-agreement', receipt, agreement), /not the files on disk/u);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('an integral-field observation is a cube band, built by spec3 from _cal exposures', () => {
  assert.equal(bandOfFilters('NIRSPEC', 'F290LP;G395H').id, 'NIRSPEC-G395H-F290LP');
  assert.throws(() => bandOfFilters('NIRSPEC', 'F290LP;G140H'), /No JWST cube band/u);
  assert.equal(bandOfHeader({ TELESCOP: 'JWST', INSTRUME: 'NIRSPEC', EXP_TYPE: 'NRS_IFU', GRATING: 'G395H', FILTER: 'F290LP' })?.id, 'NIRSPEC-G395H-F290LP');
  assert.equal(bandOfHeader({ TELESCOP: 'JWST', INSTRUME: 'NIRSPEC', EXP_TYPE: 'NRS_FIXEDSLIT', GRATING: 'G395H', FILTER: 'F290LP' }), undefined);
  const cube = { band: 'NIRSPEC-G395H-F290LP', observation: 'jw01250-o002_t001_nirspec_g395h-f290lp', stage: 'spec3', level3: member('jw01250-o002_t001_nirspec_g395h-f290lp_s3d.fits'),
    association: member('jw01250-o002_20260720t083746_spec3_00001_asn.json'), members: [member('jw01250002001_03105_00001_nrs1_cal.fits')] };
  const program = (bands: unknown[]) => ({ schema: 'cssearth-jwst-imaging-program@1', id: 'europa-1250', programme: '1250', target: 'EUROPA', crdsContext: 'jwst_1535.pmap', bands });
  assert.equal(parseImagingProgram(program([cube])).bands[0]!.stage, 'spec3');
  assert.throws(() => parseImagingProgram(program([{ ...cube, stage: undefined }])), /built by spec3/u);
  assert.throws(() => parseImagingProgram(program([{ ...cube, level3: member('jw01250-o002_t001_nirspec_g395h-f290lp_i2d.fits') }])), /level-3 cube/u);
});

test('a coronagraph run pins the PSF references it subtracted with, and is not the same run as an image3 mosaic', () => {
  const pinned = pinnedProgram({ bands: [{ ...program().bands[0], band: 'NIRCAM-F444W-MASK335R', observation: 'jw01386-c1020_t001_nircam_f444w-maskrnd-sub320a335r', stage: 'coron3',
    level3: member('jw01386-c1020_t001_nircam_f444w-maskrnd-sub320a335r_i2d.fits'), association: member('jw01386-c1020_20260721t201156_coron3_00001_asn.json'),
    members: [digested('jw01386001001_0310a_00001_nrcalong_calints.fits', 'a'.repeat(64))],
    references: [digested('jw01386002001_0310a_00001_nrcalong_calints.fits', 'e'.repeat(64))] }] });
  const band = pinned.bands[0]!, run = imagingProductRun(pinned, band, 'coron3', { psfReferences: 1 }, toolchain);
  assert.equal(run.stage, 'coron3');
  assert.deepEqual(run.inputs.map(input => [input.role, input.sha256]), [['level-2 exposure', 'a'.repeat(64)], ['level-2 PSF reference', 'e'.repeat(64)]]);
  // Another reference star is another subtraction, so the mosaic beside an older record is not reused.
  const other = pinnedProgram({ bands: [{ ...band, references: [digested('jw01386002001_0310a_00001_nrcalong_calints.fits', 'f'.repeat(64))] }] });
  assert.notEqual(runDigest(imagingProductRun(other, other.bands[0]!, 'coron3', { psfReferences: 1 }, toolchain)), runDigest(run));
  assert.notEqual(runDigest(imagingProductRun(pinned, band, 'image3', { psfReferences: 1 }, toolchain)), runDigest(run));
});

const CARD = 80, BLOCK = 2880;
const card = (key: string, value: string) => `${key.padEnd(8)}= ${`'${value.padEnd(8)}'`.padEnd(20)}`.padEnd(CARD);
/** A level-2 exposure's primary header, which is all `assertCubeMembers` reads. */
const exposure = async (directory: string, name: string, cards: Record<string, string>) => {
  const path = join(directory, name), text = ['SIMPLE  =                    T'.padEnd(CARD), 'BITPIX  =                    8'.padEnd(CARD), 'NAXIS   =                    0'.padEnd(CARD),
    ...Object.entries(cards).map(([key, value]) => card(key, value)), 'END'.padEnd(CARD)].join('');
  await writeFile(path, Buffer.from(text.padEnd(Math.ceil(text.length / BLOCK) * BLOCK, ' '), 'latin1'));
  return path;
};
const MRS_EXPOSURE = { TELESCOP: 'JWST', INSTRUME: 'MIRI', EXP_TYPE: 'MIR_MRS', DETECTOR: 'MIRIFUSHORT', BAND: 'SHORT', CHANNEL: '12' };

test('MIRI\u2019s medium-resolution spectrometer is twelve cube bands, each read on one detector', () => {
  const mrs = Object.values(JWST_BANDS).filter(entry => entry.subBand !== undefined);
  assert.equal(mrs.length, 12);
  assert.ok(mrs.every(entry => entry.instrument === 'MIRI' && entry.filter === undefined && entry.grating === undefined && entry.pupil === undefined && isCubeBand(entry)));
  assert.deepEqual(mrs.filter(entry => entry.detector === 'MIRIFULONG').map(entry => entry.channel), ['3', '3', '3', '4', '4', '4']);
  // The archive lists an MRS cube's setting where another instrument's filters go; a channel it does not have is no band.
  assert.equal(bandOfFilters('MIRI', 'CH1-SHORT').id, 'MIRI-MRS-CH1-SHORT');
  assert.equal(bandOfFilters('MIRI', 'CH3-MEDIUM').id, 'MIRI-MRS-CH3-MEDIUM');
  assert.throws(() => bandOfFilters('MIRI', 'CH5-SHORT'), /No JWST band/u);
  // A level-3 cube names one channel; a level-2 exposure names the two its detector reads at once, and is not a band.
  assert.equal(bandOfHeader({ TELESCOP: 'JWST', INSTRUME: 'MIRI', EXP_TYPE: 'MIR_MRS', CHANNEL: '1', BAND: 'SHORT' })?.id, 'MIRI-MRS-CH1-SHORT');
  assert.equal(bandOfHeader({ TELESCOP: 'JWST', INSTRUME: 'MIRI', EXP_TYPE: 'MIR_MRS', CHANNEL: '12', BAND: 'SHORT' }), undefined);
  assert.equal(bandOfHeader({ TELESCOP: 'JWST', INSTRUME: 'MIRI', FILTER: 'F1280W' })?.id, 'MIRI-F1280W');
  assert.deepEqual(['MIRI-MRS-CH1-SHORT', 'MIRI-F1280W', 'NIRSPEC-G395H-F290LP', 'NIRCAM-F444W-MASK335R'].map(id => bandMode(JWST_BANDS[id]!)),
    ['MIRI/IFU', 'MIRI/IMAGE', 'NIRSPEC/IFU', 'NIRCAM/CORON']);
});

test('a cube run asks the pipeline only for what the band needs', () => {
  const nirspec = JWST_BANDS['NIRSPEC-G395H-F290LP']!;
  assert.deepEqual(spec3Steps(nirspec), { extract_1d: { skip: true } });
  assert.deepEqual(spec3Steps(nirspec, 0.05), { extract_1d: { skip: true }, cube_build: { scalexy: 0.05 } });
  assert.deepEqual(spec3Steps(nirspec, undefined, [3.4, 3.6]), { extract_1d: { skip: true }, cube_build: { wavemin: 3.4, wavemax: 3.6 } });
  // A MIRI association covers twelve cubes, so the channel and sub-band are named; the spectral-leak correction only ever
  // changes an extracted spectrum, which this run does not extract.
  assert.deepEqual(spec3Steps(JWST_BANDS['MIRI-MRS-CH3-LONG']!), { extract_1d: { skip: true }, spectral_leak: { skip: true }, cube_build: { channel: '3', band: 'long' } });
  assert.deepEqual(spec3Steps(JWST_BANDS['MIRI-MRS-CH1-SHORT']!, 0.05), { extract_1d: { skip: true }, spectral_leak: { skip: true }, cube_build: { channel: '1', band: 'short', scalexy: 0.05 } });
});

test('a cube run refuses members whose own headers are not the band\u2019s exposures', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mrs-'));
  try {
    const band = JWST_BANDS['MIRI-MRS-CH1-SHORT']!;
    const files = await Promise.all([['a', MRS_EXPOSURE], ['b', { ...MRS_EXPOSURE, BAND: 'MEDIUM' }], ['c', { ...MRS_EXPOSURE, BAND: 'LONG' }]]
      .map(([name, cards]) => exposure(directory, `${name as string}_cal.fits`, cards as Record<string, string>)));
    await assertCubeMembers(band, files);
    // The other detector's exposures belong to the association, and to the moving-target frame the whole of it fixes.
    const other = await exposure(directory, 'd_cal.fits', { ...MRS_EXPOSURE, DETECTOR: 'MIRIFULONG', CHANNEL: '34' });
    await assertCubeMembers(band, [...files, other]);
    await assert.rejects(assertCubeMembers(band, [...files.slice(1), other]), /No member of MIRI-MRS-CH1-SHORT is a MIRIFUSHORT SHORT exposure/u);
    const nirspec = await exposure(directory, 'e_cal.fits', { TELESCOP: 'JWST', INSTRUME: 'NIRSPEC', EXP_TYPE: 'NRS_IFU' });
    await assert.rejects(assertCubeMembers(band, [nirspec]), /not a MIRI MIR_MRS exposure/u);
    await assert.rejects(assertCubeMembers(JWST_BANDS['NIRSPEC-G395H-F290LP']!, files), /not a NIRSPEC NRS_IFU exposure/u);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('the pinned Europa MIRI bands reproduce MAST\u2019s cube and its picture', async () => {
  const pinned = parseImagingProgram(JSON.parse(await readFile(join(PROGRAMS, 'europa-1250.json'), 'utf8')));
  const mrs = pinned.bands.find(entry => entry.band === 'MIRI-MRS-CH1-SHORT')!;
  assert.equal(mrs.stage, 'spec3');
  assert.equal(mrs.level3.name, 'jw01250-o003_t001_miri_ch1-short_s3d.fits');
  // One cube of twelve, and the whole association behind it: three grating settings on two detectors at four dithers.
  assert.equal(mrs.members.length, 24);
  assert.equal(mrs.members.filter(entry => entry.name.endsWith('_mirifushort_cal.fits')).length, 12);
  const cube = JSON.parse(await readFile(join(PROGRAMS, 'europa-1250.MIRI-MRS-CH1-SHORT.reproduction.json'), 'utf8')) as
    { schema: string; mast: { calVer: string }; local: { calVer: string }; grid: { planes: number; arcsecPerPixel: number; micrometres: number[] };
      samples: { onlyOurs: number; onlyMast: number; identicalShare: number; correlation: number; largestRelativeDifferenceAboveMedian: number } };
  assert.equal(cube.schema, 'cssearth-jwst-spec3-reproduction@1');
  assert.equal(cube.local.calVer, cube.mast.calVer);
  assert.equal(cube.samples.onlyOurs + cube.samples.onlyMast, 0, 'one coverage');
  assert.ok(cube.samples.identicalShare > 0.999, `${cube.samples.identicalShare} identical`);
  assert.ok(cube.samples.largestRelativeDifferenceAboveMedian < 1e-6, `${cube.samples.largestRelativeDifferenceAboveMedian} largest`);
  // Channel 1 SHORT covers 4.90 to 5.74 µm, as the band's label says, on the plate scale the cube itself states.
  assert.ok(Math.abs(cube.grid.arcsecPerPixel - 0.13) < 1e-5, `${cube.grid.arcsecPerPixel} arcsec`);
  assert.deepEqual(cube.grid.micrometres.map(value => Number(value.toFixed(2))), [4.90, 5.74]);
  const picture = JSON.parse(await readFile(join(PROGRAMS, 'europa-1250.MIRI-F1280W.reproduction.json'), 'utf8')) as
    { schema: string; differentWcs: string[]; pixels: { onlyOurs: number; onlyMast: number; ratioBins: { medianRatio: number }[]; aboveMedian: { rmsDifferenceOverRms: number } } };
  assert.equal(picture.schema, 'cssearth-jwst-image3-reproduction@1');
  assert.deepEqual(picture.differentWcs, [], 'MAST\u2019s grid');
  assert.equal(picture.pixels.onlyOurs + picture.pixels.onlyMast, 0, 'one coverage');
  assert.ok(picture.pixels.aboveMedian.rmsDifferenceOverRms < 1e-6, `${picture.pixels.aboveMedian.rmsDifferenceOverRms} RMS`);
  for (const bin of picture.pixels.ratioBins) assert.equal(bin.medianRatio, 1);
});
