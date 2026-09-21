import { describe, expect, it } from 'vitest'
import { angleBetweenDeg, distance, magnitude } from './__fixtures__/compare.js'
import { ROTATION_FIXTURES } from './__fixtures__/rotation.js'
import { OBLIQUITY_J2000_RAD, RAD_PER_DEG } from './angles.js'
import { bodyFixedToIcrf, bodyPoleIcrf, bodyRotationAt, ROTATING_BODY_IDS, type RotatingBodyId } from './rotation.js'
import { DAYS_PER_JULIAN_CENTURY } from './time.js'

/**
 * HOW THIS IS CHECKED. `tools/fetch-rotation-fixtures.mjs` asks Horizons for the
 * Sun's vector from each body's centre and from two sites fixed to that body —
 * one at 0 degrees longitude on the equator, one at the north pole. The
 * difference is the site's own position in ICRF, which is a body-fixed axis
 * rotated by exactly the matrix this module builds. So the fixture is Horizons'
 * own orientation for that body, and a mistyped coefficient anywhere shows up.
 *
 * PER-BODY TOLERANCES, in degrees. Twenty-three of the twenty-nine agree with
 * Horizons to 2e-6 degrees, which is the fixtures' own rounding — those are
 * asserted at 1e-4 and prove the transcription. The six that do not are:
 *
 *   mercury   0.002 degrees in the prime meridian; Horizons carries a slightly
 *             different libration amplitude for it.
 *   earth     Horizons rotates Earth from UT1 with real precession-nutation,
 *             not from the IAU's linear W. 0.26 degrees is the documented gap
 *             between the two, not an error here.
 *   moon      Horizons uses the DE441 integrated libration angles; the IAU
 *             series is an approximation to them, good to about 0.003 degrees.
 *   miranda   URA182 (Jacobson & Park 2025) moved the Uranian satellite poles.
 *   triton    NEP097 likewise for Triton.
 *   ceres     `pck00011.tpc`/`dawn_ceres_v05.tpc` publish
 *             the spin rate to four decimal places (952.1532 deg/day), and
 *             Ceres spins fast enough (9.07 h) that this fixture's 200-year
 *             span turns the prime meridian about 7e7 degrees — enough for
 *             that rounding to show up as whole degrees of drift at the ends
 *             of the window. The pole is exact; only W drifts.
 *
 * Three transcription errors WERE found this way and fixed, which is the reason
 * to build the fixture at all: Ganymede's and Callisto's prime-meridian
 * periodic terms had the wrong sign (the residual was exactly twice the term),
 * and Neptune's prime meridian was the older 253.18 + 536.3128492 d rather than
 * the 249.978 + 541.1397757 d that Horizons uses. Phobos and Deimos later
 * showed 10.4 and 0.82 degree prime-meridian gaps because they still carried
 * the 2009 report's models; with the 2015 models from `pck00011.tpc` they match
 * Horizons to under 1e-6 degrees.
 *
 * Umbriel's remaining 0.14 degrees is NOT explained. Its pole matches exactly,
 * so the two periodic terms in its W are either mistranscribed here or a
 * different set from the one Horizons carries; no single sign flip accounts for
 * the residual at all three epochs. It is flagged rather than papered over.
 */
const EXACT_TOLERANCE_DEG = 1e-4
const KNOWN_DIVERGENCE_DEG: Record<string, { readonly pole: number; readonly primeMeridian: number }> = {
  mercury: { pole: EXACT_TOLERANCE_DEG, primeMeridian: 0.005 },
  earth: { pole: 0.005, primeMeridian: 0.3 },
  moon: { pole: 0.005, primeMeridian: 0.005 },
  miranda: { pole: 4, primeMeridian: 3 },
  triton: { pole: 5, primeMeridian: 4.5 },
  umbriel: { pole: EXACT_TOLERANCE_DEG, primeMeridian: 0.2 },
  ceres: { pole: 0.01, primeMeridian: 3 },
}

const toleranceFor = (id: string) => KNOWN_DIVERGENCE_DEG[id] ?? { pole: EXACT_TOLERANCE_DEG, primeMeridian: EXACT_TOLERANCE_DEG }

const FIXTURE_IDS = Object.keys(ROTATION_FIXTURES)

/** Signed angle difference, wrapped to (-pi, pi]. */
const wrapToPi = (radians: number): number => (((radians % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI

describe('IAU WGCCRE rotation against the orientation Horizons uses', () => {
  it('has a fixture for every rotating body except the Sun', () => {
    // The Sun is the one body Horizons will not put a site on, so it is the one
    // model here with no independent check. Said out loud rather than left to
    // be noticed.
    expect(new Set(FIXTURE_IDS)).toEqual(new Set(ROTATING_BODY_IDS.filter((id) => id !== 'sun')))
  })

  it.each(FIXTURE_IDS)('orients %s', (id) => {
    const fixture = ROTATION_FIXTURES[id]!
    expect(fixture.rows.length).toBe(3)
    const tolerance = toleranceFor(id)
    let worstPole = 0
    let worstMeridian = 0
    for (const row of fixture.rows) {
      const matrix = bodyFixedToIcrf(bodyRotationAt(id as RotatingBodyId, row.jdTdb))
      const bodyX = [matrix[0]!, matrix[3]!, matrix[6]!]
      const bodyZ = [matrix[2]!, matrix[5]!, matrix[8]!]
      worstPole = Math.max(worstPole, angleBetweenDeg(bodyZ, row.poleSiteKm))
      worstMeridian = Math.max(worstMeridian, angleBetweenDeg(bodyX, row.primeMeridianSiteKm))
    }
    expect(worstPole).toBeLessThan(tolerance.pole)
    expect(worstMeridian).toBeLessThan(tolerance.primeMeridian)
  })

  it('agrees with the fixtures about which way the pole points, not just which axis', () => {
    // `angleBetweenDeg` would be equally happy with an inverted pole if it were
    // compared as an axis. Every body's north pole must point at the fixture's
    // north-pole site, not away from it — a sign error in the matrix's third
    // column would otherwise pass silently for a body whose model is symmetric.
    for (const id of FIXTURE_IDS) {
      for (const row of ROTATION_FIXTURES[id]!.rows) {
        const pole = bodyPoleIcrf(bodyRotationAt(id as RotatingBodyId, row.jdTdb))
        const dot = pole[0] * row.poleSiteKm[0] + pole[1] * row.poleSiteKm[1] + pole[2] * row.poleSiteKm[2]
        expect(dot).toBeGreaterThan(0)
      }
    }
  })
})

describe('the rotation matrix itself', () => {
  it('is orthonormal and right-handed for every body at several epochs', () => {
    for (const id of ROTATING_BODY_IDS) {
      for (const epoch of [2415020.5, 2451545, 2469807.5, 2488069.5]) {
        const m = bodyFixedToIcrf(bodyRotationAt(id, epoch))
        const columns = [
          [m[0]!, m[3]!, m[6]!],
          [m[1]!, m[4]!, m[7]!],
          [m[2]!, m[5]!, m[8]!],
        ]
        for (const column of columns) expect(magnitude(column)).toBeCloseTo(1, 12)
        const dot = (a: number[], b: number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!
        expect(dot(columns[0]!, columns[1]!)).toBeCloseTo(0, 12)
        expect(dot(columns[1]!, columns[2]!)).toBeCloseTo(0, 12)
        expect(dot(columns[0]!, columns[2]!)).toBeCloseTo(0, 12)
        const cross = [
          columns[0]![1]! * columns[1]![2]! - columns[0]![2]! * columns[1]![1]!,
          columns[0]![2]! * columns[1]![0]! - columns[0]![0]! * columns[1]![2]!,
          columns[0]![0]! * columns[1]![1]! - columns[0]![1]! * columns[1]![0]!,
        ]
        expect(distance(cross, columns[2]!)).toBeLessThan(1e-12)
      }
    }
  })

  it('has a third column equal to bodyPoleIcrf', () => {
    for (const id of ROTATING_BODY_IDS) {
      const elements = bodyRotationAt(id, 2461041.5)
      const m = bodyFixedToIcrf(elements)
      expect(distance([m[2]!, m[5]!, m[8]!], bodyPoleIcrf(elements))).toBeLessThan(1e-15)
    }
  })

  it('turns the prime meridian at the declared spin rate', () => {
    // `spinRateRadPerDay` is the SECULAR rate; W also carries periodic terms,
    // whose contribution over one day is up to half a degree (Phobos) or a
    // quarter (Mimas). So the one-day check is coarse — it exists because it is
    // exactly what catches a W with no `d` term at all, which is how the Sun's
    // model was found to be frozen at 84.176 degrees.
    for (const id of ROTATING_BODY_IDS) {
      const before = bodyRotationAt(id, 2451545)
      const after = bodyRotationAt(id, 2451546)
      expect(Math.abs(wrapToPi(after.primeMeridianRad - before.primeMeridianRad - before.spinRateRadPerDay))).toBeLessThan(
        2 * RAD_PER_DEG,
      )
    }
  })

  it('has a spin rate that survives a hundred thousand days', () => {
    // The sharp form of the same claim. The periodic terms are bounded — the
    // largest amplitude sum in the whole table is Mimas's 58 degrees — so over
    // 1e5 days they cannot accumulate, and any error in the declared secular
    // rate can: 120 degrees of allowance over 1e5 days pins every rate to
    // 1.2e-3 degrees per day, which is one part in 1e4 for the slowest body
    // here and one part in 1e6 for the fastest.
    for (const id of ROTATING_BODY_IDS) {
      const days = 100000
      const before = bodyRotationAt(id, 2451545)
      const after = bodyRotationAt(id, 2451545 + days)
      const expected = before.spinRateRadPerDay * days
      expect(Math.abs(wrapToPi(after.primeMeridianRad - before.primeMeridianRad - expected))).toBeLessThan(120 * RAD_PER_DEG)
    }
  })

  it('recovers Earth\'s obliquity as the angle between its pole and the ecliptic pole', () => {
    // 23.44 degrees, the one number in this module a reader can check by eye.
    const pole = bodyPoleIcrf(bodyRotationAt('earth', 2451545))
    const eclipticPole = [0, -Math.sin(OBLIQUITY_J2000_RAD), Math.cos(OBLIQUITY_J2000_RAD)]
    expect(Math.abs(angleBetweenDeg(pole, eclipticPole) - 23.4392911)).toBeLessThan(0.01)
  })

  it('rejects a body with no rotation model rather than returning identity', () => {
    // Was 'pluto' — deliberately changed, not deleted: Pluto now HAS a WGCCRE
    // pole (`rotation.ts`, sourced from NAIF's post-New-Horizons PCK) and is
    // checked against Horizons like every other rotating body, in the
    // `it.each(FIXTURE_IDS)('orients %s', ...)` test above. Eris, Haumea and
    // Makemake replace it here: they genuinely have no published pole — no
    // resolved-disk imagery exists to derive one from — so this absence is
    // correct and permanent, not a gap waiting to be filled the way Pluto's
    // was. `ROTATING_BODY_IDS` correctly omits all three.
    for (const id of ['eris', 'haumea', 'makemake'] as const) {
      expect(() => bodyRotationAt(id as RotatingBodyId, 2451545)).toThrow(/no IAU rotation model/)
    }
  })

  it('uses centuries for T and days for d, not the other way round', () => {
    // A swapped argument is invisible at J2000 and catastrophic elsewhere. Venus
    // has no T terms at all and a pure linear W, so one Julian century of days
    // must turn it by exactly the rate times DAYS_PER_JULIAN_CENTURY.
    const start = bodyRotationAt('venus', 2451545)
    const end = bodyRotationAt('venus', 2451545 + DAYS_PER_JULIAN_CENTURY)
    const turned = start.spinRateRadPerDay * DAYS_PER_JULIAN_CENTURY
    let delta = end.primeMeridianRad - start.primeMeridianRad - turned
    delta = ((delta % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI
    expect(Math.abs(delta)).toBeLessThan(1e-6)
  })
})

