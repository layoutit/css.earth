import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
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
    assert.deepEqual(atEpoch.positionKm, [4, -2, 0])
    assert.deepEqual(atEpoch.velocityKmPerDay, [2 * Math.PI, Math.PI, 0])
    const quarterPeriod = periodicCorrectionStateKm(correction, 2451546)
    assert.ok(Math.abs(quarterPeriod.positionKm[0] - (5)) < 10 ** -12 / 2, `${quarterPeriod.positionKm[0]} is not close to ${5}`)
    assert.ok(Math.abs(quarterPeriod.positionKm[1] - (0)) < 10 ** -12 / 2, `${quarterPeriod.positionKm[1]} is not close to ${0}`)
    assert.ok(Math.abs(quarterPeriod.velocityKmPerDay[0] - (-1.5 * Math.PI)) < 10 ** -12 / 2, `${quarterPeriod.velocityKmPerDay[0]} is not close to ${-1.5 * Math.PI}`)
    assert.ok(Math.abs(quarterPeriod.velocityKmPerDay[1] - (0)) < 10 ** -12 / 2, `${quarterPeriod.velocityKmPerDay[1]} is not close to ${0}`)
  })

  it('bounds all phases without relying on a finite sample or a validity-window clamp', () => {
    // Each axis lies inside abs(constant) + hypot(cosine,sine): [6,4,0].
    assert.equal(periodicCorrectionBoundKm(correction), Math.hypot(6, 4))
    for (const offset of [-1e7, -2, -0.37, 0, 0.59, 1, 2.3, 1e7]) {
      const state = periodicCorrectionStateKm(correction, 2451545 + offset)
      assert.ok(Math.hypot(...state.positionKm) <= periodicCorrectionBoundKm(correction))
    }
  })
})
