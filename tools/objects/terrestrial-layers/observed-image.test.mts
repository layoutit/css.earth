import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { prepareByteObservation, resizeProjectedValidity } from './observed-image.mts';

test('disk-backed native validity preserves mixed edge footprints for gray and RGB maps', async () => {
  for (const channels of [1, 3] as const) {
    const pixels = Buffer.from([0, 1, 90, 0, 20, 30, 40, 50].flatMap(value => channels === 1 ? [value] : [0, value, 0]));
    const options = {raw: {width: 4, height: 2, channels}};
    const native = await sharp(pixels, options).bandbool('or').threshold(1).toColourspace('b-w').raw().toBuffer();
    for (const width of [2, 4, 8]) {
      const height = width / 2;
      const expected = await sharp(native, {raw: {width: 4, height: 2, channels: 1}})
        .resize(width, height, {fit: 'fill', kernel: 'linear'}).toColourspace('b-w').raw().toBuffer();
      assert.deepEqual(await resizeProjectedValidity(pixels, options, width, height), expected);
      if (width === 2) assert.ok(expected.some(value => value > 0 && value < 255), 'mixed fill footprints remain withheld');
    }
  }
});

test('projected monochrome maps preserve byte brightness and declared gaps', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cssearth-gray-projected-'));
  try {
    const path = join(directory, 'gray.png'), pixels = Buffer.from([0, 1, 90, 180, 20, 30, 40, 50]);
    await sharp(pixels, {raw: {width: 4, height: 2, channels: 1}}).toColourspace('b-w').png().toFile(path);
    const result = await prepareByteObservation(path, {width: 4, height: 2}, {
      kind: 'image-monochrome-no-data', noData: 0, centerLongitude: 180,
      grid: {pixelsPerDegree: 1 / 90, sampleOffset: 1.5, lineOffset: .5}
    }, 4, 2);
    assert.deepEqual([...result.rgb], [...pixels].flatMap(value => [value, value, value]));
    assert.deepEqual([...result.missing], [1, 0, 0, 0, 0, 0, 0, 0]);
  } finally { await rm(directory, {recursive: true, force: true}); }
});

test('projected RGB crops keep their extent, channel identity and dark valid samples', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cssearth-cropped-map-'));
  try {
    const path = join(directory, 'crop.png'), pixels = Buffer.alloc(12 * 5 * 3);
    for (let y = 0; y < 5; y++) for (let x = 0; x < 12; x++) pixels.set([x + 1, y + 1, 0], (y * 12 + x) * 3);
    await sharp(pixels, { raw: { width: 12, height: 5, channels: 3 } }).png().toFile(path);
    const result = await prepareByteObservation(path, { id: 'crop', width: 12, height: 5 }, {
      kind: 'image-rgb-no-data', noData: 0, centerLongitude: 180,
      grid: { pixelsPerDegree: 1 / 30, sampleOffset: 5.5, lineOffset: 2.5 },
    }, 12, 6);
    assert.deepEqual(result.rgb.subarray(0, 12 * 5 * 3), pixels);
    assert.ok(result.missing.subarray(0, 12 * 5).every(v => v === 0));
    assert.ok(result.missing.subarray(12 * 5).every(v => v === 1), 'the cropped south row is not stretched into invented coverage');
    const smaller = await prepareByteObservation(path, { id: 'crop', width: 12, height: 5 }, {
      kind: 'image-rgb-no-data', noData: 0, centerLongitude: 180,
      grid: { pixelsPerDegree: 1 / 30, sampleOffset: 5.5, lineOffset: 2.5 },
    }, 6, 3);
    assert.equal(smaller.rgb.length, 6 * 3 * 3);
    assert.ok(smaller.rgb.some(v => v > 0), 'downsampling retains observed RGB rather than indexing a native-size joined alpha band');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('byte-map coverage preserves dark observations and rolls longitude without mirroring', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cssearth-byte-map-'));
  try {
    const path = join(directory, 'source.png');
    await sharp(Buffer.from([0, 1, 90, 180, 20, 30, 40, 50]),
      { raw: { width: 4, height: 2, channels: 1 } }).toColourspace('b-w').png().toFile(path);
    const entry = { id: 'observed', width: 4, height: 2 };
    const normal = await prepareByteObservation(path, entry, { noData: 0, centerLongitude: 180 }, 4, 2);
    assert.deepEqual([...normal.missing], [1, 0, 0, 0, 0, 0, 0, 0]);
    assert.equal(normal.rgb[3], 1);
    const shifted = await prepareByteObservation(path, entry, { noData: 0, centerLongitude: 0 }, 4, 2);
    assert.deepEqual([...shifted.missing], [0, 0, 1, 0, 0, 0, 0, 0]);
    assert.deepEqual([...shifted.rgb].filter((_, i) => i % 3 === 0), [90, 180, 0, 1, 40, 50, 20, 30]);
    assert.ok('sourceMissingPixels' in normal); assert.equal(normal.sourceMissingPixels, 1);
    const unmasked = await prepareByteObservation(path, entry, { noData: null, centerLongitude: 180 }, 4, 2);
    assert.ok('sourceMissingPixels' in unmasked); assert.equal(unmasked.sourceMissingPixels, 0);
    assert.equal(unmasked.rgb[0], 0, 'Unmasked photographic black is a valid observation');
    const colorPath = join(directory, 'color.png');
    const colors = Buffer.from([0,0,0, 1,20,30, 90,180,20, 30,40,50, 10,11,12, 13,14,15, 16,17,18, 19,20,21]);
    await sharp(colors, {raw:{width:4,height:2,channels:3}}).png().toFile(colorPath);
    const color = await prepareByteObservation(colorPath, entry, {kind:'image-rgb-no-data',noData:null,centerLongitude:180},4,2);
    assert.deepEqual(color.rgb, colors, 'RGB ratios and black pixels survive source preparation');
    assert.ok('sourceMissingPixels' in color); assert.equal(color.sourceMissingPixels,0);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('polar-connected coverage preserves enclosed photographic black before resampling', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cssearth-polar-map-'));
  try {
    const path = join(directory, 'source.png');
    // The right-hand gap reaches the north via the longitude seam. The enclosed
    // black pixel is photographed terrain, not missing coverage.
    await sharp(Buffer.from([0,100,100,100, 0,100,100,0, 100,100,100,100, 100,0,100,100]),
      {raw:{width:4,height:4,channels:1}}).toColourspace('b-w').png().toFile(path);
    const entry = {id:'polar',width:4,height:4};
    const policy = {noData:0,centerLongitude:180,connectedEdge:'north'};
    const result = await prepareByteObservation(path,entry,policy,4,4);
    assert.deepEqual([...result.missing], [1,0,0,0,1,0,0,1,0,0,0,0,0,0,0,0]);
    assert.equal(result.rgb[13*3],0);
    const resized = await prepareByteObservation(path,entry,policy,8,8);
    assert.equal(resized.missing[7*8+3],0,'Enclosed dark terrain stays valid when resized');
    await assert.rejects(prepareByteObservation(path,entry,{...policy,connectedEdge:'typo'},4,4));
  } finally { await rm(directory,{recursive:true,force:true}); }
});

test('a declared compressed gray exterior uses connected coverage without erasing isolated terrain', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cssearth-gray-exterior-'));
  try {
    const path = join(directory, 'source.png');
    const gray = [78,75,110,110, 79,110,110,81, 110,110,110,110, 110,78,110,110];
    await sharp(Buffer.from(gray), {raw:{width:4,height:4,channels:1}}).toColourspace('b-w').png().toFile(path);
    const entry = {id:'gray-exterior',width:4,height:4};
    const policy = {kind:'image-monochrome-no-data',noData:78,centerLongitude:180,
      connectedEdge:'north',connectedFillRange:[75,81]};
    const result = await prepareByteObservation(path,entry,policy,4,4);
    assert.deepEqual([...result.missing], [1,1,0,0,1,0,0,1,0,0,0,0,0,0,0,0]);
    assert.equal(result.rgb[13*3],78);
    assert.ok('sourceMissingPixels' in result); assert.equal(result.sourceMissingPixels,4);
    await assert.rejects(prepareByteObservation(path,entry,{...policy,connectedEdge:undefined},4,4),/range/);
    await assert.rejects(prepareByteObservation(path,entry,{...policy,connectedFillRange:[81,75]},4,4),/range/);
  } finally { await rm(directory,{recursive:true,force:true}); }
});
