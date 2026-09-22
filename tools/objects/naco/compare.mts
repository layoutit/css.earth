#!/usr/bin/env node
/** Compare two independently commanded NACO jitter sequences of one night, sample by sample: the only oracle this route has.
 *
 *   node tools/objects/naco/compare.mts <program id> <work directory> <tpl_start> <tpl_start>
 *
 * The Hubble and JWST routes compare a re-run against the archive's own product. NACO has none. On 19 September 2026
 * `ivoa.ObsCore` held nine NAOS+CONICA Phase 3 products, all of them GW170817, and the archive's calselector returned no
 * `M.NACO.*` master calibration for a science frame. So there is nothing external to check a NACO re-run against, and this
 * comparison is internal and says so: two object templates of the same night, the same target and the same instrument setup
 * are reduced separately through the same three recipes and the same master dark and flat, and their combined images are
 * compared. They are not a split of one sequence: the telescope was commanded twice, and the two runs share no exposure.
 *
 * What that proves and what it does not: two sequences agreeing shows the reduction is stable against which exposures went
 * into it, across the minutes and the seeing between them. It does not show the pipeline is right, and it cannot, because
 * nothing here has a correct answer to check against. Read it as a repeatability figure, not as an accuracy one.
 *
 * The two are not the same size. `naco_img_jitter` sizes its mosaic from the dither offsets the sequence actually used, so
 * the Ceres night's two sequences combined to 1553 x 1550 and 1515 x 1550 on a 1024 x 1024 detector, and the product carries
 * no WCS to register them by. What it does carry is a shared origin: the brightest pixel of each mosaic — Ceres — is at the
 * same place in both. So the comparison is made over the rectangle both hold, anchored at the origin, and that registration
 * is checked rather than assumed: if the brightest pixel is not at the same pixel in both, the comparison is refused and the
 * two positions are reported.
 *
 * Reported for the pair: how many samples both hold, the share bit-identical, the median absolute difference over the median
 * level, and, over the samples above that median level, the correlation and the relative difference at its median, 99th
 * percentile and largest. Beside them: the pipeline version each run recorded, and the frames each sequence combined.
 *
 * The receipt is written to tools/objects/naco/programs/<program id>.<product>.reproduction.json, and what it establishes is
 * added to the product record each reduction wrote beside its own product, as `internal-consistency` evidence. That is the
 * only kind this route can add: with no archive product and no ESO master calibration to agree with, nothing here is
 * archive agreement. A product whose run wrote no record takes no evidence at all, and the comparison says so. */
import { readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sha256File } from '../../../src/platform/sha256.mts';
import { readFitsFileHdus, readFitsFileRegion, type FitsFileHdu } from '../../fits/fits.mts';
import { addProductEvidence, productRecordPath } from '../product-record.mts';
import { PROGRAMS, readProgram } from './archive.mts';

/** The two halves a nodded-spectroscopy set is split into: one template per night, so halves are what there is. */
export const NOD_HALVES = ['a-half', 'b-half'] as const;

/** A path inside the repository, as the repository sees it: a receipt is committed, so it never carries a local absolute
 * path. A path outside the repository is recorded as it is, because nothing here can shorten it honestly. */
const REPOSITORY = resolve(import.meta.dirname, '../../..');
export const repositoryPath = (path: string) => path.startsWith(`${REPOSITORY}/`) ? path.slice(REPOSITORY.length + 1) : path;
import { readReduction, type ReductionResult } from './reduce.mts';

/** No image larger than this is compared; a NACO detector is 1024 x 1024 and a combined jitter image is not much larger. */
export const MAX_SAMPLES = 16 * 1024 * 1024;
/** The cards a product states about the run that made it; a pair that differs differs first in one of them. */
export const RUN_CARDS = ['ESO PRO REC1 PIPE ID', 'ESO PRO REC1 DRS ID', 'ESO PRO REC1 ID', 'ESO PRO CATG', 'HIERARCH', 'DATE'] as const;

const quantile = (sorted: Float64Array, q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)))] ?? Number.NaN;

export interface Statistics {
  readonly samples: number; readonly both: number; readonly identical: number;
  readonly onlyFirst: number; readonly onlySecond: number; readonly identicalShare: number | null;
  readonly medianLevel: number; readonly medianAbsoluteDifferenceOverMedian: number | null;
  readonly aboveMedian: { readonly samples: number; readonly correlation: number | null;
    readonly relativeDifference: { readonly median: number; readonly p99: number; readonly largest: number } | null };
}

/** Two equal-length sample runs compared: counts, bit-identity, and how far the rest are apart. Walked twice, so a caller
 * that streams reads its samples twice and holds only what it is reading. */
export async function statistics(walk: (visit: (first: number, second: number) => void) => Promise<void> | void, count: number): Promise<Statistics> {
  const levels = new Float64Array(count), differences = new Float64Array(count);
  let both = 0, identical = 0, onlyFirst = 0, onlySecond = 0;
  await walk((first, second) => {
    const a = Number.isFinite(first), b = Number.isFinite(second);
    if (a && b) { if (first === second) identical++; levels[both] = Math.abs(second); differences[both] = Math.abs(first - second); both++; }
    else if (a) onlyFirst++; else if (b) onlySecond++;
  });
  const median = quantile(levels.subarray(0, both).slice().sort(), 0.5);
  const medianDifference = quantile(differences.subarray(0, both).slice().sort(), 0.5);
  let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0, n = 0;
  const relative = differences;
  await walk((first, second) => {
    if (!Number.isFinite(first) || !Number.isFinite(second) || Math.abs(second) <= median) return;
    sa += first; sb += second; saa += first * first; sbb += second * second; sab += first * second;
    relative[n++] = Math.abs(first - second) / Math.abs(second);
  });
  const sorted = relative.subarray(0, n).slice().sort();
  return { samples: count, both, identical, onlyFirst, onlySecond, identicalShare: both ? identical / both : null,
    medianLevel: median, medianAbsoluteDifferenceOverMedian: median ? medianDifference / median : null,
    aboveMedian: { samples: n, correlation: n > 1 ? (n * sab - sa * sb) / Math.sqrt((n * saa - sa * sa) * (n * sbb - sb * sb)) : null,
      relativeDifference: n ? { median: quantile(sorted, 0.5), p99: quantile(sorted, 0.99), largest: quantile(sorted, 1) } : null } };
}

const planeHdu = (hdu: FitsFileHdu, plane: number): FitsFileHdu => {
  const [width, height] = hdu.dimensions as [number, number];
  return { ...hdu, dimensions: [width, height], dataStart: hdu.dataStart + plane * width * height * (Math.abs(hdu.bitpix) / 8) };
};

/** The rectangle two images both hold, anchored at the origin. */
export const overlapOf = (first: readonly number[], second: readonly number[]) =>
  ({ width: Math.min(first[0]!, second[0]!), height: Math.min(first[1]!, second[1]!) });

/** The brightest finite sample of an image over a rectangle at the origin, and where it is. */
export async function brightest(path: string, hdu: FitsFileHdu, area: { width: number; height: number }) {
  const { values } = await readFitsFileRegion(path, hdu, { x0: 0, y0: 0, ...area });
  let index = -1, level = -Infinity;
  for (let sample = 0; sample < values.length; sample++) {
    const value = values[sample]!;
    if (Number.isFinite(value) && value > level) { level = value; index = sample; }
  }
  if (index < 0) throw new Error(`${path} has no finite sample in ${area.width}x${area.height}.`);
  return { x: index % area.width, y: Math.floor(index / area.width), level };
}

/** Two images over the rectangle both hold, sample for sample. */
export async function compareImage(first: { path: string; hdu: FitsFileHdu }, second: { path: string; hdu: FitsFileHdu },
  area: { width: number; height: number }) {
  const { width, height } = area, planes = Math.min(first.hdu.dimensions[2] ?? 1, second.hdu.dimensions[2] ?? 1);
  const perPlane = width * height, count = perPlane * planes;
  if (count > MAX_SAMPLES) throw new Error(`${count} samples, more than this comparison reads.`);
  return statistics(async visit => {
    for (let plane = 0; plane < planes; plane++) {
      const a = await readFitsFileRegion(first.path, planes > 1 ? planeHdu(first.hdu, plane) : first.hdu, { x0: 0, y0: 0, width, height });
      const b = await readFitsFileRegion(second.path, planes > 1 ? planeHdu(second.hdu, plane) : second.hdu, { x0: 0, y0: 0, width, height });
      for (let index = 0; index < perPlane; index++) visit(a.values[index]!, b.values[index]!);
    }
  }, count);
}

export interface Reproduction {
  readonly schema: 'cssearth-naco-reproduction@1';
  readonly program: string;
  readonly product: string;
  readonly kind: 'two-templates' | 'two-nod-halves';
  readonly note: string;
  readonly sequences: readonly { readonly template: string; readonly path: string; readonly sha256: string; readonly bytes: number;
    readonly objectFrames: number; readonly skyFrames: number; readonly pipeline: string | null }[];
  readonly shapes: readonly (readonly number[])[];
  /** The rectangle at the origin that both products hold; the whole of both when they are the same shape. */
  readonly overlap: { readonly width: number; readonly height: number };
  /** How the two were put on one grid: null when they are the same shape and none was needed. */
  readonly registration: { readonly x: number; readonly y: number; readonly levels: readonly number[] } | null;
  readonly statistics: Statistics;
  readonly differingCards: readonly string[];
}

const NOTE = 'Internal check. The ESO archive publishes no Phase 3 product and no master calibration for NACO, so this is not'
  + ' a comparison against an archive or published product: it is two object templates of one night, each commanded'
  + ' separately by the telescope and reduced on its own through the same recipes and the same master dark and flat. The two'
  + ' share no exposure. It measures repeatability, not accuracy.';

const NOD_NOTE = 'Internal check. The ESO archive publishes no Phase 3 product and no master calibration for NACO, and ESO\'s'
  + ' own telescope bibliography records no publication for this NACO run, so there is nothing external to check it against.'
  + ' A nodded-spectroscopy night is one template, so the two sides compared here are two disjoint halves of its nod pairs,'
  + ' balanced across both nod positions and sharing no exposure, each reduced on its own through the same recipes and the'
  + ' same master flat. It measures repeatability, not accuracy.';

/** What a comparison established, in the one sentence the product record carries: the measurement, and what the measurement
 * is worth. There is no ESO Phase 3 product and no master calibration for NACO to agree with, so two of our own reductions
 * agreeing is internal consistency and never archive agreement, and the sentence says so where a reader will meet it. */
export function internalConsistencyEstablishes(value: Pick<Reproduction, 'kind' | 'statistics'>) {
  const stats = value.statistics;
  const sides = value.kind === 'two-templates' ? 'Two object templates of one night, each commanded separately by the telescope'
    : 'Two disjoint halves of one night\'s nod pairs';
  return `${sides} and sharing no exposure, each reduced on its own through the same recipes, agree over ${stats.both} samples:`
    + ` ${((stats.identicalShare ?? 0) * 100).toFixed(1)}% of them bit-identical, correlation`
    + ` ${stats.aboveMedian.correlation?.toFixed(6) ?? 'n/a'} over the ${stats.aboveMedian.samples} samples above the median level.`
    + ' The ESO archive publishes no Phase 3 product and no master calibration for NACO, so there is no archive product for'
    + ' this re-run to agree with: this measures repeatability, not accuracy, and it is not archive agreement.';
}

/** Add what this comparison established to the record the run that made each product wrote beside it. A product whose run
 * wrote no record takes no evidence: the stage that makes a product writes its record, and evidence is added to that. */
export async function addComparisonEvidence(value: Pick<Reproduction, 'kind' | 'statistics'>, products: readonly string[], receipt: string) {
  const establishes = internalConsistencyEstablishes(value);
  for (const product of products) {
    await addProductEvidence(productRecordPath(product),
      [{ kind: 'internal-consistency', receipt: resolve(receipt), product: basename(product), establishes }], output => resolve(dirname(product), output));
  }
}

/** Compare two templates' combined images and write the receipt. */
export async function compareTemplates(programId: string, work: string, templates: readonly [string, string]): Promise<Reproduction> {
  const program = await readProgram(programId);
  // For imaging the two labels are object templates of the night; for spectroscopy they are the two halves of its nod set,
  // which is one template. Either way they must be two, and each must have been reduced.
  const known = program.mode === 'imaging' ? program.objectTemplates : NOD_HALVES;
  for (const template of templates) {
    if (!known.includes(template)) throw new Error(`${template} is not a ${program.mode} sequence of ${programId}: ${known.join(' ')}`);
  }
  if (templates[0] === templates[1]) throw new Error('Two comparisons of one sequence prove nothing; name two.');
  const load = async (template: string): Promise<ReductionResult> => {
    const prefix = program.mode === 'imaging' ? 'reduced' : 'reduced';
    const name = `${prefix}-${template.replaceAll(':', '')}.json`;
    const result = readReduction(JSON.parse(await readFile(resolve(work, name), 'utf8')) as unknown, name);
    if (result.program !== programId) throw new Error(`${name} is a reduction of ${result.program}, not ${programId}.`);
    if (result.mode !== program.mode) throw new Error(`${name} is a ${result.mode} reduction of a ${program.mode} program.`);
    return result;
  };
  const reductions = { first: await load(templates[0]), second: await load(templates[1]) };
  const read = async (result: ReductionResult) => {
    const hdus = await readFitsFileHdus(result.combined);
    const hdu = hdus.find(candidate => candidate.dimensions.length >= 2);
    if (!hdu) throw new Error(`${result.combined} holds no image.`);
    return { result, hdu, header: hdus[0]!.header };
  };
  const a = await read(reductions.first), b = await read(reductions.second);
  const overlap = overlapOf(a.hdu.dimensions, b.hdu.dimensions);
  if (overlap.width < 2 || overlap.height < 2) {
    throw new Error(`The two sequences combined to ${a.hdu.dimensions.join('x')} and ${b.hdu.dimensions.join('x')}, which share no rectangle to compare.`);
  }
  // Two products of the same shape are on one grid by construction: the same detector, the same recipe, no mosaicking. They
  // are compared as they are, and the receipt says no registration was needed.
  //
  // `naco_img_jitter` is the exception. It sizes its mosaic from the dither offsets the sequence actually used, so two
  // sequences of one night come out different sizes on a canvas with no WCS. Those are compared over the rectangle both
  // hold, anchored at the origin, and only if the brightest pixel of each — the target — lands on the same pixel. Nothing
  // here shifts an image to make that true; a mismatch is reported and the comparison stops.
  const sameShape = a.hdu.dimensions.join('x') === b.hdu.dimensions.join('x');
  const peaks = sameShape ? null
    : [await brightest(a.result.combined, a.hdu, overlap), await brightest(b.result.combined, b.hdu, overlap)];
  if (peaks && (peaks[0]!.x !== peaks[1]!.x || peaks[0]!.y !== peaks[1]!.y)) {
    throw new Error(`The two mosaics are ${a.hdu.dimensions.join('x')} and ${b.hdu.dimensions.join('x')} and put their brightest`
      + ` pixel at (${peaks[0]!.x}, ${peaks[0]!.y}) and (${peaks[1]!.x}, ${peaks[1]!.y}), so they do not share an origin`
      + ' and this route does not register them.');
  }
  const differingCards = [...new Set([...Object.keys(a.header), ...Object.keys(b.header)])]
    .filter(key => RUN_CARDS.some(card => key.startsWith(card)) && String(a.header[key]) !== String(b.header[key]))
    .map(key => `${key}: ${String(a.header[key])} against ${String(b.header[key])}`).sort();
  const sequences = await Promise.all(([a, b] as const).map(async side => {
    const digest = await sha256File(side.result.combined);
    const pipeline = side.header['ESO PRO REC1 PIPE ID'];
    return { template: side.result.template, path: repositoryPath(side.result.combined), sha256: digest.sha256, bytes: digest.bytes,
      objectFrames: side.result.objectFrames, skyFrames: side.result.skyFrames,
      pipeline: typeof pipeline === 'string' ? pipeline : null };
  }));
  const value: Reproduction = {
    schema: 'cssearth-naco-reproduction@1', program: program.program,
    product: program.mode === 'imaging' ? 'COADDED_IMG' : 'SPC_NOD_COMBINED',
    kind: program.mode === 'imaging' ? 'two-templates' : 'two-nod-halves',
    note: program.mode === 'imaging' ? NOTE : NOD_NOTE,
    sequences, shapes: [a.hdu.dimensions, b.hdu.dimensions], overlap,
    registration: peaks ? { x: peaks[0]!.x, y: peaks[0]!.y, levels: peaks.map(peak => peak.level) } : null,
    statistics: await compareImage({ path: a.result.combined, hdu: a.hdu }, { path: b.result.combined, hdu: b.hdu }, overlap),
    differingCards,
  };
  const receipt = resolve(PROGRAMS, `${program.program}.${value.product}.reproduction.json`);
  // The evidence goes to the records first, so a product whose run wrote none leaves no receipt claiming it was checked.
  await addComparisonEvidence(value, [a.result.combined, b.result.combined], receipt);
  await writeFile(receipt, `${JSON.stringify(value, null, 2)}\n`);
  return value;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [id, work, first, second] = process.argv.slice(2);
  if (!id || !work || !first || !second) throw new TypeError('Usage: compare <program id> <work directory> <tpl_start> <tpl_start>');
  const value = await compareTemplates(id, resolve(work), [first, second]);
  const { statistics: stats } = value;
  console.log(`${value.program}: ${stats.both} samples, ${((stats.identicalShare ?? 0) * 100).toFixed(1)}% bit-identical,`
    + ` correlation ${stats.aboveMedian.correlation?.toFixed(6) ?? 'n/a'} above the median level.`);
}
