/**
 * Time scales. Internally every epoch is a Julian Date in Terrestrial Time
 * (TT), as a float64. `Date` is for the UI clock and nothing else — it is UTC,
 * which has leap seconds, which makes it wrong for anything physical.
 *
 * Resolution: a JD near the present is ~2.46e6, so float64 spacing is about
 * 5.5e-10 days — **roughly 50 microseconds**. Every conversion here is exact to
 * within one such step and no better, which is why the tests assert tolerances
 * rather than equalities. At 50 us, the fastest thing we render (a LEO
 * satellite at 7.7 km/s) moves 0.4 mm, so the bound is far below anything
 * visible. Sub-microsecond work would need a two-part (day, fraction) epoch.
 */

/** J2000.0 epoch: 2000-01-01T12:00:00 TT. */
export const J2000_JD = 2451545.0

/** Julian Date of the Unix epoch, 1970-01-01T00:00:00 UTC. */
export const UNIX_EPOCH_JD = 2440587.5

export const SECONDS_PER_DAY = 86400
export const DAYS_PER_JULIAN_CENTURY = 36525

/**
 * TAI − UTC, in seconds. Constant since the 2017-01-01 leap second.
 *
 * This must be bumped when the IERS announces a new leap second, which is why
 * it lives here as a named constant rather than inline: a stale value shows up
 * as a sub-arcsecond pointing error that is otherwise impossible to trace.
 */
export const TAI_MINUS_UTC_S = 37

/** TT − TAI, fixed by definition. */
export const TT_MINUS_TAI_S = 32.184

export const unixMsToJdUtc = (ms: number): number => ms / (SECONDS_PER_DAY * 1000) + UNIX_EPOCH_JD

export const jdUtcToUnixMs = (jd: number): number => (jd - UNIX_EPOCH_JD) * SECONDS_PER_DAY * 1000

export const jdUtcToJdTt = (jdUtc: number): number =>
  jdUtc + (TAI_MINUS_UTC_S + TT_MINUS_TAI_S) / SECONDS_PER_DAY

export const jdTtToJdUtc = (jdTt: number): number =>
  jdTt - (TAI_MINUS_UTC_S + TT_MINUS_TAI_S) / SECONDS_PER_DAY

/** Julian centuries elapsed since J2000.0. The argument of most series expansions. */
export const centuriesSinceJ2000 = (jdTt: number): number =>
  (jdTt - J2000_JD) / DAYS_PER_JULIAN_CENTURY

export const nowJdTt = (): number => jdUtcToJdTt(unixMsToJdUtc(Date.now()))
