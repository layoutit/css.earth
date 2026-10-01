import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapLabel } from './map-label.js';

test('a map caption cuts a long catalogue number to its last seven digits and leaves every other name whole', () => {
  assert.equal(mapLabel('Gaia DR3 1003193721988825600'), 'Gaia DR3 …8825600');
  assert.equal(mapLabel('Gaia DR3 473934007432818688 b'), 'Gaia DR3 …2818688 b');
  for (const name of ['EPIC 201367065', 'TIC 123456789', 'HV 2827', 'Betelgeuse', 'OGLE-LMC-ECL-09114 A', 'NGC 4639 Cepheid 12345']) assert.equal(mapLabel(name), name);
});
