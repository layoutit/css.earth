/** Level a panorama on its terrain: the horizon a terrain model predicts around the standpoint, the skyline the photograph
 * shows, and the horizon row and slope that lay one on the other. */
import { closeSync, openSync, readSync } from 'node:fs';
import { pds3Keyword } from '@cssearth/telescope';
import type { SurfacePoint } from './register.ts';

const RAD = Math.PI / 180;
/** Horizon profile sampling: one elevation every tenth of a degree of azimuth. */
const PROFILE_STEP_DEG = 0.1;
/** The ray starts this far out: nearer ground is under the camera's own feet and tripod shadow, not its horizon. */
const RAY_START_M = 5;

export interface TerrainGrid {
  readonly product: string;
  readonly lines: number;
  readonly samples: number;
  readonly heightsM: Float32Array;
  readonly radiusM: number;
  readonly mapScaleM: number;
  /** Continuous sample and line (pixel centres at integers) of a surface point. */
  readonly grid: (at: SurfacePoint) => readonly [number, number];
}

/** An LROC NAC DTM with its attached PDS3 label: 32-bit PC_REAL heights in metres on an equirectangular grid. */
export function readNacDtm(path: string): TerrainGrid {
  const descriptor = openSync(path, 'r');
  try {
    const head = Buffer.alloc(65536);
    readSync(descriptor, head, 0, head.length, 0);
    const label = head.toString('latin1'), where = `${path} label`;
    const value = (key: string) => { const text = pds3Keyword(label, key); const number = Number.parseFloat(text ?? ''); if (!Number.isFinite(number)) throw new TypeError(`${where} has no numeric ${key}.`); return number; };
    if (pds3Keyword(label, 'MAP_PROJECTION_TYPE') !== 'EQUIRECTANGULAR') throw new TypeError(`${where}: MAP_PROJECTION_TYPE must be EQUIRECTANGULAR.`);
    if (pds3Keyword(label, 'SAMPLE_TYPE') !== 'PC_REAL' || value('SAMPLE_BITS') !== 32) throw new TypeError(`${where}: the image must be 32-bit PC_REAL.`);
    if (pds3Keyword(label, 'POSITIVE_LONGITUDE_DIRECTION') !== 'EAST') throw new TypeError(`${where}: longitudes must be positive east.`);
    const lines = value('LINES'), samples = value('LINE_SAMPLES'), start = (value('^IMAGE') - 1) * value('RECORD_BYTES');
    const mapScaleM = value('MAP_SCALE'), latitude0 = value('CENTER_LATITUDE'), longitude0 = value('CENTER_LONGITUDE');
    const lineOffset = value('LINE_PROJECTION_OFFSET'), sampleOffset = value('SAMPLE_PROJECTION_OFFSET'), radiusM = value('A_AXIS_RADIUS') * 1000;
    const bytes = Buffer.alloc(lines * samples * 4);
    if (readSync(descriptor, bytes, 0, bytes.length, start) !== bytes.length) throw new TypeError(`${path} ends before its ${lines}×${samples} image.`);
    const heightsM = new Float32Array(lines * samples);
    for (let index = 0; index < heightsM.length; index++) heightsM[index] = bytes.readFloatLE(index * 4);
    // The projection offsets run from the centre of pixel (1, 1) to the projection origin (the label's own note): the
    // centre longitude on the equator. The centre latitude is only the parallel of true scale.
    const grid = (at: SurfacePoint) => {
      const longitude = at.longitudeDegEast - longitude0 - 360 * Math.round((at.longitudeDegEast - longitude0) / 360);
      return [sampleOffset + radiusM * longitude * RAD * Math.cos(latitude0 * RAD) / mapScaleM, lineOffset - radiusM * at.latitudeDeg * RAD / mapScaleM] as const;
    };
    return { product: pds3Keyword(label, 'PRODUCT_ID') ?? path, lines, samples, heightsM, radiusM, mapScaleM, grid };
  } finally { closeSync(descriptor); }
}

/** Bilinear height at a continuous grid position, or NaN off the grid or on a null. */
function heightAt(terrain: TerrainGrid, sample: number, line: number): number {
  const { samples, lines, heightsM } = terrain;
  if (sample < 0 || line < 0 || sample >= samples - 1 || line >= lines - 1) return NaN;
  const s0 = Math.floor(sample), l0 = Math.floor(line), a = sample - s0, b = line - l0, at = l0 * samples + s0;
  const v = [heightsM[at]!, heightsM[at + 1]!, heightsM[at + samples]!, heightsM[at + samples + 1]!];
  if (v.some(height => !(height > -1e5 && height < 1e5))) return NaN;
  return (v[0]! * (1 - a) + v[1]! * a) * (1 - b) + (v[2]! * (1 - a) + v[3]! * a) * b;
}

/** The terrain's horizon around a standpoint, `azimuthDeg` clockwise from north to elevation in degrees, ray-cast out to the
 * model's edge with the body's curvature. */
export function horizonProfile(terrain: TerrainGrid, at: SurfacePoint, cameraHeightM: number, label: string): (azimuthDeg: number) => number {
  const [sample, line] = terrain.grid(at), eye = heightAt(terrain, sample, line) + cameraHeightM;
  if (!Number.isFinite(eye)) throw new TypeError(`${label}: the standpoint lies outside ${terrain.product}.`);
  const count = Math.round(360 / PROFILE_STEP_DEG), profile = new Float64Array(count);
  for (let index = 0; index < count; index++) {
    const azimuth = index * PROFILE_STEP_DEG * RAD, east = Math.sin(azimuth) / terrain.mapScaleM, south = -Math.cos(azimuth) / terrain.mapScaleM;
    let best = -Infinity;
    for (let distance = RAY_START_M; ; distance += Math.max(terrain.mapScaleM * 1.25, distance * 0.004)) {
      const height = heightAt(terrain, sample + east * distance, line + south * distance);
      if (!Number.isFinite(height)) break;
      best = Math.max(best, Math.atan2(height - eye - distance * distance / (2 * terrain.radiusM), distance) / RAD);
    }
    if (best === -Infinity) throw new TypeError(`${label}: ${terrain.product} has no ground at azimuth ${(index * PROFILE_STEP_DEG).toFixed(1)}°.`);
    profile[index] = best;
  }
  return azimuthDeg => {
    const f = (((azimuthDeg % 360) + 360) % 360) / PROFILE_STEP_DEG, i = Math.floor(f), a = f - i;
    return profile[i % count]! * (1 - a) + profile[(i + 1) % count]! * a;
  };
}

/** Lunar sky in these prints is black and lit regolith is not: the skyline is the first run of three rows brighter than
 * this, from the top. */
const GROUND_GREY = 45;
/** Stitches fill their ragged top edge with white; a column that starts white has no sky to read. */
const STITCH_FILL_GREY = 235;

/** The skyline row of every `stride`-th column of a greyscale image, where it can be read. */
export function skylineRows(grey: Uint8Array, width: number, height: number, stride: number): { readonly columns: number[]; readonly rows: number[] } {
  const columns: number[] = [], rows: number[] = [];
  for (let x = Math.floor(stride / 2); x < width; x += stride) {
    if (grey[x]! > STITCH_FILL_GREY) continue;
    let y = 0;
    while (y < height - 3 && !(grey[y * width + x]! > GROUND_GREY && grey[(y + 1) * width + x]! > GROUND_GREY && grey[(y + 2) * width + x]! > GROUND_GREY)) y++;
    if (y > 2 && y < height - 3) { columns.push(x); rows.push(y); }
  }
  return { columns, rows };
}

export interface HorizonFit { readonly horizonRow: number; readonly horizonSlope: number; readonly medianResidualDeg: number; readonly columns: number }

/**
 * The horizon row and slope that lay the terrain horizon on the skyline: each column's skyline row plus the terrain's
 * elevation there is where 0° sits. A straight line through those, refitted four times on the closest 70%, since hardware,
 * the Sun's glare and shadows break the skyline in places.
 */
export function fitHorizon(skyline: { readonly columns: readonly number[]; readonly rows: readonly number[] }, pxPerDeg: number, azimuthAtLeftDeg: number,
  horizon: (azimuthDeg: number) => number, label: string): HorizonFit {
  const xs = skyline.columns, n = xs.length;
  if (n < 50) throw new TypeError(`${label}: only ${n} columns show a readable skyline.`);
  const level = xs.map((x, i) => skyline.rows[i]! + pxPerDeg * horizon(azimuthAtLeftDeg + x / pxPerDeg));
  let row = 0, slope = 0, keep = xs.map((_, i) => i);
  for (let pass = 0; pass < 4; pass++) {
    const m = keep.length, ax = keep.reduce((a, i) => a + xs[i]!, 0) / m, ay = keep.reduce((a, i) => a + level[i]!, 0) / m;
    let sxy = 0, sxx = 0;
    for (const i of keep) { sxy += (xs[i]! - ax) * (level[i]! - ay); sxx += (xs[i]! - ax) ** 2; }
    slope = sxy / sxx; row = ay - slope * ax;
    keep = xs.map((x, i) => ({ i, miss: Math.abs(level[i]! - (row + slope * x)) })).sort((a, b) => a.miss - b.miss).slice(0, Math.floor(n * 0.7)).map(entry => entry.i);
  }
  const misses = xs.map((x, i) => Math.abs(level[i]! - (row + slope * x))).sort((a, b) => a - b);
  return { horizonRow: row, horizonSlope: slope, medianResidualDeg: misses[Math.floor(n / 2)]! / pxPerDeg, columns: n };
}
