/** Squared-visibility and closure-phase rows of an OIFITS file, one row per spectral channel, with the channel's wavelength.
 * For a file whose channels stay separate (PIONIER's three H-band channels), the image is fitted at each channel's own
 * wavelength; the statistics are the per-channel chi-squared sums over all rows.
 *
 * OI_VIS amplitudes and phases are kept per baseline row, not per channel: a differential quantity (OIFITS 2 AMPTYP or
 * PHITYP "differential", and AMBER's amdlib phases, which state no type) is only defined relative to the other channels of
 * its row. `flagged` counts squared-visibility and closure-phase cells only, as it always has. */
import { binaryTable, numbers, readFitsHdus, tableColumn, type BinaryTable } from './fits-table.mts';
import { fitStatistics, type ImagePlane } from './image-fit.mts';

export interface ChannelVis2 { readonly u: number; readonly v: number; readonly wavelengthMetres: number; readonly vis2: number; readonly error: number }
export interface ChannelT3 { readonly u1: number; readonly v1: number; readonly u2: number; readonly v2: number; readonly wavelengthMetres: number; readonly phaseDegrees: number; readonly errorDegrees: number }
export interface VisChannel { readonly wavelengthMetres: number; readonly amplitude: number; readonly amplitudeError: number; readonly phaseDegrees: number; readonly phaseErrorDegrees: number }
/** One OI_VIS baseline row. `phaseOrder` is the polynomial in wavenumber a differential phase has removed (PHIORDER, 1 when
 * unstated: amdlib and the ESO pipelines remove an offset and a slope). */
export interface VisRow {
  readonly u: number; readonly v: number; readonly channels: readonly VisChannel[];
  readonly amplitudeType: 'absolute' | 'differential' | 'correlated flux' | 'unstated'; readonly phaseType: 'absolute' | 'differential' | 'unstated'; readonly phaseOrder: number;
}
export interface ChannelRows { readonly vis2: readonly ChannelVis2[]; readonly t3: readonly ChannelT3[]; readonly vis: readonly VisRow[]; readonly wavelengthsMetres: readonly number[]; readonly flagged: number }

const amplitudeType = (value: unknown): VisRow['amplitudeType'] => value === 'absolute' || value === 'differential' || value === 'correlated flux' ? value : 'unstated';
const phaseType = (value: unknown): VisRow['phaseType'] => value === 'absolute' || value === 'differential' ? value : 'unstated';

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
  const vis: VisRow[] = [];
  for (const hdu of hdus.filter(hdu => hdu.extname === 'OI_VIS')) {
    const table = binaryTable(hdu), list = channels(table);
    if (!table.columns.some(column => column.name === 'VISPHI')) continue;
    const kinds = { amplitudeType: amplitudeType(hdu.header.AMPTYP), phaseType: phaseType(hdu.header.PHITYP), phaseOrder: typeof hdu.header.PHIORDER === 'number' ? hdu.header.PHIORDER : 1 };
    const column = (name: string) => tableColumn(table, name);
    for (let row = 0; row < table.rows; row++) {
      const [amplitude, amplitudeError, phase, phaseError, flags] = ['VISAMP', 'VISAMPERR', 'VISPHI', 'VISPHIERR', 'FLAG'].map(name => numbers(bytes, table, row, column(name))) as [number[], number[], number[], number[], number[]];
      const kept: VisChannel[] = [];
      for (let k = 0; k < list.length; k++) if (!flags[k]) kept.push({ wavelengthMetres: list[k]!, amplitude: amplitude[k]!, amplitudeError: amplitudeError[k]!, phaseDegrees: phase[k]!, phaseErrorDegrees: phaseError[k]! });
      if (kept.length) vis.push({ u: numbers(bytes, table, row, column('UCOORD'))[0]!, v: numbers(bytes, table, row, column('VCOORD'))[0]!, channels: kept, ...kinds });
    }
  }
  return { vis2, t3, vis, wavelengthsMetres: [...new Set([...vis2, ...t3].map(row => row.wavelengthMetres))].sort(), flagged };
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
