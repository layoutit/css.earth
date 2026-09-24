import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { createHash } from 'node:crypto';
import { readFitsImage, readFitsHdus } from '@cssearth/fits';
import { readFitsPrimary } from '../objects/observation/fits.mts';
import { readOracleFixture, readOracleInput } from '../oracles/fixture.mts';
import { requireRecord } from '@cssearth/core';

const fixture = await readOracleFixture('fits/pallas.json');
for (const input of fixture.inputs) test(`Pallas SPHERE native pixels and every ESO header: ${input.path}`, async () => {
  const expected = requireRecord(fixture.cases[input.path]), bytes = await readOracleInput(input);
  const image = readFitsImage(bytes), hierarchy = Object.entries(image.header).filter(([key]) => key.startsWith('ESO '));
  assert.equal(readFitsHdus(bytes).length, expected.hduCount);
  assert.deepEqual([image.height, image.width], expected.shape);
  assert.equal(hierarchy.length, expected.hierarchyCount);
  const digest = createHash('sha256');
  for (const [key, value] of hierarchy.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    digest.update(key + '\0', 'ascii');
    if (typeof value === 'number') { const number = Buffer.alloc(8); number.writeDoubleBE(value); digest.update('N').update(number); }
    else if (typeof value === 'string') digest.update('S' + value + '\0', 'ascii');
    else digest.update(value === undefined ? 'U' : value ? 'T' : 'F');
  }
  assert.equal(digest.digest('hex'), expected.hierarchySha256);
  const pixels = Buffer.alloc(image.values.length * 8);
  image.values.forEach((value, i) => pixels.writeDoubleBE(value, i * 8));
  assert.equal(createHash('sha256').update(pixels).digest('hex'), expected.pixelsFloat64BeSha256);
  assert.equal(image.values.filter(v => !Number.isFinite(v)).length, expected.nonfinite);
  assert.deepEqual(readFitsPrimary(bytes).values, image.values);
  assert.equal(image.cards.at(-1)?.slice(0, 8).trim(), 'END');
  assert.equal(image.cards.join(''), bytes.toString('latin1', 0, image.cards.length * 80));
});
