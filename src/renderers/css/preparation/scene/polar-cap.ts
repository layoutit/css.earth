/**
 * The one rule for a polar cap, in every lane (raster spheres, layered oblate bodies, banded giants, the paged globe,
 * cutaway interiors). A cap is a flat plate that closes the top of a band mesh with a disc: its element is the square its
 * round image fills, and the square's corners stand outside the body, so the plate is rounded to the disc and nothing of
 * it can reach past the silhouette at any angle. A cap faces out of the body and is culled like any other face when it
 * turns away; it is never drawn from both sides.
 */
export const POLAR_CAP_STYLE = ';border-radius:50%';

/** Refuses a cap whose plate faces into the body: culled, it would leave a hole at the pole. `matrix` is its matrix3d. */
export function requireOutwardCap(namespace: string, pole: 'north' | 'south', matrix: string, inner = false): void {
  const values = matrix.split(',').map(Number);
  if (values.length !== 16 || values.some(value => !Number.isFinite(value)))
    throw new TypeError(`${namespace}: the ${pole}${inner ? ' inner' : ''} polar cap has no finite matrix3d (${matrix}).`);
  const facing = values[10]! * (pole === 'north' ? 1 : -1);
  if (!(facing > 0))
    throw new Error(`${namespace}: the ${pole}${inner ? ' inner' : ''} polar cap faces into the body (matrix3d z-axis ${values.slice(8, 11).join(',')}); a culled cap would leave a hole at the pole.`);
}
