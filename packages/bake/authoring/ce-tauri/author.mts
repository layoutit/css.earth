#!/usr/bin/env node
/** CE Tauri authored inputs: the uniform-disc reference sphere from the retained measurements and the navigation marker
 * rendered from the published December 2016 image. The images themselves are the authors' (Montargès et al. 2018, CDS
 * J/A+A/614/A12) and are restored by the acquisition plan, not written here.
 *
 *   node packages/bake/authoring/ce-tauri/author.mts [--check] */
import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runAuthor } from '../authored-output.mts';
import { pathToFileURL } from 'node:url';
import { readReconstruction } from '@cssearth/bake/objects/layers/observation';
import { requireArray, requireRecord, requireFiniteNumber, requireString } from '@cssearth/core';
import { authorUniformDiscSphere, contextMarker } from '../betelgeuse/author.mts';

const root = resolve(checkoutProjectRoot(import.meta.url), 'src/objects/ce-tauri/source');
export const MARKER_IMAGE_PATH = 'observations/dec_avg.fit';
export const SPHERE_PATH = 'shape/uniform-disc.tab';
export const CONTEXT_PATH = 'presentation/context.png';

export async function authorCeTauri({ check = false } = {}) {
  return runAuthor({
    root: root, check, readError: 'propagate-read-error', mkdir: 'none',
    compute: async () => {
      await authorUniformDiscSphere(root, 'CE Tauri', { check });
      const raster = requireRecord(JSON.parse(await readFile(resolve(root, 'preparation/raster.json'), 'utf8')), 'raster');
      const surface = requireRecord(requireArray(raster.surfaces).find(entry => requireRecord(entry).source === MARKER_IMAGE_PATH), 'marker surface');
      const dataset = requireRecord(requireRecord(surface.science, 'science').dataset, 'dataset');
      const display = requireRecord(dataset.display, 'display'), frame = requireRecord(requireArray(dataset.frames)[0], 'frame');
      const palette = requireArray(display.palette).map(value => requireString(value)), percentiles = requireArray(display.percentiles).map(value => requireFiniteNumber(value));
      const image = readReconstruction(await readFile(resolve(root, MARKER_IMAGE_PATH)));
      const marker = await contextMarker(image, palette, [percentiles[0]!, percentiles[1]!], requireFiniteNumber(frame.backgroundMaximum));
      const outputs: [string, Buffer][] = [[CONTEXT_PATH, marker]];
      return { outputs: outputs, result: { width: image.width, height: image.height } };
    },
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await authorCeTauri({ check: process.argv.includes('--check') });
  console.log(`CE Tauri: sphere table and navigation marker (from the ${result.width} x ${result.height} December image) written.`);
}
