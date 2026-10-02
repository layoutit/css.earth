/** Sparse catalogues must not spread a handful of names across the entire zoom range.
 * A floor of 200 keeps roughly ten unnoted names eligible at whole-body framing
 * (share 0.43). Denser catalogues retain their existing progression. Actual label
 * admission still checks projected feature size, facing, overlap and the label cap. */
export function featureDiscoveryZoomShare(rank: number, count: number, noted = false): number {
  return Math.min(1, Math.log10(1 + (noted ? rank / 4 : rank)) / Math.log10(Math.max(200, count)));
}


/** Same folding as the shell's destination search: lower case, no diacritics, single spaces. */
export function normalizeSearchText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export type Vector3 = readonly [number, number, number];
