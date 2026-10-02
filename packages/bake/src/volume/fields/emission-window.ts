import { readEmissionWindow, type EmissionWindow } from '@cssearth/objects';
type Edge = { x: number; y: number; nx: number; ny: number };
function edges(polygon: [number, number][]): Edge[] {
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
export function createEmissionWindowSampler(window?: EmissionWindow): (x: number, y: number) => number {
  if (window === undefined) return () => 1;
  const checked = readEmissionWindow(window), planes = edges(checked.polygonArcsec), feather = checked.featherArcsec;
  return (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return 0;
    let distance = Infinity;
    for (const edge of planes) {
      const inward = (x - edge.x) * edge.nx + (y - edge.y) * edge.ny;
      if (!(inward > 0)) return 0;
      distance = Math.min(distance, inward);
    }
    if (feather === 0 || distance >= feather) return 1;
    const t = distance / feather;
    return t * t * (3 - 2 * t);
  };
}
