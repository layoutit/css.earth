export type ObjectClassification = 'star' | 'planet' | 'satellite' | 'dwarf-planet' | 'asteroid' | 'comet' | 'trans-neptunian' | 'interstellar' | 'exoplanet' | 'black-hole'
  | 'galaxy' | 'galaxy-cluster' | 'nebula' | 'globular-cluster' | 'open-cluster'
  /** A host with what is bound to it, as an object of its own: a star's planets, a planet's moons, a star's companion stars. */
  | 'planetary-system' | 'satellite-system' | 'star-system';
/** The classifications of a system object: a star with the bodies that orbit it (planetary), a star with only the stars
 * bound to it (star), any other body with its moons (satellite). */
export const SYSTEM_CLASSIFICATIONS = Object.freeze(['planetary-system', 'satellite-system', 'star-system'] as const);
export const isSystemClassification = (classification: string): classification is (typeof SYSTEM_CLASSIFICATIONS)[number] =>
  (SYSTEM_CLASSIFICATIONS as readonly string[]).includes(classification);
/** A body placed by its astrometry (a position and a distance) rather than an orbit: stars, black holes and the galaxies,
 * clusters and nebulae beyond them. Each is a parentless world-context body; none draws a trajectory. */
/** The placed bodies with no solid surface: their radius frames them, it occludes nothing. */
export const EXTENDED_CLASSIFICATIONS: readonly ObjectClassification[] = Object.freeze(['galaxy', 'galaxy-cluster', 'nebula', 'globular-cluster', 'open-cluster']);
export const isExtendedClassification = (classification: string | undefined): boolean => (EXTENDED_CLASSIFICATIONS as readonly (string | undefined)[]).includes(classification);
export const PLACED_CLASSIFICATIONS: readonly ObjectClassification[] = Object.freeze(['star', 'black-hole', ...EXTENDED_CLASSIFICATIONS]);
export const isPlacedClassification = (classification: string | undefined): boolean => (PLACED_CLASSIFICATIONS as readonly (string | undefined)[]).includes(classification);
// Classification vocabulary, not a registry of object identities. Extend this
// list deliberately when a package introduces a new kind of body.
export const OBJECT_CLASSIFICATIONS = Object.freeze([
  "star", "planet", "satellite", "dwarf-planet", "asteroid", "trans-neptunian", "comet", "interstellar", "exoplanet", "black-hole",
  "galaxy", "galaxy-cluster", "nebula", "globular-cluster", "open-cluster", "planetary-system", "satellite-system", "star-system",
]);
