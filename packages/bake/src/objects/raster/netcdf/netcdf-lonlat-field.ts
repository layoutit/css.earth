/**
 * One scalar field on a model's own longitude/latitude grid, read from a classic NetCDF file a paper released
 * (classic-netcdf.ts): a climate simulation's surface temperature, for example. The recipe states everything the file does
 * not make certain, and each statement is checked against the file:
 *
 *   { "format": "netcdf-lonlat-field", "path": "science/<paper>/<file>.nc", "variable": "TS",
 *     "coordinates": { "longitude": "lon", "latitude": "lat" }, "select": { "time": 0 },
 *     "sourceUnits": "K", "longitudeZeroAt": 180, "coordinateToleranceDegrees": 0.005 }
 *
 * - `variable` and the two `coordinates` name variables of the file. The coordinates are one-dimensional, in degrees.
 * - `select` gives the zero-based index taken along every other dimension of the variable, each one named, a dimension of
 *   length one included: which time and which level is the recipe's statement, never a default.
 * - `sourceUnits` is the variable's `units` attribute, letter for letter.
 * - `longitudeZeroAt` is the grid longitude, in degrees east, that the body's zero meridian falls on. For a planet that keeps
 *   one face to its star this is the longitude where the model put the star overhead, as its paper states it.
 *
 * The grid must go all the way around in even longitude steps. Latitude coverage ends at the released rows: nothing is
 * extrapolated to a pole. Values equal to the file's `_FillValue` or `missing_value` are cells without a value, and a sample
 * that would use one has none. `scale_factor` and `add_offset` are applied as the file states them. No averaging, fitting or
 * smoothing is done here: a time mean is whatever the release itself wrote.
 */
import { resolve } from 'node:path';
import { requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { periodicLonLatGrid } from '../lonlat/lonlat-grid.ts';
import { openClassicNetcdf, type NetcdfAttribute, type NetcdfVariable } from './classic-netcdf.ts';

/** What the field reader needs of an opened file; a test passes its own. */
export interface NetcdfSource { readonly variables: ReadonlyMap<string, NetcdfVariable>; values(name: string): Promise<Float64Array> }

const one = (attribute: NetcdfAttribute | undefined): number | undefined => typeof attribute === 'string' || attribute?.length !== 1 ? undefined : attribute[0];

export async function decodeNetcdfLonLatField(source: NetcdfSource, value: unknown, label: string) {
  const dataset = requireRecord(value, 'NetCDF longitude/latitude field'), at = (field: string) => `${label}, ${field}`;
  const name = requireString(dataset.variable, at('variable')), coordinates = requireRecord(dataset.coordinates, at('coordinates'));
  const select = dataset.select === undefined ? {} : requireRecord(dataset.select, at('select'));
  const sourceUnits = requireString(dataset.sourceUnits, at('sourceUnits')), zeroAt = requireFiniteNumber(dataset.longitudeZeroAt, at('longitudeZeroAt'));
  const tolerance = requireFiniteNumber(dataset.coordinateToleranceDegrees, at('coordinateToleranceDegrees'));
  if (!(tolerance >= 0 && tolerance <= 0.01)) throw new RangeError(`${at('coordinateToleranceDegrees')} must be between 0 and 0.01 degrees.`);
  const variable = source.variables.get(name);
  if (!variable) throw new TypeError(`${label} has no variable ${name}.`);
  if (variable.attributes.units !== sourceUnits)
    throw new TypeError(`${at('sourceUnits')} is ${JSON.stringify(sourceUnits)}, and the file gives ${name} the units ${JSON.stringify(variable.attributes.units ?? null)}.`);

  const axis = async (role: 'longitude' | 'latitude') => {
    const key = requireString(coordinates[role], at(`coordinates.${role}`)), coordinate = source.variables.get(key);
    if (!coordinate) throw new TypeError(`${label} has no ${role} variable ${key}.`);
    if (coordinate.dimensions.length !== 1) throw new TypeError(`${label}: ${role} variable ${key} has ${coordinate.dimensions.length} dimensions; a one-dimensional coordinate is read.`);
    const units = coordinate.attributes.units;
    if (typeof units !== 'string' || !/^degrees?(?:_?(?:east|north|E|N))?$/u.test(units)) throw new TypeError(`${label}: ${role} variable ${key} has the units ${JSON.stringify(units ?? null)}, not degrees.`);
    const dimension = coordinate.dimensions[0]!, position = variable.dimensions.indexOf(dimension);
    if (position < 0 || variable.dimensions.lastIndexOf(dimension) !== position) throw new TypeError(`${label}: ${name} does not vary along ${dimension}, the dimension of its ${role} ${key}.`);
    return { position, nodes: [...await source.values(key)] };
  };
  const longitude = await axis('longitude'), latitude = await axis('latitude');
  if (longitude.position === latitude.position) throw new TypeError(`${label}: longitude and latitude name the same dimension of ${name}.`);
  if (longitude.nodes.length < 2 || latitude.nodes.length < 2) throw new TypeError(`${label}: ${name} has no longitude/latitude grid.`);
  for (let i = 1; i < longitude.nodes.length; i++) if (!(longitude.nodes[i]! > longitude.nodes[i - 1]!)) throw new TypeError(`${label}: longitudes must increase.`);
  const descending = latitude.nodes[0]! > latitude.nodes.at(-1)!, latitudes = descending ? [...latitude.nodes].reverse() : latitude.nodes;
  for (let i = 1; i < latitudes.length; i++) if (!(latitudes[i]! > latitudes[i - 1]!)) throw new TypeError(`${label}: latitudes must run one way from pole to pole.`);

  // Every other dimension takes the index the recipe states for it.
  const fixed = variable.dimensions.map((dimension, position) => {
    if (position === longitude.position || position === latitude.position) return 0;
    if (!(dimension in select)) throw new TypeError(`${at('select')} gives no index along ${dimension}; ${name} varies along ${variable.dimensions.join(', ')}.`);
    const index = requireFiniteNumber(select[dimension], at(`select.${dimension}`));
    if (!Number.isSafeInteger(index) || index < 0 || index >= variable.shape[position]!) throw new RangeError(`${at(`select.${dimension}`)} is ${index}; ${dimension} has ${variable.shape[position]} entries, counted from 0.`);
    return index;
  });
  const unknown = Object.keys(select).filter(key => !variable.dimensions.includes(key) || key === variable.dimensions[longitude.position] || key === variable.dimensions[latitude.position]);
  if (unknown.length) throw new TypeError(`${at('select')} names ${unknown.join(', ')}, which ${name} is not selected along.`);

  const strides = variable.shape.map((_, position) => variable.shape.slice(position + 1).reduce((product, length) => product * length, 1));
  const base = fixed.reduce((sum, index, position) => sum + index * strides[position]!, 0), stored = await source.values(name);
  const fill = [one(variable.attributes._FillValue), one(variable.attributes.missing_value)].filter((n): n is number => n !== undefined);
  const scale = one(variable.attributes.scale_factor) ?? 1, offset = one(variable.attributes.add_offset) ?? 0;
  const width = longitude.nodes.length, height = latitudes.length, grid = new Float64Array(width * height);
  let minimum = Infinity, maximum = -Infinity, missing = 0;
  for (let row = 0; row < height; row++) for (let column = 0; column < width; column++) {
    const raw = stored[base + (descending ? height - 1 - row : row) * strides[latitude.position]! + column * strides[longitude.position]!]!;
    const present = Number.isFinite(raw) && !fill.includes(raw), cell = present ? raw * scale + offset : NaN;
    grid[row * width + column] = cell;
    if (present) { minimum = Math.min(minimum, cell); maximum = Math.max(maximum, cell); } else missing++;
  }
  if (missing === grid.length) throw new TypeError(`${label}: every cell of ${name} is a missing value.`);
  const sampler = periodicLonLatGrid(longitude.nodes, latitudes, grid, tolerance);
  return {
    sample: (bodyLongitude: number, bodyLatitude: number) => sampler.sample(bodyLongitude + zeroAt, bodyLatitude),
    report: { format: 'netcdf-lonlat-field', variable: name, dimensions: variable.dimensions, select: Object.fromEntries(variable.dimensions.flatMap((dimension, position) =>
        position === longitude.position || position === latitude.position ? [] : [[dimension, fixed[position]!]])), units: sourceUnits, longitudeZeroAt: zeroAt,
      width, height, longitudeRange: [longitude.nodes[0], longitude.nodes.at(-1)], latitudeRange: [latitudes[0], latitudes.at(-1)], minimum, maximum, missing,
      polarCoverage: 'No extrapolation beyond the released latitude samples.' },
  };
}

export async function loadNetcdfLonLatField(root: string, value: unknown) {
  const path = requireString(requireRecord(value).path, 'path');
  if (path.startsWith('/') || path.includes('\\') || path.split('/').includes('..')) throw new TypeError('A NetCDF field must be inside the source directory.');
  const file = await openClassicNetcdf(resolve(root, path));
  try { return await decodeNetcdfLonLatField(file, value, path); }
  finally { await file.close(); }
}
