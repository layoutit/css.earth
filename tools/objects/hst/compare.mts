#!/usr/bin/env node
import { sampleStatistics, type FitsHeader } from '@cssearth/fits';
/** Compare the re-run products of an observation with the archive's own, sample by sample: the oracle for calibrate.mts.
 *
 *   node tools/objects/hst/compare.mts <program id> <observation> <run directory> [--raw <dir>]...
 *
 * Every pinned product the run also wrote is compared. Both files are read with this repository's FITS reader, and the two
 * must be on one grid: an image extension of the same shape, a table of the same rows and columns. A different shape is not
 * reconciled, it is reported and refused, because an HST product stays on its detector's own pixels and a difference in shape
 * means a different calibration, not a different sampling.
 *
 * Reported for each extension: how many samples both hold, the share that are bit-identical, the median absolute difference
 * over the median level, and, over the samples above that median level, the correlation and the relative difference at
 * its median, 99th percentile and largest.
 * Recorded beside them: the calibration software version each run used, and every reference file the two headers name
 * differently, which is where a mismatch is looked for first.
 *
 * One receipt per product, beside the program: <program id>.<product>.reproduction.json. The receipt is also added to the
 * record the stage that made the product wrote beside it, as `archive-agreement` evidence naming that receipt: a product with
 * no record is refused rather than reported as checked, because nothing then says which run made the file compared. */
import { access, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sha256File } from '@cssearth/core/node';
import { readFitsFileRegion, type FitsFileHdu } from '@cssearth/fits/node';
import { binaryTable, numbers, readFitsHdus, tableColumn, type BinaryTable } from '../interferometry/fits-table.mts';
import { mastFile } from '../astronomy-packages/mast.mts';
import { addProductEvidence, productRecordPath, type ProductRecord } from '../product-record.mts';
import { PROGRAMS, suffixOf } from './archive.mts';
import { readHstProgram } from './calibrate.mts';
import { readHstFileHdus, type HstFileHdu } from './product-file.mts';

const REPOSITORY = resolve(import.meta.dirname, '../../..');

/** A product's own account of how it was made; a reproduction that differs starts here. */
const RUN_CARDS = ['CAL_VER', 'OPUS_VER', 'PROCTIME', 'FILENAME', 'DATE'];
/** No extension larger than this is compared; a WFC3/UVIS chip is 16.8 million samples. */
const MAX_SAMPLES = 64 * 1024 * 1024;
/** A table is read whole, so its file is bounded. */
const MAX_TABLE_BYTES = 64 * 1024 * 1024;

const named = (hdus: readonly FitsFileHdu[]) => hdus.map((hdu, index) => ({ hdu, index,
  extname: typeof hdu.header.EXTNAME === 'string' ? hdu.header.EXTNAME : index === 0 ? 'PRIMARY' : `EXT${index}`,
  extver: typeof hdu.header.EXTVER === 'number' ? hdu.header.EXTVER : 1 }));

/** The extensions of two products that can be compared, and, for each that cannot, why. The first HDU is the primary header,
 * which carries no samples. An extension is comparable only on one grid: the same name, the same version, the same shape.
 * Both products are walked: an extension only MAST holds (a re-run that lost its errors, its data quality or a second
 * detector) is reported just as one only the re-run holds, so agreement is never reported over part of a product in silence. */
export function pairExtensions(ours: readonly FitsFileHdu[], theirs: readonly FitsFileHdu[]) {
  const theirNamed = named(theirs), pairs: { name: string; ours: ReturnType<typeof named>[number]; theirs: ReturnType<typeof named>[number] }[] = [], differentGrid: string[] = [];
  for (const entry of named(ours).slice(1)) {
    const match = theirNamed.find(other => other.extname === entry.extname && other.extver === entry.extver), name = `${entry.extname},${entry.extver}`;
    if (!match) differentGrid.push(`${name}: MAST's product has no such extension`);
    else if (entry.hdu.dimensions.join('x') !== match.hdu.dimensions.join('x')) differentGrid.push(`${name}: ${entry.hdu.dimensions.join('x')} against MAST's ${match.hdu.dimensions.join('x')}`);
    else if (entry.hdu.header.XTENSION !== 'BINTABLE' && ![2, 3].includes(entry.hdu.dimensions.length)) differentGrid.push(`${name}: ${entry.hdu.dimensions.length} axes, which this comparison does not read`);
    else pairs.push({ name, ours: entry, theirs: match });
  }
  const ourNamed = named(ours);
  for (const entry of theirNamed.slice(1)) if (!ourNamed.some(other => other.extname === entry.extname && other.extver === entry.extver)) differentGrid.push(`${entry.extname},${entry.extver}: the re-run product has no such extension`);
  return { pairs, differentGrid };
}
/** One plane of a two- or three-axis image, read through the shared region reader: the plane's own two axes at its own offset
 * in the data block. The header, and with it BSCALE, BZERO and BLANK, stays the extension's. */
const planeHdu = (hdu: FitsFileHdu, plane: number): FitsFileHdu => {
  const [width, height] = hdu.dimensions as [number, number];
  return { ...hdu, dimensions: [width, height], dataStart: hdu.dataStart + plane * width * height * (Math.abs(hdu.bitpix) / 8) };
};

/** Two image extensions of the same shape, sample for sample. A three-axis extension is read one plane at a time, so what is
 * held is one plane of each file, not the cube. */
export async function compareImage(name: string, ours: { path: string; hdu: FitsFileHdu }, theirs: { path: string; hdu: FitsFileHdu }) {
  const dimensions = ours.hdu.dimensions, [width, height] = dimensions as [number, number], planes = dimensions[2] ?? 1;
  const perPlane = width * height, count = perPlane * planes;
  if (count > MAX_SAMPLES) throw new Error(`${name} has ${count} samples, more than this comparison reads.`);
  const region = { x0: 0, y0: 0, width, height };
  const read = async (side: { path: string; hdu: FitsFileHdu }, plane: number) =>
    (await readFitsFileRegion(side.path, planeHdu(side.hdu, plane), region, perPlane * 8)).values;
  const walk = async (visit: (local: number, mast: number) => void) => {
    for (let plane = 0; plane < planes; plane++) {
      const a = await read(ours, plane), b = await read(theirs, plane);
      for (let i = 0; i < perPlane; i++) visit(a[i]!, b[i]!);
    }
  };
  return { kind: 'image' as const, shape: [...dimensions], ...await statistics(walk, count) };
}

/** Every numeric column of an extracted-spectrum table, cell by cell. Character columns are not compared; the two tables must
 * otherwise hold the same columns, each of the same width. */
export async function compareTable(name: string, ours: { bytes: Buffer; table: BinaryTable }, theirs: { bytes: Buffer; table: BinaryTable }) {
  if (ours.table.rows !== theirs.table.rows) throw new Error(`${name} has ${ours.table.rows} rows against MAST's ${theirs.table.rows}.`);
  const theirNames = new Set(theirs.table.columns.map(column => column.name));
  const shared = ours.table.columns.filter(column => theirNames.has(column.name) && column.type !== 'A');
  if (shared.length !== ours.table.columns.filter(column => column.type !== 'A').length) throw new Error(`${name} and MAST's do not hold the same numeric columns.`);
  const columns = await Promise.all(shared.map(async column => {
    const theirColumn = tableColumn(theirs.table, column.name);
    if (theirColumn.repeat !== column.repeat) throw new Error(`${name} column ${column.name} holds ${column.repeat} values a row against MAST's ${theirColumn.repeat}.`);
    const count = ours.table.rows * column.repeat;
    return { column: column.name, ...await statistics(visit => {
      for (let row = 0; row < ours.table.rows; row++) {
        const a = numbers(ours.bytes, ours.table, row, column), b = numbers(theirs.bytes, theirs.table, row, theirColumn);
        for (let i = 0; i < column.repeat; i++) visit(a[i]!, b[i]!);
      }
    }, count) };
  }));
  return { kind: 'table' as const, rows: ours.table.rows, columns };
}

const cards = (header: FitsHeader, keys: readonly string[]) => Object.fromEntries(keys.filter(key => header[key] !== undefined).map(key => [key, header[key]!]));
/** Every `*FILE`, `*TAB` or `*CORR` card whose value the two headers state differently. */
function differentSettings(ours: FitsHeader, theirs: FitsHeader) {
  const keys = [...new Set([...Object.keys(ours), ...Object.keys(theirs)])].filter(key => /(?:FILE|TAB|CORR)$/u.test(key));
  return Object.fromEntries(keys.filter(key => String(ours[key] ?? '').trim() !== String(theirs[key] ?? '').trim())
    .map(key => [key, { ours: ours[key], mast: theirs[key] }]));
}

/** What agreement with the archive's own product establishes, added to the record of the run that made the re-run product.
 * `directory` holds that product; the record sits beside it, written by the stage that made it. */
export async function addArchiveAgreement(directory: string, product: string, receipt: string) {
  return addProductEvidence(productRecordPath(resolve(directory, product)), [{
    kind: 'archive-agreement', receipt: resolve(receipt), product,
    establishes: `Every extension this product and the archive's own hold on one grid was compared sample by sample, and ${receipt} states how far apart they are. ` +
      'It establishes that re-running the pipeline over the pinned inputs reproduces what MAST distributes, as closely as that receipt states; it does not establish ' +
      'that either product is right, and it says nothing about the extensions the receipt lists as not on one grid.',
  }], output => resolve(directory, output));
}

export async function compareWithMast(id: string, observation: string, run: string, sources: readonly string[] = []) {
  const { program } = await readHstProgram(id), entry = program.observations.find(other => other.observation === observation);
  if (!entry) throw new Error(`${id} has no observation ${observation}.`);
  const receipts: { path: string; receipt: Record<string, unknown>; record: ProductRecord }[] = [];
  for (const pinned of entry.products) {
    const local = resolve(run, pinned.name);
    if (!await access(local).then(() => true, () => false)) continue;
    const mastPath = await mastFile(pinned, resolve(run, '..', 'mast'), sources);
    const ourHdus = await readHstFileHdus(local), theirHdus = await readHstFileHdus(mastPath);
    const ourPrimary = ourHdus[0]!.header, theirPrimary = theirHdus[0]!.header;
    const { pairs, differentGrid } = pairExtensions(ourHdus, theirHdus), extensions: Record<string, unknown>[] = [];
    let ourBytes: Buffer | undefined, theirBytes: Buffer | undefined;
    for (const { name, ours, theirs } of pairs) {
      const at = { extname: ours.extname, extver: ours.extver };
      if (ours.hdu.header.XTENSION === 'BINTABLE') {
        ourBytes ??= await readFile(local); theirBytes ??= await readFile(mastPath);
        if (Math.max(ourBytes.length, theirBytes.length) > MAX_TABLE_BYTES) throw new Error(`${pinned.name} is larger than this comparison reads whole.`);
        extensions.push({ ...at, ...await compareTable(name, { bytes: ourBytes, table: binaryTable(readFitsHdus(ourBytes)[ours.index]!) },
          { bytes: theirBytes, table: binaryTable(readFitsHdus(theirBytes)[theirs.index]!) }) });
      } else extensions.push({ ...at, ...await compareImage(name, { path: local, hdu: ours.hdu }, { path: mastPath, hdu: theirs.hdu }) });
    }
    if (!extensions.length) throw new Error(`${pinned.name}: nothing was comparable (${differentGrid.join('; ') || 'no extensions'}).`);
    const receipt = {
      schema: 'cssearth-hst-reproduction@1', program: id, observation, product: pinned.name.replace(/\.fits$/u, ''),
      instrument: `${entry.instrument}/${entry.detector}`, opticalElement: entry.opticalElement,
      toolchain: 'tools/objects/hst/toolchain.json', crdsContext: program.crdsContext,
      mast: { ...pinned, sha256: (await sha256File(mastPath)).sha256, ...cards(theirPrimary, RUN_CARDS) },
      local: { sha256: (await sha256File(local)).sha256, ...cards(ourPrimary, RUN_CARDS) },
      differentSettings: differentSettings(ourPrimary, theirPrimary), differentGrid,
      repeatedCards: [...new Set([...ourHdus, ...theirHdus].flatMap(hdu => hdu.repeatedCards))].sort(), extensions,
    };
    const path = resolve(PROGRAMS, `${id}.${receipt.product}.reproduction.json`);
    await writeFile(path, `${JSON.stringify(receipt, null, 2)}\n`);
    const record = await addArchiveAgreement(run, pinned.name, path);
    receipts.push({ path, receipt, record });
  }
  if (!receipts.length) throw new Error(`${observation}: the run directory holds none of the pinned products.`);
  return receipts;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), [id, observation, run] = args;
  if (!id || !observation || !run) throw new TypeError('Usage: compare <program id> <observation> <run directory> [--raw <dir>]...');
  const sources = args.flatMap((arg, i) => arg === '--raw' ? [resolve(args[i + 1]!)] : []);
  for (const { path, receipt } of await compareWithMast(id, observation, resolve(run), sources)) {
    const summary = (receipt.extensions as { extname: string; kind: string; identicalShare: number | null; columns?: { column: string; identicalShare: number | null }[] }[])
      .flatMap(entry => entry.columns ? entry.columns.map(column => `${entry.extname}.${column.column} ${column.identicalShare}`) : [`${entry.extname} ${entry.identicalShare}`]);
    console.log(`REPRODUCTION ${path} ${JSON.stringify({ suffix: suffixOf(`${String(receipt.product)}.fits`), identical: summary })}`);
  }
}

async function statistics(pairs: (visit: (local: number, mast: number) => void) => Promise<void> | void, count: number) {
  const result = await sampleStatistics(pairs, count, Float32Array);
  return { samples: result.samples, both: result.both, identical: result.identical, onlyLocal: result.onlyFirst, onlyMast: result.onlySecond,
    identicalShare: result.identicalShare, medianLevel: result.medianLevel,
    medianAbsoluteDifferenceOverMedian: result.medianAbsoluteDifferenceOverMedian, aboveMedian: result.aboveMedian };
}
