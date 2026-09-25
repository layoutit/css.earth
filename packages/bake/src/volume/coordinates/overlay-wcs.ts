/** Offline ICRS TAN/orthographic SIN footprints. FITS pixels are bottom-left, one-based. */
export type Vec3 = [number, number, number];
export interface ImageWcs {
  projection: 'TAN' | 'SIN'; coordinateFrame: 'ICRS';
  referenceDimension: [number, number]; referencePixel: [number, number];
  referenceValueDeg: [number, number]; scaleDeg: [number, number]; rotationDeg: number;
}
export interface OverlayFrame {
  referenceFrame: string; epochJdTt: number; originM: readonly number[];
  localToReferenceXyzw: readonly number[]; metersPerUnit: number;
}
const radians = Math.PI / 180;
const dot = (a: readonly number[], b: readonly number[]) => a.reduce((sum, value, i) => sum + value * b[i]!, 0);

export function validateImageWcs(wcs: ImageWcs): void {
  if (!['TAN', 'SIN'].includes(wcs.projection) || wcs.coordinateFrame !== 'ICRS') throw new TypeError('Overlay WCS must be ICRS TAN or orthographic SIN.');
  for (const pair of [wcs.referenceDimension, wcs.referencePixel, wcs.referenceValueDeg, wcs.scaleDeg]) {
    if (pair.length !== 2 || !pair.every(Number.isFinite)) throw new TypeError('Invalid WCS coordinate pair.');
  }
  if (!Number.isFinite(wcs.rotationDeg) || wcs.referenceDimension.some(n => n <= 0) ||
      wcs.scaleDeg[0] >= 0 || wcs.scaleDeg[1] <= 0 || Math.abs(wcs.referenceValueDeg[1]) > 90) {
    throw new TypeError('Invalid WCS dimensions, scale, rotation or declination.');
  }
}

/** Calabretta & Greisen (2002): TAN r=tan(theta), ordinary SIN r=sin(theta).
 * SIN here has zero slant parameters; it is not the generalized slant projection. */
export function wcsPixelRay(wcs: ImageWcs, x: number, y: number): Vec3 {
  const a = wcs.referenceValueDeg[0] * radians, d = wcs.referenceValueDeg[1] * radians;
  const rotation = wcs.rotationDeg * radians, cosine = Math.cos(rotation), sine = Math.sin(rotation);
  const dx = (x - wcs.referencePixel[0]) * wcs.scaleDeg[0] * radians;
  const dy = (y - wcs.referencePixel[1]) * wcs.scaleDeg[1] * radians;
  const east = cosine * dx - sine * dy, north = sine * dx + cosine * dy;
  const radiusSquared = east * east + north * north;
  if (wcs.projection === 'SIN' && radiusSquared > 1) throw new TypeError('SIN pixel lies outside the visible hemisphere.');
  const forward = wcs.projection === 'SIN' ? Math.sqrt(1 - radiusSquared) : 1;
  const ray: Vec3 = [forward * Math.cos(d) * Math.cos(a) - east * Math.sin(a) - north * Math.sin(d) * Math.cos(a),
    forward * Math.cos(d) * Math.sin(a) + east * Math.cos(a) - north * Math.sin(d) * Math.sin(a),
    forward * Math.sin(d) + north * Math.cos(d)];
  const length = Math.hypot(...ray);
  return ray.map(value => value / length) as Vec3;
}

/** Project the sky ray onto the observation tangent plane, then express it in the density's local frame. */
export function rayToOverlayPlane(ray: Vec3, frame: OverlayFrame): Vec3 {
  const distance = Math.hypot(...frame.originM), normal = frame.originM.map(n => n / distance);
  const denominator = dot(ray, normal);
  if (!(distance > 0 && denominator > 0 && frame.metersPerUnit > 0)) throw new TypeError('Image footprint does not face the observer.');
  const p = ray.map((value, i) => (value * distance / denominator - frame.originM[i]!) / frame.metersPerUnit);
  const [qx, qy, qz, qw] = frame.localToReferenceXyzw as [number, number, number, number];
  const x = -qx, y = -qy, z = -qz;
  const tx = 2 * (y * p[2]! - z * p[1]!), ty = 2 * (z * p[0]! - x * p[2]!), tz = 2 * (x * p[1]! - y * p[0]!);
  return [p[0]! + qw * tx + y * tz - z * ty, p[1]! + qw * ty + z * tx - x * tz,
    p[2]! + qw * tz + x * ty - y * tx];
}

export function overlayCorners(wcs: ImageWcs, frame: OverlayFrame): [Vec3, Vec3, Vec3, Vec3] {
  validateImageWcs(wcs);
  const [width, height] = wcs.referenceDimension;
  // Full raster edges, not a cropped feature extent. Downsampled textures retain these same edges.
  return [[.5, height + .5], [width + .5, height + .5], [width + .5, .5], [.5, .5]]
    .map(([x, y]) => rayToOverlayPlane(wcsPixelRay(wcs, x!, y!), frame)) as [Vec3, Vec3, Vec3, Vec3];
}
