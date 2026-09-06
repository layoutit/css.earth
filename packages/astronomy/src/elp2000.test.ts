import { describe, expect, it } from 'vitest'
import { angleBetweenDeg, distance, magnitude, scaled } from './__fixtures__/compare.js'
import { HORIZONS } from './__fixtures__/horizons.js'
import {
  ELP2000_TERM_COUNT,
  ELP2000_TRUNCATION_BOUND_KM,
  ELP2000_VALID_FROM_JD,
  ELP2000_VALID_TO_JD,
  moonGeocentricKm,
} from './elp2000.js'
import { M_PER_AU, M_PER_KM } from './units.js'
import { sub } from './vec3.js'

const AU_KM = M_PER_AU / M_PER_KM

/**
 * How far the UNTRUNCATED ELP2000-82B is from Horizons at the seven fixture
 * epochs, measured by evaluating all 37 872 terms of the CDS files against
 * them. ELP2000-82B was fitted to DE200/LE200; Horizons serves DE441.
 */
const THEORY_FLOOR_KM = 2.668

/** budget = what the truncation can cost + what the theory itself costs. */
const BUDGET_KM = ELP2000_TRUNCATION_BOUND_KM + THEORY_FLOOR_KM

/** Measured worst case at the fixture epochs, plus 15 percent. See `vsop87.test.ts` for why both. */
const REGRESSION_TOLERANCE_KM = 3.17

describe('ELP2000-82B against JPL Horizons', () => {
  it('places the Moon inside its budget at every fixture epoch', () => {
    const fixture = HORIZONS.moonGeocentric!
    expect(fixture.rows.length).toBe(7)
    let worst = 0
    for (const row of fixture.rows) {
      worst = Math.max(worst, distance(moonGeocentricKm(row.jdTdb), row.positionKm))
    }
    expect(worst).toBeLessThan(REGRESSION_TOLERANCE_KM)
    expect(REGRESSION_TOLERANCE_KM).toBeLessThanOrEqual(BUDGET_KM)
  })

  it('is right at both ends of the validity window, not just near J2000', () => {
    // Stated separately because a mistruncated Poisson term is invisible at
    // J2000 by construction: t = 0 kills every term it multiplies.
    for (const jd of [ELP2000_VALID_FROM_JD, ELP2000_VALID_TO_JD]) {
      const row = HORIZONS.moonGeocentric!.rows.find((candidate) => candidate.jdTdb === jd)!
      expect(distance(moonGeocentricKm(jd), row.positionKm)).toBeLessThan(REGRESSION_TOLERANCE_KM)
    }
  })

  it('puts the Moon on the Earth-Sun line at two eclipse maxima', () => {
    // The instants come from NASA's Five Millennium Canon of Eclipses, not from
    // any ephemeris: the total lunar eclipse of 2000-01-21 (greatest at
    // 04:44:34 UTC) and the total solar eclipse of 2001-06-21 (12:03:42 UTC).
    // At greatest eclipse the Sun, Earth and Moon are nearly collinear.
    //
    // "Nearly" is doing work: greatest eclipse is when the shadow axis passes
    // closest to Earth's CENTRE, which for a solar eclipse is up to a degree
    // away from geocentric conjunction because the Moon's parallax is a degree.
    // So the tolerance on the geometry is coarse — and the sharp assertion is
    // the one after it, that the elongation this package computes agrees with
    // the elongation Horizons' own vectors give to a thousandth of a degree.
    const moonRows = HORIZONS.moonGeocentricSyzygy!.rows
    const sunRows = HORIZONS.sunGeocentricSyzygy!.rows
    expect(moonRows.length).toBe(2)

    const [fullMoon, newMoon] = moonRows
    const elongation = (jd: number, sunPositionKm: readonly number[]) => angleBetweenDeg(moonGeocentricKm(jd), sunPositionKm)

    expect(180 - elongation(fullMoon!.jdTdb, sunRows[0]!.positionKm)).toBeLessThan(0.5)
    expect(elongation(newMoon!.jdTdb, sunRows[1]!.positionKm)).toBeLessThan(1.2)

    // Sharp form: same angle, computed from Horizons' Moon instead of ours.
    for (let i = 0; i < 2; i++) {
      const fromHorizons = angleBetweenDeg(moonRows[i]!.positionKm, sunRows[i]!.positionKm)
      const fromHere = elongation(moonRows[i]!.jdTdb, sunRows[i]!.positionKm)
      expect(Math.abs(fromHere - fromHorizons)).toBeLessThan(0.002)
    }

    // And the alignment is a property of those instants, not of the geometry in
    // general: a day either way and the Moon has moved 13 degrees along its
    // orbit. Without this the two assertions above would still pass if the
    // Moon's longitude were wrong by any multiple of a lunation.
    for (let i = 0; i < 2; i++) {
      const target = i === 0 ? 180 : 0
      for (const offsetDays of [-1, 1]) {
        const away = elongation(moonRows[i]!.jdTdb + offsetDays, sunRows[i]!.positionKm)
        expect(Math.abs(away - target)).toBeGreaterThan(10)
      }
    }

    // And the Moon really is where Horizons puts it at those two instants.
    expect(distance(moonGeocentricKm(fullMoon!.jdTdb), fullMoon!.positionKm)).toBeLessThan(REGRESSION_TOLERANCE_KM)
    expect(distance(moonGeocentricKm(newMoon!.jdTdb), newMoon!.positionKm)).toBeLessThan(REGRESSION_TOLERANCE_KM)
  })

  it('stays between perigee and apogee across a full year of orbits', () => {
    // Thirteen lunations at 6-hour steps. Perigee and apogee vary from month to
    // month; these are the extremes of that variation, from the standard lunar
    // distance range of 356 400 to 406 800 km.
    let closest = Infinity
    let farthest = 0
    let worstStepKm = 0
    let previous = moonGeocentricKm(2451545)
    for (let i = 1; i <= 1460; i++) {
      const position = moonGeocentricKm(2451545 + i * 0.25)
      const r = magnitude(position)
      closest = Math.min(closest, r)
      farthest = Math.max(farthest, r)
      worstStepKm = Math.max(worstStepKm, magnitude(sub(position, previous)))
      previous = position
    }
    expect(closest).toBeGreaterThan(356300)
    expect(closest).toBeLessThan(370000)
    expect(farthest).toBeGreaterThan(400000)
    expect(farthest).toBeLessThan(406900)
    // The Moon's fastest geocentric speed is 1.10 km/s at perigee, so a
    // quarter day is 23 800 km. Anything past 24 200 is a discontinuity, not
    // motion.
    expect(worstStepKm).toBeLessThan(24200)
    expect(worstStepKm).toBeGreaterThan(15000)
  })

  it('is 1.4 degrees of the Moon\'s own orbit away from the ecliptic, not the equator', () => {
    // A cheap but decisive frame check. ELP2000-82B produces ecliptic
    // coordinates; if `vsop87ToIcrf` were skipped, the Moon's z-coordinate would
    // stay within 5.1 degrees of zero instead of swinging through the 23.4
    // degrees the obliquity adds. Sampled over a year so the inclination cycle
    // is covered.
    let maxLatitudeDeg = 0
    for (let i = 0; i < 366; i++) {
      const position = moonGeocentricKm(2451545 + i)
      const latitude = (Math.asin(position[2] / magnitude(position)) * 180) / Math.PI
      maxLatitudeDeg = Math.max(maxLatitudeDeg, Math.abs(latitude))
    }
    expect(maxLatitudeDeg).toBeGreaterThan(18)
    expect(maxLatitudeDeg).toBeLessThan(29)
  })

  it('kept the number of terms the data file claims', () => {
    expect(ELP2000_TERM_COUNT).toBe(934)
    expect(ELP2000_TRUNCATION_BOUND_KM).toBeLessThan(2)
    // Sanity on the unit: the Moon is 384 400 km away, not 384 400 au.
    expect(magnitude(scaled(moonGeocentricKm(2451545), 1 / AU_KM))).toBeLessThan(0.003)
  })
})
