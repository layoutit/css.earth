import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { fitCosineSeries } from './fit-cosine-series.mts'

describe('prepared cosine residual series', () => {
  it('recovers independent low-frequency modes with the correct midpoint phase', () => {
    const days = Array.from({ length: 161 }, (_, i) => 7500 + i * 2.5)
    const signal = (t: number) => 8 + 3 * Math.cos(Math.PI * (t - 7500) / 400) - 2 * Math.cos(7 * Math.PI * (t - 7500) / 400)
    const fit = fitCosineSeries(days, days.map(signal), 32)
    assert.equal(fit.slope, 0)
    assert.ok(Math.abs(fit.intercept - (8)) < 10 ** -10 / 2, `${fit.intercept} is not close to ${8}`)
    assert.ok(Math.abs(fit.harmonics.reduce((sum, h) => sum + Math.hypot(h.cosine, h.sine), 0) - (5)) < 10 ** -10 / 2, `${fit.harmonics.reduce((sum, h) => sum + Math.hypot(h.cosine, h.sine), 0)} is not close to ${5}`)
    for (const t of [7500.123, 7510.76, 7723.123, 7899.875]) {
      const predicted = fit.intercept + fit.harmonics.reduce((sum, h) => {
        const phase = h.rateRadPerDay * (2451545 + t - h.epochJdTt)
        return sum + h.cosine * Math.cos(phase) + h.sine * Math.sin(phase)
      }, 0)
      assert.ok(Math.abs(predicted - signal(t)) < 1e-9)
    }
  })

  it('rejects irregular samples and an unresolved term count', () => {
    assert.throws(() => fitCosineSeries([0, 1, 3, 4], [1, 2, 3, 4], 2), /uniform/)
    assert.throws(() => fitCosineSeries([0, 1, 2, 3], [1, NaN, 3, 4], 2), /finite/)
    assert.throws(() => fitCosineSeries([0, 1, 2, 3], [1, 2, 3, 4], 3), /fewer terms/)
  })
})
