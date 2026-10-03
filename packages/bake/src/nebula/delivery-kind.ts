import { COMPACT_DENSITY_DELIVERY_SCHEMA, NEBULA_DELIVERY_SCHEMA } from '@cssearth/objects';
export type ApplicationDeliveryKind = 'compact-density' | 'nebula' | null;

/** A generic delivery.json may belong to another preparation owner. */
export function applicationDeliveryKind(filename: 'compact-delivery.json' | 'delivery.json', value: unknown): ApplicationDeliveryKind {
  const schema = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>).schema : undefined;
  if (filename === 'compact-delivery.json') {
    if (schema !== COMPACT_DENSITY_DELIVERY_SCHEMA) throw new TypeError('Unsupported compact density delivery schema.');
    return 'compact-density';
  }
  return schema === NEBULA_DELIVERY_SCHEMA ? 'nebula' : null;
}
