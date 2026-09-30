import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
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
  for (const planet of PLANET_IDS) it(`derives the ${planet} system-barycentre budget from shipped VSOP metadata`, () => {
    const key = VSOP_KEY_BY_PLANET[planet]
    const accuracy = frameModelAccuracy(systemBarycentreFrameId(planet))
    const expectedKm = VSOP87A_TRUNCATION_BOUND_AU[key] * AU_KM + VSOP_THEORY_DISCREPANCY_KM[key]

    assert.equal(accuracy.kind, 'model-budget')
    assert.ok(Math.abs(accuracy.estimateKm! - (expectedKm)) < 10 ** -10 / 2, `${accuracy.estimateKm} is not close to ${expectedKm}`)
    assert.deepEqual(([accuracy.validFromJdTt, accuracy.validToJdTt]), [
      VSOP87A_VALID_FROM_JD,
      VSOP87A_VALID_TO_JD,
    ])
  })

  it('derives the lunar model budget from the shipped ELP truncation metadata', () => {
    const accuracy = frameModelAccuracy('moon')
    assert.equal(accuracy.kind, 'model-budget')
    assert.ok(Math.abs(accuracy.estimateKm! - (ELP2000_TRUNCATION_BOUND_KM + 2.668)) < 10 ** -12 / 2, `${accuracy.estimateKm} is not close to ${ELP2000_TRUNCATION_BOUND_KM + 2.668}`)
    assert.deepEqual(([accuracy.validFromJdTt, accuracy.validToJdTt]), [
      ELP2000_VALID_FROM_JD,
      ELP2000_VALID_TO_JD,
    ])
  })

  for (const id of SATELLITE_IDS) it(`reports ${id} as its actual sampled fixture maximum`, () => {
    const accuracy = frameModelAccuracy(id)
    const expectedKm = satelliteFixtureMaximumKm(id)
    const toleranceKm = Math.max(1, expectedKm) * 1e-12

    assert.equal(accuracy.kind, 'fit-residual')
    assert.ok(Math.abs(accuracy.estimateKm! - expectedKm) < toleranceKm)
    assert.deepEqual(([accuracy.validFromJdTt, accuracy.validToJdTt]), [
      satelliteRecord(id).fitFromJdTdb,
      satelliteRecord(id).fitToJdTdb,
    ])
  })

  it('preserves the short record-specific satellite windows', () => {
    for (const id of ['hyperion', 'janus', 'epimetheus', 'atlas', 'prometheus', 'pandora'] as const) {
      assert.deepEqual(([frameModelAccuracy(id).validFromJdTt, frameModelAccuracy(id).validToJdTt]), [
        2458849.5,
        2463232.5,
      ])
    }
    assert.deepEqual(([frameModelAccuracy('pan').validFromJdTt, frameModelAccuracy('pan').validToJdTt]), [
      2433282.5,
      2469807.5,
    ])
  })

  for (const planet of PLANET_IDS) it(`conservatively propagates represented-moon errors onto the ${planet} centre edge`, () => {
      const moons = moonsOf(planet).filter(id => bodyData(id).gravitationalParameterKm3PerS2 > 0)
      const accuracy = frameModelAccuracy(planet)
      if (moons.length === 0) {
        assert.equal(accuracy.kind, 'exact-convention')
        assert.equal(accuracy.estimateKm, 0)
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

      assert.equal(accuracy.kind, planet === 'earth' ? 'model-budget' : 'fit-residual')
      assert.ok(Math.abs(accuracy.estimateKm! - (expectedKm)) < 10 ** -12 / 2, `${accuracy.estimateKm} is not close to ${expectedKm}`)
      assert.deepEqual(([accuracy.validFromJdTt, accuracy.validToJdTt]), [validFromJdTt, validToJdTt])
    })

  it('reports the Sun correction as the actual sampled DE441 residual', () => {
    let expectedKm = 0
    for (const row of HORIZONS.sunFromSsb!.rows) {
      expectedKm = Math.max(
        expectedKm,
        distance(scaled(sunBarycentricAu(row.jdTdb), AU_KM), row.positionKm),
      )
    }
    const accuracy = frameModelAccuracy('sun')
    assert.equal(accuracy.kind, 'fit-residual')
    assert.ok(Math.abs(accuracy.estimateKm! - (expectedKm)) < 10 ** -10 / 2, `${accuracy.estimateKm} is not close to ${expectedKm}`)
    assert.deepEqual(([accuracy.validFromJdTt, accuracy.validToJdTt]), [
      VSOP87A_VALID_FROM_JD,
      VSOP87A_VALID_TO_JD,
    ])
  })

  it('keeps the SSB-to-sol zero separate from unknown outer placement', () => {
    assert.partialDeepStrictEqual(frameModelAccuracy('ssb'), { kind: 'exact-convention', estimateKm: 0 })
    for (const id of ['cmb', 'mw', 'sol']) {
      assert.partialDeepStrictEqual(frameModelAccuracy(id), { kind: 'unknown', estimateKm: null })
    }
  })

  it('does not turn unsupported or unregistered models into zero-error claims', () => {
    for (const id of DWARF_PLANET_IDS) {
      assert.partialDeepStrictEqual(frameModelAccuracy(id), { frameId: id, kind: 'unknown', estimateKm: null })
    }
    assert.partialDeepStrictEqual(frameModelAccuracy('not-a-frame'), {
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
      assert.ok(accuracy.sourceLabel.length > 10)
      assert.match(accuracy.sourceUrl, /^https:\/\//)
      assert.ok(accuracy.explanation.length > 40)
    }
  })
})
