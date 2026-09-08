import { describe, expect, it } from 'vitest'
import { periodicCorrectionBoundKm, periodicCorrectionStateKm, type PeriodicVectorCorrection } from './periodicCorrection.js'

const correction: PeriodicVectorCorrection = {
  epochJdTt: 2451545,
  axes: [
    { constantKm: 1, harmonics: [{ rateRadPerDay: Math.PI / 2, cosineKm: 3, sineKm: 4 }] },
    { constantKm: -2, harmonics: [{ rateRadPerDay: Math.PI / 2, cosineKm: 0, sineKm: 2 }] },
    { constantKm: 0, harmonics: [] },
  ],
}

describe('prepared periodic ICRF correction', () => {
  it('evaluates displacement and its analytic derivative at independent phase anchors', () => {
    const atEpoch = periodicCorrectionStateKm(correction, 2451545)
    expect(atEpoch.positionKm).toEqual([4, -2, 0])
    expect(atEpoch.velocityKmPerDay).toEqual([2 * Math.PI, Math.PI, 0])
    const quarterPeriod = periodicCorrectionStateKm(correction, 2451546)
    expect(quarterPeriod.positionKm[0]).toBeCloseTo(5, 12)
    expect(quarterPeriod.positionKm[1]).toBeCloseTo(0, 12)
    expect(quarterPeriod.velocityKmPerDay[0]).toBeCloseTo(-1.5 * Math.PI, 12)
    expect(quarterPeriod.velocityKmPerDay[1]).toBeCloseTo(0, 12)
  })

  it('bounds all phases without relying on a finite sample or a validity-window clamp', () => {
    // Each axis lies inside abs(constant) + hypot(cosine,sine): [6,4,0].
    expect(periodicCorrectionBoundKm(correction)).toBe(Math.hypot(6, 4))
    for (const offset of [-1e7, -2, -0.37, 0, 0.59, 1, 2.3, 1e7]) {
      const state = periodicCorrectionStateKm(correction, 2451545 + offset)
      expect(Math.hypot(...state.positionKm)).toBeLessThanOrEqual(periodicCorrectionBoundKm(correction))
    }
  })
})
