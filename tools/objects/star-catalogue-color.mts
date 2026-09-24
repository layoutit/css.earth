// A placed star's catalogue colour (its search, catalogue and minimap swatch, and the world context's point colour) is derived,
// never typed. A star whose package measures its colour (a stellar-photometric-color lens) takes that lens's prepared colour.
// Every other star takes the shared star field's display fit (temperatureColor in src/preparation/stars/color.ts, the mapping
// the HYG field draws its stars with) at the effective temperature its measurement record cites.
import { temperatureColor } from '../../src/preparation/stars/color.ts';
import { requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';

export interface StarTemperature { readonly kelvin: number; readonly source: string }

/** The cited effective temperature in a star's source/measurements.json. */
export function readStarTemperature(measurements: unknown): StarTemperature {
  const record = requireRecord(measurements, 'star measurements');
  const kelvin = requireFiniteNumber(record.effectiveTemperatureK, 'effectiveTemperatureK');
  if (!(kelvin >= 1000 && kelvin <= 40000)) throw new TypeError('A stellar effective temperature lies between 1,000 and 40,000 K.');
  const source = requireString(record.effectiveTemperatureSource, 'effectiveTemperatureSource');
  if (!/https?:\/\//u.test(source)) throw new TypeError('The effective temperature source names the publication by URL.');
  return { kelvin, source };
}

export function temperatureCatalogueColor(kelvin: number): string {
  return `#${temperatureColor(kelvin).map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
}
