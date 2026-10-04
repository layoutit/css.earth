#!/usr/bin/env node
/** Navigation markers for placed stars and hosted planets, rendered from each body's own default dataset instead of the scaffold's
 * flat gray disc:
 *
 * - a star: the photosphere color of its color dataset, dimmed toward the limb by the dataset's limb-darkening law (a uniform disc
 *   when it has none);
 * - a planet whose default dataset is one color (the neutral gray under its host's light, the black-body color of its measured day side,
 *   or the false color of its band photometry): a uniform disc of that color, as the dataset draws the sphere;
 * - a body whose default dataset is a map (a hosted planet, or a brown dwarf with a surface map): that map in an orthographic view
 *   centred on longitude 0 (a hosted planet's substellar point, as seen from its star), north up and east to the right, in the
 *   dataset's palette and range, with any borders the dataset draws.
 *
 * Both are deterministic functions of pinned package inputs.
 *
 *   node packages/telescope-cli/src/source-authoring/context-markers.mts <id>... [--check]
 *
 * --check recomputes each marker and fails if it differs from the file on disk. */
import { readPublishedLimbDarkening } from '@cssearth/objects';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { hostLitGray, linearToSrgb, srgbToLinear } from '@cssearth/bake/objects/color';
import { loadDiscBandColor } from '@cssearth/bake/objects/layers/observation';
import { limbIntensity, loadStellarPhotometricColor } from '@cssearth/bake/objects/stellar';
import { colorForValue, loadScienceSurface } from '@cssearth/bake/objects/raster';
import { MISSING_COVERAGE_STYLES } from '@cssearth/bake/raster';
import { requireArray, requireRecord, requireString } from '@cssearth/core';
import { WORKSPACE } from '@cssearth/telescope/node';

const objects = resolve(WORKSPACE, 'src/objects');
export const MARKER_PATH = 'presentation/context.png';
export const MARKER_SIZE = 512;
/** The disc fills this share of the marker, as the scaffold's disc did. */
const FILL = 0.9;
/** Borders a dataset draws are black, as in the papers' figures and the prepared dataset. */
const OUTLINE = [0, 0, 0] as const;
const NO_DATA = MISSING_COVERAGE_STYLES.gray.base as readonly [number, number, number];

const readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8')) as unknown;
const defaultSurface = async (id: string) => {
  const raster = requireRecord(await readJson(resolve(objects, id, 'source/preparation/raster.json')));
  const content = requireRecord(await readJson(resolve(objects, id, 'source/content/object.json')));
  const datasets = requireRecord(content.datasets), defaultDataset = requireString(datasets.defaultDataset, `${id} default dataset`);
  // A dataset that draws an attached volume (a debris disc) paints the body itself with the surface it names.
  const control = requireArray(datasets.controls).map(entry => requireRecord(entry)).find(entry => entry.id === defaultDataset);
  const dataset = control?.volume === undefined ? defaultDataset : requireString(requireRecord(control.volume).surface, `${id} ${defaultDataset} volume surface`);
  const surface = requireArray(raster.surfaces).map(entry => requireRecord(entry)).find(entry => entry.id === dataset);
  if (!surface) throw new TypeError(`${id}: the default dataset ${dataset} has no raster surface.`);
  return { dataset, science: requireRecord(surface.science), source: requireString(surface.source, `${id} surface source`) };
};

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

/** A placed star's marker: its color dataset, dimmed toward the limb where a limb-darkening law is given, a uniform disc where not. */
export async function starMarker(id: string, { requireLimbDarkening = true } = {}) {
  const source = resolve(objects, id, 'source'), { science } = await defaultSurface(id);
  const { color, limbDarkening } = await loadStellarPhotometricColor(path => readFile(resolve(source, path)), science, 'photometry/stellar-color.json');
  if (!limbDarkening && requireLimbDarkening) throw new Error(`${id} has no limb-darkening record.`);
  const law = limbDarkening?.coefficients ?? { u1: 0, u2: 0 };
  // Intensity scales every linear channel; the color's chromaticity stays.
  return disc((x, y) => {
    const ratio = Math.max(0, limbIntensity(Math.sqrt(Math.max(0, 1 - x * x - y * y)), law));
    return color.linear.map(value => Math.round(255 * linearToSrgb(value * ratio))) as unknown as [number, number, number];
  });
}

/** A hosted planet's marker: its default dataset map seen from the host star. */
export async function planetMarker(id: string) {
  const source = resolve(objects, id, 'source'), { science } = await defaultSurface(id);
  const map = await loadScienceSurface(source, science);
  const palette = { minimum: Number(science.minimum), maximum: Number(science.maximum), colors: science.colors as string[] };
  const pixel = 360 / (Math.PI * MARKER_SIZE * FILL);
  // A map with a limb law is dimmed toward its edge as the sphere's limb plate dims it.
  const law = science.limbDarkening === undefined ? null
    : readPublishedLimbDarkening(await readJson(resolve(source, requireString(requireRecord(science.limbDarkening).path, `${id} limbDarkening.path`))));
  const dim = (color: readonly [number, number, number], mu: number) => law === null ? color
    : color.map(value => Math.round(255 * linearToSrgb(srgbToLinear(value / 255) * Math.max(0, limbIntensity(mu, law))))) as unknown as readonly [number, number, number];
  return disc((x, y) => {
    // Orthographic view from the host star: the substellar point (latitude 0, longitude 0) at the centre, east to the right.
    const z = Math.sqrt(Math.max(0, 1 - x * x - y * y)), latitude = Math.asin(y) * 180 / Math.PI, longitude = Math.atan2(x, z) * 180 / Math.PI;
    const value = map.sample(longitude, latitude);
    // Surface the dataset gives no value is the shared no-data gray, as the sphere draws it, not a hole in the disc.
    if (value === null) return dim(NO_DATA, z);
    return map.outline?.(longitude, latitude, pixel) ? OUTLINE : dim(colorForValue(value, palette as never) as [number, number, number], z);
  });
}

/** The one color a flat planet dataset paints the sphere with, read the way interpret.mts reads it; undefined for a map dataset. */
async function flatDatasetColor(id: string, science: Record<string, unknown>, surfaceSource: string): Promise<readonly [number, number, number] | undefined> {
  const source = resolve(objects, id, 'source'), read = (path: string) => readFile(resolve(source, path));
  if (science.kind === 'neutral-shape') return science.hostLight === undefined ? [128, 128, 128] : hostLitGray(requireString(requireRecord(science.hostLight).srgb, `${id} hostLight.srgb`));
  if (science.kind === 'dayside-thermal-color' || science.kind === 'equilibrium-thermal-color') return (await loadStellarPhotometricColor(read, science, surfaceSource)).color.srgb;
  if (science.kind === 'disc-integrated-band-color') return (await loadDiscBandColor(read, surfaceSource)).srgb;
  return undefined;
}

/** A body whose default dataset is a photosphere color is drawn as a star; a planet whose dataset is one color as a disc of it; a body
 * whose default dataset is a map (a hosted planet, or a brown dwarf with a surface map) as that map. */
async function markerFor(id: string) {
  const { science, source } = await defaultSurface(id);
  const flat = await flatDatasetColor(id, science, source);
  if (flat) return disc(() => flat);
  // A color dataset without a limb-darkening law (none measured) is drawn as the uniform disc it is on the sphere.
  return science.kind === 'stellar-photometric-color' ? starMarker(id, { requireLimbDarkening: science.limbDarkening !== undefined }) : planetMarker(id);
}

export async function authorContextMarkers(ids: readonly string[], { check = false } = {}) {
  const written = [];
  for (const id of ids) {
    const path = resolve(objects, id, 'source', MARKER_PATH), bytes = await markerFor(id);
    if (check) { if (!(await readFile(path)).equals(bytes)) throw new Error(`${path} differs from its authored recomputation.`); }
    else await writeFile(path, bytes);
    written.push({ path, bytes: bytes.length });
  }
  return written;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const ids = process.argv.slice(2).filter(argument => !argument.startsWith('--'));
  if (!ids.length) throw new TypeError('Usage: context-markers <id>... [--check]');
  const written = await authorContextMarkers(ids, { check: process.argv.includes('--check') });
  console.log(written.map(entry => `${entry.path.replace(objects + '/', '')} (${entry.bytes} bytes)`).join('\n'));
}
