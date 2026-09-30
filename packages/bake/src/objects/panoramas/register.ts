/** Turn a panorama without a published projection: azimuths of tie points (the Sun, the photographer's shadow opposite it,
 * hardware mapped from orbit) against the columns they sit at give the image's scale and its left edge's azimuth. Pure. */

export interface SurfacePoint { readonly latitudeDeg: number; readonly longitudeDegEast: number }

const RAD = Math.PI / 180;

/** Bearing (clockwise from north) and distance from one point to a nearby one, on the plane tangent at `from`. */
export function localBearing(from: SurfacePoint, to: SurfacePoint, radiusM: number): { readonly azimuthDeg: number; readonly distanceM: number } {
  let dLongitude = to.longitudeDegEast - from.longitudeDegEast;
  dLongitude -= 360 * Math.round(dLongitude / 360);
  const east = dLongitude * RAD * Math.cos(from.latitudeDeg * RAD) * radiusM, north = (to.latitudeDeg - from.latitudeDeg) * RAD * radiusM;
  return { azimuthDeg: ((Math.atan2(east, north) / RAD) + 360) % 360, distanceM: Math.hypot(east, north) };
}

/** The Sun's azimuth (clockwise from north) and elevation seen from a surface point, given the sub-solar point. */
export function sunDirection(at: SurfacePoint, subsolar: SurfacePoint): { readonly azimuthDeg: number; readonly elevationDeg: number } {
  const p1 = at.latitudeDeg * RAD, p2 = subsolar.latitudeDeg * RAD, dl = (subsolar.longitudeDegEast - at.longitudeDegEast) * RAD;
  const azimuth = Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl));
  const cosine = Math.sin(p1) * Math.sin(p2) + Math.cos(p1) * Math.cos(p2) * Math.cos(dl);
  return { azimuthDeg: ((azimuth / RAD) + 360) % 360, elevationDeg: 90 - Math.acos(Math.max(-1, Math.min(1, cosine))) / RAD };
}

export interface TieAzimuth {
  readonly label: string;
  readonly column: number;
  readonly azimuthDeg: number;
  /** A direction at infinity (the Sun, or its anti-point): independent of where the photographer stood. */
  readonly celestial: boolean;
  /** The most it may miss its fitted column, from the published error of the standpoint and hardware positions; a tie
   * beyond it was read against the wrong object. Absent where no error is published. */
  readonly toleranceDeg?: number;
}

export interface TieFit {
  readonly pxPerDeg: number;
  readonly azimuthAtLeftDeg: number;
  /** Which ties set the fit: the celestial ones when there are two, else all of them. */
  readonly fittedBy: readonly string[];
  /** Each tie's miss, in degrees, positive when it sits right of the fitted column. */
  readonly residualsDeg: readonly { readonly label: string; readonly deg: number }[];
}

/**
 * Least squares of column against clockwise azimuth. Two celestial ties fix the scale on their own, and hardware then
 * checks the standpoint; with fewer, hardware joins the fit. Azimuths unwrap clockwise from the leftmost tie.
 */
export function fitTieAzimuths(ties: readonly TieAzimuth[], label: string): TieFit {
  const sorted = [...ties].sort((a, b) => a.column - b.column);
  const celestial = sorted.filter(tie => tie.celestial), fitting = celestial.length >= 2 ? celestial : sorted;
  if (fitting.length < 2) throw new TypeError(`${label}: at least two tie points are needed to turn a panorama.`);
  const base = sorted[0]!.azimuthDeg, unwrap = (tie: TieAzimuth) => ((tie.azimuthDeg - base) % 360 + 360) % 360;
  const xs = fitting.map(unwrap), ys = fitting.map(tie => tie.column), n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i]! - mx) * (ys[i]! - my); sxx += (xs[i]! - mx) ** 2; }
  const pxPerDeg = sxy / sxx, intercept = my - pxPerDeg * mx;
  if (!(pxPerDeg > 0)) throw new TypeError(`${label}: the ties do not run clockwise from left to right.`);
  const residualsDeg = sorted.map(tie => ({ label: tie.label, deg: (tie.column - (intercept + pxPerDeg * unwrap(tie))) / pxPerDeg }));
  sorted.forEach((tie, index) => {
    const miss = residualsDeg[index]!.deg;
    if (tie.toleranceDeg !== undefined && Math.abs(miss) > tie.toleranceDeg) throw new TypeError(`${label}: tie ${tie.label} misses its fitted column by ${miss.toFixed(1)}°, more than the ${tie.toleranceDeg.toFixed(1)}° its positions allow.`);
  });
  return { pxPerDeg, azimuthAtLeftDeg: ((base - intercept / pxPerDeg) % 360 + 360) % 360, fittedBy: fitting.map(tie => tie.label), residualsDeg };
}
