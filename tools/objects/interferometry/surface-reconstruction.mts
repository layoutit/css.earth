#!/usr/bin/env node
/** Reconstruct a star's surface on a sphere with the pinned ROTIR toolchain, and write the star as ROTIR projects it on the sky
 * so the result can be checked with the same tools as a sky-plane image (spotless-disc.mts).
 *
 *   node tools/objects/interferometry/surface-reconstruction.mts <oifits> <output-directory> --diameter-mas <d>
 *     [--limb-darkening <u>] [--inclination <deg>] [--position-angle <deg>] [--regularizer tv|sobel2|none] [--weight <w>]
 *     [--level <healpix>] [--iterations <n>] [--sky-pixel-mas <p>] [--sky-pixels <n>]
 *
 * Why a sphere: a flat reconstruction may put light anywhere in its field, so a star a few beams across (Polaris, 3.1 mas at
 * 0.55 mas) has too many unknowns for its data. On a sphere of known size and limb darkening only the surface brightness of the
 * visible tiles is free. Where a star has light beyond its limb (π¹ Gruis has 12.8 percent), the sphere cannot hold it and a
 * flat reconstruction fits better; that is a property of the star, not of the code.
 *
 * Defaults are the geometry used for a star without a measured axis: inclination 90 and position angle 0 put the pole North in
 * the sky plane, as the display-orientation records do. Only squared visibilities and closure phases are fitted. */
import { spawnSync } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { toolchainDescriptor, toolchainPath } from './toolchain.mts';
import { requireString } from '../../sources/source-values.mts';

const repository = resolve(import.meta.dirname, '../../..');

export interface SurfaceOptions {
  readonly diameterMas: number; readonly limbDarkening?: number; readonly inclinationDegrees?: number; readonly positionAngleDegrees?: number;
  readonly regularizer?: 'tv' | 'sobel2' | 'none'; readonly weight?: number; readonly level?: number; readonly iterations?: number;
  readonly skyPixelMas?: number; readonly skyPixels?: number; readonly gridColumns?: number; readonly gridRows?: number;
}

/** The key=value arguments surface.jl reads, in a fixed order so a run is reproducible from its record. */
export function surfaceArguments(oifits: string, directory: string, options: SurfaceOptions) {
  const { diameterMas, limbDarkening = 0, inclinationDegrees = 90, positionAngleDegrees = 0, regularizer = 'tv', weight = 0.05, level = 4, iterations = 500 } = options;
  if (!(diameterMas > 0) || !(limbDarkening >= 0 && limbDarkening <= 1) || !Number.isInteger(level) || level < 2 || level > 7 || !Number.isInteger(iterations) || iterations < 1) {
    throw new RangeError('A surface reconstruction needs a positive diameter, a linear limb darkening between 0 and 1, a HEALPix level 2-7 and whole iterations.');
  }
  // The sky render spans twice the disc by default, at a tenth of the diameter per pixel or finer.
  const skyPixelMas = options.skyPixelMas ?? diameterMas / 64, skyPixels = options.skyPixels ?? 128;
  return [
    `oifits=${resolve(oifits)}`, `radius_mas=${diameterMas / 2}`, 'ld_law=1', `ld1=${limbDarkening}`, `inclination=${inclinationDegrees}`, `position_angle=${positionAngleDegrees}`,
    `regularizer=${regularizer}`, `weight=${weight}`, `level=${level}`, `maxiter=${iterations}`,
    `map=${resolve(directory, 'surface-map.fits')}`, `grid=${resolve(directory, 'surface-grid.fits')}`, `grid_columns=${options.gridColumns ?? 360}`, `grid_rows=${options.gridRows ?? 180}`,
    `sky=${resolve(directory, 'surface-sky.fits')}`, `sky_pixel_mas=${skyPixelMas}`, `sky_pixels=${skyPixels}`,
    `summary=${resolve(directory, 'surface-summary.txt')}`,
  ];
}

/** surface.jl's summary: one key=value number per line. */
export function parseSurfaceSummary(text: string) {
  const values: Record<string, number> = {};
  for (const line of text.split('\n').filter(Boolean)) {
    const [key, value] = line.split('=');
    if (!key || value === undefined || !Number.isFinite(Number(value))) throw new TypeError(`Unreadable surface summary line: ${line}`);
    values[key] = Number(value);
  }
  for (const key of ['tiles', 'visible_tiles', 'vis2', 't3phi', 'chi2r_vis2', 'chi2r_t3phi', 'contrast']) if (!(key in values)) throw new TypeError(`The surface summary lacks ${key}.`);
  return values;
}

export async function reconstructSurface(oifits: string, directory: string, options: SurfaceOptions) {
  const root = await toolchainPath('rotir'), { entry } = await toolchainDescriptor('rotir');
  await mkdir(directory, { recursive: true });
  const script = resolve(import.meta.dirname, 'rotir/surface.jl');
  const run = spawnSync(resolve(root, requireString(entry.executable)), ['--threads=8', `--project=${resolve(repository, requireString(entry.environment))}`, script, ...surfaceArguments(oifits, directory, options)],
    { env: { ...process.env, JULIA_DEPOT_PATH: resolve(root, 'depot') }, stdio: ['ignore', 'inherit', 'pipe'], encoding: 'utf8' });
  // ROTIR prints five warnings about OITOOLS bindings at load; they are known and harmless on the pinned commits.
  const errors = String(run.stderr).split('\n').filter(line => line.trim() && !/Imported binding OITOOLS\.visibility_|^\s*[└│┌]\s*$/u.test(line));
  if (run.status !== 0) throw new Error(`surface.jl failed (status ${run.status}):\n${errors.join('\n')}`);
  return { directory, summary: parseSurfaceSummary(await readFile(resolve(directory, 'surface-summary.txt'), 'utf8')) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [oifits, directory, ...rest] = process.argv.slice(2);
  const option = (name: string) => { const index = rest.indexOf(name); return index < 0 ? undefined : rest[index + 1]; };
  const number = (name: string) => option(name) === undefined ? undefined : Number(option(name));
  const diameterMas = number('--diameter-mas');
  if (!oifits || !directory || diameterMas === undefined) throw new TypeError('Usage: surface-reconstruction <oifits> <output-directory> --diameter-mas <d> [options]');
  const pick = <T,>(key: string, value: T | undefined) => value === undefined ? {} : { [key]: value };
  const result = await reconstructSurface(oifits, directory, { diameterMas, ...pick('limbDarkening', number('--limb-darkening')), ...pick('inclinationDegrees', number('--inclination')),
    ...pick('positionAngleDegrees', number('--position-angle')), ...pick('regularizer', option('--regularizer') as SurfaceOptions['regularizer']), ...pick('weight', number('--weight')),
    ...pick('level', number('--level')), ...pick('iterations', number('--iterations')), ...pick('skyPixelMas', number('--sky-pixel-mas')), ...pick('skyPixels', number('--sky-pixels')) });
  console.log(`${result.directory}: reduced chi-squared ${result.summary.chi2r_vis2!.toFixed(2)} on squared visibilities and ${result.summary.chi2r_t3phi!.toFixed(2)} on closure phases; surface contrast ${(result.summary.contrast! * 100).toFixed(2)}%.`);
}
