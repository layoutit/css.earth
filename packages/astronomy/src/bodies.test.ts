import { describe, expect, it } from 'vitest'
import {
  BODIES,
  BODY_IDS,
  DWARF_PLANET_IDS,
  PLANET_IDS,
  bodyData,
  moonsOf,
  systemGravitationalParameterKm3PerS2,
  type BodyId,
} from './bodies.js'
import { SATELLITE_ELEMENTS, SATELLITE_IDS } from './satellites.js'
import { SOLAR_MASS_KG } from './units.js'

const GRAVITATIONAL_CONSTANT_KM3_PER_KG_S2 = 6.6743e-20

describe('the body table', () => {
  it('has an entry for the Sun, eight planets, the Moon, every satellite and the five dwarf planets', () => {
    expect(BODY_IDS.length).toBe(1 + 8 + 1 + SATELLITE_IDS.length + DWARF_PLANET_IDS.length)
    for (const id of ['sun', ...PLANET_IDS, 'moon', ...SATELLITE_IDS, ...DWARF_PLANET_IDS] as BodyId[]) {
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
      if (id === 'sun') {
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
      expect(data.meanRadiusKm).toBeGreaterThan(0)
      expect(data.gravitationalParameterKm3PerS2).toBeGreaterThan(0)
      // Mean density between 0.3 and 8.5 g/cm^3 covers low-density Pan and
      // Atlas through Mercury and catches a GM or radius entered in the wrong
      // unit, which is the failure this table is most exposed to.
      const massKg = data.gravitationalParameterKm3PerS2 / GRAVITATIONAL_CONSTANT_KM3_PER_KG_S2
      const volumeKm3 = (4 / 3) * Math.PI * data.meanRadiusKm ** 3
      const densityGramsPerCm3 = massKg / volumeKm3 / 1e12
      expect(densityGramsPerCm3).toBeGreaterThan(0.3)
      expect(densityGramsPerCm3).toBeLessThan(8.5)
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
    expect(moonsOf('mercury')).toEqual([])
    expect(moonsOf('venus')).toEqual([])
    const fromSatellites = SATELLITE_IDS.filter((id) => SATELLITE_ELEMENTS[id].parent === 'jupiter')
    expect(moonsOf('jupiter')).toEqual(fromSatellites)
    const total = [...PLANET_IDS, ...DWARF_PLANET_IDS].flatMap((planet) => moonsOf(planet))
    expect(total.length).toBe(SATELLITE_IDS.length + 1)
    expect(moonsOf('saturn')).toEqual([
      'mimas',
      'enceladus',
      'tethys',
      'dione',
      'rhea',
      'titan',
      'hyperion',
      'iapetus',
      'phoebe',
      'janus',
      'epimetheus',
      'telesto',
      'atlas',
      'prometheus',
      'pandora',
      'pan',
    ])
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
