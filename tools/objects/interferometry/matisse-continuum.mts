/** Average calibrated VLT/MATISSE squared visibilities and closure phases over their beam-commuting-device repeats inside stated
 * wavelength windows, and write one single-wavelength OIFITS an image-reconstruction code can read.
 *
 * Every step is the one the retained pilot used: channels are kept when unflagged and finite; repeats are grouped by observing
 * block, sorted station set and channel; a squared visibility's error is its standard error over repeats (or the pipeline error
 * when there is one repeat) combined with a multiplicative and an additive floor; a closure phase is averaged on the circle and
 * floored at a stated angle. Closure phases are put into ascending-station order so that the same triangle read in two orders
 * carries one sign. The output scales every baseline to one reference wavelength, so the reconstruction is monochromatic. */
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { readFitsHeader } from '@cssearth/fits';
import { binaryTableHdu, findTable, numbers, primaryHdu, readFitsHdus, tableColumn, text } from './fits-table.mts';

export interface ContinuumRecipe {
  /** Wavelength windows in micrometres, inclusive. */
  readonly windowsMicrometres: readonly (readonly [number, number])[];
  /** Reference wavelength of the output, metres. */
  readonly referenceWavelengthMetres: number;
  readonly referenceBandMetres: number;
  readonly vis2MultiplicativeFloor: number;
  readonly vis2AdditiveFloor: number;
  readonly closurePhaseFloorDegrees: number;
  readonly outputMjd: number;
  readonly outputDateObs: string;
  readonly target: { readonly name: string; readonly rightAscensionDegrees: number; readonly declinationDegrees: number; readonly spectralType: string };
}
export interface AveragedVis2 { readonly u: number; readonly v: number; readonly wavelengthMicrometres: number; readonly vis2: number; readonly error: number; readonly repeats: number; readonly configuration: string }
export interface AveragedT3 { readonly u1: number; readonly v1: number; readonly u2: number; readonly v2: number; readonly wavelengthMicrometres: number; readonly phaseDegrees: number; readonly errorDegrees: number; readonly repeats: number; readonly configuration: string }
export interface MergedContinuum { readonly vis2: readonly AveragedVis2[]; readonly t3: readonly AveragedT3[]; readonly files: readonly string[]; readonly rawVis2: number; readonly rawT3: number }

const inWindows = (wl: number, windows: ContinuumRecipe['windowsMicrometres']) => windows.some(([a, b]) => wl >= a && wl <= b);
const mean = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const sampleStd = (values: readonly number[]) => { const m = mean(values); return Math.sqrt(values.reduce((sum, value) => sum + (value - m) ** 2, 0) / (values.length - 1)); };
/** Parity of the permutation that sorts three station names: an odd reordering negates a closure phase. */
function sortedParity(names: readonly string[]): 1 | -1 {
  const order = names.map((_, i) => i).sort((a, b) => names[a]! < names[b]! ? -1 : names[a]! > names[b]! ? 1 : 0);
  let inversions = 0;
  for (let i = 0; i < order.length; i++) for (let j = i + 1; j < order.length; j++) if (order[i]! > order[j]!) inversions++;
  return inversions % 2 ? -1 : 1;
}

export async function mergeContinuum(paths: readonly string[], recipe: ContinuumRecipe): Promise<MergedContinuum> {
  type RawVis2 = { u: number; v: number; wl: number; vis2: number; error: number; file: string; stations: string };
  type RawT3 = { u1: number; v1: number; u2: number; v2: number; wl: number; phi: number; error: number; file: string; stations: readonly string[] };
  const rawVis2: RawVis2[] = [], rawT3: RawT3[] = [];
  // Each file's observing block (the template start) and array configuration (its stations in index order), from its own header
  // and OI_ARRAY: an author's files and this repository's calibrations name their files differently.
  const blocks = new Map<string, string>(), configurations = new Map<string, string>();
  for (const path of [...paths].sort()) {
    const bytes = await readFile(path), file = basename(path), templateStart = readFitsHeader(bytes).header['ESO TPL START'];
    if (typeof templateStart !== 'string') throw new Error(`${file} states no ESO TPL START.`);
    blocks.set(file, templateStart);
    const wavelengths = findTable(bytes, 'OI_WAVELENGTH'), waveColumn = tableColumn(wavelengths, 'EFF_WAVE');
    const wl = Array.from({ length: wavelengths.rows }, (_, row) => numbers(bytes, wavelengths, row, waveColumn)[0]! * 1e6);
    const array = findTable(bytes, 'OI_ARRAY'), stationName = new Map<number, string>();
    for (let row = 0; row < array.rows; row++) stationName.set(numbers(bytes, array, row, tableColumn(array, 'STA_INDEX'))[0]!, text(bytes, array, row, tableColumn(array, 'STA_NAME')));
    const name = (index: number) => stationName.get(index) ?? String(index);
    configurations.set(file, [...stationName.keys()].sort((a, b) => a - b).map(name).join(''));
    const vis2 = findTable(bytes, 'OI_VIS2');
    const col = (table: ReturnType<typeof findTable>, key: string) => tableColumn(table, key);
    for (let row = 0; row < vis2.rows; row++) {
      const data = numbers(bytes, vis2, row, col(vis2, 'VIS2DATA')), error = numbers(bytes, vis2, row, col(vis2, 'VIS2ERR')), flag = numbers(bytes, vis2, row, col(vis2, 'FLAG'));
      const [u, v] = [numbers(bytes, vis2, row, col(vis2, 'UCOORD'))[0]!, numbers(bytes, vis2, row, col(vis2, 'VCOORD'))[0]!];
      const stations = numbers(bytes, vis2, row, col(vis2, 'STA_INDEX')).map(name).join('-');
      wl.forEach((wavelength, i) => {
        if (!inWindows(wavelength, recipe.windowsMicrometres) || flag[i] || !Number.isFinite(data[i]!) || !Number.isFinite(error[i]!)) return;
        rawVis2.push({ u, v, wl: wavelength, vis2: data[i]!, error: error[i]!, file, stations });
      });
    }
    const t3 = findTable(bytes, 'OI_T3');
    for (let row = 0; row < t3.rows; row++) {
      const phi = numbers(bytes, t3, row, col(t3, 'T3PHI')), error = numbers(bytes, t3, row, col(t3, 'T3PHIERR')), flag = numbers(bytes, t3, row, col(t3, 'FLAG'));
      const [u1, v1, u2, v2] = ['U1COORD', 'V1COORD', 'U2COORD', 'V2COORD'].map(key => numbers(bytes, t3, row, col(t3, key))[0]!) as [number, number, number, number];
      const stations = numbers(bytes, t3, row, col(t3, 'STA_INDEX')).map(name);
      wl.forEach((wavelength, i) => {
        if (!inWindows(wavelength, recipe.windowsMicrometres) || flag[i] || !Number.isFinite(phi[i]!) || !Number.isFinite(error[i]!)) return;
        rawT3.push({ u1, v1, u2, v2, wl: wavelength, phi: phi[i]!, error: error[i]!, file, stations });
      });
    }
  }
  const block = (file: string) => blocks.get(file)!, configuration = (file: string) => configurations.get(file)!;
  const groupKey = (file: string, stations: readonly string[], wl: number) => `${block(file)}|${[...stations].sort().join('-')}|${wl.toFixed(5)}`;
  // ---- squared visibilities: conjugate-symmetric, so every point is folded to u >= 0 before averaging
  const vis2Groups = new Map<string, RawVis2[]>();
  for (const point of rawVis2) { const key = groupKey(point.file, point.stations.split('-'), point.wl); (vis2Groups.get(key) ?? vis2Groups.set(key, []).get(key)!).push(point); }
  const vis2 = [...vis2Groups.keys()].sort().map((key): AveragedVis2 => {
    const points = vis2Groups.get(key)!, n = points.length, folded = points.map(p => p.u < 0 ? { u: -p.u, v: -p.v } : { u: p.u, v: p.v });
    const value = mean(points.map(p => p.vis2)), sem = n > 1 ? sampleStd(points.map(p => p.vis2)) / Math.sqrt(n) : mean(points.map(p => p.error));
    return { u: mean(folded.map(p => p.u)), v: mean(folded.map(p => p.v)), wavelengthMicrometres: mean(points.map(p => p.wl)), vis2: value,
      error: Math.sqrt(sem ** 2 + (recipe.vis2MultiplicativeFloor * Math.abs(value)) ** 2 + recipe.vis2AdditiveFloor ** 2), repeats: n, configuration: configuration(points[0]!.file) };
  });
  // ---- closure phases: the triangle is rewritten in ascending station order, with the baselines it then implies
  const t3Groups = new Map<string, { phi: number; error: number; u1: number; v1: number; u2: number; v2: number; wl: number; file: string }[]>();
  for (const point of rawT3) {
    const sign = sortedParity(point.stations);
    const b1 = [point.u1, point.v1], b2 = [point.u2, point.v2], b13 = [b1[0]! + b2[0]!, b1[1]! + b2[1]!];
    const baseline = new Map<string, readonly number[]>([['0,1', b1], ['1,2', b2], ['0,2', b13]]);
    const get = (i: number, j: number) => baseline.get(`${i},${j}`) ?? baseline.get(`${j},${i}`)!.map(value => -value);
    const order = point.stations.map((_, i) => i).sort((a, b) => point.stations[a]! < point.stations[b]! ? -1 : point.stations[a]! > point.stations[b]! ? 1 : 0);
    const [p, q, s] = order as [number, number, number], nb1 = get(p, q), nb2 = get(q, s);
    const key = groupKey(point.file, point.stations, point.wl);
    (t3Groups.get(key) ?? t3Groups.set(key, []).get(key)!).push({ phi: sign * point.phi, error: point.error, u1: nb1[0]!, v1: nb1[1]!, u2: nb2[0]!, v2: nb2[1]!, wl: point.wl, file: point.file });
  }
  const rad = Math.PI / 180, wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
  const t3 = [...t3Groups.keys()].sort().map((key): AveragedT3 => {
    const points = t3Groups.get(key)!, n = points.length, phases = points.map(p => p.phi * rad);
    const mu = Math.atan2(mean(phases.map(Math.sin)), mean(phases.map(Math.cos)));
    const sem = n > 1 ? Math.sqrt(mean(phases.map(p => wrap(p - mu) ** 2))) / rad / Math.sqrt(n) : mean(points.map(p => p.error));
    return { u1: mean(points.map(p => p.u1)), v1: mean(points.map(p => p.v1)), u2: mean(points.map(p => p.u2)), v2: mean(points.map(p => p.v2)),
      wavelengthMicrometres: mean(points.map(p => p.wl)), phaseDegrees: mu / rad, errorDegrees: Math.hypot(sem, recipe.closurePhaseFloorDegrees), repeats: n, configuration: configuration(points[0]!.file) };
  });
  return { vis2, t3, files: [...paths].sort().map(path => basename(path)), rawVis2: rawVis2.length, rawT3: rawT3.length };
}

/** One monochromatic OIFITS: every baseline scaled to the reference wavelength so each row is one measurement. */
export function mergedOifits(merged: MergedContinuum, recipe: ContinuumRecipe): Buffer {
  const wl0 = recipe.referenceWavelengthMetres, scale = (wl: number) => wl0 / (wl * 1e-6);
  const arrayRows = ['A', 'B', 'C', 'D'].map((name, i) => [name, name, i + 1, 0, [0, 0, 0]] as const);
  const hdus = [primaryHdu(),
    binaryTableHdu('OI_ARRAY', [{ name: 'TEL_NAME', form: '1A' }, { name: 'STA_NAME', form: '1A' }, { name: 'STA_INDEX', form: '1I' }, { name: 'DIAMETER', form: '1E' }, { name: 'STAXYZ', form: '3D' }],
      arrayRows, [['OI_REVN', 1], ['ARRNAME', 'VLTI'], ['FRAME', 'GEOCENTRIC'], ['ARRAYX', 0.0], ['ARRAYY', 0.0], ['ARRAYZ', 0.0]]),
    binaryTableHdu('OI_WAVELENGTH', [{ name: 'EFF_WAVE', form: '1E' }, { name: 'EFF_BAND', form: '1E' }], [[wl0, recipe.referenceBandMetres]], [['OI_REVN', 1], ['INSNAME', 'MATISSE']]),
    binaryTableHdu('OI_VIS2', [{ name: 'TARGET_ID', form: '1I' }, { name: 'TIME', form: '1D' }, { name: 'MJD', form: '1D' }, { name: 'INT_TIME', form: '1D' }, { name: 'VIS2DATA', form: '1D' }, { name: 'VIS2ERR', form: '1D' },
      { name: 'UCOORD', form: '1D' }, { name: 'VCOORD', form: '1D' }, { name: 'STA_INDEX', form: '2I' }, { name: 'FLAG', form: '1L' }],
      merged.vis2.map(row => [1, 0, recipe.outputMjd, 1, row.vis2, row.error, row.u * scale(row.wavelengthMicrometres), row.v * scale(row.wavelengthMicrometres), [1, 2], false]),
      [['OI_REVN', 1], ['DATE-OBS', recipe.outputDateObs], ['ARRNAME', 'VLTI'], ['INSNAME', 'MATISSE']]),
    binaryTableHdu('OI_T3', [{ name: 'TARGET_ID', form: '1I' }, { name: 'TIME', form: '1D' }, { name: 'MJD', form: '1D' }, { name: 'INT_TIME', form: '1D' }, { name: 'T3AMP', form: '1D' }, { name: 'T3AMPERR', form: '1D' },
      { name: 'T3PHI', form: '1D' }, { name: 'T3PHIERR', form: '1D' }, { name: 'U1COORD', form: '1D' }, { name: 'V1COORD', form: '1D' }, { name: 'U2COORD', form: '1D' }, { name: 'V2COORD', form: '1D' }, { name: 'STA_INDEX', form: '3I' }, { name: 'FLAG', form: '1L' }],
      merged.t3.map(row => { const s = scale(row.wavelengthMicrometres); return [1, 0, recipe.outputMjd, 1, 0, 0, row.phaseDegrees, row.errorDegrees, row.u1 * s, row.v1 * s, row.u2 * s, row.v2 * s, [1, 2, 3], false]; }),
      [['OI_REVN', 1], ['DATE-OBS', recipe.outputDateObs], ['ARRNAME', 'VLTI'], ['INSNAME', 'MATISSE']]),
    binaryTableHdu('OI_TARGET', [{ name: 'TARGET_ID', form: '1I' }, { name: 'TARGET', form: '16A' }, { name: 'RAEP0', form: '1D' }, { name: 'DECEP0', form: '1D' }, { name: 'EQUINOX', form: '1E' }, { name: 'RA_ERR', form: '1D' }, { name: 'DEC_ERR', form: '1D' },
      { name: 'SYSVEL', form: '1D' }, { name: 'VELTYP', form: '8A' }, { name: 'VELDEF', form: '8A' }, { name: 'PMRA', form: '1D' }, { name: 'PMDEC', form: '1D' }, { name: 'PMRA_ERR', form: '1D' }, { name: 'PMDEC_ERR', form: '1D' }, { name: 'PARALLAX', form: '1E' }, { name: 'PARA_ERR', form: '1E' }, { name: 'SPECTYP', form: '16A' }],
      [[1, recipe.target.name, recipe.target.rightAscensionDegrees, recipe.target.declinationDegrees, 2000, 0, 0, 0, 'LSR', 'OPTICAL', 0, 0, 0, 0, 0, 0, recipe.target.spectralType]], [['OI_REVN', 1]])];
  return Buffer.concat(hdus);
}

/** Read back a merged file: the rows an image is checked against. */
export function readMergedContinuum(bytes: Buffer) {
  const wavelengths = findTable(bytes, 'OI_WAVELENGTH'), wl0 = numbers(bytes, wavelengths, 0, tableColumn(wavelengths, 'EFF_WAVE'))[0]!;
  const vis2Table = findTable(bytes, 'OI_VIS2'), t3Table = findTable(bytes, 'OI_T3');
  const cell = (table: ReturnType<typeof findTable>, row: number, key: string) => numbers(bytes, table, row, tableColumn(table, key))[0]!;
  const vis2 = Array.from({ length: vis2Table.rows }, (_, row) => ({ u: cell(vis2Table, row, 'UCOORD'), v: cell(vis2Table, row, 'VCOORD'), vis2: cell(vis2Table, row, 'VIS2DATA'), error: cell(vis2Table, row, 'VIS2ERR') }));
  const t3 = Array.from({ length: t3Table.rows }, (_, row) => ({ u1: cell(t3Table, row, 'U1COORD'), v1: cell(t3Table, row, 'V1COORD'), u2: cell(t3Table, row, 'U2COORD'), v2: cell(t3Table, row, 'V2COORD'),
    phaseDegrees: cell(t3Table, row, 'T3PHI'), errorDegrees: cell(t3Table, row, 'T3PHIERR') }));
  return { wavelengthMetres: wl0, vis2, t3 };
}
