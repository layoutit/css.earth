import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { writeArrayBuffer } from 'geotiff';
import sharp from 'sharp';
import { loadNativePhotograph } from './native-photograph-source.mts';

const source = (path: string, bytes: Buffer, width: number, height: number, projection: Record<string, unknown> = {
  kind: 'simple-cylindrical', longitudeDirection: 'east', latitudeType: 'planetocentric'
}) => ({path, width, height, projection});

test('native geographic GeoTIFF uses the published degree origin and excludes each no-data contributor', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cssearth-native-geographic-'));
  try {
    const values = Uint8Array.from({length: 32}, (_, index) => index);
    values[0] = 0;
    const bytes = Buffer.from(writeArrayBuffer(values, {width: 8, height: 4, BitsPerSample: [8], SampleFormat: [1], GDAL_NODATA: '0',
      ModelPixelScale: [45, 45, 0], ModelTiepoint: [0, 0, 0, 0, 90, 0], GeoKeyDirectory: [1, 1, 0, 7,
        1024, 0, 1, 2, 1025, 0, 1, 1, 2054, 0, 1, 9102, 2048, 0, 1, 4326,
        2057, 34736, 1, 0, 2058, 34736, 1, 1], GeoDoubleParams: [1, 1]}));
    await writeFile(join(directory, 'map.tif'), bytes);
    const sampler = await loadNativePhotograph(directory, source('map.tif', bytes, 8, 4, {
      type: 'equirectangular', longitudeDirection: 'east-positive', latitudeType: 'planetocentric', referenceRadiusMeters: 1
    }), {kind: 'geotiff-byte-monochrome', noData: 0, centerLongitude: 0, coordinates: 'degrees', resolutionDegrees: 45,
      origin: [-180, 90], displayRange: [0, 31]});
    const rgb = [0, 0, 0];
    assert.equal(sampler.sample(-112.5, 22.5, rgb), true);
    assert.ok(rgb.every(value => Math.abs(value - 255 * 9 / 31) < 1e-12));
    assert.equal(sampler.sample(-157.5, 67.5, rgb), false);
  } finally { await rm(directory, {recursive: true, force: true}); }
});

test('legacy monochrome GeoTIFF alias supplies its historical channel defaults', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cssearth-native-monochrome-alias-'));
  try {
    const radius = 180 / Math.PI, values = Uint8Array.from({length: 32}, (_, index) => 10 + index);
    values[7] = 0;
    const bytes = Buffer.from(writeArrayBuffer(values, {width: 8, height: 4, BitsPerSample: [8], SampleFormat: [1], GDAL_NODATA: '0',
      ModelPixelScale: [45, 45, 0], ModelTiepoint: [0, 0, 0, 0, 90, 0], ProjectedCSTypeGeoKey: 32767,
      GeoKeyDirectory: [1, 1, 0, 10,
        1024, 0, 1, 1, 1025, 0, 1, 1, 2057, 34736, 1, 0, 2058, 34736, 1, 0,
        3072, 0, 1, 32767, 3075, 0, 1, 17, 3076, 0, 1, 9001,
        3078, 34736, 1, 1, 3088, 34736, 1, 2, 3089, 34736, 1, 1],
      GeoDoubleParams: [radius, 0, 180]}));
    await writeFile(join(directory, 'map.tif'), bytes);
    const sampler = await loadNativePhotograph(directory, source('map.tif', bytes, 8, 4, {
      type: 'equirectangular', referenceRadiusMeters: radius, centerLongitude: 180,
      longitudeDirection: 'east-positive', latitudeType: 'planetocentric'
    }), {kind: 'geotiff-monochrome-alpha', noData: 0, centerLongitude: 180});
    const rgb = [0, 0, 0];
    assert.equal(sampler.sample(202.5, 67.5, rgb), true);
    assert.deepEqual(rgb, [10, 10, 10]);
    assert.equal(sampler.sample(157.5, 67.5, rgb), false, 'the legacy default remains all-channel no-data');
    const expanded = await loadNativePhotograph(directory, source('map.tif', bytes, 8, 4, {
      type: 'equirectangular', referenceRadiusMeters: radius, centerLongitude: 180,
      longitudeDirection: 'east-positive', latitudeType: 'planetocentric'
    }), {kind: 'geotiff-rgb-alpha', noData: 0, centerLongitude: 180, channels: 'rgb', zeroValidity: 'all-channels', colorSpace: 'srgb'});
    assert.equal(expanded.sample(202.5, 67.5, rgb), true, 'an explicit RGB display conversion accepts a one-band GeoTIFF');
    assert.deepEqual(rgb, [10, 10, 10]);
  } finally { await rm(directory, {recursive: true, force: true}); }
});

test('a GeoTIFF declared to wrap longitude samples footprints across its edge meridian', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cssearth-native-wrap-'));
  try {
    const radius = 180 / Math.PI, values = Uint8Array.from({length: 32}, (_, index) => 10 + index);
    const bytes = Buffer.from(writeArrayBuffer(values, {width: 8, height: 4, BitsPerSample: [8], SampleFormat: [1], GDAL_NODATA: '0',
      ModelPixelScale: [45, 45, 0], ModelTiepoint: [0, 0, 0, 0, 90, 0], ProjectedCSTypeGeoKey: 32767,
      GeoKeyDirectory: [1, 1, 0, 10,
        1024, 0, 1, 1, 1025, 0, 1, 1, 2057, 34736, 1, 0, 2058, 34736, 1, 0,
        3072, 0, 1, 32767, 3075, 0, 1, 17, 3076, 0, 1, 9001,
        3078, 34736, 1, 1, 3088, 34736, 1, 2, 3089, 34736, 1, 1],
      GeoDoubleParams: [radius, 0, 180]}));
    await writeFile(join(directory, 'map.tif'), bytes);
    const record = source('map.tif', bytes, 8, 4, {
      type: 'equirectangular', referenceRadiusMeters: radius, centerLongitude: 180,
      longitudeDirection: 'east-positive', latitudeType: 'planetocentric'
    });
    const validity = {kind: 'geotiff-monochrome-alpha', noData: 0, centerLongitude: 180};
    const rgb = [0, 0, 0];
    assert.equal((await loadNativePhotograph(directory, record, validity)).sample(180, 22.5, rgb), false,
      'without the declaration a footprint across the edge meridian is incomplete');
    const wrapped = await loadNativePhotograph(directory, record, {...validity, wrapLongitude: true});
    assert.equal(wrapped.sample(180, 22.5, rgb), true);
    // Half-way between the last (25) and first (18) samples of the second row.
    assert.ok(rgb.every(value => Math.abs(value - 21.5) < 1e-9), String(rgb));
  } finally { await rm(directory, {recursive: true, force: true}); }
});

test('native photographic images preserve connected fill, an explicit crop, and observed black', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cssearth-native-image-'));
  try {
    const pixels = Buffer.alloc(8 * 4 * 3);
    for (let x = 0; x < 8; x++) pixels.set([1, 1, 1], x * 3);
    pixels.set([0, 0, 0], (1 * 8 + 4) * 3);
    for (const x of [1, 2, 5]) for (const y of [1, 2]) pixels.set([40, 80, 120], (y * 8 + x) * 3);
    const bytes = await sharp(pixels, {raw: {width: 8, height: 4, channels: 3}}).png().toBuffer();
    await writeFile(join(directory, 'crop.png'), bytes);
    const sampler = await loadNativePhotograph(directory, source('crop.png', bytes, 8, 4), {
      kind: 'image-rgb-no-data', noData: 0, centerLongitude: 0, connectedEdge: 'north', connectedFillRange: [0, 2],
      grid: {pixelsPerDegree: .05, sampleOffset: 4, lineOffset: 1}
    });
    const rgb = [0, 0, 0];
    assert.equal(sampler.sample(-45, 0, rgb), true);
    assert.deepEqual(rgb, [40, 80, 120]);
    const west = [...rgb];
    assert.equal(sampler.sample(315, 0, rgb), true, 'the same east-positive source longitude may arrive as a negative atan2 angle');
    assert.deepEqual(rgb, west);
    assert.equal(sampler.sample(0, 0, rgb), false, 'north-connected fill remains absent');
    assert.equal(sampler.sample(120, 0, rgb), false, 'a published crop does not wrap across its missing longitude');
  } finally { await rm(directory, {recursive: true, force: true}); }
});

function fitsBytes(values: readonly number[], width: number, height: number) {
  const header = Buffer.from(['SIMPLE  =                    T', 'BITPIX  =                    8', 'NAXIS   =                    2',
    `NAXIS1  = ${String(width).padStart(20)}`, `NAXIS2  = ${String(height).padStart(20)}`, 'BSCALE  =                    1',
    'BZERO   =                    0', 'END'].map(card => card.padEnd(80, ' ')).join(''));
  const paddedHeader = Buffer.concat([header, Buffer.alloc(Math.ceil(header.length / 2880) * 2880 - header.length)]);
  const data = Buffer.from(values), paddedData = Buffer.concat([data, Buffer.alloc(Math.ceil(data.length / 2880) * 2880 - data.length)]);
  return Buffer.concat([paddedHeader, paddedData]);
}

test('native FITS follows its declared east columns and rejects a no-data contributor', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cssearth-native-fits-'));
  try {
    const bytes = fitsBytes([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150,
      160, 170, 180, 190, 200, 210, 220, 230, 240, 250, 251, 252, 253, 254, 255, 42], 8, 4);
    await writeFile(join(directory, 'map.fit'), bytes);
    const sampler = await loadNativePhotograph(directory, source('map.fit', bytes, 8, 4), {
      kind: 'fits-byte-monochrome', bitpix: 8, longitudeDirection: 'east', centerLongitude: 0,
      rowOrder: 'north-to-south', noData: 0, displayRange: [0, 255]
    });
    const rgb = [0, 0, 0];
    assert.equal(sampler.sample(-112.5, 67.5, rgb), true);
    assert.deepEqual(rgb, [10, 10, 10]);
    assert.equal(sampler.sample(-157.5, 67.5, rgb), false, 'the source no-data column participates in the footprint');
  } finally { await rm(directory, {recursive: true, force: true}); }
});
