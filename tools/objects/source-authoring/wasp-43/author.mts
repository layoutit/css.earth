#!/usr/bin/env node
/** WASP-43 system navigation markers, rendered from each body's own data instead of a flat disc:
 *
 * - WASP-43: the photosphere colour of its colour lens, dimmed toward the limb by the limb-darkening law measured from transits.
 * - WASP-43b: the published NIRSpec brightness-temperature map (the default lens), seen from the host star: an orthographic view
 *   centred on the substellar point, north up and east to the right, painted with the lens's palette and range.
 *
 * Both are deterministic functions of pinned package inputs.
 *
 *   node tools/objects/source-authoring/wasp-43/author.mts [--check]
 *
 * --check recomputes both markers and fails if either differs from the file on disk. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { linearToSrgb } from '../../color-transfer.mts';
import { loadStellarPhotometricColor, quadraticIntensity } from '../../observation/stellar/stellar-photometric-color.mts';
import { loadNpyDictionaryMap } from '../../terrestrial-layers/npy-dictionary-map.mts';
import { colorForValue } from '../../terrestrial-layers/scientific-raster.mts';
import { requireArray, requireRecord } from '../../../sources/source-values.mts';

const objects = resolve(import.meta.dirname, '../../../../src/objects');
export const MARKER_PATH = 'presentation/context.png';
export const MARKER_SIZE = 512;
/** The disc fills this share of the marker, as the scaffold's disc did. */
const FILL = 0.9;

const readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8')) as unknown;
const firstSurfaceScience = async (id: string) => requireRecord(requireRecord(requireArray(requireRecord(await readJson(resolve(objects, id, 'source/preparation/raster.json'))).surfaces)[0]).science);

/** Paint a disc texel by texel: `shade` receives the orthographic position (x east, y north, both within the unit disc) and returns
 * sRGB, or null for a texel with no data. The edge is antialiased by coverage. */
function disc(shade: (x: number, y: number) => readonly [number, number, number] | null) {
  const rgba = Buffer.alloc(MARKER_SIZE * MARKER_SIZE * 4), centre = MARKER_SIZE / 2, radius = MARKER_SIZE * FILL / 2;
  for (let row = 0; row < MARKER_SIZE; row++) for (let column = 0; column < MARKER_SIZE; column++) {
    const dx = column + 0.5 - centre, dy = row + 0.5 - centre, distance = Math.hypot(dx, dy);
    const coverage = Math.max(0, Math.min(1, radius + 0.5 - distance));
    if (!coverage) continue;
    const scale = Math.min(distance, radius - 1e-9) / Math.max(distance, 1e-9) / radius;
    const color = shade(dx * scale, -dy * scale);
    if (color) rgba.set([...color, Math.round(255 * coverage)], (row * MARKER_SIZE + column) * 4);
  }
  return sharp(rgba, { raw: { width: MARKER_SIZE, height: MARKER_SIZE, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer();
}

/** A placed star's marker: its colour lens, dimmed toward the limb where a limb-darkening law is measured, a uniform disc where not. */
export async function starMarker(id = 'wasp-43', { requireLimbDarkening = true } = {}) {
  const source = resolve(objects, id, 'source'), science = await firstSurfaceScience(id);
  const { color, limbDarkening } = await loadStellarPhotometricColor(path => readFile(resolve(source, path)), science, 'photometry/stellar-color.json');
  if (!limbDarkening && requireLimbDarkening) throw new Error(`${id} has no limb-darkening record.`);
  const { u1, u2 } = limbDarkening?.coefficients ?? { u1: 0, u2: 0 };
  // Intensity scales every linear channel; the colour's chromaticity stays.
  return disc((x, y) => {
    const ratio = Math.max(0, quadraticIntensity(Math.sqrt(Math.max(0, 1 - x * x - y * y)), u1, u2));
    return color.linear.map(value => Math.round(255 * linearToSrgb(value * ratio))) as unknown as [number, number, number];
  });
}

/** A hosted planet's marker: its default lens map seen from the host star. */
export async function planetMarker(id = 'wasp-43b') {
  const source = resolve(objects, id, 'source'), science = await firstSurfaceScience(id);
  const map = await loadNpyDictionaryMap(source, science);
  const palette = { minimum: Number(science.minimum), maximum: Number(science.maximum), colors: science.colors as string[] };
  return disc((x, y) => {
    // Orthographic view from the host star: the substellar point (latitude 0, longitude 0) at the centre, east to the right.
    const z = Math.sqrt(Math.max(0, 1 - x * x - y * y)), latitude = Math.asin(y) * 180 / Math.PI, longitude = Math.atan2(x, z) * 180 / Math.PI;
    const value = map.sample(longitude, latitude);
    return value === null ? null : colorForValue(value, palette as never) as [number, number, number];
  });
}

export async function authorWasp43Markers({ check = false } = {}) {
  const outputs: [string, Buffer][] = [[resolve(objects, 'wasp-43/source', MARKER_PATH), await starMarker()], [resolve(objects, 'wasp-43b/source', MARKER_PATH), await planetMarker()]];
  for (const [path, bytes] of outputs) {
    if (check) { if (!(await readFile(path)).equals(bytes)) throw new Error(`${path} differs from its authored recomputation.`); }
    else await writeFile(path, bytes);
  }
  return outputs.map(([path, bytes]) => ({ path, bytes: bytes.length }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const written = await authorWasp43Markers({ check: process.argv.includes('--check') });
  console.log(written.map(entry => `${entry.path.replace(objects + '/', '')} (${entry.bytes} bytes)`).join('\n'));
}
