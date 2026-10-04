/** Pure manifest admission; output selection and byte checks remain with the host. */
import { isRecord } from '@cssearth/core';
import { rejectDeliveryExtraKeys, type DeliveryValidationPolicy } from './delivery-validation-policy.js';
export const VOLUME_DATASET_MANIFEST_SCHEMA = 'cssearth-volume-dataset-manifest@1';
export interface VolumeDatasetManifestPolicy extends DeliveryValidationPolicy {
  /** Defaults to entries: native Object.entries admits arrays, strings and scalar outputs. */
  outputs?: 'entries' | 'record';
}
function property(value: unknown, name: string): unknown {
  if (value === null || value === undefined) throw new TypeError(`Cannot read properties of ${value} (reading '${name}')`);
  return Reflect.get(Object(value), name);
}
export function parseVolumeDatasetManifest(value: unknown, policy: VolumeDatasetManifestPolicy): [string, unknown][] {
  policy.assertion.equal(property(value, 'schema'), VOLUME_DATASET_MANIFEST_SCHEMA);
  const outputs = property(value, 'outputs');
  if (policy.outputs === 'record') policy.assertion.ok(isRecord(outputs), 'Delivery outputs must be a record.');
  if (isRecord(value)) rejectDeliveryExtraKeys(value, ['schema', 'outputs'], policy);
  // Do not validate pins here: historical callers inspect bytes only after transport.
  if (outputs === null || outputs === undefined) throw new TypeError('Cannot convert undefined or null to object');
  return Object.entries(outputs);
}
