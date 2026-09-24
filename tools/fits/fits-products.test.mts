import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { readFitsPrimary } from '../objects/observation/fits.mts';
import { readOracleFixture, readOracleInput, sampleList } from '../oracles/fixture.mts';
import { requireRecord } from '@cssearth/core';

const fixture = await readOracleFixture('fits/synoptic.json');
for (const [path, raw] of Object.entries(requireRecord(fixture.cases.products))) test(`Sun/OPAL reference values: ${path}`, async () => {
  const expected = requireRecord(raw), input = fixture.inputs.find(i => i.path === path); assert.ok(input);
  const image = readFitsPrimary(await readOracleInput(input));
  assert.deepEqual([image.height, image.width], expected.shape);
  for (const sample of sampleList(expected.samples)) assert.equal(image.values[sample.index], sample.value);
  let nonfinite = 0, negative = 0, zero = 0;
  for (const value of image.values) { if (!Number.isFinite(value)) nonfinite++; if (value < 0) negative++; if (value === 0) zero++; }
  assert.equal(nonfinite, expected.nonfinite); assert.equal(negative, expected.negative); assert.equal(zero, expected.zero);
});
