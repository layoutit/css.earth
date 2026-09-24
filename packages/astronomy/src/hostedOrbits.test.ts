import { keplerStateKm } from './kepler.js'
import { describe, expect, it } from 'vitest'
import { hostedBarycentreCompanion, hostedOrbitCentreStateKm, hostedPlanetStateAboutCentreKm, hostedKeplerElements, hostSkyFrame, hostedOrbit, hostedOrbitApoapsisKm, hostedOrbitPhase, hostedOrbitPhaseBmjdTdb, hostedOrbitStateRelativeBmjdTdb, hostedOrbitStateRelativeKm, hostedPlanetStateRelativeKm, HOSTED_PLANET_IDS, type HostedOrbit } from './hostedOrbits.js'
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
    expect(EXOPLANET_IDS).toEqual(['ab-pic-b', 'af-lep-b', 'beta-pictoris-b', 'beta-pictoris-c', 'beta-pictoris-d', 'dh-tau-b', 'eps-indi-ab', 'gj-504-b', 'gq-lup-b', ...hd110067, 'hd-135344-ab', 'hd-189733b', 'hd-206893-b', 'hd-206893-c', 'hd-209458b', 'hd-29391-b', 'hd-95086-b', 'hip-65426-b', 'hr-8799-b', 'hr-8799-c', 'hr-8799-d', 'hr-8799-e', 'k2-18b', 'kelt-9b', 'kepler-16ab-b', 'kepler-186f', 'kepler-452b', 'pds-70-b', 'pds-70-c', 'roxs-42b-b', ...trappist, 'vhs-1256-1257-b', 'wasp-121b', 'wasp-18b', 'wasp-39b', 'wasp-43b', 'wasp-76b', 'wd-1856-534b', 'yses-1-b'])
    // Hosted orbits keep the order the records were compiled in, which is the order their packages were added.
    expect(HOSTED_PLANET_IDS.filter(id => (EXOPLANET_IDS as readonly string[]).includes(id))).toEqual(['wasp-43b', 'hd-189733b', ...trappist, 'beta-pictoris-b', 'beta-pictoris-c', 'beta-pictoris-d', 'hr-8799-b', 'hr-8799-c', 'hr-8799-d', 'hr-8799-e', 'k2-18b', 'kepler-186f', 'kepler-452b', 'wasp-39b', 'hd-209458b', ...hd110067, 'hd-29391-b', 'kepler-16ab-b', 'wd-1856-534b', 'kelt-9b', 'vhs-1256-1257-b', 'gq-lup-b', 'dh-tau-b', 'roxs-42b-b', 'wasp-76b', 'pds-70-b', 'wasp-18b', 'pds-70-c', 'wasp-121b', 'hip-65426-b', 'af-lep-b', 'ab-pic-b', 'yses-1-b', 'hd-206893-b', 'hd-206893-c', 'hd-95086-b', 'gj-504-b', 'hd-135344-ab', 'eps-indi-ab'])
    for (const id of hd110067) expect(BODIES[id as keyof typeof BODIES].parent).toBe('hd-110067')
    expect(BODIES['wd-1856-534b' as keyof typeof BODIES].parent).toBe('wd-1856-534')
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
  it('places Luhman 16 B where Garcia et al. measured it from A, and moves it at their relative radial velocities', () => {
    // Garcia et al. (2017, ApJ 846, 97; arXiv:1708.02714), Table 3: GeMS orbital astrometry of B from A, (dRA, dDec) in mas at MJD, with
    // 0.26 and 0.28 mas errors; Table 4: CRIRES relative radial velocities v_A - v_B in m/s, +/- 200. The record carries Bedin et al.'s
    // (2024) HST orbit, which used none of these points, with its angles mapped from their mirrored sky frame (i' = 180 - i, Omega' = 270 - Omega).
    const star = starAstrometry('luhman-16'), radiusKm = BODIES['luhman-16'].meanRadiusKm
    const { east, north } = skyBasis(star.rightAscensionDegrees, star.declinationDegrees)
    const distanceKm = star.distanceParsecs * PARSEC_KM, toward = directionFromRaDec(star.rightAscensionDegrees, star.declinationDegrees)
    const gems = [[56701.22, -871.33, 741.46], [56759.18, -833.18, 686.77], [56760.17, -832.71, 685.66], [56804.07, -802.82, 643.57], [57000.34, -655.87, 444.92], [57086.32, -585.38, 353.41]] as const
    let sum = 0
    for (const [mjd, dra, ddec] of gems) {
      const p = hostedOrbitStateRelativeKm(hostedOrbit('luhman-16b'), star, radiusKm, mjd + 2400000.5).positionKm
      const [x, y] = [dot(p, east), dot(p, north)].map(v => v / distanceKm * 206264.80624709636 * 1000)
      sum += (x! - dra) ** 2 + (y! - ddec) ** 2
    }
    // Measured 2026-09-23: 2.6 mas rms against a separation of about 1,100 mas; the unmapped angles miss by 248 mas.
    expect(Math.sqrt(sum / gems.length)).toBeLessThan(4)
    for (const [mjd, deltaV] of [[56417.5, 2740], [56779.5, 1940], [56797.5, 1850]] as const) {
      // v_A - v_B is minus B's recession relative to A. Measured 2026-09-23: 2448, 1752 and 1707 m/s, within 1.5 sigma of each; the
      // mirror-image orbit that fits the positions as well gives the opposite sign.
      const v = hostedOrbitStateRelativeKm(hostedOrbit('luhman-16b'), star, radiusKm, mjd + 2400000.5).velocityKmPerDay
      const recession = dot(v, toward) / 86400 * 1000
      expect(Math.abs(-recession - deltaV), `${mjd}`).toBeLessThan(1.5 * 200)
    }
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
  it('places PDS 70 b and c where GRAVITY measured them, on orbits whose near side is the disc\'s', () => {
    // Trevascus et al. (2025, A&A; arXiv:2504.11210), Table 2: VLTI/GRAVITY (MJD, dRA, dDec) in mas, errors 0.08 to 1.0 mas.
    const star = starAstrometry('pds-70'), radiusKm = BODIES['pds-70'].meanRadiusKm
    const { east, north } = skyBasis(star.rightAscensionDegrees, star.declinationDegrees), sight = directionFromRaDec(star.rightAscensionDegrees, star.declinationDegrees)
    const distanceKm = star.distanceParsecs * PARSEC_KM
    const skyMas = (id: 'pds-70-b' | 'pds-70-c', mjd: number) => {
      const p = hostedOrbitStateRelativeBmjdTdb(hostedOrbit(id), star, radiusKm, mjd).positionKm
      return [dot(p, east), dot(p, north)].map(v => v / distanceKm * 206264.80624709636 * 1000) as [number, number]
    }
    const gravity = {
      'pds-70-b': [[59631.28, 111.14, -115.78]],
      'pds-70-c': [[59222.34, -212.88, 19.32], [59301.24, -212.88, 17.85], [59302.25, -212.83, 17.67], [59307.23, -212.88, 17.55], [59363.10, -212.58, 16.27], [59365.03, -212.32, 16.15], [59631.28, -211.75, 10.04]],
    } as const
    const misses: Record<string, number> = {}
    for (const [id, points] of Object.entries(gravity) as [keyof typeof gravity, readonly (readonly [number, number, number])[]][]) {
      let worst = 0
      for (const [mjd, dra, ddec] of points) { const [x, y] = skyMas(id, mjd); worst = Math.max(worst, Math.hypot(x - dra, y - ddec)) }
      misses[id] = worst
    }
    // The posterior medians of the "Stable (incl. N-body)" column. Measured 2026-09-23: b 11.6 mas from its one GRAVITY epoch, c within 1.2 mas
    // of all seven, against orbits 370 and 600 mas across. Of the paper's three columns this one has the smallest summed miss over the eight
    // points (4.2 mas RMS; the coplanar and stable columns give 4.7, with b within 1.5 and 2.3 mas but c 5.4 and 5.2 mas off).
    expect(misses['pds-70-b']).toBeLessThan(12)
    expect(misses['pds-70-c']).toBeLessThan(2)
    // Keppler et al. (2018, A&A 617, A44), section 3.3: the disc's west side is its near side; the planets move clockwise, the disc's own
    // sense of rotation (their section 5). Astrometry alone cannot say which half of an orbit is nearer; the published orbits put it west too.
    for (const id of ['pds-70-b', 'pds-70-c'] as const) {
      const orbit = hostedOrbit(id), period = orbit.periodDays
      let nearest = { toward: -Infinity, pa: 0 }
      for (let k = 0; k < 360; k++) {
        const p = hostedOrbitStateRelativeBmjdTdb(orbit, star, radiusKm, 59631.28 + period * k / 360).positionKm
        const toward = -dot(p, sight)
        if (toward > nearest.toward) nearest = { toward, pa: ((Math.atan2(dot(p, east), dot(p, north)) * 180 / Math.PI) + 360) % 360 }
      }
      expect(nearest.pa, `${id} near side`).toBeGreaterThan(180)
      expect(nearest.pa, `${id} near side`).toBeLessThan(340)
      const [x0, y0] = skyMas(id, 59631.28), [x1, y1] = skyMas(id, 59631.28 + 365)
      // Clockwise on the sky is position angle decreasing, a positive cross product in (east, north).
      expect(x0 * y1 - y0 * x1, `${id} clockwise`).toBeGreaterThan(0)
    }
  })
  /** Separation (mas) and position angle (degrees east of north) of a hosted body from its parent at an epoch in decimal Julian years. */
  const separationAndAngle = (id: Parameters<typeof hostedOrbit>[0], year: number) => {
    const parent = BODIES[id].parent as Parameters<typeof starAstrometry>[0], star = starAstrometry(parent)
    const { east, north } = skyBasis(star.rightAscensionDegrees, star.declinationDegrees), distanceKm = star.distanceParsecs * PARSEC_KM
    const p = hostedOrbitStateRelativeBmjdTdb(hostedOrbit(id), star, BODIES[parent].meanRadiusKm, 51544.5 + (year - 2000) * 365.25).positionKm
    const [x, y] = [dot(p, east), dot(p, north)].map(v => v / distanceKm * 206264.80624709636 * 1000) as [number, number]
    return { separation: Math.hypot(x, y), angle: ((Math.atan2(x, y) * 180 / Math.PI) + 360) % 360 }
  }
  const angleMiss = (a: number, b: number) => ((a - b + 540) % 360) - 180
  it('puts each companion star of a planet-hosting pair where its paper measured it', () => {
    // [decimal year, separation mas, sigma, position angle deg, sigma]. VHS 1256-1257 B: Dupuy et al. (2023), Table 1, Keck/NIRC2.
    // ROXs 42B B: Inglis et al. (2026), Table 1, Keck NIRC speckle, NIRC2 and SPHERE. Both relative to A.
    const measured = {
      'vhs-1256-1257-companion': [[2016.059, 128.21, 0.14, 168.07, 0.05], [2017.050, 139.7, 2.8, 163.5, 1.9], [2017.220, 140.5, 0.7, 162.9, 0.4],
        [2018.017, 135.84, 0.29, 158.37, 0.15], [2019.259, 109.6, 0.4, 150.36, 0.11], [2021.018, 35.02, 0.26, 112.5, 0.6],
        [2022.066, 70.0, 1.8, 181.0, 1.7], [2022.271, 85.6, 0.7, 177.2, 0.4]],
      'roxs-42b-companion': [[2001.345, 81, 3, 148, 3], [2002.545, 73, 1, 148, 1.0], [2003.301, 68.7, 0.7, 149.1, 0.6], [2005.29, 54, 8, 146, 10],
        [2005.315, 57, 1, 147.9, 0.7], [2017.287, 39.2, 0.4, 331, 1], [2022.621, 51, 2, 148, 3]],
    } as const
    for (const [id, points] of Object.entries(measured) as [keyof typeof measured, readonly (readonly number[])[]][]) {
      let worst = 0
      for (const [year, separation, sigmaSeparation, angle, sigmaAngle] of points) {
        const model = separationAndAngle(id, year!)
        worst = Math.max(worst, Math.abs(model.separation - separation!) / sigmaSeparation!, Math.abs(angleMiss(model.angle, angle!)) / sigmaAngle!)
      }
      // Measured 2026-09-23, the worst point in its own sigmas: VHS 1256-1257 B 2.1, ROXs 42B B 2.1 (posterior medians, not a fit here).
      expect(worst, id).toBeLessThan(3)
    }
  })
  it('places each young imaged planet where its latest paper measured it', () => {
    // Measured offsets of the planet from star A (east, north, mas) and the error, with the share of a pair's mass in its second star:
    // a planet circling a pair is fitted about the pair's centre of mass, so the measured offset is moved there with the second star's
    // own hosted orbit before comparing, as the papers do. VHS 1256-1257 b: Dupuy et al. (2023), Table 2, B's share 0.55 (their
    // fitted A share 0.45). DH Tau b: Bowler et al. (2020), Keck/NIRC2. ROXs 42B b: Inglis et al. (2026), Table 1, B's share 0.4/1.4.
    // GQ Lup b: Venkatesan et al. (2025), Table 3, VLTI/GRAVITY.
    const rad = Math.PI / 180, fromSepPa = (sep: number, pa: number) => [sep * Math.sin(pa * rad), sep * Math.cos(pa * rad)] as const
    const offset = (id: Parameters<typeof hostedOrbit>[0], year: number) => { const m = separationAndAngle(id, year); return fromSepPa(m.separation, m.angle) }
    const cases = [
      ['vhs-1256-1257-b', 'vhs-1256-1257-companion', 0.55, [[2016.059, -4974.0, -6409.8, 2.8], [2017.220, -4977.6, -6412.8, 2.2], [2018.017, -4982.9, -6406.5, 2.6], [2022.271, -5049.0, -6387.5, 1.3]]],
      // Bowler et al. add 4.9 mas and 0.74 degrees of jitter to every error: across the 2.35-arcsecond separation that is 31 mas.
      ['dh-tau-b', null, 0, [[2018.080, ...fromSepPa(2354, 138.46), 5.3, 31]]],
      ['roxs-42b-b', 'roxs-42b-companion', 0.4 / 1.4, [[2001.586, ...fromSepPa(1137, 268.0), 14, 6], [2017.287, ...fromSepPa(1176, 271.4), 2, 4.1], [2022.621, ...fromSepPa(1178, 271), 6, 20.6]]],
    ] as const
    for (const [id, companion, share, points] of cases) {
      let worst = 0
      for (const [year, east, north, sigma, across = sigma] of points as readonly (readonly number[])[]) {
        const second = companion ? offset(companion, year!) : [0, 0], model = offset(id, year!)
        const target = [east! - share * second[0]!, north! - share * second[1]!], unit = target.map(v => v / Math.hypot(target[0]!, target[1]!))
        const d = [model[0] - target[0]!, model[1] - target[1]!]
        // Along the separation and across it, each in its own error.
        worst = Math.max(worst, Math.abs(d[0]! * unit[0]! + d[1]! * unit[1]!) / sigma!, Math.abs(d[0]! * unit[1]! - d[1]! * unit[0]!) / across!)
      }
      // Measured 2026-09-23: VHS 1256-1257 b 0.97, DH Tau b 1.60, ROXs 42B b 0.75, each the worst point in its own errors.
      expect(worst, id).toBeLessThan(2)
    }
    // GQ Lup b against the four VLTI/GRAVITY positions, whose errors (0.03 to 0.15 mas) are far below what the literature positions
    // allow: under 0.6 mas at worst, against a separation of 709 mas.
    for (const [year, east, north] of [[2023.2129, -698.969, 114.058], [2022.6814, -699.789, 112.615], [2022.6185, -699.876, 112.491], [2021.6572, -702.069, 110.363]] as const) {
      const model = offset('gq-lup-b', year)
      expect(Math.hypot(model[0] - east, model[1] - north), `gq-lup-b ${year}`).toBeLessThan(0.6)
    }
    // The CRIRES+ radial velocity of the companion relative to the star, 2.03 +/- 0.04 km/s on MJD 60003 (Gonzalez Picos et al. 2025,
    // via Venkatesan et al. 2025, Table 4), was not in the fit. Measured 2026-09-23: 1.67 km/s, receding as measured; the 0.36 km/s gap is
    // the size of the star's own velocity jitter (0.4 km/s, Donati et al. 2012) that led Venkatesan et al. to fit the CRIRES value instead.
    const star = starAstrometry('gq-lup'), sight = directionFromRaDec(star.rightAscensionDegrees, star.declinationDegrees)
    const velocity = dot(hostedOrbitStateRelativeBmjdTdb(hostedOrbit('gq-lup-b'), star, BODIES['gq-lup'].meanRadiusKm, 60003).velocityKmPerDay, sight) / 86400
    expect(velocity).toBeGreaterThan(0)
  })
  it('places HIP 65426 b, AF Lep b and AB Pic b where their orbit papers measured them', () => {
    /** Offset of a planet from its star at an MJD, east and north in mas, at the star's Gaia distance. */
    const skyMas = (id: 'hip-65426-b' | 'af-lep-b' | 'ab-pic-b', mjd: number) => {
      const parent = BODIES[id].parent as Parameters<typeof starAstrometry>[0], star = starAstrometry(parent)
      const { east, north } = skyBasis(star.rightAscensionDegrees, star.declinationDegrees), distanceKm = star.distanceParsecs * PARSEC_KM
      const p = hostedOrbitStateRelativeBmjdTdb(hostedOrbit(id), star, BODIES[parent].meanRadiusKm, mjd).positionKm
      return [dot(p, east), dot(p, north)].map(v => v / distanceKm * 206264.80624709636 * 1000) as [number, number]
    }
    // VLTI/GRAVITY (MJD, dRA, dDec) in mas: HIP 65426 b, Blunt et al. (2023), Table 3; AF Lep b, Balmer et al. (2025), Table 2.
    // Errors 0.04 to 0.28 mas. Each orbit is one sample of the paper's own posterior, so it passes near, not through, every point.
    const gravity = {
      'hip-65426-b': [[59221.312, 415.613, -708.133], [59602.271, 416.269, -705.051], [60071.208, 416.980, -701.373]],
      'af-lep-b': [[60251.32, 316.89, 62.91], [60273.22, 316.26, 60.17], [60302.21, 315.44, 55.93]],
    } as const
    const misses: Record<string, number> = {}
    for (const [id, points] of Object.entries(gravity) as [keyof typeof gravity, readonly (readonly [number, number, number])[]][]) {
      misses[id] = Math.max(...points.map(([mjd, dra, ddec]) => { const [x, y] = skyMas(id, mjd); return Math.hypot(x - dra, y - ddec) }))
    }
    // Measured 2026-09-23 at the stars' Gaia distances: HIP 65426 b 0.09 mas, AF Lep b 0.32 mas at worst,
    // against separations of 820 and 323 mas.
    expect(misses['hip-65426-b']).toBeLessThan(0.1)
    expect(misses['af-lep-b']).toBeLessThan(0.35)
    // AB Pic b: Palma-Bifani et al. (2023), Table 1, NaCo and SPHERE (MJD, separation mas, sigma, position angle deg, sigma).
    let worst = 0
    for (const [mjd, separation, sigmaSeparation, angle, sigmaAngle] of [[52717.7, 5460, 14, 175.33, 0.18], [53070.9, 5450, 16, 175.13, 0.21],
      [53274.0, 5450, 14, 175.30, 0.20], [57058.4, 5398.7, 4.5, 175.26, 0.13]] as const) {
      const [x, y] = skyMas('ab-pic-b', mjd), modelAngle = ((Math.atan2(x, y) * 180 / Math.PI) + 360) % 360
      worst = Math.max(worst, Math.abs(Math.hypot(x, y) - separation) / sigmaSeparation, Math.abs(angleMiss(modelAngle, angle)) / sigmaAngle)
    }
    // Measured 2026-09-23: 0.68 of its own sigmas at worst.
    expect(worst).toBeLessThan(1)
  })
  it('places Epsilon Indi Ab where JWST imaged it', () => {
    const star = starAstrometry('eps-indi-a'), radiusKm = BODIES['eps-indi-a'].meanRadiusKm, orbit = hostedOrbit('eps-indi-ab')
    const { east, north } = skyBasis(star.rightAscensionDegrees, star.declinationDegrees), distanceKm = star.distanceParsecs * PARSEC_KM
    // Sanghi et al. (2026), Table 2: JWST/MIRI F1550C on 2023 July 3 and JWST/NIRCam on 2025 August 28
    // (MJD, separation mas, sigma, position angle deg, sigma).
    let worst = 0
    for (const [mjd, separation, sigmaSeparation, angle, sigmaAngle] of [[60128, 4114, 10, 37.39, 0.43], [60915, 3551, 3, 34.97, 0.05]] as const) {
      const p = hostedOrbitStateRelativeBmjdTdb(orbit, star, radiusKm, mjd).positionKm
      const [x, y] = [dot(p, east), dot(p, north)].map(v => v / distanceKm * 206264.80624709636 * 1000) as [number, number]
      const modelAngle = ((Math.atan2(x, y) * 180 / Math.PI) + 360) % 360
      worst = Math.max(worst, Math.abs(Math.hypot(x, y) - separation) / sigmaSeparation, Math.abs(angleMiss(modelAngle, angle)) / sigmaAngle)
    }
    // Measured 2026-09-23: 1.86 of its own sigmas at worst (the 2023 separation), against a separation of 3.6 arcseconds.
    expect(worst).toBeLessThan(2)
  })
  it('places Epsilon Indi Bb around Ba where VLT/NACO measured it', () => {
    // Chen et al. (2022), Table 3 [decimal year, separation mas, sigma, position angle deg, sigma], across the orbit including the
    // 2009 close passage. The orbit is refitted on all 32 positions because the paper omits the time of periastron.
    let worst = 0
    for (const [year, separation, sigmaSeparation, angle, sigmaAngle] of [[2004.730, 883.10, 1.08, 140.317, 0.047], [2009.458, 146.26, 2.73, 186.175, 0.562],
      [2010.582, 328.38, 1.20, 332.295, 0.157], [2013.431, 478.61, 1.04, 126.845, 0.088]] as const) {
      const model = separationAndAngle('eps-indi-bb', year)
      worst = Math.max(worst, Math.abs(model.separation - separation) / sigmaSeparation, Math.abs(angleMiss(model.angle, angle)) / sigmaAngle)
    }
    // Measured 2026-09-23: 2.2 of its own sigmas at worst, with Ba at Epsilon Indi A's distance rather than the fit's parallax.
    expect(worst).toBeLessThan(2.5)
  })
  it('places HD 206893 B and c, HD 95086 b, GJ 504 b and HD 135344 Ab where their papers measured them', () => {
    /** Offset of a companion from its star at an MJD, east and north in mas, at the star's Gaia distance. */
    const skyMas = (id: 'hd-206893-b' | 'hd-206893-c' | 'hd-95086-b' | 'gj-504-b' | 'hd-135344-ab', mjd: number) => {
      const parent = BODIES[id].parent as Parameters<typeof starAstrometry>[0], star = starAstrometry(parent)
      const { east, north } = skyBasis(star.rightAscensionDegrees, star.declinationDegrees), distanceKm = star.distanceParsecs * PARSEC_KM
      const p = hostedOrbitStateRelativeBmjdTdb(hostedOrbit(id), star, BODIES[parent].meanRadiusKm, mjd).positionKm
      return [dot(p, east), dot(p, north)].map(v => v / distanceKm * 206264.80624709636 * 1000) as [number, number]
    }
    const worstMiss = (id: Parameters<typeof skyMas>[0], points: readonly (readonly [number, number, number])[]) =>
      Math.max(...points.map(([mjd, dra, ddec]) => { const [x, y] = skyMas(id, mjd); return Math.hypot(x - dra, y - ddec) }))
    // VLTI/GRAVITY (MJD, dRA, dDec) in mas, errors 0.03 to 0.3 mas: HD 206893 B and c as stored with the posterior of Kral et al. (2026),
    // HD 135344 Ab as stored with that of Stolker et al. (2025). B's orbit leaves out the star's motion under c's pull, about half a mas.
    const measuredMiss = {
      'hd-206893-b': worstMiss('hd-206893-b', [[58681.392, 130.749, 198.118], [59453.093, 20.058, 205.831], [60127.218, -79.297, 176.072], [60516.263, -132.403, 144.825], [60834.317, -170.498, 112.565]]),
      'hd-206893-c': worstMiss('hd-206893-c', [[59454.125, -76.544, -82.656], [59485.11, -72.11, -85.323], [59504.061, -69.305, -86.726], [59721.403, -32.352, -93.497]]),
      'hd-135344-ab': worstMiss('hd-135344-ab', [[59779.06, -138.21, 36.34], [60072.15, -130.41, 37.0], [60126.98, -129.07, 37.36], [60724.31, -112.81, 38.94]]),
      // Desgrange et al. (2022), Table 3: the SPHERE positions of 2018 January 6 and 2019 April 13 (errors 2 and 3 mas), not in the fit.
      'hd-95086-b': worstMiss('hd-95086-b', [[58124, 351, -514], [58586, 368, -508]]),
    }
    // Measured 2026-09-23: B 1.03, c 0.52, Ab 0.30 and HD 95086 b 5.1 mas at worst.
    expect(measuredMiss['hd-206893-b']).toBeLessThan(1.1)
    expect(measuredMiss['hd-206893-c']).toBeLessThan(0.55)
    expect(measuredMiss['hd-135344-ab']).toBeLessThan(0.35)
    expect(measuredMiss['hd-95086-b']).toBeLessThan(5.5)
    // GJ 504 b: Bonnefoy et al. (2018), Table 2, the SPHERE positions (MJD, separation mas, sigma, position angle deg, sigma).
    let worst = 0
    for (const [mjd, separation, sigmaSeparation, angle, sigmaAngle] of [[57147, 2491, 3, 323.46, 0.07], [57176, 2496, 3, 323.50, 0.07], [57478, 2495, 2, 322.48, 0.05], [57794, 2493, 3, 321.74, 0.08]] as const) {
      const [x, y] = skyMas('gj-504-b', mjd), modelAngle = ((Math.atan2(x, y) * 180 / Math.PI) + 360) % 360
      worst = Math.max(worst, Math.abs(Math.hypot(x, y) - separation) / sigmaSeparation, Math.abs(angleMiss(modelAngle, angle)) / sigmaAngle)
    }
    // Measured 2026-09-23: 2.35 of its own sigmas at worst.
    expect(worst).toBeLessThan(2.5)
  })
  it('places YSES 1 b where GRAVITY measured it, moving toward us as CRIRES+ measured', () => {
    const star = starAstrometry('yses-1'), radiusKm = BODIES['yses-1'].meanRadiusKm, orbit = hostedOrbit('yses-1-b')
    const { east, north } = skyBasis(star.rightAscensionDegrees, star.declinationDegrees), sight = directionFromRaDec(star.rightAscensionDegrees, star.declinationDegrees)
    const distanceKm = star.distanceParsecs * PARSEC_KM
    // Roberts et al. (2025), Table 2: VLTI/GRAVITY (MJD, dRA, dDec) in mas, errors 0.05 to 0.14 mas.
    let worst = 0
    for (const [mjd, dra, ddec] of [[59971.334, -906.598, -1436.899], [60355.278, -904.806, -1434.773], [60461.014, -904.428, -1434.237], [60491.050, -904.516, -1433.772]] as const) {
      const p = hostedOrbitStateRelativeBmjdTdb(orbit, star, radiusKm, mjd).positionKm
      const [x, y] = [dot(p, east), dot(p, north)].map(v => v / distanceKm * 206264.80624709636 * 1000) as [number, number]
      worst = Math.max(worst, Math.hypot(x - dra, y - ddec))
    }
    // Measured 2026-09-23: 0.32 mas at worst, against a separation of 1,700 mas.
    expect(worst).toBeLessThan(0.35)
    // Zhang et al. (2024), section 5.5: the planet moves -1.87 +/- 0.04 km/s relative to the star (MJD 60002.5, the midpoint of the two nights).
    const velocity = dot(hostedOrbitStateRelativeBmjdTdb(orbit, star, radiusKm, 60002.5).velocityKmPerDay, sight) / 86400
    expect(Math.abs(velocity + 1.87)).toBeLessThan(0.04)
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

describe('Kepler-16: a circumbinary planet', () => {
  // Independent oracle: the Villanova Kepler Eclipsing Binary Catalogue (Kirk et al. 2016, AJ 151, 68), KIC 12644769, read
  // 2026-09-23 from https://keplerebs.villanova.edu/overview/?k=12644769: a linear ephemeris fitted to the Kepler eclipses
  // themselves, not to Doyle et al.'s photometric-dynamical model the records carry.
  const catalogue = { bjd0: 2454965.657634, periodDays: 41.0775867, secondaryPhase: 0.4885 }
  const star = starAstrometry('kepler-16-a'), sight = directionFromRaDec(star.rightAscensionDegrees, star.declinationDegrees)
  const radiusA = BODIES['kepler-16-a'].meanRadiusKm, radiusB = BODIES['kepler-16-b'].meanRadiusKm
  const projected = (position: readonly number[]) => Math.hypot(...position.map((value, axis) => value - dot(position, sight) * sight[axis]!))
  it('eclipses A behind B at every catalogued primary eclipse of the Kepler mission, and B behind A at every secondary', () => {
    for (let n = 0; n < 36; n++) {
      const primary = hostedPlanetStateRelativeKm('kepler-16-b', catalogue.bjd0 + n * catalogue.periodDays).positionKm
      const secondary = hostedPlanetStateRelativeKm('kepler-16-b', catalogue.bjd0 + (n + catalogue.secondaryPhase) * catalogue.periodDays).positionKm
      // In front is toward the observer, against the line of sight.
      expect(dot(primary, sight), `primary ${n}`).toBeLessThan(0)
      expect(projected(primary), `primary ${n}`).toBeLessThan(radiusA + radiusB)
      expect(dot(secondary, sight), `secondary ${n}`).toBeGreaterThan(0)
      expect(projected(secondary), `secondary ${n}`).toBeLessThan(radiusA + radiusB)
    }
  })
  it('centres the planet orbit on the mass-weighted point between A and B', () => {
    const companion = hostedBarycentreCompanion('kepler-16ab-b')!
    expect(companion.id).toBe('kepler-16-b')
    expect(companion.weight).toBeCloseTo(0.20255 / (0.6897 + 0.20255), 12)
    for (const epoch of [2455212.12316, 2461306.5]) {
      const b = hostedPlanetStateRelativeKm('kepler-16-b', epoch).positionKm, centre = hostedOrbitCentreStateKm('kepler-16ab-b', epoch).positionKm
      const own = hostedPlanetStateAboutCentreKm('kepler-16ab-b', epoch).positionKm, planet = hostedPlanetStateRelativeKm('kepler-16ab-b', epoch).positionKm
      for (let axis = 0; axis < 3; axis++) {
        expect(centre[axis]!).toBeCloseTo(b[axis]! * companion.weight, 3)
        expect(planet[axis]!).toBeCloseTo(own[axis]! + centre[axis]!, 3)
      }
    }
    expect(hostedOrbitCentreStateKm('wasp-43b', 2461306.5).positionKm).toEqual([0, 0, 0])
  })
  it('reproduces the seven Kepler transits across A, early and late as A swings around the barycentre', () => {
    // Mid-times of the planet's transits across A, measured from the Kepler long-cadence PDCSAP light curves of KIC 12644769
    // (MAST, kplr012644769-*_llc.fits, quality 0): the depth-weighted centre of each dip deeper than 0.7% outside the stellar
    // eclipses, after a 1.5-day running median. The record's mean period is a linear fit to these same transits, so only their
    // alternation tests the barycentre: with it the model is within 0.13 d of every transit, without it off by up to 2.3 d.
    const observed = [2454973.433, 2455203.617, 2455425.201, 2455655.439, 2455876.974, 2456107.256, 2456328.739]
    const radiusPlanet = BODIES['kepler-16ab-b'].meanRadiusKm
    for (const time of observed) {
      let best = { time: Number.NaN, separation: Infinity }
      for (let t = time - 5; t <= time + 5; t += 0.002) {
        const planet = hostedPlanetStateRelativeKm('kepler-16ab-b', t).positionKm
        if (dot(planet, sight) < 0 && projected(planet) < best.separation) best = { time: t, separation: projected(planet) }
      }
      expect(best.separation, `transit near ${time}`).toBeLessThan(radiusA + radiusPlanet)
      expect(Math.abs(best.time - time), `transit near ${time}`).toBeLessThan(0.5)
    }
  })
})
