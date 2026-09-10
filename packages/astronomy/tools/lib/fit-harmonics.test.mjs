import { describe, expect, it } from 'vitest'
import { fitHarmonics } from './fit-harmonics.mts'

describe('preparation harmonic fit', () => {
  it('recovers a known bounded signal without a secular term or cancelling near-duplicate frequencies', () => {
    const days = Array.from({ length: 161 }, (_, i) => i * 2.5)
    const signal = t => 8 + 3 * Math.cos(2 * Math.PI * t / 100) + 2 * Math.sin(2 * Math.PI * t / 47)
    const separation = 2 * Math.PI / 400 / 4
    const fit = fitHarmonics(days, days.map(signal), { intercept: 0, slope: 0 }, 2, { trend: false, separation })
    expect(fit.slope).toBe(0)
    expect(Math.abs(fit.harmonics[0].rateRadPerDay - fit.harmonics[1].rateRadPerDay)).toBeGreaterThanOrEqual(separation)
    expect(fit.harmonics.reduce((sum, h) => sum + Math.hypot(h.cosine, h.sine), 0)).toBeLessThan(5.01)
    for (const t of [0.123, 78.9, 253.17, 399.3]) {
      const predicted = fit.intercept + fit.harmonics.reduce((sum, h) => {
        const angle = h.rateRadPerDay * (2451545 + t - h.epochJdTt)
        return sum + h.cosine * Math.cos(angle) + h.sine * Math.sin(angle)
      }, 0)
      expect(Math.abs(predicted - signal(t))).toBeLessThan(0.001)
    }
  })

  it('keeps a finite fit when a refinement crosses a forbidden frequency interval', () => {
    const days = Array.from({ length: 161 }, (_, i) => i * 2.5)
    const values = days.map(t => 8 + 3 * Math.cos(2 * Math.PI * t / 100) + 2 * Math.sin(2 * Math.PI * t / 47))
    const separation = 2 * Math.PI / 400
    const fit = fitHarmonics(days, values, { intercept: 0, slope: 0 }, 6, { trend: false, separation })
    expect(Number.isFinite(fit.intercept)).toBe(true)
    for (const [i, h] of fit.harmonics.entries()) {
      expect(Number.isFinite(h.cosine) && Number.isFinite(h.sine)).toBe(true)
      for (const other of fit.harmonics.slice(i + 1)) {
        expect(Math.abs(h.rateRadPerDay - other.rateRadPerDay)).toBeGreaterThanOrEqual(separation)
      }
    }
  })

})
