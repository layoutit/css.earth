import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parsePdsFloatLabel, preparePdsFloatMap } from './pds-float-map.mts';

function label(band: number) {
  return `PDS_VERSION_ID = PDS3
RECORD_TYPE = FIXED_LENGTH
RECORD_BYTES = 16
FILE_RECORDS = 260
^IMAGE = 257
TARGET_NAME = MOON
INSTRUMENT_ID = LROC
INSTRUMENT_HOST_ID = LRO
DATA_SET_ID = "LRO-L-LROC-5-RDR-V1.0"
PRODUCT_ID = TEST_${band}
PRODUCT_VERSION_ID = "v1.2"
MAP_PROJECTION_TYPE = EQUIRECTANGULAR
PROJECTION_LATITUDE_TYPE = PLANETOGRAPHIC
A_AXIS_RADIUS = 1737.4
B_AXIS_RADIUS = 1737.4
C_AXIS_RADIUS = 1737.4
POSITIVE_LONGITUDE_DIRECTION = EAST
CENTER_LATITUDE = 0
CENTER_LONGITUDE = 0
MAP_PROJECTION_ROTATION = 0
MAP_RESOLUTION = ${1 / 45}
SAMPLE_PROJECTION_OFFSET = -0.5
LINE_PROJECTION_OFFSET = 1.5
WESTERNMOST_LONGITUDE = 0
EASTERNMOST_LONGITUDE = 180
MINIMUM_LATITUDE = -90
MAXIMUM_LATITUDE = 90
LINE_SAMPLES = 4
LINES = 4
SAMPLE_TYPE = PC_REAL
SAMPLE_BITS = 32
BANDS = 1
FILTER_NAME = ${band}
CORE_NULL = 16#FF7FFFFB#
CORE_LOW_REPR_SATURATION = 16#FF7FFFFC#
CORE_LOW_INSTR_SATURATION = 16#FF7FFFFD#
CORE_HIGH_REPR_SATURATION = 16#FF7FFFFF#
CORE_HIGH_INSTR_SATURATION = 16#FF7FFFFE#
END
`;
}

test('PDS offsets locate pixel centres; a mismatched map or band is rejected', () => {
  const expected = { productId: 'TEST_643', productVersion: 'v1.2', wavelengthNanometers: 643 };
  const grid = parsePdsFloatLabel(label(643), expected, 1737400);
  // Four pixels cover 0–180 E: the first centre is 22.5 E, not the outer edge.
  assert.equal((0 - grid.sampleOffset) / grid.ppd, 22.5);
  assert.equal((grid.lineOffset - 0) / grid.ppd, 67.5);
  for (const changed of [label(643).replace('PC_REAL', 'IEEE_REAL'), label(643).replace('1737.4', '1738.4'),
    label(643).replace('FILTER_NAME = 643', 'FILTER_NAME = 566'), label(643).replace('v1.2', 'v1.3')])
    assert.throws(() => parsePdsFloatLabel(changed, expected, 1737400));
});

test('mapped photography preserves observed black and rejects missing samples before downsampling', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lroc-map-'));
  try {
    const input = join(root, 'map.IMG'), bytes = Buffer.alloc(4160);
    bytes.write(label(643));
    // Constant rows; two-column box means are 0.125 and 0.625.
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) bytes.writeFloatLE(x / 4, 4096 + (y * 4 + x) * 4);
    bytes.writeUInt32LE(0xff7ffffb, 4096 + 15 * 4);
    await writeFile(input, bytes);
    const profile = { productId: 'TEST_643', productVersion: 'v1.2', wavelengthNanometers: 643,
      gain: 1, gamma: 2, referenceRadiusMeters: 1737400, outputLongitudeOrigin: 0 };
    const native = await preparePdsFloatMap(input, profile, 8, 4);
    assert.deepEqual([...native.rgb.subarray(0, 3)], [0, 0, 0]);
    assert.equal(native.missing[0], 0);
    assert.equal(native.missing[3 * 8 + 3], 1);
    assert.equal(native.missing[4], 1); // The unobserved half of the sphere.
    const reduced = await preparePdsFloatMap(input, profile, 4, 2);
    assert.deepEqual([...reduced.rgb.subarray(0, 3)], [90, 90, 90]); // round(255 * sqrt(0.125)).
    assert.deepEqual([...reduced.rgb.subarray(3, 6)], [202, 202, 202]);
    assert.equal(reduced.missing[5], 1); // No interpolation through a missing observation.
    const shifted = await preparePdsFloatMap(input, { ...profile, outputLongitudeOrigin: 180 }, 8, 4);
    assert.equal(shifted.missing[0], 1);
    assert.deepEqual([...shifted.rgb.subarray(12, 15)], [0, 0, 0]);
    assert.equal(shifted.missing[4], 0); // Longitude rotation preserves the observed zero.
  } finally { await rm(root, { recursive: true, force: true }); }
});
