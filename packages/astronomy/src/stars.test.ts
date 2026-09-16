import { describe, expect, it } from 'vitest'
import { PARSEC_KM, directionFromRaDec, skyBasis, starAstrometry, starStateKm } from './stars.js'
import { BODIES } from './bodies.js'

describe('star astrometry', () => {
  it('places Betelgeuse at its catalogue distance along its catalogue direction at the position epoch', () => {
    const star = starAstrometry('betelgeuse')
    const state = starStateKm('betelgeuse', 2451545)
    expect(Math.hypot(...state.positionKm) / PARSEC_KM).toBeCloseTo(168, 9)
    const direction = directionFromRaDec(star.rightAscensionDegrees, star.declinationDegrees)
    for (let axis = 0; axis < 3; axis++) expect(state.positionKm[axis]! / Math.hypot(...state.positionKm)).toBeCloseTo(direction[axis]!, 12)
  })
  it('carries the catalogue proper motion and radial velocity as a space velocity', () => {
    const star = starAstrometry('betelgeuse'), state = starStateKm('betelgeuse', 2461286.5)
    const direction = directionFromRaDec(star.rightAscensionDegrees, star.declinationDegrees)
    const radialKmPerS = state.velocityKmPerDay.reduce((sum, v, axis) => sum + v * direction[axis]!, 0) / 86400
    expect(radialKmPerS).toBeCloseTo(star.radialVelocityKmPerS, 9)
    const { east, north } = skyBasis(star.rightAscensionDegrees, star.declinationDegrees)
    const tangential = (basis: readonly number[]) => state.velocityKmPerDay.reduce((sum, v, axis) => sum + v * basis[axis]!, 0)
    const masPerYear = (kmPerDay: number) => kmPerDay * 365.25 / (star.distanceParsecs * PARSEC_KM) * 180 / Math.PI * 3.6e6
    expect(masPerYear(tangential(east))).toBeCloseTo(star.properMotionRaMasPerYear, 9)
    expect(masPerYear(tangential(north))).toBeCloseTo(star.properMotionDecMasPerYear, 9)
    // 26.7 years at 21.91 km/s along the line of sight is 1.845e10 km, 6e-7 of the distance: carried, invisible.
    const displacementKm = Math.hypot(...state.positionKm) - 168 * PARSEC_KM
    expect(displacementKm).toBeGreaterThan(1.8e10)
    expect(displacementKm).toBeLessThan(1.9e10)
  })
  it('is a parentless star with a physical radius', () => {
    expect(BODIES.betelgeuse.parent).toBeNull()
    expect(BODIES.betelgeuse.meanRadiusKm).toBe(531514800)
  })
})
