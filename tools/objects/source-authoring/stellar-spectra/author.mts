#!/usr/bin/env node
/** Placed stars whose colour lens is a measured spectrum (the `measured` spectrum of stellar-photometric-color.mts): the navigation
 * marker is that colour as a uniform disc, and the catalogue and surface colours are its hex. All three are deterministic
 * functions of the pinned spectrum, its record and the CIE observer.
 *
 *   node tools/objects/source-authoring/stellar-spectra/author.mts [--check] [<id> ...]
 *
 * --check recomputes everything and fails where a file differs. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadStellarPhotometricColor } from '../../observation/stellar/stellar-photometric-color.mts';
import { MARKER_PATH, starMarker } from '../context-markers.mts';
import { requireArray, requireRecord, requireString } from '../../../sources/source-values.mts';

const objects = resolve(import.meta.dirname, '../../../../src/objects');
/** Stars whose default lens is the measured-spectrum colour: marker, catalogue and surface colours. */
export const SPECTRUM_STARS = ['sirius', 'vega', 'hd-209458', 'arcturus', 'altair', 'deneb', 'fomalhaut', 'rigel', 'alpha-centauri-a', 'alpha-centauri-b',
  'aldebaran', 'kepler-186', 'kepler-452', 'wasp-39', 'polaris', 'proxima-centauri', 'k2-18', 'regulus', 'alderamin', 'rasalhague', 'caph', 'beta-pictoris'] as const;
/** Stars with an image lens and a measured-spectrum colour lens beside it: the catalogue and surface colours follow the spectrum, and
 * the marker stays the image. */
export const IMAGE_STARS = ['pi1-gruis', 'betelgeuse', 'r-doradus', 'ce-tauri'] as const;

const hex = (srgb: readonly number[]) => `#${srgb.map(channel => channel.toString(16).padStart(2, '0')).join('')}`;

export async function spectrumColor(id: string) {
  const source = resolve(objects, id, 'source');
  const raster = requireRecord(JSON.parse(await readFile(resolve(source, 'preparation/raster.json'), 'utf8')) as unknown);
  const surface = requireArray(raster.surfaces).map(value => requireRecord(value)).find(value => isRecord(value.science) && value.science.kind === 'stellar-photometric-color');
  if (!surface) throw new TypeError(`${id} has no colour lens.`);
  const { color } = await loadStellarPhotometricColor(path => readFile(resolve(source, path)), requireRecord(surface.science), requireString(surface.source));
  return hex(color.srgb);
}
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** Replace the one quoted colour value that `current` reads from the file, keeping the file's own formatting. */
async function setColor(path: string, current: (value: Record<string, any>) => string, color: string, check: boolean) {
  const text = await readFile(path, 'utf8'), old = current(JSON.parse(text) as Record<string, any>);
  if (old === color) return;
  if (check) throw new Error(`${path}: ${old} differs from the spectrum colour ${color}.`);
  if (text.split(`"${old}"`).length !== 2) throw new Error(`${path}: ${old} is not a unique value.`);
  await writeFile(path, text.replace(`"${old}"`, `"${color}"`));
}

export async function authorStellarSpectra({ check = false, ids = [...SPECTRUM_STARS, ...IMAGE_STARS] as readonly string[] } = {}) {
  const colors: Record<string, string> = {};
  for (const id of ids) {
    const color = colors[id] = await spectrumColor(id), directory = resolve(objects, id);
    if ((SPECTRUM_STARS as readonly string[]).includes(id)) {
      const marker = await starMarker(id, { requireLimbDarkening: false }), target = resolve(directory, 'source', MARKER_PATH);
      if (check) { if (!(await readFile(target)).equals(marker)) throw new Error(`${id}: ${MARKER_PATH} differs from its recomputation.`); }
      else await writeFile(target, marker);
    }
    await setColor(resolve(directory, 'object.json'), value => value.properties.catalog.color, color, check);
    await setColor(resolve(directory, 'source/preparation/geometry.json'), value => value.surface.color, color, check);
  }
  return colors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), ids = args.filter(arg => !arg.startsWith('--'));
  const colors = await authorStellarSpectra({ check: args.includes('--check'), ...(ids.length ? { ids } : {}) });
  for (const [id, color] of Object.entries(colors)) console.log(`${id}: ${color}`);
}
