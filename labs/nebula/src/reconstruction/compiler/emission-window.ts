/** Offline authored sky-footprint selection; this is not a measured physical boundary. */
export interface EmissionWindow {
  sourceId: string;
  /** Convex footprint in the shared [xWest, yNorth] arcsecond frame, either winding. */
  polygonArcsec: [number, number][];
  /** Smooth inward taper; emission is exactly zero on and outside the footprint. */
  featherArcsec: number;
  interpretation: string;
}
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
export function readEmissionWindow(value: unknown): EmissionWindow {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid emission window.');
  const record = value as Record<string, unknown>, polygon = record.polygonArcsec;
  if (Object.keys(record).some(key => !['sourceId', 'polygonArcsec', 'featherArcsec', 'interpretation'].includes(key)) ||
      typeof record.sourceId !== 'string' || !record.sourceId.trim() || typeof record.interpretation !== 'string' || !record.interpretation.trim() ||
      typeof record.featherArcsec !== 'number' || !Number.isFinite(record.featherArcsec) || record.featherArcsec < 0 ||
      !Array.isArray(polygon) || polygon.length !== 4 || polygon.some(point => !Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite)))
    throw new TypeError('Invalid emission window.');
  const points = polygon.map((point: [number, number]): [number, number] => [point[0], point[1]]);
  for (const axis of [0, 1]) {
    const span = Math.max(...points.map(point => point[axis])) - Math.min(...points.map(point => point[axis]));
    if (!(span > 0) || !Number.isFinite(span)) throw new TypeError('Invalid emission window bounds.');
  }
  edges(points);
  return { sourceId: record.sourceId, polygonArcsec: points, featherArcsec: record.featherArcsec, interpretation: record.interpretation };
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
