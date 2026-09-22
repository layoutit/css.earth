import {readJsonSource, requireFiniteNumber} from '../../sources/source-values.mts';
import {parseTomographyRecipe} from './source-contract.mts';
import type {TomographyRecipe} from './source-contract.mts';
import type {Cutaway} from './contracts.mts';
interface TomographyInterior extends Record<string, unknown> {tomographyPath?: string; layers: readonly {id: string; outerRadiusKm: number}[];}
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';

const normalizedLongitude = (degrees: number) => ((degrees + 180) % 360 + 360) % 360 - 180;
const rgb = (hex: string) => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
const interpolate = (a: number, b: number, fraction: number) => a + (b - a) * fraction;

/** Read the compact, numeric source subset. No model decoding occurs in runtime. */
export async function readMantleTomography(sourceDirectory: string, interior: TomographyInterior, config: {geometry: {interiorCutaway: Cutaway}; interiorRadiusKey: string}) {
  if (!interior.tomographyPath) return null;
  const recipe = parseTomographyRecipe(await readJsonSource(resolve(sourceDirectory, interior.tomographyPath)));
  if (recipe.schema !== 'cssearth-mantle-tomography@1') throw new TypeError('Unsupported mantle tomography.');
  const { depth, latitude, longitude } = recipe;
  const cut = config.geometry.interiorCutaway;
  const sectionLongitudes = [-1, 1].map(sign => normalizedLongitude(
    cut.centerLongitudeDegrees + sign * cut.widthDegrees / 2 + recipe.geographicLongitudeOffsetDegrees));
  if (sectionLongitudes.some((value, face) => value !== recipe.sectionLongitudesDegrees[face]))
    throw new Error('Tomography must be re-extracted for the authored cut meridians.');
  const mantle = interior.layers.find(layer => layer.id === 'mantle');
  if (!mantle) throw new Error('Tomography requires a mantle shell.');
  const shellDepth = recipe.modelRadiusKm * (1 - mantle.outerRadiusKm / requireFiniteNumber(interior[config.interiorRadiusKey], 'Interior radius'));
  if (Math.abs(shellDepth - recipe.shellDepthKm) > 1e-6) throw new Error('Tomography mantle shell depth differs.');
  const bytes = gunzipSync(await readFile(resolve(sourceDirectory, recipe.gridPath)));
  const count = depth.count + 2 * depth.count * latitude.count + latitude.count * longitude.count;
  if (bytes.length !== count * 4) throw new Error('Tomography subset length differs.');
  const values = Float64Array.from({ length: count }, (_, index) => bytes.readFloatLE(index * 4));
  if (values.some(value => !Number.isFinite(value) || value <= 0)) throw new Error('Invalid source velocity.');
  const means = values.subarray(0, depth.count);
  const sections = [0, 1].map(face => values.subarray(depth.count + face * depth.count * latitude.count,
    depth.count + (face + 1) * depth.count * latitude.count));
  const shell = values.subarray(depth.count + 2 * depth.count * latitude.count);
  const coordinates = (value: number, axis: TomographyRecipe["depth"]): [number, number] | null => {
    const position = (value - axis.minimum) / axis.step;
    if (!Number.isFinite(position) || position < 0 || position > axis.count - 1) return null;
    const low = Math.min(axis.count - 2, Math.floor(position));
    return [low, position - low];
  };
  const bilinear = (data: Float64Array, width: number, row: readonly [number, number], column: readonly [number, number]) => {
    const [y, fy] = row, [x, fx] = column;
    return interpolate(interpolate(data[y * width + x], data[y * width + x + 1], fx),
      interpolate(data[(y + 1) * width + x], data[(y + 1) * width + x + 1], fx), fy);
  };
  const sample = (face: number, depthKm: number, latitudeDegrees: number) => {
    const d = coordinates(depthKm, depth), lat = coordinates(latitudeDegrees, latitude);
    if (!d || !lat || !sections[face]) return null;
    const velocity = bilinear(sections[face], latitude.count, d, lat);
    const reference = interpolate(means[d[0]], means[d[0] + 1], d[1]);
    return { velocity, reference, percent: 100 * (velocity / reference - 1) };
  };
  const color = (value: number | null) => tomographyColor(recipe, value);
  return {
    recipe, sample, color,
    sectionColor(face: number, radius: number, vertical: number, horizontal: number) {
      const depthKm = (1 - radius) * recipe.modelRadiusKm;
      const latitudeDegrees = Math.atan2(vertical, horizontal) * 180 / Math.PI;
      return color(sample(face, depthKm, latitudeDegrees)?.percent ?? null);
    },
    shellColor(longitudeDegrees: number, latitudeDegrees: number) {
      const lat = coordinates(latitudeDegrees, latitude);
      const lon = coordinates(normalizedLongitude(longitudeDegrees + recipe.geographicLongitudeOffsetDegrees), longitude);
      const d = coordinates(recipe.shellDepthKm, depth);
      if (!lat || !lon || !d) return color(null);
      const velocity = bilinear(shell, longitude.count, lat, lon);
      return color(100 * (velocity / interpolate(means[d[0]], means[d[0] + 1], d[1]) - 1));
    },
  };
}

export function tomographyColor(recipe: Pick<TomographyRecipe, "missingColor" | "palette">, percent: number | null) {
  if (percent === null || !Number.isFinite(percent)) return rgb(recipe.missingColor);
  const stops = recipe.palette;
  const value = Math.max(stops[0].percent, Math.min(stops[stops.length - 1].percent, percent));
  const high = stops.findIndex((stop, index) => index > 0 && stop.percent >= value);
  const a = stops[high - 1], b = stops[high];
  const fraction = (value - a.percent) / (b.percent - a.percent);
  const left = rgb(a.color), right = rgb(b.color);
  return left.map((channel, index) => Math.round(interpolate(channel, right[index], fraction)));
}

export function tomographyLegend(recipe: TomographyRecipe) {
  const { width, height } = recipe.legend;
  const data = Buffer.alloc(width * height * 3);
  for (let x = 0; x < width; x++) {
    const color = tomographyColor(recipe, interpolate(recipe.palette[0].percent, recipe.palette[recipe.palette.length - 1].percent, x / (width - 1)));
    for (let y = 0; y < height; y++) data.set(color, (y * width + x) * 3);
  }
  return { data, width, height, channels: 3 as const };
}
