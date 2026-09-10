import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { importTipsyStars, parseTipsyHeader } from './tipsy.ts';

type Star = [number, number, number, number]; // mass, x, y, z
function snapshot(stars: Star[], little = true, gas = 1, dark = 2): Buffer {
  const bytes = Buffer.alloc(32 + gas * 48 + dark * 36 + stars.length * 44);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
  view.setFloat64(0, 2.2, little);
  [gas + dark + stars.length, 3, gas, dark, stars.length, 0].forEach((n, i) => view.setInt32(8 + i * 4, n, little));
  // Distinct non-star values catch accidental whole-file range indexing or wrong family sizes.
  for (let offset = 32; offset < 32 + gas * 48 + dark * 36; offset += 4) view.setFloat32(offset, 9999, little);
  stars.forEach((values, i) => {
    const offset = 32 + gas * 48 + dark * 36 + i * 44;
    values.forEach((value, axis) => view.setFloat32(offset + axis * 4, value, little));
    view.setFloat32(offset + 32, -12345, little); // tform must not classify/remove source stars.
  });
  return bytes;
}
const hash = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
async function fixture(run: (directory: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'tipsy-lab-'));
  try { await run(directory); } finally { await rm(directory, { recursive: true, force: true }); }
}

for (const little of [true, false]) {
  test(`extracts exact xyz/mass after gas and dark records (${little ? 'LE' : 'BE'})`, async () => fixture(async directory => {
    const input = snapshot([[1, -90, 8, 3], [2, 3, 5, 7], [4, 11, 13, 17], [8, 19, 23, 29]], little);
    const snapshotPath = join(directory, 'source.tipsy'), outputPath = join(directory, 'stars.bin');
    await writeFile(snapshotPath, input);
    const receipt = await importTipsyStars({ snapshotPath, outputPath, starRange: { start: 1, count: 2 },
      positionUnit: 'kpc', massUnitSolarMass: 232000,
      expected: { snapshotSha256: hash(input), totalCount: 7, gasCount: 1, darkCount: 2, starCount: 4 } });
    const output = await readFile(outputPath);
    assert.deepEqual(Array.from({ length: 8 }, (_, i) => output.readFloatLE(i * 4)), [3, 5, 7, 2, 11, 13, 17, 4]);
    assert.equal(receipt.source.header.endian, little ? 'little' : 'big');
    assert.equal(receipt.selection.firstSourceByte, 32 + 48 + 72 + 44);
    assert.equal(receipt.source.sha256, hash(input)); assert.equal(receipt.output.sha256, hash(output));
    assert.equal(receipt.mass.sumSolarMass, 6 * 232000);
    assert.deepEqual(receipt.outputStatistics.boundsKpc, { min: [3, 5, 7], max: [11, 13, 17] });
    assert.deepEqual(receipt.centering.offsetKpc, [0, 0, 0]);
  }));
}

test('median centering reports the exact offset and preserves source order/mass', async () => fixture(async directory => {
  const input = snapshot([[2, 40, -8, 12], [3, 10, -2, 20], [5, 20, -4, 10], [7, 30, -6, 14]], false, 0, 0);
  const snapshotPath = join(directory, 'source.tipsy'), outputPath = join(directory, 'stars.bin');
  await writeFile(snapshotPath, input);
  const receipt = await importTipsyStars({ snapshotPath, outputPath, starRange: { start: 0, count: 4 },
    positionUnit: 'kpc', massUnitSolarMass: 1, center: 'median' });
  const b = await readFile(outputPath);
  assert.deepEqual(receipt.centering.offsetKpc, [25, -5, 13]);
  assert.deepEqual(Array.from({ length: 4 }, (_, i) => b.readFloatLE(i * 4)), [15, -3, -1, 2]);
  assert.deepEqual(receipt.sourceStatistics.boundsKpc, { min: [10, -8, 10], max: [40, -2, 20] });
  assert.deepEqual(receipt.outputStatistics.boundsKpc, { min: [-15, -3, -3], max: [15, 3, 7] });
  assert.deepEqual(receipt.outputStatistics.quantilesKpc.find(q => q.probability === 0.5)?.position, [0, 0, 0]);
  assert.equal(receipt.mass.sumSourceUnits, 17);
  assert.deepEqual(receipt.output.maximumPositionRoundingErrorKpc, [0, 0, 0]);
}));

test('header rejects unsupported precision, dimensions, extended counts and corrupt lengths', () => {
  const input = snapshot([[2, 1, 2, 3]]);
  assert.throws(() => parseTipsyHeader(input.subarray(0, 28), input.length), /Truncated/);
  assert.throws(() => parseTipsyHeader(input, input.length - 1), /truncated\/extra/);
  assert.throws(() => parseTipsyHeader(input, input.length + 12 * 4), /Double precision/);
  for (const [offset, value, message] of [[12, 2, /dimensions/], [8, 99, /total count/], [16, -1, /gasCount/], [28, 1, /extended-count/]] as const) {
    const bad = Buffer.from(input); bad.writeInt32LE(value, offset);
    assert.throws(() => parseTipsyHeader(bad, bad.length), message);
  }
  const bad = Buffer.from(input); bad.writeDoubleLE(NaN, 0);
  assert.throws(() => parseTipsyHeader(bad, bad.length), /time must be finite/);
});

test('invalid ranges, source pins and selected positions fail without replacing prior output', async () => fixture(async directory => {
  const snapshotPath = join(directory, 'source.tipsy'), outputPath = join(directory, 'stars.bin');
  await writeFile(snapshotPath, snapshot([[2, 1, 2, 3]])); await writeFile(outputPath, 'prior-output');
  const options = { snapshotPath, outputPath, starRange: { start: 0, count: 1 }, positionUnit: 'kpc' as const, massUnitSolarMass: 1 };
  await assert.rejects(importTipsyStars({ ...options, starRange: { start: 1, count: 1 } }), /exceeds/);
  await assert.rejects(importTipsyStars({ ...options, starRange: { start: -1, count: 1 } }), /range start/);
  await assert.rejects(importTipsyStars({ ...options, starRange: { start: 0, count: 0 } }), /range count/);
  await assert.rejects(importTipsyStars({ ...options, expected: { starCount: 2 } }), /expected source count/);
  await assert.rejects(importTipsyStars({ ...options, expected: { snapshotSha256: '0'.repeat(64) } }), /pinned source/);
  await assert.rejects(importTipsyStars({ ...options, outputPath: snapshotPath }), /replace the source/);
  await writeFile(snapshotPath, snapshot([[2, NaN, 2, 3]]));
  await assert.rejects(importTipsyStars(options), /Nonfinite position/);
  await writeFile(snapshotPath, snapshot([[-2, 1, 2, 3]]));
  await assert.rejects(importTipsyStars(options), /Invalid mass/);
  assert.equal(await readFile(outputPath, 'utf8'), 'prior-output');
}));
