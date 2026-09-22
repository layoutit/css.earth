import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { parsePdsRgbLabel, preparePdsRgbObservation } from './observed-pds-rgb.mts';

test('PDS RGB planes retain channel order, projected crop and valid single-channel black', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cssearth-pds-rgb-'));
  try {
    const entry = { width: 4, height: 2, projection: { referenceRadiusMeters: 1000 } };
    const policy = { member: 'color.pds', targetName: 'TEST', noData: 0, centerLongitude: 180,
      grid: { pixelsPerDegree: 1 / 90, sampleOffset: 1.5, lineOffset: .5 } };
    const fields = { PDS_VERSION_ID: 'PDS3', RECORD_TYPE: 'FIXED_LENGTH', RECORD_BYTES: 8,
      FILE_RECORDS: 8195, '^IMAGE': 8193, LINE_SAMPLES: 4, LINES: 2, SAMPLE_TYPE: 'UNSIGNED_INTEGER',
      SAMPLE_BITS: 8, BANDS: 3, BAND_STORAGE_TYPE: 'BAND_SEQUENTIAL', TARGET_NAME: 'TEST',
      MAP_PROJECTION_TYPE: 'SIMPLE_CYLINDRICAL', COORDINATE_SYSTEM_NAME: 'PLANETOCENTRIC',
      POSITIVE_LONGITUDE_DIRECTION: 'EAST', CENTER_LATITUDE: 0, CENTER_LONGITUDE: 180,
      MAP_RESOLUTION: 1 / 90, SAMPLE_PROJECTION_OFFSET: 1.5, LINE_PROJECTION_OFFSET: .5,
      A_AXIS_RADIUS: 1, B_AXIS_RADIUS: 1, C_AXIS_RADIUS: 1 };
    const label = Object.entries(fields).map(([k, v]) => `${k} = ${v}`).join('\n') + '\nEND\n';
    const header = Buffer.alloc(65536, 32); header.write(label);
    const pixels = Buffer.from([0, 0, 0, 0, 40, 90, 1, 2, 3, 255, 200, 100, 10, 20, 30, 11, 21, 31, 12, 22, 32, 13, 23, 33]);
    const planes = Buffer.from([0, 1, 2].flatMap(c => Array.from({ length: 8 }, (_, i) => pixels[i * 3 + c])));
    await writeFile(join(dir, 'color.pds'), Buffer.concat([header, planes]));
    execFileSync('zip', ['-q', join(dir, 'source.zip'), 'color.pds'], { cwd: dir });
    const result = await preparePdsRgbObservation(join(dir, 'source.zip'), entry, policy, 4, 2);
    assert.deepEqual(result.rgb, pixels);
    assert.deepEqual([...result.missing], [1, 0, 0, 0, 0, 0, 0, 0]);
    for (const [from, to] of [['TARGET_NAME = TEST', 'TARGET_NAME = OTHER'],
      ['BAND_STORAGE_TYPE = BAND_SEQUENTIAL', 'BAND_STORAGE_TYPE = LINE_INTERLEAVED'],
      ['CENTER_LONGITUDE = 180', 'CENTER_LONGITUDE = 0'], ['FILE_RECORDS = 8195', 'FILE_RECORDS = 8196']]) {
      assert.throws(() => parsePdsRgbLabel(label.replace(from, to), entry, policy), /changed/);
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});
