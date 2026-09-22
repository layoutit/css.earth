#!/usr/bin/env node
/** Re-run AstroDrizzle on a re-calibrated exposure, with the settings the archive's own drizzled product records.
 *
 *   node tools/objects/hst/drizzle.mts <program id> <observation> <work directory> [--max-rss-gib <n>]
 *
 * This is not the instrument pipeline. `_drz` and `_drc` are made after it, by drizzlepac, from the `_flt`/`_flc` the pipeline
 * wrote; so the inputs here are the re-run's own products (calibrate.mts), and the settings are read from the archive's
 * product itself: `D001KERN`, `D001PIXF`, `D001SCAL`, `D001FVAL` and `D001OUUN` state the kernel, the drop size, the output
 * pixel scale, the fill value and the units of the run that made it. Only a product the archive drizzled from one image
 * (`NDRIZIM = 1`) is attempted, because a mosaic's grid comes from exposures this observation does not pin.
 *
 * Before drizzling, `stwcs.updatewcs` writes the distortion model into the exposure's WCS, which is what puts it on the sky;
 * the pipeline itself leaves the raw header's WCS in place. Whether that reproduces the archive's grid is the question the
 * receipt answers (docs/hubble.md).
 *
 * The sky is the archive's own too. Its calibrated exposure records what its drizzle subtracted, in `MDRIZSKY`; a run left to
 * estimate the sky for itself measures something else and shifts every pixel by it. Only a product whose exposure records no
 * subtracted sky is attempted, and it is drizzled with the sky step off.
 *
 * Beside every product it writes, the run writes its own record (`<product>.product.json`, tools/objects/product-record.mts):
 * what went in (this run's calibrated exposure, and the archive files whose headers stated the settings and the sky), the
 * settings themselves, the drizzlepac and CRDS versions the run reported, and the digest of the toolchain pins they were
 * installed from. Its evidence list is empty; compare.mts adds the agreement with the archive's own drizzled product. */
import { mkdir, readdir } from 'node:fs/promises';
import { totalmem } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireFiniteNumber, requireRecord, requireString } from '../../sources/source-values.mts';
import { mastFile } from '../astronomy-packages/mast.mts';
import { freeMemoryPercent, toolchainPython } from '../jwst/mast.mts';
import { fileSize, productRecordPath, writeProductRecord, type ProductInput, type ProductRun, type ProductSoftware } from '../product-record.mts';
import { suffixOf, type HstObservation, type HstProgram } from './archive.mts';
import { hstSoftware, hstToolchainDigest, MEMORY_GUARD, PIPELINES, readHstProgram, REFERENCE_FILES } from './calibrate.mts';
import { hstToolchain } from './toolchain.mts';
import { readHstFileHdus } from './product-file.mts';

const DRIZZLE = `
import json, os, subprocess, sys, threading, time
image, variable, context, ceiling, settings = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), json.loads(sys.argv[5])
files = [image]
${MEMORY_GUARD}
${REFERENCE_FILES}
start = time.time()
from stwcs import updatewcs
updatewcs.updatewcs(image)
from drizzlepac import astrodrizzle
astrodrizzle.AstroDrizzle(image, output=settings['output'], build=True, in_memory=False, clean=False, runfile='',
                          driz_separate=False, median=False, blot=False, driz_cr=False, skysub=False,
                          final_wcs=True, final_kernel=settings['kernel'], final_pixfrac=settings['pixfrac'],
                          final_scale=settings['scale'], final_fillval=settings['fillval'], final_units=settings['units'])
stop.set()
if stopped: raise SystemExit('AstroDrizzle passed its memory ceiling at %d bytes and was stopped.' % stopped[0])
import stwcs, drizzlepac
# What ran, for the product's own record: the packages that put the exposure on the sky and drizzled it, and CRDS.
software = [{'name': 'stwcs', 'version': stwcs.__version__}, {'name': 'drizzlepac', 'version': drizzlepac.__version__},
            {'name': 'crds', 'version': crds.__version__}]
print(json.dumps({'seconds': round(time.time() - start, 1), 'peakRssBytes': peak, 'references': references, 'software': software}))
`;

export interface DrizzleSettings { readonly output: string; readonly kernel: string; readonly pixfrac: number; readonly scale: number; readonly fillval: string; readonly units: string }
/** The sky the archive's own drizzle subtracted from an exposure, from that exposure's science header. */
export function archiveSky(header: Readonly<Record<string, unknown>>) {
  const sky = header.MDRIZSKY;
  if (typeof sky !== 'number') throw new Error('The archive\'s calibrated exposure does not record the sky its drizzle subtracted (MDRIZSKY).');
  if (sky !== 0) throw new Error(`The archive's drizzle subtracted a sky of ${sky}; reproducing that estimate is not attempted here.`);
  return sky;
}

/** How the archive drizzled its own product, from that product's own header. An `INDEF` fill value is drizzlepac's own word
 * for "leave it blank", and is passed on as written. */
export function drizzleSettings(header: Readonly<Record<string, unknown>>, output: string): DrizzleSettings {
  const images = header.NDRIZIM;
  if (images !== 1) throw new Error(`The archive drizzled ${String(images)} images into this product; only a single-image drizzle is attempted here.`);
  if (header.D001GEOM !== 'wcs') throw new Error(`The archive drizzled from ${String(header.D001GEOM)} geometry, which this run does not set.`);
  return { output, kernel: requireString(header.D001KERN, 'D001KERN').trim(), pixfrac: requireFiniteNumber(header.D001PIXF, 'D001PIXF'),
    scale: requireFiniteNumber(header.D001SCAL, 'D001SCAL'), fillval: requireString(header.D001FVAL, 'D001FVAL').trim(), units: requireString(header.D001OUUN, 'D001OUUN').trim() };
}

/** What identifies one drizzle: what went in (this run's calibrated exposure and the archive files its settings and sky were
 * read from), the settings themselves, and the software that ran. */
export function drizzleRun(program: HstProgram, entry: HstObservation, inputs: readonly ProductInput[], settings: DrizzleSettings, sky: number,
  software: readonly ProductSoftware[], toolchainDigest: string): ProductRun {
  return {
    telescope: 'HST', stage: 'drizzle', inputs,
    parameters: { instrument: entry.instrument, detector: entry.detector, opticalElement: entry.opticalElement, crdsContext: program.crdsContext,
      kernel: settings.kernel, pixfrac: settings.pixfrac, scale: settings.scale, fillval: settings.fillval, units: settings.units,
      distortionFromUpdatewcs: true, skySubtraction: 'off', archiveSky: sky, images: 1 },
    software, toolchainDigest,
  };
}

export async function runDrizzle(id: string, observation: string, work: string, options: { maxRssBytes?: number } = {}) {
  const { program } = await readHstProgram(id), entry = program.observations.find(other => other.observation === observation);
  if (!entry) throw new Error(`${id} has no observation ${observation}.`);
  const pipeline = PIPELINES[entry.instrument];
  if (!pipeline) throw new Error(`${entry.instrument} has no pipeline here.`);
  const drizzled = entry.products.filter(product => ['DRZ', 'DRC'].includes(suffixOf(product.name)));
  if (!drizzled.length) throw new Error(`${observation}: the archive made no drizzled product.`);
  const ceiling = options.maxRssBytes ?? 2 * 2 ** 30, free = freeMemoryPercent() / 100 * totalmem();
  if (!(free >= 2 * ceiling)) throw new Error(`Only ${(free / 2 ** 30).toFixed(1)} GiB of memory is free; the drizzle needs twice its ${(ceiling / 2 ** 30).toFixed(1)} GiB ceiling.`);
  const run = resolve(work, 'run'), output = resolve(work, 'drizzle');
  await mkdir(output, { recursive: true });
  const results: { product: string; local: string; record: string; archiveSky: number; seconds: number; peakRssBytes: number; versions: Record<string, string> }[] = [];
  for (const product of drizzled) {
    // A `_drc` is drizzled from the CTE-corrected exposure, a `_drz` from the plain one.
    const suffix = suffixOf(product.name) === 'DRC' ? 'flc' : 'flt';
    const name = `${product.name.slice(0, product.name.lastIndexOf('_'))}_${suffix}.fits`, image = resolve(run, name);
    if (!(await readdir(run)).includes(name)) throw new Error(`${product.name}: ${image} is not in the run; calibrate first.`);
    const theirs = await mastFile(product, resolve(work, 'mast'));
    const settings = drizzleSettings((await readHstFileHdus(theirs))[0]!.header, product.name.replace(/\.fits$/u, ''));
    // The archive's own calibrated exposure says what sky its drizzle removed; the run is only attempted where that is none.
    const exposure = entry.products.find(other => other.name === name);
    if (!exposure) throw new Error(`${product.name}: the archive's own ${suffix} exposure is not pinned.`);
    const theirExposure = await mastFile(exposure, resolve(work, 'mast'));
    const sky = archiveSky((await readHstFileHdus(theirExposure)).find(hdu => hdu.header.EXTNAME === 'SCI')!.header);
    const toolchain = await hstToolchain(program.crdsContext);
    const result = await toolchainPython(toolchain, output, DRIZZLE, [image, pipeline.referenceVariable, program.crdsContext, String(ceiling), JSON.stringify(settings)],
      resolve(work, `${product.name}.drizzle.log`), { maxRssBytes: ceiling });
    const reported = requireRecord(JSON.parse(result.lastLine), 'drizzle result');
    const software = hstSoftware(reported.software);
    // What went in, each at the bytes this run read: our own exposure, and the archive files its settings and sky came from.
    const inputs: ProductInput[] = [
      { role: 'calibrated exposure, this run\'s own product', identity: name, ...await fileSize(image) },
      { role: 'archive drizzled product, read for the settings of the run that made it', identity: product.uri, ...await fileSize(theirs) },
      { role: 'archive calibrated exposure, read for the sky its drizzle subtracted', identity: exposure.uri, ...await fileSize(theirExposure) },
    ];
    const made = drizzleRun(program, entry, inputs, settings, sky, software, await hstToolchainDigest());
    await writeProductRecord(productRecordPath(resolve(output, product.name)), made, [{ path: product.name, file: resolve(output, product.name), units: settings.units,
      conventions: { grid: 'the archive product\'s own drizzle grid, from its D001 cards', pixels: `${settings.scale}" a pixel, ${settings.kernel} kernel, pixfrac ${settings.pixfrac}`,
        sky: 'none subtracted; the archive\'s own exposure records MDRIZSKY 0' } }]);
    results.push({ product: product.name, local: resolve(output, product.name), record: productRecordPath(product.name), archiveSky: sky,
      seconds: requireFiniteNumber(reported.seconds, 'seconds'),
      peakRssBytes: Math.max(requireFiniteNumber(reported.peakRssBytes, 'peak RSS'), result.peakRssBytes),
      versions: Object.fromEntries(software.map(entry => [entry.name, entry.version])) });
  }
  return { output, results };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), [id, observation, work] = args;
  if (!id || !observation || !work) throw new TypeError('Usage: drizzle <program id> <observation> <work> [--max-rss-gib <n>]');
  const ceiling = args.flatMap((arg, i) => arg === '--max-rss-gib' ? [args[i + 1]!] : [])[0];
  const { results } = await runDrizzle(id, observation, resolve(work), ceiling ? { maxRssBytes: Number(ceiling) * 2 ** 30 } : {});
  for (const result of results) console.log(`DRIZZLE ${JSON.stringify({ ...result, peakRssGiB: +(result.peakRssBytes / 2 ** 30).toFixed(2) })}`);
}
