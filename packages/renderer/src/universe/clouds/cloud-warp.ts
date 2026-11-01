/** A camera as a cloud's billboards are placed for it: its place and axes in the bank's frame, and the viewport. */
export interface CameraView { readonly px: number; readonly py: number; readonly pz: number; readonly r: readonly number[]; readonly focal: number; readonly centerX: number; readonly centerY: number; readonly width: number; readonly height: number }
export interface WarpPlane { readonly right: readonly number[]; readonly up: readonly number[] }
type Matrix3 = readonly [number, number, number, number, number, number, number, number, number];

/** The plane through the frame's origin that a group's paint is carried on: the bank's disc, or a plane facing the camera when the disc is seen nearly edge-on. */
export function warpPlane(view: CameraView, disc: WarpPlane | undefined, edgeOnCosine: number): WarpPlane {
  const { r } = view;
  if (disc) {
    const n = [disc.right[1]! * disc.up[2]! - disc.right[2]! * disc.up[1]!, disc.right[2]! * disc.up[0]! - disc.right[0]! * disc.up[2]!, disc.right[0]! * disc.up[1]! - disc.right[1]! * disc.up[0]!];
    if (Math.abs(n[0]! * r[2]! + n[1]! * r[5]! + n[2]! * r[8]!) >= edgeOnCosine) return disc;
  }
  return { right: [r[0]!, r[3]!, r[6]!], up: [r[1]!, r[4]!, r[7]!] };
}

/** Plane coordinates (a, b, 1) to homogeneous screen coordinates, by columns of a row-major matrix. */
export function planeToScreen(view: CameraView, plane: WarpPlane): Matrix3 {
  const { r, focal, centerX, centerY, px, py, pz } = view;
  const image = (x: number, y: number, z: number) => {
    const depth = -(r[2]! * x + r[5]! * y + r[8]! * z);
    return [focal * (r[0]! * x + r[3]! * y + r[6]! * z) + centerX * depth, focal * (r[1]! * x + r[4]! * y + r[7]! * z) + centerY * depth, depth] as const;
  };
  const a = image(plane.right[0]!, plane.right[1]!, plane.right[2]!), b = image(plane.up[0]!, plane.up[1]!, plane.up[2]!), c = image(-px, -py, -pz);
  return [a[0], b[0], c[0], a[1], b[1], c[1], a[2], b[2], c[2]];
}

export function invert3(m: Matrix3): Matrix3 | null {
  const [a, b, c, d, e, f, g, h, i] = m, A = e * i - f * h, B = f * g - d * i, C = d * h - e * g, det = a * A + b * B + c * C;
  if (!Number.isFinite(det) || det === 0) return null;
  return [A / det, (c * h - b * i) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, (c * d - a * f) / det, C / det, (b * g - a * h) / det, (a * e - b * d) / det];
}

const multiply = (x: Matrix3, y: Matrix3): Matrix3 => [
  x[0] * y[0] + x[1] * y[3] + x[2] * y[6], x[0] * y[1] + x[1] * y[4] + x[2] * y[7], x[0] * y[2] + x[1] * y[5] + x[2] * y[8],
  x[3] * y[0] + x[4] * y[3] + x[5] * y[6], x[3] * y[1] + x[4] * y[4] + x[5] * y[7], x[3] * y[2] + x[4] * y[5] + x[5] * y[8],
  x[6] * y[0] + x[7] * y[3] + x[8] * y[6], x[6] * y[1] + x[7] * y[4] + x[8] * y[7], x[6] * y[2] + x[7] * y[5] + x[8] * y[8]];

/** The screen homography from one camera's paint to another camera's view of the plane, its CSS and its largest local scale change at the viewport's corners. */
export function warpBetween(from: CameraView, plane: WarpPlane, inverse: Matrix3, to: CameraView): { h: Matrix3; css: string; held: boolean; scale: number } {
  const raw = multiply(planeToScreen(to, plane), inverse), h = raw.map(v => v / raw[8]) as unknown as Matrix3, n = (v: number) => Number(v.toPrecision(9));
  const css = `matrix3d(${n(h[0])},${n(h[3])},0,${n(h[6])},${n(h[1])},${n(h[4])},0,${n(h[7])},0,0,1,0,${n(h[2])},${n(h[5])},0,1)`;
  let held = Number.isFinite(raw[8]) && raw[8] !== 0, scale = 1;
  for (const [x, y] of [[0, 0], [from.width, 0], [0, from.height], [from.width, from.height]] as const) {
    const w = h[6] * x + h[7] * y + 1;
    if (!(w > .05)) { held = false; continue; }
    const X = (h[0] * x + h[1] * y + h[2]) / w, Y = (h[3] * x + h[4] * y + h[5]) / w;
    const dx = (h[0] - X * h[6]) / w, dy = (h[3] - Y * h[6]) / w, ex = (h[1] - X * h[7]) / w, ey = (h[4] - Y * h[7]) / w, area = dx * ey - dy * ex, local = Math.sqrt(Math.abs(area));
    if (area <= 0) held = false;
    const ratio = local > 0 ? Math.max(local, 1 / local) : Infinity;
    if (ratio > scale) scale = ratio;
  }
  return { h, css, held, scale };
}

/** The camera's turn between two views, in radians. */
export function turnBetween(a: CameraView, b: CameraView): number {
  let trace = 0; for (let i = 0; i < 9; i++) trace += a.r[i]! * b.r[i]!;
  return Math.acos(Math.max(-1, Math.min(1, (trace - 1) / 2)));
}
