import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fromArrayBuffer, writeArrayBuffer} from 'geotiff';
import {parseGeoTiffGridRecipe, prepareGeoTiffGrid, sourcePixel, GridRangeClient} from '@cssearth/bake/objects/acquisition';

const recipe = () => parseGeoTiffGridRecipe({schema: 'cssearth-geotiff-grid@1', source: {
  url: 'https://example.org/observations.tif', productId: 'native', width: 8, height: 2,
  origin: [-180, 45], resolution: [45, -45], coordinates: 'degrees', radius: 1000,
  centerLongitude: 0, noData: -9999, bits: 32, sampleFormat: 3}, output: {width: 4, height: 2, radius: 1000}});

test('native cell centres preserve north/south, zero and missing values without extrapolation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'geotiff-grid-'));
  try {
    const native = new Float32Array([90, 0, 91, -9999, 92, 2.5, 93, 3.5, 94, -4, 95, 5, 96, 6, 97, 7]);
    const file = join(root, 'native.tif');
    await writeFile(file, new Uint8Array(writeArrayBuffer(native, {width: 8, height: 2, SamplesPerPixel: 1,
      BitsPerSample: [32], SampleFormat: [3], GDAL_NODATA: '-9999', PhotometricInterpretation: 1,
      GTModelTypeGeoKey: 2, GeographicTypeGeoKey: 32767,
      ModelPixelScale: [45, 45, 0], ModelTiepoint: [0, 0, 0, -180, 45, 0],
      GeoDoubleParams: [1000], GeoKeyDirectory: [1, 1, 0, 6, 1024, 0, 1, 2, 1025, 0, 1, 1,
        2054, 0, 1, 9102, 2057, 34736, 1, 0, 2058, 34736, 1, 0, 2061, 0, 1, 0]})));
    const r = recipe();
    // At +45 degrees the first row is valid; -45 is outside the native half-open grid.
    const result = await prepareGeoTiffGrid(r, {localPath: file});
    const tiff = await fromArrayBuffer(Uint8Array.from(result.bytes).buffer);
    const data = await (await tiff.getImage()).readRasters({interleave: true});
    assert.deepEqual(Array.from(data), [0, -99999, 2.5, 3.5, -99999, -99999, -99999, -99999]);
    assert.equal(result.report.maxRoundingError, 0);
    assert.equal(result.report.zeroCount, 1);
    assert.equal(result.report.valid, 3);
    await assert.rejects(prepareGeoTiffGrid({...r, source: {...r.source, radius: 1001}}, {localPath: file}), /grid\/encoding changed/);
  } finally {await rm(root, {recursive: true, force: true});}
});

test('projected 180-degree central meridian rolls Mercury and preserves both hemispheres', () => {
  const r = recipe(), circumference = 2 * Math.PI * 1000;
  r.source = {...r.source, coordinates: 'meters', centerLongitude: 180, origin: [-circumference / 2, circumference / 4],
    resolution: [circumference / 8, -circumference / 4]};
  assert.deepEqual(sourcePixel(r, 0, 0), [5, 0]);
  assert.deepEqual(sourcePixel(r, 2, 1), [1, 1]);
});

test('output allocation and encoding are bounded', () => {
  assert.throws(() => parseGeoTiffGridRecipe({...recipe(), output: {width: 100000, height: 50000, radius: 1000}}), /Unbounded/);
  assert.throws(() => parseGeoTiffGridRecipe({...recipe(), source: {...recipe().source, bits: 64}}), /Invalid/);
  assert.throws(() => parseGeoTiffGridRecipe({...recipe(), source: {...recipe().source, bits: '32'}}), /Invalid/);
  assert.throws(() => parseGeoTiffGridRecipe({...recipe(), source: {...recipe().source, sampleFormat: '3'}}), /Invalid/);
});

test('HTTP ranges reject full responses, truncation and changing entities', async () => {
  let calls = 0;
  const client = new GridRangeClient('https://example.org/native.tif', async () => {
    calls++;
    return new Response(new Uint8Array([1, 2, 3, 4]), {status: 206,
      headers: {'content-range': 'bytes 0-3/8', etag: calls === 1 ? '"v1"' : '"v2"'}});
  });
  await client.request({headers: {Range: 'bytes=0-3'}});
  await assert.rejects(client.request({headers: {Range: 'bytes=0-3'}}), /changed during conversion/);
  assert.equal(client.transferredBytes, 4);
  const full = new GridRangeClient(client.url, async () => new Response('full', {status: 200}));
  await assert.rejects(full.request({headers: {Range: 'bytes=0-3'}}), /range response/);
  const short = new GridRangeClient(client.url, async () => new Response('x', {status: 206,
    headers: {'content-range': 'bytes 0-3/8', etag: '"one"'}}));
  await assert.rejects(short.request({headers: {Range: 'bytes=0-3'}}), /Truncated/);
  const long = new GridRangeClient(client.url, async () => new Response('too many bytes', {status: 206,
    headers: {'content-range': 'bytes 0-3/8', etag: '"one"'}}));
  await assert.rejects(long.request({headers: {Range: 'bytes=0-3'}}), /Oversized/);
});
