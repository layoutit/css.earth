function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Expected nebula delivery receipt.');
  return value as Record<string, unknown>;
}

/** Consumer preparation reuses an installed closure only for the same authored delivery recipe. */
export function installedDeliveryMatchesRecipe(receipt: unknown, recipeSha256: string): boolean {
  return record(receipt).recipeSha256 === recipeSha256;
}

export type ApplicationDeliveryKind = 'compact-density' | 'nebula' | null;

/** A generic delivery.json may belong to another preparation owner. */
export function applicationDeliveryKind(filename: 'compact-delivery.json' | 'delivery.json', value: unknown): ApplicationDeliveryKind {
  const schema = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>).schema : undefined;
  if (filename === 'compact-delivery.json') {
    if (schema !== 'cssearth-compact-density-delivery@1') throw new TypeError('Unsupported compact density delivery schema.');
    return 'compact-density';
  }
  return schema === 'cssearth-nebula-delivery@1' ? 'nebula' : null;
}
