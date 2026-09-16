/** Offline ellipse geometry. All positions use raster pixel-edge coordinates. */
export type Point = [number, number];
export interface Ellipse { center: Point; radii: Point; angleRadians: number }
export interface Arc { startRadians: number; endRadians: number }
export const tau = 2 * Math.PI;

/** Pivoted elimination; singular point configurations are rejected, never regularized into circles. */
function solve(matrix: number[][], values: number[]): number[] | null {
  const rows = matrix.map((row, i) => [...row, values[i]!]), n = rows.length;
  for (let c = 0; c < n; c++) {
    let pivot = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(rows[r]![c]!) > Math.abs(rows[pivot]![c]!)) pivot = r;
    if (Math.abs(rows[pivot]![c]!) < 1e-9) return null;
    [rows[c], rows[pivot]] = [rows[pivot]!, rows[c]!];
    const value = rows[c]![c]!;
    for (let j = c; j <= n; j++) rows[c]![j] = rows[c]![j]! / value;
    for (let r = 0; r < n; r++) if (r !== c) {
      const factor = rows[r]![c]!;
      for (let j = c; j <= n; j++) rows[r]![j] = rows[r]![j]! - factor * rows[c]![j]!;
    }
  }
  return rows.map(row => row[n]!);
}

/** Five-point conic proposal, optionally least-squares refitted to additional inliers. */
export function fitEllipse(points: Point[], extent: number): Ellipse | null {
  if (points.length < 5 || !(extent > 0)) return null;
  const mx = points.reduce((sum, p) => sum + p[0], 0) / points.length;
  const my = points.reduce((sum, p) => sum + p[1], 0) / points.length;
  const rows = points.map(p => {
    const x = (p[0] - mx) / extent, y = (p[1] - my) / extent;
    return [x * x, x * y, y * y, x, y];
  });
  const gram = Array.from({ length: 5 }, () => new Array<number>(5).fill(0)), rhs = new Array<number>(5).fill(0);
  for (const row of rows) for (let i = 0; i < 5; i++) {
    rhs[i] += row[i]!;
    for (let j = 0; j < 5; j++) gram[i]![j] += row[i]! * row[j]!;
  }
  const result = solve(gram, rhs); if (!result) return null;
  const [a, b, c, d, e] = result as [number, number, number, number, number];
  const det = a * c - b * b / 4; if (!(det > 1e-8)) return null;
  const cx = (b * e / 2 - c * d) / (2 * det), cy = (b * d / 2 - a * e) / (2 * det);
  const level = 1 + a * cx * cx + b * cx * cy + c * cy * cy;
  const difference = Math.hypot(a - c, b), low = (a + c - difference) / 2, high = (a + c + difference) / 2;
  if (!(level / low > 0) || !(level / high > 0)) return null;
  const angle = .5 * Math.atan2(b, a - c) + Math.PI / 2;
  return { center: [mx + cx * extent, my + cy * extent], radii: [Math.sqrt(level / low) * extent, Math.sqrt(level / high) * extent],
    angleRadians: ((angle % Math.PI) + Math.PI) % Math.PI };
}

export function ellipsePoint(ellipse: Ellipse, t: number): Point {
  const c = Math.cos(ellipse.angleRadians), s = Math.sin(ellipse.angleRadians);
  return [ellipse.center[0] + ellipse.radii[0] * Math.cos(t) * c - ellipse.radii[1] * Math.sin(t) * s,
    ellipse.center[1] + ellipse.radii[0] * Math.cos(t) * s + ellipse.radii[1] * Math.sin(t) * c];
}

/** Parameter intervals, not claims about front/back surfaces. Wrapped intervals are split at zero. */
export function supportedArcs(supported: boolean[]): Arc[] {
  const arcs: Arc[] = [];
  let start = -1;
  for (let i = 0; i <= supported.length; i++) {
    if (supported[i] && start < 0) start = i;
    if (!supported[i] && start >= 0) {
      if (i - start >= 2) arcs.push({ startRadians: start * tau / supported.length, endRadians: i * tau / supported.length });
      start = -1;
    }
  }
  return arcs;
}

export function radialError(ellipse: Ellipse, point: Point): number {
  const dx = point[0] - ellipse.center[0], dy = point[1] - ellipse.center[1], c = Math.cos(ellipse.angleRadians), s = Math.sin(ellipse.angleRadians);
  const x = (dx * c + dy * s) / ellipse.radii[0], y = (-dx * s + dy * c) / ellipse.radii[1];
  return Math.abs(Math.hypot(x, y) - 1) * ellipse.radii[1];
}
