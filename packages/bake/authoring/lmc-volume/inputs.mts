/** Value checks, raster sampling and the warp from the published depth surface. */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { skyProjection, type FitsHeader } from '@cssearth/fits';
import { bodyToIcrs, skyOf, DEG, unit, dot, type V3 } from './geometry.mts';
export const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
export function need(v: unknown, message: string): asserts v {
  if (!v) throw new TypeError(message);
}
export function rec(v: unknown): Record<string, unknown> {
  need(v !== null && typeof v === 'object' && !Array.isArray(v), 'Expected object');
  return Object.fromEntries(Object.entries(v));
}
export function num(v: unknown): number {
  need(typeof v === 'number' && Number.isFinite(v), 'Expected finite number');
  return v;
}
export function array(v: unknown): unknown[] {
  need(Array.isArray(v), 'Expected array');
  return v;
}
export function numbers(v: unknown, n?: number): number[] {
  const a = array(v).map(num);
  need(n === undefined || a.length === n, 'Unexpected vector length');
  return a;
}
export async function json(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8'));
}
export interface Raster {
  n: number;
  half: number;
  values: Float32Array;
  mask: Uint8Array;
}
export function at(map: Raster, x: number, y: number): number {
  const fx = ((x / map.half + 1) * map.n) / 2 - 0.5,
    fy = ((y / map.half + 1) * map.n) / 2 - 0.5,
    i = Math.floor(fx),
    j = Math.floor(fy);
  if (i < 0 || j < 0 || i + 1 >= map.n || j + 1 >= map.n) return 0;
  const a = j * map.n + i,
    b = a + map.n;
  if (!map.mask[a] || !map.mask[a + 1] || !map.mask[b] || !map.mask[b + 1]) return 0;
  const u = fx - i,
    v = fy - j;
  return (
    (map.values[a] * (1 - u) + map.values[a + 1] * u) * (1 - v) + (map.values[b] * (1 - u) + map.values[b + 1] * u) * v
  );
}
export const makeRaster = (n: number, half: number): Raster => ({
  n,
  half,
  values: new Float32Array(n * n),
  mask: new Uint8Array(n * n),
});
export function smooth(map: Raster, sigmaPixels: number, inferred = false): Raster {
  const radius = Math.ceil(sigmaPixels * 3),
    k = Array.from({ length: radius * 2 + 1 }, (_, i) => Math.exp(-0.5 * ((i - radius) / sigmaPixels) ** 2));
  const weights = new Float64Array(map.n * map.n),
    first = new Float64Array(map.n * map.n),
    out = makeRaster(map.n, map.half);
  for (let y = 0; y < map.n; y++)
    for (let x = 0; x < map.n; x++) {
      const i = y * map.n + x;
      let sum = 0,
        w = 0;
      for (let d = -radius; d <= radius; d++) {
        const xx = x + d;
        if (xx < 0 || xx >= map.n) continue;
        const j = y * map.n + xx;
        if (map.mask[j]) {
          sum += k[d + radius] * map.values[j];
          w += k[d + radius];
        }
      }
      first[i] = sum;
      weights[i] = w;
    }
  for (let y = 0; y < map.n; y++)
    for (let x = 0; x < map.n; x++) {
      const i = y * map.n + x;
      let sum = 0,
        w = 0;
      for (let d = -radius; d <= radius; d++) {
        const yy = y + d;
        if (yy < 0 || yy >= map.n) continue;
        const j = yy * map.n + x;
        sum += k[d + radius] * first[j];
        w += k[d + radius] * weights[j];
      }
      // No dilation of measured support: unknown cells remain unknown.
      if ((map.mask[i] || inferred) && w > 0) {
        out.mask[i] = 1;
        out.values[i] = sum / w;
      }
      if (inferred) out.mask[i] = 1;
    }
  return out;
}
/** The disc warp in kpc: Oden et al. (2026) red-clump distances against their fitted plane, tapered inside 4.5 kpc and at the map's edge. */
export async function loadWarp(path: string, n = 512, half = 20): Promise<Raster> {
  const oden = rec(await json(path)),
    width = num(oden.width),
    height = num(oden.height),
    distances = array(oden.distancesKpc).map(v => (v === null ? NaN : num(v)));
  need(distances.length === width * height, 'Wrong depth surface shape');
  const header: FitsHeader = {};
  for (const [k, v] of Object.entries(rec(oden.header))) {
    need(typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean', 'Invalid WCS card');
    header[k] = v;
  }
  const wcs = skyProjection(header),
    inclination = 25.32 * DEG,
    node = 142.34 * DEG,
    ray = unit(80.6, -69.8),
    west: V3 = [Math.sin(80.6 * DEG), -Math.cos(80.6 * DEG), 0],
    north: V3 = [
      -Math.sin(-69.8 * DEG) * Math.cos(80.6 * DEG),
      -Math.sin(-69.8 * DEG) * Math.sin(80.6 * DEG),
      Math.cos(-69.8 * DEG),
    ],
    normal = [0, 1, 2].map(
      c =>
        -Math.cos(node) * Math.sin(inclination) * west[c]! -
        Math.sin(node) * Math.sin(inclination) * north[c]! -
        Math.cos(inclination) * ray[c]!,
    ),
    planeConstant = -49.15 * Math.cos(inclination),
    warp = makeRaster(n, half);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const x = (((i + 0.5) / n) * 2 - 1) * half,
        y = (((j + 0.5) / n) * 2 - 1) * half,
        [ra, de] = skyOf(bodyToIcrs([x, y, 0])),
        pixel = wcs.pixelOf(ra, de);
      if (!pixel) continue;
      const px = Math.floor(pixel[0]),
        py = Math.floor(pixel[1]);
      if (px < 0 || py < 0 || px + 1 >= width || py + 1 >= height) continue;
      const v = [py * width + px, py * width + px + 1, (py + 1) * width + px, (py + 1) * width + px + 1].map(
        id => distances[id]!,
      );
      if (!v.every(Number.isFinite)) continue;
      const u = pixel[0] - px,
        t = pixel[1] - py,
        d = (v[0]! * (1 - u) + v[1]! * u) * (1 - t) + (v[2]! * (1 - u) + v[3]! * u) * t,
        plane = planeConstant / dot(unit(ra, de), normal),
        q = Math.min(1, Math.max(0, (Math.hypot(x, y) - 4.5) / 2)),
        edge = Math.min(1, Math.max(0, Math.min(pixel[0], pixel[1], width - 1 - pixel[0], height - 1 - pixel[1]) / 4));
      warp.values[j * n + i] =
        -(d - plane) * Math.cos(inclination) * q * q * (3 - 2 * q) * edge * edge * (3 - 2 * edge);
      warp.mask[j * n + i] = 1;
    }
  return smooth(warp, 0.47 / ((2 * half) / n));
}
