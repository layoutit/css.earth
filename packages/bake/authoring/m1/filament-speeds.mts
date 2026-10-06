// Entry script: node packages/bake/authoring/m1/filament-speeds.mts <bank directory> <the picture's year> [--frame]
/**
 * The measured depths of the Crab Nebula's filaments as the table the image-layer bake reads
 * (`<bank>/source/filament-speeds.dat`), from the files of Martin, Milisavljevic & Drissen (2021): every velocity
 * component their SITELLE cube resolves at a pixel, as its place from the bank's own place (arcsec east and north), its
 * speed along the sight line (km/s, positive away from the Sun) and its line flux.
 *
 * The authors' repository holds the points as rows of four numbers and their deep frame with its world coordinates; it
 * does not say what the numbers are. Read here from their notebook and measured (`--frame` prints it):
 * - The first two numbers are a place on the deep frame's own pixel grid, the first growing to the west and the second
 *   to the north, one step (`GRID_STEP`) a pixel. Their zero is the frame pixel `ZERO_PIXEL`, on the pulsar. The steps
 *   are not parsecs at the paper's distance: a pixel of 0.32 arcsec is 0.00311 pc at 2 kpc, and the file has 0.002579.
 *   So a point is placed by its pixel, never by the file's scale.
 * - The frame's header puts its pixels on the sky 1.5 to 1.8 % too close together and has no distortion terms. A pixel
 *   goes to the sky through the frame's fit to Gaia DR3 instead (`SKY_FIT`, from ./frame-fit.mts).
 * - The third number is the fourth of the velocity file, the Doppler speed, over a constant: it adds nothing.
 *
 * The paper turns a speed into a distance along the sight line with one expansion factor (Sect. 3.4), 1.160e-3 per year
 * about the expansion centre of Kaplan et al. (2008); the same factor moves every filament across the sky. The cube was
 * taken in November 2016 (Sect. 2.1), so a point is moved to the picture's own year along its line from that centre.
 * The recipe's `expansionKmSPerArcsec` turns the speeds into depths.
 *
 * Input: the three files, downloaded from the repository at the commit named below; the bank's recipe for its place.
 * Output: the table, or with `--frame` the printed measurement of the points' place on the frame.
 */
import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseImageLayerRecipe } from '@cssearth/bake/image-layers';

const REPOSITORY = 'https://raw.githubusercontent.com/thomasorb/M1_paper/af491d4a13d408464ffb3ea75e6a424f6ef5d140';
const FILES = { flux: '3dmap_XYZflux.fits', speed: '3dmap_XYZvel.fits', frame: 'm1.deep_frame.fits' } as const;
/** One step of the points' grid in the file's own unit, and the deep frame's pixel their zero stands on (counted from 0;
 * a point `s` steps from zero is at pixel zero + s). Measured on 2026-10-05 (`--frame`): the fine detail of the points'
 * flux, summed per step, correlates 0.68 with the frame's at this place and one pixel a step. */
const GRID_STEP = 0.002579, ZERO_PIXEL = [1091, 1032] as const;
/** The cube's date (Sect. 2.1: the nights of 22, 25 and 26 November 2016), the paper's expansion factor per year
 * (Sect. 3.4, from Nugent 1998) and its expansion centre (Kaplan et al. 2008): 05 34 32.74, +22 00 47.9. */
const CUBE_YEAR = 2016.9, EXPANSION_PER_YEAR = 1.160e-3, CENTRE = { raDeg: (5 + 34 / 60 + 32.74 / 3600) * 15, decDeg: 22 + 0 / 60 + 47.9 / 3600 };
const RAD = Math.PI / 180;

const [directory = '', yearText = '', ...flags] = process.argv.slice(2), year = Number(yearText), frameOnly = flags.includes('--frame');
if (!directory || !(year > 1990 && year < 2100) || flags.some(flag => flag !== '--frame')) throw new TypeError(`Usage: filament-speeds.mts <bank directory> <the picture's year> [--frame]; got ${JSON.stringify(process.argv.slice(2))}.`);
const root = checkoutProjectRoot(import.meta.url), bank = resolve(root, directory), cache = resolve(root, '.local/m1-filament-speeds');
await mkdir(cache, { recursive: true });
async function fetched(name: string): Promise<Buffer> {
  const path = resolve(cache, name);
  if (!await stat(path).then(() => true, () => false)) { const response = await fetch(`${REPOSITORY}/${name}`); if (!response.ok) throw new Error(`${REPOSITORY}/${name}: ${response.status}`); await writeFile(path, Buffer.from(await response.arrayBuffer())); }
  return readFile(path);
}
/** A FITS file's first image: its header cards and its 32-bit floats, row by row from the first. */
function fits(bytes: Buffer, name: string) {
  const cards = new Map<string, string>(); let offset = 0;
  for (;; offset += 80) { if (offset + 80 > bytes.length) throw new TypeError(`${name} has no END card.`); const card = bytes.subarray(offset, offset + 80).toString('latin1'); if (card.trim() === 'END') break; const match = /^([A-Z0-9_]+)\s*=\s*([^/]*)/u.exec(card); if (match) cards.set(match[1]!, match[2]!.trim()); }
  const number = (key: string) => { const value = Number(cards.get(key)); if (!Number.isFinite(value)) throw new TypeError(`${name} has no ${key}.`); return value; };
  if (number('BITPIX') !== -32) throw new TypeError(`${name} is not 32-bit floats.`);
  const width = number('NAXIS1'), height = number('NAXIS2'), start = Math.ceil((offset + 80) / 2880) * 2880, view = new DataView(bytes.buffer, bytes.byteOffset + start, width * height * 4), data = new Float32Array(width * height);
  for (let index = 0; index < data.length; index++) data[index] = view.getFloat32(index * 4, false);
  return { number, width, height, data };
}
const flux = fits(await fetched(FILES.flux), FILES.flux), speed = fits(await fetched(FILES.speed), FILES.speed), frame = fits(await fetched(FILES.frame), FILES.frame);
if (flux.width !== 4 || speed.width !== 4 || flux.height !== speed.height) throw new TypeError(`The two point files hold ${flux.height} and ${speed.height} rows of ${flux.width} and ${speed.width} numbers; expected the same rows of four.`);
const rows = flux.height;
for (let row = 0; row < rows; row++) for (let column = 0; column < 3; column++) if (flux.data[row * 4 + column] !== speed.data[row * 4 + column]) throw new TypeError(`Row ${row + 1}: the two point files do not hold the same place.`);
// The deep frame on the sky. Its header's matrix alone is 1.5 to 1.8 % too small a scale across the nebula and holds none of
// the camera's distortion, so the frame is tied to Gaia DR3 instead (./frame-fit.mts): tangent-plane arcseconds about the
// header's reference point as a cubic in the pixel's offset from the reference pixel, over 1,000 pixels.
const pc = [frame.number('PC1_1'), frame.number('PC1_2'), frame.number('PC2_1'), frame.number('PC2_2')] as const, reference = { x: frame.number('CRPIX1') - 1, y: frame.number('CRPIX2') - 1, raDeg: frame.number('CRVAL1'), decDeg: frame.number('CRVAL2') };
/** Measured on 2026-10-05 by ./frame-fit.mts: 317 Gaia DR3 stars at the cube's date, 0.051 arcsec rms. The terms are
 * 1, u, v, u², uv, v², u³, u²v, uv², v³. */
const SKY_FIT = { xi: [-0.623139394, -326.046761, -4.53342563, 0.413043573, -0.138999856, 0.169346385, 4.34091854, 0.0742092741, 4.35040514, 0.0711171685], eta: [-0.272501189, -4.54086033, 326.006312, 0.0476617167, -0.261518645, 0.16481421, 0.0486584157, -4.37638107, 0.0595382953, -4.29703368] } as const;
/** The sky place of a frame pixel, counted from 0. */
function skyOf(x: number, y: number): { raDeg: number; decDeg: number } {
  const u = (x - reference.x) / 1000, v = (y - reference.y) / 1000, terms = [1, u, v, u * u, u * v, v * v, u * u * u, u * u * v, u * v * v, v * v * v];
  const xi = terms.reduce((sum, term, index) => sum + term * SKY_FIT.xi[index]!, 0) / 3600 * RAD, eta = terms.reduce((sum, term, index) => sum + term * SKY_FIT.eta[index]!, 0) / 3600 * RAD, dec0 = reference.decDeg * RAD;
  const denominator = Math.cos(dec0) - eta * Math.sin(dec0);
  return { raDeg: reference.raDeg + Math.atan2(xi, denominator) / RAD, decDeg: Math.atan2(Math.sin(dec0) + eta * Math.cos(dec0), Math.hypot(xi, denominator)) / RAD };
}

if (frameOnly) {
  // The points' flux per grid step against the frame's pixels: the fine detail of both, at every zero within 3 pixels of
  // the recorded one and every scale within 2 % of a pixel a step.
  const G = 1300, half = G / 2, grid = new Float32Array(G * G);
  for (let row = 0; row < rows; row++) { const i = Math.round(flux.data[row * 4]! / GRID_STEP) + half, j = Math.round(flux.data[row * 4 + 1]! / GRID_STEP) + half; if (i >= 0 && j >= 0 && i < G && j < G) grid[j * G + i] += Math.log10(1 + flux.data[row * 4 + 3]!); }
  const box = (map: Float32Array, radius: number) => { const out = new Float32Array(map.length), pass = new Float32Array(map.length);
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) { let sum = 0, count = 0; for (let d = -radius; d <= radius; d++) if (i + d >= 0 && i + d < G) { sum += map[j * G + i + d]!; count++; } pass[j * G + i] = sum / count; }
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) { let sum = 0, count = 0; for (let d = -radius; d <= radius; d++) if (j + d >= 0 && j + d < G) { sum += pass[(j + d) * G + i]!; count++; } out[j * G + i] = sum / count; }
    return out; };
  const fine = (map: Float32Array) => { const smooth = box(map, 15); return map.map((value, index) => value - smooth[index]!); }, own = fine(grid);
  const sorted = Array.from(frame.data).filter((value, index) => index % 97 === 0 && Number.isFinite(value)).sort((a, b) => a - b), cap = sorted[Math.floor(sorted.length * 0.995)]!;
  const sample = (x: number, y: number) => { const i = Math.floor(x), j = Math.floor(y), a = x - i, b = y - j; if (i < 0 || j < 0 || i >= frame.width - 1 || j >= frame.height - 1) return 0;
    const at = (X: number, Y: number) => { const value = frame.data[Y * frame.width + X]!; return Number.isFinite(value) ? Math.min(value, cap) : 0; };
    return (1 - b) * ((1 - a) * at(i, j) + a * at(i + 1, j)) + b * ((1 - a) * at(i, j + 1) + a * at(i + 1, j + 1)); };
  let best = { score: -2, scale: 0, x: 0, y: 0 };
  for (const scale of [0.98, 0.99, 1, 1.01, 1.02]) for (let dx = -3; dx <= 3; dx += 0.5) for (let dy = -3; dy <= 3; dy += 0.5) {
    const deep = new Float32Array(G * G); for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) deep[j * G + i] = sample(ZERO_PIXEL[0] + dx + (i - half) * scale, ZERO_PIXEL[1] + dy + (j - half) * scale);
    const theirs = fine(deep); let ab = 0, aa = 0, bb = 0; for (let index = 0; index < G * G; index++) if (grid[index]! > 0) { ab += own[index]! * theirs[index]!; aa += own[index]! ** 2; bb += theirs[index]! ** 2; }
    const score = ab / Math.sqrt(aa * bb); if (score > best.score) best = { score, scale, x: ZERO_PIXEL[0] + dx, y: ZERO_PIXEL[1] + dy };
  }
  const zero = skyOf(best.x, best.y), pixelArcsec = Math.sqrt(Math.abs(pc[0] * pc[3] - pc[1] * pc[2])) * 3600;
  console.log(`${rows} points on ${new Set(Array.from({ length: rows }, (_, row) => `${flux.data[row * 4]},${flux.data[row * 4 + 1]}`)).size} sight lines. Best place: the points' zero at frame pixel ${best.x}, ${best.y} (recorded ${ZERO_PIXEL.join(', ')}), ${best.scale} pixels a step, correlation ${best.score.toFixed(3)}; that pixel is RA ${zero.raDeg.toFixed(6)}, Dec ${zero.decDeg.toFixed(6)}; a pixel is ${pixelArcsec.toFixed(4)} arcsec, so the file's step is ${(GRID_STEP / pixelArcsec).toExponential(4)} per arcsec against the paper's 9.696e-3 pc.`);
} else {
  const recipe = parseImageLayerRecipe(JSON.parse(await readFile(resolve(bank, 'source/recipe.json'), 'utf8')) as unknown), place = { raDeg: recipe.target.centerRaDeg, decDeg: recipe.target.centerDecDeg };
  /** A sky place as arcseconds east and north of the bank's own place. */
  const offsets = (sky: { raDeg: number; decDeg: number }) => [(sky.raDeg - place.raDeg) * Math.cos(place.decDeg * RAD) * 3600, (sky.decDeg - place.decDeg) * 3600] as const;
  const [centreEast, centreNorth] = offsets(CENTRE), grown = 1 + EXPANSION_PER_YEAR * (year - CUBE_YEAR), lines: string[] = [];
  let toward = 0, away = 0, fastest = 0;
  for (let row = 0; row < rows; row++) {
    const [east, north] = offsets(skyOf(ZERO_PIXEL[0] + flux.data[row * 4]! / GRID_STEP, ZERO_PIXEL[1] + flux.data[row * 4 + 1]! / GRID_STEP)), kmS = speed.data[row * 4 + 3]!;
    if (kmS < 0) toward++; else away++; fastest = Math.max(fastest, Math.abs(kmS));
    lines.push(`${(centreEast + (east - centreEast) * grown).toFixed(3)} ${(centreNorth + (north - centreNorth) * grown).toFixed(3)} ${kmS.toFixed(1)} ${flux.data[row * 4 + 3]!.toPrecision(4)}`);
  }
  const output = resolve(bank, 'source/filament-speeds.dat');
  await writeFile(output, `${lines.join('\n')}\n`);
  console.log(`Wrote ${rows} points (${toward} approaching, ${away} receding, to ${fastest.toFixed(0)} km/s) at ${year}, ${((grown - 1) * 100).toFixed(3)} % farther from the expansion centre than in ${CUBE_YEAR}, to ${output}. The centre is ${centreEast.toFixed(2)} arcsec east and ${centreNorth.toFixed(2)} arcsec north of the bank's place.`);
}
