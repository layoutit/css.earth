type Face = { vertices: readonly (readonly number[])[]; minimum: number[]; maximum: number[] };
type DistanceNode = { minimum: number[]; maximum: number[] } & ({ faces: Face[] } | { children: [DistanceNode, DistanceNode] });
// Independent preparation diagnostics: closest surface distance, not ray depth.
const dot = (a: readonly number[], b: readonly number[]) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const sub = (a: readonly number[], b: readonly number[]) => a.map((v, i) => v - b[i]);
const squared = (v: readonly number[]) => dot(v, v);
export function triangleDistanceSquared(point: readonly number[], [a, b, c]: readonly (readonly number[])[]) {
  const ab = sub(b, a), ac = sub(c, a), ap = sub(point, a);
  const aa = squared(ab), cc = squared(ac), cross = dot(ab, ac);
  const denominator = aa * cc - cross * cross;
  const u = (cc * dot(ap, ab) - cross * dot(ap, ac)) / denominator;
  const v = (aa * dot(ap, ac) - cross * dot(ap, ab)) / denominator;
  if (denominator > 0 && u >= 0 && v >= 0 && u + v <= 1) {
    return squared(ap.map((n, i) => n - u * ab[i] - v * ac[i]));
  }
  return Math.min(...[[a, b], [b, c], [c, a]].map(([start, end]) => {
    const edge = sub(end, start), displacement = sub(point, start);
    const t = Math.max(0, Math.min(1, dot(displacement, edge) / squared(edge)));
    return squared(displacement.map((n, i) => n - t * edge[i]));
  }));
}

export function surfaceDistanceIndex(positions: readonly (readonly number[])[], indices: readonly (readonly number[])[]) {
  const faces = indices.map(face => {
    const vertices = face.map(i => positions[i]);
    return { vertices, minimum: [0, 1, 2].map(i => Math.min(...vertices.map(v => v[i]))),
      maximum: [0, 1, 2].map(i => Math.max(...vertices.map(v => v[i]))) };
  });
  function build(faces: Face[]): DistanceNode {
    const minimum = [Infinity, Infinity, Infinity], maximum = [-Infinity, -Infinity, -Infinity];
    for (const face of faces) for (let i = 0; i < 3; i++) {
      minimum[i] = Math.min(minimum[i], face.minimum[i]); maximum[i] = Math.max(maximum[i], face.maximum[i]);
    }
    if (faces.length <= 12) return { minimum, maximum, faces };
    const extents = maximum.map((v, i) => v - minimum[i]), axis = extents.indexOf(Math.max(...extents));
    faces.sort((a, b) => a.minimum[axis] + a.maximum[axis] - b.minimum[axis] - b.maximum[axis]);
    const middle = Math.floor(faces.length / 2);
    return { minimum, maximum, children: [build(faces.slice(0, middle)), build(faces.slice(middle))] };
  }
  const root = build(faces);
  return (point: readonly number[]) => {
    let nearest = Infinity;
    const bound = (node: DistanceNode) => point.reduce((sum, value, i) => sum +
      Math.max(node.minimum[i] - value, 0, value - node.maximum[i]) ** 2, 0);
    function visit(node: DistanceNode) {
      if (bound(node) > nearest) return;
      if ("faces" in node) {
        for (const face of node.faces) nearest = Math.min(nearest, triangleDistanceSquared(point, face.vertices));
      } else {
        const [a, b] = node.children;
        if (bound(a) < bound(b)) { visit(a); visit(b); } else { visit(b); visit(a); }
      }
    }
    visit(root); return Math.sqrt(nearest);
  };
}
