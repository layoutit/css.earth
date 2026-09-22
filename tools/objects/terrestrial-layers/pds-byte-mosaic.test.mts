import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { decodePdsByteImage, preparePdsByteMosaic } from './pds-byte-mosaic.mts';

function tile(offset: number, value: number) {
  const label = `PDS_VERSION_ID = PDS3
RECORD_TYPE = FIXED_LENGTH
RECORD_BYTES = 180
FILE_RECORDS = 188
^IMAGE = 9
LINES = 180
LINE_SAMPLES = 180
SAMPLE_TYPE = UNSIGNED_INTEGER
SAMPLE_BITS = 8
MISSING_CONSTANT = 0
MAP_PROJECTION_TYPE = EQUIRECTANGULAR
POSITIVE_LONGITUDE_DIRECTION = WEST
CENTER_LATITUDE = 0
CENTER_LONGITUDE = 180
MAP_PROJECTION_ROTATION = 0
A_AXIS_RADIUS = 1
B_AXIS_RADIUS = 1
C_AXIS_RADIUS = 1
MAP_RESOLUTION = 1
LINE_PROJECTION_OFFSET = 89.5
SAMPLE_PROJECTION_OFFSET = ${offset}
END
`;
  const bytes = Buffer.alloc(188 * 180);
  bytes.write(label);
  bytes.fill(value, 8 * 180);
  return bytes;
}

test('PDS western longitudes place both hemispheres without mirroring or hiding dark lakes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pds-mosaic-'));
  try {
    const west = tile(-0.5, 1), east = tile(179.5, 190);
    // A source gap and a feature one degree east of 180E, immediately south of the north pole.
    west[8 * 180] = 0; west[8 * 180 + 1] = 80;
    await writeFile(join(directory, 'west.gz'), gzipSync(west));
    await writeFile(join(directory, 'east.gz'), gzipSync(east));
    const entries = ['west', 'east'].map(id => ({ id, path: `${id}.gz`, width: 180, height: 180,
      projection: { referenceRadiusMeters: 1000 } }));
    const { rgb, missing } = await preparePdsByteMosaic(directory, entries, 360, 180);
    assert.equal(rgb[0], 190);
    assert.equal(missing[180], 1);
    assert.equal(rgb[181 * 3], 80);
    assert.equal(rgb[182 * 3], 1);
    assert.equal(missing[182], 0);
    assert.equal(rgb[((179 * 360) + 359) * 3], 1);
    await assert.rejects(preparePdsByteMosaic(directory, [entries[0], entries[0]], 360, 180), /overlapping/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('PDS rejects truncated data and unsupported raster encoding', () => {
  const bytes = tile(-0.5, 1);
  assert.throws(() => decodePdsByteImage(bytes.subarray(0, -1)), /Unsupported/);
  const invalid = Buffer.from(bytes);
  invalid.write('SAMPLE_BITS = 4', invalid.indexOf('SAMPLE_BITS = 8'));
  assert.throws(() => decodePdsByteImage(invalid), /Unsupported/);
});

test('uncompressed simple cylindrical data preserves interior black shadows under an edge-fill policy', async () => {
  const directory=await mkdtemp(join(tmpdir(),'pds-edge-'));
  try {
    const bytes=tile(-.5,100);
    // Same fixed-size header, but without a declared missing value.
    let header=bytes.subarray(0,8*180).toString('ascii').replace('EQUIRECTANGULAR','"SIMPLE CYLINDRICAL"').replace('MISSING_CONSTANT = 0','COMMENT = no mask');
    bytes.fill(0,0,8*180);bytes.write(header);
    bytes[8*180]=0; bytes[8*180+180]=0; // Connected northern gap.
    bytes[8*180+90*180+30]=0; // Isolated genuine crater shadow.
    await writeFile(join(directory,'map.IMG'),bytes);
    const entry={id:'map',path:'map.IMG',width:180,height:180,projection:{referenceRadiusMeters:1000}};
    const {rgb,missing}=await preparePdsByteMosaic(directory,[entry],360,180,{noData:0,connectedEdge:'north'});
    assert.equal(missing[180],1);
    assert.equal(missing[360+180],1);
    const crater=90*360+180+30;
    assert.equal(missing[crater],0);
    assert.equal(rgb[crater*3],0);
    assert.equal(missing[crater+1],0);
    assert.equal(rgb[(crater+1)*3],100);
  } finally {await rm(directory,{recursive:true,force:true});}
});
