import { describe, expect, it } from 'vitest'
import { distance, magnitude } from './__fixtures__/compare.js'
import {
  ARCSEC_PER_RAD,
  OBLIQUITY_J2000_RAD,
  RAD_PER_ARCSEC,
  RAD_PER_DEG,
  VSOP87_TO_ICRF,
  applyMatrix3,
  arcsecToRad,
  degToRad,
  eclipticJ2000ToIcrf,
  icrfToEclipticJ2000,
  normalizeAngleRad,
  radToDeg,
  vsop87ToIcrf,
} from './angles.js'
import type { Vec3 } from './vec3.js'

describe('angle units', () => {
  it('round-trips degrees and arcseconds', () => {
    for (const deg of [0, 1, -1, 23.4392911, 359.999, -720.5]) {
      expect(radToDeg(degToRad(deg))).toBeCloseTo(deg, 12)
    }
    expect(arcsecToRad(3600)).toBeCloseTo(degToRad(1), 15)
    expect(RAD_PER_ARCSEC * ARCSEC_PER_RAD).toBeCloseTo(1, 15)
    expect(RAD_PER_DEG * 180).toBeCloseTo(Math.PI, 15)
  })

  it('normalizes into [0, 2*pi) including negatives and many turns', () => {
    for (const rad of [0, 0.5, -0.5, Math.PI, 7 * Math.PI, -7 * Math.PI, 1e6]) {
      const wrapped = normalizeAngleRad(rad)
      expect(wrapped).toBeGreaterThanOrEqual(0)
      expect(wrapped).toBeLessThan(2 * Math.PI)
      expect(Math.abs(Math.sin(wrapped) - Math.sin(rad))).toBeLessThan(1e-9)
      expect(Math.abs(Math.cos(wrapped) - Math.cos(rad))).toBeLessThan(1e-9)
    }
  })
})

describe('the ecliptic-to-ICRF rotation', () => {
  const sample: Vec3 = [0.34057967686, -1.38700201594, -0.03741722679]

  it('is an inverse pair', () => {
    expect(distance(icrfToEclipticJ2000(eclipticJ2000ToIcrf(sample)), sample)).toBeLessThan(1e-15)
    expect(distance(eclipticJ2000ToIcrf(icrfToEclipticJ2000(sample)), sample)).toBeLessThan(1e-15)
  })

  it('preserves length and the shared x axis', () => {
    const rotated = eclipticJ2000ToIcrf(sample)
    expect(magnitude(rotated)).toBeCloseTo(magnitude(sample), 12)
    expect(rotated[0]).toBe(sample[0])
  })

  it('turns the ecliptic pole by exactly the obliquity', () => {
    const eclipticPole: Vec3 = [0, 0, 1]
    const inIcrf = eclipticJ2000ToIcrf(eclipticPole)
    expect(Math.acos(inIcrf[2])).toBeCloseTo(OBLIQUITY_J2000_RAD, 14)
    expect(OBLIQUITY_J2000_RAD * ARCSEC_PER_RAD).toBeCloseTo(84381.448, 6)
  })
})

describe('the VSOP87 dynamical-frame rotation', () => {
  it('is orthonormal to the precision the published matrix is quoted at', () => {
    // The matrix in `vsop87.txt` is given to twelve decimals, so it is
    // orthonormal only to about 1e-12. Asserting that rather than assuming it
    // is exact: rounding it into an exact rotation would silently change the
    // frame it defines.
    const columns = [0, 1, 2].map((c) => [VSOP87_TO_ICRF[c]!, VSOP87_TO_ICRF[c + 3]!, VSOP87_TO_ICRF[c + 6]!])
    for (const column of columns) expect(Math.abs(magnitude(column) - 1)).toBeLessThan(1e-11)
    const dot = (a: number[], b: number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!
    expect(Math.abs(dot(columns[0]!, columns[1]!))).toBeLessThan(1e-11)
    expect(Math.abs(dot(columns[1]!, columns[2]!))).toBeLessThan(1e-11)
    expect(Math.abs(dot(columns[0]!, columns[2]!))).toBeLessThan(1e-11)
  })

  it('is NOT the obliquity rotation — it carries the dynamical-equinox offset too', () => {
    // The whole reason `vsop87ToIcrf` exists as a separate matrix. If it were
    // the same as `eclipticJ2000ToIcrf`, VSOP87 and ELP2000 positions would be
    // wrong by a fixed 0.1 arcsecond in ecliptic longitude, which at 1 au is
    // 70 km — inside every budget in this package and therefore invisible.
    const sample: Vec3 = [0.7, -0.6, 0.05]
    const throughDynamical = vsop87ToIcrf(sample)
    const throughObliquityOnly = eclipticJ2000ToIcrf(sample)
    const separationArcsec = (distance(throughDynamical, throughObliquityOnly) / magnitude(sample)) * ARCSEC_PER_RAD
    expect(separationArcsec).toBeGreaterThan(0.05)
    expect(separationArcsec).toBeLessThan(0.5)
  })

  it('agrees with applyMatrix3 on the same matrix', () => {
    const sample: Vec3 = [1, 2, 3]
    expect(vsop87ToIcrf(sample)).toEqual(applyMatrix3(VSOP87_TO_ICRF, sample))
  })
})
