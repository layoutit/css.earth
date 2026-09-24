#!/usr/bin/env node
/** Compare a re-made mosaic with the archive's own, sample by sample, and write the receipt.
 *
 *   node tools/objects/spitzer/compare.mts <program id> [--channels 1,2] [--data <dir>] [--work <dir>]
 *
 * What this establishes, exactly. The archive's level-2 mosaic is a real external answer: the Spitzer Science Center made it
 * from the same level-1 frames with its own pipeline, and it is pinned here by byte count, sha256 and the archive's own MD5.
 * So the evidence is `archive-agreement`. What it is NOT is a reproduction of that pipeline: MOPEX did not run here (see
 * toolchain.json), the re-mosaic is an open reprojection and coaddition, and the two therefore differ wherever the pipelines
 * differ. Every receipt says so in `pipeline` and `limits`, and a reader who needs the observatory's own numbers should not
 * take these.
 *
 * Both products are read with this repository's own FITS reader, row block by row block, so neither is loaded whole and the
 * comparison does not depend on the Python that made one of them.
 *
 * Reported over the pixels both products cover: how many, the share bit-identical, the median ratio and the median absolute
 * difference over the median level, the share inside the archive's own stated uncertainty, that difference in units of that
 * uncertainty at its median, 95th and 99th percentile, the share within one and five per cent, and the correlation. The
 * archive's uncertainty plane is what makes the middle of that list meaningful: it is the archive saying how well it claims to
 * know each pixel, so a difference measured against it is a difference measured on the archive's own terms.
 *
 * The receipt is tools/objects/spitzer/programs/<program id>.<product>.reproduction.json, with its own
 * `cssearth-telescope-product@1` record beside it. The evidence itself is added to the MOSAIC's record, the one the producing
 * stage wrote, so that a consumer holding the product finds the check through `evidenceFor(record, mosaic,
 * 'archive-agreement')` without knowing this toolkit exists. Its `establishes` says in as many words that the re-mosaic is
 * not the observatory's own. The ledger counts a capability as checked only from a receipt that parses, names its
 * observation, and names the archive bytes its program pinned. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFitsFileHdus, readFitsFileRegion, type FitsFileHdu } from '../../fits/fits.mts';
import { flagValue, positionalArguments } from '../../cli/cli-arguments.mts';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { addProductEvidence, assertInputPins, fileSize, readProductRecord, writeProductRecord, type ProductInput, type ProductRun } from '../product-record.mts';
import { defaultDataRoot, PROGRAMS, readSpitzerProgram, type SpitzerChannel, type SpitzerProgram } from './archive.mts';
import { defaultWorkRoot, mosaicMembers, mosaicName, STAGE, TELESCOPE } from './mosaic.mts';

const SCHEMA = 'cssearth-spitzer-reproduction@1';
export const COMPARE_STAGE = 'archive-comparison';
/** No product larger than this is compared. A four-channel IRAC mapping mosaic is a few million samples; this is the ceiling
 * at which the comparison still holds its samples in memory honestly. */
export const MAX_SAMPLES = 64 * 1024 * 1024;
const ROWS_PER_READ = 64;

export interface ComparisonStatistics {
  readonly comparedPixels: number;
  readonly archiveCoveredPixels: number;
  readonly bitIdenticalShare: number;
  readonly medianRatio: number;
  readonly medianLevel: number;
  readonly medianAbsoluteDifferenceOverLevel: number;
  /** The difference in units of the archive's own stated uncertainty for the same pixel. */
  readonly differenceInArchiveSigma: { readonly median: number; readonly p95: number; readonly p99: number; readonly max: number };
  readonly shareWithinArchiveSigma: number;
  readonly shareWithinOnePercent: number;
  readonly shareWithinFivePercent: number;
  readonly correlation: number;
}

const quantile = (sorted: Float64Array, q: number) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))]! : Number.NaN;

const imageHdu = (hdus: readonly FitsFileHdu[], path: string): FitsFileHdu => {
  const hdu = hdus.find(entry => entry.dimensions.length === 2 && entry.dimensions.every(size => size > 0));
  if (!hdu) throw new Error(`${path} holds no two-axis image.`);
  return hdu;
};

/** One file this comparison reads, with the pin it must satisfy. The pin is what the program recorded when the archive's
 * bytes were fetched, or what the producing run recorded for our own product. */
export interface ComparedFile { readonly path: string; readonly pin: ProductInput }
export interface MosaicComparison {
  readonly statistics: ComparisonStatistics;
  /** The identity of every file this comparison actually read, taken from the bytes on disk and not copied from any pin. A
   * receipt records these, so what it claims to have compared is what it did compare. */
  readonly compared: readonly ProductInput[];
}

/** Compare two mosaics and the archive's uncertainty and coverage planes beside them.
 *
 * Before a single sample is read, all four files are checked against their pins. That check belongs here rather than in the
 * caller: the archive's uncertainty plane is the denominator of the headline result, so a comparison that read some other
 * file would report agreement with something nobody pinned. A file that is not its pinned bytes refuses the comparison.
 *
 * Every file must then be on one grid: a different shape is refused rather than reconciled, because a mosaic on another grid
 * is another measurement. */
export async function compareMosaics(ours: ComparedFile, archive: ComparedFile, uncertainty: ComparedFile, coverage: ComparedFile): Promise<MosaicComparison> {
  const entries = [ours, archive, uncertainty, coverage];
  if (new Set(entries.map(entry => entry.pin.identity)).size !== entries.length)
    throw new Error('The four compared files must be four different pinned files.');
  await assertInputPins(entries.map(entry => entry.pin), new Map(entries.map(entry => [entry.pin.identity, entry.path])));
  const compared: ProductInput[] = [];
  for (const entry of entries) compared.push({ role: entry.pin.role, identity: entry.pin.identity, ...await fileSize(entry.path) });

  const files = entries.map(entry => entry.path);
  const hdus = await Promise.all(files.map(async path => imageHdu(await readFitsFileHdus(path), path)));
  const [width, height] = hdus[0]!.dimensions as [number, number];
  for (const [index, hdu] of hdus.entries())
    if (hdu.dimensions[0] !== width || hdu.dimensions[1] !== height)
      throw new Error(`${files[index]} is ${hdu.dimensions.join(' x ')}; ${ours.path} is ${width} x ${height}. These are not the same grid.`);
  if (width * height > MAX_SAMPLES) throw new Error(`${width} x ${height} is more samples than this comparison reads.`);

  const diffOverSigma: number[] = [], ratios: number[] = [], relative: number[] = [];
  let comparedPixels = 0, archiveCovered = 0, identical = 0, sumA = 0, sumB = 0, sumAA = 0, sumBB = 0, sumAB = 0;
  const levels: number[] = [], absoluteDifferences: number[] = [];
  for (let y0 = 0; y0 < height; y0 += ROWS_PER_READ) {
    const rows = Math.min(ROWS_PER_READ, height - y0), region = { x0: 0, y0, width, height: rows };
    const [b, a, u, c] = await Promise.all(files.map((path, index) => readFitsFileRegion(path, hdus[index]!, region)));
    for (let i = 0; i < b!.values.length; i++) {
      const mine = b!.values[i]!, theirs = a!.values[i]!, sigma = u!.values[i]!, cover = c!.values[i]!;
      if (Number.isFinite(theirs) && cover > 0) archiveCovered++;
      if (!Number.isFinite(mine) || !Number.isFinite(theirs) || !(cover > 0)) continue;
      comparedPixels++;
      if (mine === theirs) identical++;
      const difference = mine - theirs;
      levels.push(Math.abs(theirs));
      absoluteDifferences.push(Math.abs(difference));
      if (theirs !== 0) { ratios.push(mine / theirs); relative.push(Math.abs(difference) / Math.abs(theirs)); }
      if (Number.isFinite(sigma) && sigma > 0) diffOverSigma.push(Math.abs(difference) / sigma);
      sumA += theirs; sumB += mine; sumAA += theirs * theirs; sumBB += mine * mine; sumAB += theirs * mine;
    }
  }
  if (!comparedPixels) throw new Error('The two mosaics share no covered pixel; there is nothing to compare.');
  const sorted = (values: readonly number[]) => Float64Array.from(values).sort();
  const level = quantile(sorted(levels), 0.5), sigmas = sorted(diffOverSigma), rel = sorted(relative);
  const n = comparedPixels, covariance = sumAB / n - (sumA / n) * (sumB / n);
  const spread = Math.sqrt(Math.max(0, sumAA / n - (sumA / n) ** 2)) * Math.sqrt(Math.max(0, sumBB / n - (sumB / n) ** 2));
  const share = (values: Float64Array, limit: number) => { let count = 0; for (const value of values) if (value <= limit) count++; return count / (values.length || 1); };
  return { compared, statistics: {
    comparedPixels: comparedPixels, archiveCoveredPixels: archiveCovered, bitIdenticalShare: identical / n,
    medianRatio: quantile(sorted(ratios), 0.5), medianLevel: level,
    medianAbsoluteDifferenceOverLevel: quantile(sorted(absoluteDifferences), 0.5) / (level || Number.NaN),
    differenceInArchiveSigma: { median: quantile(sigmas, 0.5), p95: quantile(sigmas, 0.95), p99: quantile(sigmas, 0.99), max: sigmas.length ? sigmas[sigmas.length - 1]! : Number.NaN },
    shareWithinArchiveSigma: share(sigmas, 1), shareWithinOnePercent: share(rel, 0.01), shareWithinFivePercent: share(rel, 0.05),
    correlation: spread > 0 ? covariance / spread : Number.NaN,
  } };
}

export interface SpitzerReproduction {
  readonly schema: typeof SCHEMA;
  readonly program: string;
  readonly aorKey: number;
  readonly target: string;
  readonly channel: number;
  readonly wavelength: string;
  /** What made the product we compare against, and what made ours. The first is the observatory's; the second is not. */
  readonly archiveProduct: { readonly name: string; readonly bytes: number; readonly pipeline: string };
  readonly ourProduct: { readonly name: string; readonly bytes: number; readonly stage: string; readonly software: readonly { readonly name: string; readonly version: string }[]; readonly toolchainDigest: string };
  /** The two archive planes the headline numbers are measured against, as they were on disk when they were read. The share
   * inside "the archive's own uncertainty" means nothing without saying which uncertainty file that was. */
  readonly archiveUncertainty: { readonly name: string; readonly bytes: number };
  readonly archiveCoverage: { readonly name: string; readonly bytes: number };
  readonly framesCombined: readonly string[];
  readonly frameTimeSeconds: number;
  readonly statistics: ComparisonStatistics;
  readonly limits: readonly string[];
}

export const LIMITS: readonly string[] = [
  "The observatory's own mosaicker, MOPEX, did not run on this machine: its macOS build is x86_64 and Gatekeeper refused the unsigned quarantined distribution. So this is agreement with the archive's product, not a reproduction of the archive's pipeline.",
  'The output grid is the archive mosaic\'s own. This run resamples onto it and does not choose a geometry, so the comparison tests resampling and combination, not astrometry. The grid the frames imply on their own is reported by the run beside the archive\'s.',
  'No multi-frame outlier rejection is applied. The archive\'s pipeline rejects radiation hits across overlapping frames and this does not, so a small share of pixels differ by much more than the rest. A sigma clip across the stack was measured and made agreement worse at this depth, so none is used.',
  "Frames are put on one background level by a zero-mean additive offset solved on their overlaps, which is not the observatory's overlap correction and carries no sky model. On the proving observation it moved channel 3 from 71% to 98% of pixels inside the archive's stated uncertainty and shifted that channel's overall level by 0.7%; channels 1 and 4 did not move.",
  'The IRAC handbook\'s fatal mask 32520 rejects imask bits 3 and 8–14. Corrected-artifact flags 4–7 alone remain measurements. The documented stray-light mask can leave gaps where a small dither gives no clean frame.',
];

export function parseReproduction(value: unknown): SpitzerReproduction {
  const row = requireRecord(value, 'Spitzer reproduction');
  if (row.schema !== SCHEMA) throw new TypeError(`Unsupported Spitzer reproduction schema ${String(row.schema)}.`);
  const product = (raw: unknown, label: string) => {
    const entry = requireRecord(raw, label);
    return { name: requireString(entry.name, `${label} name`), bytes: requireFiniteNumber(entry.bytes, `${label} bytes`) };
  };
  const archiveProduct = { ...product(row.archiveProduct, 'archive product'), pipeline: requireString(requireRecord(row.archiveProduct, 'archive product').pipeline, 'archive pipeline') };
  const ourRecord = requireRecord(row.ourProduct, 'our product');
  const ourProduct = { ...product(row.ourProduct, 'our product'), stage: requireString(ourRecord.stage, 'stage'), toolchainDigest: requireString(ourRecord.toolchainDigest, 'toolchain digest'),
    software: requireArray(ourRecord.software, 'software').map(raw => { const entry = requireRecord(raw, 'software'); return { name: requireString(entry.name, 'name'), version: requireString(entry.version, 'version') }; }) };
  const archiveUncertainty = product(row.archiveUncertainty, 'archive uncertainty'), archiveCoverage = product(row.archiveCoverage, 'archive coverage');
  const statisticsRecord = requireRecord(row.statistics, 'statistics');
  const sigma = requireRecord(statisticsRecord.differenceInArchiveSigma, 'sigma quantiles');
  const statistics: ComparisonStatistics = {
    comparedPixels: requireFiniteNumber(statisticsRecord.comparedPixels, 'compared pixels'),
    archiveCoveredPixels: requireFiniteNumber(statisticsRecord.archiveCoveredPixels, 'archive covered pixels'),
    bitIdenticalShare: requireFiniteNumber(statisticsRecord.bitIdenticalShare, 'bit-identical share'),
    medianRatio: requireFiniteNumber(statisticsRecord.medianRatio, 'median ratio'),
    medianLevel: requireFiniteNumber(statisticsRecord.medianLevel, 'median level'),
    medianAbsoluteDifferenceOverLevel: requireFiniteNumber(statisticsRecord.medianAbsoluteDifferenceOverLevel, 'median difference over level'),
    differenceInArchiveSigma: { median: requireFiniteNumber(sigma.median, 'sigma median'), p95: requireFiniteNumber(sigma.p95, 'sigma p95'), p99: requireFiniteNumber(sigma.p99, 'sigma p99'), max: requireFiniteNumber(sigma.max, 'sigma max') },
    shareWithinArchiveSigma: requireFiniteNumber(statisticsRecord.shareWithinArchiveSigma, 'share within sigma'),
    shareWithinOnePercent: requireFiniteNumber(statisticsRecord.shareWithinOnePercent, 'share within 1%'),
    shareWithinFivePercent: requireFiniteNumber(statisticsRecord.shareWithinFivePercent, 'share within 5%'),
    correlation: requireFiniteNumber(statisticsRecord.correlation, 'correlation'),
  };
  return { schema: SCHEMA, program: requireString(row.program, 'program'), aorKey: requireFiniteNumber(row.aorKey, 'AORKEY'),
    target: requireString(row.target, 'target'), channel: requireFiniteNumber(row.channel, 'channel'), wavelength: requireString(row.wavelength, 'wavelength'),
    archiveProduct, ourProduct, archiveUncertainty, archiveCoverage, framesCombined: requireArray(row.framesCombined, 'frames').map(entry => requireString(entry, 'frame')),
    frameTimeSeconds: requireFiniteNumber(row.frameTimeSeconds, 'frame time'), statistics,
    limits: requireArray(row.limits, 'limits').map(entry => requireString(entry, 'limit')) };
}

export const receiptName = (program: string, channel: number) => `${program}.ch${channel}.remosaic.reproduction.json`;
export const receiptPath = (program: string, channel: number) => resolve(PROGRAMS, receiptName(program, channel));
export const readReproduction = async (program: string, channel: number): Promise<SpitzerReproduction | null> =>
  readFile(receiptPath(program, channel), 'utf8').then(text => parseReproduction(JSON.parse(text) as unknown), () => null);

export async function compareChannel(program: SpitzerProgram, channel: SpitzerChannel, dataRoot: string, workRoot: string): Promise<SpitzerReproduction> {
  const directory = resolve(dataRoot, program.id, `ch${channel.channel}`), work = resolve(workRoot, program.id);
  const named = (role: SpitzerChannel['products'][number]['role']) => {
    const found = channel.products.find(product => product.role === role);
    if (!found) throw new Error(`Channel ${channel.channel} pins no ${role}.`);
    return found;
  };
  const archive = named('mosaic'), uncertainty = named('mosaic-uncertainty'), coverage = named('mosaic-coverage');
  const output = mosaicName(program, channel.channel), ourPath = resolve(work, output);
  const record = await readProductRecord(resolve(work, `${output}.product.json`));
  if (!record) throw new Error(`${output} has no product record; run mosaic.mts first.`);
  if (record.stage !== STAGE || record.telescope !== TELESCOPE) throw new Error(`${output} was made by ${record.telescope}/${record.stage}, not ${TELESCOPE}/${STAGE}.`);
  const ourFile = record.outputs.find(entry => entry.path === output);
  if (!ourFile) throw new Error(`The record beside ${output} does not name it.`);

  // Our own product is pinned by the record that made it; the archive's three files are pinned by the program that fetched
  // them. compareMosaics refuses every one of them that is not its pinned bytes before it reads a sample, and gives back the
  // identity of what it did read. Nothing below copies a digest out of the program or the record.
  const comparison = await compareMosaics(
    { path: ourPath, pin: { role: 'our-mosaic', identity: output, bytes: ourFile.bytes } },
    { path: resolve(directory, archive.name), pin: { role: 'archive-mosaic', identity: archive.name, bytes: archive.bytes } },
    { path: resolve(directory, uncertainty.name), pin: { role: 'archive-uncertainty', identity: uncertainty.name, bytes: uncertainty.bytes } },
    { path: resolve(directory, coverage.name), pin: { role: 'archive-coverage', identity: coverage.name, bytes: coverage.bytes } });
  const inputs = comparison.compared;
  const read = (role: string) => {
    const found = inputs.find(entry => entry.role === role);
    if (!found) throw new Error(`The comparison did not report reading a ${role}.`);
    return found;
  };
  const readArchive = read('archive-mosaic'), readOurs = read('our-mosaic');
  const reproduction = parseReproduction({
    schema: SCHEMA, program: program.id, aorKey: program.aorKey, target: program.target, channel: channel.channel, wavelength: channel.wavelength,
    archiveProduct: { name: readArchive.identity, bytes: readArchive.bytes, pipeline: channel.mosaic.creator },
    ourProduct: { name: readOurs.identity, bytes: readOurs.bytes, stage: record.stage, software: record.software, toolchainDigest: record.toolchainDigest ?? '' },
    archiveUncertainty: { name: read('archive-uncertainty').identity, bytes: read('archive-uncertainty').bytes },
    archiveCoverage: { name: read('archive-coverage').identity, bytes: read('archive-coverage').bytes },
    framesCombined: mosaicMembers(channel).map(frame => frame.dce), frameTimeSeconds: channel.mosaicFrameTimeSeconds,
    statistics: comparison.statistics, limits: LIMITS,
  });
  await writeFile(receiptPath(program.id, channel.channel), `${JSON.stringify(reproduction, null, 2)}\n`);

  const run: ProductRun = { telescope: TELESCOPE, stage: COMPARE_STAGE, inputs,
    parameters: { comparedOver: 'pixels the archive covers and both products hold', maxSamples: MAX_SAMPLES },
    software: [{ name: 'cssearth-fits', version: 'repository' }], toolchainDigest: record.toolchainDigest ?? undefined };
  await writeProductRecord(`${receiptPath(program.id, channel.channel)}.product.json`, run,
    [{ path: receiptName(program.id, channel.channel), file: receiptPath(program.id, channel.channel), units: 'dimensionless shares and ratios' }]);

  // The evidence belongs on the mosaic's own record, not only on the receipt's. A consumer holding the product asks
  // `evidenceFor(record, mosaic, 'archive-agreement')` through the shared API and must find this check there; evidence filed
  // only against the receipt is evidence nobody looking at the product can discover. addProductEvidence rewrites that one
  // list and refuses if the mosaic on disk is no longer the file its record made, so evidence can never drift onto other bytes.
  await addProductEvidence(resolve(work, `${output}.product.json`), [archiveAgreement(program, channel, archive.name, output)], path => resolve(work, path), () => receiptPath(program.id, channel.channel));
  return reproduction;
}

/** What a successful comparison establishes about one re-made mosaic, in the words a consumer will read. It says plainly that
 * the observatory's own mosaicker did not run, because `archive-agreement` on its own would let a reader assume it did. */
export const archiveAgreement = (program: SpitzerProgram, channel: SpitzerChannel, archiveMosaic: string, product: string) => ({
  kind: 'archive-agreement' as const, receipt: receiptName(program.id, channel.channel), product,
  establishes: `How far this NON-official re-mosaic of AOR ${program.aorKey} channel ${channel.channel} agrees with the Spitzer Science Center's own level-2 mosaic ${archiveMosaic} (pipeline ${channel.mosaic.creator}), measured pixel by pixel against the archive's own uncertainty plane over the pixels it covers. The observatory's mosaicker MOPEX did not run here, so this does NOT establish that its pipeline was reproduced; ${receiptName(program.id, channel.channel)} carries the numbers and the limits.`,
});

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), [id] = positionalArguments(args, ['--channels', '--data', '--work']);
  if (!id) throw new TypeError('Usage: compare <program id> [--channels 1,2] [--data <dir>] [--work <dir>]');
  const program = await readSpitzerProgram(id);
  const wanted = flagValue(args, '--channels')?.split(',').map(entry => Number(entry.trim()));
  for (const channel of program.channels.filter(entry => !wanted || wanted.includes(entry.channel))) {
    const { statistics: s } = await compareChannel(program, channel, flagValue(args, '--data') ?? defaultDataRoot, flagValue(args, '--work') ?? defaultWorkRoot);
    console.log(`ch${channel.channel} ${channel.wavelength}: ${s.comparedPixels} pixels compared of ${s.archiveCoveredPixels} the archive covers.\n` +
      `  median ratio ${s.medianRatio.toFixed(6)}, median |difference| ${(s.medianAbsoluteDifferenceOverLevel * 100).toFixed(3)}% of the median level ${s.medianLevel.toPrecision(4)}\n` +
      `  inside the archive's own uncertainty: ${(s.shareWithinArchiveSigma * 100).toFixed(2)}%; |difference| in sigma: median ${s.differenceInArchiveSigma.median.toFixed(3)}, p95 ${s.differenceInArchiveSigma.p95.toFixed(3)}, p99 ${s.differenceInArchiveSigma.p99.toFixed(3)}\n` +
      `  within 1%: ${(s.shareWithinOnePercent * 100).toFixed(2)}%; within 5%: ${(s.shareWithinFivePercent * 100).toFixed(2)}%; correlation ${s.correlation.toFixed(6)}`);
  }
}
