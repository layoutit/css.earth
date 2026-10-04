// Entry script: node packages/bake/authoring/homunculus-nebula/model-fit.mts
/**
 * How the published surface of the Homunculus (Steffen et al. 2014, as NASA publishes it for printing) lies on the
 * bank's picture. Smith (2006) gives the pole: 41 degrees from the sight line, toward position angle 310 degrees. The
 * file gives neither its unit, its turn about that pole, the place of the star in it, nor which lobe approaches.
 *
 * Measured here: with the pole as published and the star where the picture shows it, the model's outline is laid on
 * the picture for each end receding, each turn about the pole, each scale and each place of the star near the file's
 * waist; the best is the one whose outline shares the most with the picture's lit pixels (the overlap of the two
 * over their union). The picture's lit pixels are those above a level 35% of the way from its sky to its bright light.
 *
 * Input: `source/recipe.json`, the picture it names and `source/homunculus.stl`. Output: printed.
 */
import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseImageLayerRecipe, stlTriangles } from '@cssearth/bake/image-layers';

/** The picture is searched at a third of its size, and lit above this share of the way from sky to bright. */
const SMALLER = 3, LIT_ABOVE = 0.35;
/** The pole (Smith 2006): its angle from the sight line and the position angle of its receding end, degrees. */
const POLE_TILT_DEG = 41, POLE_PA_DEG = 310;
/** The width of the rings the star's light is measured in, in arcseconds. */
const RING_ARCSEC = 0.1;
/** The waist of the file, where the search for the star starts: the narrowest of its cross-sections along z. */
const WAIST_UNITS = [0.76, 0.1, 0.12] as const;

const sourceDirectory = resolve(checkoutProjectRoot(import.meta.url), 'src/objects/homunculus-nebula-layers/source');
const recipe = parseImageLayerRecipe(JSON.parse(await readFile(resolve(sourceDirectory, 'recipe.json'), 'utf8')) as unknown), rad = Math.PI / 180;
const triangles = stlTriangles(await readFile(resolve(sourceDirectory, 'homunculus.stl')), 'homunculus.stl'), count = triangles.length / 9;
const full = await sharp(resolve(sourceDirectory, recipe.source.path)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const width = Math.round(full.info.width / SMALLER), height = Math.round(full.info.height / SMALLER);
const data = await sharp(resolve(sourceDirectory, recipe.source.path)).resize(width, height).removeAlpha().raw().toBuffer();
// The star: the middle of the picture's saturated pixels, and how far they reach.
let starX = 0, starY = 0, saturated = 0;
for (let y = 0; y < full.info.height; y++) for (let x = 0; x < full.info.width; x++) { const at = 3 * (y * full.info.width + x); if (full.data[at]! > 250 && full.data[at + 1]! > 250 && full.data[at + 2]! > 250) { starX += x; starY += y; saturated++; } }
if (!saturated) throw new Error(`${recipe.source.path} has no saturated pixel to take for the star.`);
const star: [number, number] = [starX / saturated / SMALLER, starY / saturated / SMALLER], arcsecPerPixel = recipe.observation.fieldOfViewDeg[0] * 3600 / full.info.width;
// How far the star's light reaches: the picture's brightness in rings about the star, each `RING_ARCSEC` wide, falls
// until it is the nebula's own. The first ring no brighter than the ten past it is where the star's light ends.
const rings: number[][] = [];
for (let y = 0; y < full.info.height; y++) for (let x = 0; x < full.info.width; x++) { const at = 3 * (y * full.info.width + x), ring = Math.floor(Math.hypot(x - starX / saturated, y - starY / saturated) * arcsecPerPixel / RING_ARCSEC); if (ring < 80) (rings[ring] ??= []).push(Math.max(full.data[at]!, full.data[at + 1]!, full.data[at + 2]!)); }
const middleOf = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!, levels = rings.map(middleOf), ends = levels.findIndex((level, ring) => ring + 10 < levels.length && level <= middleOf(levels.slice(ring + 1, ring + 11)));
if (ends < 0) throw new Error(`${recipe.source.path}: the star's light does not end within ${(rings.length * RING_ARCSEC).toFixed(0)} arcsec of the star.`);
// The picture's lit pixels.
const light = new Float32Array(width * height); for (let p = 0; p < width * height; p++) light[p] = 0.2126 * data[3 * p]! + 0.7152 * data[3 * p + 1]! + 0.0722 * data[3 * p + 2]!;
const sorted = Float32Array.from(light).sort(), sky = sorted[Math.floor(0.3 * sorted.length)]!, bright = sorted[Math.floor(0.9 * sorted.length)]!, lit = new Uint8Array(width * height);
for (let p = 0; p < width * height; p++) if (light[p]! > sky + LIT_ABOVE * (bright - sky)) lit[p] = 1;
// North is turned `northClockwiseDeg` clockwise from up, and east is to its left.
const turn = recipe.observation.northClockwiseDeg * rad, north = [Math.sin(turn), -Math.cos(turn)], east = [-Math.cos(turn), -Math.sin(turn)];
const tilt = POLE_TILT_DEG * rad, pa = POLE_PA_DEG * rad, pole = [Math.sin(tilt) * Math.sin(pa), Math.sin(tilt) * Math.cos(pa), Math.cos(tilt)], across = Math.hypot(pole[0]!, pole[1]!);
const u = [pole[1]! / across, -pole[0]! / across, 0], v = [-(pole[1]! * u[2]! - pole[2]! * u[1]!), -(pole[2]! * u[0]! - pole[0]! * u[2]!), -(pole[0]! * u[1]! - pole[1]! * u[0]!)];

/** How much of the model's outline and the picture's lit pixels is shared: their overlap over their union. */
function shared(receding: 1 | -1, rollDeg: number, pixelsPerUnit: number, origin: readonly [number, number, number]): number {
  const roll = rollDeg * rad, ex = u.map((value, k) => Math.cos(roll) * value + Math.sin(roll) * v[k]!), ey = u.map((value, k) => -Math.sin(roll) * value + Math.cos(roll) * v[k]!), ez = pole.map(value => receding * value);
  const inside = new Uint8Array(width * height), px = [0, 0, 0], py = [0, 0, 0];
  for (let index = 0; index < count; index++) {
    for (let corner = 0; corner < 3; corner++) { const x = triangles[9 * index + 3 * corner]! - origin[0], y = triangles[9 * index + 3 * corner + 1]! - origin[1], z = triangles[9 * index + 3 * corner + 2]! - origin[2];
      const toEast = x * ex[0]! + y * ey[0]! + z * ez[0]!, toNorth = x * ex[1]! + y * ey[1]! + z * ez[1]!; px[corner] = star[0] + pixelsPerUnit * (toEast * east[0]! + toNorth * north[0]!); py[corner] = star[1] + pixelsPerUnit * (toEast * east[1]! + toNorth * north[1]!); }
    const area = (px[1]! - px[0]!) * (py[2]! - py[0]!) - (px[2]! - px[0]!) * (py[1]! - py[0]!); if (Math.abs(area) < 1e-9) continue;
    const x0 = Math.max(0, Math.floor(Math.min(...px))), x1 = Math.min(width - 1, Math.ceil(Math.max(...px))), y0 = Math.max(0, Math.floor(Math.min(...py))), y1 = Math.min(height - 1, Math.ceil(Math.max(...py)));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const w1 = ((x + .5 - px[0]!) * (py[2]! - py[0]!) - (px[2]! - px[0]!) * (y + .5 - py[0]!)) / area, w2 = ((px[1]! - px[0]!) * (y + .5 - py[0]!) - (x + .5 - px[0]!) * (py[1]! - py[0]!)) / area; if (w1 >= 0 && w2 >= 0 && w1 + w2 <= 1) inside[y * width + x] = 1; }
  }
  let both = 0, either = 0; for (let p = 0; p < width * height; p++) { if (inside[p] && lit[p]) both++; if (inside[p] || lit[p]) either++; }
  return both / either;
}

let best = { share: -1, receding: 1 as 1 | -1, rollDeg: 0, pixelsPerUnit: 0, origin: [...WAIST_UNITS] as [number, number, number] };
for (const receding of [1, -1] as const) for (let pixelsPerUnit = 8; pixelsPerUnit <= 50; pixelsPerUnit += 2) for (let rollDeg = 0; rollDeg < 360; rollDeg += 10) { const share = shared(receding, rollDeg, pixelsPerUnit, best.origin); if (share > best.share) best = { ...best, share, receding, rollDeg, pixelsPerUnit }; }
for (let pass = 0; pass < 2; pass++) {
  for (let pixelsPerUnit = best.pixelsPerUnit - 2; pixelsPerUnit <= best.pixelsPerUnit + 2; pixelsPerUnit += 0.5) for (let rollDeg = best.rollDeg - 12; rollDeg <= best.rollDeg + 12; rollDeg += 2) { const share = shared(best.receding, rollDeg, pixelsPerUnit, best.origin); if (share > best.share) best = { ...best, share, rollDeg, pixelsPerUnit }; }
  for (let dx = -0.4; dx <= 0.401; dx += 0.1) for (let dy = -0.4; dy <= 0.401; dy += 0.1) for (let dz = -0.4; dz <= 0.401; dz += 0.2) { const origin: [number, number, number] = [WAIST_UNITS[0] + dx, WAIST_UNITS[1] + dy, WAIST_UNITS[2] + dz], share = shared(best.receding, best.rollDeg, best.pixelsPerUnit, origin); if (share > best.share) best = { ...best, share, origin }; }
}
const unitArcsec = best.pixelsPerUnit * SMALLER * arcsecPerPixel;
console.log(`The star: pixel ${(star[0] * SMALLER).toFixed(0)}, ${(star[1] * SMALLER).toFixed(0)} of ${full.info.width} x ${full.info.height}; ${saturated} saturated pixels, ${(Math.sqrt(saturated / Math.PI) * arcsecPerPixel).toFixed(2)} arcsec in radius. Its light ends ${(ends * RING_ARCSEC).toFixed(1)} arcsec from it: the picture there is as bright (${levels[ends]} of 255) as over the arcsecond past it.`);
console.log(`The model on the picture: the ${best.receding > 0 ? '+z' : '-z'} end recedes, turned ${((best.rollDeg % 360) + 360) % 360} degrees about the pole, ${unitArcsec.toFixed(2)} arcsec a unit, the star at (${best.origin.map(value => value.toFixed(2)).join(', ')}) of the file; its outline shares ${(100 * best.share).toFixed(1)}% with the picture's lit pixels.`);
// Steffen et al. (2014): the lobes' speed is 600 to 680 km/s at 3.4e15 m from the star; Smith (2006): 2350 pc.
let reach = 0; for (let index = 0; index < triangles.length; index += 3) reach = Math.max(reach, Math.abs(triangles[index + 2]! - best.origin[2]));
console.log(`The file's farthest point along its pole is ${reach.toFixed(2)} units from the star: ${(reach * unitArcsec).toFixed(1)} arcsec, ${(reach * unitArcsec * 2350 * 1.495978707e11 / 1e15).toFixed(2)}e15 m at 2350 pc.`);
