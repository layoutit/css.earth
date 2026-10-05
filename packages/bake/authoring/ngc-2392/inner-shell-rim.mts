// Entry script: node packages/bake/authoring/ngc-2392/inner-shell-rim.mts [bank]
/**
 * The outline of NGC 2392's inner shell on the sky, measured on the bank's picture. No paper read prints the outline
 * with its direction, and the wall the bake lays the shell's light on must hold all of it.
 *
 * Along each position angle from the central star, the rim is where the light, going outward from the bright rim's
 * peak, has fallen half way to the darkest level of the gap beyond it. The outline is the smallest ellipse centred on
 * the star that holds every rim point; the recipe's `geometry.shape.inner` rounds its semi-axes up to 0.1 arcsec.
 *
 * Input: `source/source.jpg` and the recipe's registration (`source/recipe.json`) of the bank named, the Hubble
 * photograph's when none is: the nebula's other pictures are measured the same way. Output: printed.
 */
import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseImageLayerRecipe } from '@cssearth/bake/image-layers';

/** The rim's peak is looked for between these distances from the star, and the gap out to the last, in arcseconds. */
const PEAK_FROM = 5, PEAK_TO = 12, GAP_TO = 15, STEP = 0.05, EVERY_DEG = 5;
/** The star is looked for this far from where the registration puts it, in arcseconds. */
const STAR_SEARCH = 0.5;

const bank = process.argv[2] ?? 'ngc-2392-layers';
if (!/^ngc-2392(?:-[a-z0-9]+)*-layers$/u.test(bank)) throw new TypeError(`${bank} is not a layer bank of NGC 2392.`);
const sourceDirectory = resolve(checkoutProjectRoot(import.meta.url), 'src/objects', bank, 'source');
const recipe = parseImageLayerRecipe(JSON.parse(await readFile(resolve(sourceDirectory, 'recipe.json'), 'utf8')) as unknown);
const { data, info } = await sharp(resolve(sourceDirectory, recipe.source.path)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const width = info.width, height = info.height, rad = Math.PI / 180;
const arcsecPerPixel = recipe.observation.fieldOfViewDeg[0] * 3600 / width, north = recipe.observation.northClockwiseDeg * rad;
// A sky offset from the picture's centre (arcseconds east and north) to a pixel (x right, y down): north is turned
// `northClockwiseDeg` clockwise from up, and east is to its left.
const pixel = (east: number, northward: number): [number, number] => [
  width / 2 + (-east * Math.cos(north) + northward * Math.sin(north)) / arcsecPerPixel,
  height / 2 - (east * Math.sin(north) + northward * Math.cos(north)) / arcsecPerPixel];
const light = (x: number, y: number) => {
  let sum = 0, count = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const px = Math.round(x) + i, py = Math.round(y) + j;
    if (px < 0 || py < 0 || px >= width || py >= height) continue;
    const at = 3 * (py * width + px);
    sum += 0.2126 * data[at]! + 0.7152 * data[at + 1]! + 0.0722 * data[at + 2]!; count++;
  }
  return count ? sum / count : 0;
};
const tagged = pixel((recipe.target.centerRaDeg - recipe.observation.centerRaDeg) * Math.cos(recipe.target.centerDecDeg * rad) * 3600, (recipe.target.centerDecDeg - recipe.observation.centerDecDeg) * 3600);
// The star is saturated over a few pixels: its place is the middle of the brightest ones.
let brightest = 0; const reach = STAR_SEARCH / arcsecPerPixel, sum = [0, 0, 0];
for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) brightest = Math.max(brightest, light(tagged[0] + dx, tagged[1] + dy));
for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) if (light(tagged[0] + dx, tagged[1] + dy) >= brightest - 2) { sum[0]! += tagged[0] + dx; sum[1]! += tagged[1] + dy; sum[2]!++; }
const star: [number, number] = [sum[0]! / sum[2]!, sum[1]! / sum[2]!];
const from = pixel(0, 0), rim: { paDeg: number; arcsec: number }[] = [];
for (let paDeg = 0; paDeg < 360; paDeg += EVERY_DEG) {
  const toward = pixel(Math.sin(paDeg * rad), Math.cos(paDeg * rad)), step: [number, number] = [toward[0] - from[0], toward[1] - from[1]];
  const at = (arcsec: number) => light(star[0] + step[0] * arcsec, star[1] + step[1] * arcsec);
  let peak = 0, peakAt = PEAK_FROM;
  for (let r = PEAK_FROM; r <= PEAK_TO; r += STEP) { const value = at(r); if (value > peak) { peak = value; peakAt = r; } }
  let gap = Infinity;
  for (let r = peakAt; r <= GAP_TO; r += STEP) gap = Math.min(gap, at(r));
  let edge = peakAt;
  for (let r = peakAt; r <= GAP_TO; r += STEP) if (at(r) < (peak + gap) / 2) { edge = r; break; }
  rim.push({ paDeg, arcsec: edge });
}
let best = { paDeg: 0, major: Infinity, minor: Infinity };
for (let paDeg = 0; paDeg < 180; paDeg++) for (let ratio = 1; ratio <= 1.6; ratio += 0.01) {
  let major = 0;
  for (const point of rim) { const turn = (point.paDeg - paDeg) * rad; major = Math.max(major, Math.hypot(point.arcsec * Math.cos(turn), point.arcsec * Math.sin(turn) * ratio)); }
  if (major * major / ratio < best.major * best.minor) best = { paDeg, major, minor: major / ratio };
}
const mean = (paDeg: number) => { const near = rim.filter(point => Math.min(Math.abs(point.paDeg - paDeg), 360 - Math.abs(point.paDeg - paDeg)) <= 10); return near.reduce((sum, point) => sum + point.arcsec, 0) / near.length; };
console.log(`The star: ${Math.hypot(star[0] - tagged[0], star[1] - tagged[1]).toFixed(1)} px (${(Math.hypot(star[0] - tagged[0], star[1] - tagged[1]) * arcsecPerPixel).toFixed(2)} arcsec) from where the registration puts it.`);
console.log(`The rim, arcsec from the star by position angle: ${rim.map(point => `${point.paDeg}° ${point.arcsec.toFixed(1)}`).join(', ')}.`);
console.log(`Toward north ${mean(0).toFixed(1)}, east ${mean(90).toFixed(1)}, south ${mean(180).toFixed(1)}, west ${mean(270).toFixed(1)} arcsec.`);
console.log(`The smallest ellipse about the star that holds the rim: semi-axes ${best.major.toFixed(2)} and ${best.minor.toFixed(2)} arcsec, the long one toward position angle ${best.paDeg}°.`);
