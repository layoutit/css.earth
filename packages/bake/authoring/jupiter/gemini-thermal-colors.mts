// Entry script: node packages/bake/authoring/jupiter/gemini-thermal-colors.mts [--check]
/**
 * The colors and stretch of Jupiter's thermal infrared maps, read from the archive's own picture of each map.
 *
 * The Wide Field Coverage for Juno collection (Wong et al. 2020, MAST HLSP WFCJ) publishes each Gemini North NIRI map
 * twice: as numbers (`*-mosaic.fits`) and as a picture of those numbers with axes around it (`*-mosaic.jpg`). Neither
 * says how the picture is colored. This script finds out, by reading every second pixel of the picture's plot against
 * the map value under it:
 *
 * 1. Where the picture is pure red, red is a constant times the square root of (value - low). The fit gives the night's
 *    low limit and that constant.
 * 2. On the reference night, 16 July 2018, the picture turns white near one value, the night's high limit. That fixes how
 *    much red one whole step of the stretch is worth, and from it every other night's high limit.
 * 3. The ramp is the reference picture's median color at nine equal steps of the square root of (value - low) / (high - low).
 *
 * It prints each night's limits and how far the ramp, drawn with them, lies from the picture. With --check it fails
 * when `preparation/observations.json` holds another ramp, other limits or another stretch.
 *
 * Inputs: the four maps and their four pictures under source/telescopes/gemini-niri.
 */
import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
import { fitsCardValue, scanFitsCards, type FitsHeader } from '@cssearth/fits';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

const source = resolve(checkoutProjectRoot(import.meta.url), 'src/objects/jupiter/source');
/** A night, and its map's name in the collection. */
const NIGHTS = [['2016-12-14', '2016-pj03_mprime_v1_1214ut1520'], ['2017-01-23', '2017-pj03b_mprime_v1_0123ut1421'], ['2018-07-16', '2018-pj14_mprime_v1_0716ut0722'], ['2019-04-06', '2019-pj19_mprime_v1_0406ut1336']] as const;
const REFERENCE = '2018-07-16', STOPS = 8;
/** A value and the picture's red, green and blue over it. */
type Sample = readonly [value: number, red: number, green: number, blue: number];
const median = (list: number[]) => list.sort((a, b) => a - b)[list.length >> 1]!;

async function samplesOf(name: string): Promise<Sample[]> {
  const stem = `telescopes/gemini-niri/hlsp_wfcj_gemini_niri_jupiter-${name}-mosaic`, fits = await readFile(resolve(source, `${stem}.fits`));
  // The archive's headers repeat a key (FRAME), which the shared strict reader refuses: a repeated key keeps its first value.
  const header: FitsHeader = {}, offset = scanFitsCards(fits, 0, (key, card, continuation) => { if (!Object.hasOwn(header, key)) header[key] = fitsCardValue(card, continuation); });
  const width = Number(header.NAXIS1), height = Number(header.NAXIS2);
  const { data, info } = await sharp(resolve(source, `${stem}.jpg`)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixel = (x: number, y: number) => { const at = (y * info.width + x) * info.channels; return [data[at]!, data[at + 1]!, data[at + 2]!] as const; };
  const white = (x: number, y: number) => pixel(x, y).every(level => level > 235);
  // The plot's box: from the picture's middle outward to the first white pixel, the median over rows and columns that
  // pass between the axis ticks. The map fills the box, first column at the left, first row at the bottom.
  const edge = (alongY: boolean, step: number) => { const found: number[] = [];
    for (let share = 0.3; share <= 0.7; share += 0.013) { const fixed = Math.round((alongY ? info.width : info.height) * share), limit = (alongY ? info.height : info.width) - 1;
      let at = Math.round((alongY ? info.height : info.width) / 2); while (at > 0 && at < limit && !(alongY ? white(fixed, at) : white(at, fixed))) at += step; found.push(at - step); }
    return median(found); };
  const left = edge(false, -1), right = edge(false, 1), top = edge(true, -1), bottom = edge(true, 1), samples: Sample[] = [];
  for (let y = top + 6; y <= bottom - 6; y += 2) for (let x = left + 6; x <= right - 6; x += 2) {
    if (x < left + 520 && y < top + 160) continue; // the picture's caption
    const value = fits.readFloatBE(offset + 4 * (Math.round((bottom - y) / (bottom - top) * (height - 1)) * width + Math.round((x - left) / (right - left) * (width - 1))));
    if (Number.isFinite(value) && value !== 0) samples.push([value, ...pixel(x, y)]);
  }
  return samples;
}

/** Step 1: red = scale * sqrt(value - low) where only red is lit, by least squares over whole values of low. */
function redFit(samples: readonly Sample[]) {
  const reds = samples.filter(([, red, green, blue], index) => index % 4 === 0 && red >= 20 && red <= 200 && green < 6 && blue < 6);
  let best = { error: Infinity, low: 0, scale: 0 };
  for (let low = -200; low <= 300; low++) {
    let cross = 0, square = 0; for (const [value, red] of reds) { const root = Math.sqrt(Math.max(0, value - low)); cross += root * red; square += root * root; }
    const scale = cross / square; let error = 0; for (const [value, red] of reds) error += (scale * Math.sqrt(Math.max(0, value - low)) - red) ** 2;
    if (error < best.error) best = { error, low, scale };
  }
  return { low: best.low, scale: best.scale };
}

const nights = new Map<string, Sample[]>(); for (const [night, name] of NIGHTS) nights.set(night, await samplesOf(name));
const reference = nights.get(REFERENCE)!, referenceFit = redFit(reference);
// Step 2: the reference picture is one step short of white where green is 250 to 253 and blue at least 240.
const referenceHigh = median(reference.filter(([, , green, blue]) => green >= 250 && green <= 253 && blue >= 240).map(([value]) => value));
const redPerStretch = referenceFit.scale * Math.sqrt(referenceHigh - referenceFit.low);
// Step 3: the ramp.
const palette: number[][] = [];
for (let stop = 0; stop <= STOPS; stop++) { const value = referenceFit.low + (referenceHigh - referenceFit.low) * (stop / STOPS) ** 2, near = Math.max(8, 0.03 * (value - referenceFit.low));
  const part = reference.filter(sample => Math.abs(sample[0] - value) < near);
  palette.push(stop === 0 ? [0, 0, 0] : stop === STOPS ? [255, 255, 255] : [1, 2, 3].map(channel => median(part.map(sample => sample[channel]!)))); }
const ramp = (amount: number) => { const scaled = Math.max(0, Math.min(1, amount)) * STOPS, index = Math.min(STOPS - 1, Math.floor(scaled)), local = scaled - index; return [0, 1, 2].map(channel => palette[index]![channel]! * (1 - local) + palette[index + 1]![channel]! * local); };
console.log(`ramp, ${STOPS + 1} equal steps of the square-root stretch: ${JSON.stringify(palette)}`);

const recipe = JSON.parse(await readFile(resolve(source, 'preparation/observations.json'), 'utf8')) as { datasets: Array<{ id: string; palette?: number[][]; scalar?: { range?: number[]; gamma?: number } }> };
let differs = false;
for (const [night, samples] of nights) {
  const fit = redFit(samples), high = Math.round(fit.low + (redPerStretch / fit.scale) ** 2);
  const misses = samples.map(([value, ...color]) => { const drawn = ramp(Math.sqrt(Math.max(0, value - fit.low) / (high - fit.low))); return Math.max(...drawn.map((level, channel) => Math.abs(level - color[channel]!))); }).sort((a, b) => a - b);
  console.log(`${night}: ${fit.low} to ${high} counts; ${samples.length} samples; the ramp misses the picture by a median ${misses[misses.length >> 1]!.toFixed(1)} of 255 in its worst channel, 95% within ${misses[Math.floor(misses.length * 0.95)]!.toFixed(1)}`);
  if (!process.argv.includes('--check')) continue;
  const dataset = recipe.datasets.find(candidate => candidate.id === `infrared-${night}`);
  if (JSON.stringify(dataset?.palette) !== JSON.stringify(palette) || dataset?.scalar?.range?.[0] !== fit.low || dataset.scalar.range[1] !== high || dataset.scalar.gamma !== 0.5) {
    console.error(`   preparation/observations.json: infrared-${night} does not hold this ramp, these limits and a 0.5 power.`); differs = true; }
}
if (differs) process.exitCode = 1;
