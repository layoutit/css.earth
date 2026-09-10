import { describe, expect, it } from 'vitest'
import { fitCosineSeries } from './fit-cosine-series.mts'

describe('prepared cosine residual series', () => {
  it('recovers independent low-frequency modes with the correct midpoint phase', () => {
    const days = Array.from({ length: 161 }, (_, i) => 7500 + i * 2.5)
    const signal = t => 8 + 3 * Math.cos(Math.PI * (t - 7500) / 400) - 2 * Math.cos(7 * Math.PI * (t - 7500) / 400)
    const fit = fitCosineSeries(days, days.map(signal), 32)
    expect(fit.slope).toBe(0)
    expect(fit.intercept).toBeCloseTo(8, 10)
    expect(fit.harmonics.reduce((sum, h) => sum + Math.hypot(h.cosine, h.sine), 0)).toBeCloseTo(5, 10)
    for (const t of [7500.123, 7510.76, 7723.123, 7899.875]) {
      const predicted = fit.intercept + fit.harmonics.reduce((sum, h) => {
        const phase = h.rateRadPerDay * (2451545 + t - h.epochJdTt)
        return sum + h.cosine * Math.cos(phase) + h.sine * Math.sin(phase)
      }, 0)
      expect(Math.abs(predicted - signal(t))).toBeLessThan(1e-9)
    }
  })

  it('rejects irregular samples and an unresolved term count', () => {
    expect(() => fitCosineSeries([0, 1, 3, 4], [1, 2, 3, 4], 2)).toThrow(/uniform/)
    expect(() => fitCosineSeries([0, 1, 2, 3], [1, NaN, 3, 4], 2)).toThrow(/finite/)
    expect(() => fitCosineSeries([0, 1, 2, 3], [1, 2, 3, 4], 3)).toThrow(/fewer terms/)
  })
})
