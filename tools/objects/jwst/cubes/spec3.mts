#!/usr/bin/env node
/** Re-run the JWST pipeline's level-3 spectroscopy stage (calwebb_spec3) for one cube band of a pinned imaging program, and
 * check the cube against MAST's.
 *
 *   node tools/objects/jwst/cubes/spec3.mts <program id> <band> <work directory> [--raw <dir>]... [--max-rss-gib <n>] [--arcsec-per-pixel <n>]
 *
 * The members are every level-2 _cal exposure MAST's own spec3 association names (imaging/archive.mts): both detectors at each
 * dither, and for MIRI's medium-resolution spectrometer each of the three grating settings as well. The stage flags outliers
 * between the exposures and builds the cube (cube_build), on the pinned toolchain (toolchain.json: jwst 2.0.1) with the
 * program's CRDS context. A MIRI run asks cube_build for the band's channel and sub-band alone, so it builds one cube instead of
 * the association's twelve; the rest of the association still matters, because a moving target's frame is the mean position of
 * every exposure in it. The one-dimensional extraction that follows is skipped: it reads the cube and does not change it, and
 * with it MIRI's spectral-leak correction, which only ever changes an extracted spectrum. The run is stopped if its resident
 * memory passes the ceiling (default 6 GiB; four NIRSpec G395H exposures peak at 4.1 GiB, 24 MIRI MRS exposures at 3.3 GiB).
 *
 * Every member's own header is read before the run: it must be an integral-field exposure of the band's instrument, and the
 * band's own detector and sub-band must be among them.
 *
 * The run writes a `cssearth-telescope-product@1` record beside the cube (`<cube>.product.json`): the exposures at their pinned
 * digests, the settings and CRDS context, the pinned pipeline, and the cube with the units and conventions its own header
 * states. A cube whose record says this same run made it is not built again.
 *
 * The cube is then compared with MAST's level-3 cube sample by sample, a receipt is written beside the program, and the
 * agreement it establishes is added to that record as `archive-agreement` evidence. The two are
 * on one grid or the comparison fails: a cube's grid follows from its members alone.
 *
 * --arcsec-per-pixel builds the cube on a finer sky grid than the pipeline's 0.1 arcsecond instead. That cube has no MAST twin, so
 * it is not compared; run the default first, so the receipt shows these exposures and this toolchain reproduce MAST's cube. */
import { mkdir, readdir, rm, writeFile, open } from 'node:fs/promises';
import { totalmem } from 'node:os';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sha256File } from '../../../../src/platform/sha256.mts';
import { readFitsFileHdus } from '../../../fits.mts';
import { requireRecord } from '../../../source-values.mts';
import { productRecordPath, readProductRecord, sameRun, writeProductRecord } from '../../product-record.mts';
import { eurekaToolchain } from '../toolchain.mts';
import { freeMemoryPercent, mastFile, toolchainPython } from '../mast.mts';
import { PROGRAMS } from '../imaging/archive.mts';
import { bandOfHeader, JWST_BANDS, type JwstBand } from '../imaging/bands.mts';
import { eurekaPins, imagingMembers, imagingProductRun, level3ProductFacts, readImagingProgram, recordProductEvidence } from '../imaging/image3.mts';
import { openSpectralCube, type SpectralCube } from './spectral-cube.mts';

const SPEC3 = `
import json, sys, time
from jwst.pipeline import Spec3Pipeline
start = time.time()
asn, output_dir, steps = sys.argv[1], sys.argv[2], json.loads(sys.argv[3])
Spec3Pipeline.call(asn, output_dir=output_dir, save_results=True, steps=steps)
print(json.dumps({'seconds': round(time.time() - start, 1)}))
`;

/** The steps a cube run sets beyond the CRDS parameter reference MAST used.
 *
 * `extract_1d` reads the finished cube and does not change it, and MIRI's `spectral_leak` corrects an extracted spectrum, not a
 * cube; both are skipped. A MIRI association covers twelve cubes, so `cube_build` is asked for the band's channel and sub-band
 * alone. `scalexy` is a finer sky grid than the pipeline's default: the dithers sample the sky between the default pixels, so
 * the drizzle has real information to put there, and the wavelength axis is left as the pipeline sets it. */
export function spec3Steps(band: JwstBand, arcsecPerPixel?: number): Record<string, Record<string, string | number | boolean>> {
  const cube = { ...(band.channel ? { channel: band.channel, band: band.subBand!.toLowerCase() } : {}), ...(arcsecPerPixel === undefined ? {} : { scalexy: arcsecPerPixel }) };
  return { extract_1d: { skip: true }, ...(band.instrument === 'MIRI' ? { spectral_leak: { skip: true } } : {}), ...(Object.keys(cube).length ? { cube_build: cube } : {}) };
}

/** Every member's own header, checked against the band the program claims before the pipeline reads a single file. A MIRI
 * association carries all twelve settings, so the check is that the band's own is among them, not that every member is it. */
export async function assertCubeMembers(band: JwstBand, files: readonly string[]): Promise<void> {
  const exposure = band.channel ? 'MIR_MRS' : 'NRS_IFU', settings = new Set<string>();
  for (const file of files) {
    const header = (await readFitsFileHdus(file))[0]!.header;
    if (header.TELESCOP !== 'JWST' || header.INSTRUME !== band.instrument || header.EXP_TYPE !== exposure)
      throw new Error(`${basename(file)} is ${String(header.TELESCOP)} ${String(header.INSTRUME)} ${String(header.EXP_TYPE)}, not a ${band.instrument} ${exposure} exposure.`);
    settings.add(`${String(header.DETECTOR)} ${String(header.BAND)}`);
  }
  if (band.detector && !settings.has(`${band.detector} ${band.subBand}`))
    throw new Error(`No member of ${band.id} is a ${band.detector} ${band.subBand} exposure; the members are ${[...settings].sort().join(', ')}.`);
}

export async function runSpec3(id: string, band: string, work: string, options: { sources?: readonly string[]; maxRssBytes?: number; arcsecPerPixel?: number } = {}) {
  const { program, entry, files } = await imagingMembers(id, band, resolve(work, 'members'), options.sources);
  if (entry.stage !== 'spec3') throw new Error(`${id} ${band} is not a cube band.`);
  const ceiling = options.maxRssBytes ?? 6 * 2 ** 30, free = freeMemoryPercent() / 100 * totalmem();
  if (!(free >= 2 * ceiling)) throw new Error(`Only ${(free / 2 ** 30).toFixed(1)} GiB of memory is free; the spec3 stage needs twice its ${(ceiling / 2 ** 30).toFixed(1)} GiB ceiling.`);
  const fine = options.arcsecPerPixel;
  if (fine !== undefined && !(fine >= 0.02 && fine <= 0.1)) throw new RangeError('A finer cube grid is between 0.02 and 0.1 arcsecond per pixel.');
  const output = resolve(work, fine === undefined ? 'spec3' : `spec3-${fine}`), asn = resolve(work, `${entry.observation}_asn.json`);
  await mkdir(output, { recursive: true });
  const setting = JWST_BANDS[band]!, steps = spec3Steps(setting, fine);
  await assertCubeMembers(setting, files);
  const run = imagingProductRun(program, entry, 'spec3', { steps }, await eurekaPins());
  // The stage names the cube after the setting itself, so a cube already in the output directory is the one to ask
  // about: it is reused only when the record beside it says these same exposures, settings and pipeline made it.
  const made = (await readdir(output).catch(() => [])).filter(name => name.endsWith('_s3d.fits'));
  if (made.length === 1) {
    const cube = resolve(output, made[0]!);
    if (await sameRun(await readProductRecord(productRecordPath(cube)), run, () => cube)) return { cube, reused: true, peakRssBytes: 0, seconds: 0, members: files.length };
    await rm(productRecordPath(cube), { force: true });
  }
  // The stage names its product after the setting itself, so the association's product stops at the instrument.
  await writeFile(asn, `${JSON.stringify({ asn_type: 'spec3', asn_rule: setting.channel ? 'candidate_Asn_Lv3MIRMRS' : 'candidate_Asn_Lv3NRSIFU',
    program: program.programme.padStart(5, '0'), asn_id: 'o001', target: 't001', asn_pool: 'cssearth',
    products: [{ name: entry.observation.replace(/_[a-z0-9]+-[a-z0-9]+$/u, ''), members: files.map(expname => ({ expname, exptype: 'science' })) }] }, null, 2)}\n`);
  const toolchain = await eurekaToolchain(program.crdsContext);
  const result = await toolchainPython(toolchain, work, SPEC3, [asn, output, JSON.stringify(steps)], resolve(work, `${entry.observation}${fine === undefined ? '' : `-${fine}`}.log`), { maxRssBytes: ceiling });
  const cubes = (await readdir(output)).filter(name => name.endsWith('_s3d.fits'));
  if (cubes.length !== 1) throw new Error(`${id} ${band}: the stage wrote ${cubes.length} cubes.`);
  const cube = resolve(output, cubes[0]!);
  await writeProductRecord(productRecordPath(cube), run, [{ path: basename(cube), file: cube, ...(await level3ProductFacts(cube)) }]);
  return { cube, reused: false, peakRssBytes: result.peakRssBytes, seconds: requireRecord(JSON.parse(result.lastLine), 'spec3 result').seconds, members: files.length };
}

const GRID = ['CRPIX1', 'CRPIX2', 'CRPIX3', 'CRVAL1', 'CRVAL2', 'CRVAL3', 'CDELT1', 'CDELT2', 'CDELT3'] as const;

/** Compare a re-run cube with MAST's level-3 cube, and write the receipt. */
export async function compareCubeWithMast(id: string, band: string, local: string, downloads: string, sources: readonly string[] = []) {
  const { program } = await readImagingProgram(id), entry = program.bands.find(other => other.band === band);
  if (!entry || entry.stage !== 'spec3') throw new Error(`${id} has no cube band ${band}.`);
  const mastPath = await mastFile(entry.level3, downloads, sources), [theirs, ours] = await Promise.all([openSpectralCube(mastPath), openSpectralCube(local)]);
  if (bandOfHeader(theirs.primary)?.id !== band) throw new Error(`${entry.level3.name} is not a ${band} product.`);
  const sameGrid = ours.width === theirs.width && ours.height === theirs.height && ours.planes === theirs.planes && GRID.every(key => ours.science[key] === theirs.science[key]);
  if (!sameGrid) throw new Error(`${id} ${band}: the re-run cube is ${ours.width} × ${ours.height} × ${ours.planes} on a different grid from MAST's ${theirs.width} × ${theirs.height} × ${theirs.planes}.`);
  const samples = await compareSamples(ours, theirs);
  const receipt = { schema: 'cssearth-jwst-spec3-reproduction@1', program: id, band, observation: entry.observation, toolchain: 'tools/objects/jwst/toolchain.json', crdsContext: program.crdsContext,
    mast: { ...entry.level3, sha256: (await sha256File(mastPath)).sha256, calVer: theirs.primary.CAL_VER, crdsContext: theirs.primary.CRDS_CTX }, local: { calVer: ours.primary.CAL_VER, crdsContext: ours.primary.CRDS_CTX },
    grid: { width: ours.width, height: ours.height, planes: ours.planes, arcsecPerPixel: ours.arcsecPerPixel, micrometres: [ours.wavelength(0), ours.wavelength(ours.planes - 1)] }, samples };
  const path = resolve(PROGRAMS, `${id}.${band}.reproduction.json`);
  await writeFile(path, `${JSON.stringify(receipt, null, 2)}\n`);
  // Added to the record of the run that built this cube; a cube with no record beside it is refused, because nothing states
  // which exposures and pipeline made the file the samples were taken from.
  const record = await recordProductEvidence(local, 'archive-agreement', path, `These level-2 exposures, this CRDS context and this pinned pipeline reproduce MAST's own ` +
    `level-3 cube of this observation, compared sample by sample on one grid; the receipt holds the coverage, the identical share and the correlation. It establishes that ` +
    `MAST's software was run the way MAST ran it, and nothing about the body the cube shows.`);
  return { path, receipt, record };
}

/** Sample by sample over both cubes, a plane at a time: how many samples both cover, how many only one covers, how many are
 * bit-identical, their correlation, and the largest relative difference among samples above the median brightness. */
export async function compareSamples(ours: SpectralCube, theirs: SpectralCube) {
  const bytes = ours.width * ours.height * 4, a = Buffer.alloc(bytes), b = Buffer.alloc(bytes), [fa, fb] = await Promise.all([open(ours.path, 'r'), open(theirs.path, 'r')]);
  const covered = (value: number) => Number.isFinite(value) && value !== 0;
  try {
    const levels: number[] = [];
    for (let plane = 0; plane < theirs.planes; plane += 50) { await fb.read(b, 0, bytes, theirs.sci.dataStart + plane * bytes); for (let i = 0; i < bytes; i += 4) { const value = b.readFloatBE(i); if (covered(value)) levels.push(Math.abs(value)); } }
    const median = levels.sort((p, q) => p - q)[levels.length >> 1] ?? 0;
    let both = 0, onlyOurs = 0, onlyMast = 0, identical = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0, largest = 0;
    for (let plane = 0; plane < ours.planes; plane++) {
      await fa.read(a, 0, bytes, ours.sci.dataStart + plane * bytes); await fb.read(b, 0, bytes, theirs.sci.dataStart + plane * bytes);
      for (let i = 0; i < bytes; i += 4) {
        const x = a.readFloatBE(i), y = b.readFloatBE(i), hasX = covered(x), hasY = covered(y);
        if (!hasX || !hasY) { if (hasX) onlyOurs++; else if (hasY) onlyMast++; continue; }
        both++; if (x === y) identical++; sa += x; sb += y; saa += x * x; sbb += y * y; sab += x * y;
        if (Math.abs(y) > median) largest = Math.max(largest, Math.abs(x / y - 1));
      }
    }
    return { both, onlyOurs, onlyMast, identicalShare: identical / both, correlation: (both * sab - sa * sb) / Math.sqrt((both * saa - sa * sa) * (both * sbb - sb * sb)), largestRelativeDifferenceAboveMedian: largest };
  } finally { await fa.close(); await fb.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), [id, band, work] = args;
  const option = (name: string) => args.flatMap((arg, i) => arg === name ? [args[i + 1]!] : []);
  if (!id || !band || !work) throw new TypeError('Usage: spec3 <program id> <band> <work> [--raw <dir>]... [--max-rss-gib <n>]');
  const ceiling = option('--max-rss-gib')[0], sources = option('--raw').map(dir => resolve(dir)), fine = option('--arcsec-per-pixel')[0];
  const result = await runSpec3(id, band, resolve(work), { sources, ...(ceiling ? { maxRssBytes: Number(ceiling) * 2 ** 30 } : {}), ...(fine ? { arcsecPerPixel: Number(fine) } : {}) });
  console.log(`SPEC3 ${JSON.stringify({ ...result, peakRssGiB: +(result.peakRssBytes / 2 ** 30).toFixed(2) })}`);
  if (fine) process.exit(0);
  const { path, receipt } = await compareCubeWithMast(id, band, result.cube, resolve(work), sources);
  console.log(`REPRODUCTION ${path} ${JSON.stringify(receipt.samples)}`);
}
