/** Real spherical harmonics on the planet's body-fixed sphere, normalized so that the mean of Y_lm² over the sphere is 1
 * (∫ Y_lm² dΩ = 4π, Y_00 = 1), the convention starry uses. Latitude is measured from the equator and longitude from the
 * substellar meridian eastward, the synchronous-rotation frame of `authored-rotation.mts`. The sign convention (no
 * Condon-Shortley phase) does not change a fitted map: an eigen-decomposition absorbs any sign. */

/** The (l, m) order of a degree-lmax basis without Y_00: l = 1..lmax, m = -l..l. */
export function harmonicOrder(lmax: number): readonly (readonly [number, number])[] {
  if (!Number.isInteger(lmax) || lmax < 1 || lmax > 12) throw new RangeError('lmax must be an integer from 1 to 12.');
  const order: [number, number][] = [];
  for (let l = 1; l <= lmax; l++) for (let m = -l; m <= l; m++) order.push([l, m]);
  return order;
}

function factorialRatio(l: number, m: number) {
  // (l - m)! / (l + m)! for m >= 0.
  let ratio = 1;
  for (let k = l - m + 1; k <= l + m; k++) ratio /= k;
  return ratio;
}

/** Y_lm at each (latitude, longitude) in degrees, as rows [harmonic][point] in `harmonicOrder(lmax)`. */
export function realSphericalHarmonics(lmax: number, latitudesDegrees: ArrayLike<number>, longitudesDegrees: ArrayLike<number>): Float64Array[] {
  const order = harmonicOrder(lmax), points = latitudesDegrees.length;
  if (longitudesDegrees.length !== points) throw new RangeError('Latitudes and longitudes must pair up.');
  const rows = order.map(() => new Float64Array(points));
  // Associated Legendre P_l^m(x) without the Condon-Shortley phase, by the standard upward recurrences.
  const legendre = Array.from({ length: lmax + 1 }, () => new Float64Array(lmax + 1));
  for (let p = 0; p < points; p++) {
    const lat = latitudesDegrees[p]! * Math.PI / 180, lon = longitudesDegrees[p]! * Math.PI / 180;
    const x = Math.sin(lat), s = Math.cos(lat);
    legendre[0]![0] = 1;
    for (let m = 1; m <= lmax; m++) legendre[m]![m] = legendre[m - 1]![m - 1]! * (2 * m - 1) * s;
    for (let m = 0; m < lmax; m++) legendre[m + 1]![m] = x * (2 * m + 1) * legendre[m]![m]!;
    for (let m = 0; m <= lmax; m++) for (let l = m + 2; l <= lmax; l++) {
      legendre[l]![m] = ((2 * l - 1) * x * legendre[l - 1]![m]! - (l + m - 1) * legendre[l - 2]![m]!) / (l - m);
    }
    order.forEach(([l, m], index) => {
      const am = Math.abs(m);
      const norm = Math.sqrt((2 * l + 1) * (am === 0 ? 1 : 2) * factorialRatio(l, am));
      rows[index]![p] = norm * legendre[l]![am]! * (m === 0 ? 1 : m > 0 ? Math.cos(am * lon) : Math.sin(am * lon));
    });
  }
  return rows;
}
