#!/usr/bin/env node
/** Image restored ALMA visibilities the way a paper says it imaged them.
 *
 *   node tools/objects/interferometry/alma-published-imaging.mts <recipe.json> --scratch <dir> --out <image base>
 *
 * `alma-restore.mts` reproduces the archive's own image, which checks the restore. A paper often images the same visibilities
 * differently (natural weighting to bring out a faint, extended ring, multiscale CLEAN, a hand-drawn mask), and it is the
 * paper's image that a reader knows. The recipe (`cssearth-alma-imaging-recipe@1`) records each choice the paper states,
 * with its locator, and keeps apart what the paper describes without numbers — a mask's size, the pixel grid — which this
 * route has to choose and says it chose. The measurement sets are the target splits `alma-restore.mts --split-only` wrote.
 *
 * After imaging, the beam and the noise are measured on the result and reported beside the paper's own values, so a recipe
 * that does not reproduce the paper's image says so instead of standing in for it. */
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { toolchainPath } from './toolchain.mts';

export interface ImagingRecipe {
  readonly citation: { readonly text: string; readonly url: string; readonly locator: string };
  readonly measurementSets: readonly string[];
  readonly field: string;
  readonly spw: string;
  readonly weighting: 'natural' | 'uniform' | 'briggs';
  readonly robust?: number;
  readonly deconvolver: 'hogbom' | 'clark' | 'multiscale';
  /** Multiscale CLEAN's scales, in arcseconds as papers state them; converted to pixels of `cell`. */
  readonly scalesArcsec?: readonly number[];
  readonly threshold: string;
  readonly gridder: 'standard' | 'mosaic';
  readonly cellArcsec: number;
  readonly imageSize: readonly [number, number];
  readonly phaseCentre: string;
  readonly pblimit: number;
  /** CASA region text (CRTF) for each mask region, and where each size comes from. */
  readonly mask: { readonly regions: readonly string[]; readonly source: string };
  /** What the route chose because the paper does not say, one sentence each. */
  readonly chosen: readonly string[];
  /** The paper's own measurements of its image, reported beside ours after imaging. */
  readonly published: { readonly beamArcsec: readonly [number, number]; readonly beamPositionAngleDeg: number; readonly noiseMicroJyPerBeam: number };
}

const record = (value: unknown, at: string): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError(`${at} is an object.`);
  return value as Record<string, unknown>;
};
const text = (value: unknown, at: string): string => {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${at} is a non-empty string, not ${JSON.stringify(value)}.`);
  return value;
};
const finite = (value: unknown, at: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${at} is a finite number, not ${JSON.stringify(value)}.`);
  return value;
};
const list = <T,>(value: unknown, at: string, item: (entry: unknown, at: string) => T): T[] => {
  if (!Array.isArray(value) || !value.length) throw new TypeError(`${at} is a non-empty list.`);
  return value.map((entry, index) => item(entry, `${at}[${index}]`));
};
const oneOf = <T extends string>(value: unknown, at: string, options: readonly T[]): T => {
  if (!options.includes(value as T)) throw new TypeError(`${at} is one of ${options.join(', ')}, not ${JSON.stringify(value)}.`);
  return value as T;
};

/** Validate a recipe down to every value the script uses. */
export function parseImagingRecipe(value: unknown): ImagingRecipe {
  const input = record(value, 'recipe');
  if (input.schema !== 'cssearth-alma-imaging-recipe@1') throw new TypeError(`recipe.schema is cssearth-alma-imaging-recipe@1, not ${JSON.stringify(input.schema)}.`);
  const citation = record(input.citation, 'recipe.citation'), mask = record(input.mask, 'recipe.mask'), published = record(input.published, 'recipe.published');
  const deconvolver = oneOf(input.deconvolver, 'recipe.deconvolver', ['hogbom', 'clark', 'multiscale'] as const);
  const weighting = oneOf(input.weighting, 'recipe.weighting', ['natural', 'uniform', 'briggs'] as const);
  const size = list(input.imageSize, 'recipe.imageSize', finite);
  if (size.length !== 2 || size.some(n => !Number.isInteger(n) || n < 16)) throw new TypeError('recipe.imageSize is two whole pixel counts of 16 or more.');
  const beam = list(published.beamArcsec, 'recipe.published.beamArcsec', finite);
  if (beam.length !== 2) throw new TypeError('recipe.published.beamArcsec is the major and minor axis.');
  if (deconvolver === 'multiscale' && input.scalesArcsec === undefined) throw new TypeError('A multiscale recipe states its scales (recipe.scalesArcsec).');
  if (weighting === 'briggs' && input.robust === undefined) throw new TypeError('A briggs recipe states its robust value.');
  return {
    citation: { text: text(citation.text, 'recipe.citation.text'), url: text(citation.url, 'recipe.citation.url'), locator: text(citation.locator, 'recipe.citation.locator') },
    measurementSets: list(input.measurementSets, 'recipe.measurementSets', text), field: text(input.field, 'recipe.field'), spw: text(input.spw, 'recipe.spw'),
    weighting, ...(input.robust === undefined ? {} : { robust: finite(input.robust, 'recipe.robust') }), deconvolver,
    ...(input.scalesArcsec === undefined ? {} : { scalesArcsec: list(input.scalesArcsec, 'recipe.scalesArcsec', finite) }),
    threshold: text(input.threshold, 'recipe.threshold'), gridder: oneOf(input.gridder, 'recipe.gridder', ['standard', 'mosaic'] as const),
    cellArcsec: finite(input.cellArcsec, 'recipe.cellArcsec'), imageSize: [size[0]!, size[1]!], phaseCentre: text(input.phaseCentre, 'recipe.phaseCentre'),
    pblimit: finite(input.pblimit, 'recipe.pblimit'),
    mask: { regions: list(mask.regions, 'recipe.mask.regions', text), source: text(mask.source, 'recipe.mask.source') },
    chosen: list(input.chosen, 'recipe.chosen', text),
    published: { beamArcsec: [beam[0]!, beam[1]!], beamPositionAngleDeg: finite(published.beamPositionAngleDeg, 'recipe.published.beamPositionAngleDeg'),
      noiseMicroJyPerBeam: finite(published.noiseMicroJyPerBeam, 'recipe.published.noiseMicroJyPerBeam') },
  };
}

const python = (value: string) => `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;

/** The CASA script: tclean as the recipe states, then the image as the paper shows it (not corrected for the primary beam, so
 * the noise is even), the corrected image, the primary beam and the mask, each exported to FITS, and the measured beam and
 * noise written beside them. */
export function publishedImagingScript(recipe: ImagingRecipe, options: { readonly scratch: string; readonly out: string }) {
  const imaged = `${options.scratch}/${options.out.split('/').at(-1)}`;
  const scales = (recipe.scalesArcsec ?? []).map(scale => Math.round(scale / recipe.cellArcsec));
  const vis = recipe.measurementSets.map(name => python(`${options.scratch}/${name}`)).join(', ');
  return [
    'import os, sys, json, shutil, glob',
    'import numpy as np',
    'from casatasks import tclean, exportfits, casalog',
    'from casatools import image',
    `casalog.setlogfile(${python(`${options.out}.casa.log`)})`,
    `missing = [vis for vis in [${vis}] if not os.path.exists(vis + '.ready')]`,
    "if missing: sys.exit('Restore these executions first (alma-restore.mts --split-only): ' + ', '.join(missing))",
    // tclean continues from any model it finds under its image name, so the previous run's images go first.
    `for product in glob.glob(${python(`${imaged}.*`)}):`,
    '    if os.path.isdir(product): shutil.rmtree(product)',
    `tclean(vis=[${vis}], field=${python(recipe.field)}, spw=${python(recipe.spw)}, datacolumn='data', imagename=${python(imaged)},` +
      ` specmode='mfs', gridder=${python(recipe.gridder)}, deconvolver=${python(recipe.deconvolver)},` +
      `${recipe.deconvolver === 'multiscale' ? ` scales=[${scales.join(', ')}],` : ''} weighting=${python(recipe.weighting)},` +
      `${recipe.robust === undefined ? '' : ` robust=${recipe.robust},`} cell=${python(`${recipe.cellArcsec}arcsec`)},` +
      ` imsize=[${recipe.imageSize.join(', ')}], phasecenter=${python(recipe.phaseCentre)}, pblimit=${recipe.pblimit},` +
      ` niter=1000000, threshold=${python(recipe.threshold)}, usemask='user', mask=[${recipe.mask.regions.map(python).join(', ')}],` +
      ` pbcor=True, restoration=True, interactive=False)`,
    ...(['image', 'image.pbcor', 'pb', 'mask'] as const).map(kind =>
      `exportfits(imagename=${python(`${imaged}.${kind}`)}, fitsimage=${python(`${options.out}.${kind}.fits`)}, overwrite=True, dropdeg=True)`),
    // The beam from the restored image's own header; the noise as the robust spread of the uncorrected image outside the mask
    // and where the primary beam is at least half, the region a paper measures its rms in.
    `ia = image(); ia.open(${python(`${imaged}.image`)}); beam = ia.restoringbeam(); pixels = ia.getchunk().squeeze(); ia.close()`,
    `ia.open(${python(`${imaged}.pb`)}); pb = ia.getchunk().squeeze(); ia.close()`,
    `ia.open(${python(`${imaged}.mask`)}); inside = ia.getchunk().squeeze() > 0; ia.close()`,
    'free = (pb >= 0.5) & ~inside & np.isfinite(pixels)',
    'noise = 1.4826 * np.median(np.abs(pixels[free] - np.median(pixels[free])))',
    'measured = {"beamArcsec": [beam["major"]["value"], beam["minor"]["value"]], "beamUnit": beam["major"]["unit"], "beamPositionAngleDeg": beam["positionangle"]["value"], "noiseMicroJyPerBeam": float(noise * 1e6)}',
    `measured["published"] = json.loads(${python(JSON.stringify(recipe.published))})`,
    `open(${python(`${options.out}.measured.json`)}, 'w').write(json.dumps(measured, indent=1))`,
    "print('imaged:', json.dumps(measured))",
  ].join('\n') + '\n';
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [recipePath] = process.argv.slice(2);
  const option = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
  const scratch = option('scratch'), out = option('out');
  if (!recipePath || !scratch || !out) throw new TypeError('Usage: alma-published-imaging.mts <recipe.json> --scratch <dir> --out <image base>');
  const recipe = parseImagingRecipe(JSON.parse(await readFile(recipePath, 'utf8')));
  const scriptPath = `${resolve(out)}.py`;
  await writeFile(scriptPath, publishedImagingScript(recipe, { scratch: resolve(scratch), out: resolve(out) }));
  const casa = await toolchainPath('casa');
  const result = spawnSync(resolve(casa, 'venv/bin/python'), [scriptPath], { cwd: resolve(scratch), stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`Imaging failed (status ${result.status}); the script is ${scriptPath}.`);
}
