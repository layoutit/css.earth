/**
 * The red gas and dark dust around the Homunculus as dots (the original study's gas_from_images.py and
 * export_cloud_source.py), and the lobes' occluder.
 *
 *   where   - every measured knot (./knots.mts) within 45 arcsec of the star's plane of the sky. A sky cell takes its
 *             dots' depths from its six nearest knots as the Earth view places them: one knot's depth (with a 1 arcsec
 *             scatter) and its mirror on the far side (the ejecta taken front-back symmetric about the star, so the
 *             Earth view is unchanged and the far side filled). In front of the far lobe, a dot sits 1 to 4 arcsec in
 *             front of the lobe's nearest surface instead.
 *   bright  - the [N II] light where Earth sees the cell (0.6 arcsec cells, 134 a side): heic1912a's red within its
 *             field (registered by ./heic-registration.mts; its bluish bright field stars left out), WFPC2 F658N 2003 beyond
 *             it, scaled to heic1912a on the knots both see. As an opacity: from 2 noise above the dark sky (the median
 *             beyond 25 arcsec, off the lobes) to its 99.7th percentile, at most 0.75; nothing on the lobes (their light
 *             is their own); a line or point a cell or two wide removed (the smaller of the cell and its 3-cell median).
 *             Over the far lobe, 30% of the gas around it carried inward (normalized convolution at 1, 2, 4, 8 cells).
 *   dust    - where the optical picture is darker than its surroundings (a 6-cell blur), on the gas, more than 2 arcsec
 *             from the lobes: dark dots at a knot's depth.
 *   size    - each dot's diameter follows the image's detail: 0.5 arcsec over the opacity's gradient, 1 to 2.5 arcsec,
 *             no larger than twice the distance to the lobes (at least 0.4) off them. Its opacity is shared so the dots
 *             over a cell add up to the cell's (gain 2.5 / 0.3).
 * Random draws are NumPy's PCG64 stream from seed 5 (./numpy-random.mts), in the original order, so the dots are the
 * original's. The record keeps each dot at 80% of that opacity.
 *
 * The occluder: an ellipsoid for each lobe of Steffen et al. (2014)'s mesh as the recipe places it (each side of the
 * plane through the star across the pole): its vertices' mean, and their covariance's principal axes (signed as NumPy's
 * eigh gives them, ./symmetric-eigen.mts), each reaching the farthest vertex along it.
 */
import { readFitsFileRegion } from '@cssearth/fits/node';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { stlTriangles } from '@cssearth/bake/image-layers';
import { distanceTransformEdt, gaussianFilter, gradient, mapCoordinates, medianFilter } from './ndimage.mts';
import { median, nanmedian, pairwiseSum, percentile } from './numpy-statistics.mts';
import { symmetricEigen } from './symmetric-eigen.mts';
import { defaultRng } from './numpy-random.mts';
import { fillPolygon } from './pil-polygon.mts';
import { pyRound, type PyJson } from './python-json.mts';
import { channelOf, readPicture } from './heic-registration.mts';
import { readScienceImage, STAR_DEC_DEG, STAR_RA_DEG } from './sky-grid.mts';

/** The lab's Earth-view camera distance (arcsec): the dots are placed as that perspective view sees them. */
export const EARTH_VIEW = 0.672 * 206265 / 2300;
/** The sky cells: arcsec a side and count a side. */
export const CELL = 0.6, CELLS = 134;
/** Dots a cell holds, the opacity gain, the far lobe's share of the gas around it, and the record's opacity strength. */
export const PER_CELL = 2, GAIN = 2.5 / 0.3, FRONT_SHARE = 0.3, STRENGTH = 0.8;
/** The optical picture's registration on the sky (arcsec east, north of its first pixel, of its last column's and its last row's), as the bake places it. */
export const PICTURE_CORNERS = { P00: [5.2814, 19.5998], P10: [-16.8468, 4.1174], P01: [19.9668, -1.3894] } as const;
/** The gas and dust colors. */
export const GAS_COLOR = [255, 69, 53] as const, DUST_COLOR = '#140504';

type Vec = [number, number, number];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** The recipe's placing of the surface model: its pole (tilt, position angle, roll, degrees), origin (file units) and scale. */
export interface SurfacePlacement { path: string; tiltDeg: number; paDeg: number; rollDeg: number; originUnits: Vec; arcsecPerUnit: number }
export function surfacePlacement(recipe: unknown): SurfacePlacement {
  const surface = (recipe as { geometry?: { surface?: Record<string, unknown> } })?.geometry?.surface, pole = surface?.pole as Record<string, unknown> | undefined;
  const numbers = (value: unknown, n: number) => Array.isArray(value) && value.length === n && value.every(item => typeof item === 'number' && Number.isFinite(item));
  if (!surface || typeof surface.path !== 'string' || !pole || !['tiltDeg', 'paDeg', 'rollDeg'].every(key => typeof pole[key] === 'number') || !numbers(surface.originUnits, 3) || typeof surface.arcsecPerUnit !== 'number')
    throw new TypeError('The recipe has no geometry.surface with a path, pole (tiltDeg, paDeg, rollDeg), originUnits and arcsecPerUnit.');
  return { path: surface.path, tiltDeg: pole.tiltDeg as number, paDeg: pole.paDeg as number, rollDeg: pole.rollDeg as number, originUnits: surface.originUnits as Vec, arcsecPerUnit: surface.arcsecPerUnit };
}
/** The pole (toward the receding lobe) and the file's axes on the sky (east, north, depth away from Earth). */
export function poleFrame(placement: SurfacePlacement): { pole: Vec; e1: Vec; e2: Vec } {
  const rad = Math.PI / 180, tilt = placement.tiltDeg * rad, pa = placement.paDeg * rad, roll = placement.rollDeg * rad;
  const pole: Vec = [Math.sin(tilt) * Math.sin(pa), Math.sin(tilt) * Math.cos(pa), Math.cos(tilt)], a = Math.hypot(pole[0], pole[1]);
  const u: Vec = [pole[1] / a, -pole[0] / a, 0], c = cross(pole, u), v: Vec = [-c[0], -c[1], -c[2]];
  return { pole, e1: [0, 1, 2].map(i => Math.cos(roll) * u[i]! + Math.sin(roll) * v[i]!) as Vec, e2: [0, 1, 2].map(i => -Math.sin(roll) * u[i]! + Math.cos(roll) * v[i]!) as Vec };
}
/** The surface model's triangles on the sky (arcsec east, north, depth), nine numbers a triangle. */
export function lobeTriangles(triangles: Float32Array, placement: SurfacePlacement): Float64Array {
  const { pole, e1, e2 } = poleFrame(placement), M = [e1, e2, pole], o = placement.originUnits, k = placement.arcsecPerUnit, out = new Float64Array(triangles.length);
  for (let i = 0; i < triangles.length; i += 3) { const x = triangles[i]! - o[0], y = triangles[i + 1]! - o[1], z = triangles[i + 2]! - o[2];
    for (let j = 0; j < 3; j++) out[i + j] = (x * M[0]![j]! + y * M[1]![j]! + z * M[2]![j]!) * k; }
  return out;
}

/** Where the Earth view sees a place: its east and north scaled by the view's perspective. */
export const skyAt = (east: number, north: number, depth: number): [number, number] => [east * EARTH_VIEW / (EARTH_VIEW + depth), north * EARTH_VIEW / (EARTH_VIEW + depth)];

/** One dot as the original writes it (gas_from_images.py's clump points). */
export interface Dot { eastArcsec: number; northArcsec: number; depthArcsec: number; diameterArcsec: number; colorCss: string; opacity: number }

export interface CloudInputs {
  /** knots3d rows (east, north, depth, ...). */ knots: readonly ArrayLike<number>[];
  /** heic1912a as PIL reads it, and its registration [arcsec per pixel, star column, star row]. */ heic: { rgb: Float64Array; width: number; height: number }; heicRegistration: readonly [number, number, number];
  /** The WFPC2 F658N 2003 drizzled product. */ wfpc2Path: string;
  /** The optical picture (source.jpg) as PIL reads it. */ photo: { rgb: Float64Array; width: number; height: number };
  /** The surface model's triangles and the recipe's placing of them. */ triangles: Float32Array; placement: SurfacePlacement;
}

/** The dots (gas_from_images.py). */
export async function cloudDots(inputs: CloudInputs, log = console.log): Promise<Dot[]> {
  const { pole } = poleFrame(inputs.placement), G = inputs.knots.filter(row => Math.abs(row[2]!) < 45).map(row => [row[0]!, row[1]!, row[2]!] as Vec);
  // heic1912a's red, and its field stars (bluish and bright).
  const hc = inputs.heic, [hs, hx0, hy0] = inputs.heicRegistration, HW = hc.width, HH = hc.height;
  const red = gaussianFilter(channelOf(hc, 0), [HH, HW], 2), blue = gaussianFilter(channelOf(hc, 2), [HH, HW], 2), starH = Float64Array.from(red, (r, p) => blue[p]! > 1.1 * r && r > 0.3 ? 1 : 0);
  const heic = (E: Float64Array, N: Float64Array) => {
    const u = E.map(e => hx0 - e / hs), v = N.map(n => hy0 - n / hs), r = mapCoordinates(red, [HH, HW], v, u, { order: 1, mode: 'constant', cval: NaN }), s = mapCoordinates(starH, [HH, HW], v, u, { order: 0, mode: 'constant', cval: 1 });
    return Float64Array.from(r, (value, i) => u[i]! > 2 && u[i]! < HW - 3 && v[i]! > 2 && v[i]! < HH - 3 && !(s[i]! > 0) ? value : NaN);
  };
  // WFPC2 F658N 2003: the whole mosaic, blurred by 1.5 pixels; offsets about the star through its projection's linear part.
  const image = await readScienceImage(inputs.wfpc2Path), whole = await readFitsFileRegion(image.path, image.hdu, { x0: 0, y0: 0, width: image.width, height: image.height }, 2 ** 33);
  const wd = gaussianFilter(whole.values.map(value => Number.isFinite(value) ? value : 0), [image.height, image.width], 1.5), star = image.projection.pixelOf(STAR_RA_DEG, STAR_DEC_DEG);
  if (!star) throw new RangeError(`${inputs.wfpc2Path} does not hold the star.`);
  const h = image.hdu.header, cd = [Number(h.CD1_1) * 3600, Number(h.CD1_2) * 3600, Number(h.CD2_1) * 3600, Number(h.CD2_2) * 3600], det = cd[0]! * cd[3]! - cd[1]! * cd[2]!;
  const inv = [cd[3]! / det, -cd[1]! / det, -cd[2]! / det, cd[0]! / det];
  const wfpc2 = (E: Float64Array, N: Float64Array) => mapCoordinates(wd, [image.height, image.width], E.map((e, i) => star[1] + (inv[2]! * -e + inv[3]! * N[i]!)), E.map((e, i) => star[0] + (inv[0]! * -e + inv[1]! * N[i]!)), { order: 1, mode: 'constant', cval: NaN });
  const positive: number[] = []; for (const value of wd) if (value > 0) positive.push(value);
  const bgW = nanmedian(Float64Array.from(positive));
  // WFPC2's scale to heic1912a: the median ratio on the knots both see.
  const gE = Float64Array.from(G, g => skyAt(...g)[0]), gN = Float64Array.from(G, g => skyAt(...g)[1]), bh = heic(gE, gN), bw = wfpc2(gE, gN).map(value => value - bgW), ratios: number[] = [];
  for (let i = 0; i < G.length; i++) if (Number.isFinite(bh[i]!) && Number.isFinite(bw[i]!) && bw[i]! > 0 && bh[i]! > 0.05) ratios.push(bh[i]! / bw[i]!);
  const finiteBw = Array.from(bw).filter(Number.isFinite), scale = ratios.length > 10 ? median(Float64Array.from(ratios)) : 1 / percentile(Float64Array.from(finiteBw), 95);
  log(`knots ${G.length}: heic1912a ${bh.filter(Number.isFinite).length}; WFPC2 scaled x${scale.toPrecision(3)} from ${ratios.length} knots seen by both`);
  // The target: the [N II] light on the sky cells.
  const n = CELLS * CELLS, skE = new Float64Array(n), skN = new Float64Array(n);
  for (let gy = 0; gy < CELLS; gy++) for (let gx = 0; gx < CELLS; gx++) { skE[gy * CELLS + gx] = (CELLS / 2 - gx - 0.5) * CELL; skN[gy * CELLS + gx] = (gy + 0.5 - CELLS / 2) * CELL; }
  const th = heic(skE, skN), tw = wfpc2(skE, skN).map(value => (value - bgW) * scale);
  const tgt = Float64Array.from(th, (value, p) => { const t = Number.isFinite(value) ? value : Math.min(1, Math.max(0, tw[p]!)); return Number.isNaN(t) ? 0 : t; });
  // The lobes on the sky cells, as PIL fills each triangle.
  const TT = lobeTriangles(inputs.triangles, inputs.placement), lobeSky = new Uint8Array(n), corner: [number, number][] = [[0, 0], [0, 0], [0, 0]];
  for (let t = 0; t < TT.length; t += 9) { for (let q = 0; q < 3; q++) { const [E, N] = skyAt(TT[t + 3 * q]!, TT[t + 3 * q + 1]!, TT[t + 3 * q + 2]!); corner[q] = [CELLS / 2 - E / CELL - 0.5, CELLS / 2 + N / CELL - 0.5]; } fillPolygon(lobeSky, CELLS, CELLS, corner); }
  const field: number[] = [], fieldFar: number[] = []; for (let p = 0; p < n; p++) if (!lobeSky[p] && tgt[p]! > 0) { field.push(tgt[p]!); if (Math.hypot(skE[p]!, skN[p]!) > 25) fieldFar.push(tgt[p]!); }
  const sky0 = percentile(Float64Array.from(fieldFar), 50), half = percentile(Float64Array.from(field), 50), low: number[] = [];
  for (let p = 0; p < n; p++) if (!lobeSky[p] && tgt[p]! > 0 && tgt[p]! < half) low.push(Math.abs(tgt[p]! - sky0));
  const noise = 1.4826 * median(Float64Array.from(low)), top = percentile(Float64Array.from(field), 99.7);
  let A = Float64Array.from(tgt, (value, p) => Math.min(1, Math.max(0, (value - sky0 - 2 * noise) / (top - sky0 - 2 * noise))) * 0.75 * (1 - lobeSky[p]!));
  const cleaned = medianFilter(A, [CELLS, CELLS], 3); A = A.map((value, p) => Math.min(value, cleaned[p]!));
  // Over the far lobe: the gas around it carried inward.
  const rad = Math.PI / 180, poleSky = [Math.sin(inputs.placement.paDeg * rad), Math.cos(inputs.placement.paDeg * rad)], farSky = Uint8Array.from(lobeSky, (value, p) => value && skE[p]! * poleSky[0]! + skN[p]! * poleSky[1]! > 0.5 ? 1 : 0);
  const known = Float64Array.from(lobeSky, value => value ? 0 : 1), knownA = A.map((value, p) => lobeSky[p] ? 0 : value), inward = new Float64Array(n);
  for (const sigma of [1, 2, 4, 8]) { const num = gaussianFilter(knownA, [CELLS, CELLS], sigma), den = gaussianFilter(known, [CELLS, CELLS], sigma);
    for (let p = 0; p < n; p++) if (inward[p] === 0 && den[p]! > 0.05) inward[p] = num[p]! / Math.max(den[p]!, 1e-6); }
  A = A.map((value, p) => farSky[p] ? FRONT_SHARE * inward[p]! : value);
  // The far lobe's nearest surface over each cell.
  const front = new Float64Array(n).fill(Infinity), cell = (value: number) => Math.min(CELLS - 1, Math.max(0, Math.trunc(value)));
  for (let t = 0; t < TT.length; t += 9) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, zMin = Infinity;
    for (let q = 0; q < 3; q++) { const [E, N] = skyAt(TT[t + 3 * q]!, TT[t + 3 * q + 1]!, TT[t + 3 * q + 2]!), ix = cell(CELLS / 2 - E / CELL - 0.5), iy = cell(CELLS / 2 + N / CELL - 0.5);
      x0 = Math.min(x0, ix); x1 = Math.max(x1, ix + 1); y0 = Math.min(y0, iy); y1 = Math.max(y1, iy + 1); zMin = Math.min(zMin, TT[t + 3 * q + 2]!); }
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) front[y * CELLS + x] = Math.min(front[y * CELLS + x]!, zMin);
  }
  // Dust: where the optical picture is darker than its surroundings.
  const ph = inputs.photo, [P00, P10, P01] = [PICTURE_CORNERS.P00, PICTURE_CORNERS.P10, PICTURE_CORNERS.P01];
  const m = [(P10[0] - P00[0]) / (ph.width - 1), (P01[0] - P00[0]) / (ph.height - 1), (P10[1] - P00[1]) / (ph.width - 1), (P01[1] - P00[1]) / (ph.height - 1)], mDet = m[0]! * m[3]! - m[1]! * m[2]!;
  const Aff = [m[3]! / mDet, -m[1]! / mDet, -m[2]! / mDet, m[0]! / mDet], pu = new Float64Array(n), pv = new Float64Array(n);
  for (let p = 0; p < n; p++) { const dE = skE[p]! - P00[0], dN = skN[p]! - P00[1]; pu[p] = Aff[0]! * dE + Aff[1]! * dN; pv[p] = Aff[2]! * dE + Aff[3]! * dN; }
  const brightest = Float64Array.from({ length: ph.width * ph.height }, (_, p) => Math.max(ph.rgb[3 * p]!, ph.rgb[3 * p + 1]!, ph.rgb[3 * p + 2]!));
  const lumP = mapCoordinates(gaussianFilter(brightest, [ph.height, ph.width], 1), [ph.height, ph.width], pv, pu, { order: 1, mode: 'constant', cval: NaN });
  const around = gaussianFilter(lumP.map(value => Number.isNaN(value) ? 0 : value) as Float64Array, [CELLS, CELLS], 6), gasNear = gaussianFilter(A, [CELLS, CELLS], 4), lobeBlur = gaussianFilter(Float64Array.from(lobeSky), [CELLS, CELLS], 1);
  const D = Float64Array.from({ length: n }, (_, p) => {
    const inPh = pu[p]! > 2 && pu[p]! < ph.width - 3 && pv[p]! > 2 && pv[p]! < ph.height - 3 ? 1 : 0, value = Math.min(1, Math.max(0, (around[p]! - lumP[p]!) / Math.max(around[p]!, 1e-3))) * inPh * (gasNear[p]! > 0.05 ? 1 : 0) * (1 - lobeBlur[p]!);
    return (Number.isNaN(value) ? 0 : value) * 0.6; });
  // Dot sizes: the opacity's detail, and near the lobes no larger than twice the distance to them.
  const nearLobe = distanceTransformEdt(Uint8Array.from(lobeSky, value => value ? 0 : 1), [CELLS, CELLS]).map(value => value * CELL), [gr, gc] = gradient(gaussianFilter(A, [CELLS, CELLS], 1), [CELLS, CELLS]);
  const detail = Float64Array.from({ length: n }, (_, p) => { const d = Math.min(2.5, Math.max(1.0, 0.5 / Math.max(Math.hypot(gr[p]!, gc[p]!) / CELL, 1e-3))); return lobeSky[p] ? d : Math.min(d, Math.max(2 * nearLobe[p]!, 0.4)); });
  // The dots, in the original's order and random stream.
  const kE = Float64Array.from(G, g => skyAt(...g)[0]), kN = Float64Array.from(G, g => skyAt(...g)[1]);
  const nearest = (e: number, nn: number) => Array.from(G.keys()).map(i => [(kE[i]! - e) ** 2 + (kN[i]! - nn) ** 2, i] as const).sort((a, b) => a[0] - b[0] || a[1] - b[1]).slice(0, 6).map(([, i]) => i);
  const rng = defaultRng(5, { fusedMultiplyAdd: true }), cloud = GAS_COLOR.map(c => c / 255), out: Dot[] = [], hex = (c: number) => c.toString(16).padStart(2, '0');
  const placed = (e: number, nn: number, z: number) => { const ee = e + rng.uniform(-CELL / 2, CELL / 2), en = nn + rng.uniform(-CELL / 2, CELL / 2); return [ee * (EARTH_VIEW + z) / EARTH_VIEW, en * (EARTH_VIEW + z) / EARTH_VIEW] as const; };
  let cells = 0;
  for (let p = 0; p < n; p++) {
    const a = A[p]!; if (!(a > 0.02)) continue; cells++;
    const e = skE[p]!, nn = skN[p]!, depths = nearest(e, nn).map(i => G[i]![2]), cover = Math.max(1.0, (detail[p]! / CELL) ** 2 * Math.PI / 4), ai = 1 - (1 - a) ** (GAIN / (PER_CELL * cover));
    let zs: number[];
    if (farSky[p] && Number.isFinite(front[p]!)) zs = Array.from({ length: PER_CELL }, () => front[p]! - rng.uniform(1, 4));
    else { const z0 = rng.choice(depths) + rng.normal(0, 1.0); zs = [z0, -z0]; }
    const color = '#' + cloud.map(c => hex(Math.trunc(Math.min(255, Math.max(0, c * (0.55 + 0.45 * a) * 255))))).join('');
    for (const z of zs) { const [E3, N3] = placed(e, nn, z); out.push({ eastArcsec: E3, northArcsec: N3, depthArcsec: z, diameterArcsec: detail[p]!, colorCss: color, opacity: ai }); }
  }
  let dust = 0;
  for (let p = 0; p < n; p++) {
    if (!(D[p]! > 0.06 && nearLobe[p]! > 2.0)) continue;
    const e = skE[p]!, nn = skN[p]!, z = rng.choice(nearest(e, nn).map(i => G[i]![2])) + rng.normal(0, 1.0), [E3, N3] = placed(e, nn, z);
    out.push({ eastArcsec: E3, northArcsec: N3, depthArcsec: z, diameterArcsec: detail[p]!, colorCss: DUST_COLOR, opacity: 1 - (1 - Math.min(0.6, Math.max(0, D[p]!))) ** (GAIN / Math.max(1.0, (detail[p]! / CELL) ** 2 * Math.PI / 4)) }); dust++;
  }
  log(`${out.length} dots over ${cells} sky cells, ${dust} of them dust`);
  return out;
}

/** numpy's round(x, decimals): x scaled, rounded half to even (keeping the sign of a zero, as rint does), scaled back. */
export const npRound = (x: number, decimals: number) => { const s = 10 ** decimals, y = x * s, f = Math.floor(y), r = y - f, k = r > 0.5 || r === 0.5 && f % 2 !== 0 ? f + 1 : f; return k === 0 && (y < 0 || Object.is(y, -0)) ? -0 : k / s; };

/** The lobes' occluder: an ellipsoid for each side of the plane through the star across the pole (export_cloud_source.py). */
export function lobeOccluder(triangles: Float32Array, placement: SurfacePlacement): { centre: number[]; axes: number[][] }[] {
  const T = lobeTriangles(triangles, placement), { pole } = poleFrame(placement), out: { centre: number[]; axes: number[][] }[] = [];
  for (const receding of [true, false]) {
    const P: Vec[] = []; for (let i = 0; i < T.length; i += 3) { const v: Vec = [T[i]!, T[i + 1]!, T[i + 2]!]; if ((v[0] * pole[0] + v[1] * pole[1] + v[2] * pole[2] > 0) === receding) P.push(v); }
    // P.mean(0) (a running sum down the rows), then numpy.cov of the offsets: their own mean taken off, the products' sums times 1 / (n - 1).
    const c = [0, 1, 2].map(j => { let s = 0; for (const p of P) s += p[j]; return s / P.length; }), X = P.map(p => [p[0] - c[0]!, p[1] - c[1]!, p[2] - c[2]!]);
    const mean = [0, 1, 2].map(j => pairwiseSum(Float64Array.from(X, x => x[j]!)) / X.length), D = [0, 1, 2].map(j => Float64Array.from(X, x => x[j]! - mean[j]!));
    const cov = [0, 1, 2].map(i => [0, 1, 2].map(j => pairwiseSum(D[i]!.map((value, k) => value * D[j]![k]!)) * (1 / (X.length - 1))));
    const { vectors } = symmetricEigen(cov);
    const axes = [0, 1, 2].map(k => { const axis = [0, 1, 2].map(r => vectors[r]![k]!), reach = Math.max(...X.map(x => Math.abs(x[0]! * axis[0]! + x[1]! * axis[1]! + x[2]! * axis[2]!))); return axis.map(value => npRound(value * reach, 3)); });
    out.push({ centre: c.map(value => npRound(value, 3)), axes });
  }
  return out;
}

/** The cloud points' source record (source/cloud-points.json), as export_cloud_source.py writes it, with this generator. */
export function cloudPointsRecord(dots: readonly Dot[], occluder: readonly { centre: number[]; axes: number[][] }[], generator: string): PyJson {
  return { schema: 'cssearth-cloud-points-source@1', generator, units: 'arcsec east, north, depth (away from Earth) from the star',
    points: dots.map(p => ({ east: pyRound(p.eastArcsec, 3), north: pyRound(p.northArcsec, 3), depth: pyRound(p.depthArcsec, 3), diameter: pyRound(p.diameterArcsec, 3), color: p.colorCss, opacity: pyRound(Math.min(1, p.opacity * STRENGTH), 4) })),
    occluder: occluder.map(item => ({ centre: item.centre, axes: item.axes })) };
}

/** The surface model and its placing, from the body's source directory. */
export async function readSurface(sourceDirectory: string): Promise<{ triangles: Float32Array; placement: SurfacePlacement }> {
  const placement = surfacePlacement(JSON.parse(await readFile(resolve(sourceDirectory, 'recipe.json'), 'utf8')) as unknown);
  return { triangles: stlTriangles(await readFile(resolve(sourceDirectory, placement.path)), placement.path), placement };
}
export { readPicture };
