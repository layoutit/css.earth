// Entry script: node packages/bake/authoring/jupiter/gemini-thermal-map.mts [--check]
/**
 * Jupiter at 4.7 µm on the body's map grid: one map for each of four nights of Gemini North NIRI imaging in the Wide
 * Field Coverage for Juno collection (Wong et al. 2020, MAST HLSP WFCJ).
 *
 * Each published map is a cylindrical grid: planetographic latitude from -80 to +80 degrees and System III longitude,
 * both every 0.1 degree, corrected for limb darkening by its authors. It covers the part of the planet that turned
 * into view that night, not the whole of it. The counts are the instrument's, with no unit, on a scale and a zero of
 * that night's own.
 *
 * Here each map is laid, alone, on the grid the Hubble OPAL maps use, which the body's bake reads: 3600 x 1800 samples,
 * planetographic rows, first row north, first column at System III longitude 360, longitude falling to the right. A
 * sample is the mean of the four published samples around it; where one of the four is missing, and beyond 80 degrees
 * of latitude, it is not a number. Nothing is rescaled.
 *
 * The nights are not joined into one map. The four maps of 26 and 27 May 2018 together cover every longitude, and
 * were tried: their scales and zeros differ (the same clouds read 7 times higher in one map than in another taken two
 * hours earlier), and after a straight-line fit in the overlaps the seams still stepped by 18% to 128% of the median
 * brightness, against 1.7% between neighbours inside one map.
 *
 * Inputs: the four `*-mosaic.fits` files under source/telescopes/gemini-niri. Output: one 32-bit FITS image a night
 * under source/lenses. With --check nothing is written and the script fails when a file on disk differs.
 */
import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
import { fitsCardValue, scanFitsCards, type FitsHeader } from '@cssearth/fits';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const source = resolve(checkoutProjectRoot(import.meta.url), 'src/objects/jupiter/source');
/** A night, the collection's folder for it, and the time in its map's file name. */
const NIGHTS = [['2016-12-14', '2016-pj03', '1214ut1520'], ['2017-01-23', '2017-pj03b', '0123ut1421'], ['2018-07-16', '2018-pj14', '0716ut0722'], ['2019-04-06', '2019-pj19', '0406ut1336']] as const;
const WIDTH = 3600, HEIGHT = 1800, STEP = 0.1;

/** The first 32-bit image of a file. The archive's headers repeat a key (FRAME, once for the telescope and once for the
 * target), which the shared strict reader refuses: here a repeated key keeps its first value. */
function firstImage(bytes: Buffer, name: string) {
  const header: FitsHeader = {};
  const dataOffset = scanFitsCards(bytes, 0, (key, card, continuation) => { if (!Object.hasOwn(header, key)) header[key] = fitsCardValue(card, continuation); });
  if (header.NAXIS !== 2 || header.BITPIX !== -32) throw new Error(`${name}: its first image is not two-dimensional 32-bit floating point.`);
  const width = Number(header.NAXIS1), height = Number(header.NAXIS2), values = new Float32Array(width * height);
  for (let index = 0; index < values.length; index++) values[index] = bytes.readFloatBE(dataOffset + 4 * index);
  return { header, width, height, values };
}

let differs = false;
for (const [night, epoch, time] of NIGHTS) {
  const name = `telescopes/gemini-niri/hlsp_wfcj_gemini_niri_jupiter-${epoch}_mprime_v1_${time}-mosaic.fits`, map = firstImage(await readFile(resolve(source, name)), name);
  const number = (key: string) => { const value = Number(map.header[key]); if (!Number.isFinite(value)) throw new Error(`${name}: no ${key} in its header.`); return value; };
  // The 2017 and 2019 headers leave LAT_TYPE and LON_SYS out; their sub-observer cards still say planetographic and System III.
  if ((map.header.LAT_TYPE ?? 'Planetographic') !== 'Planetographic' || (map.header.LON_SYS ?? 'III') !== 'III' || number('LON_STEP') !== -STEP || number('LAT_STEP') !== STEP)
    throw new Error(`${name}: not a 0.1-degree planetographic System III map.`);
  const left = number('LON_LEFT'), bottom = number('LAT_BOT');
  // The first row of a published map is its southern edge; its first column is LON_LEFT.
  const out = new Float32Array(WIDTH * HEIGHT).fill(NaN); let filled = 0;
  for (let row = 0; row < HEIGHT; row++) for (let column = 0; column < WIDTH; column++) {
    const latitude = 90 - STEP * (row + 0.5), longitude = 360 - STEP * (column + 0.5);
    const r = (latitude - bottom) / STEP, c = (left - (longitude - 360 * Math.ceil((longitude - left) / 360))) / STEP, r0 = Math.floor(r), c0 = Math.floor(c);
    if (r0 < 0 || r0 + 1 >= map.height || c0 < 0 || c0 + 1 >= map.width) continue;
    const corners = [map.values[r0 * map.width + c0]!, map.values[r0 * map.width + c0 + 1]!, map.values[(r0 + 1) * map.width + c0]!, map.values[(r0 + 1) * map.width + c0 + 1]!];
    if (corners.some(value => !Number.isFinite(value) || value === 0)) continue;
    const fr = r - r0, fc = c - c0;
    out[row * WIDTH + column] = corners[0]! * (1 - fr) * (1 - fc) + corners[1]! * (1 - fr) * fc + corners[2]! * fr * (1 - fc) + corners[3]! * fr * fc; filled++;
  }
  const light = [...out].filter(Number.isFinite).sort((a, b) => a - b), at = (share: number) => light[Math.floor((light.length - 1) * share)]!;
  console.log(`${night}: ${map.header['MOSDATE0']} ${map.header['MOSTIME0']} to ${map.header['MOSDATE1']} ${map.header['MOSTIME1']} UT, ${map.width} x ${map.height}, longitude ${left} to ${number('LON_RIGH')}; `
    + `${(100 * filled / (WIDTH * HEIGHT)).toFixed(1)}% of the grid; counts 1% ${at(0.01).toFixed(0)}, median ${at(0.5).toFixed(0)}, 99% ${at(0.99).toFixed(0)}, most ${at(1).toFixed(0)}`);
  // The file: one 32-bit image, first row north.
  const cards = ['SIMPLE  =                    T', 'BITPIX  =                  -32', 'NAXIS   =                    2', `NAXIS1  = ${String(WIDTH).padStart(20)}`, `NAXIS2  = ${String(HEIGHT).padStart(20)}`,
    "OBJECT  = 'Jupiter '", `DATE-OBS= '${night}'`, "LAT_TYPE= 'Planetographic'", "LON_SYS = 'III     '", 'LON_LEFT=                  360', 'LON_RIGH=                    0', 'LAT_TOP =                   90', 'LAT_BOT =                  -90',
    'COMMENT First row north. Not a number: no observation.', `COMMENT From ${name.split('/').at(-1)!.slice(0, 58)}`, 'COMMENT (HLSP WFCJ, Wong et al. 2020), laid on the OPAL map grid by', 'COMMENT packages/bake/authoring/jupiter/gemini-thermal-map.mts', 'END'];
  const header = Buffer.alloc(2880, ' '); cards.forEach((card, index) => header.write(card.padEnd(80), 80 * index, 'latin1'));
  const data = Buffer.alloc(Math.ceil(WIDTH * HEIGHT * 4 / 2880) * 2880); for (let index = 0; index < out.length; index++) data.writeFloatBE(out[index]!, 4 * index);
  const file = Buffer.concat([header, data]), output = `lenses/gemini-niri-jupiter-${night}-mprime-map.fits`;
  if (!process.argv.includes('--check')) { await writeFile(resolve(source, output), file); console.log(`   wrote ${output}, ${file.length} bytes`); continue; }
  const kept = await readFile(resolve(source, output)).catch(() => undefined);
  if (kept?.equals(file)) console.log(`   ${output}: as written by this script`); else { console.error(`   ${output} is not what this script writes.`); differs = true; }
}
if (differs) process.exitCode = 1;
