#!/usr/bin/env node
/** Re-run the JWST pipeline's level-3 imaging stage (calwebb_image3) for one band of a pinned imaging program.
 *
 *   node tools/objects/jwst/imaging/image3.mts <program id> <band> <work directory> [--grid <sky band recipe.json>] [--raw <dir>]...
 *     [--max-rss-gib <n>]
 *
 * The members are the level-2 calibrated exposures the program pins from MAST's own image3 association, taken from a --raw
 * directory that already holds them or downloaded; each digest is recorded in the program the first time. The stage runs on
 * the pinned toolchain (toolchain.json: jwst 2.0.1) with the program's CRDS context and the parameter reference files that
 * context selects, which are the settings MAST ran. Without --grid the mosaic is the pipeline's own, the reproduction of MAST's
 * level-3 product (compare.mts checks it). With --grid the resample step writes straight onto that recipe's TAN grid, north up
 * at its pixel scale, so the mosaic is resampled once rather than drizzled by MAST and resampled again. The source catalogue is
 * skipped. The run is stopped if its resident memory passes the ceiling (default 3 GiB; eight NIRCam long-wave exposures peak at
 * 2.3 GiB). A program's `image3` block sets stage parameters beyond the CRDS defaults, the ones MAST's operations used.
 *
 * The run writes a `cssearth-telescope-product@1` record beside the mosaic (`<mosaic>.product.json`): the exposures at their
 * pinned digests, the settings and CRDS context, the pinned pipeline, and the mosaic with the units and conventions its own
 * header states. Its evidence list starts empty; compare.mts adds the archive agreement it establishes. A mosaic whose record
 * says this same run made it is not made again. */
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { totalmem } from 'node:os';
import { basename, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sha256File } from '@cssearth/core/node';
import { readFitsFileHdus } from '@cssearth/fits/node';
import { requireRecord, requireString } from '@cssearth/core';
import { addProductEvidence, productRecordPath, readProductRecord, sameRun, writeProductRecord,
  type EvidenceKind, type ProductInput, type ProductRun, type ProductSoftware } from '../../product-record.mts';
import { EUREKA_ROOT, eurekaToolchain } from '../toolchain.mts';
import { freeMemoryPercent, mastFile, toolchainPython, type MastFile } from '../mast.mts';
import { parseImagingProgram, PROGRAMS, type ImagingBand, type ImagingProgram } from './archive.mts';
import { gridWcs, parseSkyGrid, type SkyGrid } from '../../observation/wise-atlas-mosaic.mts';

const IMAGE3 = `
import json, sys, time
from jwst.pipeline import Image3Pipeline
asn, output_dir, grid, parameters = sys.argv[1], sys.argv[2], json.loads(sys.argv[3]), json.loads(sys.argv[4])
start = time.time()
resample = {'in_memory': False}
if grid:
    resample.update({'output_shape': grid['shape'], 'crpix': grid['crpix'], 'crval': grid['crval'], 'rotation': 0.0, 'pixel_scale': grid['pixelScaleArcsec']})
# The exposure library stays on disk and each step keeps its intermediates there, so memory follows one exposure, not all.
steps = {'resample': resample, 'outlier_detection': {'in_memory': False}, 'source_catalog': {'skip': True}}
for step, values in parameters.items(): steps.setdefault(step, {}).update(values)
Image3Pipeline.call(asn, output_dir=output_dir, save_results=True, in_memory=False, steps=steps)
print(json.dumps({'seconds': round(time.time() - start, 1)}))
`;

/** The resample parameters that put the mosaic on a sky band recipe's grid: the grid's 1-based CRPIX becomes the stage's
 * 0-based crpix. */
export function gridResample(grid: SkyGrid) {
  const wcs = gridWcs(grid);
  return { shape: [grid.width, grid.height], crpix: [wcs.referencePixel[0] - 1, wcs.referencePixel[1] - 1], crval: [...wcs.referenceValueDeg],
    pixelScaleArcsec: Math.abs(wcs.scaleDeg[1]) * 3600 };
}

export async function readImagingProgram(id: string) {
  const path = resolve(PROGRAMS, `${id}.json`);
  return { path, program: parseImagingProgram(JSON.parse(await readFile(path, 'utf8'))) };
}

/** Members (and a coron3 band's PSF references) on disk at their pinned sizes and digests; digests missing from the program are
 * measured and written back. */
export async function imagingMembers(id: string, band: string, directory: string, sources: readonly string[] = []) {
  const { path, program } = await readImagingProgram(id), entry = program.bands.find(other => other.band === band);
  if (!entry) throw new Error(`${id} has no ${band} band.`);
  const fetchAll = async (pinned: readonly MastFile[]) => {
    const files: string[] = [], digested: MastFile[] = [];
    for (const member of pinned) {
      const local = await mastFile(member, directory, sources);
      files.push(local);
      digested.push(member.sha256 === undefined ? { ...member, sha256: (await sha256File(local)).sha256 } : member);
    }
    return { files, digested, changed: digested.some((member, i) => member.sha256 !== pinned[i]!.sha256) };
  };
  const members = await fetchAll(entry.members), references = await fetchAll(entry.references ?? []);
  const digested: ImagingBand = { ...entry, members: members.digested, ...(entry.references ? { references: references.digested } : {}) };
  if (members.changed || references.changed) {
    const updated: ImagingProgram = { ...program, bands: program.bands.map(other => other.band === band ? digested : other) };
    await writeFile(path, `${JSON.stringify(updated, null, 2)}\n`);
  }
  // The band is returned with every member digested, so a stage records what it was actually given and not what the program
  // happened to hold before the first download.
  return { program, entry: digested, files: members.files, references: references.files };
}

/** The pipeline packages whose versions decide a level-3 product, as the toolchain lock pins them. `eurekaToolchain` refuses an
 * environment installed from any other pins, so these are the versions a run had; `toolchainDigest` covers the whole lock. */
export function pipelineSoftware(lock: string): readonly ProductSoftware[] {
  const pinned = new Map(lock.split('\n').map(line => line.trim().split('==')).flatMap(([name, version]) => name && version ? [[name, version] as const] : []));
  if (!pinned.has('jwst')) throw new TypeError('The toolchain lock pins no jwst pipeline version.');
  return ['jwst', 'stcal', 'stpipe', 'stdatamodels', 'drizzle'].flatMap(name => { const version = pinned.get(name); return version ? [{ name, version }] : []; });
}

/** The pins the environment a stage runs on was installed from: toolchain.mts writes them at install, and `eurekaToolchain`
 * has already refused an environment built from others by the time a stage gets here. */
export async function eurekaPins(): Promise<{ toolchainDigest: string; software: readonly ProductSoftware[] }> {
  const installed = await readFile(resolve(EUREKA_ROOT, 'installed.json'), 'utf8')
    .catch(() => { throw new Error('Eureka! is not installed: node tools/objects/jwst/toolchain.mts install'); });
  const marker = requireRecord(JSON.parse(installed) as unknown, 'installed.json');
  return { toolchainDigest: requireString(marker.pinsSha256, 'installed pins sha256'), software: pipelineSoftware(await readFile(resolve(import.meta.dirname, '../requirements.lock'), 'utf8')) };
}

/** What identifies one level-3 run of a pinned program band: the exposures it was given at their pinned digests, the settings
 * that are not the CRDS defaults, and the pipeline it ran on. The same three make the same product, so the record this run
 * writes beside its output is what says whether that output can be reused (`sameRun`). */
export function imagingProductRun(program: ImagingProgram, entry: ImagingBand, stage: string, parameters: Readonly<Record<string, unknown>>,
  toolchain: { toolchainDigest: string; software: readonly ProductSoftware[] }): ProductRun {
  const pin = (role: string) => (member: MastFile): ProductInput => {
    if (member.sha256 === undefined) throw new TypeError(`${member.name} has no digest; a member is digested when it is fetched.`);
    return { role, identity: member.uri, bytes: member.bytes };
  };
  return { telescope: 'JWST', stage, inputs: [...entry.members.map(pin('level-2 exposure')), ...(entry.references ?? []).map(pin('level-2 PSF reference'))],
    parameters: { program: program.id, band: entry.band, observation: entry.observation, crdsContext: program.crdsContext, ...parameters },
    software: toolchain.software, toolchainDigest: toolchain.toolchainDigest };
}

/** The units and conventions a level-3 product states in its own SCI header: what a reader needs to use its numbers. */
export async function level3ProductFacts(path: string): Promise<{ units: string; conventions: Record<string, string> }> {
  const hdus = await readFitsFileHdus(path), sci = hdus.find(hdu => hdu.header.EXTNAME === 'SCI');
  if (!sci || typeof sci.header.BUNIT !== 'string') throw new Error(`${path} has no SCI extension stating BUNIT.`);
  const axes = ['CTYPE1', 'CTYPE2', 'CTYPE3'].flatMap(key => typeof sci.header[key] === 'string' ? [sci.header[key]] : []);
  return { units: sci.header.BUNIT, conventions: { axes: axes.join(', '), referencePixel: 'FITS CRPIX, 1-based, at CRVAL',
    frame: typeof sci.header.RADESYS === 'string' ? sci.header.RADESYS : 'ICRS', ...(typeof sci.header.CUNIT3 === 'string' ? { thirdAxisUnit: sci.header.CUNIT3 } : {}) } };
}


/** Add what a check established to the record the stage that made the product wrote beside it. A product with no record is
 * refused: nothing states what made that file, so nothing can be said about what checking it establishes. */
export const recordProductEvidence = (product: string, kind: EvidenceKind, receipt: string, establishes: string) =>
  addProductEvidence(productRecordPath(product), [{ kind, receipt: resolve(receipt), product: basename(product), establishes }],
    recorded => resolve(dirname(product), recorded));

export async function runImage3(id: string, band: string, work: string, options: { grid?: SkyGrid; sources?: readonly string[]; maxRssBytes?: number } = {}) {
  const { program, entry, files } = await imagingMembers(id, band, resolve(work, 'members'), options.sources);
  if (entry.stage) throw new Error(`${id} ${band} is built by ${entry.stage}, not image3.`);
  // The stage runs under its own ceiling, so it needs that ceiling free twice over, not half the machine.
  const ceiling = options.maxRssBytes ?? 3 * 2 ** 30, free = freeMemoryPercent() / 100 * totalmem();
  if (!(free >= 2 * ceiling)) throw new Error(`Only ${(free / 2 ** 30).toFixed(1)} GiB of memory is free; the image3 stage needs twice its ${(ceiling / 2 ** 30).toFixed(1)} GiB ceiling.`);
  const product = options.grid ? `${entry.observation}_grid` : entry.observation, output = resolve(work, 'image3');
  await mkdir(output, { recursive: true });
  const mosaic = resolve(output, `${product}_i2d.fits`), recordPath = productRecordPath(mosaic);
  const grid = options.grid ? gridResample(options.grid) : null;
  const run = imagingProductRun(program, entry, 'image3', { image3: program.image3 ?? {}, grid, sourceCatalog: 'skipped', inMemory: false }, await eurekaPins());
  // A mosaic of eight long-wave exposures takes half an hour. It is reused only when the record beside it says these same
  // exposures, settings and pipeline made it, and the file is still the one that run wrote; anything else runs the stage again.
  if (await sameRun(await readProductRecord(recordPath), run, name => resolve(dirname(mosaic), name))) return { mosaic, reused: true, peakRssBytes: 0, seconds: 0, members: files.length };
  await rm(recordPath, { force: true });
  const asn = resolve(work, `${product}_asn.json`);
  await writeFile(asn, `${JSON.stringify({ asn_type: 'image3', asn_rule: 'candidate_Asn_Lv3Image', program: program.programme.padStart(5, '0'),
    asn_id: 'o001', target: 't001', asn_pool: 'cssearth', products: [{ name: product, members: files.map(expname => ({ expname, exptype: 'science' })) }] }, null, 2)}\n`);
  const toolchain = await eurekaToolchain(program.crdsContext);
  const result = await toolchainPython(toolchain, work, IMAGE3, [asn, output, JSON.stringify(grid), JSON.stringify(program.image3 ?? {})],
    resolve(work, `${product}.log`), { maxRssBytes: ceiling });
  const seconds = requireRecord(JSON.parse(result.lastLine), 'image3 result').seconds;
  await writeProductRecord(recordPath, run, [{ path: basename(mosaic), file: mosaic, ...(await level3ProductFacts(mosaic)) }]);
  return { mosaic, reused: false, peakRssBytes: result.peakRssBytes, seconds, members: files.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), [id, band, work] = args;
  const option = (name: string) => args.flatMap((arg, i) => arg === name ? [args[i + 1]!] : []);
  if (!id || !band || !work) throw new TypeError('Usage: image3 <program id> <band> <work> [--grid <recipe.json>] [--raw <dir>]... [--max-rss-gib <n>]');
  const gridPath = option('--grid')[0], ceiling = option('--max-rss-gib')[0];
  const grid = gridPath ? parseSkyGrid(requireRecord(JSON.parse(await readFile(gridPath, 'utf8'))).grid) : undefined;
  const result = await runImage3(id, band, resolve(work), { ...(grid ? { grid } : {}), sources: option('--raw').map(dir => resolve(dir)),
    ...(ceiling ? { maxRssBytes: Number(ceiling) * 2 ** 30 } : {}) });
  console.log(`IMAGE3 ${JSON.stringify({ ...result, peakRssGiB: +(result.peakRssBytes / 2 ** 30).toFixed(2) })}`);
}
