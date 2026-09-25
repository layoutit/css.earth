/**
 * Leapseconds kernel: UTC to ephemeris time (TDB seconds past J2000). Per the
 * NAIF LSK conventions: TAI = UTC + leap seconds, TDT = TAI + DELTA_T_A, and
 * TDB = TDT + K sin(E) with E = M0 + M1 TDB + EB sin(M0 + M1 TDB), solved by
 * fixed-point iteration.
 */
import { number, numbers, type KernelPool } from './text-kernel.js';

export interface LeapSeconds { readonly deltaTA: number; readonly k: number; readonly eb: number; readonly m: readonly [number, number]; readonly table: readonly { readonly leapSeconds: number; readonly at: number }[] }

export function parseLeapSeconds(pool: KernelPool): LeapSeconds {
  const pairs = numbers(pool, 'DELTET/DELTA_AT');
  if (pairs.length < 2 || pairs.length % 2) throw new Error('DELTET/DELTA_AT must hold (leap seconds, date) pairs.');
  const table = [];
  for (let i = 0; i < pairs.length; i += 2) table.push({ leapSeconds: pairs[i], at: pairs[i + 1] });
  const m = numbers(pool, 'DELTET/M');
  if (m.length !== 2) throw new Error('DELTET/M must hold two values.');
  return { deltaTA: number(pool, 'DELTET/DELTA_T_A'), k: number(pool, 'DELTET/K'), eb: number(pool, 'DELTET/EB'), m: [m[0], m[1]], table };
}

/** TDB minus TDT at a TDB epoch, the periodic relativistic term. */
export function tdbMinusTdt(lsk: LeapSeconds, tdb: number) {
  const ma = lsk.m[0] + lsk.m[1] * tdb;
  return lsk.k * Math.sin(ma + lsk.eb * Math.sin(ma));
}

/** UTC calendar instant (ISO 8601, Z) to ephemeris time. */
export function utcToEt(lsk: LeapSeconds, iso: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)Z$/u.exec(iso);
  if (!match) throw new Error(`Expected an ISO 8601 UTC instant: ${iso}`);
  const seconds = Number(match[6]);
  return utcSecondsToEt(lsk, (Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), 0) - Date.UTC(2000, 0, 1, 12)) / 1000 + seconds);
}

/** UTC seconds past J2000 (2000-01-01T12:00:00Z, counted without leap seconds as a Julian date does) to ephemeris time. */
export function utcSecondsToEt(lsk: LeapSeconds, utcSecondsPastJ2000: number): number {
  if (!Number.isFinite(utcSecondsPastJ2000)) throw new Error('Expected a finite UTC instant.');
  // The table lists the cumulative leap seconds in force from each UTC date.
  let leap = lsk.table[0].leapSeconds;
  for (const entry of lsk.table) if (utcSecondsPastJ2000 >= entry.at) leap = entry.leapSeconds;
  const tdt = utcSecondsPastJ2000 + leap + lsk.deltaTA;
  let tdb = tdt;
  for (let i = 0; i < 5; i++) tdb = tdt + tdbMinusTdt(lsk, tdb);
  return tdb;
}

/** Ephemeris time to a UTC calendar instant (ISO 8601, Z, milliseconds), inverting `utcToEt`. Instants inside a leap
 * second are not representable and are reported one second late, as JavaScript dates cannot carry them. */
export function etToUtc(lsk: LeapSeconds, et: number): string {
  const tdt = et - tdbMinusTdt(lsk, et), tai = tdt - lsk.deltaTA;
  // Pick the leap count whose UTC interval contains the result: the table dates are UTC seconds past J2000.
  let leap = lsk.table[0].leapSeconds;
  for (const entry of lsk.table) if (tai - entry.leapSeconds >= entry.at) leap = entry.leapSeconds;
  const utc = tai - leap;
  const milliseconds = Math.round(utc * 1000) + Date.UTC(2000, 0, 1, 12);
  return new Date(milliseconds).toISOString();
}
