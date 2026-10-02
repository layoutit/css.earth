/** A list row's distance: parsecs past a thousand read in kpc or Mpc at four significant digits. The galaxy list read
 * "776247.108 pc" for M 31, a precision its distance does not have (2026-10-02). Other units keep three decimals. */
export function listDistance(distance: { readonly value: number; readonly unit: string }): { readonly value: string; readonly unit: string } {
  if (distance.unit === 'pc' && distance.value >= 1000) {
    const mega = distance.value >= 1e6;
    return { value: String(Number((distance.value / (mega ? 1e6 : 1e3)).toPrecision(4))), unit: mega ? 'Mpc' : 'kpc' };
  }
  return { value: String(Number(distance.value.toFixed(3))), unit: distance.unit };
}
