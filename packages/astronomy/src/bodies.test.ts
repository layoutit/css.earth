import { SCENE_SATELLITE_IDS } from './sceneSatellites.js'
import { describe, expect, it } from 'vitest'
import {
  BODIES,
  BODY_IDS,
  DWARF_PLANET_IDS,
  SMALL_BODY_IDS,
  COMET_IDS,
  EXOPLANET_IDS,
  BLACK_HOLE_IDS,
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

describe('the body table', () => {
  it('has an entry for the Sun, eight planets, the Moon, every satellite, the five dwarf planets, every placed star, black hole and hosted star, and every exoplanet', () => {
    expect(BODY_IDS.length).toBe(1 + 8 + 1 + SATELLITE_IDS.length + SCENE_SATELLITE_IDS.length + DWARF_PLANET_IDS.length + SMALL_BODY_IDS.length + COMET_IDS.length + STAR_IDS.length + EXOPLANET_IDS.length + HOSTED_STAR_IDS.length)
    for (const id of BLACK_HOLE_IDS) expect(STAR_IDS as readonly string[]).toContain(id)
    for (const id of ['sun', ...PLANET_IDS, 'moon', ...SATELLITE_IDS, ...SCENE_SATELLITE_IDS, ...DWARF_PLANET_IDS, ...SMALL_BODY_IDS, ...COMET_IDS, ...STAR_IDS, ...EXOPLANET_IDS, ...HOSTED_STAR_IDS] as BodyId[]) {
      expect(BODIES[id]).toBeDefined()
      expect(BODIES[id].id).toBe(id)
    }
  })

  it('parents every dwarf planet directly on the Sun', () => {
    // Dwarf element sources target the body centre directly.
    for (const id of DWARF_PLANET_IDS) expect(bodyData(id).parent).toBe('sun')
  })

  it('is a tree rooted at the Sun', () => {
    for (const id of BODY_IDS) {
      const parent = bodyData(id).parent
      // The Sun roots the Solar System; a star placed by its own astrometry orbits nothing here.
      if (id === 'sun' || STAR_IDS.includes(id as StarId)) {
        expect(parent).toBeNull()
        continue
      }
      expect(parent).not.toBeNull()
      // Walk to the root in bounded steps; a cycle would not terminate.
      let cursor: BodyId | null = id
      let steps = 0
      while (cursor !== null) {
        cursor = bodyData(cursor).parent
        steps++
        expect(steps).toBeLessThan(5)
      }
    }
  })

  it('has physically plausible radii and masses', () => {
    for (const id of BODY_IDS) {
      const data = bodyData(id)
      // Zero radius is an unmeasured one, allowed only for a hosted star, and such a star has no published mass either.
      if (data.meanRadiusKm === 0) {
        expect(HOSTED_STAR_IDS, id).toContain(id)
        expect(data.gravitationalParameterKm3PerS2, id).toBe(0)
        continue
      }
      expect(data.meanRadiusKm).toBeGreaterThan(0)
      expect(data.gravitationalParameterKm3PerS2).toBeGreaterThanOrEqual(0)
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
        expect(densityGramsPerCm3, id).toBeGreaterThan(1e4)
        expect(densityGramsPerCm3, id).toBeLessThan(1e8)
        continue
      }
      // Mean density between 0.1 and 8.5 g/cm^3 covers the inflated hot Jupiter WASP-76b (0.17 +/- 0.02, Ehrenreich
      // et al. 2020, Extended Data Table 1), porous Helene and Atlas through Mercury, and catches a GM or radius entered
      // in the wrong unit, which is the failure this table is most exposed to. Above the deuterium-burning limit, about 13 Jupiter
      // masses, a companion is a brown dwarf: an old one keeps a Jupiter-sized radius at tens of Jupiter masses, so its density
      // reaches tens of g/cm^3 (GJ 504 b, 25 Jupiter masses in 0.92 Jupiter radii, Baburaj et al. 2026: about 40).
      const brownDwarf = data.gravitationalParameterKm3PerS2 > 13 * bodyData('jupiter').gravitationalParameterKm3PerS2
      expect(densityGramsPerCm3, id).toBeGreaterThan(0.1)
      expect(densityGramsPerCm3, id).toBeLessThan(brownDwarf ? 150 : 8.5)
    }
  })

  it('agrees with units.ts about the Sun', () => {
    const sunMassKg = BODIES.sun.gravitationalParameterKm3PerS2 / GRAVITATIONAL_CONSTANT_KM3_PER_KG_S2
    expect(Math.abs(sunMassKg - SOLAR_MASS_KG) / SOLAR_MASS_KG).toBeLessThan(1e-3)
  })

  it('orders the planets by distance from the Sun', () => {
    expect(PLANET_IDS).toEqual(['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'])
  })

  it('lists exactly the moons the satellite data carries, plus the Moon', () => {
    expect(moonsOf('earth')).toEqual(['moon'])
    expect(moonsOf('didymos')).toEqual(['dimorphos'])
    expect(moonsOf('mercury')).toEqual([])
    expect(moonsOf('venus')).toEqual([])
    const fromSatellites = SATELLITE_IDS.filter((id) => SATELLITE_ELEMENTS[id].parent === 'jupiter')
    expect(moonsOf('jupiter')).toEqual(fromSatellites)
    const total = [...PLANET_IDS, ...DWARF_PLANET_IDS, ...SMALL_BODY_IDS].flatMap((parent) => moonsOf(parent))
    expect(total.length).toBe(SATELLITE_IDS.length + SCENE_SATELLITE_IDS.length + 1)
    for (const planet of [...PLANET_IDS, ...DWARF_PLANET_IDS].filter(id => id !== 'earth')) {
      expect(moonsOf(planet)).toEqual([...SATELLITE_IDS.filter(id => SATELLITE_ELEMENTS[id].parent === planet), ...SCENE_SATELLITE_IDS.filter(id => bodyData(id).parent === planet)])
    }
  })

  it('makes each planetary system heavier than its planet, by the moons', () => {
    for (const planet of PLANET_IDS) {
      const systemGm = systemGravitationalParameterKm3PerS2(planet)
      const planetGm = bodyData(planet).gravitationalParameterKm3PerS2
      expect(systemGm).toBeGreaterThanOrEqual(planetGm)
      if (moonsOf(planet).length === 0) expect(systemGm).toBe(planetGm)
    }
    // The Earth-Moon system is 1.23 percent heavier than Earth, the one case
    // where the difference is not a rounding detail.
    const ratio = systemGravitationalParameterKm3PerS2('earth') / BODIES.earth.gravitationalParameterKm3PerS2
    expect(ratio).toBeCloseTo(1.0123, 4)
  })

  it('rejects an unknown body', () => {
    // Was 'pluto' — the id this test used specifically BECAUSE it was
    // anticipated and absent (`rotation.test.ts` pinned the same thing). Pluto
    // is a real body now; a probe id has to be one that never will be.
    expect(() => bodyData('planetNine' as BodyId)).toThrow(/unknown body/)
  })
})
