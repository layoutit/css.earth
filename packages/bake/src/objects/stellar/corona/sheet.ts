// A corona density from a star's surface magnetic map and three numbers of the star: its X-ray output, its coronal
// temperature and its mass loss. The map places the gas; the numbers set how much there is.
//
// The potential field of the map (potential-field.ts) reverses along one line on its source surface, the neutral line. On the
// Sun the dense streamer belt follows that line (Wang, Sheeley & Rich 2007, ApJ 658, 1340), and the published simulation of
// ε Eridani's corona is densest along it too. The density here is two levels joined by the angle δ from that line:
//   on the sheet:   gas at rest (models.ts hydrostaticCorona) inside the source surface; beyond it the same gas, falling
//                   as r^-`decayPower` relative to the wind
//   off the sheet:  the wind (models.ts parkerWind), which leaves only through the open share of each sphere
//                   (potential-field.ts openShare), so it is that much denser there than a wind from the whole surface
//   density = off + (on - off) exp(-(δ/σ(r))²)
// What this was measured against, and how far it holds, is in docs/stellar-corona-from-magnetic-maps.md.
import { potentialField, type FieldHarmonics } from './potential-field.ts';

export const SHEET_CORONA = Object.freeze({
  /** Where the wind is taken to drag the field radial: the value potential-field models of the Sun use. */
  sourceRadii: 2.5,
  /** σ narrows from `nearWidthDegrees` at `nearRadii` to `farWidthDegrees` from `farRadii` outward. */
  nearRadii: 1.2, nearWidthDegrees: 15, farRadii: 2, farWidthDegrees: 8, decayPower: 3,
});

/** The neutral line of a map's potential field on its source surface, and the angle of any direction from it. Directions are
 * colatitude θ and east longitude φ in the map's own frame, in radians. */
export function neutralLine(harmonics: FieldHarmonics, sourceRadii: number = SHEET_CORONA.sourceRadii) {
  const NW = 360, NH = 180, sign = new Int8Array(NW * NH), direction = (row: number, column: number) => {
    const theta = (row + 0.5) * Math.PI / NH, phi = (column + 0.5) * 2 * Math.PI / NW;
    return [theta, phi, Math.sin(theta) * Math.cos(phi), Math.sin(theta) * Math.sin(phi), Math.cos(theta)] as const;
  };
  for (let row = 0; row < NH; row++) for (let column = 0; column < NW; column++) {
    const [theta, phi] = direction(row, column);
    sign[row * NW + column] = potentialField(harmonics, sourceRadii, sourceRadii, theta, phi)[0] >= 0 ? 1 : -1;
  }
  const cells: (readonly [number, number, number])[] = [];
  for (let row = 0; row < NH; row++) for (let column = 0; column < NW; column++) {
    const here = sign[row * NW + column]!, east = sign[row * NW + (column + 1) % NW]!, south = row + 1 < NH ? sign[(row + 1) * NW + column]! : here;
    if (here !== east || here !== south) { const [, , x, y, z] = direction(row, column); cells.push([x, y, z]); }
  }
  if (!cells.length) throw new RangeError('The field has one sign over the whole source surface: the map has no neutral line.');
  // Angles on a 1° grid, read back with bilinear interpolation.
  const table = new Float32Array(NW * NH);
  for (let row = 0; row < NH; row++) for (let column = 0; column < NW; column++) {
    const [, , x, y, z] = direction(row, column);
    let best = -1; for (const cell of cells) { const dot = x * cell[0] + y * cell[1] + z * cell[2]; if (dot > best) best = dot; }
    table[row * NW + column] = Math.acos(Math.min(1, best)) * 180 / Math.PI;
  }
  const distanceDegrees = (theta: number, phi: number) => {
    const fr = Math.max(0, Math.min(NH - 1, theta / Math.PI * NH - 0.5)), fc = ((phi / (2 * Math.PI) * NW - 0.5) % NW + NW) % NW;
    const r0 = Math.floor(fr), r1 = Math.min(NH - 1, r0 + 1), c0 = Math.floor(fc) % NW, c1 = (c0 + 1) % NW, tr = fr - r0, tc = fc - Math.floor(fc);
    return (table[r0 * NW + c0]! * (1 - tc) + table[r0 * NW + c1]! * tc) * (1 - tr) + (table[r1 * NW + c0]! * (1 - tc) + table[r1 * NW + c1]! * tc) * tr;
  };
  /** The share of the sky within `degrees` of the line: 1 for a line that leaves no direction farther than that. */
  const shareWithin = (degrees: number) => { let inside = 0, all = 0;
    for (let row = 0; row < NH; row++) { const weight = Math.sin((row + 0.5) * Math.PI / NH); for (let column = 0; column < NW; column++) { all += weight; if (table[row * NW + column]! <= degrees) inside += weight; } }
    return inside / all; };
  return { cells: cells.length, distanceDegrees, shareWithin };
}

/** The density (electrons per cm³) at a radius and direction, with the two levels it lies between at a radius: `offSheet`,
 * the density away from the sheet, and `onSheet`, the density on the reversal line, which is the densest gas of that radius. `atRest` and `wind` are densities by radius in stellar radii; `wind` is the wind
 * of the whole surface, and `openShare` the share of each sphere it leaves through. */
export function sheetCoronaDensity(input: { neutralDistanceDegrees: (theta: number, phi: number) => number; atRest: (radii: number) => number; wind: (radii: number) => number; openShare: (radii: number) => number }) {
  const { sourceRadii: source, nearRadii, nearWidthDegrees, farRadii, farWidthDegrees, decayPower } = SHEET_CORONA;
  const offSheet = (radii: number) => input.wind(radii) / input.openShare(radii), cusp = input.atRest(source) / offSheet(source);
  const onSheet = (radii: number) => { const open = offSheet(radii); return radii <= source ? Math.max(open, input.atRest(radii)) : open * (1 + (cusp - 1) * (source / radii) ** decayPower); };
  const density = (radii: number, theta: number, phi: number) => {
    const t = Math.max(0, Math.min(1, (radii - nearRadii) / (farRadii - nearRadii))), width = nearWidthDegrees + (farWidthDegrees - nearWidthDegrees) * t;
    const share = Math.exp(-((input.neutralDistanceDegrees(theta, phi) / width) ** 2)), open = offSheet(radii);
    return open + (onSheet(radii) - open) * share;
  };
  return { density, offSheet, onSheet };
}
