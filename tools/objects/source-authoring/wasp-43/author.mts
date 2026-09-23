#!/usr/bin/env node
/** WASP-43 system navigation markers, rendered from each body's own data by the shared context-marker module:
 *
 * - WASP-43: the photosphere colour of its colour lens, dimmed toward the limb by the limb-darkening law measured from transits.
 * - WASP-43b: the published NIRSpec brightness-temperature map (the default lens), seen from the host star.
 *
 *   node tools/objects/source-authoring/wasp-43/author.mts [--check]
 *
 * --check recomputes both markers and fails if either differs from the file on disk. */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { authorContextMarkers } from '../context-markers.mts';


export const authorWasp43Markers = ({ check = false } = {}) => authorContextMarkers(['wasp-43', 'wasp-43b'], { check });

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const written = await authorWasp43Markers({ check: process.argv.includes('--check') });
  console.log(written.map(entry => entry.path).join('\n'));
}
