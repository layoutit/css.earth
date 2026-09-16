#!/usr/bin/env node
/** Select what a reconstruction reads from an OIFITS file, without touching the measurements: flag every channel outside the
 * given wavelength windows in OI_VIS, OI_VIS2 and OI_T3, and optionally divide the reported wavelengths by an instrument's
 * published scale factor.
 *
 *   node tools/objects/interferometry/oifits-select.mts <in.fits> <out.fits> [--window <min>:<max> ...] [--mjd <min>:<max>] [--wavelength-scale <factor>]
 *
 * Windows are in metres, inclusive. A continuum window keeps a surface reconstruction off the molecular lines that show the
 * extended atmosphere instead (R Dor's CO band head at 2.2935 um). The wavelength scale is for a published calibration of the
 * spectrograph: Evans et al. (2024) divide MIRC-X sizes by 1.0054, which is dividing each wavelength by that factor, so the
 * reconstruction's pixel scale is the sky's. An MJD range keeps one night or epoch, so a reconstruction can be repeated on
 * independent subsets of the same data. Already-flagged cells stay flagged. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { binaryTable, numbers, readFitsHdus, tableColumn, writeCell } from './fits-table.mts';

export interface SelectOptions { readonly windowsMetres?: readonly (readonly [number, number])[]; readonly mjdRange?: readonly [number, number]; readonly wavelengthScale?: number }

export function selectOifits(input: Buffer, { windowsMetres = [], mjdRange, wavelengthScale = 1 }: SelectOptions) {
  if (mjdRange && !(mjdRange[1] > mjdRange[0])) throw new RangeError(`MJD range ${mjdRange.join(':')} is empty.`);
  if (!(wavelengthScale > 0.9 && wavelengthScale < 1.1)) throw new RangeError(`A wavelength scale of ${wavelengthScale} is not a spectrograph calibration.`);
  for (const [min, max] of windowsMetres) if (!(min > 0 && max > min)) throw new RangeError(`Window ${min}:${max} is not a wavelength range in metres.`);
  const bytes = Buffer.from(input), hdus = readFitsHdus(bytes), wavelengths = new Map<string, number[]>();
  for (const hdu of hdus.filter(hdu => hdu.extname === 'OI_WAVELENGTH')) {
    const table = binaryTable(hdu), wave = tableColumn(table, 'EFF_WAVE'), band = tableColumn(table, 'EFF_BAND');
    const list: number[] = [];
    for (let row = 0; row < table.rows; row++) {
      const wavelength = numbers(bytes, table, row, wave)[0]!;
      list.push(wavelength);
      if (wavelengthScale !== 1) { writeCell(bytes, table, row, wave, 0, wavelength / wavelengthScale); writeCell(bytes, table, row, band, 0, numbers(bytes, table, row, band)[0]! / wavelengthScale); }
    }
    wavelengths.set(String(hdu.header.INSNAME), list);
  }
  let kept = 0, flagged = 0;
  if (windowsMetres.length || mjdRange) {
    for (const hdu of hdus.filter(hdu => ['OI_VIS', 'OI_VIS2', 'OI_T3'].includes(hdu.extname))) {
      const table = binaryTable(hdu), flag = tableColumn(table, 'FLAG'), list = wavelengths.get(String(hdu.header.INSNAME));
      if (!list) throw new Error(`No OI_WAVELENGTH for ${String(hdu.header.INSNAME)}.`);
      // Windows apply to the wavelengths as reported, before any scale, so a recipe names the lines as the file shows them.
      const inside = list.map(wavelength => !windowsMetres.length || windowsMetres.some(([min, max]) => wavelength >= min && wavelength <= max));
      const mjd = mjdRange ? tableColumn(table, 'MJD') : null;
      for (let row = 0; row < table.rows; row++) {
        const flags = numbers(bytes, table, row, flag);
        if (mjd && mjdRange) {
          const time = numbers(bytes, table, row, mjd)[0]!;
          if (time < mjdRange[0] || time > mjdRange[1]) {
            for (let k = 0; k < list.length; k++) if (!flags[k]) { writeCell(bytes, table, row, flag, k, true); if (hdu.extname === 'OI_VIS2') flagged++; }
            continue;
          }
        }
        for (let k = 0; k < list.length; k++) {
          if (inside[k] && !flags[k]) { if (hdu.extname === 'OI_VIS2') kept++; continue; }
          if (!inside[k] && !flags[k]) { writeCell(bytes, table, row, flag, k, true); if (hdu.extname === 'OI_VIS2') flagged++; }
        }
      }
    }
  }
  return { bytes, keptVis2: kept, newlyFlaggedVis2: flagged };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [input, output, ...rest] = process.argv.slice(2);
  if (!input || !output) throw new TypeError('Usage: oifits-select <in.fits> <out.fits> [--window <min>:<max> ...] [--mjd <min>:<max>] [--wavelength-scale <factor>]');
  const windowsMetres: [number, number][] = [];
  let wavelengthScale = 1, mjdRange: [number, number] | undefined;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--window') { const [min, max] = String(rest[++i]).split(':').map(Number); windowsMetres.push([min!, max!]); }
    else if (rest[i] === '--mjd') { const [min, max] = String(rest[++i]).split(':').map(Number); mjdRange = [min!, max!]; }
    else if (rest[i] === '--wavelength-scale') wavelengthScale = Number(rest[++i]);
    else throw new TypeError(`Unknown argument ${rest[i]}.`);
  }
  const result = selectOifits(await readFile(input), { windowsMetres, wavelengthScale, ...(mjdRange ? { mjdRange } : {}) });
  await writeFile(output, result.bytes);
  console.log(`${output}: ${result.keptVis2} squared-visibility cells kept, ${result.newlyFlaggedVis2} flagged outside the windows${wavelengthScale !== 1 ? `, wavelengths divided by ${wavelengthScale}` : ''}.`);
}
