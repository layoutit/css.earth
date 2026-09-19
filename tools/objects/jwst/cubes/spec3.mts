#!/usr/bin/env node
/** Re-run the JWST pipeline's level-3 spectroscopy stage (calwebb_spec3) for one cube band of a pinned imaging program, and
 * check the cube against MAST's.
 *
 *   node tools/objects/jwst/cubes/spec3.mts <program id> <band> <work directory> [--raw <dir>]... [--max-rss-gib <n>] [--arcsec-per-pixel <n>]
 *
 * The members are the level-2 _cal exposures MAST's own spec3 association names (imaging/archive.mts): both detectors at each
 * dither. The stage flags outliers between the dithers and builds the cube (cube_build), on the pinned toolchain
 * (toolchain.json: jwst 2.0.1) with the program's CRDS context. The one-dimensional extraction that follows is skipped: it reads
 * the cube and does not change it. The run is stopped if its resident memory passes the ceiling (default 6 GiB; four NIRSpec
 * G395H exposures peak at 4.1 GiB).
 *
 * The cube is then compared with MAST's level-3 cube sample by sample, and a receipt is written beside the program. The two are
 * on one grid or the comparison fails: a cube's grid follows from its members alone.
 *
 * --arcsec-per-pixel builds the cube on a finer sky grid than the pipeline's 0.1 arcsecond instead. That cube has no MAST twin, so
 * it is not compared; run the default first, so the receipt shows these exposures and this toolchain reproduce MAST's cube. */
import { mkdir, readdir, writeFile, open } from 'node:fs/promises';
import { totalmem } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sha256File } from '../../../../src/platform/sha256.mts';
import { requireRecord } from '../../../source-values.mts';
import { eurekaToolchain } from '../toolchain.mts';
import { freeMemoryPercent, mastFile, toolchainPython } from '../mast.mts';
import { PROGRAMS } from '../imaging/archive.mts';
import { bandOfHeader } from '../imaging/bands.mts';
import { imagingMembers, readImagingProgram } from '../imaging/image3.mts';
import { openSpectralCube, type SpectralCube } from './spectral-cube.mts';

const SPEC3 = `
import json, sys, time
from jwst.pipeline import Spec3Pipeline
start = time.time()
steps = {'extract_1d': {'skip': True}}
if len(sys.argv) > 3:
    # A finer sky grid than the pipeline's default. The dithers sample the sky between the default pixels, so the drizzle has
    # real information to put there; the wavelength axis is left as the pipeline sets it.
    steps['cube_build'] = {'scalexy': float(sys.argv[3])}
Spec3Pipeline.call(sys.argv[1], output_dir=sys.argv[2], save_results=True, steps=steps)
print(json.dumps({'seconds': round(time.time() - start, 1)}))
`;

export async function runSpec3(id: string, band: string, work: string, options: { sources?: readonly string[]; maxRssBytes?: number; arcsecPerPixel?: number } = {}) {
  const { program, entry, files } = await imagingMembers(id, band, resolve(work, 'members'), options.sources);
  if (entry.stage !== 'spec3') throw new Error(`${id} ${band} is not a cube band.`);
  const ceiling = options.maxRssBytes ?? 6 * 2 ** 30, free = freeMemoryPercent() / 100 * totalmem();
  if (!(free >= 2 * ceiling)) throw new Error(`Only ${(free / 2 ** 30).toFixed(1)} GiB of memory is free; the spec3 stage needs twice its ${(ceiling / 2 ** 30).toFixed(1)} GiB ceiling.`);
  const fine = options.arcsecPerPixel;
  if (fine !== undefined && !(fine >= 0.02 && fine <= 0.1)) throw new RangeError('A finer cube grid is between 0.02 and 0.1 arcsecond per pixel.');
  const output = resolve(work, fine === undefined ? 'spec3' : `spec3-${fine}`), asn = resolve(work, `${entry.observation}_asn.json`);
  await mkdir(output, { recursive: true });
  // The stage names its product after the grating and filter itself, so the association's product stops at the instrument.
  await writeFile(asn, `${JSON.stringify({ asn_type: 'spec3', asn_rule: 'candidate_Asn_Lv3NRSIFU', program: program.programme.padStart(5, '0'), asn_id: 'o001', target: 't001', asn_pool: 'cssearth',
    products: [{ name: entry.observation.replace(/_[a-z0-9]+-[a-z0-9]+$/u, ''), members: files.map(expname => ({ expname, exptype: 'science' })) }] }, null, 2)}\n`);
  const toolchain = await eurekaToolchain(program.crdsContext);
  const result = await toolchainPython(toolchain, work, SPEC3, [asn, output, ...(fine === undefined ? [] : [String(fine)])], resolve(work, `${entry.observation}${fine === undefined ? '' : `-${fine}`}.log`), { maxRssBytes: ceiling });
  const cubes = (await readdir(output)).filter(name => name.endsWith('_s3d.fits'));
  if (cubes.length !== 1) throw new Error(`${id} ${band}: the stage wrote ${cubes.length} cubes.`);
  return { cube: resolve(output, cubes[0]!), peakRssBytes: result.peakRssBytes, seconds: requireRecord(JSON.parse(result.lastLine), 'spec3 result').seconds, members: files.length };
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
  return { path, receipt };
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
