#!/usr/bin/env node
/** CE Tauri authored inputs: the uniform-disc reference sphere from the retained measurements and the navigation marker
 * rendered from the published December 2016 image. The images themselves are the authors' (Montargès et al. 2018, CDS
 * J/A+A/614/A12) and are restored by the acquisition plan, not written here.
 *
 *   node tools/objects/source-authoring/ce-tauri/author.mts [--check] */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readReconstruction } from '../../interferometry/beam-convolve.mts';
import { requireArray, requireRecord, requireFiniteNumber, requireString } from '../../../sources/source-values.mts';
import { authorUniformDiscSphere, contextMarker } from '../betelgeuse/author.mts';

const root = resolve(import.meta.dirname, '../../../../src/objects/ce-tauri/source');
export const MARKER_IMAGE_PATH = 'observations/dec_avg.fit';
export const SPHERE_PATH = 'shape/uniform-disc.tab';
export const CONTEXT_PATH = 'presentation/context.png';

export async function authorCeTauri({ check = false } = {}) {
  await authorUniformDiscSphere(root, 'CE Tauri', { check });
  const raster = requireRecord(JSON.parse(await readFile(resolve(root, 'preparation/raster.json'), 'utf8')), 'raster');
  const surface = requireRecord(requireArray(raster.surfaces).find(entry => requireRecord(entry).source === MARKER_IMAGE_PATH), 'marker surface');
  const lens = requireRecord(requireRecord(surface.science, 'science').lens, 'lens');
  const display = requireRecord(lens.display, 'display'), frame = requireRecord(requireArray(lens.frames)[0], 'frame');
  const palette = requireArray(display.palette).map(value => requireString(value)), percentiles = requireArray(display.percentiles).map(value => requireFiniteNumber(value));
  const image = readReconstruction(await readFile(resolve(root, MARKER_IMAGE_PATH)));
  const marker = await contextMarker(image, palette, [percentiles[0]!, percentiles[1]!], requireFiniteNumber(frame.backgroundMaximum));
  const outputs: [string, Buffer][] = [[CONTEXT_PATH, marker]];
  for (const [path, bytes] of outputs) {
    const target = resolve(root, path);
    if (check) {
      if (!(await readFile(target)).equals(bytes)) throw new Error(`${path} differs from its authored recomputation.`);
    } else await writeFile(target, bytes);
  }
  return { width: image.width, height: image.height };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await authorCeTauri({ check: process.argv.includes('--check') });
  console.log(`CE Tauri: sphere table and navigation marker (from the ${result.width} x ${result.height} December image) written.`);
}
