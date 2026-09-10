import { describe, expect, it } from 'vitest'
import { distance, magnitude } from './__fixtures__/compare.js'
import {
  keplerApoapsisKm, keplerPeriodDays, keplerStateKm,
  solveKeplerHyperbolicAnomalyRad, type KeplerianElements,
} from './kepler.js'

// Independent physical inputs from Bryan Weber's worked hyperbolic example:
// https://orbital-mechanics.space/time-since-periapsis-and-keplers-equation/hyperbolic-trajectory-example.html
// The source gives perigee distance/speed and Earth's GM, not Cartesian states
// produced by this implementation. Convert energy and angular momentum to a,e,n.
const gmKm3PerS2 = 398600.4418
const perigeeKm = 6678.1
const perigeeSpeedKmPerS = 15
const energyKm2PerS2 = perigeeSpeedKmPerS ** 2 / 2 - gmKm3PerS2 / perigeeKm
const axisKm = -gmKm3PerS2 / (2 * energyKm2PerS2)
const eccentricity = perigeeKm * perigeeSpeedKmPerS ** 2 / gmKm3PerS2 - 1
const hyperbola: KeplerianElements = {
  epochJdTt: 2451545,
  semiMajorAxisKm: axisKm,
  eccentricity,
  inclinationRad: 0,
  ascendingNodeRad: 0,
  argumentOfPeriapsisRad: 0,
  meanAnomalyAtEpochRad: 0,
  meanMotionRadPerDay: Math.sqrt(gmKm3PerS2 / (-axisKm) ** 3) * 86400,
}

describe('hyperbolic Keplerian propagation', () => {
  it('recovers the independently specified perigee position and tangential speed', () => {
    const state = keplerStateKm(hyperbola, hyperbola.epochJdTt)
    expect(distance(state.positionKm, [perigeeKm, 0, 0])).toBeLessThan(1e-9)
    expect(distance(state.velocityKmPerDay, [0, perigeeSpeedKmPerS * 86400, 0])).toBeLessThan(1e-8)
  })

  it('matches the published worked example away from perigee', () => {
    // Source example: time to 100 degrees, then another three hours. Its
    // printed results are rounded to 0.01 degree, 10 km and 0.01 km/s.
    const trueAnomalyRad = 100 * Math.PI / 180
    const h = 2 * Math.atanh(Math.sqrt((eccentricity - 1) / (eccentricity + 1)) * Math.tan(trueAnomalyRad / 2))
    const days = (eccentricity * Math.sinh(h) - h) / hyperbola.meanMotionRadPerDay + 3 / 24
    const state = keplerStateKm(hyperbola, hyperbola.epochJdTt + days)
    expect(Math.abs(Math.atan2(state.positionKm[1], state.positionKm[0]) * 180 / Math.PI - 107.78)).toBeLessThan(0.005)
    expect(Math.abs(magnitude(state.positionKm) - 163180)).toBeLessThan(5)
    expect(Math.abs(magnitude(state.velocityKmPerDay) / 86400 - 10.51)).toBeLessThan(0.005)
  })

  it('has inbound/outbound symmetry and never repeats after 2π of mean anomaly', () => {
    for (const days of [1 / 64, 1, 10000]) {
      const before = keplerStateKm(hyperbola, hyperbola.epochJdTt - days)
      const after = keplerStateKm(hyperbola, hyperbola.epochJdTt + days)
      expect(distance(before.positionKm, [after.positionKm[0], -after.positionKm[1], 0]) / magnitude(after.positionKm)).toBeLessThan(1e-14)
      expect(distance(before.velocityKmPerDay, [-after.velocityKmPerDay[0], after.velocityKmPerDay[1], 0]) / magnitude(after.velocityKmPerDay)).toBeLessThan(1e-14)
      expect(before.positionKm[1]).toBeLessThan(0)
      expect(after.positionKm[1]).toBeGreaterThan(0)
    }
    const later = keplerStateKm(hyperbola, hyperbola.epochJdTt + 2 * Math.PI / hyperbola.meanMotionRadPerDay)
    expect(magnitude(later.positionKm)).toBeGreaterThan(perigeeKm)
    expect(later.positionKm[1]).toBeGreaterThan(perigeeKm)
  })

  it('preserves the independently specified positive energy and angular momentum', () => {
    const elements = { ...hyperbola, inclinationRad: 0.8, ascendingNodeRad: 1.3, argumentOfPeriapsisRad: 2.1 }
    for (const days of [-30, -1, -0.02, 0, 0.02, 1, 30]) {
      const { positionKm: r, velocityKmPerDay } = keplerStateKm(elements, elements.epochJdTt + days)
      const v = velocityKmPerDay.map(component => component / 86400)
      const energy = magnitude(v) ** 2 / 2 - gmKm3PerS2 / magnitude(r)
      const momentum = magnitude([r[1] * v[2]! - r[2] * v[1]!, r[2] * v[0]! - r[0] * v[2]!, r[0] * v[1]! - r[1] * v[0]!])
      expect(Math.abs(energy / energyKm2PerS2 - 1)).toBeLessThan(1e-12)
      expect(Math.abs(momentum / (perigeeKm * perigeeSpeedKmPerS) - 1)).toBeLessThan(1e-10)
    }
  })

  it('matches position finite differences with all rotations and precession rates', () => {
    const elements = {
      ...hyperbola, inclinationRad: 0.8, ascendingNodeRad: 1.3, argumentOfPeriapsisRad: 2.1,
      ascendingNodeRateRadPerDay: 0.001, argumentOfPeriapsisRateRadPerDay: -0.002,
    }
    const stepDays = 1 / 1048576 // Binary fraction avoids Julian-date subtraction noise.
    for (const days of [-1, 0, 1]) {
      const epoch = elements.epochJdTt + days
      const at = (offset: number) => keplerStateKm(elements, epoch + offset).positionKm
      const numeric = [0, 1, 2].map(i => (-at(2 * stepDays)[i]! + 8 * at(stepDays)[i]! - 8 * at(-stepDays)[i]! + at(-2 * stepDays)[i]!) / (12 * stepDays))
      const analytic = keplerStateKm(elements, epoch).velocityKmPerDay
      expect(distance(numeric, analytic) / magnitude(analytic)).toBeLessThan(1e-8)
    }
  })

  it('solves small and large unwrapped mean anomalies, including near-parabolic eccentricity', () => {
    for (const e of [1.000001, 1.2, eccentricity, 10]) {
      for (const m of [-1e6, -100, -1, -1e-6, 1e-6, 1, 100, 1e6]) {
        const h = solveKeplerHyperbolicAnomalyRad(m, e)
        expect(Math.abs((e * Math.sinh(h) - h - m) / m)).toBeLessThan(1e-11)
        expect(Math.sign(h)).toBe(Math.sign(m))
      }
    }
  })

  it('refuses parabolic, inconsistent and non-finite conics', () => {
    for (const override of [
      { eccentricity: 1 }, { eccentricity: -1 }, { eccentricity: Number.NaN },
      { eccentricity: Number.POSITIVE_INFINITY }, { eccentricity: 0.5 },
      { semiMajorAxisKm: 1 }, { semiMajorAxisKm: 0 },
      { semiMajorAxisKm: Number.NEGATIVE_INFINITY }, { semiMajorAxisKm: Number.NaN },
    ]) {
      const invalid = { ...hyperbola, ...override }
      expect(() => keplerStateKm(invalid, invalid.epochJdTt)).toThrow(/eccentricity|semiMajorAxisKm/)
      expect(() => keplerApoapsisKm(invalid)).toThrow(/eccentricity|semiMajorAxisKm/)
      expect(() => keplerPeriodDays(invalid)).toThrow(/eccentricity|semiMajorAxisKm/)
    }
    expect(() => solveKeplerHyperbolicAnomalyRad(Number.POSITIVE_INFINITY, 1.2)).toThrow(/finite/)
    expect(() => solveKeplerHyperbolicAnomalyRad(1, 1)).toThrow(/eccentricity/)
  })

  it('does not manufacture an apoapsis or orbital period for an unbound trajectory', () => {
    expect(() => keplerApoapsisKm(hyperbola)).toThrow(/no finite apoapsis/)
    expect(() => keplerPeriodDays(hyperbola)).toThrow(/no orbital period/)
  })
})
