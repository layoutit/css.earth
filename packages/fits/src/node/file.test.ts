import assert from 'node:assert/strict';
import { mkdtemp, open, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after as afterAll, before as beforeAll, test } from 'node:test';
import { readFitsHdus, readFitsImage } from '../index.js';
import { card, imageFixture } from './fixtures/bytes.js';
import { locateFitsHdus, readFitsFileHdus, readFitsFileRegion } from './index.js';

let directory = '';
beforeAll(async () => { directory = await mkdtemp(join(tmpdir(), 'fits-file-')); });
afterAll(async () => { await rm(directory, { recursive: true, force: true }); });

const extension = (values: readonly number[]) => {
  const bytes = imageFixture(16, values, [card('BSCALE', '2'), card('BZERO', '-1'), card('BLANK', '3')]);
  bytes.write(card('XTENSION', "'IMAGE   '"), 0);
  bytes.write([card('PCOUNT', '0'), card('GCOUNT', '1'), 'END'.padEnd(80)].join(''), 8 * 80);
  return bytes;
};

test('HDUs located on disk agree with the byte reader, and regions apply BSCALE, BZERO and BLANK', async () => {
  const values = [0, 1, 2, 3, 4, 5, 6, 7], bytes = Buffer.concat([imageFixture(16, [9, 8]), extension(values)]);
  const path = join(directory, 'two.fits'); await writeFile(path, bytes);
  const located = await readFitsFileHdus(path), parsed = readFitsHdus(bytes);
  assert.deepEqual(located.map(hdu => [hdu.header, hdu.cards, hdu.dataStart, hdu.dataBytes, hdu.bitpix, hdu.dimensions]),
    parsed.map(hdu => [hdu.header, hdu.cards, hdu.dataOffset, hdu.dataBytes, hdu.bitpix, hdu.dimensions]));
  assert.deepEqual(located.map(hdu => hdu.headerStart), [0, 5760]);
  const whole = readFitsImage(bytes, { start: parsed[1]!.dataOffset - 2880 });
  const region = await readFitsFileRegion(path, located[1]!, { x0: 0, y0: 1, width: 2, height: 2 });
  assert.deepEqual([...region.values], [...whole.values.subarray(2, 6)]);
  assert.deepEqual([...region.values], [3, NaN, 7, 9]);
  await assert.rejects(readFitsFileRegion(path, located[1]!, { x0: 1, y0: 0, width: 2, height: 1 }), /outside/);
  await assert.rejects(readFitsFileRegion(path, located[1]!, { x0: 0, y0: 0, width: 2, height: 2 }, 31), /budget/);
});

test('a caller-held handle is used and left open; a truncated file is refused', async () => {
  const path = join(directory, 'one.fits'), bytes = imageFixture(-32, [1, 2, 3, 4]); await writeFile(path, bytes);
  const [hdu] = await readFitsFileHdus(path), handle = await open(path, 'r');
  try {
    assert.deepEqual([...(await readFitsFileRegion(path, hdu!, { x0: 1, y0: 0, width: 1, height: 2 }, undefined, handle)).values], [2, 4]);
    assert.equal((await handle.stat()).size, bytes.length);
  } finally { await handle.close(); }
  const truncated = join(directory, 'truncated.fits'); await writeFile(truncated, bytes.subarray(0, bytes.length - 1));
  await assert.rejects(readFitsFileHdus(truncated), /Truncated/);
});

test('one extension of an archived file is located by reading header records only, and nothing after it', async () => {
  // A primary whose header takes two records, then three extensions; the reader is asked one record at a time, as a byte-range request would be.
  const long = Buffer.from([card('SIMPLE', 'T'), card('BITPIX', '8'), card('NAXIS', '0'), ...Array.from({ length: 40 }, (_, i) => card(`KEY${i}`, String(i))), 'END'.padEnd(80)].join('').padEnd(2 * 2880));
  const bytes = Buffer.concat([long, extension([0, 1]), extension([2, 3]), extension([4, 5])]), reads: [number, number][] = [];
  const read = async (offset: number, length: number) => { reads.push([offset, length]); return bytes.subarray(offset, offset + length); };
  const found: number[] = [];
  for await (const hdu of locateFitsHdus(read, undefined, 2880)) {
    found.push(hdu.headerStart);
    if (found.length === 3) { assert.deepEqual([hdu.dataStart, hdu.dataBytes, hdu.dimensions], [14400, 4, [2, 1]]); break; }
  }
  assert.deepEqual(found, [0, 5760, 11520]);
  // The primary's first record has no END card, so it is read again four records long; each extension header is one record.
  assert.deepEqual(reads, [[0, 2880], [0, 11520], [5760, 2880], [11520, 2880]]);
  await assert.rejects(async () => { for await (const _ of locateFitsHdus(read, undefined, 100)) break; }, /whole 2,880-byte records/u);
});
