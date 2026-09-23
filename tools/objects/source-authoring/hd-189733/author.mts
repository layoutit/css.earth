#!/usr/bin/env node
/** HD 189733 system navigation markers, rendered from each body's own data with the WASP-43 system's renderers:
 *
 * - HD 189733 A: the colour of its Gaia XP spectrum, dimmed toward the limb by the law fitted to TESS transits of HD 189733b.
 * - HD 189733b: Lally et al. (2025)'s MIRI brightness-temperature map seen from the host star, in the lens's palette and range.
 * - HD 189733 B: the colour of its Gaia XP spectrum as a uniform disc; no limb darkening is measured.
 *
 *   node tools/objects/source-authoring/hd-189733/author.mts [--check]
 *
 * --check recomputes the markers and fails if any differs from the file on disk. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { MARKER_PATH, planetMarker, starMarker } from '../context-markers.mts';

const objects = resolve(import.meta.dirname, '../../../../src/objects');

export async function authorHd189733Markers({ check = false } = {}) {
  const outputs: [string, Buffer][] = [
    [resolve(objects, 'hd-189733/source', MARKER_PATH), await starMarker('hd-189733')],
    [resolve(objects, 'hd-189733b/source', MARKER_PATH), await planetMarker('hd-189733b')],
    [resolve(objects, 'hd-189733-companion/source', MARKER_PATH), await starMarker('hd-189733-companion', { requireLimbDarkening: false })],
  ];
  for (const [path, bytes] of outputs) {
    if (check) { if (!(await readFile(path)).equals(bytes)) throw new Error(`${path} differs from its authored recomputation.`); }
    else await writeFile(path, bytes);
  }
  return outputs.map(([path, bytes]) => ({ path, bytes: bytes.length }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const written = await authorHd189733Markers({ check: process.argv.includes('--check') });
  console.log(written.map(entry => `${entry.path.replace(objects + '/', '')} (${entry.bytes} bytes)`).join('\n'));
}
