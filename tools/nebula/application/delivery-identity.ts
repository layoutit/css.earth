function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Expected nebula delivery receipt.');
  return value as Record<string, unknown>;
}

/** Consumer preparation reuses an installed closure only for the same authored delivery recipe. */
export function installedDeliveryMatchesRecipe(receipt: unknown, recipeSha256: string): boolean {
  return record(receipt).recipeSha256 === recipeSha256;
}
