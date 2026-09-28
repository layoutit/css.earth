import assert from 'node:assert/strict';
import { sourceTest } from '../../../../tests/objects/source-test.mts';
const test = sourceTest();
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseGiottoIndex, surveyGiottoIndex } from './giotto-index.mts';
import { decodeGiottoFrame, loadIntakeSource, parseIntakeManifest } from './inspect-giotto.mts';

function fixture(extra: string[][] = []): [Buffer, Buffer, Buffer] {
  const cards = [
    ['SIMPLE', 'T'], ['BITPIX', '16'], ['NAXIS', '2'], ['NAXIS1', '2'], ['NAXIS2', '3'],
    ['FILTER', "'CLEAR   '"], ...extra,
  ].map(([k,v]) => `${k.padEnd(8)}= ${v}`.padEnd(80));
  const header = Buffer.from((cards.join('') + 'END'.padEnd(80)).padEnd(2880, '\0'));
  const image = Buffer.alloc(2880);
  // First pair is the bottom row. Values cross byte boundaries and include
  // valid zero and negative measurements as well as the source's no-data code.
  [258, -32768, 0, -20, 1000, 20].forEach((v,i) => image.writeInt16BE(v, i*2));
  const label = Buffer.from('LINES = 3\nLINE_SAMPLES = 2\nRECORD_BYTES = 4\nSAMPLE_BITS = 16\nSAMPLE_TYPE = MSB_INTEGER\n');
  return [header, image, label];
}

test('IHW decoder preserves signed radiance, independent validity, bottom-up rows and padding', () => {
  const frame = decodeGiottoFrame(...fixture());
  assert.deepEqual(Array.from(frame.stored), [1000, 20, 0, -20, 258, -32768]);
  assert.deepEqual(Array.from(frame.radiance), [100, 2, 0, -2, 25.8, NaN]);
  assert.deepEqual(Array.from(frame.valid), [1, 1, 1, 1, 1, 0]);
  assert.equal(frame.rasterBytes, 12);
  assert.equal(frame.paddingBytes, 2868);
  assert.equal(frame.valid.length, 6, 'FITS padding must never become extra observations');
});

test('IHW decoder rejects unsupported calibration and ambiguous or incomplete headers', () => {
  for (const extra of [[['BSCALE', '2']], [['BZERO', '100']], [['FILTER', "'RED'"]], [['NAXIS1', '4']]]) {
    assert.throws(() => Reflect.apply(decodeGiottoFrame, undefined, [...fixture(extra)]));
  }
  const noEnd = fixture(); noEnd[0].fill(32, noEnd[0].indexOf('END'), noEnd[0].indexOf('END') + 3);
  assert.throws(() => decodeGiottoFrame(...noEnd), /Unsupported/);
  const truncatedHeader = fixture(); truncatedHeader[0] = truncatedHeader[0].subarray(0, 2879);
  assert.throws(() => decodeGiottoFrame(...truncatedHeader), /Incomplete/);
});

test('IHW decoder cross-checks PDS dimensions and refuses truncated or nonzero padding', () => {
  const mismatch = fixture(); mismatch[2] = Buffer.from(mismatch[2].toString().replace('LINES = 3', 'LINES = 4'));
  assert.throws(() => decodeGiottoFrame(...mismatch), /disagreement/);
  const truncated = fixture(); truncated[1] = truncated[1].subarray(0, 12);
  assert.throws(() => decodeGiottoFrame(...truncated), /padding/);
  const badPadding = fixture(); badPadding[1][12] = 1;
  assert.throws(() => decodeGiottoFrame(...badPadding), /padding/);
});

test('intake accepts current path-based records and refuses truncated cached sources', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'halley-giotto-test-'));
  try {
    const data = Buffer.from('source bytes');
    const entry = { url: 'https://example.invalid/source.img', file: 'source.img', bytes: data.length };
    await writeFile(join(directory, entry.file), data);
    assert.deepEqual(await loadIntakeSource(directory, entry), data);
    const changed = Buffer.from('short');
    await writeFile(join(directory, entry.file), changed);
    await assert.rejects(Reflect.apply(loadIntakeSource, undefined, [directory, entry, true]), /Source byte-count mismatch/);
    assert.deepEqual(await readFile(join(directory, entry.file)), changed);
  } finally { await rm(directory, { recursive: true }); }
});

// The schema migration removed digest pins from source records. Exercise the
// tracked manifest so intake cannot quietly retain the obsolete requirement.
test('intake parses the current source manifest without digest pins', async () => {
  const manifest = parseIntakeManifest(JSON.parse(await readFile(
    new URL('../../../../src/objects/comet-1p/source/reference/giotto-hmc-intake.json', import.meta.url), 'utf8')));
  assert.ok(manifest.frames.length > 0);
  assert.ok(manifest.frames.every(frame => frame.header.bytes > 0 && frame.image.bytes > 0));
});

test('archive indexes preserve detector modes and reject malformed rows', () => {
  const mdm = 'hmc01814 77 80 3436 -294.722560 C CLEAR 1 0 1 1';
  const sdm = 'hmc00001 104 112 681 -11307.695000 C CLEAR 0';
  assert.deepEqual(parseGiottoIndex(mdm, 'mdm')[0], {
    id: 'hmc01814', width: 77, height: 80, imageId: 3436,
    timeToEncounterSeconds: -294.72256, sensor: 'C', filter: 'CLEAR',
    superpixels: [1, 0, 1, 1], mode: 'mdm',
  });
  assert.deepEqual(parseGiottoIndex(sdm, 'sdm')[0].superpixels, [0]);
  for (const invalid of [mdm.replace('77', '0'), mdm.replace('CLEAR', 'GUESS'),
    mdm.replace('1 0 1 1', '1 6 1 1'), mdm.replace('-294.722560', 'NaN')]) {
    assert.throws(() => parseGiottoIndex(invalid, 'mdm'));
  }
  assert.throws(() => parseGiottoIndex(sdm, 'mdm'));
  assert.throws(() => parseGiottoIndex('', 'sdm'));
});

test('archive survey is offline by default and refuses duplicate image identifiers', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'halley-index-test-'));
  try {
    await assert.rejects(surveyGiottoIndex(directory), { code: 'ENOENT' });
    await writeFile(join(directory, 'imghsigi.idx'), 'hmc00001 104 112 681 -11307.695000 C CLEAR 0');
    await writeFile(join(directory, 'imghmigi.idx'), 'hmc01814 77 80 3436 -294.722560 C CLEAR 1 0 1 1');
    const survey = await surveyGiottoIndex(directory);
    assert.equal(survey.report.totalImages, 2);
    assert.equal(survey.frames.length, 1);
    assert.equal(survey.frames[0].image.bytes, 14400, 'Native FITS blocks include raster padding');
    await writeFile(join(directory, 'imghmigi.idx'), 'hmc00001 77 80 3436 -294.722560 C CLEAR 1 0 1 1');
    await assert.rejects(surveyGiottoIndex(directory), /Duplicate archive image/);
  } finally { await rm(directory, { recursive: true }); }
});
