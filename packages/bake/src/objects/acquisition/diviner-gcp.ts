/**
 * Diviner Global Cumulative Products (LRO-L-DLRE-5-GCP-V1.0, Williams et al. 2017): eighteen ASCII tables, one per 10
 * degree latitude strip, of channel and bolometric brightness temperatures averaged in 0.5 degree cells and 0.25 hour
 * bins of local time, from every nadir observation of 5 July 2009 to 1 April 2015. -9999 marks a bin with no
 * observation (label DESCRIPTION).
 *
 * The conversion keeps archived bin averages and selects among them; it does not fit a diurnal curve or fill a bin:
 * - `maximum`: the warmest bin average of the cell's day, over every bin that holds data;
 * - `local-time`: the mean of the bins in a stated window that hold data, written only when at least `minimumBins` of
 *   them do (by default all of them).
 * Each output is a float32 GeoTIFF of the native 720 x 360 cells, north up, left edge at -180 degrees, NaN where no
 * value is written. Rows are streamed; a strip is never held in memory.
 */
import { createReadStream } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { writeArrayBuffer } from 'geotiff';
import { requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { pds3Keyword } from '@cssearth/telescope';

const COLUMNS = ['clon', 'clat', 'ltim', 't3', 't4', 't5', 't6', 't7', 't8', 't9', 'tbol'] as const;
const WIDTH = 720, HEIGHT = 360, BINS = 96, CELL = 0.5, HOURS = 0.25, MISSING = -9999, RADIUS = 1737400;

export type GcpReduction = { id: string; kind: 'maximum'; output: string } |
  { id: string; kind: 'local-time'; fromHour: number; toHour: number; minimumBins: number; output: string };
export interface GcpRecipe {
  schema: 'cssearth-diviner-gcp-grid@1'; datasetId: string; productVersion: string; column: 'tbol';
  structure: string; tables: { label: string; table: string; south: number; north: number; labelLatitudesSwapped?: string }[];
  reductions: GcpReduction[]; receipt: string;
}

export function parseGcpRecipe(value: unknown): GcpRecipe {
  const r = requireRecord(value, 'Diviner GCP recipe');
  if (r.schema !== 'cssearth-diviner-gcp-grid@1') throw new TypeError(`Diviner GCP recipe schema is ${String(r.schema)}.`);
  if (r.column !== 'tbol') throw new TypeError(`Diviner GCP recipe column ${String(r.column)}: only tbol is supported.`);
  const tables = (Array.isArray(r.tables) ? r.tables : []).map((t, i) => {
    const table = requireRecord(t, `tables[${i}]`);
    return { label: requireString(table.label, `tables[${i}].label`), table: requireString(table.table, `tables[${i}].table`),
      south: requireFiniteNumber(table.south, `tables[${i}].south`), north: requireFiniteNumber(table.north, `tables[${i}].north`),
      // A known label defect: its MINIMUM_LATITUDE and MAXIMUM_LATITUDE are exchanged. The recipe names it with evidence;
      // the rows are still checked against the recipe's strip, cell by cell.
      ...(table.labelLatitudesSwapped === undefined ? {} : { labelLatitudesSwapped: requireString(table.labelLatitudesSwapped, `tables[${i}].labelLatitudesSwapped`) }) };
  });
  const strips = [...tables].sort((a, b) => a.south - b.south);
  if (strips.length !== 18 || strips.some((t, i) => t.south !== -90 + i * 10 || t.north !== t.south + 10)) {
    throw new TypeError('Diviner GCP recipe must list the 18 ten-degree strips from -90 to 90 once each.');
  }
  const reductions = (Array.isArray(r.reductions) ? r.reductions : []).map((v, i): GcpReduction => {
    const d = requireRecord(v, `reductions[${i}]`), id = requireString(d.id, `reductions[${i}].id`), output = requireString(d.output, `reductions[${i}].output`);
    if (d.kind === 'maximum') return { id, kind: 'maximum', output };
    if (d.kind !== 'local-time') throw new TypeError(`reductions[${i}].kind ${String(d.kind)}.`);
    const fromHour = requireFiniteNumber(d.fromHour, `reductions[${i}].fromHour`), toHour = requireFiniteNumber(d.toHour, `reductions[${i}].toHour`);
    if (!(fromHour >= 0 && toHour <= 24 && fromHour < toHour) || !Number.isInteger(fromHour / HOURS) || !Number.isInteger(toHour / HOURS)) {
      throw new TypeError(`reductions[${i}] window ${fromHour}-${toHour} h must follow the 0.25 h bin edges.`);
    }
    const bins = (toHour - fromHour) / HOURS, minimumBins = d.minimumBins === undefined ? bins : requireFiniteNumber(d.minimumBins, `reductions[${i}].minimumBins`);
    if (!Number.isInteger(minimumBins) || minimumBins < 1 || minimumBins > bins) throw new TypeError(`reductions[${i}].minimumBins ${minimumBins} must be 1 to ${bins}.`);
    return { id, kind: 'local-time', fromHour, toHour, minimumBins, output };
  });
  if (!reductions.length) throw new TypeError('Diviner GCP recipe names no reduction.');
  return { schema: 'cssearth-diviner-gcp-grid@1', datasetId: requireString(r.datasetId, 'datasetId'),
    productVersion: requireString(r.productVersion, 'productVersion'), column: 'tbol', structure: requireString(r.structure, 'structure'),
    tables, reductions, receipt: requireString(r.receipt, 'receipt') };
}

const unquote = (raw: string | undefined) => raw?.replace(/^"|"$/gu, '').trim();

/** Check one strip's label against the recipe before its rows are read. */
export function checkGcpLabel(label: string, strip: GcpRecipe['tables'][number], recipe: GcpRecipe) {
  const field = (key: string) => unquote(pds3Keyword(label, key));
  const degrees = (key: string) => Number.parseFloat(String(field(key)));
  const [minimumKey, maximumKey] = strip.labelLatitudesSwapped ? ['MAXIMUM_LATITUDE', 'MINIMUM_LATITUDE'] : ['MINIMUM_LATITUDE', 'MAXIMUM_LATITUDE'];
  const problems = [
    field('PDS_VERSION_ID') !== 'PDS3' && 'PDS_VERSION_ID',
    field('DATA_SET_ID') !== recipe.datasetId && `DATA_SET_ID ${field('DATA_SET_ID')}`,
    field('PRODUCT_VERSION_ID') !== recipe.productVersion && `PRODUCT_VERSION_ID ${field('PRODUCT_VERSION_ID')}`,
    field('PRODUCT_ID')?.toUpperCase() !== strip.table.toUpperCase() && `PRODUCT_ID ${field('PRODUCT_ID')}`,
    Number(field('RECORD_BYTES')) !== 113 && `RECORD_BYTES ${field('RECORD_BYTES')}`,
    Number(pds3Keyword(label, 'ROWS', ['TABLE'])) !== WIDTH * 20 * BINS && `TABLE ROWS ${pds3Keyword(label, 'ROWS', ['TABLE'])}`,
    Number(pds3Keyword(label, 'COLUMNS', ['TABLE'])) !== COLUMNS.length && 'TABLE COLUMNS',
    unquote(pds3Keyword(label, '^STRUCTURE', ['TABLE']))?.toUpperCase() !== recipe.structure.toUpperCase() && 'TABLE ^STRUCTURE',
    degrees(minimumKey) !== strip.south && `${minimumKey} ${field(minimumKey)}${strip.labelLatitudesSwapped ? ' (recipe says the label swaps its latitudes)' : ''}`,
    degrees(maximumKey) !== strip.north && `${maximumKey} ${field(maximumKey)}${strip.labelLatitudesSwapped ? ' (recipe says the label swaps its latitudes)' : ''}`,
    degrees('WESTERNMOST_LONGITUDE') !== -180 && 'WESTERNMOST_LONGITUDE', degrees('EASTERNMOST_LONGITUDE') !== 180 && 'EASTERNMOST_LONGITUDE',
    field('POSITIVE_LONGITUDE_DIRECTION') !== 'EAST' && 'POSITIVE_LONGITUDE_DIRECTION',
    degrees('A_AXIS_RADIUS') !== RADIUS / 1000 && 'A_AXIS_RADIUS',
  ].filter(Boolean);
  if (problems.length) throw new Error(`${strip.label}: Diviner GCP label differs from its recipe: ${problems.join('; ')}.`);
}

/** Stream every strip once and write each reduction's grid and a receipt of what was read and kept. */
export async function convertDivinerGcp(root: string, recipe: GcpRecipe) {
  const cells = WIDTH * HEIGHT;
  const maximum = new Float32Array(cells).fill(NaN), maximumHour = new Float32Array(cells).fill(NaN);
  const windows = recipe.reductions.filter((r): r is Extract<GcpReduction, { kind: 'local-time' }> => r.kind === 'local-time').map(r => ({
    reduction: r, first: r.fromHour / HOURS, count: (r.toHour - r.fromHour) / HOURS,
    sum: new Float64Array(cells), seen: new Uint8Array(cells) }));
  const observedBins = new Uint8Array(cells);
  const header = COLUMNS.join(',');
  for (const strip of [...recipe.tables].sort((a, b) => a.south - b.south)) {
    const labelPath = resolve(root, strip.label), tablePath = resolve(root, strip.table);
    checkGcpLabel(await readFile(labelPath, 'latin1'), strip, recipe);
    const seen = new Uint8Array(WIDTH * 20 * BINS);
    let line = 0;
    const lines = createInterface({ input: createReadStream(tablePath, { encoding: 'latin1' }), crlfDelay: Infinity });
    for await (const text of lines) {
      line += 1;
      const fields = text.split(',').map(f => f.trim());
      if (line === 1) { if (fields.join(',') !== header) throw new Error(`${strip.table}: header is "${text}".`); continue; }
      if (text.length !== 111 || fields.length !== COLUMNS.length) throw new Error(`${strip.table} line ${line}: ${text.length} characters, ${fields.length} fields.`);
      const [lon, lat, hour] = fields.slice(0, 3).map(Number) as [number, number, number];
      const x = Math.round((lon + 180) / CELL - 0.5), ys = Math.round((lat - strip.south) / CELL - 0.5), bin = Math.round(hour / HOURS - 0.5);
      if (![x, ys, bin].every(Number.isSafeInteger) || x < 0 || x >= WIDTH || ys < 0 || ys >= 20 || bin < 0 || bin >= BINS ||
          Math.abs(-180 + (x + 0.5) * CELL - lon) > 1e-9 || Math.abs(strip.south + (ys + 0.5) * CELL - lat) > 1e-9 ||
          Math.abs((bin + 0.5) * HOURS - hour) > 0.0051) {
        throw new Error(`${strip.table} line ${line}: cell ${lon}, ${lat}, ${hour} h is not a 0.5 degree, 0.25 hour bin centre of this strip.`);
      }
      const at = (x * 20 + ys) * BINS + bin;
      if (seen[at]) throw new Error(`${strip.table} line ${line}: bin ${lon}, ${lat}, ${hour} h repeats.`);
      seen[at] = 1;
      const tbol = Number(fields[10]);
      if (!Number.isFinite(tbol)) throw new Error(`${strip.table} line ${line}: tbol "${fields[10]}".`);
      if (tbol === MISSING) continue;
      const cell = (HEIGHT - 1 - ((strip.south + 90) / CELL + ys)) * WIDTH + x;
      observedBins[cell] += 1;
      if (!(tbol <= maximum[cell]!)) { maximum[cell] = tbol; maximumHour[cell] = (bin + 0.5) * HOURS; }
      for (const w of windows) if (bin >= w.first && bin < w.first + w.count) { w.sum[cell] += tbol; w.seen[cell] += 1; }
    }
    if (line !== WIDTH * 20 * BINS + 1) throw new Error(`${strip.table}: ${line - 1} rows, expected ${WIDTH * 20 * BINS}.`);
  }
  const outputs: Record<string, { path: string; cells: number; range: [number, number] | null }> = {};
  const write = async (reduction: GcpReduction, values: Float32Array) => {
    const bytes = new Uint8Array(writeArrayBuffer(values, {
      width: WIDTH, height: HEIGHT, SamplesPerPixel: 1, PhotometricInterpretation: 1, GTModelTypeGeoKey: 2, GeographicTypeGeoKey: 32767,
      BitsPerSample: [32], SampleFormat: [3], GDAL_NODATA: 'nan', ModelPixelScale: [CELL, CELL, 0], ModelTiepoint: [0, 0, 0, -180, 90, 0],
      GeoDoubleParams: [RADIUS], GeoKeyDirectory: [1, 1, 0, 6, 1024, 0, 1, 2, 1025, 0, 1, 1, 2054, 0, 1, 9102, 2057, 34736, 1, 0, 2058, 34736, 1, 0, 2061, 0, 1, 0],
    }));
    await writeFile(resolve(root, reduction.output), bytes);
    let n = 0, lo = Infinity, hi = -Infinity;
    for (const v of values) if (Number.isFinite(v)) { n += 1; lo = Math.min(lo, v); hi = Math.max(hi, v); }
    outputs[reduction.id] = { path: reduction.output, cells: n, range: n ? [lo, hi] : null };
  };
  for (const reduction of recipe.reductions) {
    if (reduction.kind === 'maximum') { await write(reduction, maximum); continue; }
    const w = windows.find(item => item.reduction === reduction)!;
    const values = new Float32Array(cells).fill(NaN);
    for (let i = 0; i < cells; i++) if (w.seen[i]! >= reduction.minimumBins) values[i] = w.sum[i]! / w.seen[i]!;
    await write(reduction, values);
  }
  const hours = new Map<number, number>();
  for (const h of maximumHour) if (Number.isFinite(h)) hours.set(h, (hours.get(h) ?? 0) + 1);
  const receipt = { schema: 'cssearth-diviner-gcp-receipt@1', datasetId: recipe.datasetId, productVersion: recipe.productVersion,
    column: recipe.column, outputs, cellsWithoutAnyObservation: [...observedBins].filter(n => n === 0).length,
    maximumLocalTimeHistogram: Object.fromEntries([...hours].sort((a, b) => a[0] - b[0])) };
  await writeFile(resolve(root, recipe.receipt), `${JSON.stringify(receipt, null, 1)}\n`);
  return receipt;
}
