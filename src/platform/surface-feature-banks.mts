/** Stable string hashing for prepared feature-detail banks. The same function runs at
 * preparation time and in the browser, so a feature id needs no per-row bank pointer. */
export function surfaceFeatureBankIndex(id: string, bankCount: number): number {
  if (!/^[0-9]+$/u.test(id) || !Number.isSafeInteger(bankCount) || bankCount < 1 || bankCount > 256) {
    throw new TypeError('Surface feature bank address is invalid.');
  }
  let hash = 2166136261;
  for (let index = 0; index < id.length; index++) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % bankCount;
}
