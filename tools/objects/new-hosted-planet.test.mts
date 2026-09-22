import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { scaffoldHostedPlanetFiles } from './new-hosted-planet.mts';

test('the hosted-planet scaffold refuses to invent a uniform synchronous rotation for an eccentric orbit', () => {
  assert.throws(() => scaffoldHostedPlanetFiles(
    { id: 'test-object', name: 'Test planet', system: 'Test system', description: 'Test', paper: 'https://example.test/paper', paperCredit: 'Test source' },
    { id: 'test-object', physical: { parent: 'test-star' }, hostedOrbit: { eccentricity: .1 } },
    { id: 'test-star' },
    2451545,
  ), /--rotation unmeasured/);
});
