import { parseDensityVolumeFrame, type DensityVolumeFrame } from '../../density-volume.js';
import { preparedBankColumn, type PreparedBank } from '../../prepared-bank.js';
export const PREPARED_POINT_TRANSMISSION_SCHEMA = 'cssearth-point-transmission@1';

export interface PreparedPointTransmission {
  readonly frame: DensityVolumeFrame;
  readonly targetAxes: readonly (readonly number[])[];
  readonly observerAxes: readonly (readonly number[])[];
  /** Optical depth already integrated by the bake, in thousandths. Observer-major, then target XYZ. */
  readonly tau: Uint16Array;
  readonly thresholds: readonly number[];
  /** Prepared sRGB output byte, indexed by extinction level, RGB channel, then input sRGB byte. */
  readonly colors: Uint8Array;
}

export function parsePointTransmission(bank: PreparedBank): PreparedPointTransmission {
  if (bank.schema !== PREPARED_POINT_TRANSMISSION_SCHEMA) throw new TypeError('Expected prepared point transmission.');
  const { targetAxes, observerAxes, thresholds } = bank.fields;
  const axes = (raw: unknown): readonly (readonly number[])[] => {
    if (!Array.isArray(raw) || raw.length !== 3 || raw.some(axis => !Array.isArray(axis) || axis.length < 2 || axis.length > 128 ||
      axis.some((value: unknown, i: number) => typeof value !== 'number' || !Number.isFinite(value) || i > 0 && !(value > axis[i - 1]))))
      throw new TypeError('Prepared transmission axes must increase.');
    return raw;
  };
  const target = axes(targetAxes), observer = axes(observerAxes);
  if (!Array.isArray(thresholds) || !thresholds.length || thresholds.length > 32 || thresholds.some((value, i) =>
    typeof value !== 'number' || !Number.isFinite(value) || value < 0 || i > 0 && !(value > thresholds[i - 1])))
    throw new TypeError('Prepared extinction thresholds must increase.');
  const count = [...target, ...observer].reduce((total, axis) => total * axis.length, 1);
  if (count > 20_000_000) throw new TypeError('Prepared transmission bank exceeds its bounded lookup budget.');
  const tau = preparedBankColumn(bank, 'tau', 'u16', count, 'point transmission');
  const colors = preparedBankColumn(bank, 'colors', 'u8', (thresholds.length + 1) * 3 * 256, 'point transmission');
  return { frame: parseDensityVolumeFrame(bank.fields.frame), targetAxes: target, observerAxes: observer, thresholds, tau, colors };
}
