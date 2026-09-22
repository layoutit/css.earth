import assert from 'node:assert/strict';
import test from 'node:test';
import { scaffoldHostedPlanetFiles } from './new-hosted-planet.mts';

test('the hosted-planet scaffold refuses to invent a uniform synchronous rotation for an eccentric orbit', () => {
  assert.throws(() => scaffoldHostedPlanetFiles(
    { id: 'test-planet', name: 'Test planet', system: 'Test system', description: 'Test', paper: 'https://example.test/paper', paperCredit: 'Test source' },
    { id: 'test-planet', physical: { parent: 'test-star' }, hostedOrbit: { eccentricity: .1 } },
    { id: 'test-star' },
    2451545,
  ), /--rotation unmeasured/);
});
