import { describe, expect, it } from 'vitest'
import { distance, magnitude, scaled } from './__fixtures__/compare.js'
import { HORIZONS } from './__fixtures__/horizons.js'
import { PLANET_IDS, bodyData, moonsOf, type PlanetId } from './bodies.js'
import {
  FRAME_CAPTURE_BALL_UNITS,
  FRAME_CAPTURE_RADIUS_MULTIPLIER,
  FRAME_EXIT_BALL_UNITS,
  FrameTree,
  fixedFrame,
} from './frames.js'
import { keplerPeriodDays, type KeplerianElements } from './kepler.js'
import { SATELLITE_IDS, satelliteRecord } from './satellites.js'
import {
  FRAME_EVICTION_TO_CAPTURE_RATIO,
  FRAME_UNIT_LADDER_M,
  MOON_MAX_GEOCENTRIC_KM,
  SSB_FRAME_ID,
  SUN_FRAME_ID,
  chooseFrameUnitM,
  moonApoapsisKm,
  planetOffsetBoundKm,
  planetOffsetFromSystemBarycentreKm,
  solarSystemFrameSpecs,
  solarSystemFrames,
  sunBarycentricAu,
  sunBarycentricBoundAu,
  systemBarycentreFrameId,
} from './solarSystem.js'
import { M_PER_AU, M_PER_KM, M_PER_MPC, M_PER_PC } from './units.js'

const AU_KM = M_PER_AU / M_PER_KM
const VALID_FROM_JD = 2415020.5
const VALID_TO_JD = 2488069.5

const buildTree = (parentFrameId: string | null = null) => {
  const tree = new FrameTree()
  if (parentFrameId !== null) tree.add(fixedFrame(parentFrameId, null, M_PER_MPC))
  for (const frame of solarSystemFrames(parentFrameId)) tree.add(frame)
  return tree
}

describe('the solar-system frame tree', () => {
  it('is accepted by FrameTree.add, every frame, in the order the builder returns them', () => {
    // `add` enforces the two invariants re-anchoring depends on: each child's
    // unit strictly finer than its parent's, and each child's exit ball inside
    // its parent's. This test is the whole reason the builder computes units
    // from a rule instead of taking them from a table someone typed.
    expect(() => buildTree()).not.toThrow()
    const tree = buildTree()
    expect(tree.frameCount).toBe(2 + PLANET_IDS.length * 2 + PLANET_IDS.flatMap(moonsOf).length)
  })

  it('grafts under a coarser parent without changing anything else', () => {
    const grafted = buildTree('milkyWay')
    expect(grafted.get(SSB_FRAME_ID).parent).toBe('milkyWay')
    expect(grafted.get(SSB_FRAME_ID).unitM).toBe(M_PER_PC)
    for (const frame of solarSystemFrames()) {
      if (frame.id === SSB_FRAME_ID) continue
      expect(grafted.get(frame.id).unitM).toBe(frame.unitM)
      expect(grafted.get(frame.id).maxOffsetInParent).toBe(frame.maxOffsetInParent)
    }
  })

  it('has the shape PLAN.md asks for: SSB, Sun, barycentre, planet, moons', () => {
    const tree = buildTree()
    expect(tree.get(SSB_FRAME_ID).parent).toBeNull()
    expect(tree.get(SUN_FRAME_ID).parent).toBe(SSB_FRAME_ID)
    for (const planet of PLANET_IDS) {
      const barycentre = systemBarycentreFrameId(planet)
      expect(tree.get(barycentre).parent).toBe(SUN_FRAME_ID)
      expect(tree.get(planet).parent).toBe(barycentre)
      for (const moon of moonsOf(planet)) expect(tree.get(moon).parent).toBe(planet)
    }
    expect(tree.chainToRoot('moon')).toEqual(['moon', 'earth', 'earthBarycentre', SUN_FRAME_ID, SSB_FRAME_ID])
  })

  it('declares maxOffsetInParent that really bounds the origin, sampled over full orbits', () => {
    // The invariant that only fires months later if it is wrong. Every frame is
    // sampled across the whole validity window AND across an integer-plus-a-bit
    // number of its own orbital periods, so the sampling cannot alias with the
    // motion it is bounding.
    const specs = solarSystemFrameSpecs()
    for (const { frame } of specs) {
      if (frame.parent === null) continue
      let worst = 0
      const samples = 2000
      for (let i = 0; i <= samples; i++) {
        const epoch = VALID_FROM_JD + ((VALID_TO_JD - VALID_FROM_JD) * i) / samples
        worst = Math.max(worst, magnitude(frame.originInParent(epoch)))
      }
      // A moon's period is days; a 200-year sweep at 2000 points steps past
      // hundreds of them, so sweep its own period finely too.
      if (SATELLITE_IDS.includes(frame.id as never)) {
        const period = keplerPeriodDays(satelliteRecord(frame.id as never).elements as KeplerianElements)
        for (let i = 0; i <= 4000; i++) {
          worst = Math.max(worst, magnitude(frame.originInParent(2451545 + (i * period * 37.3) / 4000)))
        }
      }
      if (frame.id === 'moon') {
        for (let i = 0; i <= 8000; i++) {
          worst = Math.max(worst, magnitude(frame.originInParent(2451545 + (i * 27.55 * 37.3) / 8000)))
        }
      }
      expect(worst).toBeLessThanOrEqual(frame.maxOffsetInParent)
      // ... and the bound is not absurdly slack: a `maxOffsetInParent` of
      // Infinity would satisfy the line above and destroy the anchoring rule's
      // termination argument by eating the whole exit-ball budget.
      if (frame.maxOffsetInParent > 0) expect(worst / frame.maxOffsetInParent).toBeGreaterThan(0.9)
    }
  })

  it('keeps every frame capturable from its own surface with real hysteresis', () => {
    // The literal 20, not the imported constant: asserting against
    // `FRAME_EVICTION_TO_CAPTURE_RATIO` would make this test agree with any
    // value the rule was changed to, including the 1 that `FrameTree.add`
    // tolerates and the camera cannot use. Both are checked, so a deliberate
    // change to the rule has to change this line too.
    expect(FRAME_EVICTION_TO_CAPTURE_RATIO).toBe(20)
    for (const { frame, body } of solarSystemFrameSpecs()) {
      const captureRadiusM = Math.max(FRAME_CAPTURE_BALL_UNITS * frame.unitM, FRAME_CAPTURE_RADIUS_MULTIPLIER * frame.radiusM)
      const evictionRadiusM = FRAME_EXIT_BALL_UNITS * frame.unitM
      expect(evictionRadiusM / captureRadiusM).toBeGreaterThanOrEqual(20)
      if (body) expect(frame.radiusM).toBe(bodyData(body).meanRadiusKm * M_PER_KM)
    }
  })

  it('picks every unit off the ladder, and the finest one the rule allows', () => {
    const specs = solarSystemFrameSpecs()
    const unitOf = new Map(specs.map((spec) => [spec.frame.id, spec.frame.unitM]))
    for (const { frame } of specs) {
      expect(FRAME_UNIT_LADDER_M).toContain(frame.unitM)
      if (frame.parent !== null) expect(frame.unitM).toBeLessThan(unitOf.get(frame.parent) ?? Infinity)
    }
    // The rule's own outputs, spelled out so that a change to it is visible in
    // the diff rather than only in a distant assertion.
    expect(unitOf.get('phobos')).toBe(1)
    expect(unitOf.get('deimos')).toBe(1)
    expect(unitOf.get('moon')).toBe(1e3)
    expect(unitOf.get('io')).toBe(1e3)
    // Mimas is the smallest body here, and the one the hysteresis rule moves:
    // its radius alone would admit metres, and metres would leave it with an
    // eviction ball only 2.5 times its capture ball.
    expect(unitOf.get('mimas')).toBe(1e3)
    expect(unitOf.get('mercury')).toBe(1e3)
    expect(unitOf.get('mars')).toBe(1e3)
    expect(unitOf.get('earth')).toBe(1e6)
    expect(unitOf.get('jupiter')).toBe(1e6)
    expect(unitOf.get('earthBarycentre')).toBe(1e9)
    expect(unitOf.get('mercuryBarycentre')).toBe(1e6)
    expect(unitOf.get(SUN_FRAME_ID)).toBe(M_PER_AU)
    expect(unitOf.get(SSB_FRAME_ID)).toBe(M_PER_PC)
  })

  it('rejects Earth in metres, which is the bug the rule exists to prevent', () => {
    // Phase 1's lesson, restated as an executable claim: 2 x 6371 km does not
    // fit inside 1e6 metres, so the unit rule cannot return 1 for Earth and
    // `FrameTree.add` would reject the frame if it did.
    expect(chooseFrameUnitM(6371.01 * M_PER_KM, 0, [])).toBeGreaterThan(1)
    const tree = new FrameTree()
    tree.add(fixedFrame('sun', null, M_PER_AU))
    expect(() =>
      tree.add({
        id: 'earthInMetres',
        parent: 'sun',
        unitM: 1,
        radiusM: 6371.01 * M_PER_KM,
        maxOffsetInParent: 1.02,
        originInParent: () => [1, 0, 0],
      }),
    ).toThrow(/capture ball/)
  })

  it('has no unit rung the rule can fall off', () => {
    // The failure mode of a ladder: a body too big for its coarsest rung.
    expect(() => chooseFrameUnitM(1e30, 0, [])).toThrow(/no unit on the ladder/)
    expect(() => chooseFrameUnitM(0, 0, [M_PER_PC])).toThrow(/no unit on the ladder/)
  })
})

describe('the solar-system ephemeris, resolved through the tree', () => {
  const heliocentricFixture: Record<PlanetId, string> = {
    mercury: 'mercuryBarycentreHeliocentric',
    venus: 'venusBarycentreHeliocentric',
    earth: 'embHeliocentric',
    mars: 'marsBarycentreHeliocentric',
    jupiter: 'jupiterBarycentreHeliocentric',
    saturn: 'saturnBarycentreHeliocentric',
    uranus: 'uranusBarycentreHeliocentric',
    neptune: 'neptuneBarycentreHeliocentric',
  }

  it.each(PLANET_IDS)('resolves the %s system barycentre against the Sun as Horizons does', (planet) => {
    // Not the same test as `vsop87.test.ts`: this one goes through
    // `FrameTree.resolve`, so it also proves the unit conversions between
    // au-scale and Gm-scale frames are right. A factor of 1000 anywhere in the
    // ladder shows up here and nowhere else.
    const tree = buildTree()
    const barycentre = systemBarycentreFrameId(planet)
    for (const row of HORIZONS[heliocentricFixture[planet]]!.rows) {
      const inSunUnits = tree.resolve(SUN_FRAME_ID, { frame: barycentre, offset: [0, 0, 0] }, row.jdTdb)
      const km = scaled(inSunUnits, AU_KM)
      // Same tolerance shape as vsop87.test.ts, expressed as a fraction of the
      // distance so one line covers Mercury and Neptune.
      expect(distance(km, row.positionKm) / magnitude(row.positionKm)).toBeLessThan(1.1e-5)
    }
  })

  it('places Earth relative to the Earth-Moon barycentre to 40 m', () => {
    // The 4671 km that VSOP87 does not give you. Earth's offset from the EMB is
    // the Moon's position times the mass ratio, so this is a test of the mass
    // ratio and of ELP2000-82B at once.
    const fixture = HORIZONS.earthFromEmb!
    let worst = 0
    for (const row of fixture.rows) {
      worst = Math.max(worst, distance(planetOffsetFromSystemBarycentreKm('earth', row.jdTdb), row.positionKm))
      expect(magnitude(row.positionKm)).toBeGreaterThan(4000)
    }
    expect(worst).toBeLessThan(0.04)
  })

  it.each([
    ['jupiter', 'jupiterFromBarycentre', 1],
    ['saturn', 'saturnFromBarycentre', 1.5],
  ] as const)('places %s relative to its system barycentre', (planet, fixtureName, toleranceKm) => {
    const fixture = HORIZONS[fixtureName]!
    let worst = 0
    let largestOffset = 0
    for (const row of fixture.rows) {
      worst = Math.max(worst, distance(planetOffsetFromSystemBarycentreKm(planet, row.jdTdb), row.positionKm))
      largestOffset = Math.max(largestOffset, magnitude(row.positionKm))
    }
    // The offset is real and worth computing: up to 198 km for Jupiter, 300 for
    // Saturn. Asserting that too, so a version that returned zero would fail
    // rather than quietly pass with a loose tolerance.
    expect(largestOffset).toBeGreaterThan(100)
    expect(worst).toBeLessThan(toleranceKm)
  })

  it('places the Sun relative to the barycentre from the planets alone', () => {
    // No barycentric series: the barycentre is the mass-weighted mean, so the
    // Sun's offset falls out of VSOP87A and the GM table. What is left over is
    // everything not among the eight planets — Pluto, Ceres, the belt — which
    // Horizons carries and this does not.
    const fixture = HORIZONS.sunFromSsb!
    let worst = 0
    let largest = 0
    for (const row of fixture.rows) {
      worst = Math.max(worst, distance(scaled(sunBarycentricAu(row.jdTdb), AU_KM), row.positionKm))
      largest = Math.max(largest, magnitude(row.positionKm))
    }
    expect(largest).toBeGreaterThan(1e6)
    expect(worst).toBeLessThan(190)
    // The declared bound holds too, and is not slack by orders of magnitude.
    let worstMagnitudeAu = 0
    for (let i = 0; i <= 4000; i++) {
      const epoch = VALID_FROM_JD + ((VALID_TO_JD - VALID_FROM_JD) * i) / 4000
      worstMagnitudeAu = Math.max(worstMagnitudeAu, magnitude(sunBarycentricAu(epoch)))
    }
    expect(worstMagnitudeAu).toBeLessThanOrEqual(sunBarycentricBoundAu)
    expect(worstMagnitudeAu / sunBarycentricBoundAu).toBeGreaterThan(0.5)
  })

  it('resolves a Martian moon against a Jovian one across nineteen orders of magnitude', () => {
    // The point of the tree: Phobos is measured in metres, Callisto in
    // kilometres, and their common ancestor is the Sun in astronomical units.
    // The answer must still be right to the metre.
    const tree = buildTree()
    const epoch = 2461041.5
    const phobosFromCallisto = tree.resolve('callisto', { frame: 'phobos', offset: [0, 0, 0] }, epoch)
    const distanceKm = magnitude(phobosFromCallisto)
    // Mars and Jupiter were 4.24 au apart at that epoch; the moons cannot move
    // that by more than 2 million km.
    const marsFixture = HORIZONS.marsBarycentreHeliocentric!.rows.find((row) => row.jdTdb === epoch)!
    const jupiterFixture = HORIZONS.jupiterBarycentreHeliocentric!.rows.find((row) => row.jdTdb === epoch)!
    const expected = distance(marsFixture.positionKm, jupiterFixture.positionKm)
    expect(Math.abs(distanceKm - expected)).toBeLessThan(2e6)

    // And the resolution really is fine-grained: one metre of Phobos offset
    // must survive the trip up to the Sun's au-scale frame and back down.
    const nudged = tree.resolve('callisto', { frame: 'phobos', offset: [0, 0, 1] }, epoch)
    expect(Math.abs(nudged[2] - phobosFromCallisto[2] - 1e-3)).toBeLessThan(1e-6)
  })

  it('gives resolveInto bit-identical answers against a snapshot', () => {
    const tree = buildTree()
    const epoch = 2469807.5
    const snapshot = tree.snapshot(epoch)
    const out = new Float64Array(3)
    for (const target of ['moon', 'phobos', 'triton', SUN_FRAME_ID]) {
      const expected = tree.resolve('earth', { frame: target, offset: [1, 2, 3] }, epoch)
      tree.resolveInto(out, 'earth', { frame: target, offset: [1, 2, 3] }, snapshot)
      expect([out[0], out[1], out[2]]).toEqual([...expected])
    }
  })
})

describe('the bounds the builder declares', () => {
  it('bounds each planet\'s offset from its barycentre by the moons\' mass-weighted apoapses', () => {
    for (const planet of PLANET_IDS) {
      const bound = planetOffsetBoundKm(planet)
      const moons = moonsOf(planet)
      if (moons.length === 0) {
        expect(bound).toBe(0)
        continue
      }
      expect(bound).toBeGreaterThan(0)
      let worst = 0
      for (let i = 0; i <= 3000; i++) {
        const epoch = VALID_FROM_JD + ((VALID_TO_JD - VALID_FROM_JD) * i) / 3000
        worst = Math.max(worst, magnitude(planetOffsetFromSystemBarycentreKm(planet, epoch)))
      }
      expect(worst).toBeLessThanOrEqual(bound)
    }
  })

  it('bounds the Moon by MOON_MAX_GEOCENTRIC_KM with the margin it claims', () => {
    expect(moonApoapsisKm('moon')).toBe(MOON_MAX_GEOCENTRIC_KM)
    // The Moon is the one frame whose bound is declared rather than derived —
    // ELP2000-82B has no closed form for its own supremum — so it gets the
    // densest sampling in this file. Apogee recurs monthly and its envelope
    // cycles with the ~8.85-year apsidal period, so 40 years at 4-hour steps
    // covers four and a half of those cycles.
    const moonFrame = solarSystemFrameSpecs().find((candidate) => candidate.frame.id === 'moon')!.frame
    expect(moonFrame.unitM).toBe(1e3)
    let worst = 0
    for (let i = 0; i <= 87600; i++) {
      worst = Math.max(worst, magnitude(moonFrame.originInParent(2451545 + i / 6)))
    }
    expect(worst).toBeLessThan(MOON_MAX_GEOCENTRIC_KM / 1e3)
    expect(worst).toBeGreaterThan(406.5)
  })
})
