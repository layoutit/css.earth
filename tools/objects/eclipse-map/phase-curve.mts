/** The planet-to-star flux a longitude-latitude emission map produces over an orbit, from the package's own orbit and rotation:
 * the hosted orbit places the planet, the synchronous rotation turns the map, and the host star hides what passes behind it.
 * It is a check on geometry, not a retrieval: comparing the result with a published light curve shows whether the map, the
 * orbit and the rotation agree, and whether east and west are the right way round. */
import { bodyFixedToIcrf, hostSkyFrame, hostedOrbitStateRelativeBmjdTdb, type HostedOrbit } from '@cssearth/astronomy';
import { synchronousRotationElements } from '../authored-rotation.mts';

export interface EmissionGrid { readonly width: number; readonly height: number; readonly values: Float64Array; readonly latitudes: Float64Array; readonly longitudes: Float64Array }

/** Mirror a grid in longitude (east becomes west) or latitude (north becomes south), keeping its pixel-centre coordinates. */
export function mirrorGrid(grid: EmissionGrid, axis: 'longitude' | 'latitude'): EmissionGrid {
  const values = new Float64Array(grid.values.length);
  for (let row = 0; row < grid.height; row++) for (let column = 0; column < grid.width; column++) {
    const from = axis === 'longitude' ? row * grid.width + (grid.width - 1 - column) : (grid.height - 1 - row) * grid.width + column;
    values[row * grid.width + column] = grid.values[from]!;
  }
  return { ...grid, values };
}

/** Relative planet flux at each time (BMJD_TDB): the map summed over the visible, unocculted hemisphere, weighted by the
 * projected area of each cell. Stellar and planetary radii are in units of the star's radius. */
export function mapPhaseCurve(grid: EmissionGrid, orbit: HostedOrbit, host: { rightAscensionDegrees: number; declinationDegrees: number }, planetRadiusStellarRadii: number, timesBmjd: ArrayLike<number>) {
  return mapBasisCurves([grid.values], grid, orbit, host, planetRadiusStellarRadii, timesBmjd)[0]!;
}

/** Light-travel time across the orbit: with `stellarRadiusKm`, the planet is placed where it was when the light seen at each time
 * left it. Times stay referenced to the observed transit, as a transit fit reports them (Eureka!'s batman convention): the planet's
 * light at transit needs no correction, and at eclipse it left 2a sin(i)/c earlier, so eclipses are seen that much later than a
 * geometry without light time predicts (15 s for WASP-43b, 31 s for HD 189733b). The star's own reflex motion is ignored. */
export interface LightTravel { readonly stellarRadiusKm?: number }
const LIGHT_KM_PER_DAY = 299792.458 * 86400;

/** The light curve of each basis map over the same cells, in one geometry pass per time: rows [basis][time]. A cell's weight
 * (projected area, zero when turned away or behind the star) is shared by every basis map, so a degree-5 harmonic basis
 * costs one pass, not thirty-five. `visible` (optional) receives 1 for every cell that faces the observer at any time. */
export function mapBasisCurves(basis: readonly ArrayLike<number>[], grid: Pick<EmissionGrid, 'width' | 'height' | 'latitudes' | 'longitudes'>, orbit: HostedOrbit,
  host: { rightAscensionDegrees: number; declinationDegrees: number }, planetRadiusStellarRadii: number, timesBmjd: ArrayLike<number>, visible?: Uint8Array,
  { stellarRadiusKm }: LightTravel = {}) {
  if (orbit.eccentricity !== 0) throw new TypeError('An eccentric emission map needs an explicit rotation model; instantaneous star-facing orientation is not synchronous spin.');
  const { x, y, z } = hostSkyFrame(host, orbit.ascendingNodePositionAngleDegrees), cells = grid.width * grid.height;
  if (basis.some(values => values.length !== cells) || (visible && visible.length !== cells)) throw new RangeError('Every basis map must cover the grid.');
  const cellLatitude = Math.PI / grid.height, cellLongitude = 2 * Math.PI / grid.width, normals = new Float64Array(cells * 3), area = new Float64Array(cells);
  for (let i = 0; i < cells; i++) {
    const lat = grid.latitudes[i]! * Math.PI / 180, lon = grid.longitudes[i]! * Math.PI / 180;
    normals.set([Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)], i * 3);
    area[i] = Math.cos(lat) * cellLatitude * cellLongitude;
  }
  const curves = basis.map(() => new Float64Array(timesBmjd.length)), sums = new Float64Array(basis.length);
  const atTransit = hostedOrbitStateRelativeBmjdTdb(orbit, host, 1, orbit.transitTimeBmjdTdb).positionKm;
  const transitTowardObserver = atTransit[0] * z[0] + atTransit[1] * z[1] + atTransit[2] * z[2];
  for (let t = 0; t < timesBmjd.length; t++) {
    // Unit stellar radius: positions come back in the same units as the radius passed in.
    let state = hostedOrbitStateRelativeBmjdTdb(orbit, host, 1, timesBmjd[t]!);
    if (stellarRadiusKm !== undefined) {
      // Emission time: later when the planet is nearer the observer than at transit, earlier when farther (first order in v/c).
      const towardObserver = state.positionKm[0] * z[0] + state.positionKm[1] * z[1] + state.positionKm[2] * z[2];
      const delayDays = (towardObserver - transitTowardObserver) * stellarRadiusKm / LIGHT_KM_PER_DAY;
      state = hostedOrbitStateRelativeBmjdTdb(orbit, host, 1, timesBmjd[t]! + delayDays);
    }
    const m = bodyFixedToIcrf(synchronousRotationElements(state.positionKm, state.velocityKmPerDay, orbit.periodDays));
    const r = state.positionKm, behind = r[0] * z[0] + r[1] * z[1] + r[2] * z[2] < 0;
    sums.fill(0);
    for (let i = 0; i < cells; i++) {
      const bx = normals[i * 3]!, by = normals[i * 3 + 1]!, bz = normals[i * 3 + 2]!;
      const nx = m[0]! * bx + m[1]! * by + m[2]! * bz, ny = m[3]! * bx + m[4]! * by + m[5]! * bz, nz = m[6]! * bx + m[7]! * by + m[8]! * bz;
      const mu = nx * z[0] + ny * z[1] + nz * z[2];
      if (mu <= 0) continue;
      if (visible) visible[i] = 1;
      if (behind) {
        const px = r[0] + planetRadiusStellarRadii * nx, py = r[1] + planetRadiusStellarRadii * ny, pz = r[2] + planetRadiusStellarRadii * nz;
        const sx = px * x[0] + py * x[1] + pz * x[2], sy = px * y[0] + py * y[1] + pz * y[2];
        if (sx * sx + sy * sy < 1) continue;
      }
      const weight = mu * area[i]!;
      for (let k = 0; k < basis.length; k++) sums[k] += basis[k]![i]! * weight;
    }
    for (let k = 0; k < basis.length; k++) curves[k]![t] = sums[k]!;
  }
  return curves;
}

/** Weighted least squares of data = scale * model + offset over the selected samples, with the reduced chi-squared. */
export function fitScaleAndOffset(model: ArrayLike<number>, data: ArrayLike<number>, errors: ArrayLike<number>, use: (index: number) => boolean) {
  let sw = 0, sx = 0, sy = 0, sxx = 0, sxy = 0, n = 0;
  for (let i = 0; i < data.length; i++) {
    if (!use(i)) continue;
    const w = 1 / errors[i]! ** 2;
    sw += w; sx += w * model[i]!; sy += w * data[i]!; sxx += w * model[i]! ** 2; sxy += w * model[i]! * data[i]!; n++;
  }
  const scale = (sw * sxy - sx * sy) / (sw * sxx - sx * sx), offset = (sy - scale * sx) / sw;
  let chi2 = 0;
  for (let i = 0; i < data.length; i++) if (use(i)) chi2 += ((data[i]! - scale * model[i]! - offset) / errors[i]!) ** 2;
  return { scale, offset, reducedChiSquared: chi2 / (n - 2), samples: n };
}
