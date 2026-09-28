import extents from './prepared-stellar-extents.json' with { type: 'json' };

/** Published stellar extents, radius in metres by object id, prepared from each object's `source/stellar-extent.json`
 * by `pnpm prepare:catalog`. */
export const STELLAR_EXTENTS: Readonly<Record<string, number>> = parseStellarExtents(extents);

export function parseStellarExtents(value: unknown): Readonly<Record<string, number>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('prepared-stellar-extents.json must be an object of radii by object id.');
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([id, radiusM]) => {
    if (typeof radiusM !== 'number' || !(radiusM > 0) || !Number.isFinite(radiusM)) {
      throw new TypeError(`prepared-stellar-extents.json: ${id} needs a positive radius in metres, got ${String(radiusM)}.`);
    }
    return [id, radiusM];
  })));
}
