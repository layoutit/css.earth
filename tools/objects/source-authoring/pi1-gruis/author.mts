#!/usr/bin/env node
/** π¹ Gruis authored inputs: the uniform-disc reference sphere from the retained measurements, the beam-convolved
 * reconstruction from the pinned SQUEEZE image, and the navigation marker rendered from it. The visibilities need no merge:
 * the pinned VLTI/PIONIER file is the image-ready file its authors published in the JMMC OiDB, and SQUEEZE read it as is.
 *
 *   node tools/objects/source-authoring/pi1-gruis/author.mts [--check]
 *
 * --check recomputes every output and fails if any differs from the file on disk. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { convolveGaussian, readReconstruction, writeReconstruction } from '../../interferometry/beam-convolve.mts';
import { readChannelRows } from '../../interferometry/oifits-rows.mts';
import { requireArray, requireRecord, requireFiniteNumber, requireString } from '../../../sources/source-values.mts';
import { authorUniformDiscSphere, contextMarker } from '../betelgeuse/author.mts';

const root = resolve(import.meta.dirname, '../../../../src/objects/pi1-gruis/source');

/** The image-ready PIONIER file (Paladini et al. 2018) as published in the OiDB, and the reconstruction made from it. */
export const VISIBILITIES_PATH = 'observations/PI_GRU_forImage.fits';
export const RAW_IMAGE_PATH = 'observations/pi1-gruis-pionier-2014-09-squeeze.fits';
export const BEAM_IMAGE_PATH = 'observations/pi1-gruis-pionier-2014-09-2.1mas.fits';
/** Half the wavelength over the longest projected baseline in the file: 1.68 um over twice 82.3 m is 2.10 mas. */
export const BEAM_FWHM_MAS = 2.1;
export const SPHERE_PATH = 'shape/uniform-disc.tab';
export const CONTEXT_PATH = 'presentation/context.png';

export async function authorPi1Gruis({ check = false } = {}) {
  await authorUniformDiscSphere(root, 'π¹ Gruis', { check });
  const rows = readChannelRows(await readFile(resolve(root, VISIBILITIES_PATH)));
  let longest = 0;
  for (const row of rows.vis2) longest = Math.max(longest, Math.hypot(row.u, row.v));
  const meanWavelength = rows.wavelengthsMetres.reduce((sum, value) => sum + value, 0) / rows.wavelengthsMetres.length;
  const beamMas = meanWavelength / (2 * longest) * 206264806.247;
  if (Math.abs(beamMas - BEAM_FWHM_MAS) > 0.05) throw new Error(`The file's longest baseline gives a ${beamMas.toFixed(2)} mas beam, not ${BEAM_FWHM_MAS}.`);
  const raw = readReconstruction(await readFile(resolve(root, RAW_IMAGE_PATH)));
  const pixelMas = raw.axes.scale[0];
  const beam = writeReconstruction(raw, convolveGaussian(raw, BEAM_FWHM_MAS / pixelMas), [['BEAMFWHM', BEAM_FWHM_MAS, 'mas, Gaussian convolution applied by author.mts'], ['ORIGFILE', RAW_IMAGE_PATH.split('/').at(-1)!, 'SQUEEZE posterior mean this was convolved from']]);
  const raster = requireRecord(JSON.parse(await readFile(resolve(root, 'preparation/raster.json'), 'utf8')), 'raster');
  const lens = requireRecord(requireRecord(requireRecord(requireArray(raster.surfaces)[0], 'surface').science, 'science').lens, 'lens');
  const display = requireRecord(lens.display, 'display'), frame = requireRecord(requireArray(lens.frames)[0], 'frame');
  const palette = requireArray(display.palette).map(value => requireString(value)), percentiles = requireArray(display.percentiles).map(value => requireFiniteNumber(value));
  const marker = await contextMarker(readReconstruction(beam), palette, [percentiles[0]!, percentiles[1]!], requireFiniteNumber(frame.backgroundMaximum));
  const outputs: [string, Buffer][] = [[BEAM_IMAGE_PATH, beam], [CONTEXT_PATH, marker]];
  for (const [path, bytes] of outputs) {
    const target = resolve(root, path);
    if (check) {
      if (!(await readFile(target)).equals(bytes)) throw new Error(`${path} differs from its authored recomputation.`);
    } else await writeFile(target, bytes);
  }
  return { vis2: rows.vis2.length, t3: rows.t3.length, flagged: rows.flagged, channels: rows.wavelengthsMetres.length, longestBaselineMetres: longest, beamMas };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await authorPi1Gruis({ check: process.argv.includes('--check') });
  console.log(`π¹ Gruis: ${result.vis2} V2 and ${result.t3} T3 channel rows (${result.flagged} flagged) over ${result.channels} channels, longest baseline ${result.longestBaselineMetres.toFixed(1)} m, beam ${result.beamMas.toFixed(2)} mas; sphere table, beam-convolved image and navigation marker written.`);
}
