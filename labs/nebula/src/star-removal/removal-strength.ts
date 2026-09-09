/** Per-source inspection strength, independent of sky placement and display tone. */
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
const key = 'cssearth-nebula-removal-strength-v1';
export function validateRemovalStrength(value: number) {
  if (!Number.isFinite(value) || value < 0 || value > 100) throw new TypeError('Star removal must be between 0 and 100.');
  return value;
}
export function createRemovalStrengthStore(storage?: StoragePort) {
  const values = new Map<string, number>();
  try {
    const data = JSON.parse((storage ?? globalThis.localStorage)?.getItem(key) ?? 'null');
    if (data?.schema === 'cssearth-nebula-removal-strength@1' && Array.isArray(data.values)) for (const row of data.values) {
      try {
        if (Array.isArray(row) && row.length === 2 && typeof row[0] === 'string' && /^[a-z0-9-]+$/.test(row[0]) && typeof row[1] === 'number')
          values.set(row[0], validateRemovalStrength(row[1]));
      } catch { /* Ignore only the malformed source value. */ }
    }
  } catch { /* Local inspection remains available when storage is denied. */ }
  return {
    get: (imageId: string) => values.get(imageId) ?? 100,
    set(imageId: string, value: number) {
      if (!/^[a-z0-9-]+$/.test(imageId)) throw new TypeError('Invalid image identity.');
      values.set(imageId, validateRemovalStrength(value));
      try { (storage ?? globalThis.localStorage)?.setItem(key, JSON.stringify({ schema: 'cssearth-nebula-removal-strength@1', values: [...values] })); }
      catch { /* Keep the current session value if persistence fails. */ }
      return value;
    },
  };
}
