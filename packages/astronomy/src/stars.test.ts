import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { PARSEC_KM, directionFromRaDec, skyBasis, skyPlaneOrientation, starAstrometry, starStateKm } from './stars.js'
import { BODIES } from './bodies.js'

describe('star astrometry', () => {
  it('places Betelgeuse at its catalogue distance along its catalogue direction at the position epoch', () => {
    const star = starAstrometry('betelgeuse')
    const state = starStateKm('betelgeuse', 2451545)
    assert.ok(Math.abs((Math.hypot(...state.positionKm) / PARSEC_KM) - (168)) < 10 ** -9 / 2, `${(Math.hypot(...state.positionKm) / PARSEC_KM)} is not close to ${168}`)
    const direction = directionFromRaDec(star.rightAscensionDegrees, star.declinationDegrees)
    for (let axis = 0; axis < 3; axis++) assert.ok(Math.abs((state.positionKm[axis]! / Math.hypot(...state.positionKm)) - (direction[axis]!)) < 10 ** -12 / 2, `${(state.positionKm[axis]! / Math.hypot(...state.positionKm))} is not close to ${direction[axis]!}`)
  })
  it('carries the catalogue proper motion and radial velocity as a space velocity', () => {
    const star = starAstrometry('betelgeuse'), state = starStateKm('betelgeuse', 2461286.5)
    const direction = directionFromRaDec(star.rightAscensionDegrees, star.declinationDegrees)
    const radialKmPerS = state.velocityKmPerDay.reduce((sum, v, axis) => sum + v * direction[axis]!, 0) / 86400
    assert.ok(Math.abs(radialKmPerS - (star.radialVelocityKmPerS)) < 10 ** -9 / 2, `${radialKmPerS} is not close to ${star.radialVelocityKmPerS}`)
    const { east, north } = skyBasis(star.rightAscensionDegrees, star.declinationDegrees)
    const tangential = (basis: readonly number[]) => state.velocityKmPerDay.reduce((sum, v, axis) => sum + v * basis[axis]!, 0)
    const masPerYear = (kmPerDay: number) => kmPerDay * 365.25 / (star.distanceParsecs * PARSEC_KM) * 180 / Math.PI * 3.6e6
    assert.ok(Math.abs(masPerYear(tangential(east)) - (star.properMotionRaMasPerYear)) < 10 ** -9 / 2, `${masPerYear(tangential(east))} is not close to ${star.properMotionRaMasPerYear}`)
    assert.ok(Math.abs(masPerYear(tangential(north)) - (star.properMotionDecMasPerYear)) < 10 ** -9 / 2, `${masPerYear(tangential(north))} is not close to ${star.properMotionDecMasPerYear}`)
    // 26.7 years at 21.91 km/s along the line of sight is 1.845e10 km, 6e-7 of the distance: carried, invisible.
    const displacementKm = Math.hypot(...state.positionKm) - 168 * PARSEC_KM
    assert.ok(displacementKm > 1.8e10)
    assert.ok(displacementKm < 1.9e10)
  })
  it('is a parentless star with a physical radius', () => {
    assert.equal(BODIES.betelgeuse.parent, null)
    assert.equal(BODIES.betelgeuse.meanRadiusKm, 531514800)
  })
  it('places a sky-plane axis at its position angle with longitude 0 toward the Earth, north and south of the equator', () => {
    for (const star of [{ rightAscensionDegrees: 335.684, declinationDegrees: -45.948 }, { rightAscensionDegrees: 83.053, declinationDegrees: 18.594 }]) {
      for (const positionAngle of [0, 48, -120]) {
        const orientation = skyPlaneOrientation(star, positionAngle)
        const pole = directionFromRaDec(orientation.rightAscensionDegrees, orientation.declinationDegrees)
        const sight = directionFromRaDec(star.rightAscensionDegrees, star.declinationDegrees), { east, north } = skyBasis(star.rightAscensionDegrees, star.declinationDegrees)
        const dot = (a: readonly number[], b: readonly number[]) => a.reduce((sum, v, i) => sum + v * b[i]!, 0)
        assert.ok(Math.abs(dot(pole, sight) - (0)) < 10 ** -12 / 2, `${dot(pole, sight)} is not close to ${0}`)
        assert.ok(Math.abs((Math.atan2(dot(pole, east), dot(pole, north)) * 180 / Math.PI) - (positionAngle)) < 10 ** -9 / 2, `${(Math.atan2(dot(pole, east), dot(pole, north)) * 180 / Math.PI)} is not close to ${positionAngle}`)
        // The body's +x axis at meridian W, rotated from the node about the pole, points at the Earth.
        const node = [-pole[1]! / Math.hypot(pole[0]!, pole[1]!), pole[0]! / Math.hypot(pole[0]!, pole[1]!), 0]
        const w = orientation.displayMeridianDegrees * Math.PI / 180
        const cross = [pole[1]! * node[2]! - pole[2]! * node[1]!, pole[2]! * node[0]! - pole[0]! * node[2]!, pole[0]! * node[1]! - pole[1]! * node[0]!]
        const primeMeridian = node.map((v, i) => Math.cos(w) * v + Math.sin(w) * cross[i]!)
        for (let axis = 0; axis < 3; axis++) assert.ok(Math.abs((primeMeridian[axis]!) - (-sight[axis]!)) < 10 ** -9 / 2, `${(primeMeridian[axis]!)} is not close to ${-sight[axis]!}`)
      }
    }
  })
})
