/** Where a published picture lies on the sky and in its layer bank's recipe. The file's sky tags give its scale and the
 * direction of north; one pixel set at one place on the sky gives its position: the star the picture shows, or, where it
 * shows none, the pixel the tags themselves give that place. The recipe's plane is the picture's own tangent plane. */
import type { SkyTags } from './esa-image.mts';

const RAD = Math.PI / 180;
/** The picture fades out over the outer tenth of the largest circle about the star that holds none of the frame's edge and
 * none of the picture's empty border. */
export const RIM_FROM = 0.9;
/** A star's saturated patch starts within this many arcseconds of where the tags put it; a peak is looked for this far. */
const PATCH_WITHIN_ARCSEC = 1, PEAK_WITHIN_ARCSEC = 3, SATURATED = 250;
/** A border pixel is empty at or under this level in every channel: a mosaic's unobserved corners are black in the JPEG, give
 * or take its compression (Webb's mid-infrared picture of Cassiopeia A: the same reach at 8 and at 16, 2026-10-05). */
const EMPTY_LEVEL = 8;

export interface Place { readonly centerRaDeg: number; readonly centerDecDeg: number; readonly distancePc: number }
export interface Registration {
  /** The recipe's `observation`. */
  readonly observation: { readonly centerRaDeg: number; readonly centerDecDeg: number; readonly fieldOfViewDeg: readonly [number, number]; readonly northClockwiseDeg: number };
  /** The recipe's plane and rim: the tangent plane at the frame's centre, and the largest circle about the star that holds
   * none of the frame's edge and none of the picture's empty border. */
  readonly plane: { readonly inclinationDeg: number; readonly lineOfNodesPaDeg: number; readonly thicknessKpc: number; readonly supportRadiusKpc: number; readonly supportTaperFraction: number };
  readonly pixelArcsec: number; readonly starFromCentreArcsec: number; readonly circleArcsec: number; readonly widthPc: number;
  /** What the rim's circle stops at: the frame's edge, or the picture's own light where an empty border comes nearer. */
  readonly rimAt: 'frame' | 'light';
}

/** How far from the pixel `at` the picture's own light reaches, in pixels: the distance to the nearest pixel of its empty
 * border, the dark region joined to the frame's edge (a mosaic that does not fill its frame, a square turned on its corner).
 * Infinity for a picture with no such border. `rgb` is three bytes a pixel. */
export function lightReachPixels(rgb: Uint8Array, width: number, height: number, at: readonly [number, number]): number {
  const dark = (p: number) => rgb[3 * p]! <= EMPTY_LEVEL && rgb[3 * p + 1]! <= EMPTY_LEVEL && rgb[3 * p + 2]! <= EMPTY_LEVEL, empty = new Uint8Array(width * height), stack: number[] = [];
  const start = (p: number) => { if (!empty[p] && dark(p)) { empty[p] = 1; stack.push(p); } };
  for (let x = 0; x < width; x++) { start(x); start((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { start(y * width); start(y * width + width - 1); }
  let nearest = Infinity;
  for (let p = stack.pop(); p !== undefined; p = stack.pop()) { const x = p % width, y = (p - x) / width; nearest = Math.min(nearest, Math.hypot(x - at[0], y - at[1]));
    if (x + 1 < width) start(p + 1); if (x > 0) start(p - 1); if (y + 1 < height) start(p + width); if (y > 0) start(p - width); }
  return nearest;
}

/** The pixel, counted from the picture's top left, where its sky tags put a place on the sky. The tags count pixels from
 * the bottom left with the first pixel's middle at 1, as FITS does. */
export function taggedPixel(tags: SkyTags, height: number, place: Pick<Place, 'centerRaDeg' | 'centerDecDeg'>): [number, number] {
  const rot = tags.rotationDeg * RAD, east = ((place.centerRaDeg - tags.reference[0] + 540) % 360 - 180) * Math.cos(place.centerDecDeg * RAD) / tags.scaleDeg, north = (place.centerDecDeg - tags.reference[1]) / tags.scaleDeg;
  return [tags.referencePixel[0] - 1 - east * Math.cos(rot) - north * Math.sin(rot), height - (tags.referencePixel[1] - east * Math.sin(rot) + north * Math.cos(rot))];
}

/** The star a picture shows near `near`, a pixel: the largest patch of saturated pixels that starts within 1 arcsec of it,
 * at the patch's middle; or, where nothing there is saturated, the peak within 3 arcsec that stands highest above its
 * surroundings, at the middle of its light. Undefined when the picture shows neither. `rgb` is three bytes a pixel. */
export function locateStar(rgb: Uint8Array, width: number, height: number, pixelArcsec: number, near: readonly [number, number]): { readonly pixel: [number, number]; readonly found: string } | undefined {
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height, saturated = (p: number) => rgb[3 * p]! >= SATURATED && rgb[3 * p + 1]! >= SATURATED && rgb[3 * p + 2]! >= SATURATED;
  const within = PATCH_WITHIN_ARCSEC / pixelArcsec, seen = new Uint8Array(width * height); let patch = { pixels: 0, x: 0, y: 0 };
  for (let y = Math.max(0, Math.round(near[1] - within)); y <= Math.min(height - 1, near[1] + within); y++) for (let x = Math.max(0, Math.round(near[0] - within)); x <= Math.min(width - 1, near[0] + within); x++) {
    const start = y * width + x; if (seen[start] || !saturated(start) || Math.hypot(x - near[0], y - near[1]) > within) continue;
    let pixels = 0, sumX = 0, sumY = 0; const stack = [start]; seen[start] = 1;
    for (let p = stack.pop(); p !== undefined; p = stack.pop()) { const px = p % width, py = (p - px) / width; pixels++; sumX += px; sumY += py;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const q = (py + dy) * width + px + dx; if (!inside(px + dx, py + dy) || seen[q] || !saturated(q)) continue; seen[q] = 1; stack.push(q); } }
    if (pixels > patch.pixels) patch = { pixels, x: sumX / pixels, y: sumY / pixels };
  }
  if (patch.pixels) return { pixel: [patch.x, patch.y], found: `the largest patch of saturated pixels within ${PATCH_WITHIN_ARCSEC} arcsec of where the tags put it, ${patch.pixels} px` };
  // A peak tops the 5 by 5 pixels about it; it is weighed by how far it stands above the mean of the 15 by 15 about it. A saturated
  // one is a star already passed over: farther than the first rule looks.
  const light = (x: number, y: number) => { const p = 3 * (y * width + x); return (rgb[p]! + rgb[p + 1]! + rgb[p + 2]!) / 3; }, reach = Math.round(PEAK_WITHIN_ARCSEC / pixelArcsec); let peak = { above: 10, x: -1, y: -1 };
  for (let y = Math.round(near[1]) - reach; y <= near[1] + reach; y++) for (let x = Math.round(near[0]) - reach; x <= near[0] + reach; x++) {
    if (!inside(x - 7, y - 7) || !inside(x + 7, y + 7) || saturated(y * width + x)) continue;
    const here = light(x, y); let top = true, sum = 0;
    for (let dy = -7; dy <= 7 && top; dy++) for (let dx = -7; dx <= 7; dx++) { const value = light(x + dx, y + dy); sum += value; if (Math.abs(dx) <= 2 && Math.abs(dy) <= 2 && value > here) { top = false; break; } }
    if (top && here - sum / 225 > peak.above) peak = { above: here - sum / 225, x, y };
  }
  if (peak.x < 0) return undefined;
  let sumX = 0, sumY = 0, weights = 0; const floor = light(peak.x, peak.y) - 0.6 * peak.above;
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const weight = Math.max(0, light(peak.x + dx, peak.y + dy) - floor); sumX += weight * (peak.x + dx); sumY += weight * (peak.y + dy); weights += weight; }
  return { pixel: [sumX / weights, sumY / weights], found: `the peak within ${PEAK_WITHIN_ARCSEC} arcsec of where the tags put it that stands highest above its surroundings, by ${peak.above.toFixed(0)} of 255` };
}

/** A picture `width` by `height` pixels whose pixel `star` stands at `place`: the recipe's observation, plane and rim. */
export function registerPicture(tags: SkyTags, [width, height]: readonly [number, number], star: readonly [number, number], place: Place, lightReach = Infinity): Registration {
  // The picture fades out in a circle about that pixel: a frame that does not hold it is a picture of somewhere else in the object.
  if (!(star[0] >= 1 && star[1] >= 1 && star[0] <= width - 2 && star[1] <= height - 2)) throw new RangeError(`The picture, ${width} x ${height} px, does not hold the place it is to stand at: pixel ${star.map(value => value.toFixed(1)).join(', ')}.`);
  const rot = tags.rotationDeg * RAD, north = [-Math.sin(rot), -Math.cos(rot)] as const, east = [-Math.cos(rot), Math.sin(rot)] as const, dx = star[0] - (width - 1) / 2, dy = star[1] - (height - 1) / 2;
  const pixelArcsec = tags.scaleDeg * 3600, starEast = pixelArcsec * (dx * east[0] + dy * east[1]), starNorth = pixelArcsec * (dx * north[0] + dy * north[1]);
  const fieldOfViewDeg = [Number((width * tags.scaleDeg).toPrecision(7)), Number((height * tags.scaleDeg).toPrecision(7))] as const;
  const kpcPerDeg = place.distancePc / 1e3 * RAD, pcPerArcsec = kpcPerDeg * 1000 / 3600, widthPc = fieldOfViewDeg[0] * kpcPerDeg * 1000, starFromCentreArcsec = Math.hypot(starEast, starNorth);
  const frameReach = Math.min(star[0], width - 1 - star[0], star[1], height - 1 - star[1]), circleArcsec = Math.floor(10 * pixelArcsec * Math.min(frameReach, lightReach)) / 10;
  if (!(circleArcsec > 0)) throw new RangeError(`The picture's empty border reaches the place it is to stand at, pixel ${star.map(value => value.toFixed(1)).join(', ')}: it has no light there to draw.`);
  return {
    observation: { centerRaDeg: Number((place.centerRaDeg - starEast / 3600 / Math.cos(place.centerDecDeg * RAD)).toFixed(7)), centerDecDeg: Number((place.centerDecDeg - starNorth / 3600).toFixed(7)), fieldOfViewDeg, northClockwiseDeg: Number((-tags.rotationDeg).toFixed(3)) },
    // The plane faces the Sun along the sight line through the frame's centre: its tilt at the star is the star's distance from that centre.
    plane: { inclinationDeg: Number(Math.max(starFromCentreArcsec / 3600, 0.001).toPrecision(4)), lineOfNodesPaDeg: Number((((Math.atan2(-starEast, -starNorth) / RAD + 90) % 360 + 360) % 360).toFixed(3)),
      thicknessKpc: Number((widthPc / 2e6).toPrecision(3)), supportRadiusKpc: Number((circleArcsec * pcPerArcsec / 1000).toPrecision(5)), supportTaperFraction: RIM_FROM },
    pixelArcsec, starFromCentreArcsec, circleArcsec, widthPc, rimAt: lightReach < frameReach ? 'light' : 'frame',
  };
}
