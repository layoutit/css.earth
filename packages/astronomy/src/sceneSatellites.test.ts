import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { SCENE_SATELLITE_IDS, sceneSatelliteStateKm } from './sceneSatellites.js'
import { moonPositionRelativeToParentKm } from './solarSystem.js'
import { frameModelAccuracy } from './modelAccuracy.js'

describe('source-state companion epoch boundary', () => {
  for (const id of SCENE_SATELLITE_IDS) it(`rejects ${id} through the public moon API outside the prepared instant`, () => {
    const epoch = 2461286.5
    assert.deepEqual(moonPositionRelativeToParentKm(id, epoch), sceneSatelliteStateKm(id, epoch).positionKm)
    // An adjacent instant must not silently become a constant-position propagator.
    for (const offset of [-1, -1 / 86400, 1 / 86400, 1]) {
      assert.throws(() => moonPositionRelativeToParentKm(id, epoch + offset), /prepared scene epoch/)
    }
    assert.partialDeepStrictEqual(frameModelAccuracy(id), {kind: 'unknown', estimateKm: null,
      validFromJdTt: epoch, validToJdTt: epoch})
  })
})
