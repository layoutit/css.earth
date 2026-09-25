/**
 * Type 1 spacecraft clock kernels: fields with moduli and offsets, partitions,
 * and piecewise-linear coefficients (encoded SCLK, parallel time, rate). The
 * rate is parallel-time seconds per count of the most significant field, as
 * the kernels document. Parallel time is TDT (TIME_SYSTEM 2) or TDB (1).
 */
import { number, numbers, type KernelPool } from './text-kernel.js';
import { tdbMinusTdt, type LeapSeconds } from './lsk.js';

export interface SpacecraftClock {
  readonly id: number; readonly moduli: readonly number[]; readonly offsets: readonly number[];
  readonly coefficients: readonly { readonly sclk: number; readonly parallel: number; readonly rate: number }[];
  readonly partitions: readonly { readonly start: number; readonly end: number }[];
  readonly timeSystem: 1 | 2;
  /** Ticks of the least significant field per count of the most significant one. */
  readonly ticksPerMostSignificant: number;
}

export function parseSpacecraftClock(pool: KernelPool, spacecraft: number): SpacecraftClock {
  const id = Math.abs(spacecraft), key = (name: string) => `SCLK01_${name}_${id}`;
  const fields = number(pool, key('N_FIELDS')), moduli = numbers(pool, key('MODULI')), offsets = numbers(pool, key('OFFSETS'));
  if (moduli.length !== fields || offsets.length !== fields || fields < 1) throw new Error(`SCLK ${id}: field definitions disagree.`);
  const raw = numbers(pool, key('COEFFICIENTS'));
  if (raw.length < 3 || raw.length % 3) throw new Error(`SCLK ${id}: coefficients are not triplets.`);
  const coefficients = []; for (let i = 0; i < raw.length; i += 3) coefficients.push({ sclk: raw[i], parallel: raw[i + 1], rate: raw[i + 2] });
  const starts = numbers(pool, `SCLK_PARTITION_START_${id}`), ends = numbers(pool, `SCLK_PARTITION_END_${id}`);
  if (starts.length !== ends.length || !starts.length) throw new Error(`SCLK ${id}: partition tables disagree.`);
  const timeSystem = pool.variables.has(key('TIME_SYSTEM')) ? number(pool, key('TIME_SYSTEM')) : 1;
  if (timeSystem !== 1 && timeSystem !== 2) throw new Error(`SCLK ${id}: unsupported time system ${timeSystem}.`);
  return { id, moduli, offsets, coefficients, partitions: starts.map((start, i) => ({ start, end: ends[i] })), timeSystem, ticksPerMostSignificant: moduli.slice(1).reduce((a, b) => a * b, 1) };
}

/** Encode a clock string such as `1/0401930040:07327` (partition optional) into continuous ticks. */
export function encodeClock(clock: SpacecraftClock, text: string): number {
  const match = /^(?:(\d+)\/)?([\d.:\s-]+)$/u.exec(text.trim());
  if (!match) throw new Error(`Invalid SCLK string: ${text}`);
  const partition = match[1] === undefined ? 1 : Number(match[1]);
  const fields = match[2].split(/[.:\s-]+/u).filter(Boolean).map(Number);
  if (fields.length > clock.moduli.length || fields.some(f => !Number.isInteger(f))) throw new Error(`Invalid SCLK fields: ${text}`);
  let ticks = 0;
  for (let i = 0; i < clock.moduli.length; i++) {
    const value = (fields[i] ?? 0) - clock.offsets[i];
    if (value < 0 || value >= clock.moduli[i]) throw new Error(`SCLK field ${i + 1} out of range: ${text}`);
    ticks = ticks * clock.moduli[i] + value;
  }
  if (partition < 1 || partition > clock.partitions.length) throw new Error(`SCLK partition ${partition} is undefined.`);
  const { start, end } = clock.partitions[partition - 1];
  if (ticks < start || ticks > end) throw new Error(`SCLK ${text} lies outside partition ${partition}.`);
  let base = 0; for (let i = 0; i < partition - 1; i++) base += clock.partitions[i].end - clock.partitions[i].start;
  return base + (ticks - start);
}

/** Continuous ticks to ephemeris time (TDB). */
export function clockToEt(clock: SpacecraftClock, lsk: LeapSeconds, ticks: number): number {
  let record = clock.coefficients[0];
  for (const candidate of clock.coefficients) if (candidate.sclk <= ticks) record = candidate;
  const parallel = record.parallel + (ticks - record.sclk) / clock.ticksPerMostSignificant * record.rate;
  if (clock.timeSystem === 1) return parallel;
  let tdb = parallel;
  for (let i = 0; i < 5; i++) tdb = parallel + tdbMinusTdt(lsk, tdb);
  return tdb;
}

/** Ephemeris time to continuous ticks, inverting the piecewise-linear table. */
export function etToClock(clock: SpacecraftClock, lsk: LeapSeconds, et: number): number {
  const parallel = clock.timeSystem === 1 ? et : et - tdbMinusTdt(lsk, et);
  let record = clock.coefficients[0];
  for (const candidate of clock.coefficients) if (candidate.parallel <= parallel) record = candidate;
  return record.sclk + (parallel - record.parallel) / record.rate * clock.ticksPerMostSignificant;
}
