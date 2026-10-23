/**
 * The outer ejecta's two further source records, for the renderer:
 *
 *   source/kinematics.json - each knot (./knots.mts) at its place (arcsec east, north, and depth away from Earth) with
 *                            its velocity in km/s at 2.3 kpc: across the sky the measured proper motion of its Hubble tile
 *                            (./hubble-motions.mts; not assumed radial), along the line of sight its MUSE speed; its
 *                            ejection year (rho / mu) and how many peaks its spectrum had.
 *   source/tube.json       - the fitted wall of Mehner et al. (2016)'s bent tube (./tube.mts): its centreline from -45
 *                            to 45 arcsec along the axis (every half arcsec) with the wall's radius there, and the fitted
 *                            parameters.
 *
 * Numbers are rounded as NumPy rounds them (`npRound`), the way the first version of these records was written.
 */
import { npRound } from './cloud-points.mts';
import { DISTANCE_PC, KMS_PER_ARCSEC_YEAR_PC, tileOf } from './knots.mts';
import { pyInt, type PyJson } from './python-ports/python-json.mts';
import { centreline, radius, SAMPLES } from './tube.mts';

/** The kinematics record (cssearth-kinematics-source@1). Each knot's tile is found among the motion rows by its place. */
export function kinematicsRecord(fit: readonly ArrayLike<number>[], knots: readonly ArrayLike<number>[], generator: string): PyJson {
  const tiles = fit.map(tileOf), kmps = KMS_PER_ARCSEC_YEAR_PC * DISTANCE_PC;
  return { schema: 'cssearth-kinematics-source@1', generator, units: 'arcsec east, north, depth (away from Earth) from the star; velocities km/s at 2.3 kpc',
    knots: knots.map(row => {
      let best = 0, distance = Infinity; for (const [i, tile] of tiles.entries()) { const d = Math.hypot(tile.east - row[0]!, tile.north - row[1]!); if (d < distance) { distance = d; best = i; } }
      if (!(distance < 1e-6)) throw new RangeError(`No motion tile at the knot ${row[0]}, ${row[1]}.`);
      const tile = tiles[best]!;
      return { east: npRound(row[0]!, 3), north: npRound(row[1]!, 3), depth: npRound(row[2]!, 3), vEast: npRound(tile.muEast * kmps, 1), vNorth: npRound(tile.muNorth * kmps, 1),
        vLos: npRound(row[3]!, 1), year: npRound(row[5]!, 1), peaks: pyInt(Math.trunc(row[6]!)) };
    }) };
}

/** The tube record (cssearth-tube-source@1) from the fitted parameters (tube.npy) and the points it was fitted to
 * (`tubePoints`' X): `traced` holds those within 3 arcsec of the wall, rounded to whole arcsec, one per cubic arcsec
 * (sorted as numpy.unique sorts rows). */
export function tubeRecord(q: ArrayLike<number>, X: Float64Array, generator: string): PyJson {
  const rad = Math.PI / 180, C = centreline(q), keep = [...SAMPLES.keys()].filter(i => SAMPLES[i]! >= -45 && SAMPLES[i]! <= 45), traced = new Map<string, number[]>();
  for (let i = 0; i < X.length / 3; i++) {
    const x = X[3 * i]!, y = X[3 * i + 1]!, z = X[3 * i + 2]!; let best = Infinity, at = 0;
    for (let k = 0; k < C.length; k++) { const c = C[k]!, dx = x - c[0], dy = y - c[1], dz = z - c[2], d = Math.sqrt(dx * dx + dy * dy + dz * dz); if (d < best) { best = d; at = k; } }
    if (Math.abs(best - radius(q, SAMPLES[at]!)) < 3) { const cell = [x, y, z].map(value => npRound(value, 0)); traced.set(cell.join(), cell); }
  }
  const cells = [...traced.values()].sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]! || a[2]! - b[2]!);
  return { schema: 'cssearth-tube-source@1', generator, units: 'arcsec east, north, depth (away from Earth) from the star; radius in arcsec',
    source: 'Mehner et al. (2016), A&A 595, A120: the outer ejecta as a bent tube (their SHAPE model); refitted here to MUSE H-beta of the 1840s material',
    centreline: keep.map(i => C[i]!.map(value => npRound(value, 3))), radius: keep.map(i => npRound(radius(q, SAMPLES[i]!), 3)),
    traced: cells.map(cell => cell.map(value => pyInt(value))),
    parameters: { paDeg: npRound(q[0]! / rad, 2), tiltDeg: npRound(q[1]! / rad, 2), bend: npRound(q[2]!, 3), bendDirDeg: npRound(q[3]! / rad, 1),
      centre: [q[4]!, q[5]!, q[6]!].map(value => npRound(value, 3)), radiusNear: npRound(q[7]!, 3), radiusFar: npRound(q[8]!, 3) } };
}
