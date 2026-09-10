import type {SourceMesh} from './contracts.mts';
import { createIndexedShape } from './obj-shape.mts';

const edgeKey = (a: number, b: number) => a < b ? `${a},${b}` : `${b},${a}`;
const projectedArea = (face: readonly number[], positions: readonly number[][]) => {
  const [a, b, c] = face.map(i => positions[i]);
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
};

/** Grid boundaries often contain collinear XY posts with distinct heights.
 * A collapse can leave a vertical triangle between those posts. Flip only an
 * interior diagonal when both replacement faces have positive projected area.
 * All source positions, boundary edges and gaps are preserved. */
export function repairImageDemDiagonals(input: Uint32Array, positions: readonly number[][]) {
  const faces = Array.from({ length: input.length / 3 }, (_, i) => Array.from(input.slice(i * 3, i * 3 + 3)));
  let flips = 0;
  for (let pass = 0; pass <= faces.length; pass++) {
    const invalid = faces.flatMap((face, i) => projectedArea(face, positions) <= 0 ? [i] : []);
    if (!invalid.length) return { indices: Uint32Array.from(faces.flat()), flips };
    const edges = new Map<string,number[]>();
    faces.forEach((face, i) => face.forEach((a, j) => {
      const key = edgeKey(a, face[(j + 1) % 3]);
      if (!edges.has(key)) edges.set(key, []);
      edges.get(key)!.push(i);
    }));
    let changed = false;
    for (const i of invalid) {
      const face = faces[i];
      for (let j = 0; j < 3; j++) {
        const [a, b, c] = [face[j], face[(j + 1) % 3], face[(j + 2) % 3]];
        const neighbors = edges.get(edgeKey(c, a))!.filter(k => k !== i);
        if (neighbors.length !== 1) continue;
        const k = neighbors[0], other = faces[k], index = other.indexOf(a);
        if (other[(index + 1) % 3] !== c) continue;
        const d = other[(index + 2) % 3], first = [a, b, d], second = [b, c, d];
        if (edges.has(edgeKey(b, d)) || projectedArea(first, positions) <= 0 || projectedArea(second, positions) <= 0) continue;
        faces[i] = first; faces[k] = second; flips++; changed = true; break;
      }
      if (changed) break;
    }
    if (!changed) break;
  }
  throw new Error('Image DEM reduction contains a folded or vertical surface.');
}

/** Measure physical 3D transfer after diagonal repair, in both directions.
 * This covers every used vertex and face centroid; it is not a continuous
 * Hausdorff bound. The retained scene and all scientific samplers still enforce
 * their own per-point distance limit. */
export function measureImageDemReduction(source: SourceMesh, flatIndices: Uint32Array, maximumDistanceMeters: number) {
  const indices = Array.from({ length: flatIndices.length / 3 }, (_, i) => Array.from(flatIndices.slice(i * 3, i * 3 + 3)));
  const reduced = createIndexedShape(source.positions, indices, { metersPerUnit: 1,
    expectedVertices: source.positions.length, expectedFaces: indices.length });
  const measure = (from: SourceMesh, to: SourceMesh) => {
    let count = 0, maximum = 0, squared = 0;
    const sample = (point: readonly number[]) => {
      const hit = to.closestPoint(point, maximumDistanceMeters, false);
      if (!hit) throw new Error(`Image DEM reduction exceeds ${maximumDistanceMeters} m source distance at ${point.join(',')}.`);
      count++; maximum = Math.max(maximum, hit.distanceMeters); squared += hit.distanceMeters ** 2;
    };
    for (const id of new Set(from.indices.flat())) sample(from.positions[id]);
    for (const face of from.indices) sample([0, 1, 2].map(axis => face.reduce((sum, i) => sum + from.positions[i][axis], 0) / 3));
    return { samples: count, maximumDistanceMeters: maximum, rmsDistanceMeters: Math.sqrt(squared / count) };
  };
  return { sourceToRetained: measure(source, reduced), retainedToSource: measure(reduced, source),
    sampling: 'Every used vertex and triangle centroid in both directions; not a continuous Hausdorff bound.' };
}
