// Entry script: node packages/bake/authoring/m76/lobe-outline.mts <bank directory> <axis position angle> <reach arcsec> <ring radius arcsec>
/**
 * The outline of the Little Dumbbell's two inner lobes, measured on the bank's own picture.
 *
 * Bryce et al. (1996) print the central ring's diameter, the lobes' reach along the bipolar axis and that axis's
 * position angle, not how wide the lobes are. The axis is 14 degrees from the plane of the sky, so the picture shows the
 * lobes from the side and their outline on the sky is their profile, 3 % short along the axis.
 *
 * The picture is read along the axis: every 5 arcseconds, the two places across it where the light, averaged over
 * 4 arcseconds, last stands above a share of the picture's range (its level at 20 % of its pixels to that at 99.5 %).
 * Each lobe is then one body of revolution about the axis (./lobe-surface.mts): an ellipse that reaches the published
 * `reach` and is as wide as the published ring where the two lobes meet, at the star. That leaves one number a lobe,
 * where its middle lies on the axis; its half-width follows. The fit is least squares over the outline from the ring's
 * edge to the reach, both sides of the axis, for the lobe the position angle points to, the other one and the two
 * together, at three shares.
 *
 * Input: the bank's recipe (the picture, its scale and turn, the star's place) and its picture.
 * Output: printed: the outline and, for each share and lobe, the middle and the half-width that fit it.
 */
import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { parseImageLayerRecipe } from '@cssearth/bake/image-layers';

/** The spacing of the picture as read, the half-width read, the step along the axis and the averaging radius, in arcseconds. */
const STEP = 0.5, HALF = 150, ALONG_STEP = 5, AVERAGE = 2;
/** The shares of the picture's range the outline is taken at. */
const SHARES = [0.1, 0.15, 0.2] as const;
/** Where the outline is fitted from: beyond the ring's own edge (its 42 arcsecond width, Bryce et al. 1996, halved). */
const FROM = 25;

const [directory = '', paText = '', reachText = '', ringText = ''] = process.argv.slice(2), axisPa = Number(paText), reach = Number(reachText), ring = Number(ringText);
if (!directory || !Number.isFinite(axisPa) || !(reach > FROM) || !(ring > 0)) throw new TypeError(`Usage: lobe-outline.mts <bank directory> <axis position angle> <reach arcsec over ${FROM}> <ring radius arcsec>; got ${JSON.stringify(process.argv.slice(2))}.`);
const root = checkoutProjectRoot(import.meta.url), source = resolve(root, directory, 'source');
const recipe = parseImageLayerRecipe(JSON.parse(await readFile(resolve(source, 'recipe.json'), 'utf8')));
const RAD = Math.PI / 180, [width, height] = recipe.source.dimensions, scale = recipe.observation.fieldOfViewDeg[0] * 3600 / width, turn = recipe.observation.northClockwiseDeg * RAD;
// North and east on the picture (x right, y down), the star's pixel, and the axis and the direction across it.
const north = [Math.sin(turn), -Math.cos(turn)] as const, east = [-Math.cos(turn), -Math.sin(turn)] as const;
const starEast = (recipe.target.centerRaDeg - recipe.observation.centerRaDeg) * Math.cos(recipe.target.centerDecDeg * RAD) * 3600, starNorth = (recipe.target.centerDecDeg - recipe.observation.centerDecDeg) * 3600;
const star = [(width - 1) / 2 + (starEast * east[0] + starNorth * north[0]) / scale, (height - 1) / 2 + (starEast * east[1] + starNorth * north[1]) / scale] as const;
const toward = (pa: number) => [Math.cos(pa * RAD) * north[0] + Math.sin(pa * RAD) * east[0], Math.cos(pa * RAD) * north[1] + Math.sin(pa * RAD) * east[1]] as const, along = toward(axisPa), across = toward(axisPa + 90);
const { data, info } = await sharp(resolve(source, recipe.source.path)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
if (info.width !== width || info.height !== height) throw new RangeError(`${recipe.source.path} is ${info.width} x ${info.height} px; the recipe says ${width} x ${height}.`);
const N = 2 * HALF / STEP, light = new Float32Array(N * N);
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = -HALF + (i + 0.5) * STEP, c = HALF - (j + 0.5) * STEP, x = Math.round(star[0] + (a * along[0] + c * across[0]) / scale), y = Math.round(star[1] + (a * along[1] + c * across[1]) / scale);
  if (x >= 0 && y >= 0 && x < width && y < height) { const at = 3 * (y * width + x); light[j * N + i] = (data[at]! + data[at + 1]! + data[at + 2]!) / 3; } }
const sorted = Float32Array.from(light).sort(), floor = sorted[Math.floor(0.2 * sorted.length)]!, top = sorted[Math.floor(0.995 * sorted.length)]!, reachCells = Math.round(AVERAGE / STEP);
const averaged = (i: number, j: number) => { let sum = 0, count = 0; for (let dj = -reachCells; dj <= reachCells; dj++) for (let di = -reachCells; di <= reachCells; di++) { const I = i + di, J = j + dj; if (I >= 0 && J >= 0 && I < N && J < N) { sum += light[J * N + I]!; count++; } } return sum / count; };
console.log(`${recipe.source.path}: ${scale.toFixed(5)} arcsec a pixel, the star at pixel ${star.map(value => value.toFixed(1)).join(', ')}; the axis at position angle ${axisPa} deg runs ${along.map(value => value.toFixed(3)).join(', ')} on the picture.`);
for (const share of SHARES) {
  const level = floor + share * (top - floor), outline: { a: number; half: number }[] = [], printed: string[] = [];
  console.log(`share ${share} (level ${level.toFixed(1)}):`);
  for (let a = -reach; a <= reach; a += ALONG_STEP) { const i = Math.round((a + HALF) / STEP - 0.5); let up = NaN, down = NaN;
    for (let j = 0; j < N; j++) if (averaged(i, j) > level) { up = HALF - (j + 0.5) * STEP; break; }
    for (let j = N - 1; j >= 0; j--) if (averaged(i, j) > level) { down = HALF - (j + 0.5) * STEP; break; }
    printed.push(`${a}: ${Number.isNaN(up) ? '-' : up.toFixed(0)}, ${Number.isNaN(down) ? '-' : down.toFixed(0)}`);
    if (Math.abs(a) >= FROM && !Number.isNaN(up) && !Number.isNaN(down)) outline.push({ a, half: Math.max(0, up) }, { a, half: Math.max(0, -down) }); }
  for (const [name, held] of [['the lobe the position angle points to', (a: number) => a > 0], ['the other lobe', (a: number) => a < 0], ['both lobes', () => true]] as const) {
    const places = outline.filter(({ a }) => held(a)); let best = { error: Infinity, middle: 0, wide: 0 };
    // A lobe as wide as the ring at the star: its half-width follows from where its middle is.
    for (let middle = 1; middle < reach / 2 - 0.5; middle += 0.5) { const along = reach - middle, wide = ring / Math.sqrt(1 - (middle / along) ** 2); let error = 0;
      for (const { a, half } of places) { const t = (Math.abs(a) - middle) / along, model = Math.abs(t) < 1 ? wide * Math.sqrt(1 - t * t) : 0; error += (model - half) ** 2; }
      if (error < best.error) best = { error, middle, wide }; }
    console.log(`  ${name}: middle ${best.middle.toFixed(1)} arcsec from the star, half-width ${best.wide.toFixed(1)} arcsec, rms ${Math.sqrt(best.error / places.length).toFixed(1)} arcsec over ${places.length} places.`);
  }
  if (share === SHARES[1]) console.log(`  outline at that share, arcsec along the axis: across it on the two sides\n  ${printed.join('; ')}`);
}
