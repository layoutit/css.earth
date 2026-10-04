/** Pure compact density admission; source-owner paths and preparation remain with the host. */
import { isRecord as record } from '@cssearth/core';
import { assertionExpression, rejectDeliveryExtraKeys, type DeliveryAssertion, type DeliveryValidationPolicy } from './delivery-validation-policy.js';
export const COMPACT_DENSITY_DELIVERY_SCHEMA = 'cssearth-compact-density-delivery@1';

/** Envelope only: hosts check source ownership before admitting the method and input pin. */
export function parseCompactDensityDelivery(value: unknown, policy: DeliveryValidationPolicy) {
  const assertion: DeliveryAssertion = policy.assertion;
  assertion.ok(record(value) && value.schema === COMPACT_DENSITY_DELIVERY_SCHEMA && typeof value.id === 'string' && record(value.delivery),
    assertionExpression("assert.ok(record(value) && value.schema === COMPACT_DENSITY_DELIVERY_SCHEMA && typeof value.id === 'string' && record(value.delivery))"));
  const data = value.delivery;
  assertion.ok(typeof data.directory === 'string', assertionExpression("assert.ok(typeof data.directory === 'string')"));
  rejectDeliveryExtraKeys(value, ['schema', 'id', 'delivery'], policy);
  rejectDeliveryExtraKeys(data, ['directory', 'method', 'compactInputs'], policy);
  return { id: value.id, directory: data.directory, method: data.method, compactInputs: data.compactInputs };
}
export function parseCompactDensityInputs(method: unknown, value: unknown, policy: DeliveryValidationPolicy): { path: string } {
  const assertion: DeliveryAssertion = policy.assertion;
  assertion.equal(method, 'finite-emission', 'Compact deliveries regenerate a finite-emission bank.');
  assertion.ok(record(value) && typeof value.path === 'string', assertionExpression("assert.ok(record(value) && typeof value.path === 'string')"));
  rejectDeliveryExtraKeys(value, ['path'], policy);
  return { path: value.path };
}
