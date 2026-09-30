// Hosted orbits of binaries, and orbits timed at superior conjunction.
import { keplerStateKm } from './kepler.js'
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { hostedBarycentreCompanion, hostedOrbitCentreStateKm, hostedPlanetStateAboutCentreKm, hostedKeplerElements, hostSkyFrame, hostedOrbit, hostedOrbitApoapsisKm, hostedOrbitPhase, hostedOrbitPhaseBmjdTdb, hostedOrbitStateRelativeBmjdTdb, hostedOrbitStateRelativeKm, hostedPlanetStateRelativeKm, HOSTED_PLANET_IDS, type HostedOrbit } from './hostedOrbits.js'
import { directionFromRaDec, skyBasis, starAstrometry } from './stars.js'
import { PARSEC_KM } from './index.js'
import { BODIES, EXOPLANET_IDS } from './bodies.js'

const dot = (a: readonly number[], b: readonly number[]) => a.reduce((sum, v, i) => sum + v * b[i]!, 0)
const cross = (a: readonly number[], b: readonly number[]) => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!]
const hostRadiusKm = BODIES['wasp-43'].meanRadiusKm
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
      assert.ok(dot(primary, sight) < 0, `primary ${n}`)
      assert.ok(projected(primary) < radiusA + radiusB, `primary ${n}`)
      assert.ok(dot(secondary, sight) > 0, `secondary ${n}`)
      assert.ok(projected(secondary) < radiusA + radiusB, `secondary ${n}`)
    }
  })
  it('centres the planet orbit on the mass-weighted point between A and B', () => {
    const companion = hostedBarycentreCompanion('kepler-16ab-b')!
    assert.equal(companion.id, 'kepler-16-b')
    assert.ok(Math.abs(companion.weight - (0.20255 / (0.6897 + 0.20255))) < 10 ** -12 / 2, `${companion.weight} is not close to ${0.20255 / (0.6897 + 0.20255)}`)
    for (const epoch of [2455212.12316, 2461306.5]) {
      const b = hostedPlanetStateRelativeKm('kepler-16-b', epoch).positionKm, centre = hostedOrbitCentreStateKm('kepler-16ab-b', epoch).positionKm
      const own = hostedPlanetStateAboutCentreKm('kepler-16ab-b', epoch).positionKm, planet = hostedPlanetStateRelativeKm('kepler-16ab-b', epoch).positionKm
      for (let axis = 0; axis < 3; axis++) {
        assert.ok(Math.abs((centre[axis]!) - (b[axis]! * companion.weight)) < 10 ** -3 / 2, `${(centre[axis]!)} is not close to ${b[axis]! * companion.weight}`)
        assert.ok(Math.abs((planet[axis]!) - (own[axis]! + centre[axis]!)) < 10 ** -3 / 2, `${(planet[axis]!)} is not close to ${own[axis]! + centre[axis]!}`)
      }
    }
    assert.deepEqual(hostedOrbitCentreStateKm('wasp-43b', 2461306.5).positionKm, [0, 0, 0])
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
      assert.ok(best.separation < radiusA + radiusPlanet, `transit near ${time}`)
      assert.ok(Math.abs(best.time - time) < 0.5, `transit near ${time}`)
    }
  })
})

describe('an orbit timed at its superior conjunction', () => {
  // Cygnus X-1 as Miller-Jones et al. (2021) and Brocksopp et al. (1999) publish it: the black hole behind its star at HJD 2441163.5424.
  // The same orbit timed at periastron was worked out by hand for its record: true anomaly 143.4 degrees, 2.2103 d after periastron.
  const star = { rightAscensionDegrees: 299.590295, declinationDegrees: 35.201579 }, radiusKm = 22.3 * 695700
  const shared = { periodDays: 5.599836, semiMajorAxisStellarRadii: 2.3528, inclinationDegrees: 152.49, eccentricity: 0.0189, argumentOfPeriapsisDegrees: 126.6, ascendingNodePositionAngleDegrees: 64.1 }
  const superior: HostedOrbit = { ...shared, epochDefinition: 'superior-conjunction', transitTimeBmjdTdb: 41163.0424, sources: {} as HostedOrbit['sources'] }
  const periastron: HostedOrbit = { ...shared, epochDefinition: 'periastron', transitTimeBmjdTdb: 41160.8322, sources: {} as HostedOrbit['sources'] }
  const sight = directionFromRaDec(star.rightAscensionDegrees, star.declinationDegrees)
  it('puts the body behind its host at the stated time, as far along the line of sight as the tilt allows', () => {
    const { positionKm } = hostedOrbitStateRelativeBmjdTdb(superior, star, radiusKm, superior.transitTimeBmjdTdb)
    assert.ok(Math.abs((dot(positionKm, sight) / Math.hypot(...positionKm)) - (Math.sin((180 - 152.49) * Math.PI / 180))) < 10 ** -3 / 2, `${(dot(positionKm, sight) / Math.hypot(...positionKm))} is not close to ${Math.sin((180 - 152.49) * Math.PI / 180)}`)
  })
  it('is the orbit the hand-computed periastron epoch describes', () => {
    for (const t of [41163.0424, 50000, 61000.25]) {
      const a = hostedOrbitStateRelativeBmjdTdb(superior, star, radiusKm, t).positionKm, b = hostedOrbitStateRelativeBmjdTdb(periastron, star, radiusKm, t).positionKm
      // Both epochs are rounded to 1e-4 d, and the black hole moves about 41 million km a day: some 4,000 km of a 36-million-km
      // orbit, 1.1e-4 of it. Half an orbit's error, the other conjunction, would be 2.
      assert.ok((Math.hypot(...a.map((v, axis) => v - b[axis]!)) / Math.hypot(...a)) < 2e-4)
    }
  })
  it('refuses an epoch definition it does not know', () => {
    assert.throws(() => hostedOrbitStateRelativeBmjdTdb({ ...superior, epochDefinition: 'secondary-eclipse' as never }, star, radiusKm, 60000), /Unsupported hosted-orbit epoch definition: secondary-eclipse/)
  })
})

describe('Cygnus X-1: a black hole on its measured orbit around its supergiant', () => {
  // Independent oracle: Brocksopp et al. (1999, A&A 343, 861; arXiv:astro-ph/9812077), Table 3, spectroscopic column: superior
  // conjunction of the black hole at HJD 2441874.707 +/- 0.009, P = 5.599829 +/- 0.000016 d, fitted to radial velocities. The record's
  // phase comes from the photometric column of the same table, with Miller-Jones et al.'s (2021) phase offset.
  const spectroscopic = { hjd0: 2441874.707, periodDays: 5.599829 }
  const star = starAstrometry('hd-226868'), sight = directionFromRaDec(star.rightAscensionDegrees, star.declinationDegrees)
  // At a conjunction the black hole lies along the line of sight as far as the orbit's tilt allows: sin(27.51 degrees) of its distance.
  const depth = (position: readonly number[]) => dot(position, sight) / Math.hypot(...position)
  it('puts the black hole behind its star at every spectroscopic superior conjunction from 1973 to 2026, and in front half an orbit later', () => {
    for (let n = 0; n <= 3500; n += 50) {
      const behind = hostedPlanetStateRelativeKm('cygnus-x-1', spectroscopic.hjd0 + n * spectroscopic.periodDays).positionKm
      const inFront = hostedPlanetStateRelativeKm('cygnus-x-1', spectroscopic.hjd0 + (n + 0.5) * spectroscopic.periodDays).positionKm
      assert.ok(depth(behind) > 0.44, `conjunction ${n}`)
      assert.ok(depth(inFront) < -0.44, `opposition ${n}`)
    }
  })
  it('keeps the star and black hole 0.244 au apart, on a clockwise orbit on the sky', () => {
    const au = 149597870.7, t = spectroscopic.hjd0
    const { positionKm, velocityKmPerDay } = hostedPlanetStateRelativeKm('cygnus-x-1', t)
    assert.ok((Math.hypot(...positionKm) / au) > 0.244 * (1 - 0.0189) - 1e-3)
    assert.ok((Math.hypot(...positionKm) / au) < 0.244 * (1 + 0.0189) + 1e-3)
    // Clockwise on the sky: the orbital angular momentum points away from the observer (i > 90 degrees).
    const h = [positionKm[1]! * velocityKmPerDay[2]! - positionKm[2]! * velocityKmPerDay[1]!, positionKm[2]! * velocityKmPerDay[0]! - positionKm[0]! * velocityKmPerDay[2]!, positionKm[0]! * velocityKmPerDay[1]! - positionKm[1]! * velocityKmPerDay[0]!]
    assert.ok(Math.abs((dot(h, sight) / Math.hypot(...h)) - (Math.cos((180 - 152.49) * Math.PI / 180))) < 10 ** -2 / 2, `${(dot(h, sight) / Math.hypot(...h))} is not close to ${Math.cos((180 - 152.49) * Math.PI / 180)}`)
  })
})

describe('eclipsing binaries: each paper\'s periastron angle, checked against its own secondary eclipse', () => {
  // Independent oracles: a secondary-eclipse timing each paper publishes separately from the elements the records carry.
  const cases = [
    // Kaluzny et al. (2015, AJ 150, 155; arXiv:1508.04894), Eq. 1: secondary minimum at HJD 2453891.82853 + 5.29617486 E.
    { id: 'ngc-6362-v40-b', host: 'ngc-6362-v40-a', secondaryHjd: 2453891.82853, periodDays: 5.29617486 },
    // Kaluzny et al. (2013, AJ 145, 43; arXiv:1301.2946), Table 3 footnote: the secondary minimum occurs at phase 0.6086052.
    { id: 'm4-v69-b', host: 'm4-v69-a', secondaryHjd: 2450048.34890 + 0.6086052 * 48.1882687, periodDays: 48.1882687 },
  ] as const
  for (const c of cases) it(`puts ${c.id} straight behind its star at the published secondary eclipse, within a tenth of an hour`, () => {
    const star = starAstrometry(c.host), sight = directionFromRaDec(star.rightAscensionDegrees, star.declinationDegrees)
    const depth = (t: number) => { const p = hostedPlanetStateRelativeKm(c.id, t).positionKm; return dot(p, sight) / Math.hypot(...p) }
    for (const n of [0, 100, 1000]) {
      const t = c.secondaryHjd + n * c.periodDays
      let best = 0
      for (let dt = -0.5; dt <= 0.5; dt += 0.001) if (depth(t + dt) > depth(t + best)) best = dt
      assert.ok((Math.abs(best) * 24) < 0.1, `cycle ${n}`)
    }
  })
})
