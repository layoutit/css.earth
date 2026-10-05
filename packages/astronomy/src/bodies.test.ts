import { SCENE_SATELLITE_IDS } from './sceneSatellites.js'
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import {
  BODIES,
  BODY_IDS,
  DWARF_PLANET_IDS,
  SMALL_BODY_IDS,
  COMET_IDS,
  EXOPLANET_IDS,
  BLACK_HOLE_IDS,
  GALAXY_IDS,
  GALAXY_CLUSTER_IDS,
  NEBULA_IDS,
  GLOBULAR_CLUSTER_IDS,
  OPEN_CLUSTER_IDS,
  PLANET_IDS,
  bodyData,
  moonsOf,
  systemGravitationalParameterKm3PerS2,
  type BodyId,
} from './bodies.js'
import { SATELLITE_ELEMENTS, SATELLITE_IDS } from './satellites.js'
import { SOLAR_MASS_KG } from './units.js'
import { STAR_IDS, type StarId } from './stars.js'
import { HOSTED_PLANET_IDS } from './hostedOrbits.js'

// A star on a hosted orbit (the S-stars around Sgr A*) is placed by that orbit, not by its own astrometry.
const HOSTED_STAR_IDS = HOSTED_PLANET_IDS.filter(id => !(EXOPLANET_IDS as readonly string[]).includes(id))

const GRAVITATIONAL_CONSTANT_KM3_PER_KG_S2 = 6.6743e-20

const EXTENDED_IDS: readonly string[] = [...GALAXY_IDS, ...GALAXY_CLUSTER_IDS, ...NEBULA_IDS, ...GLOBULAR_CLUSTER_IDS, ...OPEN_CLUSTER_IDS]

describe('the body table', () => {
  it('has an entry for the Sun, eight planets, the Moon, every satellite, the five dwarf planets, every placed star, black hole and hosted star, and every exoplanet', () => {
    // The Sun is one of the placed stars: its record places it at distance zero.
    assert.ok((STAR_IDS as readonly string[]).includes('sun'))
    assert.equal(BODY_IDS.length, 8 + 1 + SATELLITE_IDS.length + SCENE_SATELLITE_IDS.length + DWARF_PLANET_IDS.length + SMALL_BODY_IDS.length + COMET_IDS.length + STAR_IDS.length + EXOPLANET_IDS.length + HOSTED_STAR_IDS.length)
    // A black hole is placed by its astrometry (Sgr A*) or hosted by the star it orbits (Cygnus X-1).
    for (const id of BLACK_HOLE_IDS) assert.ok(([...STAR_IDS, ...HOSTED_STAR_IDS] as readonly string[]).includes(id))
    for (const id of [...PLANET_IDS, 'moon', ...SATELLITE_IDS, ...SCENE_SATELLITE_IDS, ...DWARF_PLANET_IDS, ...SMALL_BODY_IDS, ...COMET_IDS, ...STAR_IDS, ...EXOPLANET_IDS, ...HOSTED_STAR_IDS] as BodyId[]) {
      assert.notEqual(BODIES[id], undefined)
      assert.equal(BODIES[id].id, id)
    }
  })

  it('parents every dwarf planet directly on the Sun', () => {
    // Dwarf element sources target the body centre directly.
    for (const id of DWARF_PLANET_IDS) assert.equal(bodyData(id).parent, 'sun')
  })

  it('is a tree rooted at the Sun', () => {
    for (const id of BODY_IDS) {
      const parent = bodyData(id).parent
      // A star placed by its own astrometry orbits nothing here; the Sun, placed at distance zero, roots the Solar System.
      if (STAR_IDS.includes(id as StarId)) {
        assert.equal(parent, null)
        continue
      }
      assert.notEqual(parent, null)
      // Walk to the root in bounded steps; a cycle would not terminate.
      let cursor: BodyId | null = id
      let steps = 0
      while (cursor !== null) {
        cursor = bodyData(cursor).parent
        steps++
        assert.ok(steps < 5)
      }
    }
  })

  it('has physically plausible radii and masses', () => {
    for (const id of BODY_IDS) {
      const data = bodyData(id)
      // An extended body (a galaxy, a cluster of galaxies, a nebula, a globular cluster) has no radius or mass of a sphere.
      if (EXTENDED_IDS.includes(id)) {
        assert.equal(data.meanRadiusKm, 0, id)
        assert.equal(data.gravitationalParameterKm3PerS2, 0, id)
        continue
      }
      // Zero radius is an unmeasured one, allowed only for a hosted star or black hole. Such a star has no published mass either;
      // a hosted black hole's mass is what its orbit measures.
      if (data.meanRadiusKm === 0) {
        assert.ok((HOSTED_STAR_IDS as readonly string[]).includes(id), id)
        if ((BLACK_HOLE_IDS as readonly string[]).includes(id)) assert.ok(data.gravitationalParameterKm3PerS2 > 0, id)
        else assert.equal(data.gravitationalParameterKm3PerS2, 0, id)
        continue
      }
      assert.ok(data.meanRadiusKm > 0)
      assert.ok(data.gravitationalParameterKm3PerS2 >= 0)
      // Zero represents an unpublished GM, not a measured massless body.
      if (data.gravitationalParameterKm3PerS2 === 0) continue
      // Stars range from a red supergiant a thousand times less dense than water to a K dwarf denser than it; only planets and
      // smaller bodies take the rock-and-ice bounds. A star is at least a tenth of the Sun's radius, unless it is a white dwarf:
      // then its density lies between 1e4 and 1e8 g/cm^3 (WD 1856+534 is about 5e5).
      const massKg = data.gravitationalParameterKm3PerS2 / GRAVITATIONAL_CONSTANT_KM3_PER_KG_S2
      const volumeKm3 = (4 / 3) * Math.PI * data.meanRadiusKm ** 3
      const densityGramsPerCm3 = massKg / volumeKm3 / 1e12
      if (STAR_IDS.includes(id as StarId) || HOSTED_STAR_IDS.includes(id as never)) {
        if (data.meanRadiusKm > 69570) continue
        // A star under 30 km in radius is a neutron star, at about the density of an atomic nucleus: PSR J0437-4715, 1.418 solar
        // masses in 11.36 km (Reardon et al. 2024; Choudhury et al. 2024), is about 4.6e14 g/cm^3.
        if (data.meanRadiusKm < 30) {
          assert.ok(densityGramsPerCm3 > 1e14, id)
          assert.ok(densityGramsPerCm3 < 3e15, id)
          continue
        }
        // Below the hydrogen-burning limit, about 80 Jupiter masses, a small "star" is an old brown dwarf: Epsilon Indi Ba, 67 Jupiter
        // masses in 0.080 solar radii (Chen et al. 2022; King et al. 2010), is about 180 g/cm^3.
        if (data.gravitationalParameterKm3PerS2 < 80 * bodyData('jupiter').gravitationalParameterKm3PerS2) {
          assert.ok(densityGramsPerCm3 > 1, id)
          assert.ok(densityGramsPerCm3 < 500, id)
          continue
        }
        assert.ok(densityGramsPerCm3 > 1e4, id)
        assert.ok(densityGramsPerCm3 < 1e8, id)
        continue
      }
      // Mean density between 0.1 and 8.5 g/cm^3 covers the inflated hot Jupiter WASP-76b (0.17 +/- 0.02, Ehrenreich
      // et al. 2020, Extended Data Table 1), porous Helene and Atlas through Mercury, and catches a GM or radius entered
      // in the wrong unit, which is the failure this table is most exposed to. Above the deuterium-burning limit, about 13 Jupiter
      // masses, a companion is a brown dwarf: an old one keeps a Jupiter-sized radius at tens of Jupiter masses, so its density
      // reaches tens of g/cm^3 (GJ 504 b, 25 Jupiter masses in 0.92 Jupiter radii, Baburaj et al. 2026: about 40).
      // A gas giant (at least half Jupiter's radius) keeps about Jupiter's size as its mass grows, so below 13 Jupiter masses it can
      // be far denser than rock: of the 881 transiting giants with a measured mass and radius in the NASA Exoplanet Archive
      // (pscomppars, 2026-09-24), 99% are below 13.5 g/cm^3 and the densest, TOI-4600 c (9.3 Jupiter masses in 0.84 Jupiter radii),
      // is 19.3. Smaller planets keep 8.5, where a wrong unit shows up (Kepler-32 f's 5.9 Jupiter masses in 0.07 Jupiter radii).
      const brownDwarf = data.gravitationalParameterKm3PerS2 > 13 * bodyData('jupiter').gravitationalParameterKm3PerS2
      const giant = data.meanRadiusKm >= 0.5 * bodyData('jupiter').meanRadiusKm
      assert.ok(densityGramsPerCm3 > 0.1, id)
      assert.ok(densityGramsPerCm3 < (brownDwarf ? 150 : giant ? 20 : 8.5), id)
    }
  })

  it('agrees with units.ts about the Sun', () => {
    const sunMassKg = BODIES.sun.gravitationalParameterKm3PerS2 / GRAVITATIONAL_CONSTANT_KM3_PER_KG_S2
    assert.ok((Math.abs(sunMassKg - SOLAR_MASS_KG) / SOLAR_MASS_KG) < 1e-3)
  })

  it('orders the planets by distance from the Sun', () => {
    assert.deepEqual(PLANET_IDS, ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'])
  })

  it('lists exactly the moons the satellite data carries, plus the Moon', () => {
    assert.deepEqual(moonsOf('earth'), ['moon'])
    assert.deepEqual(moonsOf('didymos'), ['dimorphos'])
    assert.deepEqual(moonsOf('mercury'), [])
    assert.deepEqual(moonsOf('venus'), [])
    const fromSatellites = SATELLITE_IDS.filter((id) => SATELLITE_ELEMENTS[id].parent === 'jupiter')
    assert.deepEqual(moonsOf('jupiter'), fromSatellites)
    const total = [...PLANET_IDS, ...DWARF_PLANET_IDS, ...SMALL_BODY_IDS].flatMap((parent) => moonsOf(parent))
    assert.equal(total.length, SATELLITE_IDS.length + SCENE_SATELLITE_IDS.length + 1)
    for (const planet of [...PLANET_IDS, ...DWARF_PLANET_IDS].filter(id => id !== 'earth')) {
      assert.deepEqual(moonsOf(planet), [...SATELLITE_IDS.filter(id => SATELLITE_ELEMENTS[id].parent === planet), ...SCENE_SATELLITE_IDS.filter(id => bodyData(id).parent === planet)])
    }
  })

  it('makes each planetary system heavier than its planet, by the moons', () => {
    for (const planet of PLANET_IDS) {
      const systemGm = systemGravitationalParameterKm3PerS2(planet)
      const planetGm = bodyData(planet).gravitationalParameterKm3PerS2
      assert.ok(systemGm >= planetGm)
      if (moonsOf(planet).length === 0) assert.equal(systemGm, planetGm)
    }
    // The Earth-Moon system is 1.23 percent heavier than Earth, the one case
    // where the difference is not a rounding detail.
    const ratio = systemGravitationalParameterKm3PerS2('earth') / BODIES.earth.gravitationalParameterKm3PerS2
    assert.ok(Math.abs(ratio - (1.0123)) < 10 ** -4 / 2, `${ratio} is not close to ${1.0123}`)
  })

  it('rejects an unknown body', () => {
    // Was 'pluto' — the id this test used specifically BECAUSE it was
    // anticipated and absent (`rotation.test.ts` pinned the same thing). Pluto
    // is a real body now; a probe id has to be one that never will be.
    assert.throws(() => bodyData('planetNine' as BodyId), /unknown body/)
  })
})
