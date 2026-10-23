/** How far a compact source must stand over the light around it, of 255, and as a share of that light, to be taken for one.
 * Measured on two clusters' X-ray pictures: at 6 and a quarter the patches are the picture's grain (586 and 599 of them); at 16
 * and a half they are its point sources (20 and 7), which hold all but a hundredth of the light the lower mark took. */
const STANDS = 16, STANDS_SHARE = .5;

/** A picture's light opened over `radius` pixels: the least value within that reach, along rows and then columns, then
 * the greatest of those. Nothing narrower than twice the radius survives it: it is the light around a compact source. */
export function openedLight(light: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  const count = width * height, reach = (values: Uint8Array, least: boolean) => { const pick = least ? Math.min : Math.max, rows = new Uint8Array(count), out = new Uint8Array(count);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { let value = values[y * width + x]!; for (let i = Math.max(0, x - radius); i <= Math.min(width - 1, x + radius); i++) value = pick(value, values[y * width + i]!); rows[y * width + x] = value; }
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { let value = rows[y * width + x]!; for (let j = Math.max(0, y - radius); j <= Math.min(height - 1, y + radius); j++) value = pick(value, rows[j * width + x]!); out[y * width + x] = value; }
    return out; };
  return reach(reach(light, true), false);
}
/** Whether a pixel's light stands over the light around it by the mark of a compact source. */
export const standsOver = (light: number, around: number): boolean => light - around >= Math.max(STANDS, STANDS_SHARE * around);

/** Compact sources in a picture of diffuse light, taken down to the light around them, in place: an X-ray picture of a
 * cluster's gas also holds point sources (active galaxies, stars), which are not gas. The light around a place is the
 * picture opened over `radius` pixels (the least value within that reach, then the greatest of those): nothing narrower
 * than twice the radius survives it. A patch that stands over that light, and fits in a box four radii across, is a
 * source; a wider one is the gas's own structure and stays. Returns how many sources were taken down. */
export function removeCompactSources(rgb: Buffer, width: number, height: number, radius: number): number {
  const count = width * height, light = new Uint8Array(count); for (let p = 0; p < count; p++) light[p] = Math.max(rgb[3 * p]!, rgb[3 * p + 1]!, rgb[3 * p + 2]!);
  const around = openedLight(light, width, height, radius), stands = (p: number) => standsOver(light[p]!, around[p]!), seen = new Uint8Array(count); let sources = 0;
  for (let start = 0; start < count; start++) { if (seen[start] || !stands(start)) continue;
    // The patch of standing pixels this one belongs to, and the box it fits in.
    const patch = [start]; seen[start] = 1; let left = width, right = -1, top = height, bottom = -1;
    for (let k = 0; k < patch.length; k++) { const p = patch[k]!, x = p % width, y = (p - x) / width; left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
      for (const [i, j] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = x + i, ny = y + j, q = ny * width + nx; if (nx < 0 || ny < 0 || nx >= width || ny >= height || seen[q] || !stands(q)) continue; seen[q] = 1; patch.push(q); } }
    if (right - left > 4 * radius || bottom - top > 4 * radius) continue;
    sources++;
    // The source's skirt is under the mark it stands by: the box is taken down a pixel wider all round.
    for (let y = Math.max(0, top - 1); y <= Math.min(height - 1, bottom + 1); y++) for (let x = Math.max(0, left - 1); x <= Math.min(width - 1, right + 1); x++) { const p = y * width + x; if (!(light[p]! > around[p]!)) continue; for (let c = 0; c < 3; c++) rgb[3 * p + c] = Math.round(rgb[3 * p + c]! * around[p]! / light[p]!); } }
  return sources;
}
