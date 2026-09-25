import assert from 'node:assert/strict';
import { test } from 'vitest';
import { readDaf } from './daf.js';

/** Build a minimal two-segment DAF with the SPK summary shape (ND=2, NI=6). */
export function syntheticDaf({ littleEndian = true, nd = 2, ni = 6, segments = [
  { name: 'first', doubles: [0, 10], integers: [301, 3, 1, 2], data: [1.5, 2.5, 3.5] },
  { name: 'second segment', doubles: [10, 20], integers: [399, 0, 1, 13], data: [7, 8, 9, 10] }] } = {}) {
  const summarySize = nd + Math.ceil(ni / 2), records: Uint8Array[] = [];
  const file = new Uint8Array(1024), view = new DataView(file.buffer);
  const write = (offset: number, text: string) => { for (let i = 0; i < text.length; i++) file[offset + i] = text.charCodeAt(i); };
  write(0, 'DAF/SPK '); view.setInt32(8, nd, littleEndian); view.setInt32(12, ni, littleEndian); write(16, 'synthetic kernel'.padEnd(60));
  view.setInt32(76, 2, littleEndian); view.setInt32(80, 2, littleEndian); view.setInt32(84, 0, littleEndian); write(88, littleEndian ? 'LTL-IEEE' : 'BIG-IEEE');
  records.push(file);
  const summary = new Uint8Array(1024), summaryView = new DataView(summary.buffer), names = new Uint8Array(1024);
  const dataStart = 3 * 128 + 1; let address = dataStart; // data lives in record 4 (words 385-512)
  const placed = segments.map(segment => { const start = address; address += segment.data.length; return { ...segment, start, end: address - 1 }; });
  summaryView.setFloat64(0, 0, littleEndian); summaryView.setFloat64(8, 0, littleEndian); summaryView.setFloat64(16, placed.length, littleEndian);
  placed.forEach((segment, index) => {
    const base = (3 + index * summarySize) * 8;
    segment.doubles.forEach((value, i) => summaryView.setFloat64(base + i * 8, value, littleEndian));
    [...segment.integers, segment.start, segment.end].forEach((value, i) => summaryView.setInt32(base + nd * 8 + i * 4, value, littleEndian));
    const name = segment.name.padEnd(summarySize * 8); for (let i = 0; i < name.length; i++) names[index * summarySize * 8 + i] = name.charCodeAt(i);
  });
  records.push(summary, names);
  const data = new Uint8Array(1024), dataView = new DataView(data.buffer);
  for (const segment of placed) segment.data.forEach((value, i) => dataView.setFloat64((segment.start - dataStart + i) * 8, value, littleEndian));
  records.push(data);
  const out = new Uint8Array(records.length * 1024); records.forEach((record, i) => out.set(record, i * 1024));
  return out;
}

test('reads summaries, names and addressed words in both byte orders', () => {
  for (const littleEndian of [true, false]) {
    const daf = readDaf(syntheticDaf({ littleEndian }));
    assert.equal(daf.idWord, 'DAF/SPK'); assert.equal(daf.internalName, 'synthetic kernel'); assert.equal(daf.littleEndian, littleEndian);
    assert.deepEqual(daf.summaries.map(s => s.name), ['first', 'second segment']);
    assert.deepEqual(daf.summaries[0].doubles, [0, 10]); assert.deepEqual(daf.summaries[0].integers, [301, 3, 1, 2, 385, 387]);
    assert.deepEqual([...daf.words(daf.summaries[0].startAddress, 3)], [1.5, 2.5, 3.5]);
    assert.deepEqual([...daf.words(daf.summaries[1].startAddress, 4)], [7, 8, 9, 10]);
    assert.equal(daf.summaries[1].endAddress, 391);
  }
});

test('refuses files that are not whole records, not DAF, or whose chains and addresses are inconsistent', () => {
  assert.throws(() => readDaf(syntheticDaf().subarray(0, 1500)), /whole 1024-byte records/);
  const notDaf = syntheticDaf(); notDaf.set([65, 66, 67, 68], 0);
  assert.throws(() => readDaf(notDaf), /Not a DAF/);
  const badFormat = syntheticDaf(); badFormat.set(new TextEncoder().encode('VAX-GFLT'), 88);
  assert.throws(() => readDaf(badFormat), /binary format/);
  const daf = readDaf(syntheticDaf());
  assert.throws(() => daf.words(512, 2), /out of range/);
});
