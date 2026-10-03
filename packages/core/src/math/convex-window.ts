/** Convex quadrilateral admission and inward edge planes. No sampling. */
type Edge = { x: number; y: number; nx: number; ny: number };
export function convexWindowEdges(polygon: [number, number][]): Edge[] {
  const directions = polygon.map((point, index) => {
    const next = polygon[(index + 1) % polygon.length], dx = next[0] - point[0], dy = next[1] - point[1], length = Math.hypot(dx, dy);
    if (!(length > 0) || !Number.isFinite(length)) throw new TypeError('Invalid emission window edge.');
    return { x: point[0], y: point[1], dx: dx / length, dy: dy / length };
  });
  let winding = 0;
  for (let index = 0; index < directions.length; index++) {
    const a = directions[index], b = directions[(index + 1) % directions.length], cross = a.dx * b.dy - a.dy * b.dx;
    if (Math.abs(cross) <= 1e-12 || winding !== 0 && Math.sign(cross) !== winding)
      throw new TypeError('Emission window must be a strictly convex quadrilateral.');
    winding = Math.sign(cross);
  }
  return directions.map(edge => ({ x: edge.x, y: edge.y, nx: -edge.dy * winding, ny: edge.dx * winding }));
}
