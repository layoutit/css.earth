/**
 * One scalar field on a model's own longitude/latitude grid, read from a NumPy `.npy` file a paper released that holds a
 * dictionary of arrays (`np.save` of a dict): a climate simulation's air temperature on one model level, for example. It makes
 * the statements of `netcdf-lonlat-field` (../netcdf/netcdf-lonlat-field.ts), which decodes it with the same checks:
 *
 *   { "format": "npy-lonlat-field", "path": "science/<paper>/<file>.npy", "variable": "t",
 *     "coordinates": { "longitude": "lon", "latitude": "lat" }, "select": { "pfull": 29 },
 *     "sourceUnits": "K", "longitudeZeroAt": 0, "coordinateToleranceDegrees": 0.005 }
 *
 * A dictionary names its arrays and nothing else: no dimensions and no units. So
 * - each axis of `variable` is the one-dimensional array of the dictionary, among the two coordinates and the names `select`
 *   gives, whose length is that axis's. An axis that none, or more than one, of them could be is refused, not guessed;
 * - `sourceUnits` is the variable's units as the release's own description states them, and the coordinates are read in
 *   degrees, as such a release states its longitude and latitude.
 * A masked cell (numpy.ma) has no value.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireRecord, requireString } from '@cssearth/core';
import type { NetcdfVariable } from '../netcdf/classic-netcdf.ts';
import { decodeNetcdfLonLatField, type NetcdfSource } from '../netcdf/netcdf-lonlat-field.ts';
import { readNpyObject, type NpyArray, type NpyValue } from './npy-pickle.ts';

const isArray = (value: NpyValue | undefined): value is NpyArray => typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Uint8Array) && (value as NpyArray).kind === 'ndarray';

/** The dictionary as the field reader's source: the variable on the axes its coordinates and selections name. */
export function npyDictionarySource(root: NpyValue, value: unknown, label: string): NetcdfSource {
  const recipe = requireRecord(value, 'NumPy longitude/latitude field'), at = (field: string) => `${label}, ${field}`;
  if (typeof root !== 'object' || root === null || Array.isArray(root) || root instanceof Uint8Array || isArray(root)) throw new TypeError(`${label} does not hold a dictionary of arrays.`);
  const dictionary = root as Readonly<Record<string, NpyValue>>, sourceUnits = requireString(recipe.sourceUnits, at('sourceUnits'));
  const array = (name: string, role: string) => {
    const found = Object.hasOwn(dictionary, name) ? dictionary[name] : undefined;
    if (!isArray(found) || !(found.data instanceof Float64Array)) throw new TypeError(`${label} has no numeric array ${name} (${role}).`);
    if (found.fortranOrder) throw new TypeError(`${label}: ${name} is stored in Fortran order; a C-order array is read.`);
    return found as NpyArray & { readonly data: Float64Array };
  };
  const name = requireString(recipe.variable, at('variable')), coordinates = requireRecord(recipe.coordinates, at('coordinates'));
  const longitude = requireString(coordinates.longitude, at('coordinates.longitude')), latitude = requireString(coordinates.latitude, at('coordinates.latitude'));
  const selected = Object.keys(recipe.select === undefined ? {} : requireRecord(recipe.select, at('select')));
  const field = array(name, 'variable'), axes = new Map([longitude, latitude, ...selected].map(axis => [axis, array(axis, 'an axis')] as const));
  for (const [axis, values] of axes) if (values.shape.length !== 1) throw new TypeError(`${label}: ${axis} has ${values.shape.length} dimensions; an axis is one-dimensional.`);
  const dimensions = field.shape.map((length, position) => {
    const named = [...axes].filter(([, values]) => values.shape[0] === length).map(([axis]) => axis);
    if (named.length !== 1) throw new TypeError(`${label}: axis ${position} of ${name} has ${length} entries, and ${named.length ? `${named.join(' and ')} both have` : `none of ${[...axes.keys()].join(', ')} has`} that length.`);
    return named[0]!;
  });
  const variable = (key: string, shape: readonly number[], axisNames: readonly string[], units: string): NetcdfVariable => ({ name: key, dimensions: axisNames, shape, type: 'double', attributes: { units } });
  const variables = new Map<string, NetcdfVariable>([[name, variable(name, field.shape, dimensions, sourceUnits)],
    [longitude, variable(longitude, axes.get(longitude)!.shape, [longitude], 'degrees_east')], [latitude, variable(latitude, axes.get(latitude)!.shape, [latitude], 'degrees_north')],
    ...selected.filter(axis => axis !== longitude && axis !== latitude).map(axis => [axis, variable(axis, axes.get(axis)!.shape, [axis], '')] as const)]);
  const values = (key: string) => key === name ? field.data : axes.get(key)?.data;
  return {
    variables,
    async values(key) { const found = values(key); if (!found) throw new TypeError(`${label} has no array ${key}.`); return found; },
    async slice(key, start, count) { const found = values(key); if (!found || start + count > found.length) throw new RangeError(`${label}: ${key} has no ${count} values from ${start}.`); return found.subarray(start, start + count); },
  };
}

/** Read the field a recipe names from the package's source directory. */
export async function loadNpyLonLatField(root: string, value: unknown) {
  const recipe = requireRecord(value), path = requireString(recipe.path, 'path');
  if (path.startsWith('/') || path.includes('\\') || path.split('/').includes('..')) throw new TypeError('A NumPy field must be inside the source directory.');
  const decoded = await decodeNetcdfLonLatField(npyDictionarySource(readNpyObject(await readFile(resolve(root, path))), value, path), value, path);
  return { ...decoded, report: { ...decoded.report, format: 'npy-lonlat-field' } };
}
