import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireRecord, requireString } from '@cssearth/core';
import type { SolarGeometry } from './solar-geometry.ts';

/** Locate generated host data in the repository layout, from source and bundled entries alike.
 * The default assumes packages/bake is two levels below the checkout root; other hosts must pass their root. */
export async function loadSolarGeometry(root = resolve(dirname(createRequire(import.meta.url).resolve('@cssearth/bake/package.json')), '../..')): Promise<SolarGeometry> {
  const module: unknown = await import(pathToFileURL(resolve(root, 'src/platform/solar-geometry.mts')).href);
  const value = requireRecord(module, 'Generated solar geometry');
  const finite = (input: unknown, name: string): number => {
    if (typeof input !== 'number' || !Number.isFinite(input)) throw new TypeError(`${name} must be finite.`);
    return input;
  };
  const methods = ['requireBodyFixedSunDirection', 'requireBodyFixedEclipticNorth', 'requireBodyFixedToIcrf', 'bodyFixedStarDirection', 'requireBodyOrbit'] as const;
  for (const name of methods) if (typeof value[name] !== 'function') throw new TypeError(`Solar geometry needs ${name}.`);
  const call = (name: typeof methods[number], bodyId: string): unknown => {
    const method = value[name];
    if (typeof method !== 'function') throw new TypeError(`Solar geometry needs ${name}.`);
    return Reflect.apply(method, value, [bodyId]);
  };
  const vector = (input: unknown, name: string, length: number): readonly number[] => {
    if (!Array.isArray(input) || input.length !== length) throw new TypeError(`${name} needs ${length} coordinates.`);
    return Object.freeze(input.map((coordinate: unknown) => finite(coordinate, name)));
  };
  const unit = finite(value.ASTRONOMICAL_UNIT_KILOMETERS, 'Astronomical unit');
  if (unit <= 0) throw new TypeError('Astronomical unit must be positive.');
  return Object.freeze({
    SOLAR_GEOMETRY_EPOCH_LABEL: requireString(value.SOLAR_GEOMETRY_EPOCH_LABEL, 'Solar geometry epoch label'),
    SOLAR_GEOMETRY_EPOCH_JD_TT: finite(value.SOLAR_GEOMETRY_EPOCH_JD_TT, 'Solar geometry epoch'),
    ASTRONOMICAL_UNIT_KILOMETERS: unit,
    requireBodyFixedSunDirection: (id: string) => vector(call('requireBodyFixedSunDirection', id), 'Sun direction', 3),
    requireBodyFixedEclipticNorth: (id: string) => vector(call('requireBodyFixedEclipticNorth', id), 'Ecliptic north', 3),
    requireBodyFixedToIcrf: (id: string) => vector(call('requireBodyFixedToIcrf', id), 'Body rotation', 9),
    bodyFixedStarDirection(id: string) {
      const direction = call('bodyFixedStarDirection', id);
      return direction === null ? null : vector(direction, 'Star direction', 3);
    },
    requireBodyOrbit(id: string) {
      const orbit = requireRecord(call('requireBodyOrbit', id), 'Body orbit');
      return Object.freeze({ heliocentricDistanceAu: finite(orbit.heliocentricDistanceAu, 'Heliocentric distance') });
    },
  });
}
