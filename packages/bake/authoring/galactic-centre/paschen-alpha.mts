// The Galactic Centre page's picture of Sagittarius A West: the HST/NICMOS Paschen-alpha survey's line map (Wang et al. 2010; Dong et al. 2011), cut to a
// north-up square about Sgr A* and given display color.
//
//   node packages/bake/authoring/galactic-centre/paschen-alpha.mts <rows directory> <bank source directory>
//
// The rows directory holds two byte ranges of hlsp_hpsgc_hst_nicmos-nic3_gc_palpha_v1_img.fits
// (https://archive.stsci.edu/pub/hlsp/hpsgc/, 842 MB whole): header.txt, bytes 0 to 5759, and rows.dat, bytes
// 234099360 to 335748959, the mosaic's rows 2501 to 3586. It writes paschen-alpha.png beside the recipe.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

/** Sgr A*, ICRS degrees: SIMBAD `NAME Sgr A*` as src/objects/sgr-a-star/README.md cites it. */
export const SGR_A_STAR = [266.4168166, -29.0078250] as const;
/** The mosaic's first row held in rows.dat (0-based) and how many follow: 55 arcsec either side of Sgr A*. */
export const ROWS = { first: 2501, count: 1086 } as const;
/** The square written: arcseconds either side of Sgr A*, and a pixel's size. The mosaic's own pixel is 0.1014 arcsec. */
export const HALF_WIDTH_ARCSEC = 55, PIXEL_ARCSEC = 0.1;
/** Display, in the map's microjanskys a pixel: black at `floor`, an inverse hyperbolic sine about `soft`, white at `top`.
 * Measured on this square, 2026-10-05: the field's median is 2.9, the paper's 51 measured places on the streams average
 * 50, and 0.1% of pixels are above 154. A display choice; the map's values are in rows.dat. */
export const DISPLAY = { floor: 4, soft: 6, top: 220 } as const;

const rad = Math.PI / 180;
/** Equatorial J2000 to Galactic, the IAU 1958 system's matrix. */
const TO_GALACTIC = [[-0.0548755604162154, -0.8734370902348850, -0.4838350155487132], [0.4941094278755837, -0.4448296299600112, 0.7469822444972189], [-0.8676661490190047, -0.1980763734312015, 0.4559837761750669]] as const;

/** A FITS header's cards as text values. */
export function fitsCards(header: string): Record<string, string> {
  const cards: Record<string, string> = {};
  for (let at = 0; at + 80 <= header.length; at += 80) { const card = header.slice(at, at + 80), key = card.slice(0, 8).trim(); if (key === 'END') break; if (card[8] === '=') cards[key] = card.slice(10).split('/')[0]!.trim().replace(/^'|'$/gu, '').trim(); }
  return cards;
}

/** matplotlib's `afmhot`, the ramp the Sgr A* page's EHT image is drawn in: 0 to 1 in, red, green and blue 0 to 255 out. */
export const heat = (value: number): [number, number, number] => { const v = Math.max(0, Math.min(1, value)); return [Math.round(255 * Math.min(1, 2 * v)), Math.round(255 * Math.max(0, Math.min(1, 2 * v - .5))), Math.round(255 * Math.max(0, 2 * v - 1))]; };

/** The line map on a north-up tangent-plane square about Sgr A*, east to the left: microjanskys a mosaic pixel, NaN
 * where the square leaves the rows held. */
export function northUpSquare(cards: Record<string, string>, rows: Buffer): { size: number; values: Float32Array } {
  const number = (key: string) => { const value = Number(cards[key]); if (!Number.isFinite(value)) throw new TypeError(`The mosaic's header has no ${key}.`); return value; };
  const width = number('NAXIS1'), height = number('NAXIS2'), l0 = number('CRVAL1') * rad, b0 = number('CRVAL2') * rad, cdelt = number('CDELT2');
  if (cards.CTYPE1 !== 'GLON---TAN' || cards.CTYPE2 !== 'GLAT--TAN' || number('CDELT1') !== -cdelt || number('CROTA2') !== 0) throw new TypeError('The mosaic is expected on a Galactic tangent plane with square pixels and no rotation.');
  if (rows.length !== 4 * width * ROWS.count || ROWS.first + ROWS.count > height) throw new RangeError(`rows.dat holds ${rows.length} bytes; ${ROWS.count} rows of ${width} pixels are ${4 * width * ROWS.count}.`);
  const held = (x: number, y: number) => { const row = y - ROWS.first; return row < 0 || row >= ROWS.count || x < 0 || x >= width ? NaN : rows.readFloatBE(4 * (row * width + x)); };
  /** A sky place's pixel in the mosaic, counted from 0. */
  const pixel = (ra: number, dec: number) => {
    const v = [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)] as const, g = TO_GALACTIC.map(row => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]) as [number, number, number];
    const l = Math.atan2(g[1], g[0]), b = Math.asin(g[2]), facing = Math.sin(b) * Math.sin(b0) + Math.cos(b) * Math.cos(b0) * Math.cos(l - l0);
    return [number('CRPIX1') - 1 - Math.cos(b) * Math.sin(l - l0) / facing / rad / cdelt, number('CRPIX2') - 1 + (Math.sin(b) * Math.cos(b0) - Math.cos(b) * Math.sin(b0) * Math.cos(l - l0)) / facing / rad / cdelt] as const;
  };
  const size = 2 * Math.round(HALF_WIDTH_ARCSEC / PIXEL_ARCSEC) + 1, middle = (size - 1) / 2, values = new Float32Array(size * size), ra0 = SGR_A_STAR[0] * rad, dec0 = SGR_A_STAR[1] * rad;
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const xi = (middle - i) * PIXEL_ARCSEC / 3600 * rad, eta = (middle - j) * PIXEL_ARCSEC / 3600 * rad, facing = Math.cos(dec0) - eta * Math.sin(dec0), ra = ra0 + Math.atan2(xi, facing), dec = Math.atan((Math.sin(dec0) + eta * Math.cos(dec0)) * Math.cos(ra - ra0) / facing);
    const [x, y] = pixel(ra, dec), x0 = Math.floor(x), y0 = Math.floor(y), a = x - x0, b = y - y0;
    values[j * size + i] = held(x0, y0) * (1 - a) * (1 - b) + held(x0 + 1, y0) * a * (1 - b) + held(x0, y0 + 1) * (1 - a) * b + held(x0 + 1, y0 + 1) * a * b;
  }
  return { size, values };
}

/** The square as display color: `DISPLAY`'s stretch through `heat`; black where the map is empty or under the floor. */
export function displayRgb(values: Float32Array): Buffer {
  const rgb = Buffer.alloc(3 * values.length), full = Math.asinh((DISPLAY.top - DISPLAY.floor) / DISPLAY.soft);
  for (let p = 0; p < values.length; p++) { const value = values[p]!; if (!(value > DISPLAY.floor)) continue; rgb.set(heat(Math.asinh((value - DISPLAY.floor) / DISPLAY.soft) / full), 3 * p); }
  return rgb;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [rows, directory] = process.argv.slice(2);
  if (!rows || !directory) throw new TypeError('Usage: node packages/bake/authoring/galactic-centre/paschen-alpha.mts <rows directory> <bank source directory>');
  const cards = fitsCards((await readFile(resolve(rows, 'header.txt'))).toString('latin1')), { size, values } = northUpSquare(cards, await readFile(resolve(rows, 'rows.dat')));
  await sharp(displayRgb(values), { raw: { width: size, height: size, channels: 3 } }).png({ compressionLevel: 9 }).toFile(resolve(directory, 'paschen-alpha.png'));
  let empty = 0, lit = 0; for (const value of values) { if (Number.isNaN(value)) empty++; else if (value > DISPLAY.floor) lit++; }
  console.log(`paschen-alpha.png: ${size} x ${size} px, ${PIXEL_ARCSEC} arcsec a pixel; ${lit} pixels above the floor, ${empty} outside the rows held`);
}
