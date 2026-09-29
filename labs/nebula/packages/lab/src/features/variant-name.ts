/** Browser-safe name of one saved local variant (a random UUID, never a fingerprint of its inputs). */
export const variantNamePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const isVariantName = (value: unknown): value is string => typeof value === 'string' && variantNamePattern.test(value);
