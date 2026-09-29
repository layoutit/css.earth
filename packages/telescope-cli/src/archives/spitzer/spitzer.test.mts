import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { archiveUrl, DATA, frameSibling, parseSpitzerProgram } from './archive.mts';
import { naifIdFromHorizonsCode, observationRecords } from './archive-ledger.mts';
import { compareMosaics, LIMITS } from './compare.mts';
import { fileSize } from '@cssearth/telescope/node';
import { channelInputs, FATAL_IMASK_BITS, fatalImaskMask, mosaicMembers, parseMosaicSummary } from './mosaic.mts';

const url = (name: string) => `${DATA}/sha/archive/proc/IRAC003600/r4416768/ch1/${name.includes('maic') || name.includes('munc') || name.includes('mcov') ? 'pbcd' : 'bcd'}/${name}`;
const file = (role: string, name: string, _seed?: string) => ({ role, name, url: url(name), bytes: 100 });
const frameFiles = (dce: string, seed: string) => [
  file('frame', `SPITZER_I1_4416768_${dce}_0000_7_cbcd.fits`, seed),
  file('frame-uncertainty', `SPITZER_I1_4416768_${dce}_0000_7_cbunc.fits`, `${seed}b`),
  file('frame-mask', `SPITZER_I1_4416768_${dce}_0000_7_bimsk.fits`, `${seed}c`),
];
const program = (): Record<string, unknown> => ({
  schema: 'cssearth-spitzer-program@1', id: 'ngc3132-4416768', aorKey: 4416768, programme: '68',
  principalInvestigator: 'Fazio, Giovanni', target: 'NGC 3132', targetRa: 151.757, targetDec: -40.436,
  instrument: 'IRAC', mode: 'IRAC Map', observedFrom: '2003-12-20 21:22:21.4', observedTo: '2003-12-20 21:34:00.0',
  channels: [{
    channel: 1, wavelength: 'IRAC 3.6um', mosaicFrameTimeSeconds: 30,
    mosaic: { width: 2361, height: 1036, crval1: 151.755, crval2: -40.437, pixelScaleArcsec: 0.6, units: 'MJy/sr', creator: 'S18.25.0' },
    products: [file('mosaic', 'SPITZER_I1_4416768_0000_7_E8348771_maic.fits', 'a'),
      file('mosaic-uncertainty', 'SPITZER_I1_4416768_0000_7_A42446624_munc.fits', 'd'),
      file('mosaic-coverage', 'SPITZER_I1_4416768_0000_7_A42446625_mcov.fits', 'e')],
    frames: [
      { dce: '0000', frameTimeSeconds: 1.2, exposureSeconds: 1, dateObs: '2003-12-20T21:25:14.057', files: frameFiles('0000', '1') },
      { dce: '0001', frameTimeSeconds: 30, exposureSeconds: 26.8, dateObs: '2003-12-20T21:25:17.236', files: frameFiles('0001', '2') },
      { dce: '0002', frameTimeSeconds: 1.2, exposureSeconds: 1, dateObs: '2003-12-20T21:26:02.431', files: frameFiles('0002', '3') },
      { dce: '0003', frameTimeSeconds: 30, exposureSeconds: 26.8, dateObs: '2003-12-20T21:26:05.611', files: frameFiles('0003', '4') },
    ],
  }],
});

test('a program is refused unless its bytes belong to the observation it names', () => {
  const valid = parseSpitzerProgram(program());
  assert.equal(valid.channels[0]!.frames.length, 4);
  assert.throws(() => parseSpitzerProgram({ ...program(), schema: 'cssearth-spitzer-program@2' }), /Unsupported/u);
  const noMember = program();
  (noMember.channels as { mosaicFrameTimeSeconds: number }[])[0]!.mosaicFrameTimeSeconds = 12;
  assert.throws(() => parseSpitzerProgram(noMember), /frame time/u);
  const elsewhere = program();
  ((elsewhere.channels as { products: { url: string }[] }[])[0]!.products)[0]!.url = 'https://example.invalid/maic.fits';
  assert.throws(() => parseSpitzerProgram(elsewhere), /not pinned to the Spitzer archive/u);
  const twice = program();
  const frames = (twice.channels as { frames: { dce: string }[] }[])[0]!.frames;
  frames[1]!.dce = '0000';
  assert.throws(() => parseSpitzerProgram(twice), /twice/u);
  const halfPinned = program();
  (halfPinned.channels as { frames: { files: unknown[] }[] }[])[0]!.frames[1]!.files = [file('frame', 'SPITZER_I1_4416768_0001_0000_7_cbcd.fits', '2')];
  assert.throws(() => parseSpitzerProgram(halfPinned), /needs exactly one/u);
});

test('only the frames the archive mosaicked are combined, which in HDR mode is half of them', async () => {
  const pinned = parseSpitzerProgram(program()), channel = pinned.channels[0]!;
  assert.deepEqual(mosaicMembers(channel).map(frame => frame.dce), ['0001', '0003']);
  const directory = await mkdtemp(resolve(tmpdir(), 'spitzer-inputs-'));
  for (const name of [...channel.products.map(product => product.name), ...channel.frames.flatMap(frame => frame.files.map(file => file.name))]) await writeFile(resolve(directory, name), 'x');
  const inputs = await channelInputs(pinned, channel, directory);
  assert.deepEqual(inputs.filter(input => input.role === 'frame').map(input => input.identity),
    ['SPITZER_I1_4416768_0001_0000_7_cbcd.fits', 'SPITZER_I1_4416768_0003_0000_7_cbcd.fits']);
  assert.equal(inputs.filter(input => input.role === 'archive-mosaic').length, 1);
  // The uncertainty planes are pinned but the mosaic does not read them, so they are not inputs to this run.
  assert.equal(inputs.filter(input => input.role === 'frame-uncertainty').length, 0);
  assert.equal(inputs.filter(input => input.role === 'frame-mask').length, 2);
});

test('the imask rejects contaminated pixels and keeps the ones the corrected frame already fixed', () => {
  // The bits are the imask file's own, from its header: 04 saturation corrected in pipeline, 05 muxbleed, 06 banding,
  // 07 column pulldown are artifacts the cbcd has had removed, so a pixel carrying only those is still a measurement.
  // Rejecting them drew the muxbleed rows and pulldown columns of NGC 3132 as holes.
  const rejects = (bits: readonly number[]) => (bits.reduce((mask, bit) => mask | (1 << bit), 0) & fatalImaskMask) !== 0;
  for (const bit of [4, 5, 6, 7]) assert.equal(rejects([bit]), false, `imask bit ${bit} is corrected in the cbcd and must not reject`);
  for (const bit of [3, 8, 9, 10, 11, 12, 13, 14]) assert.equal(rejects([bit]), true, `imask bit ${bit} must reject`);
  assert.equal(rejects([]), false);
  // A pixel that is both corrected and bad is still bad.
  assert.equal(rejects([5, 14]), true);
  assert.deepEqual([...FATAL_IMASK_BITS], [3, 8, 9, 10, 11, 12, 13, 14]);
  assert.equal(fatalImaskMask, 32520);
  assert.match(LIMITS.join(' '), /fatal mask 32520 rejects imask bits 3 and 8–14/u);
});

test('archive paths become archive URLs, and nothing else does', () => {
  assert.equal(archiveUrl('/sha/archive/proc/IRAC003600/r4416768/ch1/pbcd/a_maic.fits'), `${DATA}/sha/archive/proc/IRAC003600/r4416768/ch1/pbcd/a_maic.fits`);
  assert.throws(() => archiveUrl('/elsewhere/a.fits'), /Not an archive path/u);
  assert.throws(() => archiveUrl('/sha/archive/../../etc/passwd'), /Unsafe/u);
  assert.equal(frameSibling(url('SPITZER_I1_4416768_0001_0000_7_cbcd.fits'), 'frame', 'frame-mask'), url('SPITZER_I1_4416768_0001_0000_7_bimsk.fits'));
  assert.throws(() => frameSibling(url('SPITZER_I1_4416768_0001_0000_7_bimsk.fits'), 'frame', 'frame-mask'), /is not a frame file/u);
});

test('a Horizons code becomes a NAIF id only when it is one', () => {
  assert.deepEqual(naifIdFromHorizonsCode('502'), { naifId: 502 });
  assert.deepEqual(naifIdFromHorizonsCode('599'), { naifId: 599 });
  assert.deepEqual(naifIdFromHorizonsCode('1;'), { naifId: 2000001 });
  assert.deepEqual(naifIdFromHorizonsCode('136199;'), { naifId: 2136199 });
  assert.ok('reason' in naifIdFromHorizonsCode('DES=103P;CAP;'));
  assert.ok('reason' in naifIdFromHorizonsCode('2I;'));
  assert.ok('reason' in naifIdFromHorizonsCode(null));
});

function fitsFile(values: readonly number[], width: number, height: number) {
  const data = Math.ceil(values.length * 4 / 2880) * 2880, bytes = Buffer.alloc(2880 + data, 0);
  bytes.fill(32, 0, 2880);
  ['SIMPLE  = T', 'BITPIX  = -32', 'NAXIS   = 2', `NAXIS1  = ${width}`, `NAXIS2  = ${height}`, 'END']
    .forEach((card, index) => bytes.write(card.padEnd(80), index * 80, 'ascii'));
  values.forEach((value, index) => bytes.writeFloatBE(value, 2880 + index * 4));
  return bytes;
}

async function pinned(path: string, role: string) {
  return { path, pin: { role, identity: path.slice(path.lastIndexOf('/') + 1), ...await fileSize(path) } };
}

test('two mosaics are compared only on one grid, and agreement is measured against the archive uncertainty', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'spitzer-compare-'));
  const width = 4, height = 2, n = width * height;
  const theirs = [1, 2, 3, 4, 5, 6, 7, 8], sigma = Array.from({ length: n }, () => 1), cover = Array.from({ length: n }, () => 2);
  const write = async (name: string, values: readonly number[], w = width, h = height) => {
    const path = resolve(directory, name);
    await writeFile(path, fitsFile(values, w, h));
    return path;
  };
  const archive = await write('archive.fits', theirs), unc = await write('unc.fits', sigma), cov = await write('cov.fits', cover);

  const { statistics: same, compared } = await compareMosaics(await pinned(await write('same.fits', theirs), 'our-mosaic'),
    await pinned(archive, 'archive-mosaic'), await pinned(unc, 'archive-uncertainty'), await pinned(cov, 'archive-coverage'));
  assert.deepEqual(compared.map(entry => entry.role).sort(), ['archive-coverage', 'archive-mosaic', 'archive-uncertainty', 'our-mosaic']);
  assert.equal(same.comparedPixels, n);
  assert.equal(same.archiveCoveredPixels, n);
  assert.equal(same.bitIdenticalShare, 1);
  assert.equal(same.medianRatio, 1);
  assert.equal(same.medianAbsoluteDifferenceOverLevel, 0);
  assert.equal(same.shareWithinArchiveSigma, 1);
  assert.equal(same.differenceInArchiveSigma.max, 0);
  assert.ok(same.correlation > 0.999999);

  // Every pixel high by 2, which is two of the archive's own sigmas: nothing is inside one sigma any more.
  const { statistics: off } = await compareMosaics(await pinned(await write('off.fits', theirs.map(value => value + 2)), 'our-mosaic'),
    await pinned(archive, 'archive-mosaic'), await pinned(unc, 'archive-uncertainty'), await pinned(cov, 'archive-coverage'));
  assert.equal(off.bitIdenticalShare, 0);
  assert.equal(off.shareWithinArchiveSigma, 0);
  assert.equal(off.differenceInArchiveSigma.median, 2);
  assert.ok(off.correlation > 0.999999, 'a constant offset does not change the correlation');

  // Pixels the archive does not cover are not compared, and neither are ones our product does not hold.
  const { statistics: partial } = await compareMosaics(await pinned(await write('partial.fits', [1, 2, 3, 4, 5, 6, 7, Number.NaN]), 'our-mosaic'),
    await pinned(archive, 'archive-mosaic'), await pinned(unc, 'archive-uncertainty'),
    await pinned(await write('cov-partial.fits', [2, 2, 2, 2, 0, 0, 0, 2]), 'archive-coverage'));
  assert.equal(partial.comparedPixels, 4);
  assert.equal(partial.archiveCoveredPixels, 5);

  await assert.rejects(compareMosaics(await pinned(await write('small.fits', [1, 2], 2, 1), 'our-mosaic'),
    await pinned(archive, 'archive-mosaic'), await pinned(unc, 'archive-uncertainty'), await pinned(cov, 'archive-coverage')), /not the same grid/u);
});

test('a comparison refuses an archive file that is not its pinned bytes, before it reads a sample', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'spitzer-pins-'));
  const width = 4, height = 2, n = width * height;
  const theirs = [1, 2, 3, 4, 5, 6, 7, 8];
  const write = async (name: string, values: readonly number[]) => {
    const path = resolve(directory, name);
    await writeFile(path, fitsFile(values, width, height));
    return path;
  };
  const ours = await pinned(await write('ours.fits', theirs.map(value => value + 2)), 'our-mosaic');
  const archive = await pinned(await write('archive.fits', theirs), 'archive-mosaic');
  const unc = await pinned(await write('unc.fits', Array.from({ length: n }, () => 1)), 'archive-uncertainty');
  const cov = await pinned(await write('cov.fits', Array.from({ length: n }, () => 2)), 'archive-coverage');

  // As pinned, our product is two of the archive's own sigmas high, so nothing is inside one sigma.
  const honest = await compareMosaics(ours, archive, unc, cov);
  assert.equal(honest.statistics.shareWithinArchiveSigma, 0);

  // Restored bytes compare again, and the identities reported are the ones on disk, not the ones passed in.
  await writeFile(cov.path, fitsFile(Array.from({ length: n }, () => 2), width, height));
  const again = await compareMosaics(ours, archive, unc, cov);
  assert.equal(again.statistics.shareWithinArchiveSigma, 0);
  for (const entry of again.compared) {
    const source = [ours, archive, unc, cov].find(file => file.pin.identity === entry.identity)!;
    assert.equal(entry.bytes, source.pin.bytes);
  }
});

test('a mosaic run reports both the grid it used and the grid its frames imply', () => {
  const summary = parseMosaicSummary({ frames: 12, shape: [1036, 2361], stackBytes: 117407808, coveredPixels: 791713,
    maxContributingFrames: 6, medianContributingFrames: 4, backgroundOffsets: [-0.02, 0.01, 0.01],
    archiveGrid: { shape: [1036, 2361], crval: [151.755, -40.437], pixelScaleArcsec: 0.6 },
    gridImpliedByFrames: { shape: [716, 603], crval: [151.75, -40.43], pixelScaleArcsec: 1.223 } });
  assert.equal(summary.frames, 12);
  assert.equal(summary.gridImpliedByFrames.pixelScaleArcsec, 1.223);
  assert.equal(summary.backgroundOffsets.length, 3);
  assert.throws(() => parseMosaicSummary({ frames: 12, shape: [1036], stackBytes: 1, coveredPixels: 1, maxContributingFrames: 1,
    medianContributingFrames: 1, backgroundOffsets: [], archiveGrid: { shape: [1, 1], crval: [0, 0], pixelScaleArcsec: 1 },
    gridImpliedByFrames: { shape: [1, 1], crval: [0, 0], pixelScaleArcsec: 1 } }), /pair/u);
});

test('archive rows retain the AOR identity, programme, mode and complete time range', () => {
  assert.deepEqual(observationRecords([{ reqkey: '35303936', progid: '61012', modedisplayname: 'IRAC Map PC', reqtitle: 'Itokawa',
    reqbegintime: '2010-05-15 14:35:42.395', reqendtime: '2010-05-15 14:49:52.594' }]), [{ id: '35303936', programme: '61012', mode: 'IRAC Map PC',
    title: 'Itokawa', startIso: '2010-05-15T14:35:42.395Z', endIso: '2010-05-15T14:49:52.594Z' }]);
});
