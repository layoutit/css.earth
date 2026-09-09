import { COMET_ELEMENTS } from './data/cometElements.data.js'
import { keplerPositionKm, type KeplerianElements } from './kepler.js'
import type { CometId } from './bodies.js'
import type { Vec3 } from './vec3.js'

/** Single-epoch osculating conics for prepared placement. These do not model
 * planetary perturbations or nongravitational acceleration from outgassing. */
export const cometElements = (id: CometId): KeplerianElements => COMET_ELEMENTS[id].elements
export const cometPositionKm = (id: CometId, epochJdTt: number): Vec3 =>
  keplerPositionKm(cometElements(id), epochJdTt)
