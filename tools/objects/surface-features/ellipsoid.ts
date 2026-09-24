import { surfaceDirection } from './geometry.js';
import type { SurfaceFeatureAxes } from './catalog.js';
import { dot3 as dot } from '../../../src/platform/vector3.mts';

/** Ellipsoid anchoring for the shared feature preparation. Catalogue positions are geodetic (positive-east
 * longitude, geodetic latitude on the reference ellipsoid); the prepared anchor is the point where the
 * rendered surface shows that position, and the plan records the reference semi-axes plus the normalised
 * radius band (1 = on the ellipsoid) that every prepared point occupies, so the runtime parser can check
 * `onBody` without knowing how the lane renders its surface. */
type Vector3 = readonly [number, number, number];
export interface EllipsoidSemiAxesUnits { readonly equatorial: number; readonly polar: number }
export interface SurfaceEllipsoidPlan extends EllipsoidSemiAxesUnits {
  /** The polar (rotation) axis in mesh coordinates: the surface map's north axis. */
  readonly north: Vector3;
  /** Normalised radius band of every prepared anchor and outline point, 1 = on the reference ellipsoid. */
  readonly minimumShare: number; readonly maximumShare: number;
}
/** Resolves geodetic catalogue positions on the body. `point` is the rendered surface position in mesh units,
 * `normal` the geodetic surface normal (label facing and flight direction), `plan` the facts for the runtime. */
export interface SurfaceSampler {
  point(longitudeDeg: number, latitudeDeg: number): Vector3;
  normal(longitudeDeg: number, latitudeDeg: number): Vector3;
  plan(): SurfaceEllipsoidPlan;
}
/** Tolerances a lane's rendered surface may differ from the reference ellipsoid by before the frame is presumed wrong. */
export interface RenderedSurfaceLimits { readonly minimumShare: number; readonly maximumShare: number; readonly longitudeDeg: number; readonly latitudeDeg: number }
/** The 16-band flat-leaf globe keeps longitude exact but places latitude inside each band by its leaf homography, not
 * linearly: measured against the reference ellipsoid on the prepared Earth scene (2.5° × 5° grid, output/earth-features
 * grid probe), anchors sit 0.981–1.014 of the ellipsoid radius from the centre (the flat polar caps lowest, cap aprons
 * highest), within 0.007° of their longitude and within 2.13° of their geocentric latitude (worst on the cap apron;
 * 0.9° at Reykjavik). Anything beyond these limits means the surface map axes or edge disagree with the lane. */
export const PAGED_ELLIPSOID_LIMITS: RenderedSurfaceLimits = Object.freeze({ minimumShare: 0.95, maximumShare: 1.05, longitudeDeg: 0.05, latitudeDeg: 3 });

const finite = (value: unknown, at: string): number => { if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${at} must be a finite number.`); return value; };

export function parseEllipsoidSemiAxes(value: { readonly equatorial: unknown; readonly polar: unknown }): EllipsoidSemiAxesUnits {
  const equatorial = finite(value.equatorial, 'ellipsoid equatorial semi-axis'), polar = finite(value.polar, 'ellipsoid polar semi-axis');
  if (!(equatorial > 0) || !(polar > 0) || polar > equatorial) throw new TypeError('Ellipsoid semi-axes must satisfy a >= c > 0.');
  return Object.freeze({ equatorial, polar });
}

/** Geodetic position to the reference ellipsoid surface in mesh units: N cos φ along the map's parallel direction
 * and N (1 − e²) sin φ along the polar axis, where N is the prime vertical radius. The map direction of a geodetic
 * position is its geodetic normal, so the same direction serves as the anchor's normal. */
export function ellipsoidSurfacePoint(longitudeDeg: number, latitudeDeg: number, axes: SurfaceFeatureAxes, mapLeftEdgeLongitudeDeg: number, { equatorial, polar }: EllipsoidSemiAxesUnits): Vector3 {
  const normal = surfaceDirection(longitudeDeg, latitudeDeg, axes, mapLeftEdgeLongitudeDeg);
  const phi = latitudeDeg * Math.PI / 180, sinPhi = Math.sin(phi), cosPhi = Math.cos(phi);
  const e2 = 1 - (polar * polar) / (equatorial * equatorial), prime = equatorial / Math.sqrt(1 - e2 * sinPhi * sinPhi);
  // The normal's component along the parallel is cos φ · (prime cos λ + east sin λ); scale it to N and the polar part to N(1 − e²).
  const horizontal = [normal[0] - axes.north[0] * sinPhi, normal[1] - axes.north[1] * sinPhi, normal[2] - axes.north[2] * sinPhi] as const;
  const across = cosPhi > 1e-12 ? prime : 0, up = prime * (1 - e2) * sinPhi;
  return [horizontal[0] * across + axes.north[0] * up, horizontal[1] * across + axes.north[1] * up, horizontal[2] * across + axes.north[2] * up];
}

/** Normalised radius of a mesh point on the ellipsoid whose polar axis is `north`: 1 on the surface, < 1 inside. */
export function normalizedEllipsoidRadius(point: Vector3, { equatorial, polar }: EllipsoidSemiAxesUnits, north: Vector3): number {
  const up = dot(point, north), across = Math.max(0, dot(point, point) - up * up);
  return Math.sqrt(across / (equatorial * equatorial) + (up * up) / (polar * polar));
}

/** Geocentric latitude and positive-east longitude of a mesh point in the surface map frame, degrees. */
export function surfaceCoordinates(point: Vector3, axes: SurfaceFeatureAxes, mapLeftEdgeLongitudeDeg: number): { longitudeDeg: number; latitudeDeg: number } {
  const length = Math.hypot(...point);
  const latitudeDeg = Math.asin(Math.max(-1, Math.min(1, dot(point, axes.north) / length))) * 180 / Math.PI;
  const longitudeDeg = (((Math.atan2(dot(point, axes.east), dot(point, axes.prime)) * 180 / Math.PI + mapLeftEdgeLongitudeDeg) % 360) + 360) % 360;
  return { longitudeDeg, latitudeDeg };
}

const round = (value: number, digits: number) => Number(value.toFixed(digits));
function bandTracker(semiAxes: EllipsoidSemiAxesUnits, axes: SurfaceFeatureAxes) {
  let minimum = Number.POSITIVE_INFINITY, maximum = Number.NEGATIVE_INFINITY;
  return {
    record(point: Vector3): number {
      const share = normalizedEllipsoidRadius(point, semiAxes, axes.north);
      minimum = Math.min(minimum, share); maximum = Math.max(maximum, share);
      return share;
    },
    plan(): SurfaceEllipsoidPlan {
      const sampled = minimum <= maximum;
      return Object.freeze({ ...semiAxes, north: axes.north,
        minimumShare: sampled ? round(Math.min(1, minimum), 6) : 1, maximumShare: sampled ? round(Math.max(1, maximum), 6) : 1 });
    },
  };
}

/** Anchors on the mathematical ellipsoid: bodies whose rendered surface is the reference ellipsoid itself. */
export function ellipsoidSampler(axes: SurfaceFeatureAxes, mapLeftEdgeLongitudeDeg: number, semiAxes: EllipsoidSemiAxesUnits): SurfaceSampler {
  const band = bandTracker(semiAxes, axes);
  return Object.freeze({
    point(longitudeDeg: number, latitudeDeg: number) { const point = ellipsoidSurfacePoint(longitudeDeg, latitudeDeg, axes, mapLeftEdgeLongitudeDeg, semiAxes); band.record(point); return point; },
    normal: (longitudeDeg: number, latitudeDeg: number) => surfaceDirection(longitudeDeg, latitudeDeg, axes, mapLeftEdgeLongitudeDeg),
    plan: band.plan,
  });
}

/** Anchors on a lane's rendered surface. A flat-leaf globe draws each geodetic position where its leaf homography
 * puts it, not on the mathematical ellipsoid (about a hundred kilometres apart at 64° on Earth), so the lane
 * supplies its own position mapping and every returned point is checked against the reference ellipsoid:
 * same longitude, a bounded latitude shift, and a normalised radius inside the declared limits. */
export function renderedEllipsoidSampler(axes: SurfaceFeatureAxes, mapLeftEdgeLongitudeDeg: number, semiAxes: EllipsoidSemiAxesUnits,
  rendered: (longitudeDeg: number, latitudeDeg: number) => Vector3, limits: RenderedSurfaceLimits = PAGED_ELLIPSOID_LIMITS): SurfaceSampler {
  const band = bandTracker(semiAxes, axes);
  return Object.freeze({
    point(longitudeDeg: number, latitudeDeg: number) {
      const point = rendered(longitudeDeg, latitudeDeg);
      if (point.length !== 3 || point.some(value => !Number.isFinite(value))) throw new TypeError(`Rendered surface point is not finite at ${longitudeDeg}, ${latitudeDeg}.`);
      const share = band.record(point);
      const at = `${longitudeDeg}°E ${latitudeDeg}°`;
      if (share < limits.minimumShare || share > limits.maximumShare) throw new TypeError(`Rendered surface point at ${at} lies ${share.toFixed(4)} of the ellipsoid radius from the centre.`);
      const reference = surfaceCoordinates(ellipsoidSurfacePoint(longitudeDeg, latitudeDeg, axes, mapLeftEdgeLongitudeDeg, semiAxes), axes, mapLeftEdgeLongitudeDeg);
      const actual = surfaceCoordinates(point, axes, mapLeftEdgeLongitudeDeg);
      const longitudeError = Math.abs((((actual.longitudeDeg - reference.longitudeDeg) % 360) + 540) % 360 - 180) * Math.cos(latitudeDeg * Math.PI / 180);
      if (longitudeError > limits.longitudeDeg) throw new TypeError(`Rendered surface point at ${at} sits at a different longitude (${actual.longitudeDeg.toFixed(3)}°); the surface map axes or edge disagree with the lane.`);
      if (Math.abs(actual.latitudeDeg - reference.latitudeDeg) > limits.latitudeDeg) throw new TypeError(`Rendered surface point at ${at} sits ${(actual.latitudeDeg - reference.latitudeDeg).toFixed(2)}° off its geodetic latitude.`);
      return point;
    },
    normal: (longitudeDeg: number, latitudeDeg: number) => surfaceDirection(longitudeDeg, latitudeDeg, axes, mapLeftEdgeLongitudeDeg),
    plan: band.plan,
  });
}

/** The shape the shared preparation casts through: a map direction (the geodetic normal) resolves to its rendered
 * surface point, rounded like every other prepared mesh coordinate, and the plan carries the ellipsoid facts. */
export function ellipsoidSurfaceCast(sampler: SurfaceSampler, axes: SurfaceFeatureAxes, mapLeftEdgeLongitudeDeg: number): { onSurface(direction: Vector3): Vector3; plan(): SurfaceEllipsoidPlan } {
  return Object.freeze({
    onSurface(direction: Vector3): Vector3 {
      // A map direction is the geodetic normal of exactly one position: its geocentric latitude is the geodetic latitude that made it.
      const { longitudeDeg, latitudeDeg } = surfaceCoordinates(direction, axes, mapLeftEdgeLongitudeDeg);
      const point = sampler.point(longitudeDeg, latitudeDeg);
      return [round(point[0], 3), round(point[1], 3), round(point[2], 3)];
    },
    plan: () => sampler.plan(),
  });
}
