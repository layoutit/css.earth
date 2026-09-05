import { describe, expect, it } from 'vitest'
import { DWARF_PLANET_IDS, bodyData } from './bodies.js'
import { distance, magnitude } from './__fixtures__/compare.js'
import { HORIZONS } from './__fixtures__/horizons.js'
import {
  dwarfPlanetApoapsisKm,
  dwarfPlanetElements,
  dwarfPlanetFrameSpecs,
  dwarfPlanetPositionKm,
} from './dwarfPlanets.js'
import { FrameTree, fixedFrame } from './frames.js'
import { keplerApoapsisKm, keplerPeriodDays } from './kepler.js'
import { chooseFrameUnitM, SUN_FRAME_ID, solarSystemFrames } from './solarSystem.js'
import { M_PER_AU, M_PER_KM, M_PER_MPC } from './units.js'

/**
 * WHAT THIS MEASURES, and what it does not — read this before trusting a
 * number below.
 *
 * There is no truncated theory and no fit here, unlike the planets (VSOP87)
 * or the moons (a Laplace-plane fit). Each body is a single-epoch OSCULATING
 * ellipse (`data/dwarfPlanetElements.data.ts`, epoch 2461041.5 = 2026-Jan-01
 * TDB — "near today", not J2000, since a single-epoch element set has no
 * reason to prefer one over the other and this is the epoch the app actually
 * renders around). At the epoch itself the propagator agrees with Horizons to
 * float64 noise, because it is reproducing the same conic Horizons fitted.
 * Away from the epoch, real perturbations from the giant planets — Neptune's
 * 3:2 resonance with Pluto above all — pull the true orbit off that fixed
 * ellipse, and the gap grows with time since epoch. That gap is what
 * `NEAR_TOLERANCE_KM` and `FAR_TOLERANCE_KM` below measure: a propagation
 * error, not a truncation, and not bounded by anything this package derives
 * the way the VSOP87 budget in `vsop87.test.ts` is.
 *
 * Fixture epochs (`erisHeliocentric` etc. in `__fixtures__/horizons.ts`) are
 * 2025-Jan-01, 2026-Jan-01 (the element epoch, near-zero error), 2027-Jan-01
 * and 2030-Sep-27 — about a year either side of the epoch, plus a ~4.7-year
 * point that exists to show the growth rate rather than to pass a tight
 * budget. The far point's tolerance is documented separately and is not a
 * claim this package expects to still hold in, say, 2035.
 */
// Measured worst case (over the two near-epoch fixture rows) plus about 15%,
// same shape as `satellites.test.ts`'s per-moon tolerances: pluto 815 912 km,
// ceres 74 834 km, eris 103 248 km, haumea 102 448 km, makemake 102 855 km.
const NEAR_TOLERANCE_KM: Record<string, number> = {
  pluto: 940000,
  ceres: 87000,
  eris: 119000,
  haumea: 118000,
  makemake: 118500,
}
// Same, for the far (~4.7-year) row: pluto 3 972 058 km, ceres 1 569 931 km,
// eris 1 749 661 km, haumea 1 764 824 km, makemake 1 774 203 km. This is the
// growth-rate demonstration the header comment describes, not a claim this
// package expects to hold arbitrarily far from the element epoch.
const FAR_TOLERANCE_KM: Record<string, number> = {
  pluto: 4600000,
  ceres: 1810000,
  eris: 2020000,
  haumea: 2030000,
  makemake: 2040000,
}
const FAR_EPOCH_JD = 2462771.5

describe('dwarf-planet ephemerides against JPL Horizons', () => {
  it.each(DWARF_PLANET_IDS)('places %s within its documented propagation-error budget', (id) => {
    const fixture = HORIZONS[`${id}Heliocentric`]!
    expect(fixture.rows.length).toBe(4)
    let worstNear = 0
    let worstFar = 0
    for (const row of fixture.rows) {
      const error = distance(dwarfPlanetPositionKm(id, row.jdTdb), row.positionKm)
      if (row.jdTdb === FAR_EPOCH_JD) worstFar = Math.max(worstFar, error)
      else worstNear = Math.max(worstNear, error)
    }
    expect(worstNear).toBeLessThan(NEAR_TOLERANCE_KM[id]!)
    expect(worstFar).toBeLessThan(FAR_TOLERANCE_KM[id]!)
  })

  it.each(DWARF_PLANET_IDS)('reproduces %s exactly at its own element epoch', (id) => {
    // The point the header comment calls "float64 noise": this is the same
    // conic Horizons fitted, evaluated at the fit's own epoch, so nothing
    // about perturbations enters yet. A wrong unit conversion, a degrees/
    // radians mixup, or a transposed matrix entry would miss by kilometres
    // here, not by the propagation error the test above tolerates.
    const elements = dwarfPlanetElements(id)
    const fixture = HORIZONS[`${id}Heliocentric`]!
    const atEpoch = fixture.rows.find((row) => row.jdTdb === elements.epochJdTt)!
    expect(distance(dwarfPlanetPositionKm(id, elements.epochJdTt), atEpoch.positionKm)).toBeLessThan(1)
  })

  it.each(DWARF_PLANET_IDS)('bounds %s by a(1 + e) over many orbits', (id) => {
    const elements = dwarfPlanetElements(id)
    const bound = dwarfPlanetApoapsisKm(id)
    expect(bound).toBe(keplerApoapsisKm(elements))
    const period = keplerPeriodDays(elements)
    let farthest = 0
    for (let i = 0; i <= 3000; i++) {
      farthest = Math.max(farthest, magnitude(dwarfPlanetPositionKm(id, elements.epochJdTt + (i * period * 3.3) / 3000)))
    }
    expect(farthest).toBeLessThanOrEqual(bound)
  })

  it('places Eris the farthest out, at roughly its published aphelion', () => {
    // 97.6 au, the number `AGENTS.md` names as the reason to check frame
    // containment at all.
    const apoapsisAu = dwarfPlanetApoapsisKm('eris') / (M_PER_AU / M_PER_KM)
    expect(apoapsisAu).toBeGreaterThan(95)
    expect(apoapsisAu).toBeLessThan(100)
  })
})

describe('dwarf-planet frames', () => {
  const buildTree = () => {
    const tree = new FrameTree()
    for (const frame of solarSystemFrames()) tree.add(frame)
    for (const spec of dwarfPlanetFrameSpecs()) tree.add(spec.frame)
    return tree
  }

  it('is accepted by FrameTree.add, parented directly on the Sun', () => {
    // The invariant this whole file exists to prove: Eris's exit ball, at
    // ~98 au, still fits inside the Sun frame's — `FrameTree.add` enforces
    // that on every call, this just proves it does not throw.
    expect(() => buildTree()).not.toThrow()
    const tree = buildTree()
    for (const id of DWARF_PLANET_IDS) expect(tree.get(id).parent).toBe(SUN_FRAME_ID)
  })

  it('grafts under a coarser parent without changing anything else', () => {
    // Mirrors `solarSystem.test.ts`'s "grafts under a coarser parent" test:
    // `dwarfPlanetFrameSpecs` takes no parent argument because it only ever
    // attaches to the Sun frame, whose own id and unit do not move when the
    // tree the Sun sits in is grafted elsewhere.
    const tree = new FrameTree()
    tree.add(fixedFrame('milkyWay', null, M_PER_MPC))
    for (const frame of solarSystemFrames('milkyWay')) tree.add(frame)
    for (const spec of dwarfPlanetFrameSpecs()) tree.add(spec.frame)
    for (const spec of dwarfPlanetFrameSpecs()) {
      expect(tree.get(spec.frame.id).unitM).toBe(spec.frame.unitM)
      expect(tree.get(spec.frame.id).maxOffsetInParent).toBe(spec.frame.maxOffsetInParent)
    }
  })

  it('picks a unit strictly finer than the Sun frame, off the ladder', () => {
    for (const spec of dwarfPlanetFrameSpecs()) {
      expect(spec.frame.unitM).toBeLessThan(M_PER_AU)
      expect(spec.frame.unitM).toBe(chooseFrameUnitM(bodyData(spec.body!).meanRadiusKm * M_PER_KM, 0, []))
    }
  })

  it('declares a maxOffsetInParent that really bounds the origin, over many orbits', () => {
    // The per-file equivalent of `solarSystem.test.ts`'s sweep, scoped to
    // these five bodies' own periods rather than the package's shared
    // 1900-2100 window — see `dwarfPlanetFrameSpecs`'s doc comment for why
    // that window does not apply here.
    for (const spec of dwarfPlanetFrameSpecs()) {
      const elements = dwarfPlanetElements(spec.body as never)
      const period = keplerPeriodDays(elements)
      let worst = 0
      for (let i = 0; i <= 4000; i++) {
        worst = Math.max(worst, magnitude(spec.frame.originInParent(elements.epochJdTt + (i * period * 3.3) / 4000)))
      }
      expect(worst).toBeLessThanOrEqual(spec.frame.maxOffsetInParent)
      expect(worst / spec.frame.maxOffsetInParent).toBeGreaterThan(0.9)
    }
  })
})

