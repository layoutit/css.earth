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
 * 2.3 GiB). A program's `image3` block sets stage parameters beyond the CRDS defaults, the ones MAST's operations used. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { totalmem } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sha256File } from '../../../../src/platform/sha256.mts';
import { requireRecord } from '../../../source-values.mts';
import { eurekaToolchain } from '../toolchain.mts';
import { freeMemoryPercent, mastFile, toolchainPython, type MastFile } from '../mast.mts';
import { parseImagingProgram, PROGRAMS, type ImagingProgram } from './archive.mts';
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

/** Members on disk at their pinned sizes and digests; digests missing from the program are measured and written back. */
export async function imagingMembers(id: string, band: string, directory: string, sources: readonly string[] = []) {
  const { path, program } = await readImagingProgram(id), entry = program.bands.find(other => other.band === band);
  if (!entry) throw new Error(`${id} has no ${band} band.`);
  const files: string[] = [], members: MastFile[] = [];
  for (const member of entry.members) {
    const local = await mastFile(member, directory, sources);
    files.push(local);
    members.push(member.sha256 === undefined ? { ...member, sha256: (await sha256File(local)).sha256 } : member);
  }
  if (members.some((member, i) => member.sha256 !== entry.members[i]!.sha256)) {
    const updated: ImagingProgram = { ...program, bands: program.bands.map(other => other.band === band ? { ...other, members } : other) };
    await writeFile(path, `${JSON.stringify(updated, null, 2)}\n`);
  }
  return { program, entry, files };
}

export async function runImage3(id: string, band: string, work: string, options: { grid?: SkyGrid; sources?: readonly string[]; maxRssBytes?: number } = {}) {
  const { program, entry, files } = await imagingMembers(id, band, resolve(work, 'members'), options.sources);
  // The stage runs under its own ceiling, so it needs that ceiling free twice over, not half the machine.
  const ceiling = options.maxRssBytes ?? 3 * 2 ** 30, free = freeMemoryPercent() / 100 * totalmem();
  if (!(free >= 2 * ceiling)) throw new Error(`Only ${(free / 2 ** 30).toFixed(1)} GiB of memory is free; the image3 stage needs twice its ${(ceiling / 2 ** 30).toFixed(1)} GiB ceiling.`);
  const product = options.grid ? `${entry.observation}_grid` : entry.observation, output = resolve(work, 'image3');
  await mkdir(output, { recursive: true });
  const asn = resolve(work, `${product}_asn.json`);
  await writeFile(asn, `${JSON.stringify({ asn_type: 'image3', asn_rule: 'candidate_Asn_Lv3Image', program: program.programme.padStart(5, '0'),
    asn_id: 'o001', target: 't001', asn_pool: 'cssearth', products: [{ name: product, members: files.map(expname => ({ expname, exptype: 'science' })) }] }, null, 2)}\n`);
  const toolchain = await eurekaToolchain(program.crdsContext);
  const result = await toolchainPython(toolchain, work, IMAGE3, [asn, output, JSON.stringify(options.grid ? gridResample(options.grid) : null), JSON.stringify(program.image3 ?? {})],
    resolve(work, `${product}.log`), { maxRssBytes: ceiling });
  const seconds = requireRecord(JSON.parse(result.lastLine), 'image3 result').seconds;
  return { mosaic: resolve(output, `${product}_i2d.fits`), peakRssBytes: result.peakRssBytes, seconds, members: files.length };
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
