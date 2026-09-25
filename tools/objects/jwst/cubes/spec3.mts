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
 * memory passes the ceiling (default 6 GiB). Outlier detection and cube building run as two toolkit processes around pinned
 * CRF files, so the first process releases its work arrays before the second opens them.
 *
 * Every member's own header is read before the run: it must be an integral-field exposure of the band's instrument, and the
 * band's own detector and sub-band must be among them.
 *
 * The run writes a `cssearth-telescope-product@1` record beside the cube (`<cube>.product.json`): the exposures at their pinned
 * digests, the settings and CRDS context, the pinned pipeline, and the cube with the units and conventions its own header
 * states. A cube whose record says this same run made it is not built again.
 *
 * A requested wavelength interval is built on the corresponding plane centres of MAST's full cube rather than expanding the
 * job to the instrument's entire band. The result is compared with those MAST planes sample by sample, a receipt is written beside the program, and the
 * agreement it establishes is added to that record as `archive-agreement` evidence. The spatial grid and spectral plane centres
 * must align or the comparison fails.
 *
 * --arcsec-per-pixel builds the cube on a finer sky grid than the pipeline's 0.1 arcsecond instead. That cube has no MAST twin, so
 * it is not compared; run the default first, so the receipt shows these exposures and this toolchain reproduce MAST's cube. */
import { mkdir, readdir, rm, writeFile, open } from 'node:fs/promises';
import { totalmem } from 'node:os';
import { basename, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sha256File } from '@cssearth/core/node';
import { sampleAgreement } from '../sample-agreement.mts';
import { readFitsFileHdus } from '@cssearth/fits/node';
import { requireRecord } from '@cssearth/core';
import { productRecordPath, type ProductInput, type ProductRun } from '@cssearth/telescope';
import { readProductRecord, sameRun, writeProductRecord } from '@cssearth/telescope/node';
import { eurekaToolchain } from '../toolchain.mts';
import { freeMemoryPercent, mastFile, toolchainPython } from '../mast.mts';
import { PROGRAMS } from '../imaging/archive.mts';
import { bandOfHeader, JWST_BANDS, type JwstBand } from '../imaging/bands.mts';
import { eurekaPins, imagingMembers, imagingProductRun, level3ProductFacts, readImagingProgram, recordProductEvidence } from '../imaging/image3.mts';
import { openSpectralCube, type SpectralCube } from './spectral-cube.mts';

const SPEC3_CRFS = `
import json, sys, time
from jwst.pipeline import Spec3Pipeline
start = time.time()
asn, output_dir, steps = sys.argv[1], sys.argv[2], json.loads(sys.argv[3])
Spec3Pipeline.call(asn, output_dir=output_dir, save_results=True, steps=steps)
print(json.dumps({'seconds': round(time.time() - start, 1)}))
`;

const CUBE_BUILD = `
import json, sys, time
from jwst.cube_build import CubeBuildStep
start = time.time()
asn, output_dir, settings = sys.argv[1], sys.argv[2], json.loads(sys.argv[3])
CubeBuildStep.call(asn, output_dir=output_dir, save_results=True, pipeline=3, suffix='s3d', **settings)
print(json.dumps({'seconds': round(time.time() - start, 1)}))
`;

/** The steps a cube run sets beyond the CRDS parameter reference MAST used.
 *
 * `extract_1d` reads the finished cube and does not change it, and MIRI's `spectral_leak` corrects an extracted spectrum, not a
 * cube; both are skipped. A MIRI association covers twelve cubes, so `cube_build` is asked for the band's channel and sub-band
 * alone. `scalexy` is a finer sky grid than the pipeline's default: the dithers sample the sky between the default pixels, so
 * the drizzle has real information to put there. `wavemin` and `wavemax` bound a requested spectral slice. */
export function spec3Steps(band: JwstBand, arcsecPerPixel?: number, wavelengthMicrometres?: readonly [number, number]): Record<string, Record<string, string | number | boolean>> {
  const cube = { ...(band.channel ? { channel: band.channel, band: band.subBand!.toLowerCase() } : {}), ...(arcsecPerPixel === undefined ? {} : { scalexy: arcsecPerPixel }),
    ...(wavelengthMicrometres === undefined ? {} : { wavemin: wavelengthMicrometres[0], wavemax: wavelengthMicrometres[1] }) };
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

const association = (programme: string, observation: string, setting: JwstBand, files: readonly string[]) => ({
  asn_type: 'spec3', asn_rule: setting.channel ? 'candidate_Asn_Lv3MIRMRS' : 'candidate_Asn_Lv3NRSIFU',
  program: programme.padStart(5, '0'), asn_id: 'o001', target: 't001', asn_pool: 'cssearth',
  products: [{ name: observation.replace(/_[a-z0-9]+-[a-z0-9]+$/u, ''), members: files.map(expname => ({ expname, exptype: 'science' })) }],
});

export function requestedSpectralGrid(cube: SpectralCube, request: readonly [number, number]) {
  const step = Number(cube.science.CDELT3), firstWavelength = cube.wavelength(0), lastWavelength = cube.wavelength(cube.planes - 1);
  if (!(step > 0) || request[0] < firstWavelength || request[1] > lastWavelength || !(request[0] < request[1]))
    throw new RangeError(`The requested ${request.join('–')} µm interval is outside the archive cube's ${firstWavelength}–${lastWavelength} µm spectral grid.`);
  const firstPlane = Math.floor((request[0] - firstWavelength) / step), lastPlane = Math.ceil((request[1] - firstWavelength) / step);
  const wavemin = cube.wavelength(firstPlane) - step / 2;
  // Keep the requested slice on the archive cube's exact plane centres. The tiny inward offset prevents floating-point
  // roundoff in cube_build's ceil(range / step) from adding an extra plane.
  const wavemax = wavemin + (lastPlane - firstPlane + 1 - 1e-7) * step;
  return { firstPlane, lastPlane, wavemin, wavemax, planes: lastPlane - firstPlane + 1 };
}

export async function runSpec3(id: string, band: string, work: string, options: { sources?: readonly string[]; maxRssBytes?: number; arcsecPerPixel?: number;
  wavelengthMicrometres?: readonly [number, number] } = {}) {
  const { program, entry, files } = await imagingMembers(id, band, resolve(work, 'members'), options.sources);
  if (entry.stage !== 'spec3') throw new Error(`${id} ${band} is not a cube band.`);
  const ceiling = options.maxRssBytes ?? 6 * 2 ** 30, free = freeMemoryPercent() / 100 * totalmem();
  if (!(free >= 2 * ceiling)) throw new Error(`Only ${(free / 2 ** 30).toFixed(1)} GiB of memory is free; the spec3 stage needs twice its ${(ceiling / 2 ** 30).toFixed(1)} GiB ceiling.`);
  const fine = options.arcsecPerPixel;
  if (fine !== undefined && !(fine >= 0.02 && fine <= 0.1)) throw new RangeError('A finer cube grid is between 0.02 and 0.1 arcsecond per pixel.');
  const setting = JWST_BANDS[band]!, toolchainPins = await eurekaPins(), toolchain = await eurekaToolchain(program.crdsContext);
  await assertCubeMembers(setting, files);

  // Run through outlier detection in its own process and pin every CRF. Exiting here releases the calibrated exposures and
  // outlier work arrays before cube_build opens the durable results.
  const crfOutput = resolve(work, 'spec3-crf'), crfRecordPath = resolve(crfOutput, 'spec3-crf.product.json');
  const crfSteps = { ...spec3Steps(setting), cube_build: { skip: true } };
  const crfRun = imagingProductRun(program, entry, 'spec3-crf', { steps: crfSteps }, toolchainPins);
  let crfRecord = await readProductRecord(crfRecordPath), crfPeak = 0, crfSeconds = 0;
  if (!await sameRun(crfRecord, crfRun, name => resolve(crfOutput, name))) {
    await rm(crfOutput, { recursive: true, force: true }); await mkdir(crfOutput, { recursive: true });
    const rawAssociation = resolve(work, `${entry.observation}_cal_asn.json`);
    await writeFile(rawAssociation, `${JSON.stringify(association(program.programme, entry.observation, setting, files), null, 2)}\n`);
    const result = await toolchainPython(toolchain, work, SPEC3_CRFS, [rawAssociation, crfOutput, JSON.stringify(crfSteps)],
      resolve(work, `${entry.observation}-crf.log`), { maxRssBytes: ceiling, progressLabel: 'JWST outlier detection' });
    const crfs = (await readdir(crfOutput)).filter(name => name.endsWith('_crf.fits')).sort();
    if (crfs.length !== files.length) throw new Error(`${id} ${band}: outlier detection wrote ${crfs.length} CRFs for ${files.length} exposures.`);
    crfRecord = await writeProductRecord(crfRecordPath, crfRun, crfs.map(name => ({ path: name, file: resolve(crfOutput, name) })));
    crfPeak = result.peakRssBytes; crfSeconds = Number(requireRecord(JSON.parse(result.lastLine), 'CRF result').seconds);
  }
  if (!crfRecord) throw new Error(`${id} ${band}: the CRF stage produced no product record.`);
  const crfs = crfRecord.outputs.map(output => resolve(crfOutput, output.path));

  // A requested interval is snapped to the exact plane centres of MAST's complete cube. The archive product is therefore an
  // explicit grid input to this stage; its science values remain comparison data, never reducer inputs.
  let cubeInterval = options.wavelengthMicrometres, archiveGridInput: ProductInput | undefined;
  if (options.wavelengthMicrometres) {
    const archivePath = await mastFile(entry.level3, work, options.sources), archiveCube = await openSpectralCube(archivePath);
    const grid = requestedSpectralGrid(archiveCube, options.wavelengthMicrometres);
    cubeInterval = [grid.wavemin, grid.wavemax];
    archiveGridInput = { role: 'spectral grid reference', identity: entry.level3.uri, ...(await sha256File(archivePath)) };
  }
  const steps = spec3Steps(setting, fine, cubeInterval), cubeSettings = steps.cube_build ?? {};
  const label = options.wavelengthMicrometres ? `-${options.wavelengthMicrometres.join('-')}` : '';
  const output = resolve(work, fine === undefined ? `spec3${label}` : `spec3${label}-${fine}`), crfAssociation = resolve(work, `${entry.observation}${label}_crf_asn.json`);
  const crfInputs: ProductInput[] = crfRecord.outputs.map(item => ({ role: 'outlier-corrected exposure', identity: `product:${id}/spec3-crf/${item.path}`, bytes: item.bytes }));
  const run: ProductRun = { telescope: 'JWST', stage: 'spec3-cube', inputs: [...crfInputs, ...(archiveGridInput ? [archiveGridInput] : [])],
    parameters: { program: program.id, band: entry.band, observation: entry.observation, crdsContext: program.crdsContext, steps,
      ...(options.wavelengthMicrometres ? { requestedWavelengthMicrometres: options.wavelengthMicrometres } : {}) },
    software: toolchainPins.software, toolchainDigest: toolchainPins.toolchainDigest };
  await mkdir(output, { recursive: true });
  const made = (await readdir(output).catch(() => [])).filter(name => name.endsWith('_s3d.fits'));
  if (made.length === 1) {
    const cube = resolve(output, made[0]!);
    if (await sameRun(await readProductRecord(productRecordPath(cube)), run, name => resolve(dirname(cube), name)))
      return { cube, reused: true, peakRssBytes: crfPeak, seconds: crfSeconds, members: files.length };
  }
  await rm(output, { recursive: true, force: true }); await mkdir(output, { recursive: true });
  await writeFile(crfAssociation, `${JSON.stringify(association(program.programme, entry.observation, setting, crfs), null, 2)}\n`);
  const result = await toolchainPython(toolchain, work, CUBE_BUILD, [crfAssociation, output, JSON.stringify(cubeSettings)],
    resolve(work, `${entry.observation}${label}${fine === undefined ? '' : `-${fine}`}-cube.log`), { maxRssBytes: ceiling, progressLabel: 'JWST cube build' });
  const cubes = (await readdir(output)).filter(name => name.endsWith('_s3d.fits'));
  if (cubes.length !== 1) throw new Error(`${id} ${band}: the stage wrote ${cubes.length} cubes.`);
  const cube = resolve(output, cubes[0]!);
  await writeProductRecord(productRecordPath(cube), run, [{ path: basename(cube), file: cube, ...(await level3ProductFacts(cube)) }]);
  return { cube, reused: false, peakRssBytes: Math.max(crfPeak, result.peakRssBytes), seconds: crfSeconds + Number(requireRecord(JSON.parse(result.lastLine), 'cube result').seconds), members: files.length };
}

const SPATIAL_GRID = ['CRPIX1', 'CRPIX2', 'CRVAL1', 'CRVAL2', 'CDELT1', 'CDELT2'] as const;

export function archivePlaneOffset(ours: SpectralCube, theirs: SpectralCube): number {
  const step = Number(theirs.science.CDELT3), sameSpatialGrid = ours.width === theirs.width && ours.height === theirs.height
    && SPATIAL_GRID.every(key => ours.science[key] === theirs.science[key]);
  if (!sameSpatialGrid || ours.science.CDELT3 !== theirs.science.CDELT3) throw new Error('The local cube is on a different spatial or spectral step from the archive cube.');
  const offset = Math.round((ours.wavelength(0) - theirs.wavelength(0)) / step), tolerance = Math.max(Math.abs(step) * 1e-6, 1e-10);
  if (offset < 0 || offset + ours.planes > theirs.planes || Math.abs(ours.wavelength(0) - theirs.wavelength(offset)) > tolerance
    || Math.abs(ours.wavelength(ours.planes - 1) - theirs.wavelength(offset + ours.planes - 1)) > tolerance)
    throw new Error('The local cube wavelength planes are not an aligned subset of the archive cube.');
  return offset;
}

export function cubeComparisonScope(ours: SpectralCube, theirs: SpectralCube, requested?: readonly [number, number]) {
  const offset = archivePlaneOffset(ours, theirs), endpoints = [ours.wavelength(0), ours.wavelength(ours.planes - 1)], low = Math.min(...endpoints), high = Math.max(...endpoints);
  if (requested && (!requested.every(Number.isFinite) || requested[0] > requested[1] || requested[0] < low || requested[1] > high)) throw new RangeError('The requested wavelength interval is not covered by the compared planes.');
  return { kind: offset === 0 && ours.planes === theirs.planes ? 'complete-cube' : requested ? 'requested-wavelength-slice' : 'aligned-spectral-subset',
    ...(requested ? { requestedWavelengthMicrometres: requested } : {}), archivePlanes: [offset, offset + ours.planes - 1] };
}

/** Compare a re-run cube with MAST's level-3 cube, and write the receipt. */
export async function compareCubeWithMast(id: string, band: string, local: string, downloads: string, sources: readonly string[] = [],
  requestedWavelengthMicrometres?: readonly [number, number]) {
  const { program } = await readImagingProgram(id), entry = program.bands.find(other => other.band === band);
  if (!entry || entry.stage !== 'spec3') throw new Error(`${id} has no cube band ${band}.`);
  const mastPath = await mastFile(entry.level3, downloads, sources), [theirs, ours] = await Promise.all([openSpectralCube(mastPath), openSpectralCube(local)]);
  if (bandOfHeader(theirs.primary)?.id !== band) throw new Error(`${entry.level3.name} is not a ${band} product.`);
  let archiveOffset: number;
  try { archiveOffset = archivePlaneOffset(ours, theirs); }
  catch { throw new Error(`${id} ${band}: the re-run cube is ${ours.width} × ${ours.height} × ${ours.planes} on a grid that is not an aligned subset of MAST's ${theirs.width} × ${theirs.height} × ${theirs.planes}.`); }
  const comparison = cubeComparisonScope(ours, theirs, requestedWavelengthMicrometres);
  const samples = await compareSamples(ours, theirs, archiveOffset);
  const acceptance = sampleAgreement(samples);
  const receipt = { schema: 'cssearth-jwst-spec3-reproduction@3', program: id, band, observation: entry.observation, toolchain: 'tools/objects/jwst/toolchain.json', crdsContext: program.crdsContext,
    mast: { ...entry.level3, sha256: (await sha256File(mastPath)).sha256, calVer: theirs.primary.CAL_VER, crdsContext: theirs.primary.CRDS_CTX }, local: { name: basename(local), ...(await sha256File(local)), calVer: ours.primary.CAL_VER, crdsContext: ours.primary.CRDS_CTX }, acceptance,
    comparison,
    grid: { width: ours.width, height: ours.height, planes: ours.planes, arcsecPerPixel: ours.arcsecPerPixel, micrometres: [ours.wavelength(0), ours.wavelength(ours.planes - 1)] }, samples };
  const path = resolve(PROGRAMS, `${id}.${band}.reproduction.json`);
  await writeFile(path, `${JSON.stringify(receipt, null, 2)}\n`);
  if (!acceptance.accepted) throw new Error(`Cube comparison did not meet ${acceptance.policy}; measurements retained at ${path}. No archive agreement was established.`);
  // Added to the record of the run that built this cube; a cube with no record beside it is refused, because nothing states
  // which exposures and pipeline made the file the samples were taken from.
  const scope = comparison.kind === 'complete-cube' ? `MAST's complete` : `the aligned spectral subset (archive planes ${comparison.archivePlanes.join('–')}) of MAST's`;
  const record = await recordProductEvidence(local, 'archive-agreement', path, `These level-2 exposures, this CRDS context and this pinned pipeline reproduce ${scope} ` +
    `level-3 cube of this observation, compared sample by sample on aligned wavelength planes; the receipt holds the coverage, the identical share and the correlation. It establishes that ` +
    `MAST's software was run the way MAST ran it, and nothing about the body the cube shows.`);
  const evidence = record.evidence.findLast(entry => entry.kind === 'archive-agreement')!;
  return { path: resolve(dirname(local), evidence.receipt), receipt, record };
}

/** Sample by sample over both cubes, a plane at a time: how many samples both cover, how many only one covers, how many are
 * bit-identical, their correlation, and the largest relative difference among samples above the median brightness. */
export async function compareSamples(ours: SpectralCube, theirs: SpectralCube, archivePlaneOffset = 0) {
  const bytes = ours.width * ours.height * 4, a = Buffer.alloc(bytes), b = Buffer.alloc(bytes), [fa, fb] = await Promise.all([open(ours.path, 'r'), open(theirs.path, 'r')]);
  const covered = (value: number) => Number.isFinite(value);
  try {
    const levels: number[] = [];
    for (let plane = 0; plane < ours.planes; plane += 50) { await fb.read(b, 0, bytes, theirs.sci.dataStart + (archivePlaneOffset + plane) * bytes); for (let i = 0; i < bytes; i += 4) { const value = b.readFloatBE(i); if (covered(value) && value !== 0) levels.push(Math.abs(value)); } }
    const median = levels.sort((p, q) => p - q)[levels.length >> 1] ?? 0;
    let both = 0, onlyOurs = 0, onlyMast = 0, identical = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0, largest = 0, maximumNormalizedDifference = 0;
    for (let plane = 0; plane < ours.planes; plane++) {
      await fa.read(a, 0, bytes, ours.sci.dataStart + plane * bytes); await fb.read(b, 0, bytes, theirs.sci.dataStart + (archivePlaneOffset + plane) * bytes);
      for (let i = 0; i < bytes; i += 4) {
        const x = a.readFloatBE(i), y = b.readFloatBE(i), hasX = covered(x), hasY = covered(y);
        if (!hasX || !hasY) { if (hasX) onlyOurs++; else if (hasY) onlyMast++; continue; }
        both++; if (x === y) identical++; sa += x; sb += y; saa += x * x; sbb += y * y; sab += x * y;
        const scale = Math.max(Math.abs(y), median), difference = Math.abs(x - y);
        maximumNormalizedDifference = Math.max(maximumNormalizedDifference, scale > 0 ? difference / scale : difference === 0 ? 0 : Number.MAX_VALUE);
        if (Math.abs(y) > median) largest = Math.max(largest, Math.abs(x / y - 1));
      }
    }
    return { both, onlyOurs, onlyMast, maximumNormalizedDifference, identicalShare: identical / both, correlation: both > 0 && identical === both ? 1 : (both * sab - sa * sb) / Math.sqrt((both * saa - sa * sa) * (both * sbb - sb * sb)), largestRelativeDifferenceAboveMedian: largest };
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
