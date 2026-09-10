import type {SourceMesh} from './contracts.mts';
// Preparation-only topology support for an observed surface with real gaps.
// No vertices or boundary plates are fabricated to close the observations.
export function inspectOpenSurface(indices: Uint32Array, positions: readonly number[][]) {
  const edges = new Map<string,{face:number;direction:number}[]>(), vertices = new Set<number>(), neighbors = Array.from({ length: indices.length / 3 }, (): {face:number;flip:boolean}[] => []);
  if (!indices.length || indices.length % 3) throw new TypeError('Surface requires complete triangles.');
  for (let offset = 0; offset < indices.length; offset += 3) {
    const ids = Array.from(indices.slice(offset, offset + 3));
    const points = ids.map(i => positions[i]);
    if (new Set(ids).size !== 3 || ids.some(i => !Number.isSafeInteger(i) || i < 0) ||
        points.some(p => !Array.isArray(p) || p.length !== 3 || !p.every(Number.isFinite))) throw new TypeError('Invalid observed surface triangle.');
    const [a,b,c] = points, ab = b.map((n,i) => n-a[i]), ac = c.map((n,i) => n-a[i]);
    if (!(Math.hypot(ab[1]*ac[2]-ab[2]*ac[1], ab[2]*ac[0]-ab[0]*ac[2], ab[0]*ac[1]-ab[1]*ac[0]) > 0)) throw new TypeError('Degenerate observed surface triangle.');
    for (let j = 0; j < 3; j++) {
      const a = ids[j], b = ids[(j+1)%3], key = a < b ? `${a},${b}` : `${b},${a}`;
      vertices.add(a);
      if (!edges.has(key)) edges.set(key, []);
      edges.get(key)!.push({ face: offset/3, direction: a < b ? 1 : -1 });
    }
  }
  const boundary = [], conflicts = [];
  for (const [key, incidents] of edges) {
    if (incidents.length > 2) throw new TypeError('Nonmanifold observed surface edge.');
    if (incidents.length === 1) boundary.push(key);
    else {
      const [a,b] = incidents, flip = a.direction === b.direction;
      if (flip) conflicts.push(key);
      neighbors[a.face].push({ face: b.face, flip });
      neighbors[b.face].push({ face: a.face, flip });
    }
  }
  if (!boundary.length) throw new TypeError('An open observed surface must have source boundaries.');
  const components = [], visited = new Set();
  for (let seed = 0; seed < neighbors.length; seed++) if (!visited.has(seed)) {
    const queue = [seed]; visited.add(seed);
    for (let i = 0; i < queue.length; i++) for (const {face} of neighbors[queue[i]]) if (!visited.has(face)) { visited.add(face); queue.push(face); }
    components.push(queue);
  }
  return { neighbors, components, report: { vertices: vertices.size, faces: indices.length/3,
    edges: edges.size, eulerCharacteristic: vertices.size-edges.size+indices.length/3,
    boundary: boundary.sort(), windingConflicts: conflicts.sort(), edgeComponents: components.length } };
}

/** Keep the majority published orientation in each edge-connected patch.
 * Correct inconsistent plate ordering without moving points or joining gaps. */
export function orientObservedSurface<T extends Pick<SourceMesh, "indices" | "positions">>(mesh: T) {
  const indices = Uint32Array.from(mesh.indices.flat()), source = inspectOpenSurface(indices, mesh.positions);
  const flips = new Map<number,boolean>();
  for (const component of source.components) {
    const queue = [component[0]]; flips.set(component[0], false);
    for (let i = 0; i < queue.length; i++) for (const edge of source.neighbors[queue[i]]) {
      const expected = flips.get(queue[i]) !== edge.flip;
      if (!flips.has(edge.face)) { flips.set(edge.face, expected); queue.push(edge.face); }
      else if (flips.get(edge.face) !== expected) throw new TypeError('Observed surface is not orientable.');
    }
    const count = component.filter(i => flips.get(i)).length;
    if (count * 2 === component.length) throw new TypeError('Published surface orientation is ambiguous.');
    if (count * 2 > component.length) for (const i of component) flips.set(i, !flips.get(i));
  }
  const reorientedFaces: number[] = [], triangles = mesh.indices.map((face,i) => {
    if (!flips.get(i)) return face;
    reorientedFaces.push(i); return [face[0],face[2],face[1]];
  });
  return { ...mesh, indices: triangles, sourceOrientation: { reorientedFaces,
    sourceWindingConflicts: source.report.windingConflicts.length } };
}

export function validateObservedReduction(sourceIndices: Uint32Array, reducedIndices: Uint32Array, positions: readonly number[][]) {
  const source = inspectOpenSurface(sourceIndices, positions).report;
  const reduced = inspectOpenSurface(reducedIndices, positions).report;
  if (source.windingConflicts.length || reduced.windingConflicts.length ||
      source.eulerCharacteristic !== reduced.eulerCharacteristic || source.edgeComponents !== reduced.edgeComponents ||
      JSON.stringify(source.boundary) !== JSON.stringify(reduced.boundary)) throw new TypeError('Observed surface reduction changed source boundaries or topology.');
  return { ...reduced, boundaryEdges: reduced.boundary.length, boundary: undefined,
    windingConflicts: undefined, boundaryPreserved: true };
}
