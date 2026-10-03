import { requireArray, requireFiniteNumber, requireRecord } from '@cssearth/core';

export const MEASURED_SPECTRUM_SCHEMA = 'cssearth-measured-spectrum@1';
export interface Measurement { x: number; xLow: number; xHigh: number; y: number; minus: number; plus: number }
/** Chart mode controls absent-x admission; yScale is supplied by the validated chart recipe. */
export function parseMeasuredSpectrumDocument(value: unknown, mode: 'points' | 'band', yScale: number): Measurement[] {
  const document = requireRecord(value, 'measurement document');
  if (document.schema !== MEASURED_SPECTRUM_SCHEMA) throw new TypeError('Unknown measurement document schema.');
  return requireArray(document.measurements, 'measurements').map(value => {
    const p = requireRecord(value, 'measurement'), number = (key: string) => requireFiniteNumber(p[key], key);
    const xLow = number('xLow'), xHigh = number('xHigh');
    // An integrated band has no representative wavelength: this midpoint only positions its error bar.
    const x = p.x === undefined && mode === 'band' ? (xLow + xHigh) / 2 : number('x');
    return { x, xLow, xHigh, y: number('y') * yScale, minus: number('minus') * yScale, plus: number('plus') * yScale };
  });
}
