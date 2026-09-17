import { describe, expect, it } from 'vitest'
import { hostSkyFrame, hostedOrbit, hostedOrbitPhase, hostedOrbitStateRelativeKm, hostedPlanetStateRelativeKm, HOSTED_PLANET_IDS } from './hostedOrbits.js'
import { directionFromRaDec, skyBasis, starAstrometry } from './stars.js'
import { BODIES, EXOPLANET_IDS } from './bodies.js'

const dot = (a: readonly number[], b: readonly number[]) => a.reduce((sum, v, i) => sum + v * b[i]!, 0)
const cross = (a: readonly number[], b: readonly number[]) => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!]
const hostRadiusKm = BODIES['wasp-43'].meanRadiusKm

describe('hosted orbits', () => {
  it('compiles each exoplanet hosted by its placed star', () => {
    expect(EXOPLANET_IDS).toEqual(['hd-189733b', 'wasp-43b'])
    // Hosted orbits keep the order the records were compiled in, which is the order their packages were added.
    expect(HOSTED_PLANET_IDS).toEqual(['wasp-43b', 'hd-189733b'])
    expect(BODIES['wasp-43b'].parent).toBe('wasp-43')
    expect(BODIES['hd-189733b'].parent).toBe('hd-189733')
    // Rp/R* 0.15883 of WASP-43's 0.665 solar radii, 0.155313 of HD 189733 A's 0.752.
    expect(BODIES['wasp-43b'].meanRadiusKm / hostRadiusKm).toBeCloseTo(0.15883, 6)
    expect(BODIES['hd-189733b'].meanRadiusKm / BODIES['hd-189733'].meanRadiusKm).toBeCloseTo(0.155313, 6)
  })
  it('builds a right-handed observer frame with the node on the sky and +Z toward the observer', () => {
    const star = starAstrometry('wasp-43'), sight = directionFromRaDec(star.rightAscensionDegrees, star.declinationDegrees)
    const { east, north } = skyBasis(star.rightAscensionDegrees, star.declinationDegrees)
    for (const angle of [0, 90, 213]) {
      const { x, y, z } = hostSkyFrame(star, angle)
      for (let axis = 0; axis < 3; axis++) expect(cross(x, y)[axis]!).toBeCloseTo(z[axis]!, 12)
      expect(dot(z, sight)).toBeCloseTo(-1, 12)
      expect(Math.atan2(dot(x, east), dot(x, north)) * 180 / Math.PI).toBeCloseTo(angle > 180 ? angle - 360 : angle, 9)
    }
  })
  it('puts the planet in front of the star at mid-transit, a cos i off centre, and behind it half an orbit later', () => {
    const orbit = hostedOrbit('wasp-43b'), star = starAstrometry('wasp-43')
    const sight = directionFromRaDec(star.rightAscensionDegrees, star.declinationDegrees)
    const transit = orbit.transitTimeBmjdTdb + 2400000.5 + 7000 * orbit.periodDays
    const inFront = hostedOrbitStateRelativeKm(orbit, star, hostRadiusKm, transit)
    const along = dot(inFront.positionKm, sight)
    expect(along).toBeLessThan(0)
    const skySeparation = Math.hypot(...inFront.positionKm.map((v, axis) => v - along * sight[axis]!)) / hostRadiusKm
    // The impact parameter b = a cos i = 4.8767 cos 82.155 degrees = 0.6655 stellar radii.
    expect(skySeparation).toBeCloseTo(orbit.semiMajorAxisStellarRadii * Math.cos(orbit.inclinationDegrees * Math.PI / 180), 6)
    expect(skySeparation).toBeCloseTo(0.6655, 3)
    const behind = hostedOrbitStateRelativeKm(orbit, star, hostRadiusKm, transit + orbit.periodDays / 2)
    expect(dot(behind.positionKm, sight)).toBeGreaterThan(0)
  })
  it('moves on a circle at the Keplerian speed with the orbit normal inclined i to the line of sight', () => {
    const orbit = hostedOrbit('wasp-43b'), state = hostedPlanetStateRelativeKm('wasp-43b', 2461286.5)
    const a = orbit.semiMajorAxisStellarRadii * hostRadiusKm
    expect(state.hostId).toBe('wasp-43')
    expect(Math.hypot(...state.positionKm) / a).toBeCloseTo(1, 12)
    expect(Math.hypot(...state.velocityKmPerDay) / (2 * Math.PI * a / orbit.periodDays)).toBeCloseTo(1, 12)
    expect(dot(state.positionKm, state.velocityKmPerDay) / a ** 2).toBeCloseTo(0, 9)
    const star = starAstrometry('wasp-43'), sight = directionFromRaDec(star.rightAscensionDegrees, star.declinationDegrees)
    const normal = cross(state.positionKm, state.velocityKmPerDay), length = Math.hypot(...normal)
    // Inclination is measured from the direction toward the observer, the conventional sense for a transiting planet.
    expect(Math.acos(-dot(normal, sight) / length) * 180 / Math.PI).toBeCloseTo(orbit.inclinationDegrees, 9)
    // A numerical derivative of the position agrees with the analytic velocity.
    const step = 1e-5, ahead = hostedPlanetStateRelativeKm('wasp-43b', 2461286.5 + step).positionKm, back = hostedPlanetStateRelativeKm('wasp-43b', 2461286.5 - step).positionKm
    for (let axis = 0; axis < 3; axis++) expect((ahead[axis]! - back[axis]!) / (2 * step) / state.velocityKmPerDay[axis]!).toBeCloseTo(1, 4)
  })
  it('counts phase from the transit time in orbits', () => {
    const orbit = hostedOrbit('wasp-43b')
    expect(hostedOrbitPhase(orbit, orbit.transitTimeBmjdTdb + 2400000.5)).toBeCloseTo(0, 6)
    expect(hostedOrbitPhase(orbit, orbit.transitTimeBmjdTdb + 2400000.5 + 2.5 * orbit.periodDays) / (2 * Math.PI)).toBeCloseTo(2.5, 9)
  })
})
