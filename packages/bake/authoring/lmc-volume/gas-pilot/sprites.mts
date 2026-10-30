/** Pilot gas regions as crossed images: each region's finite emission once along X, Y and Z, through the shared component lane. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { validatePreparedCssVolume, type PreparedCssVolume } from '@cssearth/objects';
import { bankSpec, planeCamera, planeLayout, type GalaxyBankFit, type GalaxyPlane } from '../../milky-way-dust/galaxy-fitted-bank.mts';
import { json } from '../inputs.mts';
import { finiteEmission } from '../shape-pilot/project.mts';
import { compileFiniteBank } from '../shape-pilot/compile.mts';
import { writeGalaxyModelBank } from '../../milky-way-dust/galaxy-fitted-bank.mts';
import { L37_DIR, pilotSource } from './regions.mts';

export const SPRITES_DIR = L37_DIR + 'sprites/';

export async function buildSprites() {
  const { source, regions } = await pilotSource(), fits: GalaxyBankFit[] = [0, 1, 2].map(() => ({ rgb: [1, 1, 1], gamma: 1, dust: 1, emissionOpacity: 2 })), parts: { id: string; volume: PreparedCssVolume }[] = [];
  for (const region of regions) {
    const size = region.id === 'dor30' || region.id === 'n44' ? 512 : 256, spec = bankSpec({ box: region.box, counts: [1, 1, 1], size, record: 'source/preparation/l36/fit.json', texturePrefix: 'l37-sprite-' + region.id }), directory = SPRITES_DIR + region.id + '/', planes: GalaxyPlane[] = [];
    await mkdir(directory, { recursive: true });
    for (const axis of [0, 1, 2] as const) { const layout = planeLayout(spec, axis, 0), cache = directory + axis + '-rgb.f64le', saved = await readFile(cache).catch(() => null); let rgb: Float64Array; if (saved) rgb = new Float64Array(Uint8Array.from(saved).buffer); else { rgb = finiteEmission(region, planeCamera(spec, layout), source.grade, layout.domain).rgb; await writeFile(cache, Buffer.from(rgb.buffer)); } planes.push({ ...layout, rgb, tau: new Float64Array(layout.width * layout.height) }); }
    await writeGalaxyModelBank(directory, spec, planes, fits);
    const volume = compileFiniteBank(await json(directory + 'prototype.json'), directory, { record: spec.record, texturePrefix: spec.texturePrefix });
    await writeFile(directory + 'volume.json', JSON.stringify(volume) + '\n'); parts.push({ id: region.id, volume: validatePreparedCssVolume(volume) }); console.log('GAS_SPRITE_REGION ' + region.id);
  }
  console.log('GAS_SPRITES_COMPLETE ' + parts.length * 3); return parts;
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await buildSprites();
