import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { queryCapabilities, type CapabilityRequest, type QueryInputs } from './query.mts';
const inputs: QueryInputs = { ledgers: [], capabilities: [], targetCatalogue: [{ id: 'test', name: 'Test', aliases: [] }], targetAssociations: [], bodyMaps: [] };
const base: CapabilityRequest = { target: 'test', wavelengthMicrometres: [1, 2] };
test('invalid numerical constraints fail before discovery can turn them into scientific answers', () => {
  // Deliberately malformed external values exercise runtime validation, including tuple length.
  for (const wavelengthMicrometres of [[1, Infinity], [NaN, 2], [-1, 2], [2, 1], [1, 2, 3]]) assert.throws(() => queryCapabilities({ ...base, wavelengthMicrometres } as unknown as CapabilityRequest, inputs), /wavelengths/);
  for (const key of ['angularResolutionArcsec', 'surfaceResolutionKm', 'resolutionElements', 'rangeKm', 'bodyRadiusKm']) for (const value of [-1, 0, NaN, Infinity]) assert.throws(() => queryCapabilities({ ...base, [key]: value }, inputs), /finite and positive/);
  for (const time of [{ fromIso: 'garbage', toIso: 'garbage' }, { fromIso: '2024-01-01T00:00:00Z', toIso: '2020-01-01T00:00:00Z' }]) assert.throws(() => queryCapabilities({ ...base, time }, inputs), /ordered time interval/);
  assert.doesNotThrow(() => queryCapabilities({ ...base, time: { fromIso: '2024-01-01T00:00:00Z', toIso: '2024-01-01T00:00:00Z' }, angularResolutionArcsec: 1 }, inputs));
});
