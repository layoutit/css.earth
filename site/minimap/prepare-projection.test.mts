import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { minimapDataOnly, prepareMinimapProjection } from './prepare-projection.mts';

test('default minimap preparation still writes the galaxy projection', async () => {
  let projected = 0;
  await prepareMinimapProjection(minimapDataOnly([]), async () => { projected++; });
  assert.equal(projected, 1);
});

test('data-only minimap preparation never reads the image bank', async () => {
  await prepareMinimapProjection(minimapDataOnly(['--data-only']), async () => { throw new Error('Image bank must not be needed for data-only preparation.'); });
});

test('unknown and repeated minimap options fail instead of silently skipping the projection', () => {
  for (const args of [['--typo'], ['--data-only', '--data-only'], ['--data-only', '--typo']])
    assert.throws(() => minimapDataOnly(args), /Usage/);
});
