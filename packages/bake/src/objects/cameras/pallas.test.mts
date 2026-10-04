import { setupBakeOracleInputs } from './oracle-inputs.mts';
await setupBakeOracleInputs();
import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { readFitsImage, readFitsHdus, readFitsPrimary } from '@cssearth/fits';
import { readOracleFixture, readOracleInput } from '@cssearth/core/oracle';
import { requireRecord } from '@cssearth/core';

const fixture = await readOracleFixture('packages/bake/src/objects/layers/observation/fixtures/fits/pallas.json');
for (const input of fixture.inputs) test(`Pallas SPHERE image layout and ESO header count: ${input.path}`, async () => {
  const expected = requireRecord(fixture.cases[input.path]), bytes = await readOracleInput(input);
  const image = readFitsImage(bytes), hierarchy = Object.entries(image.header).filter(([key]) => key.startsWith('ESO '));
  assert.equal(readFitsHdus(bytes).length, expected.hduCount);
  assert.deepEqual([image.height, image.width], expected.shape);
  assert.equal(hierarchy.length, expected.hierarchyCount);
  assert.equal(image.values.filter(v => !Number.isFinite(v)).length, expected.nonfinite);
  assert.deepEqual(readFitsPrimary(bytes).values, image.values);
  assert.equal(image.cards.at(-1)?.slice(0, 8).trim(), 'END');
  assert.equal(image.cards.join(''), bytes.toString('latin1', 0, image.cards.length * 80));
});
