import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { decodeGiottoFrame, loadPinned } from '../objects/comet-1p/inspect-giotto.mts';

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

test('intake refuses modified cached sources without silently replacing them', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'halley-giotto-test-'));
  try {
    const data = Buffer.from('pinned source');
    const entry = { url: 'https://example.invalid/source.img', file: 'source.img', bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') };
    await writeFile(join(directory, entry.file), data);
    assert.deepEqual(await loadPinned(directory, entry), data);
    const changed = Buffer.from('changed data!');
    await writeFile(join(directory, entry.file), changed);
    await assert.rejects(Reflect.apply(loadPinned, undefined, [directory, entry, true]), /Source pin mismatch/);
    assert.deepEqual(await readFile(join(directory, entry.file)), changed);
  } finally { await rm(directory, { recursive: true }); }
});
