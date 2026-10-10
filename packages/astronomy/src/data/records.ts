// The record shapes the generated data modules (cli/body-records.mts, data/generated/) are typed with. The modules that
// read the data re-export them; this module imports no data, so the generated files do not import their readers.
import type { Vec3 } from '../vec3.js'
import type { KeplerianElements } from '../kepler.js'
import type { PeriodicVectorCorrection } from '../periodicCorrection.js'

/** Catalogue astrometry of a star beyond the Solar System: an ICRS direction and epoch, a distance, a proper
 * motion and a radial velocity. Each value names the publication it was read from. */
export interface StarAstrometry {
  /** Stable cross-identification for a HYG/Hipparcos row, when one exists. */
  readonly hipparcosId?: number
  readonly rightAscensionDegrees: number
  readonly declinationDegrees: number
  /** Epoch of the catalogue position, Julian years (ICRS positions are quoted at J2000.0). */
  readonly positionEpochJulianYear: number
  readonly distanceParsecs: number
  /** Proper motion in right ascension, already multiplied by cos(declination). */
  readonly properMotionRaMasPerYear: number
  readonly properMotionDecMasPerYear: number
  readonly radialVelocityKmPerS: number
  /** Which direction the prepared presentation frame puts up: the J2000 ecliptic north pole by default, or the star's own
   * display axis (its rotation record's +z) so the camera orbit lies in the star's equator and reaches its sub-Earth point. */
  readonly presentationUp?: 'display-axis'
  /** A star measured to be gravitationally bound to another, with no measured orbit: a wide binary companion. The pair is one
   * system centred on its centre of mass; `sources.binary` states the measurement that binds them. */
  readonly boundTo?: string
  readonly sources: { readonly position: string; readonly distance: string; readonly properMotion: string; readonly radialVelocity: string; readonly binary?: string }
}

/** A planet on a transit-fitted bound orbit around a placed star. */
export interface HostedOrbit {
  readonly periodDays: number
  /** Semi-major axis in units of the host star's radius, the quantity a transit fit returns. */
  readonly semiMajorAxisStellarRadii: number
  /** Orbital inclination to the plane of the sky, degrees (90 is edge-on). */
  readonly inclinationDegrees: number
  /** Elliptic eccentricity in [0, 1). */
  readonly eccentricity: number
  /** Argument of periapsis in the orbital plane, in the convention where the transit falls at true anomaly f = pi/2 - omega:
   * RadVel's, which reports the star's omega (a planet-centric omega differs by 180 degrees). It is not a position angle on the sky. */
  readonly argumentOfPeriapsisDegrees?: number
  /**
   * Meaning assigned to `transitTimeBmjdTdb`. Required for an eccentric orbit so its epoch is never silently
   * reinterpreted. `inferior-conjunction` uses the transit convention f = pi/2 - argumentOfPeriapsis; `superior-conjunction`
   * is the body behind its host, f = 3pi/2 - argumentOfPeriapsis (an eclipse ephemeris that times the companion's occultation,
   * as Cygnus X-1's times its black hole behind the star); `periastron` is the epoch of periastron passage (f = 0), the epoch an
   * astrometric orbit of a directly imaged planet publishes.
   */
  readonly epochDefinition?: 'inferior-conjunction' | 'superior-conjunction' | 'periastron'
  /** Barycentric modified Julian date in TDB at the stated epoch definition. */
  readonly transitTimeBmjdTdb: number
  /** Position angle of the ascending node, degrees east of celestial north. */
  readonly ascendingNodePositionAngleDegrees: number
  /**
   * The published orbit this planet is predicted from, named as the prediction tool knows it. Tools call that owner for
   * predicted positions and their uncertainty; the runtime never reads this.
   */
  readonly prediction?: {
    readonly tool: 'whereistheplanet'
    readonly planet: string
    readonly reference: string
  }
  /**
   * Set when the orbit's own publication judges it too weakly measured to constrain the central mass: a fit to a short arc
   * of the orbit. The body is placed by it; its path is not drawn. `sources.constraint` quotes the criterion.
   */
  readonly weaklyConstrained?: true
  /**
   * Set when no source measures the orbit's plane and the record takes one on a stated assumption (a sibling planet's measured
   * plane, say). The page draws the path dashed and names the body "(approx)", as it does a moon whose published orbit is not
   * unique (`placement` of a published mutual orbit). `sources.placement` states the assumption and what is measured.
   */
  readonly placement?: 'approximate'
  /**
   * A circumbinary orbit: the elements are Jacobi elements about the centre of mass of the parent and this companion, itself
   * on a hosted orbit around the same parent (Kepler-16 (AB) b about Kepler-16 A and B). States stay parent-centred, as a
   * satellite's `barycentreCompanion` does. `sources.barycentre` cites the masses that weight the centre.
   */
  readonly barycentreCompanion?: string
  readonly sources: {
    readonly period: string
    readonly shape: string
    readonly phase: string
    readonly orientation: string
    readonly eccentricity?: string
    readonly argumentOfPeriapsis?: string
    readonly constraint?: string
    readonly placement?: string
    readonly barycentre?: string
  }
}

/** Source-derived states available only at the prepared scene instant. */
export interface SceneSatelliteRecord {
  readonly systemGmKm3PerS2?: number
  readonly epochJdTt: number
  readonly centerBodyId: string
  readonly positionKm: Vec3
  readonly velocityKmPerDay: Vec3
  readonly gravitationalParametersKm3PerS2: { readonly combined: number; readonly body?: number; readonly parent?: number }
  readonly parentHeliocentricState?: { readonly positionKm: Vec3; readonly velocityKmPerDay: Vec3; readonly provenance?: unknown }
  readonly provenance: { readonly model: string; readonly source?: string; readonly sourcePath?: string; readonly limitations?: readonly string[]; readonly [key: string]: unknown }
}

export interface SatelliteRecord {
  /** Bounded prepared ICRF position residual about the fitted ellipse. */
  readonly positionCorrection?: PeriodicVectorCorrection
  /** Prepared slow libration in mean longitude; fitted inside the stated interval. */
  readonly longitudeHarmonics?: readonly { readonly rateRadPerDay: number; readonly cosineRad: number; readonly sineRad: number; readonly epochJdTt: number }[]
  /** Body id of the planet this moon orbits. */
  readonly parent: string
  /** Horizons target code, so a fixture can be re-fetched without guessing. */
  readonly horizonsCode: string
  /** Companion defining a binary barycentre; output remains parent-centred. */
  readonly barycentreCompanion?: string
  /** First and last JPL Horizons epochs sampled by the element fit. */
  readonly fitFromJdTdb: number
  readonly fitToJdTdb: number
  readonly fitStepDays: number
  /**
   * Pole of this moon's own mean orbit plane (its local Laplace plane), in
   * ICRF. `elements` are referred to the plane with this pole, x-axis along
   * that plane's ascending node on the ICRF equator — the basis
   * `satelliteLaplaceBasis` rebuilds.
   */
  readonly poleRightAscensionRad: number
  readonly poleDeclinationRad: number
  /** Referred to this moon's Laplace plane, epoch J2000 TT. */
  readonly elements: KeplerianElements
}

export interface DwarfPlanetRecord {
  /** The exact Horizons request that produced `elements`. `curl` it to reproduce the row. */
  readonly query: string
  /** Referred to ICRF equatorial axes, heliocentric, single osculating epoch — see the file header. */
  readonly elements: KeplerianElements
}
