/**
 * A pool that keeps the images it has shown states how many decoded bytes it may hold.
 *
 * A generator marks a pool of selection images `eviction: "capacity"`: the page then keeps an image a selection leaves
 * until the pool is full, so going back to a dataset repaints its faces from an image already in place instead of
 * loading and drawing it again. On an iPad, Bennu's 13-megapixel atlases took 280 ms and 180 ms to come back to after
 * being released, and 80 ms and 74 ms resident (2026-10-05).
 *
 * The byte budget is stated here, after every image has stated its size (prepared-image-sizes.ts): twice what the largest
 * selection needs from the pool, the selection on screen and the one before it, as the paged lanes state theirs
 * (packages/bake/src/objects/layers/paged-ellipsoid/texture-levels.ts). Each entry of the pool states its decoded bytes,
 * which the page counts against the budget.
 *
 * Where two selections exceed KEPT_POOL_BYTES the pool keeps nothing: its mark is taken off, and it releases what a
 * selection leaves, as an unmarked pool does. A pool that reuses one image handle (lighting rows) is bounded by its
 * count and is left alone, as is a pool that already states a budget.
 */

/** The most a pool may keep: what Io, Europa and Callisto state for their surface pages. */
export const KEPT_POOL_BYTES = 408_944_640;

interface Entry { key: string; url: string; pool: string; decodedBytes?: number; width?: number; height?: number }
interface Pool { id: string; reuse: boolean; eviction?: string; maximumDecodedBytes?: number }
interface Definition { id: string; assets: { entries: readonly Entry[]; pools: readonly Pool[] }; variants: readonly { required: readonly string[] }[] }

export function withKeptPoolBudgets<D extends Definition>(definition: D): D {
  const { assets } = definition;
  const marked = assets.pools.filter(pool => pool.eviction === 'capacity' && pool.maximumDecodedBytes === undefined && !pool.reuse);
  if (!marked.length) return definition;
  const byKey = new Map(assets.entries.map(entry => [entry.key, entry]));
  const bytes = (entry: Entry) => {
    if (!(entry.width! > 0) || !(entry.height! > 0)) throw new TypeError(`${definition.id}: image ${entry.key} (${entry.url}) in pool ${entry.pool} states no size, so the pool's byte budget cannot be stated.`);
    return entry.width! * entry.height! * 4;
  };
  const budgets = new Map<string, number | null>();
  for (const pool of marked) {
    // What one selection needs from the pool: each image once, whatever keys name it.
    const largest = Math.max(0, ...definition.variants.map(variant => {
      const images = new Map<string, number>();
      for (const key of variant.required) { const entry = byKey.get(key); if (entry?.pool === pool.id) images.set(entry.url, bytes(entry)); }
      return [...images.values()].reduce((sum, size) => sum + size, 0);
    }));
    if (largest === 0) throw new TypeError(`${definition.id}: pool ${pool.id} keeps images until it is full, but no selection requires one of its images.`);
    budgets.set(pool.id, 2 * largest <= KEPT_POOL_BYTES ? 2 * largest : null);
  }
  const pools = assets.pools.map(pool => {
    const budget = budgets.get(pool.id);
    if (budget === undefined) return pool;
    if (budget !== null) return { ...pool, maximumDecodedBytes: budget };
    const { eviction: _eviction, ...released } = pool;
    return released;
  });
  // An entry states its bytes before its size, as the paged lanes write theirs.
  const entries = assets.entries.map(entry => {
    if (typeof budgets.get(entry.pool) !== 'number' || entry.decodedBytes !== undefined) return entry;
    const { key, url, pool, ...rest } = entry;
    return { key, url, pool, decodedBytes: bytes(entry), ...rest };
  });
  return { ...definition, assets: { ...assets, entries, pools } };
}
