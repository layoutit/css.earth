#!/usr/bin/env node
/** Compare a re-run's products with the archive's own, sample by sample: the oracle for reduce.mts.
 *
 *   node tools/objects/keck/compare.mts <program id> <koaid> <run directory>
 *
 * Every product the program pins from KOA is looked for in the run by the stage it names (`_icubed`, `_icubes`, `_intf` and the
 * rest of the KCWI DRP's suffixes), and the pair is compared. Both files are read with this repository's FITS reader, and the
 * two must be on one grid: an extension of the same shape. A different shape is not reconciled, it is reported and refused,
 * because a Keck product stays on the instrument's own samples and a difference in shape means a different reduction.
 *
 * Reported for each extension: how many samples both hold, the share that are bit-identical, the median absolute difference
 * over the median level, and, over the samples above that median level, the correlation and the relative difference at its
 * median, 99th percentile and largest. Recorded beside them: what each file says about the run that made it, and every card
 * naming a version, a date or a calibration file that the two headers state differently, which is where a mismatch is looked
 * for first.
 *
 * One receipt per product, beside the program: <program id>.<product>.reproduction.json. */
import { access, open, readFile, writeFile, type FileHandle } from 'node:fs/promises';
import { basename, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sha256File } from '../../../src/platform/sha256.mts';
import { positionalArguments } from '../../cli/cli-arguments.mts';
import { requireArray, requireRecord, requireString } from '../../sources/source-values.mts';
import { readFitsFileHdus, readFitsFileRegion, type FitsFileHdu, type FitsHeader } from '../../fits/fits.mts';
import { assertInputPins, addProductEvidence, pinFile, productRecordPath, readProductRecord, type ProductEvidence, type ProductInput } from '../product-record.mts';
import { DOWNLOADS, PROGRAMS, readKeckProgram, type KeckFile, type KeckObservation } from './archive.mts';

const REPOSITORY = resolve(import.meta.dirname, '../../..');

/** What comparing our cube with the archive's own establishes, for the record of the run that made ours.
 *
 * The kind says what was compared against, not that the two agreed. So the outcome is written into the record: every
 * extension with what was found, and, where the two runs were not the same version of the pipeline, that fact. A reader
 * asking this record for `archive-agreement` gets the result, not a claim. It is narrow either way: the two runs read the
 * same pinned raw frames, so it speaks about this pipeline on this machine against the archive's run of it, about nothing
 * else, and never about either run's calibration being right. */
export const archiveAgreement = (product: string, receipt: string, archive: string,
  outcome: { readonly extensions: readonly { readonly extname: string; readonly identicalShare: number | null; readonly correlation: number | null }[]; readonly samePipelineVersion: boolean; readonly versions: string }): ProductEvidence => ({
  kind: 'archive-agreement', product, receipt,
  establishes: `${product} was compared sample by sample with the Keck Observatory Archive's own reduced product (${archive}), made from the same pinned raw frames, ` +
    `over every image extension the two share. Found, as bit-identical share and as correlation over the samples brighter than the archive's 99th percentile: ` +
    `${outcome.extensions.map(entry => `${entry.extname} ${entry.identicalShare === null ? 'no paired samples' : `${(entry.identicalShare * 100).toFixed(2)}% identical`}, ` +
      `correlation ${entry.correlation === null || Number.isNaN(entry.correlation) ? 'not defined' : entry.correlation.toFixed(4)}`).join('; ')}. ` +
    `${outcome.samePipelineVersion ? 'Both products were written by the same version of the pipeline' : `The two products were NOT written by the same version of the pipeline (${outcome.versions})`}, ` +
    'and the receipt holds the rest of the numbers. Where those numbers show a difference, the difference is what this establishes, not agreement. It establishes ' +
    "nothing about either run's calibration being right, and nothing about any product this run did not write." });

/** A product's own account of how it was made; a reproduction that differs starts here. */
const RUN_CARDS = ['DRPVER', 'PYTHVERS', 'WAVEFILE', 'RECTMAT', 'SKYFILE', 'DATE', 'DATE_PRP', 'HISTORY'];
/** No extension larger than this is compared; a KCWI blue cube binned 2x2 is about 11 million samples. */
const MAX_SAMPLES = 64 * 1024 * 1024;

/** The stage a KCWI product name ends in (`KB.20231209.37031.94_icubed.fits` is the `icubed` stage). An archive product and a
 * re-run's product are the same product when they are the same stage of the same frame, whatever each run named the file. */
export const stageOf = (name: string) => {
  const stem = basename(name).replace(/\.fits(?:\.gz)?$/u, '');
  const at = stem.lastIndexOf('_');
  return at < 0 ? '' : stem.slice(at + 1);
};

const named = (hdus: readonly FitsFileHdu[]) => hdus.map((hdu, index) => ({ hdu, index,
  extname: typeof hdu.header.EXTNAME === 'string' ? hdu.header.EXTNAME : index === 0 ? 'PRIMARY' : `EXT${index}` }));

/** The extensions of two products that can be compared, and, for each that cannot, why. An extension carrying no samples is
 * skipped rather than reported: a primary header with no data is not a difference. */
export function pairExtensions(ours: readonly FitsFileHdu[], theirs: readonly FitsFileHdu[]) {
  const theirNamed = named(theirs), pairs: { name: string; ours: FitsFileHdu; theirs: FitsFileHdu }[] = [], differentGrid: string[] = [];
  for (const entry of named(ours)) {
    if (!entry.hdu.dimensions.length) continue;
    // An extension carrying no samples is not a counterpart: a file whose primary header is empty and whose data sits in a
    // named extension would otherwise pair that extension with the empty header, and report a difference in shape.
    const match = theirNamed.find(other => other.extname === entry.extname && other.hdu.dimensions.length);
    if (!match) differentGrid.push(`${entry.extname}: the archive's product has no such extension`);
    else if (entry.hdu.dimensions.join('x') !== match.hdu.dimensions.join('x')) differentGrid.push(`${entry.extname}: ${entry.hdu.dimensions.join('x')} against the archive's ${match.hdu.dimensions.join('x')}`);
    else if (![2, 3].includes(entry.hdu.dimensions.length)) differentGrid.push(`${entry.extname}: ${entry.hdu.dimensions.length} axes, which this comparison does not read`);
    else pairs.push({ name: entry.extname, ours: entry.hdu, theirs: match.hdu });
  }
  return { pairs, differentGrid };
}

const quantile = (sorted: Float32Array, q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)))] ?? Number.NaN;

/** What every comparison reports, from paired samples: how many both hold, how many agree bit for bit, and how far apart the
 * rest are. `pairs` is walked three times, so a caller that streams reads its samples three times and holds only what it is
 * reading. */
async function statistics(pairs: (visit: (ours: number, theirs: number) => void) => Promise<void> | void, count: number) {
  const levels = new Float32Array(count), differences = new Float32Array(count);
  let both = 0, identical = 0, onlyOurs = 0, onlyTheirs = 0;
  await pairs((ours, theirs) => {
    const fa = Number.isFinite(ours), fb = Number.isFinite(theirs);
    if (fa && fb) { if (ours === theirs) identical++; levels[both] = Math.abs(theirs); differences[both] = Math.abs(ours - theirs); both++; }
    else if (fa) onlyOurs++; else if (fb) onlyTheirs++;
  });
  const sortedLevels = levels.subarray(0, both).slice().sort();
  const median = quantile(sortedLevels, 0.5), brightest = quantile(sortedLevels, 0.99);
  const medianDifference = quantile(differences.subarray(0, both).slice().sort(), 0.5);
  // Two cuts, because one of them does not answer the question. "Above the median" is half the cube, and on a rectified cube
  // the median level is near zero, so most of those samples are sky and read noise where a ratio says little. "Above the 99th
  // percentile of the archive's own levels" is where the object's light is, and a reduction that disagrees about the object
  // shows it there. Relative differences are kept per sample and reported as quantiles, so the largest is never read as the
  // typical one.
  const cut = async (floor: number, into: Float32Array) => {
    let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0, n = 0;
    await pairs((ours, theirs) => {
      if (!Number.isFinite(ours) || !Number.isFinite(theirs) || Math.abs(theirs) <= floor) return;
      sa += ours; sb += theirs; saa += ours * ours; sbb += theirs * theirs; sab += ours * theirs;
      into[n++] = Math.abs(ours - theirs) / Math.abs(theirs);
    });
    const sorted = into.subarray(0, n).slice().sort();
    return { level: floor, samples: n, correlation: n > 1 ? (n * sab - sa * sb) / Math.sqrt((n * saa - sa * sa) * (n * sbb - sb * sb)) : null,
      relativeDifference: n ? { median: quantile(sorted, 0.5), p99: quantile(sorted, 0.99), largest: quantile(sorted, 1) } : null };
  };
  // `differences` and `levels` have been read out above, so each cut reuses one of them and a cube is compared without a
  // third buffer of its size.
  const aboveMedian = await cut(median, differences), aboveBrightest = await cut(brightest, levels);
  return { samples: count, both, identical, onlyOurs, onlyTheirs, identicalShare: both ? identical / both : null,
    medianLevel: median, medianAbsoluteDifferenceOverMedian: median ? medianDifference / median : null,
    aboveMedian, aboveBrightestPercent: aboveBrightest };
}

/** One plane of a two- or three-axis image, read through the shared region reader: the plane's own two axes at its own offset
 * in the data block. The header, and with it BSCALE and BZERO, stays the extension's. */
const planeHdu = (hdu: FitsFileHdu, plane: number): FitsFileHdu => {
  const [width, height] = hdu.dimensions as [number, number];
  return { ...hdu, dimensions: [width, height], dataStart: hdu.dataStart + plane * width * height * (Math.abs(hdu.bitpix) / 8) };
};

/** Two image extensions of the same shape, sample for sample. A cube is read one plane at a time, so what is held is one plane
 * of each file, not the cube. */
export async function compareImage(name: string, ours: { path: string; hdu: FitsFileHdu }, theirs: { path: string; hdu: FitsFileHdu }) {
  const dimensions = ours.hdu.dimensions, [width, height] = dimensions as [number, number], planes = dimensions[2] ?? 1;
  const perPlane = width * height, count = perPlane * planes;
  if (count > MAX_SAMPLES) throw new Error(`${name} has ${count} samples, more than this comparison reads.`);
  const region = { x0: 0, y0: 0, width, height };
  // Each cube is opened once and read plane by plane through that handle. Opening per plane instead is 2,595 opens per pass
  // per file, and the comparison spent its time there rather than on the samples.
  const files = await Promise.all([open(ours.path, 'r'), open(theirs.path, 'r')]);
  try {
    const read = async (side: { path: string; hdu: FitsFileHdu }, handle: FileHandle, plane: number) =>
      (await readFitsFileRegion(side.path, planeHdu(side.hdu, plane), region, perPlane * 8, handle)).values;
    const walk = async (visit: (ours: number, theirs: number) => void) => {
      for (let plane = 0; plane < planes; plane++) {
        const a = await read(ours, files[0]!, plane), b = await read(theirs, files[1]!, plane);
        for (let i = 0; i < perPlane; i++) visit(a[i]!, b[i]!);
      }
    };
    return { kind: 'image' as const, shape: [...dimensions], ...await statistics(walk, count) };
  } finally { await Promise.all(files.map(file => file.close())); }
}

const cards = (header: FitsHeader, keys: readonly string[]) => Object.fromEntries(keys.filter(key => header[key] !== undefined).map(key => [key, header[key]!]));

/** What the product itself says made it. The KCWI DRP does not write a version card: it writes one HISTORY record per
 * primitive it ran and one reading `kcwidrp version=1.0.2`, so the version and the recipe are read out of the raw cards,
 * which the FITS reader keeps beside the parsed header. This is the first place a difference is explained from. */
export function pipelineHistory(cards: readonly string[]) {
  const history = cards.filter(card => card.startsWith('HISTORY')).map(card => card.slice(7).trim()).filter(Boolean);
  const version = history.map(line => /^kcwidrp version=(\S+)$/u.exec(line)?.[1]).find(Boolean);
  return { ...(version ? { version } : {}), steps: history.filter(line => !/^kcwidrp version=/u.test(line)) };
}
/** Every card naming a version, a date, a calibration file or a master frame whose value the two headers state differently. */
function differentSettings(ours: FitsHeader, theirs: FitsHeader) {
  const keys = [...new Set([...Object.keys(ours), ...Object.keys(theirs)])].filter(key => /(?:VER|VERS|DATE|FILE|MASTER|MB?FILE|TAB)$/u.test(key));
  return Object.fromEntries(keys.filter(key => String(ours[key] ?? '').trim() !== String(theirs[key] ?? '').trim())
    .map(key => [key, { ours: ours[key], archive: theirs[key] }]));
}

/** The stem the pipeline writes one observation's products under: it names every product after the file it reduced, so the
 * stem is that frame's name without its extension. Both names the program holds are accepted, because which one a pipeline
 * uses is the pipeline's choice: the observatory's own (`kb231209_00085`, what the KCWI DRP uses, since the frames are staged
 * under it) and KOA's id (`KB.20231209.37031.94`, what the archive's own products use). */
export const productStems = (observation: KeckObservation): string[] =>
  [...new Set([observation.science.observatoryName, observation.science.name].filter((name): name is string => Boolean(name))
    .map(name => name.replace(/\.fits(?:\.gz)?$/u, '')))];

/** The run's product for one stage OF ONE OBSERVATION, by name.
 *
 * A stage suffix alone does not identify a product. A run directory holds a whole night, and every science frame in it ends
 * in `_icubed.fits`; taking the first match compared the December 9 cube against a December 10 one, silently, because both
 * names end the same way. So a candidate has to carry the requested observation's own frame name as well as the stage, and
 * there is no fall back to a first match: none is `null` (reported as not reproduced), and more than one is refused, because
 * two files claiming to be the same stage of the same frame means the directory holds two runs. */
export function selectRunProduct(names: readonly string[], stage: string, observation: KeckObservation): string | null {
  if (!stage) return null;
  const stems = productStems(observation);
  const matches = names.filter(name => stageOf(name) === stage
    && stems.includes(basename(name).replace(/\.fits(?:\.gz)?$/u, '').slice(0, -(stage.length + 1))));
  if (matches.length > 1) throw new Error(`${observation.koaid}: the run holds ${matches.length} files that are its ${stage} stage (${matches.join(', ')}); which one it is cannot be decided here.`);
  return matches[0] ?? null;
}

/** Refuse a run directory that is not the one asked about. `run.json` is written by the run that made the products and names
 * the program and the observation it reduced, so a directory naming another is a directory of another reduction, and
 * comparing its products against this observation's archive product would compare two different frames. */
export async function assertRunIsFor(run: string, id: string, koaid: string) {
  const text = await readFile(resolve(run, 'run.json'), 'utf8').catch(() => null);
  if (text === null) throw new Error(`${run} holds no run.json, so what it reduced is not known; re-run tools/objects/keck/reduce.mts ${id} ${koaid}.`);
  const entry = requireRecord(JSON.parse(text) as unknown, 'run.json');
  const program = requireString(entry.program, 'run.json program'), made = requireString(entry.koaid, 'run.json koaid');
  if (program !== id || made !== koaid) throw new Error(`${run} is the run of ${program} ${made}, not of ${id} ${koaid}.`);
  return requireArray(entry.products ?? [], 'run.json products').map(name => requireString(name, 'product name'));
}

/** The run's file for a pinned archive product: the product of the same stage made from this observation's own raw frame.
 * The name has to say so and the product's own record has to say so, because a name is what a pipeline chose and a record is
 * what the run wrote: the record names the observation and pins the raw frames it read. A product with no record, or with a
 * record of another observation, is refused rather than compared. */
export async function runProduct(redux: string, product: KeckFile, names: readonly string[], observation: KeckObservation) {
  const stage = stageOf(product.name);
  const match = selectRunProduct(names, stage, observation);
  if (!match) return null;
  const path = resolve(redux, match);
  if (!await access(path).then(() => true, () => false)) return null;
  const record = await readProductRecord(productRecordPath(path));
  if (!record) throw new Error(`${match} has no product record beside it, so what it was made from is not known; re-run tools/objects/keck/reduce.mts, which writes one with every product.`);
  const made = (record.parameters as { koaid?: unknown }).koaid;
  if (made !== observation.koaid) throw new Error(`${match} was made from ${String(made)}, not from ${observation.koaid}.`);
  if (!record.inputs.some(input => input.identity === observation.science.name && input.bytes === observation.science.bytes))
    throw new Error(`${match} was not made from the pinned raw frame ${observation.science.name}; its record names ${record.inputs.length} inputs and none of them is that file at the pinned digest.`);
  return path;
}

/** Everything a comparison reads, as the program pins it: the archive's own product, and the raw frames our product was made
 * from. Identity is the archive's path to the file, because two products of one frame can share a name at different levels.
 *
 * These are checked before a single sample is read. A comparison that reads a file the program does not pin is not a
 * comparison against the archive, it is a comparison against whatever is on this disk under that name: a fixture of the same
 * size with altered samples read as 100% identical and earned archive-agreement evidence against the program's own pin. */
export async function comparisonPins(id: string, observation: KeckObservation, product: KeckFile, downloads = DOWNLOADS) {
  const lev0 = (file: KeckFile) => resolve(downloads, id, 'lev0', file.name);
  const pins: ProductInput[] = [], files = new Map<string, string>();
  const add = async (role: string, file: KeckFile, path: string) => {
    pins.push({ role, identity: file.filehand, bytes: file.bytes, sha256: (await pinFile(path)).sha256 });
    files.set(file.filehand, path);
  };
  await add('archive product', product, resolve(downloads, id, 'products', product.level ?? 'lev1', product.name));
  await add('object', observation.science, lev0(observation.science));
  for (const file of observation.calibrations) await add(file.imageType ?? 'calibration', file, lev0(file));
  return { pins, files };
}

export async function compareWithArchive(id: string, koaid: string, run: string) {
  const program = await readKeckProgram(id);
  const observation = program.observations.find(entry => entry.koaid === koaid);
  if (!observation) throw new Error(`${id} pins no observation ${koaid}.`);
  if (!observation.archiveProducts.length) throw new Error(`${koaid}: KOA published no reduced product for it, so there is nothing to compare against.`);
  const redux = resolve(run, 'redux');
  const listing = await assertRunIsFor(run, id, koaid);
  const receipts: { path: string; receipt: Record<string, unknown> }[] = [];
  const missing: string[] = [];
  // The archive keeps one stage under more than one level; each is compared against the run's product for that stage.
  for (const product of observation.archiveProducts) {
    const local = await runProduct(redux, product, listing, observation);
    if (!local) { missing.push(product.name); continue; }
    const archive = resolve(DOWNLOADS, id, 'products', product.level ?? 'lev1', product.name);
    // Before a sample is read or a word of evidence is written: every file this comparison will read is the file the program
    // pins, by byte count and sha256.
    const { pins, files } = await comparisonPins(id, observation, product);
    await assertInputPins(pins, files);
    const ourHdus = await readFitsFileHdus(local), theirHdus = await readFitsFileHdus(archive);
    const ourPrimary = ourHdus[0]!.header, theirPrimary = theirHdus[0]!.header;
    const ourPipeline = pipelineHistory(ourHdus[0]!.cards), theirPipeline = pipelineHistory(theirHdus[0]!.cards);
    const { pairs, differentGrid } = pairExtensions(ourHdus, theirHdus), extensions: Record<string, unknown>[] = [];
    for (const { name, ours, theirs } of pairs) extensions.push({ extname: name, ...await compareImage(name, { path: local, hdu: ours }, { path: archive, hdu: theirs }) });
    if (!extensions.length) throw new Error(`${product.name}: nothing was comparable (${differentGrid.join('; ') || 'no extensions with samples'}).`);
    // The bytes are read again after the samples, so the receipt states the file as it was for the whole comparison and not
    // only as it was when the check above ran.
    const archiveRead = await sha256File(archive);
    if (archiveRead.bytes !== product.bytes)
      throw new Error(`${product.name} changed while it was being compared: ${archiveRead.bytes} bytes; the program records ${product.bytes} bytes.`);
    const receipt = {
      schema: 'cssearth-keck-reproduction@1', program: id, koaid, product: stageOf(product.name),
      instrument: program.instrument, configuration: observation.configuration, target: observation.targetName,
      toolchain: 'tools/objects/keck/toolchain.json',
      // `bytes` and `sha256` are what the program pins; `read` is what was on disk when the samples were read. A receipt that
      // quietly replaced the first with the second would say a comparison was against the archive's product whatever bytes it
      // actually read, so both are written and the two have to be equal.
      archive: { ...product, read: archiveRead, ...cards(theirPrimary, RUN_CARDS), pipeline: theirPipeline,
        sampleBits: Math.abs(theirHdus[0]!.bitpix) },
      // Our own product has no pin to be checked against: it is what this run made, and its digest is recorded so the
      // receipt, the product record and the file on disk name the same bytes.
      local: { name: basename(local), ...(await sha256File(local)), record: relative(REPOSITORY, productRecordPath(local)),
        ...cards(ourPrimary, RUN_CARDS), pipeline: ourPipeline, sampleBits: Math.abs(ourHdus[0]!.bitpix) },
      // The two runs are the same pipeline at different versions where the archive's product is old enough, and that is the
      // first thing a reader has to know before reading a difference as a failure to reproduce.
      samePipelineVersion: Boolean(ourPipeline.version) && ourPipeline.version === theirPipeline.version,
      stepsOnlyOneRan: [...ourPipeline.steps.filter(step => !theirPipeline.steps.includes(step)).map(step => `ours: ${step}`),
        ...theirPipeline.steps.filter(step => !ourPipeline.steps.includes(step)).map(step => `archive: ${step}`)],
      differentSettings: differentSettings(ourPrimary, theirPrimary), differentGrid, extensions,
    };
    const path = resolve(PROGRAMS, `${id}.${product.level ?? 'lev1'}-${receipt.product}.reproduction.json`);
    await writeFile(path, `${JSON.stringify(receipt, null, 2)}\n`);
    // What this comparison established goes on the record of the run that made the cube, naming the exact product checked and
    // the receipt holding the numbers. The record refuses it unless the product it pins is still the file on disk.
    await addProductEvidence(productRecordPath(local), [archiveAgreement(basename(local), path, product.filehand, {
      extensions: extensions.map(entry => ({ extname: String(entry.extname), identicalShare: entry.identicalShare as number | null,
        correlation: (entry.aboveBrightestPercent as { correlation: number | null }).correlation })),
      samePipelineVersion: receipt.samePipelineVersion,
      versions: `ours ${ourPipeline.version ?? 'unstated'}, the archive's ${theirPipeline.version ?? 'unstated'}`,
    })], recorded => resolve(redux, recorded));
    receipts.push({ path, receipt });
  }
  if (!receipts.length) throw new Error(`${koaid}: the run wrote none of the stages KOA published (${missing.join(', ')}).`);
  return { receipts, missing };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [id, koaid, run] = positionalArguments(process.argv.slice(2));
  if (!id || !koaid || !run) throw new TypeError('Usage: compare <program id> <koaid> <run directory>');
  const { receipts, missing } = await compareWithArchive(id, koaid, resolve(run));
  for (const { path, receipt } of receipts) {
    const extensions = receipt.extensions as { extname: string; identicalShare: number | null; aboveBrightestPercent: { correlation: number | null } }[];
    console.log(`REPRODUCTION ${path} ${JSON.stringify(extensions.map(entry => `${entry.extname} identical ${entry.identicalShare} correlation over the brightest percent ${entry.aboveBrightestPercent.correlation}`))}`);
  }
  if (missing.length) console.log(`NOT REPRODUCED ${missing.join(', ')}`);
}
