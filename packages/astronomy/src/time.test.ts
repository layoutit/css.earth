import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
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
    assert.equal(unixMsToJdUtc(0), 2440587.5)
  })

  it('round-trips unix milliseconds to within the float64 JD step', () => {
    const ms = Date.UTC(2026, 7, 30, 3, 41, 12)
    // Budget: one float64 step at JD ~2.46e6 is ~5.5e-10 d ~= 0.05 ms. Asking
    // for microseconds would be asking for digits the representation does not
    // have — see the resolution note in time.ts.
    assert.ok(Math.abs(jdUtcToUnixMs(unixMsToJdUtc(ms)) - (ms)) < 10 ** -1 / 2, `${jdUtcToUnixMs(unixMsToJdUtc(ms))} is not close to ${ms}`)
  })

  it('resolves to better than a tenth of a millisecond', () => {
    const ms = Date.UTC(2026, 7, 30, 3, 41, 12)
    const error = Math.abs(jdUtcToUnixMs(unixMsToJdUtc(ms)) - ms)
    assert.ok(error < 0.1)
  })

  it('round-trips UTC to TT', () => {
    const jd = 2460977.5
    assert.ok(Math.abs(jdTtToJdUtc(jdUtcToJdTt(jd)) - (jd)) < 10 ** -12 / 2, `${jdTtToJdUtc(jdUtcToJdTt(jd))} is not close to ${jd}`)
  })

  it('offsets TT from UTC by 69.184 s', () => {
    // Same budget: the offset is recovered by differencing two ~2.45e6 values,
    // so it carries one JD step (~4e-5 s) of noise.
    assert.ok(Math.abs(((jdUtcToJdTt(J2000_JD) - J2000_JD) * 86400) - (69.184)) < 10 ** -4 / 2, `${((jdUtcToJdTt(J2000_JD) - J2000_JD) * 86400)} is not close to ${69.184}`)
  })

  it('measures centuries from J2000', () => {
    assert.equal(centuriesSinceJ2000(J2000_JD), 0)
    assert.equal(centuriesSinceJ2000(J2000_JD + 36525), 1)
  })
})
