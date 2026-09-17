#!/usr/bin/env node
/** Select what a reconstruction reads from an OIFITS file, without touching the measurements: flag every channel outside the
 * given wavelength windows in OI_VIS, OI_VIS2 and OI_T3, and optionally divide the reported wavelengths by an instrument's
 * published scale factor.
 *
 *   node tools/objects/interferometry/oifits-select.mts <in.fits> <out.fits> [--window <min>:<max> ...] [--mjd <min>:<max>] [--half even|odd] [--wavelength-scale <factor>]
 *     [--error-floor <vis2 fraction>:<closure degrees>[:<vis2 minimum>]]
 *
 * Windows are in metres, inclusive. A continuum window keeps a surface reconstruction off the molecular lines that show the
 * extended atmosphere instead (R Dor's CO band head at 2.2935 um). The wavelength scale is for a published calibration of the
 * spectrograph: Evans et al. (2024) divide MIRC-X sizes by 1.0054, which is dividing each wavelength by that factor, so the
 * reconstruction's pixel scale is the sky's. An MJD range keeps one night or epoch, so a reconstruction can be repeated on
 * independent subsets of the same data. A half keeps every other exposure time (every other row when the file has only one
 * time), so both halves keep nearly the same coverage but independent noise: the reproducibility check compares them.
 * Already-flagged cells stay flagged.
 *
 * Error floors raise each squared-visibility error to at least a fraction of its value, and to at least a minimum, and each
 * closure-phase error to at least some degrees, keeping larger errors. Calibrated errors from one night's statistics understate the
 * scatter between nights. In the π¹ Gruis file its authors imaged from, every error is the largest of its own, 5 percent of the
 * value and 5e-6, and every closure-phase error at least 2 degrees. Without the minimum, points past a null with squared
 * visibilities near 1e-5 carry errors near 5e-7 and decide a fit: five such points gave 59 percent of the chi-squared of the
 * shipped image against π¹ Gruis's season from raw. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { binaryTable, numbers, readFitsHdus, tableColumn, writeCell } from './fits-table.mts';

export interface SelectOptions { readonly windowsMetres?: readonly (readonly [number, number])[]; readonly mjdRange?: readonly [number, number]; readonly half?: 'even' | 'odd'; readonly wavelengthScale?: number;
  readonly errorFloors?: { readonly vis2Relative: number; readonly closureDegrees: number; readonly vis2Minimum?: number } }

export function selectOifits(input: Buffer, { windowsMetres = [], mjdRange, half, wavelengthScale = 1, errorFloors }: SelectOptions) {
  if (errorFloors && !(errorFloors.vis2Relative >= 0 && errorFloors.vis2Relative < 1 && errorFloors.closureDegrees >= 0 && errorFloors.closureDegrees < 90 && (errorFloors.vis2Minimum ?? 0) >= 0 && (errorFloors.vis2Minimum ?? 0) < 1)) throw new RangeError('Error floors are a fraction below 1, degrees below 90 and a squared-visibility minimum below 1.');
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
  const observables = hdus.filter(hdu => ['OI_VIS', 'OI_VIS2', 'OI_T3'].includes(hdu.extname));
  // The rank of each exposure time across the file, so a squared visibility and the closure phases of the same exposure share a half.
  const times = [...new Set(observables.flatMap(hdu => { const table = binaryTable(hdu); return table.columns.some(column => column.name === 'MJD') ? Array.from({ length: table.rows }, (_, row) => numbers(bytes, table, row, tableColumn(table, 'MJD'))[0]!) : []; }))].sort((a, b) => a - b);
  const rank = new Map(times.map((value, index) => [value, index]));
  if (windowsMetres.length || mjdRange || half) {
    for (const hdu of observables) {
      const table = binaryTable(hdu), flag = tableColumn(table, 'FLAG'), list = wavelengths.get(String(hdu.header.INSNAME));
      if (!list) throw new Error(`No OI_WAVELENGTH for ${String(hdu.header.INSNAME)}.`);
      // Windows apply to the wavelengths as reported, before any scale, so a recipe names the lines as the file shows them.
      const inside = list.map(wavelength => !windowsMetres.length || windowsMetres.some(([min, max]) => wavelength >= min && wavelength <= max));
      const mjd = mjdRange ? tableColumn(table, 'MJD') : null;
      for (let row = 0; row < table.rows; row++) {
        const flags = numbers(bytes, table, row, flag);
        if (half) {
          const index = times.length > 1 ? rank.get(numbers(bytes, table, row, tableColumn(table, 'MJD'))[0]!)! : row;
          if ((index % 2 === 0) !== (half === 'even')) {
            for (let k = 0; k < list.length; k++) if (!flags[k]) { writeCell(bytes, table, row, flag, k, true); if (hdu.extname === 'OI_VIS2') flagged++; }
            continue;
          }
        }
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
  let raisedErrors = 0;
  if (errorFloors) for (const hdu of observables.filter(hdu => hdu.extname !== 'OI_VIS')) {
    const table = binaryTable(hdu), vis2 = hdu.extname === 'OI_VIS2';
    const value = tableColumn(table, vis2 ? 'VIS2DATA' : 'T3PHI'), error = tableColumn(table, vis2 ? 'VIS2ERR' : 'T3PHIERR');
    for (let row = 0; row < table.rows; row++) {
      const values = numbers(bytes, table, row, value);
      numbers(bytes, table, row, error).forEach((current, k) => {
        const floor = vis2 ? Math.max(errorFloors.vis2Relative * Math.abs(values[k]!), errorFloors.vis2Minimum ?? 0) : errorFloors.closureDegrees;
        if (current < floor) { writeCell(bytes, table, row, error, k, floor); raisedErrors++; }
      });
    }
  }
  return { bytes, keptVis2: kept, newlyFlaggedVis2: flagged, raisedErrors };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [input, output, ...rest] = process.argv.slice(2);
  if (!input || !output) throw new TypeError('Usage: oifits-select <in.fits> <out.fits> [--window <min>:<max> ...] [--mjd <min>:<max>] [--wavelength-scale <factor>]');
  const windowsMetres: [number, number][] = [];
  let wavelengthScale = 1, mjdRange: [number, number] | undefined, half: 'even' | 'odd' | undefined, errorFloors: { vis2Relative: number; closureDegrees: number; vis2Minimum?: number } | undefined;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--window') { const [min, max] = String(rest[++i]).split(':').map(Number); windowsMetres.push([min!, max!]); }
    else if (rest[i] === '--half') { const value = rest[++i]; if (value !== 'even' && value !== 'odd') throw new TypeError('--half is even or odd.'); half = value; }
    else if (rest[i] === '--mjd') { const [min, max] = String(rest[++i]).split(':').map(Number); mjdRange = [min!, max!]; }
    else if (rest[i] === '--wavelength-scale') wavelengthScale = Number(rest[++i]);
    else if (rest[i] === '--error-floor') { const [vis2Relative, closureDegrees, vis2Minimum] = String(rest[++i]).split(':').map(Number); errorFloors = { vis2Relative: vis2Relative!, closureDegrees: closureDegrees!, ...(vis2Minimum === undefined ? {} : { vis2Minimum }) }; }
    else throw new TypeError(`Unknown argument ${rest[i]}.`);
  }
  const result = selectOifits(await readFile(input), { windowsMetres, wavelengthScale, ...(mjdRange ? { mjdRange } : {}), ...(half ? { half } : {}), ...(errorFloors ? { errorFloors } : {}) });
  await writeFile(output, result.bytes);
  console.log(`${output}: ${result.keptVis2} squared-visibility cells kept, ${result.newlyFlaggedVis2} flagged outside the windows${wavelengthScale !== 1 ? `, wavelengths divided by ${wavelengthScale}` : ''}${errorFloors ? `, ${result.raisedErrors} errors raised to the floors` : ''}.`);
}
