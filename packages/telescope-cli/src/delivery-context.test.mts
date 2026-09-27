import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { deliveryContext, parseDeliveryContext, sourceContext } from './delivery-context.mts';

const request = { target: 'fixture', wavelengthMicrometres: [1, 2], kind: 'cube', time: { any: true }, angularResolutionArcsec: 1, result: 'telescope-product' };
const assessment = { status: 'unresolved', acceptance: 'all-requested-constraints', constraints: { wavelength: { answer: 'unknown', reason: 'Fixture has no qualified wavelength coverage.' } } };
const exploration = { kind: 'exploration', target: 'fixture', discovery: { schema: 'cssearth-telescope-exploration@1', observation: 'obs-1', snapshot: 'a'.repeat(64) }, assessment: { status: 'not-requested' } };

test('delivery contexts normalize v1 scientific records and validate v2 exploration records', () => {
  assert.deepEqual(deliveryContext({ schema: 'cssearth-telescope-delivery@1', request, satisfaction: assessment }), { kind: 'scientific-request', request, assessment });
  assert.deepEqual(deliveryContext({ schema: 'cssearth-telescope-delivery@2', context: exploration }), exploration);
  assert.deepEqual(sourceContext({ sourceRequest: request, sourceSatisfaction: assessment }), { kind: 'scientific-request', request, assessment });
  assert.deepEqual(sourceContext({ sourceContext: exploration }), exploration);
});

test('not-requested is exclusive to exploration and legacy/new fields cannot conflict', () => {
  assert.throws(() => parseDeliveryContext({ kind: 'scientific-request', request, assessment: { status: 'not-requested' } }), /scientific request assessment/u);
  assert.throws(() => parseDeliveryContext({ ...exploration, assessment: { status: 'unresolved' } }), /Invalid exploration/u);
  assert.throws(() => sourceContext({ sourceContext: exploration, sourceRequest: request, sourceSatisfaction: assessment }), /conflicting/u);
});
