import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, open, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, test } from 'vitest';
import { readFitsHdus, readFitsImage } from '../index.js';
import { card, imageFixture } from '../test-support/fixtures.js';
import { readFitsFileHdus, readFitsFileRegion, sha256FitsData } from './index.js';

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
  const whole = readFitsImage(bytes, { start: parsed[1]!.dataOffset - 2880 });
  const region = await readFitsFileRegion(path, located[1]!, { x0: 0, y0: 1, width: 2, height: 2 });
  assert.deepEqual([...region.values], [...whole.values.subarray(2, 6)]);
  assert.deepEqual([...region.values], [3, NaN, 7, 9]);
  await assert.rejects(readFitsFileRegion(path, located[1]!, { x0: 1, y0: 0, width: 2, height: 1 }), /outside/);
  await assert.rejects(readFitsFileRegion(path, located[1]!, { x0: 0, y0: 0, width: 2, height: 2 }, 31), /budget/);
  const stored = bytes.subarray(located[1]!.dataStart, located[1]!.dataStart + located[1]!.dataBytes);
  assert.equal(await sha256FitsData(path, located[1]!), createHash('sha256').update(stored).digest('hex'));
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
