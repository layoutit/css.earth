import { describe, expect, it } from 'vitest'
import {
  J2000_JD,
  centuriesSinceJ2000,
  jdUtcToJdTt,
  jdUtcToUnixMs,
  jdTtToJdUtc,
  unixMsToJdUtc,
} from './time.js'

describe('julian dates', () => {
  it('places the unix epoch at JD 2440587.5', () => {
    expect(unixMsToJdUtc(0)).toBe(2440587.5)
  })

  it('round-trips unix milliseconds to within the float64 JD step', () => {
    const ms = Date.UTC(2026, 7, 30, 3, 41, 12)
    // Budget: one float64 step at JD ~2.46e6 is ~5.5e-10 d ~= 0.05 ms. Asking
    // for microseconds would be asking for digits the representation does not
    // have — see the resolution note in time.ts.
    expect(jdUtcToUnixMs(unixMsToJdUtc(ms))).toBeCloseTo(ms, 1)
  })

  it('resolves to better than a tenth of a millisecond', () => {
    const ms = Date.UTC(2026, 7, 30, 3, 41, 12)
    const error = Math.abs(jdUtcToUnixMs(unixMsToJdUtc(ms)) - ms)
    expect(error).toBeLessThan(0.1)
  })

  it('round-trips UTC to TT', () => {
    const jd = 2460977.5
    expect(jdTtToJdUtc(jdUtcToJdTt(jd))).toBeCloseTo(jd, 12)
  })

  it('offsets TT from UTC by 69.184 s', () => {
    // Same budget: the offset is recovered by differencing two ~2.45e6 values,
    // so it carries one JD step (~4e-5 s) of noise.
    expect((jdUtcToJdTt(J2000_JD) - J2000_JD) * 86400).toBeCloseTo(69.184, 4)
  })

  it('measures centuries from J2000', () => {
    expect(centuriesSinceJ2000(J2000_JD)).toBe(0)
    expect(centuriesSinceJ2000(J2000_JD + 36525)).toBe(1)
  })
})
