import { required } from './test-values.mts';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import { decodeOsirisGeo, decodeOsirisQuality, acceptOsirisQuality, lommelSeeligerGain, fitCamera, project, PLANE_NAMES, GEO_SHAPE_MODEL, osirisRadianceFactorScale, phaseGain, observationGain } from '../objects/terrestrial-layers/osiris-geo.mts';
import { sampleFootprint } from '../objects/surface-observations/footprint.mts';
import { archiveBackplanes } from '../objects/surface-observations/geometry.mts';
import { diskPhotometry } from '../objects/surface-observations/photometry.mts';
import type { DiskPhotometry } from '../objects/terrestrial-layers/contracts.mts';

/** A decoded GEO frame as the footprint stage sees it: optional quality flags and disk photometry. */
const sampleGeo = (frame: ReturnType<typeof decodeOsirisGeo> & { quality?: { flags: ArrayLike<number>; allowLossy: boolean }; colorPlanes?: readonly ArrayLike<number>[]; acceptPixel?(index: number): boolean }, matrix: number[][], pointKm: number[],
  { maximumSeparationMeters, maximumEmissionDegrees, photometry }: { maximumSeparationMeters: number; maximumEmissionDegrees: number; photometry?: DiskPhotometry }) => sampleFootprint({
  image: { width: frame.width, height: frame.height, values: frame.planes.IMAGE, ...(frame.colorPlanes ? { colorValues: frame.colorPlanes } : {}), startTime: frame.startTime, filter: frame.filter, report: {},
    reject: i => (frame.acceptPixel && !frame.acceptPixel(i)) || (frame.quality && !acceptOsirisQuality(frame.quality.flags[i], frame.quality.allowLossy)) ? 'quality' : null },
  camera: { project: point => project(matrix, point.map(n => n / 1000)) }, geometry: archiveBackplanes(frame, { positionMeters: [0, 0, 0] }),
  photometry: photometry ? diskPhotometry(photometry) : { gain: () => 1, retainsIllumination: true } }, pointKm.map(n => n * 1000), { maximumSeparationMeters, maximumEmissionDegrees });

test('radiance factor uses calibrated solar flux and squared distance without normalizing twice', () => {
  const history = 'SOLAR_DISTANCE = 2 <AU>\nSOLAR_FLUX = 4 <W/m**2/nm>\nROSETTA:REFLECTIVITY_NORMALIZATION_FLAG = FALSE\n';
  assert.equal(osirisRadianceFactorScale(history).factor, Math.PI);
  assert.equal(osirisRadianceFactorScale(history.replace('2 <AU>', '4 <AU>')).factor, 4 * Math.PI);
  for (const altered of [history.replace('FALSE', 'TRUE'), history.replace('<AU>', '<KM>'), history.replace('4 <', '0 <'), history + 'SOLAR_FLUX = 4 <W/m**2/nm>\n']) {
    assert.throws(() => osirisRadianceFactorScale(altered));
  }
});

test('source phase terms have analytic anchors and leave disk limits independent', () => {
  const phase = { model: 'hapke-2012-hg-shadow-hiding', asymmetry: 0, amplitude: 1, width: 1, minimumDegrees: 0, maximumDegrees: 90, referenceDegrees: 0, maximumGain: 2 };
  assert.equal(phaseGain(0, phase), 1);
  // Isotropic HG is one: the shadow term falls from 2 at 0 degrees to 1.5 at 90.
  assert.ok(Math.abs(required(phaseGain(Math.PI / 2, phase)) - 4 / 3) < 1e-12);
  assert.equal(phaseGain(NaN, phase), null);
  assert.equal(phaseGain(Math.PI, phase), null);
  assert.equal(phaseGain(Math.PI / 2, { ...phase, maximumGain: 1.1 }), null);
  const disk = { maximumIncidenceDegrees: 80, maximumEmissionDegrees: 80, maximumGain: 3, phaseCorrection: phase };
  assert.equal(observationGain(80 * Math.PI / 180, 0, disk, 0), null);
});

function fixture({ replace = (text: string) => text } = {}) {
  let label = `PDS_VERSION_ID = PDS3\nRECORD_TYPE = FIXED_LENGTH\nRECORD_BYTES = 512\nFILE_RECORDS = 18\nLABEL_RECORDS = 8\nINSTRUMENT_ID = "OSINAC"\nIMAGE_ID = "12000700"\nSOFTWARE_VERSION_ID = "2.9.0"\nSTART_TIME = 2014-08-05T19:44:22.918\nFILTER_NAME = "FFP-Vis_Orange"\n`;
  for (const [i, name] of PLANE_NAMES.entries()) label += `^${name} = ${10 + i}\n`;
  for (const name of PLANE_NAMES) label += `OBJECT = ${name}\nLINE_SAMPLES = 2\nLINES = 2\nSAMPLE_BITS = 32\nSAMPLE_TYPE = ${name === 'FACET_INDEX_IMAGE' ? 'LSB_INTEGER' : 'PC_REAL'}\nBANDS = 1\nFIRST_LINE = 1\nFIRST_LINE_SAMPLE = 1\nLINE_DISPLAY_DIRECTION = DOWN\nSAMPLE_DISPLAY_DIRECTION = LEFT\nUNIT = "${name === 'IMAGE' ? 'W/M**2/SR/NM' : name === 'FACET_INDEX_IMAGE' ? 'INTEGER' : name.includes('ANGLE') ? 'RAD' : 'KM'}"\nEND_OBJECT = ${name}\n`;
  label += 'END\n';
  assert.ok(label.length < 4096);
  const bytes = Buffer.alloc(18 * 512, 32);
  bytes.write(replace(label), 0, 'ascii');
  bytes.write(`GEO_SHAPE_MODEL = "${GEO_SHAPE_MODEL}"\n`, 4096, 'ascii');
  for (const [p, name] of PLANE_NAMES.entries()) for (let i = 0; i < 4; i++) {
    const offset = (9 + p) * 512 + i * 4;
    if (name === 'FACET_INDEX_IMAGE') bytes.writeInt32LE(1, offset);
    else bytes.writeFloatLE(name === 'IMAGE' ? [-2, 0, 2, 4][i] : name.includes('ANGLE') ? .2 : name.includes('COORDINATE') ? 0 : 10, offset);
  }
  return bytes;
}

test('OSIRIS planes preserve signed radiance, explicit units and stored coordinates', () => {
  const frame = decodeOsirisGeo(fixture());
  assert.deepEqual([...frame.planes.IMAGE], [-2, 0, 2, 4]);
  assert.equal(frame.valid(0), true);
  assert.equal(frame.valid(1), true);
  frame.planes.FACET_INDEX_IMAGE[2] = 0;
  assert.equal(frame.valid(2), false);
  frame.planes.COORDINATE_Z_IMAGE[3] = NaN;
  assert.equal(frame.valid(3), false);
  assert.equal(frame.valid(-1), false);
  assert.equal(frame.startTime, '2014-08-05T19:44:22.918');
});

function qualityFixture() {
  let label = `PDS_VERSION_ID = PDS3\nRECORD_TYPE = FIXED_LENGTH\nRECORD_BYTES = 512\nFILE_RECORDS = 7\nLABEL_RECORDS = 4\nINSTRUMENT_ID = "OSINAC"\nIMAGE_ID = "12000700"\nSOFTWARE_VERSION_ID = "2.9.0"\nSTART_TIME = 2014-08-05T19:44:22.918\nFILTER_NAME = "FFP-Vis_Orange"\nDATA_QUALITY_ID = "0000000000000000"\n`;
  const names = ['IMAGE', 'SIGMA_MAP_IMAGE', 'QUALITY_MAP_IMAGE'];
  for (const [i, name] of names.entries()) label += `^${name} = ${5 + i}\n`;
  for (const name of names) label += `OBJECT = ${name}\nLINE_SAMPLES = 2\nLINES = 2\nBANDS = 1\nFIRST_LINE = 1\nFIRST_LINE_SAMPLE = 1\nLINE_DISPLAY_DIRECTION = DOWN\nSAMPLE_DISPLAY_DIRECTION = LEFT\nSAMPLE_BITS = ${name === 'QUALITY_MAP_IMAGE' ? 8 : 32}\nSAMPLE_TYPE = ${name === 'QUALITY_MAP_IMAGE' ? 'LSB_UNSIGNED_INTEGER' : 'PC_REAL'}\nUNIT = "W/M**2/SR/NM"\nEND_OBJECT = ${name}\n`;
  label += 'END\n';
  assert.ok(label.length < 2048);
  const bytes = Buffer.alloc(7 * 512, 32); bytes.write(label);
  for (let i = 0; i < 4; i++) { bytes.writeFloatLE([-2, 0, 2, 4][i], 2048 + i * 4); bytes.writeFloatLE(.1, 2560 + i * 4); }
  bytes.set([1, 9, 129, 0], 3072);
  return bytes;
}

test('quality map requires positive VALID and exact companion identity/radiance', () => {
  const frame = decodeOsirisGeo(fixture()), bytes = qualityFixture();
  const quality = decodeOsirisQuality(bytes, frame);
  assert.deepEqual([...quality.flags], [1, 9, 129, 0]);
  assert.deepEqual([...quality.flags].map(q => acceptOsirisQuality(q, true)), [true, true, false, false]);
  assert.equal(acceptOsirisQuality(9, false), false);
  for (const bit of [2, 4, 16, 32, 64, 128]) assert.equal(acceptOsirisQuality(1 | bit, true), false);
  const qualifiedFrame = { ...frame, quality: { ...quality, allowLossy: true } };
  // Two qualified pixels carry half the weight at the centre; nearer the rejected row, too little qualified weight remains.
  assert.equal(sampleGeo(qualifiedFrame, [[1, 0, 0, .5], [0, 1, 0, .5], [0, 0, 1, 1]], [0, 0, 0], { maximumSeparationMeters: 20, maximumEmissionDegrees: 80 }).reason, undefined);
  assert.equal(sampleGeo(qualifiedFrame, [[1, 0, 0, .5], [0, 1, 0, .75], [0, 0, 1, 1]], [0, 0, 0], { maximumSeparationMeters: 20, maximumEmissionDegrees: 80 }).reason, 'quality');
  const wrongImage = Buffer.from(bytes); wrongImage.writeFloatLE(0, 2048);
  assert.throws(() => decodeOsirisQuality(wrongImage, frame), /radiance differs/);
  const wrongDate = Buffer.from(bytes); wrongDate.write('2015', wrongDate.indexOf('2014'));
  assert.throws(() => decodeOsirisQuality(wrongDate, frame), /identity mismatch/);
});

test('bounded disk normalization precedes interpolation and preserves signed radiance', () => {
  const photometry = { maximumIncidenceDegrees: 80, maximumEmissionDegrees: 80, maximumGain: 3 };
  assert.ok(Math.abs(required(lommelSeeligerGain(Math.PI / 3, 0, photometry)) - 1.5) < 1e-12);
  assert.ok(Math.abs(required(lommelSeeligerGain(0, Math.PI / 3, photometry)) - .75) < 1e-12);
  assert.equal(lommelSeeligerGain(80 * Math.PI / 180, 0, photometry), null);
  assert.equal(lommelSeeligerGain(Math.PI / 2, 0, photometry), null);
  const frame = decodeOsirisGeo(fixture());
  frame.planes.INCIDENCE_ANGLE_IMAGE.set([0, Math.PI / 3, 0, Math.PI / 3]);
  frame.planes.EMISSION_ANGLE_IMAGE.fill(0); frame.planes.IMAGE.fill(2);
  const matrix = [[1, 0, 0, .5], [0, 1, 0, .5], [0, 0, 1, 1]], policy = { maximumSeparationMeters: 20, maximumEmissionDegrees: 80, photometry };
  assert.ok(Math.abs(required(sampleGeo(frame, matrix, [0, 0, 0], policy).radiance) - 2.5) < 1e-6);
  frame.planes.IMAGE.fill(-2);
  assert.ok(Math.abs(required(sampleGeo(frame, matrix, [0, 0, 0], policy).radiance) + 2.5) < 1e-6);
});

test('OSIRIS rejects truncated, overlapping, differently oriented or unreliable GEO data', () => {
  assert.throws(() => decodeOsirisGeo(fixture().subarray(0, -1)), /truncated/);
  for (const [from, to] of [['^DISTANCE_IMAGE = 11', '^DISTANCE_IMAGE = 10'],
    ['^COORDINATE_Z_IMAGE = 18', '^COORDINATE_Z_IMAGE = 19'], ['SAMPLE_TYPE = PC_REAL', 'SAMPLE_TYPE = MSB_REAL'],
    ['LINE_DISPLAY_DIRECTION = DOWN', 'LINE_DISPLAY_DIRECTION = UP'], ['UNIT = "KM"', 'UNIT = "M"'],
    ['LINE_SAMPLES = 2', 'LINE_SAMPLES = 9'], ['BANDS = 1', 'BANDS = 2']]) {
    assert.throws(() => decodeOsirisGeo(fixture({ replace: text => text.replace(from, to) })), /layout|pointer/);
  }
  const badModel = fixture(); badModel.write('wrong-model', 4096 + 'GEO_SHAPE_MODEL = "'.length);
  assert.throws(() => decodeOsirisGeo(badModel), /errata/);
});

test('camera recovered from noncoplanar points predicts unseen positions independently', () => {
  const truth = [[1100, 80, 12, 40960], [-23, 1200, 20, 30960], [.1, -.2, 1, 40]];
  const points = Array.from({ length: 80 }, (_, i) => [Math.sin(i * .71) * 2, Math.cos(i * 1.37), Math.sin(i * .93)]);
  const camera = fitCamera(points, points.map(p => project(truth, p).slice(0, 2)), 2048, 2048);
  for (const point of [[2, 1, 0], [-1, .6, .3], [.2, -.9, 1.1]]) {
    const actual = project(camera.matrix, point), expected = project(truth, point);
    assert.ok(Math.hypot(actual[0] - expected[0], actual[1] - expected[1]) < 1e-7);
  }
  for (const row of camera.matrix) assert.ok(Math.abs(row.slice(0, 3).reduce((s, n, i) => s + n * camera.positionKm[i], row[3])) < 1e-6);
  assert.throws(() => fitCamera(Array(20).fill([1, 1, 1]), Array(20).fill([1, 1]), 2, 2), /Degenerate/);
});

test('surface sampling rejects occlusion boundaries and grazing geometry without rejecting darkness', () => {
  const frame = decodeOsirisGeo(fixture()), matrix = [[1, 0, 0, .5], [0, 1, 0, .5], [0, 0, 1, 1]];
  const policy = { maximumSeparationMeters: 20, maximumEmissionDegrees: 80 };
  assert.equal(sampleGeo(frame, matrix, [0, 0, 0], policy).radiance, 1);
  frame.planes.IMAGE.fill(-2);
  assert.equal(sampleGeo(frame, matrix, [0, 0, 0], policy).radiance, -2);
  // One contributor across an occlusion boundary, at grazing emission or without geometry is left out, and darkness stays; most of the weight rejects.
  const z = frame.planes.COORDINATE_Z_IMAGE.slice(), emissions = frame.planes.EMISSION_ANGLE_IMAGE.slice();
  frame.planes.COORDINATE_Z_IMAGE[3] = .1;
  assert.equal(sampleGeo(frame, matrix, [0, 0, 0], policy).radiance, -2);
  for (const i of [0, 1]) frame.planes.COORDINATE_Z_IMAGE[i] = .1;
  assert.equal(sampleGeo(frame, matrix, [0, 0, 0], policy).reason, 'geometry-mismatch');
  frame.planes.COORDINATE_Z_IMAGE.set(z);
  frame.planes.EMISSION_ANGLE_IMAGE[0] = Math.PI / 2;
  assert.equal(sampleGeo(frame, matrix, [0, 0, 0], policy).radiance, -2);
  for (const i of [1, 2]) frame.planes.EMISSION_ANGLE_IMAGE[i] = Math.PI / 2;
  assert.equal(sampleGeo(frame, matrix, [0, 0, 0], policy).reason, 'grazing');
  frame.planes.EMISSION_ANGLE_IMAGE.set(emissions);
  frame.planes.FACET_INDEX_IMAGE[0] = 0;
  assert.equal(sampleGeo(frame, matrix, [0, 0, 0], policy).radiance, -2);
  frame.planes.FACET_INDEX_IMAGE.set([0, 0, 0]);
  assert.equal(sampleGeo(frame, matrix, [0, 0, 0], policy).reason, 'no-geometry');
  assert.equal(sampleGeo(frame, matrix, [2, 0, 0], policy).reason, 'outside-detector');
});

test('registered filter colors share interpolation and geometry rejection with grayscale', () => {
  const native = decodeOsirisGeo(fixture());
  const frame = { ...native, colorPlanes: [[0, 0, 0, 0], [0, 2, 4, 6], [8, 8, 8, 8]] };
  const matrix = [[1, 0, 0, .5], [0, 1, 0, .5], [0, 0, 1, 1]];
  const policy = { maximumSeparationMeters: 20, maximumEmissionDegrees: 80 };
  const sampled = sampleGeo(frame, matrix, [0, 0, 0], policy);
  assert.equal(sampled.reason, undefined);
  assert.deepEqual('color' in sampled ? sampled.color : undefined, [0, 3, 8]);
  // A pixel on another surface or failing quality leaves every band together.
  native.planes.COORDINATE_Z_IMAGE[3] = .1;
  const withoutFourth = sampleGeo(frame, matrix, [0, 0, 0], policy);
  assert.deepEqual('color' in withoutFourth ? withoutFourth.color : undefined, [0, 2, 8]);
  native.planes.COORDINATE_Z_IMAGE[3] = 0;
  const qualityDropped = sampleGeo({ ...frame, acceptPixel: i => i !== 3 }, matrix, [0, 0, 0], policy);
  assert.deepEqual('color' in qualityDropped ? qualityDropped.color : undefined, [0, 2, 8]);
  assert.equal(sampleGeo({ ...frame, acceptPixel: i => i === 0 }, matrix, [0, 0, 0], policy).reason, 'quality');
});
