/** The brightness map of a star's surface that reproduces its rotational light curve.
 *
 * starry does the inversion (Luger et al. 2019, AJ 157, 64; tools.py holds the call, the telescope's starry toolchain is the
 * interpreter). A light curve is one number a moment, so it fixes how bright each longitude is and almost nothing about
 * latitude: starry's prior fills what the data leave open, and every dataset made from a map says so. */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { starryToolchainSync } from '@cssearth/telescope/node';

import { runTool } from './toolchain.mts';

/** The finest detail fitted (spherical-harmonic degree) and the width of starry's prior on each coefficient. */
export const MAP_DEGREE = 5, PRIOR_WIDTH = 0.01;
/** The grid a map is written on, degrees: the one the star pages' other maps use. */
export const GRID_STEP_DEGREES = 5;
/** The tilt a map is made at when none is known for the star: half of all axes that point at random are tilted less than this (cos 60° = 0.5). */
export const ASSUMED_TILT_DEGREES = 60;

export interface BrightnessMap { readonly longitudes: readonly number[]; readonly latitudes: readonly number[]; /** Brightness over the map's mean, rows by latitude from south. */ readonly values: readonly (readonly number[])[];
  readonly degree: number; readonly inclinationDegrees: number; readonly periodDays: number; /** Scatter of the light curve about the map's own curve, and the curve's noise, as shares of the mean light. */ readonly residual: number; readonly noise: number; readonly starry: string }

const range = (from: number, to: number, step: number) => Array.from({ length: Math.round((to - from) / step) + 1 }, (_, index) => from + index * step);

/** The map of each light curve, all at the star's one period and tilt: one call to starry for the star, which is imported
 * and compiled once (8 s a map when each had its own). */
export async function brightnessMaps(curves: readonly { readonly time: readonly number[]; readonly flux: readonly number[] }[], periodDays: number, inclinationDegrees: number): Promise<BrightnessMap[]> {
  if (!(periodDays > 0) || !(inclinationDegrees > 0 && inclinationDegrees <= 90)) throw new RangeError('A map needs a rotation period and a tilt between 0 and 90 degrees.');
  if (!curves.length) return [];
  const longitudes = range(-180, 180, GRID_STEP_DEGREES), latitudes = range(-90, 90, GRID_STEP_DEGREES), directory = await mkdtemp(join(tmpdir(), 'tess-map-')), job = join(directory, 'job.json');
  try { await writeFile(job, JSON.stringify({ curves: curves.map(curve => ({ time: curve.time, flux: curve.flux })), periodDays, inclinationDegrees, degree: MAP_DEGREE, priorWidth: PRIOR_WIDTH, longitudesDegrees: longitudes, latitudesDegrees: latitudes }));
    const answer = requireRecord(runTool(starryToolchainSync().python, ['maps', job]), 'starry answer'), starry = requireString(answer.starry, 'starry version'), made = requireArray(answer.maps, 'maps');
    if (made.length !== curves.length) throw new Error('starry returned another number of maps.');
    return made.map((entry, index) => { const map = requireRecord(entry, `map ${index}`);
      const values = requireArray(map.values, 'map values').map(row => requireArray(row, 'map row').map(value => requireFiniteNumber(value, 'brightness')));
      if (values.length !== latitudes.length || values.some(row => row.length !== longitudes.length)) throw new Error('starry returned a map of another shape.');
      return { longitudes, latitudes, values, degree: MAP_DEGREE, inclinationDegrees, periodDays, residual: requireFiniteNumber(map.residual, 'residual'), noise: requireFiniteNumber(map.noise, 'noise'), starry }; }); }
  finally { await rm(directory, { recursive: true, force: true }); }
}

/** The map as the table layout the star packages read (`tecplot-lonlat-map`): longitude and latitude in degrees, then the
 * brightness in percent of the map's mean. */
export function brightnessTable(title: string, map: BrightnessMap): string {
  const lines = [`TITLE     = ${JSON.stringify(title)}`, 'VARIABLES = "Longitude [Deg]" "Latitude [Deg]" "Brightness [%]"', `ZONE I=${map.longitudes.length}, J=${map.latitudes.length}, K=1, ZONETYPE=Ordered`, 'DATAPACKING=POINT', 'DT=(SINGLE SINGLE SINGLE)'];
  // The pages' maps run from longitude 0 to 360.
  const order = map.longitudes.map((longitude, index) => ({ longitude: (longitude + 360) % 360, index })).filter(({ longitude }, at, all) => all.findIndex(other => other.longitude === longitude) === at).sort((a, b) => a.longitude - b.longitude);
  const columns = [...order, { longitude: 360, index: order[0]!.index }];
  lines[2] = `ZONE I=${columns.length}, J=${map.latitudes.length}, K=1, ZONETYPE=Ordered`;
  for (const [j, latitude] of map.latitudes.entries()) for (const column of columns) lines.push([column.longitude, latitude, 100 * map.values[j]![column.index]!].map(value => value.toFixed(5).padStart(13)).join(''));
  return `${lines.join('\n')}\n`;
}
