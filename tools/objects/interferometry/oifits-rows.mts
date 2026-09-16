/** Squared-visibility and closure-phase rows of an OIFITS file, one row per spectral channel, with the channel's wavelength.
 * For a file whose channels stay separate (PIONIER's three H-band channels), the image is fitted at each channel's own
 * wavelength; the statistics are the per-channel chi-squared sums over all rows. */
import { binaryTable, numbers, readFitsHdus, tableColumn, type BinaryTable } from './fits-table.mts';
import { fitStatistics, type ImagePlane } from './image-fit.mts';

export interface ChannelVis2 { readonly u: number; readonly v: number; readonly wavelengthMetres: number; readonly vis2: number; readonly error: number }
export interface ChannelT3 { readonly u1: number; readonly v1: number; readonly u2: number; readonly v2: number; readonly wavelengthMetres: number; readonly phaseDegrees: number; readonly errorDegrees: number }
export interface ChannelRows { readonly vis2: readonly ChannelVis2[]; readonly t3: readonly ChannelT3[]; readonly wavelengthsMetres: readonly number[]; readonly flagged: number }

export function readChannelRows(bytes: Buffer): ChannelRows {
  const hdus = readFitsHdus(bytes);
  const wavelengths = new Map<string, number[]>();
  for (const hdu of hdus.filter(hdu => hdu.extname === 'OI_WAVELENGTH')) {
    const table = binaryTable(hdu), column = tableColumn(table, 'EFF_WAVE');
    wavelengths.set(String(hdu.header.INSNAME), Array.from({ length: table.rows }, (_, row) => numbers(bytes, table, row, column)[0]!));
  }
  const channels = (table: BinaryTable) => { const list = wavelengths.get(String(table.hdu.header.INSNAME)); if (!list) throw new Error(`No OI_WAVELENGTH for ${String(table.hdu.header.INSNAME)}.`); return list; };
  const vis2: ChannelVis2[] = [], t3: ChannelT3[] = []; let flagged = 0;
  for (const hdu of hdus.filter(hdu => hdu.extname === 'OI_VIS2')) {
    const table = binaryTable(hdu), list = channels(table);
    for (let row = 0; row < table.rows; row++) {
      const u = numbers(bytes, table, row, tableColumn(table, 'UCOORD'))[0]!, v = numbers(bytes, table, row, tableColumn(table, 'VCOORD'))[0]!;
      const values = numbers(bytes, table, row, tableColumn(table, 'VIS2DATA')), errors = numbers(bytes, table, row, tableColumn(table, 'VIS2ERR')), flags = numbers(bytes, table, row, tableColumn(table, 'FLAG'));
      for (let k = 0; k < values.length; k++) { if (flags[k]) { flagged++; continue; } vis2.push({ u, v, wavelengthMetres: list[k]!, vis2: values[k]!, error: errors[k]! }); }
    }
  }
  for (const hdu of hdus.filter(hdu => hdu.extname === 'OI_T3')) {
    const table = binaryTable(hdu), list = channels(table);
    for (let row = 0; row < table.rows; row++) {
      const u1 = numbers(bytes, table, row, tableColumn(table, 'U1COORD'))[0]!, v1 = numbers(bytes, table, row, tableColumn(table, 'V1COORD'))[0]!;
      const u2 = numbers(bytes, table, row, tableColumn(table, 'U2COORD'))[0]!, v2 = numbers(bytes, table, row, tableColumn(table, 'V2COORD'))[0]!;
      const phases = numbers(bytes, table, row, tableColumn(table, 'T3PHI')), errors = numbers(bytes, table, row, tableColumn(table, 'T3PHIERR')), flags = numbers(bytes, table, row, tableColumn(table, 'FLAG'));
      for (let k = 0; k < phases.length; k++) { if (flags[k]) { flagged++; continue; } t3.push({ u1, v1, u2, v2, wavelengthMetres: list[k]!, phaseDegrees: phases[k]!, errorDegrees: errors[k]! }); }
    }
  }
  return { vis2, t3, wavelengthsMetres: [...new Set([...vis2, ...t3].map(row => row.wavelengthMetres))].sort(), flagged };
}

/** Reduced chi-squared of an image against every channel, each channel transformed at its own wavelength. */
export function fitChannels(image: ImagePlane, rows: ChannelRows) {
  let chi2Vis2 = 0, chi2T3 = 0;
  for (const wavelength of rows.wavelengthsMetres) {
    const vis2 = rows.vis2.filter(row => row.wavelengthMetres === wavelength), t3 = rows.t3.filter(row => row.wavelengthMetres === wavelength);
    const fit = fitStatistics(image, wavelength, vis2, t3);
    chi2Vis2 += fit.reducedChi2Vis2 * vis2.length; chi2T3 += fit.reducedChi2T3 * t3.length;
  }
  return { reducedChi2Vis2: chi2Vis2 / rows.vis2.length, reducedChi2T3: chi2T3 / rows.t3.length, vis2Rows: rows.vis2.length, t3Rows: rows.t3.length };
}
