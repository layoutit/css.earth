import { describe, expect, it } from 'vitest'
import { hostSkyFrame, hostedOrbit, hostedOrbitApoapsisKm, hostedOrbitPhase, hostedOrbitPhaseBmjdTdb, hostedOrbitStateRelativeBmjdTdb, hostedOrbitStateRelativeKm, hostedPlanetStateRelativeKm, HOSTED_PLANET_IDS, type HostedOrbit } from './hostedOrbits.js'
import { directionFromRaDec, skyBasis, starAstrometry } from './stars.js'
import { BODIES, EXOPLANET_IDS } from './bodies.js'

const dot = (a: readonly number[], b: readonly number[]) => a.reduce((sum, v, i) => sum + v * b[i]!, 0)
const cross = (a: readonly number[], b: readonly number[]) => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!]
const hostRadiusKm = BODIES['wasp-43'].meanRadiusKm
const eccentricOrbit: HostedOrbit = {
  periodDays: 5,
  semiMajorAxisStellarRadii: 8,
  inclinationDegrees: 87,
  eccentricity: 0.4,
  argumentOfPeriapsisDegrees: 30,
  epochDefinition: 'inferior-conjunction',
  transitTimeBmjdTdb: 60000,
  ascendingNodePositionAngleDegrees: 41,
  sources: { period: 'test', shape: 'test', phase: 'test', orientation: 'test' },
}

describe('hosted orbits', () => {
  it('compiles each exoplanet hosted by its placed star', () => {
    const trappist = ['trappist-1b', 'trappist-1c', 'trappist-1d', 'trappist-1e', 'trappist-1f', 'trappist-1g', 'trappist-1h']
    expect([...HOSTED_PLANET_IDS].sort()).toEqual([...EXOPLANET_IDS].sort())
    for (const id of HOSTED_PLANET_IDS) {
      const parent = BODIES[id].parent
      expect(parent, id).not.toBeNull()
      expect(starAstrometry(parent as Parameters<typeof starAstrometry>[0]), id).toBeDefined()
    }
    for (const id of trappist) expect(BODIES[id as keyof typeof BODIES].parent).toBe('trappist-1')
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
  it('puts each TRAPPIST-1 planet in front of its star at mid-transit, a cos i off centre, and behind it half an orbit later', () => {
    const star = starAstrometry('trappist-1'), sight = directionFromRaDec(star.rightAscensionDegrees, star.declinationDegrees)
    const radiusKm = BODIES['trappist-1'].meanRadiusKm
    for (const id of ['trappist-1b', 'trappist-1c', 'trappist-1d', 'trappist-1e', 'trappist-1f', 'trappist-1g', 'trappist-1h'] as const) {
      const orbit = hostedOrbit(id), transit = orbit.transitTimeBmjdTdb + 2400000.5 + 1000 * orbit.periodDays
      const inFront = hostedOrbitStateRelativeKm(orbit, star, radiusKm, transit), along = dot(inFront.positionKm, sight)
      expect(along, id).toBeLessThan(0)
      const skySeparation = Math.hypot(...inFront.positionKm.map((v, axis) => v - along * sight[axis]!)) / radiusKm
      expect(skySeparation, id).toBeCloseTo(orbit.semiMajorAxisStellarRadii * Math.cos(orbit.inclinationDegrees * Math.PI / 180), 6)
      // Every planet transits: the impact parameter stays inside the stellar disc.
      expect(skySeparation, id).toBeLessThan(1)
      expect(dot(hostedOrbitStateRelativeKm(orbit, star, radiusKm, transit + orbit.periodDays / 2).positionKm, sight), id).toBeGreaterThan(0)
    }
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
    expect(hostedOrbitPhaseBmjdTdb(orbit, orbit.transitTimeBmjdTdb + 2.5 * orbit.periodDays) / (2 * Math.PI)).toBeCloseTo(2.5, 9)
  })
  it('preserves the exact original propagator for circular source-pinned orbits', () => {
    for (const id of HOSTED_PLANET_IDS) {
      const orbit = hostedOrbit(id), host = starAstrometry(BODIES[id].parent as Parameters<typeof starAstrometry>[0])
      const radiusKm = BODIES[BODIES[id].parent as keyof typeof BODIES].meanRadiusKm
      const epochJdTt = orbit.transitTimeBmjdTdb + 2400000.5 + 1234.5 * orbit.periodDays
      const a = orbit.semiMajorAxisStellarRadii * radiusKm, inclination = orbit.inclinationDegrees * (Math.PI / 180)
      const phase = 2 * Math.PI * (epochJdTt - 2400000.5 - orbit.transitTimeBmjdTdb) / orbit.periodDays, rate = 2 * Math.PI / orbit.periodDays
      const { x, y, z } = hostSkyFrame(host, orbit.ascendingNodePositionAngleDegrees)
      const local = [a * Math.sin(phase), -a * Math.cos(inclination) * Math.cos(phase), a * Math.sin(inclination) * Math.cos(phase)]
      const localVelocity = [a * rate * Math.cos(phase), a * rate * Math.cos(inclination) * Math.sin(phase), -a * rate * Math.sin(inclination) * Math.sin(phase)]
      const toIcrf = (v: readonly number[]) => [0, 1, 2].map(axis => v[0]! * x[axis]! + v[1]! * y[axis]! + v[2]! * z[axis]!)
      expect(hostedOrbitStateRelativeKm(orbit, host, radiusKm, epochJdTt), id).toEqual({ positionKm: toIcrf(local), velocityKmPerDay: toIcrf(localVelocity) })
    }
  })
  it('propagates an eccentric orbit periodically with variable radius and speed', () => {
    const star = starAstrometry('wasp-43'), a = eccentricOrbit.semiMajorAxisStellarRadii * hostRadiusKm
    const omega = eccentricOrbit.argumentOfPeriapsisDegrees! * Math.PI / 180, e = eccentricOrbit.eccentricity
    const f0 = Math.PI / 2 - omega, beta = Math.sqrt(1 - e * e)
    const eccentricAnomaly0 = Math.atan2(beta * Math.sin(f0), e + Math.cos(f0))
    const meanAnomaly0 = eccentricAnomaly0 - e * Math.sin(eccentricAnomaly0)
    const periapsisBmjd = eccentricOrbit.transitTimeBmjdTdb - meanAnomaly0 * eccentricOrbit.periodDays / (2 * Math.PI)
    const periapsis = hostedOrbitStateRelativeBmjdTdb(eccentricOrbit, star, hostRadiusKm, periapsisBmjd)
    const apoapsis = hostedOrbitStateRelativeBmjdTdb(eccentricOrbit, star, hostRadiusKm, periapsisBmjd + eccentricOrbit.periodDays / 2)
    expect(Math.hypot(...periapsis.positionKm)).toBeCloseTo(a * (1 - e), 8)
    expect(Math.hypot(...apoapsis.positionKm)).toBeCloseTo(a * (1 + e), 8)
    expect(Math.hypot(...periapsis.velocityKmPerDay) / Math.hypot(...apoapsis.velocityKmPerDay)).toBeCloseTo((1 + e) / (1 - e), 10)
    expect(hostedOrbitApoapsisKm(eccentricOrbit, hostRadiusKm)).toBeCloseTo(Math.hypot(...apoapsis.positionKm), 8)
    const repeated = hostedOrbitStateRelativeBmjdTdb(eccentricOrbit, star, hostRadiusKm, periapsisBmjd + 7 * eccentricOrbit.periodDays)
    for (let axis = 0; axis < 3; axis++) expect(repeated.positionKm[axis]!).toBeCloseTo(periapsis.positionKm[axis]!, 7)
  })
  it('uses inferior conjunction for the eccentric epoch and keeps sky orientation separate', () => {
    const star = starAstrometry('wasp-43'), sight = directionFromRaDec(star.rightAscensionDegrees, star.declinationDegrees)
    const inFront = hostedOrbitStateRelativeBmjdTdb(eccentricOrbit, star, hostRadiusKm, eccentricOrbit.transitTimeBmjdTdb)
    expect(dot(inFront.positionKm, sight)).toBeLessThan(0)
    const omega = eccentricOrbit.argumentOfPeriapsisDegrees! * Math.PI / 180, e = eccentricOrbit.eccentricity
    const beta = Math.sqrt(1 - e * e), fBehind = 3 * Math.PI / 2 - omega
    const eBehind = Math.atan2(beta * Math.sin(fBehind), e + Math.cos(fBehind))
    const mBehind = eBehind - e * Math.sin(eBehind)
    const fFront = Math.PI / 2 - omega
    const eFront = Math.atan2(beta * Math.sin(fFront), e + Math.cos(fFront))
    const mFront = eFront - e * Math.sin(eFront)
    const elapsedMean = ((mBehind - mFront) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)
    const behindTime = eccentricOrbit.transitTimeBmjdTdb + elapsedMean * eccentricOrbit.periodDays / (2 * Math.PI)
    expect(dot(hostedOrbitStateRelativeBmjdTdb(eccentricOrbit, star, hostRadiusKm, behindTime).positionKm, sight)).toBeGreaterThan(0)
    const rotated = hostedOrbitStateRelativeBmjdTdb({ ...eccentricOrbit, ascendingNodePositionAngleDegrees: 137 }, star, hostRadiusKm, eccentricOrbit.transitTimeBmjdTdb)
    expect(Math.hypot(...rotated.positionKm)).toBeCloseTo(Math.hypot(...inFront.positionKm), 9)
    expect(dot(rotated.positionKm, sight)).toBeCloseTo(dot(inFront.positionKm, sight), 8)
  })
  it('returns analytic eccentric velocity independent of host RA and Dec', () => {
    const epoch = eccentricOrbit.transitTimeBmjdTdb + 1.37
    for (const host of [starAstrometry('wasp-43'), { rightAscensionDegrees: 14, declinationDegrees: -53 }]) {
      const state = hostedOrbitStateRelativeBmjdTdb(eccentricOrbit, host, hostRadiusKm, epoch), step = 1e-5
      const ahead = hostedOrbitStateRelativeBmjdTdb(eccentricOrbit, host, hostRadiusKm, epoch + step).positionKm
      const back = hostedOrbitStateRelativeBmjdTdb(eccentricOrbit, host, hostRadiusKm, epoch - step).positionKm
      for (let axis = 0; axis < 3; axis++) expect((ahead[axis]! - back[axis]!) / (2 * step) / state.velocityKmPerDay[axis]!).toBeCloseTo(1, 5)
    }
  })
  it('rejects incomplete or non-finite eccentric inputs', () => {
    const star = starAstrometry('wasp-43')
    expect(() => hostedOrbitStateRelativeBmjdTdb({ ...eccentricOrbit, argumentOfPeriapsisDegrees: undefined }, star, hostRadiusKm, 60000)).toThrow(/requires argumentOfPeriapsis/)
    expect(() => hostedOrbitStateRelativeBmjdTdb({ ...eccentricOrbit, epochDefinition: undefined }, star, hostRadiusKm, 60000)).toThrow(/epochDefinition/)
    expect(() => hostedOrbitStateRelativeBmjdTdb({ ...eccentricOrbit, eccentricity: 1 }, star, hostRadiusKm, 60000)).toThrow(/eccentricity/)
    expect(() => hostedOrbitStateRelativeBmjdTdb({ ...eccentricOrbit, argumentOfPeriapsisDegrees: Number.NaN }, star, hostRadiusKm, 60000)).toThrow(/argumentOfPeriapsis/)
    expect(() => hostedOrbitStateRelativeBmjdTdb({ ...eccentricOrbit, inclinationDegrees: 181 }, star, hostRadiusKm, 60000)).toThrow(/inclination/)
    expect(() => hostedOrbitStateRelativeBmjdTdb({ ...eccentricOrbit, ascendingNodePositionAngleDegrees: 360 }, star, hostRadiusKm, 60000)).toThrow(/ascendingNode/)
    expect(() => hostedOrbitStateRelativeBmjdTdb({ ...eccentricOrbit, argumentOfPeriapsisDegrees: -1 }, star, hostRadiusKm, 60000)).toThrow(/argumentOfPeriapsis/)
    expect(() => hostedOrbitStateRelativeBmjdTdb({ ...eccentricOrbit, semiMajorAxisStellarRadii: 1.5 }, star, hostRadiusKm, 60000)).toThrow(/stellar surface/)
  })
})
