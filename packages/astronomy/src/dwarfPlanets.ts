import { bodyData, DWARF_PLANET_IDS, type DwarfPlanetId } from './bodies.js'
import { DWARF_PLANET_ELEMENTS } from './data/dwarfPlanetElements.data.js'
import type { Frame } from './frames.js'
import { keplerApoapsisKm, keplerPositionKm, type KeplerianElements } from './kepler.js'
import { chooseFrameUnitM, SUN_FRAME_ID, type SolarSystemFrameSpec } from './solarSystem.js'
import { M_PER_AU, M_PER_KM } from './units.js'
import type { Vec3 } from './vec3.js'

/**
 * Osculating elements for the five dwarf planets, ICRF equatorial, single
 * epoch — see `data/dwarfPlanetElements.data.ts`'s header for the source, the
 * epoch, and why there is no fitted precession rate the way there is for the
 * moons in `satellites.ts`.
 */
export const dwarfPlanetElements = (id: DwarfPlanetId): KeplerianElements => DWARF_PLANET_ELEMENTS[id].elements

/**
 * Heliocentric position, km, ICRF — no rotation to ICRF is needed here, unlike
 * `satellites.ts`'s `satellitePositionKm`, because the elements were fetched
 * with `REF_PLANE='FRAME'` and are ICRF-referred already.
 */
export const dwarfPlanetPositionKm = (id: DwarfPlanetId, epochJdTt: number): Vec3 =>
  keplerPositionKm(dwarfPlanetElements(id), epochJdTt)

/** `a(1 + e)` — the exact bound the body's frame `maxOffsetInParent` needs. */
export const dwarfPlanetApoapsisKm = (id: DwarfPlanetId): number => keplerApoapsisKm(dwarfPlanetElements(id))

/**
 * Frame specs for the five dwarf planets, each parented DIRECTLY on the Sun
 * frame — no barycentre level, because moons are out of scope here (see
 * `bodies.ts`'s `DwarfPlanetId` doc comment) and a dwarf planet's own frame is
 * therefore its whole heliocentric position, exactly the way a moon's frame is
 * its whole position relative to its planet.
 *
 * Deliberately a SEPARATE function from `solarSystemFrameSpecs`, not folded
 * into it: `solarSystem.test.ts`'s "declares maxOffsetInParent that really
 * bounds the origin" test sweeps every spec that function returns across the
 * package's 1900-2100 validity window, which is a claim about the VSOP87 and
 * ELP2000-82B truncation and does not apply to a single-epoch osculating
 * ellipse — see the data file's header. Keeping this separate means that test
 * keeps meaning exactly what it already asserts, unchanged, while these five
 * frames get their own coverage in `dwarfPlanets.test.ts` instead.
 *
 * The Sun frame's own unit is pinned at `M_PER_AU` by
 * `solarSystem.test.ts` ("picks every unit off the ladder" -> `unitOf.get
 * (SUN_FRAME_ID)).toBe(M_PER_AU)`), so `originInParent` here converts into au
 * directly rather than importing `solarSystemFrameSpecs` just to ask it.
 */
export const dwarfPlanetFrameSpecs = (): readonly SolarSystemFrameSpec[] =>
  DWARF_PLANET_IDS.map((id) => {
    const radiusM = bodyData(id).meanRadiusKm * M_PER_KM
    const unitM = chooseFrameUnitM(radiusM, 0, [])
    const kmPerAu = M_PER_AU / M_PER_KM
    const frame: Frame = {
      id,
      parent: SUN_FRAME_ID,
      unitM,
      radiusM,
      maxOffsetInParent: dwarfPlanetApoapsisKm(id) / kmPerAu,
      originInParent: (epochJdTt) => {
        const km = dwarfPlanetPositionKm(id, epochJdTt)
        return [km[0] / kmPerAu, km[1] / kmPerAu, km[2] / kmPerAu]
      },
    }
    return { body: id, frame }
  })
