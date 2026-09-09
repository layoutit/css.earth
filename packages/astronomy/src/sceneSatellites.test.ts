import { describe, expect, it } from 'vitest'
import { SCENE_SATELLITE_IDS, sceneSatelliteStateKm } from './sceneSatellites.js'
import { moonPositionRelativeToPlanetKm } from './solarSystem.js'
import { frameModelAccuracy } from './modelAccuracy.js'

describe('source-state companion epoch boundary', () => {
  it.each(SCENE_SATELLITE_IDS)('rejects %s through the public moon API outside the prepared instant', id => {
    const epoch = 2461286.5
    expect(moonPositionRelativeToPlanetKm(id, epoch)).toEqual(sceneSatelliteStateKm(id, epoch).positionKm)
    // An adjacent instant must not silently become a constant-position propagator.
    for (const offset of [-1, -1 / 86400, 1 / 86400, 1]) {
      expect(() => moonPositionRelativeToPlanetKm(id, epoch + offset)).toThrow(/prepared scene epoch/)
    }
    expect(frameModelAccuracy(id)).toMatchObject({kind: 'unknown', estimateKm: null,
      validFromJdTt: epoch, validToJdTt: epoch})
  })
})
