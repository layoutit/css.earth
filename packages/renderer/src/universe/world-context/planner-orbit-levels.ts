import type { PreparedContextOrbit, PreparedContextOrbitGeometry } from '@cssearth/objects';

/** An orbit is planned from its summary (centre, bounds, size) until its centre's bank supplies the path (`attachOrbits`);
 * a frame that would draw or measure a path it lacks names that body (`takeWantedOrbits`) and draws no segments for it. */
export type PlannerOrbit = PreparedContextOrbit | PreparedContextOrbitGeometry;
export const hasPath = (orbit: PlannerOrbit): orbit is PreparedContextOrbitGeometry => 'verticesM' in orbit;
// Prepared detail levels are decoded once; each frame only selects one.
export const pathLevels = (orbit: PreparedContextOrbitGeometry) => [{ vertices: orbit.verticesM, trail: orbit.trail, activeChords: orbit.activeChords, deviationM: 0 },
  // Each coarser level gathers its selected vertices once, into its own flat array.
  ...(orbit.lod?.levels ?? []).map(level => ({ vertices: Float64Array.from({ length: level.vertexIndices.length * 3 },
    (_, slot) => orbit.verticesM[level.vertexIndices[Math.floor(slot / 3)]! * 3 + slot % 3]!),
    trail: level.trail, activeChords: level.activeChords, deviationM: level.deviationM }))];
