import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { parseTextKernel, numbers, parseLeapSeconds, utcToEt } from '@cssearth/spice';
import { bankKernelPath } from '../../spice/kernel-bank.mts';
import { FRAMELET_HEIGHT, FRAMELET_WIDTH, JUNOCAM_FILTERS, decodeJunocam, frameEpoch, frameletIndex, junocamPixelMapping, junocamStrip, readJunocamLabel } from './junocam.mts';

const kernel = async (path: string) => readFile(await bankKernelPath('juno', path), 'latin1');
const pool = parseTextKernel(await kernel('ik/juno_junocam_v03.ti'), 'juno_junocam_v03.ti');
const leapSeconds = parseLeapSeconds(parseTextKernel(await kernel('lsk/naif0012.tls'), 'naif0012.tls'));

// The label of JNCR_2022272_45C00002_V01 as the PDS Imaging Node serves it, cut to two frames.
const label = (lines = 768, overrides: Record<string, string> = {}) => {
  const fields: Record<string, string> = { PDS_VERSION_ID: 'PDS3', RECORD_TYPE: 'FIXED_LENGTH', RECORD_BYTES: '3296', FILE_RECORDS: String(lines), '^IMAGE': '"JNCR_2022272_45C00002_V01.IMG"',
    SPACECRAFT_NAME: 'JUNO', TARGET_NAME: '"EUROPA"', INSTRUMENT_ID: '"JNC"', DATA_SET_ID: '"JUNO-J-JUNOCAM-3-RDR-L1A-V1.0"', STANDARD_DATA_PRODUCT_ID: '"JUNOCAM-RDR"', PRODUCT_ID: '"JNCR_2022272_45C00002_V01"',
    START_TIME: '2022-09-29T09:39:06.757', STOP_TIME: '2022-09-29T09:39:17.145', SPACECRAFT_CLOCK_START_COUNT: '"717716764:209"', INTERFRAME_DELAY: '0.371 <s>', SAMPLE_BIT_MODE_ID: '"SQROOT"',
    EXPOSURE_DURATION: '6.400000 <ms>', 'JNO:TDI_STAGES_COUNT': '2', SAMPLING_FACTOR: '1', FILTER_NAME: "('BLUE', 'GREEN', 'RED')", ...overrides };
  const image = { LINES: String(lines), LINE_SAMPLES: '1648', SAMPLE_TYPE: 'UNSIGNED_INTEGER', LINE_PREFIX_BYTES: '0', LINE_SUFFIX_BYTES: '0', SAMPLE_BITS: '16', ...Object.fromEntries(Object.entries(overrides).filter(([key]) => ['LINES', 'LINE_SAMPLES', 'SAMPLE_BITS'].includes(key))) };
  const lineOf = ([key, value]: [string, string]) => `${key} = ${value}`;
  return [...Object.entries(fields).filter(([key]) => !Object.hasOwn(image, key)).map(lineOf), 'OBJECT = IMAGE', ...Object.entries(image).map(lineOf), 'END_OBJECT = IMAGE', 'END', ''].join('\r\n');
};

test('a calibrated image label gives the exposure, and any other product is refused', () => {
  const read = readJunocamLabel(label());
  assert.deepEqual(read, { productId: 'JNCR_2022272_45C00002_V01', target: 'EUROPA', startTime: '2022-09-29T09:39:06.757Z', interframeDelaySeconds: 0.371, filters: ['BLUE', 'GREEN', 'RED'],
    lines: 768, frames: 2, exposureMilliseconds: 6.4, tdiStages: 2 });
  assert.throws(() => readJunocamLabel(label(768, { STANDARD_DATA_PRODUCT_ID: '"JUNOCAM-EDR"' })), /STANDARD_DATA_PRODUCT_ID is JUNOCAM-EDR/u, 'a raw, companded product is not reflectance');
  assert.throws(() => readJunocamLabel(label(768, { SAMPLING_FACTOR: '2' })), /SAMPLING_FACTOR is 2/u, 'a summed image does not match the kernel detector');
  assert.throws(() => readJunocamLabel(label(768, { FILTER_NAME: "('BLUE', 'CLEAR')" })), /unsupported filters/u);
  assert.throws(() => readJunocamLabel(label(700)), /700 lines, not whole frames of 3 framelets/u);
  assert.throws(() => readJunocamLabel(label(768, { INTERFRAME_DELAY: '371 <ms>' })), /INTERFRAME_DELAY is 371 <ms>, expected a value in s/u);
});

test('samples are big-endian and scaled to reflectance, framelets follow the label filter order', () => {
  const lines = 768, bytes = Buffer.alloc(FRAMELET_WIDTH * lines * 2);
  // Frame 1, GREEN: framelet 4. Its first sample is 10000, a white Lambertian surface at normal incidence.
  bytes.writeUInt16BE(10000, 4 * FRAMELET_HEIGHT * FRAMELET_WIDTH * 2); bytes.writeUInt16BE(2500, 2);
  const image = decodeJunocam(bytes, label(lines));
  assert.equal(frameletIndex(image.label, 1, 'GREEN'), 4);
  assert.equal(image.values[4 * FRAMELET_HEIGHT * FRAMELET_WIDTH], 1);
  assert.equal(image.values[1], 0.25);
  assert.throws(() => decodeJunocam(bytes.subarray(2), label(lines)), /holds \d+ bytes; its label describes/u);
});

test('strip rays reproduce the field-of-view corners and boresights the instrument kernel lists', () => {
  // The kernel computed them with its own distortion code for pixels (23.5, 0.5), (23.5, 127.5), (1630.5, 127.5), (1630.5, 0.5) and (827, 64),
  // counted from the first pixel's edge; this reader counts from its centre.
  const corners = [[23.5, 0.5], [23.5, 127.5], [1630.5, 127.5], [1630.5, 0.5]];
  for (const [filter, id] of Object.entries(JUNOCAM_FILTERS)) {
    const strip = junocamStrip({ pool }, filter), mapping = junocamPixelMapping(strip), [cx, cy] = strip.model.center, f = strip.model.focalLengthPixels;
    const ray = (x: number, y: number) => { const [px, py] = mapping.toPinhole(x - 0.5, y - 0.5), v = [(px - cx) / f, (py - cy) / f, 1], n = Math.hypot(...v); return v.map(c => c / n); };
    const listed = numbers(pool, `INS${id}_FOV_BOUNDARY_CORNERS`), boresight = numbers(pool, `INS${id}_BORESIGHT`);
    corners.forEach(([x, y], corner) => ray(x, y).forEach((value, axis) => assert.ok(Math.abs(value - listed[corner * 3 + axis]) < 5e-8, `${filter} corner ${corner} axis ${axis}: ${value} against ${listed[corner * 3 + axis]}`)));
    ray(827, 64).forEach((value, axis) => assert.ok(Math.abs(value - boresight[axis]) < 5e-8, `${filter} boresight axis ${axis}`));
    // The mapping is its own inverse to a millionth of a pixel across the detector.
    for (const [x, y] of [[23, 0], [814, 64], [1630, 127], [400, 100]]) { const [px, py] = mapping.toPinhole(x, y), [bx, by] = mapping.fromPinhole(px, py); assert.ok(Math.hypot(bx - x, by - y) < 1e-6); }
  }
});

test('a frame epoch is the label start time, the kernel bias, and one biased interframe delay per frame', () => {
  const strip = junocamStrip({ pool }, 'RED'), read = readJunocamLabel(label());
  assert.equal(strip.startTimeBiasSeconds, 0.06188); assert.equal(strip.interframeDeltaSeconds, 0.001);
  const start = utcToEt(leapSeconds, '2022-09-29T09:39:06.757Z');
  assert.ok(Math.abs(frameEpoch({ leapSeconds }, read, strip, 0) - (start + 0.06188)) < 1e-9);
  assert.ok(Math.abs(frameEpoch({ leapSeconds }, read, strip, 10) - (start + 0.06188 + 10 * 0.372)) < 1e-9);
});
