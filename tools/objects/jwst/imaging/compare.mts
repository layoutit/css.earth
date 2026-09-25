import { sampleAgreement } from '../sample-agreement.mts';
/** Compare a local image3 mosaic with MAST's level-3 product of the same observation: the oracle for image3.mts.
 *
 *   node tools/objects/jwst/imaging/compare.mts <program id> <band> <local i2d> [--raw <dir>]...
 *
 * Both are read with this repository's FITS reader. The two grids' WCS cards are recorded; brightness is compared at the same
 * sky positions: every MAST pixel centre is projected into the local mosaic through both WCSs (@cssearth/fits skyProjection) and
 * sampled bilinearly, where both are finite. Identical pixels are counted only when the grids coincide. Reported: the share of identical pixels, the median absolute difference relative to the
 * median brightness, and, over pixels above the median, the RMS difference relative to the RMS brightness and the correlation.
 * A coronagraph band's mosaic is PSF-subtracted: most pixels are residual noise, and how well KLIP matches changes with distance
 * from the star, so its receipt also gives the RMS difference and correlation in annuli around the target's position.
 * MAST's product must name the program's band in its own header (the mask is not in the archive's filter list).
 * The receipt is written beside the program as <program id>.<band>.reproduction.json, naming the toolchain and digests, and the
 * agreement it establishes is added as `archive-agreement` evidence to the product record the stage wrote beside the mosaic. A
 * mosaic with no record is refused. */
import { writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sha256File } from '@cssearth/core/node';
import { readFitsFileHdus, readFitsFileRegion } from '@cssearth/fits/node';
import { skyProjection } from '@cssearth/fits';
import { mastFile } from '../mast.mts';
import { PROGRAMS } from './archive.mts';
import { bandOfHeader } from './bands.mts';
import { readImagingProgram, recordProductEvidence } from './image3.mts';

const WCS_CARDS = ['NAXIS1', 'NAXIS2', 'CTYPE1', 'CTYPE2', 'CRPIX1', 'CRPIX2', 'CRVAL1', 'CRVAL2', 'CDELT1', 'CDELT2', 'PC1_1', 'PC1_2', 'PC2_1', 'PC2_2', 'BUNIT'];

async function science(path: string) {
  const hdus = await readFitsFileHdus(path), primary = hdus[0]!.header, sci = hdus.find(hdu => hdu.header.EXTNAME === 'SCI');
  if (!sci) throw new Error(`${path} has no SCI extension.`);
  const [width, height] = sci.dimensions as [number, number];
  return { primary, header: sci.header, width, height, values: (await readFitsFileRegion(path, sci, { x0: 0, y0: 0, width, height }, 1024 ** 3)).values };
}
const ANNULI_ARCSEC = [0, 0.5, 1, 2, 5, 20];

/** RMS difference over RMS brightness, and correlation, in annuli around the target's catalogue position (TARG_RA, TARG_DEC). */
function starAnnuli(theirs: Awaited<ReturnType<typeof science>>, projection: ReturnType<typeof skyProjection>, oursAt: (i: number) => number) {
  const star = projection.pixelOf(Number(theirs.primary.TARG_RA), Number(theirs.primary.TARG_DEC));
  if (!star) throw new Error('The target is off the mosaic.');
  const arcsecPerPixel = projection.scaleArcsec;
  const sums = ANNULI_ARCSEC.slice(0, -1).map(() => ({ n: 0, sa: 0, sb: 0, saa: 0, sbb: 0, sab: 0, sdd: 0 }));
  for (let i = 0; i < theirs.values.length; i++) {
    const a = oursAt(i), b = theirs.values[i]!;
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    const r = Math.hypot(i % theirs.width - star[0], Math.floor(i / theirs.width) - star[1]) * arcsecPerPixel;
    const k = ANNULI_ARCSEC.findIndex((edge, j) => j + 1 < ANNULI_ARCSEC.length && r >= edge && r < ANNULI_ARCSEC[j + 1]!);
    if (k < 0) continue;
    const s = sums[k]!;
    s.n++; s.sa += a; s.sb += b; s.saa += a * a; s.sbb += b * b; s.sab += a * b; s.sdd += (a - b) ** 2;
  }
  return { star: [star[0], star[1]], arcsecPerPixel, bins: sums.map((s, k) => ({ arcsec: [ANNULI_ARCSEC[k]!, ANNULI_ARCSEC[k + 1]!], pixels: s.n,
    rmsDifferenceOverRms: s.n ? Math.sqrt(s.sdd / s.n) / Math.sqrt(s.sbb / s.n) : null,
    correlation: s.n > 1 ? (s.n * s.sab - s.sa * s.sb) / Math.sqrt((s.n * s.saa - s.sa * s.sa) * (s.n * s.sbb - s.sb * s.sb)) : null })) };
}
const quantile = (sorted: Float32Array, q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)))]!;

export async function compareWithMast(id: string, band: string, local: string, sources: readonly string[] = []) {
  const { program } = await readImagingProgram(id), entry = program.bands.find(other => other.band === band);
  if (!entry) throw new Error(`${id} has no ${band} band.`);
  const mastPath = await mastFile(entry.level3, resolve(local, '..', '..', 'mast'), sources);
  const ours = await science(local), theirs = await science(mastPath);
  if (bandOfHeader(theirs.primary)?.id !== band) throw new Error(`${entry.level3.name} is not a ${band} product.`);
  const wcs = Object.fromEntries(WCS_CARDS.map(key => [key, { ours: ours.header[key], mast: theirs.header[key] }]));
  const differentWcs = WCS_CARDS.filter(key => ours.header[key] !== theirs.header[key] &&
    !(typeof ours.header[key] === 'number' && typeof theirs.header[key] === 'number' && Math.abs((ours.header[key] as number) - (theirs.header[key] as number)) <= 1e-9 * Math.max(1, Math.abs(theirs.header[key] as number))));
  const sameGrid = !differentWcs.length, ourProjection = skyProjection(ours.header), theirProjection = skyProjection(theirs.header);
  const sampleOurs = (x: number, y: number) => {
    const ix = Math.floor(x), iy = Math.floor(y);
    if (ix < 0 || iy < 0 || ix + 1 >= ours.width || iy + 1 >= ours.height) return NaN;
    const a = x - ix, b = y - iy, o = iy * ours.width + ix, v = ours.values;
    return (1 - a) * (1 - b) * v[o]! + a * (1 - b) * v[o + 1]! + (1 - a) * b * v[o + ours.width]! + a * b * v[o + ours.width + 1]!;
  };
  const count = theirs.values.length;
  const oursAt = (i: number) => {
    if (sameGrid) return ours.values[i]!;
    const at = ourProjection.pixelOf(...theirProjection.skyOf(i % theirs.width, Math.floor(i / theirs.width)));
    return at ? sampleOurs(at[0], at[1]) : NaN;
  };
  let both = 0, identical = 0, onlyOurs = 0, onlyTheirs = 0;
  // Preallocated and sorted in place: a NIRCam short-wave mosaic has about 24 million pixels.
  const differences = new Float32Array(count), levels = new Float32Array(count), pairs = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const a = oursAt(i), b = theirs.values[i]!, fa = Number.isFinite(a), fb = Number.isFinite(b);
    if (fa && fb) { if (a === b) identical++; differences[both] = Math.abs(a - b); levels[both] = Math.abs(b); pairs[2 * both] = a; pairs[2 * both + 1] = b; both++; }
    else if (fa) onlyOurs++; else if (fb) onlyTheirs++;
  }
  // Median ratio of local to MAST brightness within MAST brightness percentile bins: a calibration or sky difference shows in
  // every bin; alignment and outlier-flag differences show as scatter and in the star cores of the top bin.
  const mastSorted = new Float32Array(both);
  for (let k = 0; k < both; k++) mastSorted[k] = pairs[2 * k + 1]!;
  mastSorted.sort();
  const edges = [0.5, 0.9, 0.99, 0.999, 0.9999, 1].map(q => quantile(mastSorted, q));
  const ratioBins = edges.slice(0, -1).map((low, i) => {
    const high = edges[i + 1]!, ratios: number[] = [];
    for (let k = 0; k < both; k++) { const b = pairs[2 * k + 1]!; if (b >= low && (b < high || i === edges.length - 2) && b > 0) ratios.push(pairs[2 * k]! / b); }
    ratios.sort((x, y) => x - y);
    return { mastMJyPerSr: [low, high], pixels: ratios.length, medianRatio: ratios[ratios.length >> 1] ?? null };
  });
  const median = quantile(levels.subarray(0, both).sort(), 0.5), medianDifference = quantile(differences.subarray(0, both).sort(), 0.5);
  let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0, sdd = 0, n = 0;
  for (let i = 0; i < count; i++) {
    const a = oursAt(i), b = theirs.values[i]!;
    if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(b) <= median) continue;
    sa += a; sb += b; saa += a * a; sbb += b * b; sab += a * b; sdd += (a - b) ** 2; n++;
  }
  let maximumNormalizedDifference = 0;
  for (let k = 0; k < both; k++) maximumNormalizedDifference = Math.max(maximumNormalizedDifference, Math.abs(pairs[2 * k]! - pairs[2 * k + 1]!) / Math.max(Math.abs(pairs[2 * k + 1]!), median, Number.MIN_VALUE));
  const samples = { both, onlyOurs, onlyMast: onlyTheirs, maximumNormalizedDifference };
  const acceptance = { ...sampleAgreement(samples, 'image'), accepted: sameGrid && sampleAgreement(samples, 'image').accepted };
  const annuli = entry.stage === 'coron3' ? starAnnuli(theirs, theirProjection, oursAt) : undefined;
  const receipt = {
    schema: `cssearth-jwst-${entry.stage ?? 'image3'}-reproduction@2`, program: id, band, observation: entry.observation,
    toolchain: 'tools/objects/jwst/toolchain.json', crdsContext: program.crdsContext,
    mast: { ...entry.level3, sha256: (await sha256File(mastPath)).sha256, calVer: theirs.primary.CAL_VER, crdsContext: theirs.primary.CRDS_CTX },
    local: { name: basename(local), ...(await sha256File(local)), calVer: ours.primary.CAL_VER, crdsContext: ours.primary.CRDS_CTX }, acceptance, samples,
    wcs, differentWcs,
    pixels: { both, onlyOurs, onlyMast: onlyTheirs, identicalShare: sameGrid ? identical / both : null, comparedOn: sameGrid ? 'pixels' : 'sky positions', medianAbsoluteDifferenceOverMedian: medianDifference / median,
      aboveMedian: { pixels: n, rmsDifferenceOverRms: Math.sqrt(sdd / n) / Math.sqrt(sbb / n),
        correlation: (n * sab - sa * sb) / Math.sqrt((n * saa - sa * sa) * (n * sbb - sb * sb)) }, ratioBins, ...(annuli ? { annuli } : {}) },
  };
  const path = resolve(PROGRAMS, `${id}.${band}.reproduction.json`);
  await writeFile(path, `${JSON.stringify(receipt, null, 2)}\n`);
  if (!acceptance.accepted) throw new Error(`Image comparison did not meet ${acceptance.policy}; measurements retained at ${path}. No archive agreement was established.`);
  // What this comparison establishes, added to the record of the run that made the mosaic. A mosaic with no record beside it is
  // refused here: nothing states which exposures, settings and pipeline made that file, so agreement with MAST says nothing
  // about a reproduction.
  const record = await recordProductEvidence(local, 'archive-agreement', path, `These level-2 exposures, this CRDS context and this pinned pipeline ` +
    `reproduce MAST's own level-3 ${entry.stage === 'coron3' ? 'PSF-subtracted mosaic' : 'mosaic'} of this observation; the receipt holds the grid cards, the ` +
    `share of identical pixels and the brightness agreement it was measured on. It establishes that MAST's software was run the way MAST ran it, and nothing about the sky.`);
  return { path: resolve(dirname(local), record.evidence.findLast(entry => entry.kind === 'archive-agreement')!.receipt), receipt, record };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), [id, band, local] = args;
  if (!id || !band || !local) throw new TypeError('Usage: compare <program id> <band> <local i2d> [--raw <dir>]...');
  const sources = args.flatMap((arg, i) => arg === '--raw' ? [resolve(args[i + 1]!)] : []);
  const { path, receipt } = await compareWithMast(id, band, resolve(local), sources);
  console.log(`REPRODUCTION ${path} ${JSON.stringify({ differentWcs: receipt.differentWcs, pixels: receipt.pixels })}`);
}
