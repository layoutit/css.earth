#!/usr/bin/env node
/** Check a DRAGONS re-run against something that is not itself, and write the receipt.
 *
 *   node tools/objects/gemini/compare.mts <program id> <work directory> archive <bias|flat-bias|flat>
 *   node tools/objects/gemini/compare.mts <program id> <work directory> halves
 *
 * Two checks, and they establish different things. Which one a product has is recorded in its own product record, so a
 * reader asks for the kind of evidence they need rather than trusting that a receipt exists.
 *
 * **`archive` (archive-agreement).** Our master calibration against the archive's own master made from the same raw frames.
 * This is an external oracle, and it is worth being exact about what it is not: **the archive's GMOS masters are Gemini IRAF
 * products**, written by `gprepare`/`gireduce`/`gemcombine` in the nightly pipeline, not by DRAGONS. So this compares two
 * different official Gemini pipelines reducing identical raw frames, not one pipeline against its own earlier output. The
 * two are expected to differ, and the receipt says by how much rather than calling agreement a pass.
 *
 * The two products are not on the same grid: DRAGONS keeps the whole read-out region while IRAF trims further. Each
 * extension states in its own `DETSEC` card which detector columns and rows it holds, so the overlap is **read from the
 * products** and not fitted, and extensions are matched by the detector region they cover rather than by their order in the
 * file.
 *
 * **`halves` (internal-consistency).** The two disjoint halves of the science dither, reduced separately through the same
 * masters and compared. They share no exposure. What this shows is that the reduction is stable against which exposures went
 * into it; it cannot show the pipeline is right, because nothing here has a correct answer to check against. The archive
 * publishes no processed science product for this programme, which is why there is nothing better.
 *
 * DRAGONS resamples each stack onto a frame referenced to its own first exposure, so the two halves have different shapes
 * and different tangent points. They are registered through the world coordinates each product carries, by mapping one
 * frame's tangent point through both. That registration is then **checked against the data**: the same comparison is made at
 * the neighbouring whole-pixel shifts, and if one of those agrees better than the WCS's own answer the comparison is refused
 * and the shifts are reported. Nothing is resampled to make two products agree.
 *
 * The receipt is written to tools/objects/gemini/programs/<program id>.<product>.reproduction.json, and the evidence it
 * establishes is added to the product record beside the product it is about. */
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { positionalArguments } from '@cssearth/core';
import { readFitsFileHdus, readFitsFileRegion, type FitsFileHdu } from '@cssearth/fits/node';
import { addProductEvidence, assertInputPins, productRecordPath, readProductRecord, sameRun,
  type EvidenceKind, type ProductInput, type ProductRecord } from '../product-record.mts';
import { PROGRAMS, readGeminiProgram, type GeminiProgram } from './archive.mts';
import { geminiFile } from './cadc.mts';
import { currentProduct, rawDirectory, repositoryPath, stageDirectory, stageRun, STAGES,
  type RunContext, type Stage } from './reduce.mts';
import { dragonsToolchainVersions, geminiToolchain } from './toolchain.mts';

/** No image larger than this is compared. A mosaicked GMOS stack is about 7 million samples; this is room for several times
 * that and a bound on a mistake, not a limit anything real meets. */
export const MAX_SAMPLES = 64 * 1024 * 1024;

const quantile = (sorted: Float64Array, q: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))))] ?? Number.NaN;

export interface Statistics {
  /** Samples both products hold at the same place, after registration. */
  readonly both: number;
  readonly identical: number;
  readonly identicalShare: number | null;
  /** The level the differences are measured against: the median of the second product over the compared samples. */
  readonly medianLevel: number;
  readonly medianAbsoluteDifference: number;
  readonly absoluteDifference: { readonly median: number; readonly p99: number; readonly largest: number } | null;
  /** Over the samples above the median level, where there is signal rather than sky. */
  readonly aboveMedian: { readonly samples: number; readonly correlation: number | null;
    readonly relativeDifference: { readonly median: number; readonly p99: number } | null };
}

/** Two equal-length sample runs compared: counts, bit-identity, and how far the rest are apart.
 *
 * Only samples both products hold as finite numbers are compared; anything else is counted, not guessed at. The walk is
 * given twice so a caller that streams from disk holds only what it is reading. */
export async function statistics(walk: (visit: (first: number, second: number) => void) => Promise<void> | void, count: number): Promise<Statistics> {
  if (!Number.isSafeInteger(count) || count < 1 || count > MAX_SAMPLES) throw new RangeError(`${count} samples is not a comparable image.`);
  const levels = new Float64Array(count), differences = new Float64Array(count), firsts = new Float64Array(count);
  let both = 0, identical = 0;
  await walk((first, second) => {
    if (!Number.isFinite(first) || !Number.isFinite(second)) return;
    if (first === second) identical++;
    firsts[both] = first; levels[both] = second; differences[both] = Math.abs(first - second); both++;
  });
  if (!both) throw new Error('The two products share no finite sample; there is nothing to compare.');
  const level = quantile(levels.subarray(0, both).slice().sort(), 0.5);
  const sortedDifferences = differences.subarray(0, both).slice().sort();
  const above: number[] = [], aboveFirst: number[] = [], aboveSecond: number[] = [];
  for (let index = 0; index < both; index++) if (levels[index]! > level) {
    above.push(differences[index]! / Math.abs(levels[index]!)); aboveFirst.push(firsts[index]!); aboveSecond.push(levels[index]!);
  }
  const correlation = (() => {
    if (aboveFirst.length < 2) return null;
    const n = aboveFirst.length, ma = aboveFirst.reduce((t, v) => t + v, 0) / n, mb = aboveSecond.reduce((t, v) => t + v, 0) / n;
    let sab = 0, saa = 0, sbb = 0;
    for (let i = 0; i < n; i++) { const da = aboveFirst[i]! - ma, db = aboveSecond[i]! - mb; sab += da * db; saa += da * da; sbb += db * db; }
    return saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : null;
  })();
  const relative = above.length ? (() => { const sorted = Float64Array.from(above).sort();
    return { median: quantile(sorted, 0.5), p99: quantile(sorted, 0.99) }; })() : null;
  return { both, identical, identicalShare: both ? identical / both : null, medianLevel: level,
    medianAbsoluteDifference: quantile(sortedDifferences, 0.5),
    absoluteDifference: { median: quantile(sortedDifferences, 0.5), p99: quantile(sortedDifferences, 0.99), largest: sortedDifferences[both - 1] ?? Number.NaN },
    aboveMedian: { samples: aboveFirst.length, correlation, relativeDifference: relative } };
}

/** A FITS `[x1:x2,y1:y2]` section, as one-based inclusive bounds. */
export interface Section { readonly x1: number; readonly x2: number; readonly y1: number; readonly y2: number }
export function parseSection(value: unknown, label: string): Section {
  if (typeof value !== 'string') throw new TypeError(`${label} is not a FITS section.`);
  const match = /^\[(\d+):(\d+),(\d+):(\d+)\]$/u.exec(value.trim());
  if (!match) throw new TypeError(`${label} (${value}) is not a FITS section.`);
  const [x1, x2, y1, y2] = match.slice(1, 5).map(Number) as [number, number, number, number];
  if (x2 < x1 || y2 < y1) throw new TypeError(`${label} (${value}) is empty.`);
  return { x1, x2, y1, y2 };
}

/** The image extensions of a product, keyed by the detector region each holds.
 *
 * A GMOS product keeps one extension per amplifier and states each one's detector columns and rows in `DETSEC`. Matching on
 * that rather than on extension order is what lets two products written by different pipelines be lined up: the order is a
 * pipeline's choice, the detector region is the instrument's fact. */
export function scienceExtensions(hdus: readonly FitsFileHdu[]) {
  const found = new Map<string, { hdu: FitsFileHdu; detector: Section; data: Section }>();
  for (const hdu of hdus) {
    if (hdu.header.EXTNAME !== 'SCI' || hdu.dimensions.length !== 2) continue;
    const detector = parseSection(hdu.header.DETSEC, 'DETSEC'), data = parseSection(hdu.header.DATASEC, 'DATASEC');
    const key = `${detector.x1}:${detector.x2}`;
    if (found.has(key)) throw new Error(`Two SCI extensions cover detector columns ${key}.`);
    found.set(key, { hdu, detector, data });
  }
  if (!found.size) throw new Error('This product has no two-dimensional SCI extension.');
  return found;
}

/** The binning of an extension, from its own `CCDSUM`: how many detector columns and rows one stored sample covers. */
export function binning(hdu: FitsFileHdu): { x: number; y: number } {
  const value = hdu.header.CCDSUM;
  if (typeof value !== 'string') throw new TypeError('This extension states no CCDSUM.');
  const [x, y] = value.trim().split(/\s+/u).map(Number);
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || !x || !y || x < 1 || y < 1) throw new TypeError(`CCDSUM (${value}) is not a binning.`);
  return { x, y };
}

export interface ExtensionComparison { readonly detector: string; readonly samples: number; readonly statistics: Statistics }

/** The stored sample that holds a given detector coordinate.
 *
 * Two origins go into this, not one. `DETSEC` says which part of the detector an extension covers, and `DATASEC` says where
 * inside the stored array that part begins. They are not the same whenever a product keeps its overscan: a GMOS extension
 * that still carries 32 columns of overscan holds its science pixels from `DATASEC.x1`, not from column 1. Taking only the
 * `DETSEC` difference lines the science pixels of one product up against the overscan of the other, and since both are real
 * numbers the comparison returns a plausible and entirely wrong answer rather than failing. */
export function storedOrigin(detectorLow: number, dataLow: number, low: number, size: number): number {
  const shift = low - detectorLow;
  if (shift % size) throw new Error(`The overlap does not start on a whole sample (${shift} detector units at ${size} per sample).`);
  return shift / size + (dataLow - 1);
}

/** Our master against the archive's, extension by extension, over the detector rows and columns both hold.
 *
 * The overlap is computed in detector coordinates, where both products say what they cover, and then turned into each
 * product's own stored rows through its binning. No resampling and no shifting: if the two do not land on the same detector
 * samples the arithmetic below would be comparing different pixels, so an overlap that is not a whole number of samples in
 * either product is refused. */
export async function compareOnDetector(ourPath: string, archivePath: string): Promise<{ extensions: ExtensionComparison[]; total: Statistics }> {
  const ours = scienceExtensions(await readFitsFileHdus(ourPath)), theirs = scienceExtensions(await readFitsFileHdus(archivePath));
  const extensions: ExtensionComparison[] = [];
  const pairs: { a: { hdu: FitsFileHdu; x0: number; y0: number }; b: { hdu: FitsFileHdu; x0: number; y0: number }; width: number; height: number }[] = [];
  for (const [key, mine] of [...ours].sort(([a], [b]) => a < b ? -1 : 1)) {
    const other = theirs.get(key);
    if (!other) continue;
    const bin = binning(mine.hdu), otherBin = binning(other.hdu);
    if (bin.x !== otherBin.x || bin.y !== otherBin.y)
      throw new Error(`Detector columns ${key} are binned ${bin.x}x${bin.y} in ours and ${otherBin.x}x${otherBin.y} in the archive's; they are not the same samples.`);
    const x1 = Math.max(mine.detector.x1, other.detector.x1), x2 = Math.min(mine.detector.x2, other.detector.x2);
    const y1 = Math.max(mine.detector.y1, other.detector.y1), y2 = Math.min(mine.detector.y2, other.detector.y2);
    if (x2 < x1 || y2 < y1) continue;
    const width = (x2 - x1 + 1) / bin.x, height = (y2 - y1 + 1) / bin.y;
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height))
      throw new Error(`The overlap of detector columns ${key} is not a whole number of samples.`);
    const place = (label: string, region: { detector: Section; data: Section }) => {
      const x0 = storedOrigin(region.detector.x1, region.data.x1, x1, bin.x);
      const y0 = storedOrigin(region.detector.y1, region.data.y1, y1, bin.y);
      // The read must stay inside the science region. A region that ran past it would be reading overscan, which is not what
      // DETSEC described and not what the other product is being compared against.
      if (x0 + width > region.data.x2 || y0 + height > region.data.y2)
        throw new Error(`${label}: the overlap of detector columns ${key} runs past the science region its DATASEC declares.`);
      return { x0, y0 };
    };
    pairs.push({ width, height,
      a: { hdu: mine.hdu, ...place('ours', mine) }, b: { hdu: other.hdu, ...place("the archive's", other) } });
    extensions.push({ detector: key, samples: width * height, statistics: null as unknown as Statistics });
  }
  if (!pairs.length) throw new Error('The two products share no detector region.');
  for (const [index, pair] of pairs.entries()) {
    const a = await readFitsFileRegion(ourPath, pair.a.hdu, { x0: pair.a.x0, y0: pair.a.y0, width: pair.width, height: pair.height });
    const b = await readFitsFileRegion(archivePath, pair.b.hdu, { x0: pair.b.x0, y0: pair.b.y0, width: pair.width, height: pair.height });
    extensions[index] = { ...extensions[index]!, statistics: await statistics(visit => { for (let i = 0; i < a.values.length; i++) visit(a.values[i]!, b.values[i]!); }, a.values.length) };
  }
  const total = await statisticsOverAll(ourPath, archivePath, pairs);
  return { extensions, total };
}

/** Every matched extension's samples as one comparison, so the receipt has a figure for the product and not only per amplifier. */
async function statisticsOverAll(ourPath: string, archivePath: string,
  pairs: readonly { a: { hdu: FitsFileHdu; x0: number; y0: number }; b: { hdu: FitsFileHdu; x0: number; y0: number }; width: number; height: number }[]) {
  const count = pairs.reduce((total, pair) => total + pair.width * pair.height, 0);
  return statistics(async visit => {
    for (const pair of pairs) {
      // Row by row, so the whole mosaic is never held at once.
      for (let y = 0; y < pair.height; y++) {
        const a = await readFitsFileRegion(ourPath, pair.a.hdu, { x0: pair.a.x0, y0: pair.a.y0 + y, width: pair.width, height: 1 });
        const b = await readFitsFileRegion(archivePath, pair.b.hdu, { x0: pair.b.x0, y0: pair.b.y0 + y, width: pair.width, height: 1 });
        for (let x = 0; x < pair.width; x++) visit(a.values[x]!, b.values[x]!);
      }
    }
  }, count);
}

export interface Wcs { readonly crpix1: number; readonly crpix2: number; readonly crval1: number; readonly crval2: number;
  readonly cd11: number; readonly cd12: number; readonly cd21: number; readonly cd22: number }

/** The world coordinates a stacked image carries, as its own header states them. */
export function readWcs(hdu: FitsFileHdu): Wcs {
  const number = (key: string) => { const value = hdu.header[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`This product states no ${key}.`); return value; };
  for (const key of ['CTYPE1', 'CTYPE2']) {
    const value = hdu.header[key];
    if (typeof value !== 'string' || !/-TAN$/u.test(value.trim()))
      throw new Error(`This product's ${key} is ${String(value)}; only the gnomonic (TAN) projection is registered here.`);
  }
  return { crpix1: number('CRPIX1'), crpix2: number('CRPIX2'), crval1: number('CRVAL1'), crval2: number('CRVAL2'),
    cd11: number('CD1_1'), cd12: number('CD1_2'), cd21: number('CD2_1'), cd22: number('CD2_2') };
}

const RADIANS = Math.PI / 180;

/** Where a point on the sky falls in an image, through the gnomonic projection its header declares.
 *
 * This is the standard TAN inverse: the sky point is projected onto the plane tangent at the reference point, giving
 * intermediate world coordinates in degrees, and the inverse of the CD matrix turns those into pixels. Returned one-based,
 * as FITS counts pixels. */
export function skyToPixel(wcs: Wcs, ra: number, dec: number): { x: number; y: number } {
  const ra0 = wcs.crval1 * RADIANS, dec0 = wcs.crval2 * RADIANS, r = ra * RADIANS, d = dec * RADIANS;
  const cosC = Math.sin(dec0) * Math.sin(d) + Math.cos(dec0) * Math.cos(d) * Math.cos(r - ra0);
  if (cosC <= 0) throw new Error('That sky position is not on the same side of the sky as this image.');
  const xi = Math.cos(d) * Math.sin(r - ra0) / cosC / RADIANS;
  const eta = (Math.cos(dec0) * Math.sin(d) - Math.sin(dec0) * Math.cos(d) * Math.cos(r - ra0)) / cosC / RADIANS;
  const determinant = wcs.cd11 * wcs.cd22 - wcs.cd12 * wcs.cd21;
  if (!determinant) throw new Error('This product carries a singular CD matrix.');
  return { x: (wcs.cd22 * xi - wcs.cd12 * eta) / determinant + wcs.crpix1,
    y: (wcs.cd11 * eta - wcs.cd21 * xi) / determinant + wcs.crpix2 };
}

/** The whole-pixel shift that puts the second image's samples on the first's, from the two images' own world coordinates.
 *
 * The first image's reference point is mapped through both, and the difference is the shift. The part that is not a whole
 * pixel is returned too, because a registration that is half a pixel out is a different measurement from one that is exact
 * and the receipt has to be able to say which it was. */
export function wcsShift(first: Wcs, second: Wcs) {
  const there = skyToPixel(second, first.crval1, first.crval2);
  const exactX = there.x - first.crpix1, exactY = there.y - first.crpix2;
  return { dx: Math.round(exactX), dy: Math.round(exactY), exactX, exactY,
    residualX: exactX - Math.round(exactX), residualY: exactY - Math.round(exactY) };
}

export interface HalfComparison {
  readonly shift: { readonly dx: number; readonly dy: number; readonly exactX: number; readonly exactY: number;
    readonly residualX: number; readonly residualY: number };
  /** The same comparison at the eight neighbouring whole-pixel shifts: what the pixels themselves say about where these two
   * images are, against what their world coordinates say. */
  readonly neighbours: readonly { readonly dx: number; readonly dy: number; readonly correlation: number | null }[];
  /** The whole-pixel shift the pixels agree best at, which is reported rather than used. */
  readonly bestByCorrelation: { readonly dx: number; readonly dy: number; readonly correlation: number | null };
  readonly width: number; readonly height: number;
  readonly statistics: Statistics;
}

/** The rectangle of the first image that the second also holds, at one whole-pixel shift.
 *
 * The shift is what `wcsShift` returns: the sample of the second image that holds the same sky as sample `p` of the first is
 * `p + shift`. So the first image is walked over the rows and columns where that sample exists in both. */
export function overlapAt(first: readonly number[], second: readonly number[], dx: number, dy: number) {
  const [w1, h1] = first as [number, number], [w2, h2] = second as [number, number];
  const x0 = Math.max(0, -dx), y0 = Math.max(0, -dy);
  const width = Math.min(w1, w2 - dx) - x0, height = Math.min(h1, h2 - dy) - y0;
  return { x0, y0, width, height };
}

/** Correlation between two stacks at one whole-pixel shift, over the rectangle both hold. Returns null when the shift leaves
 * them no overlap. */
async function correlationAt(firstPath: string, first: FitsFileHdu, secondPath: string, second: FitsFileHdu, dx: number, dy: number) {
  const { x0, y0, width, height } = overlapAt(first.dimensions, second.dimensions, dx, dy);
  if (width < 1 || height < 1) return { correlation: null, width: 0, height: 0, x0, y0 };
  let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
  for (let y = 0; y < height; y++) {
    const a = await readFitsFileRegion(firstPath, first, { x0, y0: y0 + y, width, height: 1 });
    const b = await readFitsFileRegion(secondPath, second, { x0: x0 + dx, y0: y0 + dy + y, width, height: 1 });
    for (let x = 0; x < width; x++) {
      const va = a.values[x]!, vb = b.values[x]!;
      if (!Number.isFinite(va) || !Number.isFinite(vb)) continue;
      n++; sa += va; sb += vb; saa += va * va; sbb += vb * vb; sab += va * vb;
    }
  }
  if (n < 2) return { correlation: null, width, height, x0, y0 };
  const cov = sab / n - (sa / n) * (sb / n), va = saa / n - (sa / n) ** 2, vb = sbb / n - (sb / n) ** 2;
  return { correlation: va > 0 && vb > 0 ? cov / Math.sqrt(va * vb) : null, width, height, x0, y0 };
}

/** Two half-stacks compared, registered by their own world coordinates and checked against the data.
 *
 * The comparison is made at the whole-pixel shift the two products' world coordinates give, and at nothing else: the shift
 * is never chosen to make the two agree. The eight neighbouring shifts are measured as a **check** on that registration, and
 * the one the pixels agree best at is reported beside it.
 *
 * What is refused is a real disagreement: the pixels' best shift being more than a pixel away from where the world
 * coordinates put it, which would mean the products' own astrometry is wrong about them. A neighbour winning by a hair is not
 * that, and is expected whenever the true offset falls near the middle between two pixels, as it does here.
 *
 * The consequence for the numbers is stated rather than hidden. Two images are compared on whole samples, so when the true
 * offset is part of a pixel the comparison is made up to half a pixel out of register and every agreement figure below is a
 * floor, not the best these two products could be made to do. Nothing is resampled to improve it, because resampling would
 * put an interpolation of our own between the two products and the measurement. */
export async function compareHalves(firstPath: string, secondPath: string): Promise<HalfComparison> {
  const first = scienceExtensions(await readFitsFileHdus(firstPath)), second = scienceExtensions(await readFitsFileHdus(secondPath));
  if (first.size !== 1 || second.size !== 1) throw new Error('A stacked image is expected to carry one mosaicked SCI extension.');
  const a = [...first.values()][0]!.hdu, b = [...second.values()][0]!.hdu;
  const shift = wcsShift(readWcs(a), readWcs(b));
  const neighbours: { dx: number; dy: number; correlation: number | null }[] = [];
  for (const dy of [-1, 0, 1]) for (const dx of [-1, 0, 1]) {
    const { correlation } = await correlationAt(firstPath, a, secondPath, b, shift.dx + dx, shift.dy + dy);
    neighbours.push({ dx: shift.dx + dx, dy: shift.dy + dy, correlation });
  }
  const declared = neighbours.find(entry => entry.dx === shift.dx && entry.dy === shift.dy)!;
  const best = neighbours.reduce((top, entry) => (entry.correlation ?? -2) > (top.correlation ?? -2) ? entry : top);
  if (declared.correlation === null) throw new Error('The two stacks share no overlap at their declared registration.');
  if (Math.abs(best.dx - shift.exactX) > 1 || Math.abs(best.dy - shift.exactY) > 1)
    throw new Error(`The two stacks' world coordinates put them ${shift.exactX.toFixed(2)}, ${shift.exactY.toFixed(2)} apart, ` +
      `but the pixels agree best at ${best.dx}, ${best.dy}, more than a pixel away. Their astrometry and their pixels ` +
      'disagree about where these images are; nothing is shifted to reconcile them and the comparison is refused.');
  const { width, height, x0, y0 } = await correlationAt(firstPath, a, secondPath, b, shift.dx, shift.dy);
  const stats = await statistics(async visit => {
    for (let y = 0; y < height; y++) {
      const first = await readFitsFileRegion(firstPath, a, { x0, y0: y0 + y, width, height: 1 });
      const other = await readFitsFileRegion(secondPath, b, { x0: x0 + shift.dx, y0: y0 + shift.dy + y, width, height: 1 });
      for (let x = 0; x < width; x++) visit(first.values[x]!, other.values[x]!);
    }
  }, width * height);
  return { shift, neighbours, bestByCorrelation: best, width, height, statistics: stats };
}

export const RECEIPT_SCHEMA = 'cssearth-gemini-reproduction@1';

/** Where a receipt for one product lives: beside the program it is about, named for that product. */
export const receiptPath = (id: string, product: string) => resolve(PROGRAMS, `${id}.${product.replace(/\.fits$/u, '')}.reproduction.json`);

async function writeReceipt(path: string, body: Record<string, unknown>) {
  await writeFile(path, `${JSON.stringify({ schema: RECEIPT_SCHEMA, ...body }, null, 2)}\n`);
  return path;
}

/** Add what a check established to the record of the run that made the product. A receipt on its own establishes nothing:
 * evidence is resolved through the record, by kind and by the exact product it names. */
async function recordEvidence(directory: string, product: string, kind: EvidenceKind, receipt: string, establishes: string): Promise<ProductRecord> {
  return addProductEvidence(resolve(directory, productRecordPath(product)),
    [{ kind, receipt: resolve(receipt), product, establishes }], output => resolve(directory, output));
}

/** One calibration stage's product against the archive's own.
 *
 * Two things are established before a single sample is read, because the receipt this writes says that two pipelines reduced
 * **the same raw frames**, and nothing about a file sitting in a work directory says that on its own.
 *
 * - **Our master must be the one this program's current plan describes.** A work directory outlives a pin, so a master left
 *   there by another programme, or by an earlier version of this one that named a different calibration set, is exactly the
 *   file that would otherwise be compared against an archive master it shares no input with. The comparison would succeed,
 *   the numbers would look ordinary, and the evidence attached to it would be false. The same expected-run check the
 *   reduction stage uses answers it: the record beside the product must describe the run `stageRun` builds for this program
 *   and this stage, whose inputs are that calibration set's pinned frames.
 * - **The archive master must be the pinned bytes.** It is downloaded here rather than reduced here, so it is checked
 *   against its pin like any other input rather than trusted for having arrived.
 *
 * Either failure refuses by name and nothing is written. */
export async function checkAgainstArchive(program: GeminiProgram, work: string, stage: Stage, sources: readonly string[] = [],
  context?: RunContext) {
  const set = program.calibrations.find(entry => entry.id === stage);
  if (!set) throw new Error(`${program.id} pins no ${stage} set.`);
  const directory = stageDirectory(work, stage), product = await currentProduct(directory, stage);
  if (!product) throw new Error(`${stage} has not been reduced in ${repositoryPath(work)}.`);
  const record = await readProductRecord(resolve(directory, productRecordPath(product)));
  if (!record) throw new Error(`${product} has no product record beside it.`);

  const runContext = context ?? await toolchainContext(program, work);
  const { run: expected } = await stageRun(runContext, stage);
  if (!await sameRun(record, expected, output => resolve(directory, output)))
    throw new Error(`${product} in ${repositoryPath(directory)} was not made by ${program.id}'s current ${stage} plan, or is `
      + `no longer the file its record pins. A receipt would say it and ${set.product.name} were made from the same raw `
      + `frames, which nothing here has established. Re-run \`reduce ${stage}\` for this program.`);

  const archivePath = await geminiFile(set.product, rawDirectory(work), sources);
  await assertInputPins([archiveMasterPin(set.product)], new Map([[set.product.name, archivePath]]));

  const { extensions, total } = await compareOnDetector(resolve(directory, product), archivePath);
  const path = await writeReceipt(receiptPath(program.id, product), {
    programme: program.programme, program: program.id, stage, evidence: 'archive-agreement',
    ours: { product, madeBy: record.software.map(entry => `${entry.name} ${entry.version}`).join(', '), record: repositoryPath(resolve(directory, productRecordPath(product))) },
    archive: { product: set.product.name, uri: set.product.uri, bytes: set.product.bytes, md5: set.product.md5,
      madeBy: "Gemini Observatory's IRAF nightly pipeline (gprepare, gireduce, gemcombine), not DRAGONS" },
    association: set.association,
    sameInputs: `Checked, not assumed: the record beside ${product} describes the run ${program.id}'s ${stage} plan makes, `
      + `whose inputs are the ${set.frames.length} raw frames ${set.product.name} names in its own IMCMB cards, and `
      + `${set.product.name} was checked against its pinned bytes and sha256 before it was read.`,
    registration: "each extension's own DETSEC card, matched by the detector columns it covers, and each product's own DATASEC origin; nothing was shifted or resampled",
    means: 'Two different official Gemini pipelines reduced the same raw frames. A difference is a difference between the two '
      + 'pipelines, not an error in either. This is not a bit-for-bit reproduction and is not claimed as one.',
    extensions, total });
  await recordEvidence(directory, product, 'archive-agreement', path,
    `compared sample by sample with the archive's own ${set.product.name}, made from the same raw frames by Gemini's IRAF pipeline`);
  return { product, path, total, extensions };
}

/** The archive master as an input pin. Its sha256 is added to the program the first time it is downloaded; a master that has
 * never been downloaded carries none and cannot be checked, which is a reason to refuse it rather than to read it anyway. */
export function archiveMasterPin(master: GeminiProgram['calibrations'][number]['product']): ProductInput {
  if (master.sha256 === undefined)
    throw new Error(`${master.name} carries no sha256 yet. Download it once so the pin can be digested before it is compared against.`);
  return { role: 'archive master', identity: master.name, bytes: master.bytes };
}

/** What a stage's expected run needs to know, asked of the installed toolchain. Separated so a test can supply it instead. */
export const toolchainContext = async (program: GeminiProgram, work: string): Promise<RunContext> => {
  const toolchain = await geminiToolchain();
  return { program, work, software: dragonsToolchainVersions(toolchain), toolchainDigest: toolchain.digest };
};

/** The two science halves against each other. */
export async function checkHalves(program: GeminiProgram, work: string) {
  const products = await Promise.all((['a', 'b'] as const).map(async half => {
    const directory = stageDirectory(work, 'science', half), product = await currentProduct(directory, 'science');
    if (!product) throw new Error(`Half ${half} has not been reduced in ${repositoryPath(work)}.`);
    const record = await readProductRecord(resolve(directory, productRecordPath(product)));
    if (!record) throw new Error(`${product} has no product record beside it.`);
    return { half, directory, product, record, path: resolve(directory, product) };
  }));
  const [first, second] = products as [typeof products[0], typeof products[0]];
  const frames = (record: ProductRecord) => record.inputs.filter(entry => entry.role === 'science frame').map(entry => entry.identity);
  const shared = frames(first.record).filter(name => frames(second.record).includes(name));
  if (shared.length) throw new Error(`The two halves share ${shared.join(', ')}; they are not independent.`);
  const comparison = await compareHalves(first.path, second.path);
  const path = await writeReceipt(receiptPath(program.id, `${first.product.replace(/\.fits$/u, '')}.halves.fits`), {
    programme: program.programme, program: program.id, target: program.target, sequenceStart: program.sequenceStart,
    evidence: 'internal-consistency',
    halves: products.map(entry => ({ half: entry.half, product: entry.product, frames: frames(entry.record),
      record: repositoryPath(resolve(entry.directory, productRecordPath(entry.product))) })),
    archiveProduct: 'none. The archive publishes no processed science product for this programme, so there is nothing external to check this stack against.',
    registration: comparison.shift, registrationCheck: comparison.neighbours, bestByCorrelation: comparison.bestByCorrelation,
    registrationMeans: 'The shift is the two products\' own world coordinates, not a fit. It is a whole number of samples, so '
      + `a true offset of ${comparison.shift.exactX.toFixed(2)}, ${comparison.shift.exactY.toFixed(2)} is compared up to half a `
      + 'sample out of register. Every agreement figure here is therefore a floor. Nothing was resampled to improve it.',
    means: 'Two halves of one dither sequence, sharing no exposure, reduced separately through the same masters. This shows '
      + 'the reduction is stable against which exposures went into it. It does not show the pipeline is right, and it cannot: '
      + 'nothing here has a correct answer to check against. It is a repeatability figure, not an accuracy one.',
    overlap: { width: comparison.width, height: comparison.height }, statistics: comparison.statistics });
  for (const entry of products)
    await recordEvidence(entry.directory, entry.product, 'internal-consistency', path,
      `compared with the other half of the same dither sequence, which shares none of its exposures`);
  return { path, comparison };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [id, work, mode, stage] = positionalArguments(process.argv.slice(2));
  if (!id || !work || (mode !== 'archive' && mode !== 'halves'))
    throw new TypeError('Usage: compare <program id> <work directory> <archive <stage>|halves>');
  const program = await readGeminiProgram(id);
  if (mode === 'archive') {
    if (!stage || !(STAGES as readonly string[]).includes(stage)) throw new TypeError(`A stage is one of ${STAGES.join(', ')}.`);
    const { product, path, total } = await checkAgainstArchive(program, resolve(work), stage as Stage);
    console.log(`${product} against the archive's own: ${total.both} samples compared, ` +
      `${((total.identicalShare ?? 0) * 100).toFixed(3)}% bit-identical, median absolute difference ` +
      `${total.medianAbsoluteDifference.toFixed(4)} on a median level of ${total.medianLevel.toFixed(4)}, ` +
      `correlation ${total.aboveMedian.correlation?.toFixed(5) ?? 'none'} above that level. Receipt: ${repositoryPath(path)}`);
  } else {
    const { path, comparison } = await checkHalves(program, resolve(work));
    console.log(`The two halves: ${comparison.statistics.both} samples compared over ${comparison.width} x ${comparison.height}, ` +
      `registered at ${comparison.shift.dx}, ${comparison.shift.dy} from their own world coordinates, correlation ` +
      `${comparison.statistics.aboveMedian.correlation?.toFixed(5) ?? 'none'} above the median level. Receipt: ${repositoryPath(path)}`);
  }
}
