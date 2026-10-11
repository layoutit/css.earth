import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePlaneBankDescriptor } from './plane-bank.js';

function descriptor() {
  return { schema: 'cssearth-object@2', id: 'zone', type: 'plane-bank', properties: { host: 'star', preparation: { source: 'source/plane.json' },
    frame: { referenceFrame: 'icrf', epochJdTt: 1, originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1],
      metersPerUnit: 100, boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] } } },
    prepared: { format: 'cssearth-galaxy-backing@1', url: 'prepared/plane.json' } };
}
test('a plane bank names its host, its frame and its prepared plane', () => {
  assert.partialDeepStrictEqual(parsePlaneBankDescriptor(descriptor()), { type: 'plane-bank', host: 'star', url: 'prepared/plane.json', frame: { metersPerUnit: 100 } });
});
test('a plane bank without a host, with another prepared format or with an unknown property is refused', () => {
  const hostless = descriptor(); delete (hostless.properties as { host?: string }).host;
  assert.throws(() => parsePlaneBankDescriptor(hostless), /properties\.host: expected the id of the body the plane surrounds/u);
  assert.throws(() => parsePlaneBankDescriptor({ ...descriptor(), prepared: { format: 'cssearth-catalogue-points-bin@2', url: 'prepared/dots.bin' } }), /names its prepared cssearth-galaxy-backing@1 plane/u);
  assert.throws(() => parsePlaneBankDescriptor({ ...descriptor(), properties: { ...descriptor().properties, surrounds: true } }), /unknown surrounds/u);
  const tilted = descriptor(); tilted.properties.frame.localToReferenceXyzw[3] = 2;
  assert.throws(() => parsePlaneBankDescriptor(tilted), /unit quaternion/u);
});
test('a plane bank may state the opacity the orbit lines take beside its picture', () => {
  const stating = (orbitOpacity: unknown) => parsePlaneBankDescriptor({ ...descriptor(), properties: { ...descriptor().properties, orbitOpacity } });
  assert.equal(parsePlaneBankDescriptor(descriptor()).orbitOpacity, undefined, 'left out, the orbits keep theirs');
  assert.equal(stating(.4).orbitOpacity, .4);
  for (const refused of [0, 1, 1.5, '0.4']) assert.throws(() => stating(refused), /properties\.orbitOpacity: expected an opacity between 0 and 1/u, String(refused));
});
test('a plane bank may state the color each body\'s orbit line takes while its dataset shows', () => {
  const stating = (bodyColors: unknown) => parsePlaneBankDescriptor({ ...descriptor(), properties: { ...descriptor().properties, bodyColors } });
  assert.equal(parsePlaneBankDescriptor(descriptor()).bodyColors, undefined);
  assert.deepEqual(stating({ 'planet-b': '#f0f921' }).bodyColors, { 'planet-b': '#f0f921' });
  for (const refused of [{}, [], { 'planet-b': 'yellow' }, { 'Planet B': '#f0f921' }, '#f0f921']) assert.throws(() => stating(refused), /properties\.bodyColors: expected a color like #a0b0c0 for each named body/u, JSON.stringify(refused));
});
