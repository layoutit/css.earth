// The Northern Arm's surface as Paumard, Maillard & Morris (2004, A&A 426, 81) published it: fig7b.fit at the CDS
// (J/A+A/426/81), the line-of-sight distance of their Keplerian model of the arm at each 0.353 arcsec cell of their
// field. The model's orbits pass through the field twice; the arm is the continuous sheet that holds the wedge east of
// the bright rim. This writes that sheet's cells as a picture, north up and east to the left, for the bank's recipe
// (geometry.streams.streams[].surface), and prints how the map's own depths compare with the arm's plane there.
//
//   node packages/bake/authoring/galactic-centre/northern-arm-surface.mts <bank source directory>
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { fitsCards } from './paschen-alpha.mts';

/** A place inside the wedge the sheet is grown from, arcseconds east and north of Sgr A*. */
export const SEED_ARCSEC = [12, 4] as const;
/** The largest step in depth between neighbouring cells of one sheet, arcseconds. Measured 2026-10-05: 0.8, 1.0 and 1.5
 * give 2,900, 2,959 and 2,996 cells, the same triangle; 0.5 loses its northern edge and the stream by Sgr A* (2,084). */
export const SHEET_STEP_ARCSEC = 1;

/** A FITS image of 64-bit floats with one header block, as the CDS serves these maps: its cards and its cells, the
 * first row the southernmost. */
export function readMap(bytes: Buffer): { cards: Record<string, string>; width: number; height: number; cells: Float64Array } {
  const cards = fitsCards(bytes.subarray(0, 2880).toString('latin1')), width = Number(cards.NAXIS1), height = Number(cards.NAXIS2);
  if (cards.BITPIX !== '-64' || !(width > 0 && height > 0) || bytes.length < 2880 + 8 * width * height) throw new TypeError('Expected one image of 64-bit floats after a single header block.');
  const cells = new Float64Array(width * height); for (let p = 0; p < cells.length; p++) cells[p] = bytes.readDoubleBE(2880 + 8 * p);
  return { cards, width, height, cells };
}

/** The cells of the continuous sheet that holds `SEED_ARCSEC`: 1 where a cell is on it. */
export function sheetOf(map: ReturnType<typeof readMap>): { sheet: Uint8Array; cellArcsec: number; centre: readonly [number, number] } {
  const { cards, width, height, cells } = map, cellArcsec = Number(cards.CDELT2) * 3600, centre = [Number(cards.CRPIX1) - 1, Number(cards.CRPIX2) - 1] as const;
  if (!(cellArcsec > 0) || Number(cards.CDELT1) !== -Number(cards.CDELT2)) throw new TypeError('Expected square cells, east to the left.');
  const sheet = new Uint8Array(width * height), seed = Math.round(centre[1] + SEED_ARCSEC[1] / cellArcsec) * width + Math.round(centre[0] - SEED_ARCSEC[0] / cellArcsec), queue = [seed];
  if (Number.isNaN(cells[seed]!)) throw new RangeError('The map holds no depth at the seed.');
  sheet[seed] = 1;
  while (queue.length) { const p = queue.pop()!, x = p % width, y = (p - x) / width;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = x + dx, ny = y + dy, q = ny * width + nx; if (nx < 0 || ny < 0 || nx >= width || ny >= height || sheet[q] || Number.isNaN(cells[q]!) || Math.abs(cells[q]! - cells[p]!) / 1000 > SHEET_STEP_ARCSEC) continue; sheet[q] = 1; queue.push(q); } }
  return { sheet, cellArcsec, centre };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const directory = process.argv[2];
  if (!directory) throw new TypeError('Usage: node packages/bake/authoring/galactic-centre/northern-arm-surface.mts <bank source directory>');
  const map = readMap(await readFile(resolve(directory, 'paumard-2004/fig7b.fit'))), errors = readMap(await readFile(resolve(directory, 'paumard-2004/fig7berr.fit'))), { sheet, cellArcsec, centre } = sheetOf(map), { width, height } = map;
  // North up: the picture's first row is the map's last.
  const picture = Buffer.alloc(width * height); for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) picture[(height - 1 - y) * width + x] = sheet[y * width + x]! * 255;
  await sharp(picture, { raw: { width, height, channels: 1 } }).png({ compressionLevel: 9 }).toFile(resolve(directory, 'northern-arm-surface.png'));
  // Against the arm's plane in the recipe.
  const recipe = JSON.parse(await readFile(resolve(directory, 'recipe.json'), 'utf8')) as { geometry: { streams: { streams: { id: string; ascendingNodeDeg: number; inclinationDeg: number; surface?: unknown }[] } } };
  const arm = recipe.geometry.streams.streams.find(stream => stream.surface !== undefined) ?? recipe.geometry.streams.streams[0]!, node = arm.ascendingNodeDeg * Math.PI / 180, tilt = arm.inclinationDeg * Math.PI / 180, normal = [Math.sin(node) * Math.sin(tilt), -Math.cos(node) * Math.sin(tilt), Math.cos(tilt)] as const;
  const apart: number[] = []; let count = 0, squares = 0, own = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { if (!sheet[y * width + x]) continue; const east = (centre[0] - x) * cellArcsec, north = (y - centre[1]) * cellArcsec, difference = map.cells[y * width + x]! / 1000 + (east * normal[0] + north * normal[1]) / normal[2]; apart.push(Math.abs(difference)); squares += difference ** 2; own += (errors.cells[y * width + x]! / 1000) ** 2; count++; }
  apart.sort((a, b) => a - b);
  console.log(`northern-arm-surface.png: ${width} x ${height} cells of ${cellArcsec.toFixed(3)} arcsec, Sgr A* at cell ${centre[0].toFixed(4)}, ${(height - 1 - centre[1]).toFixed(4)} from the top left; ${count} cells on the sheet (${(count * cellArcsec ** 2).toFixed(0)} square arcsec)`);
  console.log(`the map's depths against ${arm.id}'s plane over the sheet: median ${apart[apart.length >> 1]!.toFixed(1)} arcsec apart, 90% under ${apart[Math.floor(.9 * apart.length)]!.toFixed(1)}, ${Math.sqrt(squares / count).toFixed(1)} rms; the map's own error ${Math.sqrt(own / count).toFixed(1)} rms`);
}
