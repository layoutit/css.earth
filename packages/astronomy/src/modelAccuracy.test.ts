import { describe, expect, it } from 'vitest'
import { distance, scaled } from './__fixtures__/compare.js'
import { HORIZONS } from './__fixtures__/horizons.js'
import {
  DWARF_PLANET_IDS,
  PLANET_IDS,
  bodyData,
  moonsOf,
  systemGravitationalParameterKm3PerS2,
  type PlanetId,
} from './bodies.js'
import { ELP2000_TRUNCATION_BOUND_KM, ELP2000_VALID_FROM_JD, ELP2000_VALID_TO_JD } from './elp2000.js'
import { frameModelAccuracy } from './modelAccuracy.js'
import { SATELLITE_IDS, satellitePositionKm, satelliteRecord, type SatelliteId } from './satellites.js'
import { sunBarycentricAu, systemBarycentreFrameId } from './solarSystem.js'
import { M_PER_AU, M_PER_KM } from './units.js'
import {
  VSOP87A_TRUNCATION_BOUND_AU,
  VSOP87A_VALID_FROM_JD,
  VSOP87A_VALID_TO_JD,
  type Vsop87BodyKey,
} from './vsop87.js'

const AU_KM = M_PER_AU / M_PER_KM

const VSOP_KEY_BY_PLANET: Record<PlanetId, Vsop87BodyKey> = {
  mercury: 'mercury',
  venus: 'venus',
  earth: 'emb',
  mars: 'mars',
  jupiter: 'jupiter',
  saturn: 'saturn',
  uranus: 'uranus',
  neptune: 'neptune',
}

const VSOP_THEORY_DISCREPANCY_KM: Record<Vsop87BodyKey, number> = {
  mercury: 9.3,
  venus: 17.1,
  emb: 19.1,
  mars: 123,
  jupiter: 1359,
  saturn: 1869.8,
  uranus: 17328.5,
  neptune: 48536.5,
}

const satelliteFixtureMaximumKm = (id: SatelliteId): number => {
  let worst = 0
  for (const row of HORIZONS[`${id}FromParent`]!.rows) {
    worst = Math.max(worst, distance(satellitePositionKm(id, row.jdTdb), row.positionKm))
  }
  return worst
}

describe('frame position-model accuracy metadata', () => {
  it.each(PLANET_IDS)('derives the %s system-barycentre budget from shipped VSOP metadata', (planet) => {
    const key = VSOP_KEY_BY_PLANET[planet]
    const accuracy = frameModelAccuracy(systemBarycentreFrameId(planet))
    const expectedKm = VSOP87A_TRUNCATION_BOUND_AU[key] * AU_KM + VSOP_THEORY_DISCREPANCY_KM[key]

    expect(accuracy.kind).toBe('model-budget')
    expect(accuracy.estimateKm).toBeCloseTo(expectedKm, 10)
    expect([accuracy.validFromJdTt, accuracy.validToJdTt]).toEqual([
      VSOP87A_VALID_FROM_JD,
      VSOP87A_VALID_TO_JD,
    ])
  })

  it('derives the lunar model budget from the shipped ELP truncation metadata', () => {
    const accuracy = frameModelAccuracy('moon')
    expect(accuracy.kind).toBe('model-budget')
    expect(accuracy.estimateKm).toBeCloseTo(ELP2000_TRUNCATION_BOUND_KM + 2.668, 12)
    expect([accuracy.validFromJdTt, accuracy.validToJdTt]).toEqual([
      ELP2000_VALID_FROM_JD,
      ELP2000_VALID_TO_JD,
    ])
  })

  it.each(SATELLITE_IDS)('reports %s as its actual sampled fixture maximum', (id) => {
    const accuracy = frameModelAccuracy(id)
    const expectedKm = satelliteFixtureMaximumKm(id)
    const toleranceKm = Math.max(1, expectedKm) * 1e-12

    expect(accuracy.kind).toBe('fit-residual')
    expect(Math.abs(accuracy.estimateKm! - expectedKm)).toBeLessThan(toleranceKm)
    expect([accuracy.validFromJdTt, accuracy.validToJdTt]).toEqual([
      satelliteRecord(id).fitFromJdTdb,
      satelliteRecord(id).fitToJdTdb,
    ])
  })

  it('preserves the short record-specific satellite windows', () => {
    for (const id of ['hyperion', 'janus', 'epimetheus', 'atlas', 'prometheus', 'pandora'] as const) {
      expect([frameModelAccuracy(id).validFromJdTt, frameModelAccuracy(id).validToJdTt]).toEqual([
        2458849.5,
        2463232.5,
      ])
    }
    expect([frameModelAccuracy('pan').validFromJdTt, frameModelAccuracy('pan').validToJdTt]).toEqual([
      2433282.5,
      2469807.5,
    ])
  })

  it.each(PLANET_IDS)(
    'conservatively propagates represented-moon errors onto the %s centre edge',
    (planet) => {
      const moons = moonsOf(planet).filter(id => bodyData(id).gravitationalParameterKm3PerS2 > 0)
      const accuracy = frameModelAccuracy(planet)
      if (moons.length === 0) {
        expect(accuracy.kind).toBe('exact-convention')
        expect(accuracy.estimateKm).toBe(0)
        return
      }

      const systemGm = systemGravitationalParameterKm3PerS2(planet)
      let expectedKm = 0
      let validFromJdTt = -Infinity
      let validToJdTt = Infinity
      for (const moon of moons) {
        const moonEstimateKm =
          moon === 'moon'
            ? ELP2000_TRUNCATION_BOUND_KM + 2.668
            : satelliteFixtureMaximumKm(moon as SatelliteId)
        expectedKm += (bodyData(moon).gravitationalParameterKm3PerS2 / systemGm) * moonEstimateKm
        if (moon === 'moon') {
          validFromJdTt = Math.max(validFromJdTt, ELP2000_VALID_FROM_JD)
          validToJdTt = Math.min(validToJdTt, ELP2000_VALID_TO_JD)
        } else {
          const record = satelliteRecord(moon as SatelliteId)
          validFromJdTt = Math.max(validFromJdTt, record.fitFromJdTdb)
          validToJdTt = Math.min(validToJdTt, record.fitToJdTdb)
        }
      }

      expect(accuracy.kind).toBe(planet === 'earth' ? 'model-budget' : 'fit-residual')
      expect(accuracy.estimateKm).toBeCloseTo(expectedKm, 12)
      expect([accuracy.validFromJdTt, accuracy.validToJdTt]).toEqual([validFromJdTt, validToJdTt])
    },
  )

  it('reports the Sun correction as the actual sampled DE441 residual', () => {
    let expectedKm = 0
    for (const row of HORIZONS.sunFromSsb!.rows) {
      expectedKm = Math.max(
        expectedKm,
        distance(scaled(sunBarycentricAu(row.jdTdb), AU_KM), row.positionKm),
      )
    }
    const accuracy = frameModelAccuracy('sun')
    expect(accuracy.kind).toBe('fit-residual')
    expect(accuracy.estimateKm).toBeCloseTo(expectedKm, 10)
    expect([accuracy.validFromJdTt, accuracy.validToJdTt]).toEqual([
      VSOP87A_VALID_FROM_JD,
      VSOP87A_VALID_TO_JD,
    ])
  })

  it('keeps the SSB-to-sol zero separate from unknown outer placement', () => {
    expect(frameModelAccuracy('ssb')).toMatchObject({ kind: 'exact-convention', estimateKm: 0 })
    for (const id of ['cmb', 'mw', 'sol']) {
      expect(frameModelAccuracy(id)).toMatchObject({ kind: 'unknown', estimateKm: null })
    }
  })

  it('does not turn unsupported or unregistered models into zero-error claims', () => {
    for (const id of DWARF_PLANET_IDS) {
      expect(frameModelAccuracy(id)).toMatchObject({ frameId: id, kind: 'unknown', estimateKm: null })
    }
    expect(frameModelAccuracy('not-a-frame')).toMatchObject({
      frameId: 'not-a-frame',
      kind: 'unknown',
      estimateKm: null,
      validFromJdTt: null,
      validToJdTt: null,
    })
  })

  it('carries readable provenance for every supported solar-system edge', () => {
    const frameIds = [
      'ssb',
      'sun',
      ...PLANET_IDS,
      ...PLANET_IDS.map(systemBarycentreFrameId),
      'moon',
      ...SATELLITE_IDS,
    ]
    for (const id of frameIds) {
      const accuracy = frameModelAccuracy(id)
      expect(accuracy.sourceLabel.length).toBeGreaterThan(10)
      expect(accuracy.sourceUrl).toMatch(/^https:\/\//)
      expect(accuracy.explanation.length).toBeGreaterThan(40)
    }
  })
})
