import { keplerStateKm } from './kepler.js'
import { describe, expect, it } from 'vitest'
import { hostedKeplerElements, hostSkyFrame, hostedOrbit, hostedOrbitApoapsisKm, hostedOrbitPhase, hostedOrbitPhaseBmjdTdb, hostedOrbitStateRelativeBmjdTdb, hostedOrbitStateRelativeKm, hostedPlanetStateRelativeKm, HOSTED_PLANET_IDS, type HostedOrbit } from './hostedOrbits.js'
import { directionFromRaDec, skyBasis, starAstrometry } from './stars.js'
import { PARSEC_KM } from './index.js'
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
    const hd110067 = ['hd-110067b', 'hd-110067c', 'hd-110067d', 'hd-110067e', 'hd-110067f', 'hd-110067g']
    expect(EXOPLANET_IDS).toEqual(['beta-pictoris-b', 'beta-pictoris-c', 'beta-pictoris-d', ...hd110067, 'hd-189733b', 'hd-209458b', 'hd-29391-b', 'hr-8799-b', 'hr-8799-c', 'hr-8799-d', 'hr-8799-e', 'k2-18b', 'kepler-186f', 'kepler-452b', ...trappist, 'wasp-39b', 'wasp-43b'])
    // Hosted orbits keep the order the records were compiled in, which is the order their packages were added.
    expect(HOSTED_PLANET_IDS.filter(id => (EXOPLANET_IDS as readonly string[]).includes(id))).toEqual(['wasp-43b', 'hd-189733b', ...trappist, 'beta-pictoris-b', 'beta-pictoris-c', 'beta-pictoris-d', 'hr-8799-b', 'hr-8799-c', 'hr-8799-d', 'hr-8799-e', 'k2-18b', 'kepler-186f', 'kepler-452b', 'wasp-39b', 'hd-209458b', ...hd110067, 'hd-29391-b'])
    for (const id of hd110067) expect(BODIES[id as keyof typeof BODIES].parent).toBe('hd-110067')
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
  it('reproduces the analytic circle to rounding on every circular hosted orbit, through the shared Kepler propagator', () => {
    for (const id of HOSTED_PLANET_IDS.filter(id => hostedOrbit(id).eccentricity === 0)) {
      const orbit = hostedOrbit(id), host = starAstrometry(BODIES[id].parent as Parameters<typeof starAstrometry>[0])
      const radiusKm = BODIES[BODIES[id].parent as keyof typeof BODIES].meanRadiusKm
      const epochJdTt = orbit.transitTimeBmjdTdb + 2400000.5 + 1234.5 * orbit.periodDays
      const a = orbit.semiMajorAxisStellarRadii * radiusKm, inclination = orbit.inclinationDegrees * (Math.PI / 180)
      const phase = 2 * Math.PI * (epochJdTt - 2400000.5 - orbit.transitTimeBmjdTdb) / orbit.periodDays, rate = 2 * Math.PI / orbit.periodDays
      const { x, y, z } = hostSkyFrame(host, orbit.ascendingNodePositionAngleDegrees)
      const local = [a * Math.sin(phase), -a * Math.cos(inclination) * Math.cos(phase), a * Math.sin(inclination) * Math.cos(phase)]
      const localVelocity = [a * rate * Math.cos(phase), a * rate * Math.cos(inclination) * Math.sin(phase), -a * rate * Math.sin(inclination) * Math.sin(phase)]
      const toIcrf = (v: readonly number[]) => [0, 1, 2].map(axis => v[0]! * x[axis]! + v[1]! * y[axis]! + v[2]! * z[axis]!)
      const state = hostedOrbitStateRelativeKm(orbit, host, radiusKm, epochJdTt), position = toIcrf(local), velocity = toIcrf(localVelocity)
      const miss = (a: readonly number[], b: readonly number[]) => Math.hypot(...a.map((v, i) => v - b[i]!)) / Math.hypot(...b)
      // Measured 4e-13 to 1.4e-12 for the thirteen shipped planets: float rounding in a different order of operations.
      expect(miss(state.positionKm, position), id).toBeLessThan(1e-11)
      expect(miss(state.velocityKmPerDay, velocity), id).toBeLessThan(1e-11)
    }
  })
  it('is an ordinary Kepler element set: keplerStateKm on hostedKeplerElements gives every hosted planet its state', () => {
    for (const id of HOSTED_PLANET_IDS) {
      const orbit = hostedOrbit(id), host = starAstrometry(BODIES[id].parent as Parameters<typeof starAstrometry>[0])
      const radiusKm = BODIES[BODIES[id].parent as keyof typeof BODIES].meanRadiusKm
      const elements = hostedKeplerElements(orbit, host, radiusKm), epochJdTt = orbit.transitTimeBmjdTdb + 2400000.5 + 7.25 * orbit.periodDays
      const viaKepler = keplerStateKm(elements, epochJdTt), hosted = hostedOrbitStateRelativeKm(orbit, host, radiusKm, epochJdTt)
      // The elements carry a Julian Date epoch; one rounding step of a 2.46-million-day JD times WASP-43b's 7.7 rad/day mean motion is
      // 1.35e-9 of its orbit, 3 mm. The state function keeps its epochs in BMJD and does not pay it.
      expect(Math.hypot(...viaKepler.positionKm.map((v, i) => v - hosted.positionKm[i]!)) / Math.hypot(...hosted.positionKm), id).toBeLessThan(1e-8)
      expect(elements.meanMotionRadPerDay, id).toBe(2 * Math.PI / orbit.periodDays)
      expect(elements.semiMajorAxisKm, id).toBe(orbit.semiMajorAxisStellarRadii * radiusKm)
      expect(elements.eccentricity, id).toBe(orbit.eccentricity)
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
    expect(Math.abs(Math.hypot(...rotated.positionKm) / Math.hypot(...inFront.positionKm) - 1)).toBeLessThan(1e-13)
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
  it('places the imaged planets of Beta Pictoris where GRAVITY and the discovery astrometry measured them', () => {
    // Lacour et al. (2021, A&A 654, L2), Table 1: relative astrometry of b and c in mas (dRA, dDec) at MJD; Sutlieff et al. (2026,
    // arXiv:2606.23801), Table 1: separation and position angle of d. The records store the orbitize! elements (Blunt et al. 2020)
    // with the planet's omega as the star's; the positions below are the paper's own measurements, so they check that mapping.
    const star = starAstrometry('beta-pictoris'), radiusKm = BODIES['beta-pictoris'].meanRadiusKm
    const { east, north } = skyBasis(star.rightAscensionDegrees, star.declinationDegrees)
    const distanceKm = star.distanceParsecs * PARSEC_KM
    const skyMas = (id: 'beta-pictoris-b' | 'beta-pictoris-c' | 'beta-pictoris-d', mjd: number) => {
      const p = hostedOrbitStateRelativeKm(hostedOrbit(id), star, radiusKm, mjd + 2400000.5).positionKm
      return [dot(p, east), dot(p, north)].map(v => v / distanceKm * 206264.80624709636 * 1000)
    }
    const gravity = {
      'beta-pictoris-b': [[58383.378, 68.47, 126.38], [58796.170, 145.51, 248.59], [58798.356, 145.65, 249.21], [58855.065, 155.41, 264.33], [58889.139, 160.96, 273.41], [59221.238, 211.59, 352.62], [59453.395, 240.63, 397.89]],
      'beta-pictoris-c': [[58889.140, -67.36, -112.59], [58891.065, -67.67, -113.20], [58916.043, -71.88, -119.60], [59220.163, -52.00, -80.86]],
    } as const
    for (const [id, points] of Object.entries(gravity) as [keyof typeof gravity, readonly (readonly [number, number, number])[]][]) {
      let sum = 0
      for (const [mjd, dra, ddec] of points) { const [x, y] = skyMas(id, mjd); sum += (x! - dra) ** 2 + (y! - ddec) ** 2 }
      // The medians of a posterior reproduce the fitted points to a few milliarcseconds, against orbits 140 to 510 mas across.
      expect(Math.sqrt(sum / points.length), id).toBeLessThan(3)
    }
    const mjdOf = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86400000 + 40587
    const d = [['2014-12-08', 375, 208.0, 20, 2.0], ['2019-03-11', 719, 209.6, 12, 1.0], ['2020-02-08', 784, 209.4, 15, 1.0], ['2023-03-18', 1012, 210.4, 20, 1.0], ['2025-03-22', 1104, 211.1, 20, 1.0], ['2025-12-03', 1126.9, 210.35, 3.9, 0.22]] as const
    let chi2 = 0
    for (const [date, separation, positionAngle, sigmaSeparation, sigmaAngle] of d) {
      const [x, y] = skyMas('beta-pictoris-d', mjdOf(date)), sep = Math.hypot(x!, y!), pa = ((Math.atan2(x!, y!) * 180 / Math.PI) + 360) % 360
      chi2 += ((sep - separation) / sigmaSeparation) ** 2 + ((pa - positionAngle) / sigmaAngle) ** 2
    }
    // A circular display orbit at the published semi-major axis, node and inclination, phased to the six epochs: chi-squared 12.5 for 11 degrees of freedom.
    expect(chi2).toBeLessThan(14)
  })
  it('places the four planets of HR 8799 where JWST measured them after the fit', () => {
    // Balmer et al. (2025, AJ; arXiv:2503.13608), Table 2: astrometry combined over the NIRCam LWB filters of GTO 1194 on MJD 60253.39,
    // (dRA, dDec, sigma dRA, sigma dDec) in mas. Zurlo et al. (2022) fitted astrometry up to 2021, so these points are not in that fit.
    const star = starAstrometry('hr-8799'), radiusKm = BODIES['hr-8799'].meanRadiusKm
    const { east, north } = skyBasis(star.rightAscensionDegrees, star.declinationDegrees)
    const distanceKm = star.distanceParsecs * PARSEC_KM
    const jwst = { 'hr-8799-b': [1616, 531, 13, 9], 'hr-8799-c': [-291, 911, 12, 3], 'hr-8799-d': [-610, -348, 7, 5], 'hr-8799-e': [-226, 332, 14, 15] } as const
    let sum = 0
    for (const [id, [dra, ddec]] of Object.entries(jwst) as [keyof typeof jwst, readonly [number, number, number, number]][]) {
      const p = hostedOrbitStateRelativeKm(hostedOrbit(id), star, radiusKm, 60253.39 + 2400000.5).positionKm
      const [x, y] = [dot(p, east), dot(p, north)].map(v => v / distanceKm * 206264.80624709636 * 1000)
      const miss = Math.hypot(x! - dra, y! - ddec)
      // Measured 2026-09-23: b 14.4, c 10.3, d 12.3, e 4.8 mas. c and d miss in declination by 2.5 to 3.4 of the paper's own
      // sigmas (3 and 5 mas, the scatter between filters); every planet misses by under 2% of its separation from the star.
      expect(miss, id).toBeLessThan(15)
      sum += miss ** 2
    }
    expect(Math.sqrt(sum / 4)).toBeLessThan(12)
  })
  it('places 51 Eridani b where JWST measured it, moving away from us as HiRISE measured', () => {
    // Balmer et al. (2025), Table 2: (dRA, dDec) = (286 +/- 10, -99 +/- 4) mas on MJD 60235.25. Denis et al. (2026), Table 1: the planet's
    // radial velocity minus the star's, +1.72, +4.24, +2.75 and +4.12 km/s (errors 2.0, 2.0, 2.4-2.9 and 0.9) on the four nights below.
    const star = starAstrometry('hd-29391'), radiusKm = BODIES['hd-29391'].meanRadiusKm, orbit = hostedOrbit('hd-29391-b')
    const { east, north } = skyBasis(star.rightAscensionDegrees, star.declinationDegrees), sight = directionFromRaDec(star.rightAscensionDegrees, star.declinationDegrees)
    const p = hostedOrbitStateRelativeBmjdTdb(orbit, star, radiusKm, 60235.25).positionKm, distanceKm = star.distanceParsecs * PARSEC_KM
    const [x, y] = [dot(p, east), dot(p, north)].map(v => v / distanceKm * 206264.80624709636 * 1000)
    // Measured 2026-09-23: (279, -107), 11 mas from the JWST position.
    expect(Math.hypot(x! - 286, y! + 99)).toBeLessThan(15)
    const mjdOf = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86400000 + 40587
    for (const [date, measured, sigma] of [['2023-11-21', 1.72, 1.99], ['2024-12-01', 4.24, 2.01], ['2025-02-03', 2.75, 2.9], ['2025-09-11', 4.12, 0.9]] as const) {
      const velocity = dot(hostedOrbitStateRelativeBmjdTdb(orbit, star, radiusKm, mjdOf(date)).velocityKmPerDay, sight) / 86400
      expect(Math.abs(velocity - measured), date).toBeLessThan(2 * sigma)
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
