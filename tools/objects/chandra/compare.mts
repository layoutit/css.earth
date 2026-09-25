#!/usr/bin/env node
/** Compare the re-run level-2 event list of an observation with the archive's own, event by event: the oracle for reprocess.mts.
 *
 *   node tools/objects/chandra/compare.mts <program id> <obsid> <run directory> [--raw <dir>]...
 *
 * An event list is a table, not an image, and standard data processing drops events as well as changing them, so the two lists
 * are not row for row. They are matched on what the instrument telemetered and no processing rewrites: for ACIS the chip the
 * event landed on, the exposure frame it came down in and its chip coordinates; for HRC its time and its chip coordinates. The
 * match is refused unless that key is unique in both lists, which is what makes the join an identity rather than a guess.
 *
 * Reported from the match: how many events both lists keep, how many only the re-run keeps, how many only the archive's product
 * keeps, and, over the events both keep, for every scalar column the two lists share -- the sky and detector coordinates, the
 * pulse heights, the energy and PI, the grades, the status bits -- the share that agree exactly and how far the rest are apart.
 * The sky positions are also reported together, as the distance between the two placements of the same event, in sky pixels and
 * in arcseconds.
 * Beside them a binned counts image on one grid: both lists binned into the same sky blocks, with the bins that differ.
 * Recorded too: the CIAO and CALDB versions each run used, and every processing card the two headers state differently, which is
 * where a difference is looked for first. The re-run's versions are read from the product record reprocess.mts wrote beside the
 * event list, not from the software installed on the machine running the comparison, which is another environment entirely; an
 * event list with no record beside it is not compared. What the comparison establishes is added to that record as evidence.
 *
 * One receipt per product: programs/<program id>.<product>.reproduction.json. */
import { access, readdir, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { FitsHeader } from '@cssearth/fits';
import { addProductEvidence, readProductRecord, runDigest } from '@cssearth/telescope/node';
import { productRecordPath, type ProductEvidence, type ProductRecord } from '@cssearth/telescope';
import { chandraFile, observationMode, PROGRAMS, type ChandraFile } from './archive.mts';
import { column, eventColumn, eventTable, gunzipFile, requireEventColumn, scalar, type EventTable } from './events.mts';
import { readChandraProgram } from './reprocess.mts';

/** A run's own account of how it was made; a reproduction that differs starts here. */
const RUN_CARDS = ['CREATOR', 'ASCDSVER', 'REVISION', 'DATE', 'CALDBVER', 'RAND_SKY', 'RAND_PI', 'RAND_TIM', 'CTI_CORR', 'CTI_APP',
  'TGAINCOR', 'TGAINFIL', 'GRD_FILE', 'GAINFILE', 'CTIFILE', 'THRFILE', 'SUBPIXFL', 'PIX_ADJ', 'CHECKVF', 'DTCOR', 'ONTIME', 'LIVETIME', 'EXPOSURE'];
/** No event list larger than this is read whole, and both sides are held at once. */
const MAX_EVENT_BYTES = 1024 * 1024 * 1024;
/** What the instrument telemetered and no processing rewrites, so two lists of one observation can be matched on it. */
const KEYS: Readonly<Record<string, readonly string[]>> = {
  ACIS: ['ccd_id', 'expno', 'chipx', 'chipy'],
  HRC: ['time', 'chipx', 'chipy'],
};
/** The sky grid is binned into at most this many blocks a side. */
const IMAGE_BLOCKS = 1024;
/** One ACIS or HRC sky pixel, in arcseconds; the level-2 sky grid is stated in them (TCDLT of the sky columns). */
const SKY_PIXEL_ARCSEC = 0.492;
const REPOSITORY = resolve(import.meta.dirname, '../../..');

/** The CIAO and CALDB that made this event list, from the record the run wrote beside it. The machine running the comparison has
 * its own installed CIAO and CALDB, which may be years from the ones that made the event list and are never what a receipt
 * reports; a product with no record is not compared, because its environment is then not known. */
export function reprocessedWith(record: ProductRecord | null, product: string, path: string): { record: ProductRecord; ciao: string; caldb: string } {
  if (!record) throw new Error(`${product} has no product record at ${path}: reprocess.mts writes one beside every level-2 event list it makes, and a receipt states the CIAO and CALDB of that run, not the ones installed here.`);
  const version = (name: string) => {
    const found = record.software.find(entry => entry.name === name);
    if (!found) throw new Error(`The product record at ${path} states no ${name} version, so the environment that made ${product} is not known.`);
    return found.version;
  };
  return { record, ciao: version('ciao'), caldb: version('caldb') };
}

/** What matching our events against the archive's own product establishes, for the record of the run that made ours. */
export const archiveAgreement = (product: string, receipt: string, archive: string): ProductEvidence => ({ kind: 'archive-agreement', product, receipt,
  establishes: `${product} was matched event for event against the archive's own level-2 event list (${archive}) on what the instrument telemetered, ` +
    'and every column the two lists share was compared over the matched events, with both lists binned into one sky grid. That establishes that this ' +
    'run of standard data processing reproduces the archive\'s independent run of it from the same pinned level-1 data, as far as the receipt states; ' +
    'it establishes nothing about either run\'s calibration being right, and nothing about any product this run did not write.' });

const quantile = (sorted: Float64Array, q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)))] ?? Number.NaN;

/** The join key of every event of both lists, as one number each. Every key column is rank-compressed over the two lists
 * together -- each distinct value it takes becomes its position in the sorted list of them -- so the same event keys the same in
 * both, a column of any type can key (HRC keys on `time`, a double), and the packed key stays inside an exact integer. If the
 * ranks still would not pack, the comparison stops rather than letting two events collide. */
export function eventKeys(sides: readonly { bytes: Buffer; table: EventTable }[], names: readonly string[]) {
  const columns = sides.map(side => names.map(name => requireEventColumn(side.table, name)));
  const values = sides.map((side, which) => names.map((_, index) => {
    const read = new Float64Array(side.table.rows);
    for (let row = 0; row < side.table.rows; row++) read[row] = scalar(side.bytes, side.table, row, columns[which]![index]!);
    return read;
  }));
  const ranks = names.map((_, index) => {
    const distinct = [...new Set(sides.flatMap((_, which) => Array.from(values[which]![index]!)))].sort((a, b) => a - b);
    return new Map(distinct.map((value, position) => [value, position]));
  });
  const spans = ranks.map(rank => rank.size);
  const total = spans.reduce((product, span) => product * span, 1);
  if (!Number.isSafeInteger(total)) throw new Error(`${names.join(', ')} take ${total} combinations, more than one exact key states.`);
  return sides.map((_, which) => {
    const keys = new Float64Array(values[which]![0]!.length);
    for (let row = 0; row < keys.length; row++) {
      let key = 0;
      for (let index = 0; index < names.length; index++) key = key * spans[index]! + ranks[index]!.get(values[which]![index]![row]!)!;
      keys[row] = key;
    }
    return keys;
  });
}

/** Row of each list for every event both hold, and how many each holds alone. A key that repeats within one list stops the
 * comparison: the two lists could then not be matched on it. */
export function matchEvents(ours: Float64Array, theirs: Float64Array, names: readonly string[]) {
  const index = new Map<number, number>();
  for (let row = 0; row < theirs.length; row++) {
    if (index.has(theirs[row]!)) throw new Error(`${names.join(', ')} do not identify an event: the archive's list repeats one.`);
    index.set(theirs[row]!, row);
  }
  const seen = new Set<number>(), ourRows: number[] = [], theirRows: number[] = [];
  for (let row = 0; row < ours.length; row++) {
    const key = ours[row]!;
    if (seen.has(key)) throw new Error(`${names.join(', ')} do not identify an event: the re-run's list repeats one.`);
    seen.add(key);
    const match = index.get(key);
    if (match !== undefined) { ourRows.push(row); theirRows.push(match); }
  }
  return { ourRows, theirRows, onlyOurs: ours.length - ourRows.length, onlyArchive: theirs.length - theirRows.length };
}

/** One column over the matched events: how many agree exactly, and how far the rest are apart. */
function compareColumn(name: string, ours: Float64Array, theirs: Float64Array, ourRows: readonly number[], theirRows: readonly number[]) {
  const count = ourRows.length, differences = new Float64Array(count);
  let identical = 0, written = 0, largest = 0;
  for (let index = 0; index < count; index++) {
    const a = ours[ourRows[index]!]!, b = theirs[theirRows[index]!]!;
    if (a === b) identical++;
    const difference = Math.abs(a - b);
    if (difference > largest) largest = difference;
    differences[written++] = difference;
  }
  const sorted = differences.subarray(0, written).slice().sort();
  return { column: name, matched: count, identical, identicalShare: count ? identical / count : null,
    absoluteDifference: count ? { median: quantile(sorted, 0.5), p99: quantile(sorted, 0.99), largest } : null };
}

/** Both matched placements of every event, as the distance between them. */
function compareSky(ourX: Float64Array, ourY: Float64Array, theirX: Float64Array, theirY: Float64Array, ourRows: readonly number[], theirRows: readonly number[]) {
  const count = ourRows.length, distances = new Float64Array(count);
  let identical = 0;
  for (let index = 0; index < count; index++) {
    const dx = ourX[ourRows[index]!]! - theirX[theirRows[index]!]!, dy = ourY[ourRows[index]!]! - theirY[theirRows[index]!]!;
    if (dx === 0 && dy === 0) identical++;
    distances[index] = Math.hypot(dx, dy);
  }
  const sorted = distances.slice().sort();
  const pixels = { median: quantile(sorted, 0.5), p99: quantile(sorted, 0.99), largest: quantile(sorted, 1) };
  return { matched: count, identical, identicalShare: count ? identical / count : null, skyPixels: pixels,
    arcseconds: { median: pixels.median * SKY_PIXEL_ARCSEC, p99: pixels.p99 * SKY_PIXEL_ARCSEC, largest: pixels.largest * SKY_PIXEL_ARCSEC } };
}

/** Both event lists binned into one sky grid: every event of each list, not only the matched ones, so an event one list drops
 * shows as a bin that differs. The grid spans both lists and is blocked down to at most IMAGE_BLOCKS a side. */
export function compareBinnedImage(ourX: Float64Array, ourY: Float64Array, theirX: Float64Array, theirY: Float64Array) {
  const extent = (...lists: readonly Float64Array[]) => {
    let low = Infinity, high = -Infinity;
    for (const values of lists) for (const value of values) { if (value < low) low = value; if (value > high) high = value; }
    if (!Number.isFinite(low) || !Number.isFinite(high)) throw new Error('The event lists hold no sky positions to bin.');
    return { low, high };
  };
  const x = extent(ourX, theirX), y = extent(ourY, theirY);
  const bounds = { x0: Math.floor(x.low), x1: Math.ceil(x.high), y0: Math.floor(y.low), y1: Math.ceil(y.high) };
  const span = Math.max(bounds.x1 - bounds.x0, bounds.y1 - bounds.y0) + 1;
  const block = Math.max(1, Math.ceil(span / IMAGE_BLOCKS));
  const width = Math.ceil((bounds.x1 - bounds.x0 + 1) / block), height = Math.ceil((bounds.y1 - bounds.y0 + 1) / block);
  const bin = (xs: Float64Array, ys: Float64Array) => {
    const counts = new Int32Array(width * height);
    for (let index = 0; index < xs.length; index++) {
      const column = Math.floor((xs[index]! - bounds.x0) / block), row = Math.floor((ys[index]! - bounds.y0) / block);
      if (column >= 0 && column < width && row >= 0 && row < height) counts[row * width + column]! += 1;
    }
    return counts;
  };
  const ourCounts = bin(ourX, ourY), theirCounts = bin(theirX, theirY);
  let identical = 0, occupied = 0, largest = 0, absolute = 0, ourTotal = 0, theirTotal = 0;
  for (let index = 0; index < ourCounts.length; index++) {
    const a = ourCounts[index]!, b = theirCounts[index]!;
    ourTotal += a; theirTotal += b;
    if (a === b) identical++;
    if (a || b) occupied++;
    const difference = Math.abs(a - b);
    absolute += difference;
    if (difference > largest) largest = difference;
  }
  return { blockSkyPixels: block, shape: [width, height], bins: ourCounts.length, occupiedBins: occupied,
    identicalBins: identical, identicalShare: ourCounts.length ? identical / ourCounts.length : null,
    counts: { ours: ourTotal, archive: theirTotal }, largestBinDifference: largest,
    totalAbsoluteBinDifference: absolute };
}

const cards = (header: FitsHeader, keys: readonly string[]) => Object.fromEntries(keys.filter(key => header[key] !== undefined).map(key => [key, header[key]!]));
function differentCards(ours: FitsHeader, theirs: FitsHeader) {
  const keys = [...new Set([...Object.keys(ours), ...Object.keys(theirs)])]
    .filter(key => /(?:FILE|CORR|VER|_APP|ADJ|RAND_)/u.test(key) && !['DATE', 'CREATOR'].includes(key));
  return Object.fromEntries(keys.filter(key => String(ours[key] ?? '').trim() !== String(theirs[key] ?? '').trim())
    .map(key => [key, { ours: ours[key] ?? null, archive: theirs[key] ?? null }]));
}

const readEvents = async (path: string) => {
  const expanded = await gunzipFile(path);
  if (expanded.bytes > MAX_EVENT_BYTES) throw new Error(`${expanded.path} is ${expanded.bytes} bytes, larger than this comparison reads whole.`);
  const bytes = await readFile(expanded.path);
  return { path: expanded.path, bytes, table: eventTable(bytes) };
};

export async function compareWithArchive(id: string, obsid: number, run: string, sources: readonly string[] = []) {
  const { program } = await readChandraProgram(id), entry = program.observations.find(other => other.obsid === obsid);
  if (!entry) throw new Error(`${id} has no observation ${obsid}.`);
  const receipts: { path: string; receipt: Record<string, unknown> }[] = [];
  // chandra_repro names its own output (acisf<obsid>_repro_evt2.fits), not the archive's, so the re-run's level-2 event list is
  // found in the run directory rather than looked up by the archive's file name.
  const written = (await readdir(run)).filter(name => /_evt2\.fits$/u.test(name)).sort();
  if (written.length !== 1) throw new Error(`${run} holds ${written.length} level-2 event lists; run reprocess.mts first.`);
  const local = resolve(run, written[0]!), recordPath = productRecordPath(local);
  const made = reprocessedWith(await readProductRecord(recordPath), written[0]!, recordPath);
  for (const pinned of entry.products.filter((file: ChandraFile) => /_evt2\.fits(?:\.gz)?$/u.test(file.path))) {
    const name = pinned.path.slice(pinned.path.lastIndexOf('/') + 1).replace(/\.gz$/u, '');
    if (!await access(local).then(() => true, () => false)) throw new Error(`${run} holds no ${written[0]!}; run reprocess.mts first.`);
    const archivePath = await chandraFile(pinned, resolve(run, '..', 'archive'), sources);
    const ours = await readEvents(local), theirs = await readEvents(archivePath);
    const key = KEYS[entry.instrument];
    if (!key) throw new Error(`${entry.instrument} has no event key here: ${Object.keys(KEYS).join(', ')}.`);
    const [ourKeys, theirKeys] = eventKeys([ours, theirs], key) as [Float64Array, Float64Array];
    const match = matchEvents(ourKeys, theirKeys, key);
    // Only the scalar numeric columns both lists hold are compared; a column one list alone carries is reported, not guessed at.
    const ourNames = ours.table.columns.filter(entry => entry.type !== 'A' && (entry.repeat === 1 || entry.type === 'X')).map(entry => entry.name);
    const shared = ourNames.filter(name => eventColumn(theirs.table, name) !== undefined && !key.includes(name));
    const onlyOneSide = [...ourNames.filter(name => !eventColumn(theirs.table, name)), ...theirs.table.columns.map(entry => entry.name).filter(name => !eventColumn(ours.table, name))];
    const columns = shared.map(name => compareColumn(name, column(ours.bytes, ours.table, name), column(theirs.bytes, theirs.table, name), match.ourRows, match.theirRows));
    const ourX = column(ours.bytes, ours.table, 'x'), ourY = column(ours.bytes, ours.table, 'y');
    const theirX = column(theirs.bytes, theirs.table, 'x'), theirY = column(theirs.bytes, theirs.table, 'y');
    const receipt = {
      schema: 'cssearth-chandra-reproduction@2', program: id, obsid, product: name.replace(/\.fits$/u, ''),
      instrument: `${entry.instrument}/${entry.detector}`, grating: entry.grating, dataMode: observationMode(entry),
      target: entry.targetName, toolchain: 'tools/objects/chandra/toolchain.json',
      // Where the versions below come from: the record the reprocessing run wrote beside its event list, and the digest of that
      // run. Nothing here is read from the software installed on the machine that ran this comparison.
      productRecord: { file: recordPath.slice(run.length + 1), runDigest: runDigest(made.record) },
      reprocessedWith: { ciao: made.ciao, caldb: made.caldb },
      archive: { ...pinned, ...cards(theirs.table.hdu.header, RUN_CARDS) },
      local: { name: written[0]!, bytes: ours.bytes.length, ...cards(ours.table.hdu.header, RUN_CARDS) },
      differentCards: differentCards(ours.table.hdu.header, theirs.table.hdu.header),
      events: { key, ours: ours.table.rows, archive: theirs.table.rows, matched: match.ourRows.length, onlyOurs: match.onlyOurs, onlyArchive: match.onlyArchive },
      sky: compareSky(ourX, ourY, theirX, theirY, match.ourRows, match.theirRows),
      binnedImage: compareBinnedImage(ourX, ourY, theirX, theirY),
      columns, columnsOnOneSide: onlyOneSide,
    };
    const path = resolve(PROGRAMS, `${id}.${receipt.product}.reproduction.json`);
    await writeFile(path, `${JSON.stringify(receipt, null, 2)}\n`);
    // What this comparison established goes on the record of the run that made the event list, naming the exact product checked
    // and the receipt holding the numbers. The record refuses it unless the products it pins are still the files on disk.
    await addProductEvidence(recordPath, [archiveAgreement(written[0]!, relative(REPOSITORY, path), pinned.path)], recorded => resolve(run, recorded));
    receipts.push({ path, receipt });
  }
  if (!receipts.length) throw new Error(`${obsid}: the program pins no level-2 event list to compare.`);
  return receipts;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), [id, obsid, run] = args;
  if (!id || !obsid || !/^\d+$/u.test(obsid) || !run) throw new TypeError('Usage: compare <program id> <obsid> <run directory> [--raw <dir>]...');
  const sources = args.flatMap((arg, index) => arg === '--raw' ? [resolve(args[index + 1]!)] : []);
  for (const { path, receipt } of await compareWithArchive(id, Number(obsid), resolve(run), sources)) {
    const events = receipt.events as { ours: number; archive: number; matched: number; onlyOurs: number; onlyArchive: number };
    const columns = (receipt.columns as { column: string; identicalShare: number | null }[]).map(entry => `${entry.column} ${entry.identicalShare}`);
    console.log(`REPRODUCTION ${path} ${JSON.stringify({ events, identical: columns })}`);
  }
}
