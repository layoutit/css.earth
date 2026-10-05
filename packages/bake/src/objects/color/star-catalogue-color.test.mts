import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readStarTemperature, temperatureCatalogueColor } from './star-catalogue-color.ts';

test('a central star past 100,000 K is read, and takes the display fit\'s hottest color', () => {
  const effectiveTemperatureSource = 'A paper (https://example.org/paper)';
  assert.equal(readStarTemperature({ effectiveTemperatureK: 112200, effectiveTemperatureSource }).kelvin, 112200);
  assert.equal(temperatureCatalogueColor(112200), temperatureCatalogueColor(40000));
  for (const effectiveTemperatureK of [900, 300000]) {
    assert.throws(() => readStarTemperature({ effectiveTemperatureK, effectiveTemperatureSource }), /between 1,000 and 250,000 K/u);
  }
});
