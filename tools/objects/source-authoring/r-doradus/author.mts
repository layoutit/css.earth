#!/usr/bin/env node
/** R Doradus authored inputs: the uniform-disc reference sphere from the retained measurements, the lens frame cut from the
 * pinned ALMA continuum image, and the navigation marker rendered from it.
 *
 *   node tools/objects/source-authoring/r-doradus/author.mts [--check]
 *
 * The archive image is an ALMA pipeline product: 2880 x 2880 pixels of 5 mas over a 14 arcsecond field, with the star a 12-pixel
 * disc near the middle. This cuts the window around the star and resamples it to 0.625 mas so the sphere carries a smooth
 * texture. Resampling adds no detail: the restoring beam is 20.7 x 16.8 mas, four native pixels across, so the image is already
 * oversampled and the cubic interpolation only reads between samples it is given.
 *
 * --check recomputes every output and fails if any differs from the file on disk. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFitsImage } from '../../../fits/fits.mts';
import { headerBlock, padBlock } from '../../interferometry/fits-table.mts';
import { readReconstruction } from '../../interferometry/beam-convolve.mts';
import { requireFiniteNumber, requireString } from '@cssearth/core';
import { authorUniformDiscSphere, contextMarker } from '../betelgeuse/author.mts';

const root = resolve(import.meta.dirname, '../../../../src/objects/r-doradus/source');

/** The ALMA pipeline's band 7 continuum image of R Doradus, and the lens frame cut from it. */
export const ARCHIVE_PATH = 'observations/member.uid___A001_X35f5_Xaea.R_Dor_sci.spw25_27_29_31.cont.I.pbcor.fits';
export const FRAME_PATH = 'observations/r-doradus-alma-338ghz-0p625mas.fits';
export const SPHERE_PATH = 'shape/uniform-disc.tab';
export const CONTEXT_PATH = 'presentation/context.png';
/** 25 native pixels of 5 mas around the star, resampled eight times finer: a 125 mas window at 0.625 mas. */
export const WINDOW_PIXELS = 25, UPSAMPLE = 8;

/** Catmull-Rom in one dimension, clamped at the window edge. */
function cubic(a: number, b: number, c: number, d: number, t: number) {
  return b + 0.5 * t * (c - a + t * (2 * a - 5 * b + 4 * c - d + t * (3 * (b - c) + d - a)));
}

/** The star in an ALMA pipeline image: the brightest sample near the pointing centre, then the flux centroid of everything above
 * half of it. The pointing centre is the catalogue position moved to the observing epoch, so the star is within a few pixels. */
export function locateStar(values: ArrayLike<number>, width: number, height: number) {
  const cx = Math.round(width / 2), cy = Math.round(height / 2), search = 120;
  let peak = -Infinity, px = cx, py = cy;
  for (let y = cy - search; y <= cy + search; y++) for (let x = cx - search; x <= cx + search; x++) {
    const value = values[y * width + x]!;
    if (value > peak) { peak = value; px = x; py = y; }
  }
  let sx = 0, sy = 0, weight = 0;
  for (let y = py - 30; y <= py + 30; y++) for (let x = px - 30; x <= px + 30; x++) {
    const value = values[y * width + x]!;
    if (value > peak / 2) { sx += x * value; sy += y * value; weight += value; }
  }
  return { peak, centreX: sx / weight, centreY: sy / weight };
}

export async function authorRDoradus({ check = false } = {}) {
  await authorUniformDiscSphere(root, 'R Doradus', { check });

  const archive = readFitsImage(await readFile(resolve(root, ARCHIVE_PATH)), { maxDecodedBytes: 256 * 1024 * 1024 });
  const { width, height, values, header } = archive;
  const star = locateStar(values, width, height);
  const originX = Math.round(star.centreX) - (WINDOW_PIXELS - 1) / 2, originY = Math.round(star.centreY) - (WINDOW_PIXELS - 1) / 2;
  const size = WINDOW_PIXELS * UPSAMPLE;
  const sample = (x: number, y: number) => values[Math.min(height - 1, Math.max(0, y)) * width + Math.min(width - 1, Math.max(0, x))]!;
  const out = new Float64Array(size * size);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    // The output sample centre in native pixels: output pixel centres divide each native pixel into UPSAMPLE equal parts.
    const u = originX + (i + 0.5) / UPSAMPLE - 0.5, v = originY + (j + 0.5) / UPSAMPLE - 0.5;
    const iu = Math.floor(u), iv = Math.floor(v), tu = u - iu, tv = v - iv;
    const rows = [-1, 0, 1, 2].map(dy => cubic(sample(iu - 1, iv + dy), sample(iu, iv + dy), sample(iu + 1, iv + dy), sample(iu + 2, iv + dy), tu));
    out[j * size + i] = cubic(rows[0]!, rows[1]!, rows[2]!, rows[3]!, tv);
  }
  const data = Buffer.alloc(out.length * 8);
  out.forEach((value, index) => data.writeDoubleBE(value, index * 8));
  const number = (key: string) => requireFiniteNumber(header[key]);
  const frame = Buffer.concat([headerBlock([
    ['SIMPLE', true, 'conforms to FITS standard'], ['BITPIX', -64], ['NAXIS', 2], ['NAXIS1', size], ['NAXIS2', size],
    ['CTYPE1', requireString(header.CTYPE1)], ['CTYPE2', requireString(header.CTYPE2)],
    ['CRVAL1', number('CRVAL1')], ['CRVAL2', number('CRVAL2')],
    ['CDELT1', number('CDELT1') / UPSAMPLE], ['CDELT2', number('CDELT2') / UPSAMPLE],
    // The archive reference pixel, in the window's own 1-based sample numbering.
    ['CRPIX1', (number('CRPIX1') - 1 - originX) * UPSAMPLE + 0.5], ['CRPIX2', (number('CRPIX2') - 1 - originY) * UPSAMPLE + 0.5],
    ['BUNIT', requireString(header.BUNIT)], ['BMAJ', number('BMAJ')], ['BMIN', number('BMIN')], ['BPA', number('BPA')],
    ['DATE-OBS', requireString(header['DATE-OBS'])], ['OBJECT', requireString(header.OBJECT)], ['TELESCOP', requireString(header.TELESCOP)],
    ['RESTFRQ', number('RESTFRQ')],
    ['MEMBEROUS', 'uid://A001/X35f5/Xaea', 'ALMA image this window was cut from'],
    ['CUTORGX', originX, 'zero-based archive column of this window'], ['CUTORGY', originY, 'zero-based archive row of this window'],
    ['UPSAMPLE', UPSAMPLE, 'Catmull-Rom resampling applied by author.mts; adds no detail'],
  ]), padBlock(data)]);

  const marker = await contextMarker(readReconstruction(frame), PALETTE, PERCENTILES, BACKGROUND_MAXIMUM);
  const outputs: [string, Buffer][] = [[FRAME_PATH, frame], [CONTEXT_PATH, marker]];
  for (const [path, bytes] of outputs) {
    const target = resolve(root, path);
    if (check) { if (!(await readFile(target)).equals(bytes)) throw new Error(`${path} differs from its authored recomputation.`); }
    else await writeFile(target, bytes);
  }
  const beamMas = number('BMAJ') * 3.6e6, minorMas = number('BMIN') * 3.6e6;
  return { size, pixelMas: Math.abs(number('CDELT1')) * 3.6e6 / UPSAMPLE, peak: star.peak, beamMas, minorMas,
    centre: [(star.centreX - originX) * UPSAMPLE + (UPSAMPLE - 1) / 2, (star.centreY - originY) * UPSAMPLE + (UPSAMPLE - 1) / 2] as [number, number] };
}

/** The lens display, repeated here because the marker is rendered before the recipe reads it. */
const PALETTE = ['#3b0500', '#9a1e00', '#e0641a', '#ffb340', '#ffe9a0', '#fffbf0'];
const PERCENTILES: [number, number] = [1, 99.5];
// Five per cent of the peak, about ten times the image noise: a stated level, not a measured one. The archive image is a CLEAN
// image whose sidelobes go negative, so any level inside the noise makes the background boundary wander through it. At this
// level the boundary sits on the disc's outer skirt, 38 mas out, well beyond the 29.9 mas the sphere covers.
const BACKGROUND_MAXIMUM = 2.9e-3;

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await authorRDoradus({ check: process.argv.includes('--check') });
  console.log(`R Doradus: ${result.size}x${result.size} frame of ${result.pixelMas.toFixed(3)} mas pixels, peak ${result.peak.toExponential(3)} Jy/beam, beam ${result.beamMas.toFixed(1)}x${result.minorMas.toFixed(1)} mas, disc centre at (${result.centre[0].toFixed(3)}, ${result.centre[1].toFixed(3)}); sphere table, lens frame and navigation marker written.`);
}
