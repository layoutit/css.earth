/** The gas NOX takes for stars. NOX takes compact bright light, and in a supernova remnant the ejecta are compact
 * bright knots: over Cassiopeia A's Webb picture it took the knots with the stars. In that picture a star is blue and
 * the ejecta are red, so the light NOX took is read by its color: where it is not a star's, the picture keeps its own
 * pixels.
 *
 * Measured: the light NOX took, per pixel and channel. A patch is a connected group of pixels that each lost more than
 * `FLOOR` levels in some channel. A patch whose lost light is a star's color (its red no more than `redOverBlue` times
 * its blue) is a star. In any other patch a pixel is still a star's where the light lost within `AROUND` pixels of it
 * is that color: a star in front of a knot is one patch with it. The switch is eased over `EASE` of the ratio either
 * side, so no hard edge is cut through a patch.
 *
 * Presentation choices, from Cassiopeia A's ESA/Webb NIRCam picture (1.62, 3.56 and 4.44 µm as blue, green and red):
 * every constant below and the ratio its bank passes, 0.8. There the lost light, by its patches' red over blue, peaks
 * between 0.25 and 0.5 (the stars), falls to its lowest near 0.8, and tails off above 1 (the knots). */
const FLOOR = 6, AROUND = 2, EASE = 0.15;

export interface StarColorPass { patches: number; starPatches: number; takenPixels: number; givenBackPixels: number }

/** Puts back, in place, the pixels of `starless` (packed 8-bit RGB, `width` x `height`) where the light NOX took from
 * `original` is not a star's color. Returns the patches read, how many were stars, and how many pixels stayed taken or
 * were given back. */
export function giveBackGas(starless: Uint8Array, original: Uint8Array, width: number, height: number, redOverBlue: number): StarColorPass {
  const count = width * height;
  if (starless.length !== count * 3 || original.length !== count * 3) throw new TypeError(`The pictures are not ${width} x ${height} packed RGB.`);
  if (!(redOverBlue > 0 && Number.isFinite(redOverBlue))) throw new RangeError(`A star's red over blue is a positive ratio; got ${redOverBlue}.`);
  const lostRed = new Float32Array(count), lostBlue = new Float32Array(count), inPatch = new Uint8Array(count);
  for (let p = 0; p < count; p++) {
    const red = Math.max(0, original[3 * p]! - starless[3 * p]!), green = Math.max(0, original[3 * p + 1]! - starless[3 * p + 1]!), blue = Math.max(0, original[3 * p + 2]! - starless[3 * p + 2]!);
    lostRed[p] = red; lostBlue[p] = blue; inPatch[p] = Math.max(red, green, blue) > FLOOR ? 1 : 0;
  }
  // Each patch's lost red and blue, over its pixels joined through their eight neighbours.
  const patchOf = new Int32Array(count).fill(-1), star: boolean[] = [], stack: number[] = [];
  for (let start = 0; start < count; start++) {
    if (!inPatch[start] || patchOf[start]! >= 0) continue;
    const id = star.length; let red = 0, blue = 0;
    patchOf[start] = id; stack.push(start);
    for (let p = stack.pop(); p !== undefined; p = stack.pop()) {
      red += lostRed[p]!; blue += lostBlue[p]!;
      const x = p % width, y = (p - x) / width;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy, neighbour = ny * width + nx;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height || !inPatch[neighbour] || patchOf[neighbour]! >= 0) continue;
        patchOf[neighbour] = id; stack.push(neighbour);
      }
    }
    star.push(red <= redOverBlue * blue);
  }
  let takenPixels = 0, givenBackPixels = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const p = y * width + x, id = patchOf[p]!;
    if (id < 0) continue;
    if (star[id]) { takenPixels++; continue; }
    let red = 0, blue = 0;
    for (let dy = -AROUND; dy <= AROUND; dy++) for (let dx = -AROUND; dx <= AROUND; dx++) {
      const near = Math.max(0, Math.min(height - 1, y + dy)) * width + Math.max(0, Math.min(width - 1, x + dx));
      red += lostRed[near]!; blue += lostBlue[near]!;
    }
    // 1 where the light lost around the pixel is a star's color, 0 where it is redder, eased between.
    const ratio = red / Math.max(1e-6, blue), t = Math.max(0, Math.min(1, (redOverBlue * (1 + EASE) - ratio) / (2 * EASE * redOverBlue))), stars = t * t * (3 - 2 * t);
    if (stars >= 0.5) takenPixels++; else givenBackPixels++;
    for (let channel = 0; channel < 3; channel++) starless[3 * p + channel] = Math.round(starless[3 * p + channel]! * stars + original[3 * p + channel]! * (1 - stars));
  }
  return { patches: star.length, starPatches: star.filter(Boolean).length, takenPixels, givenBackPixels };
}
