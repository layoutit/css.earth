/**
 * The outer ejecta's common sky grid and the readers that put an archive image or cube on it.
 *
 * The grid (hst_grid.py in the original study): 0.05 arcsec pixels, 2,600 a side (130 arcsec), north up and east left,
 * a gnomonic (TAN) projection about the star at RA 161.264775, Dec -59.684431 (ICRS), its reference pixel between the
 * middle two pixels. Row 0 is the grid's south edge, as numpy holds it.
 *
 * `reprojectOnGrid` is reproject 0.21's `reproject_interp` (bilinear) with Astropy 8's coordinate handling, as the original
 * study ran it: each grid pixel's sky direction in the grid's frame (ICRS) is carried into the image's own frame (an FK5
 * J2000 image gets the IAU frame bias of USNO Circular 179, as Astropy's ICRS-to-FK5 transform does), its pixel there read
 * bilinearly as scipy.ndimage.map_coordinates does (./ndimage.mts), a pixel within half a pixel outside the image taken as
 * its edge pixel, and a pixel whose position does not come back to within one pixel of itself left unknown (NaN).
 */
import { skyProjection, type FitsHeader, type SkyProjection } from '@cssearth/fits';
import { readFitsFileHdus, readFitsFileRegion, type FitsFileHdu } from '@cssearth/fits/node';
import { open } from 'node:fs/promises';
import { mapCoordinates } from './ndimage.mts';

/** Half the grid's side in pixels, its pixel in arcsec, and the star's place (ICRS degrees). */
export const HALF = 1300, PIX = 0.05, STAR_RA_DEG = 161.264775, STAR_DEC_DEG = -59.684431;
/** The grid's side in pixels. */
export const SIDE = 2 * HALF;

/** The grid's projection, as hst_grid.py builds its Astropy WCS (CDELT, no rotation; reference pixel HALF + 0.5, one-based). */
export function gridProjection(): SkyProjection {
  return skyProjection({ CTYPE1: 'RA---TAN', CTYPE2: 'DEC--TAN', CRVAL1: STAR_RA_DEG, CRVAL2: STAR_DEC_DEG, CRPIX1: HALF + 0.5, CRPIX2: HALF + 0.5,
    CDELT1: -PIX / 3600, CDELT2: PIX / 3600, CUNIT1: 'deg', CUNIT2: 'deg' });
}

const RAD = Math.PI / 180;
/** Astropy's rotation_matrix(angle, axis) for x, y or z: the left-handed rotation by `angleDeg`. */
function rotation(angleDeg: number, axis: 0 | 1 | 2): number[][] {
  const s = Math.sin(angleDeg * RAD), c = Math.cos(angleDeg * RAD), m = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], a1 = (axis + 1) % 3, a2 = (axis + 2) % 3;
  m[axis]![axis] = 1; m[a1]![a1] = c; m[a1]![a2] = s; m[a2]![a1] = -s; m[a2]![a2] = c; return m;
}
const multiply = (a: number[][], b: number[][]) => a.map(row => [0, 1, 2].map(j => row[0]! * b[0]![j]! + row[1]! * b[1]![j]! + row[2]! * b[2]![j]!));
/** ICRS to FK5 J2000 (the B-matrix of USNO Circular 179, as Astropy's `_icrs_to_fk5_matrix`). */
export const ICRS_TO_FK5 = multiply(multiply(rotation(19.9 / 3600000, 0), rotation(9.1 / 3600000, 1)), rotation(-22.9 / 3600000, 2));

/** A direction carried by a 3x3 matrix (or its transpose), degrees in and out. */
export function rotateDirection(matrix: number[][], raDeg: number, decDeg: number, transpose = false): [number, number] {
  const ra = raDeg * RAD, dec = decDeg * RAD, v = [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
  const at = (i: number, j: number) => transpose ? matrix[j]![i]! : matrix[i]![j]!;
  const w = [0, 1, 2].map(i => at(i, 0) * v[0]! + at(i, 1) * v[1]! + at(i, 2) * v[2]!);
  const lon = Math.atan2(w[1]!, w[0]!) / RAD;
  return [((lon % 360) + 360) % 360, Math.atan2(w[2]!, Math.hypot(w[0]!, w[1]!)) / RAD];
}

/** The frame an image's celestial axes are stated in: ICRS, or FK5 at equinox J2000 (Astropy's reading of RADESYS and
 * EQUINOX; a header with neither is ICRS). Other frames or equinoxes are refused. */
export function celestialFrame(header: FitsHeader): 'ICRS' | 'FK5' {
  const system = typeof header.RADESYS === 'string' ? header.RADESYS.trim() : undefined, equinox = header.EQUINOX === undefined ? undefined : Number(header.EQUINOX);
  if (system === 'ICRS' || (system === undefined && equinox === undefined)) return 'ICRS';
  if ((system === 'FK5' || system === undefined) && (equinox === undefined || equinox === 2000)) return 'FK5';
  throw new TypeError(`Sky frame ${String(system)} at equinox ${String(equinox)} is not ICRS or FK5 J2000.`);
}

/** A two-axis science image of a drizzled HST product: its HDU (SCI, or the first two-axis image), its projection and
 * frame, its primary header. Distortion-file names a drizzled product keeps (D2IM, NPOL and the like) are dropped:
 * nothing of them is left in a drizzled image. */
export interface ScienceImage { path: string; hdu: FitsFileHdu; primary: FitsHeader; width: number; height: number; projection: SkyProjection; frame: 'ICRS' | 'FK5' }
export async function readScienceImage(path: string): Promise<ScienceImage> {
  const hdus = await readFitsFileHdus(path), hdu = hdus.find(item => item.header.EXTNAME === 'SCI') ?? hdus.find(item => item.dimensions.length === 2);
  if (!hdu || hdu.dimensions.length !== 2 || ![-32, -64].includes(hdu.bitpix)) throw new TypeError(`${path} has no floating-point SCI image.`);
  const header: FitsHeader = Object.fromEntries(Object.entries(hdu.header).filter(([key]) => !/^(D2IM|DP\d|CPDIS|CQDIS|NPOL)/u.test(key)));
  const [width, height] = hdu.dimensions as [number, number];
  return { path, hdu, primary: hdus[0]!.header, width, height, projection: skyProjection(header), frame: celestialFrame(hdu.header) };
}

/** Where each grid pixel falls in an image (zero-based column and row; NaN where it does not come back to itself within a
 * pixel), as reproject's pixel_to_pixel_with_roundtrip. */
export function gridToImagePixels(image: Pick<ScienceImage, 'projection' | 'frame'>, grid: SkyProjection = gridProjection(), side = SIDE): { cols: Float64Array; rows: Float64Array } {
  const cols = new Float64Array(side * side), rows = new Float64Array(side * side), fk5 = image.frame === 'FK5';
  for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
    const p = y * side + x, [ra0, dec0] = grid.skyOf(x, y), [ra, dec] = fk5 ? rotateDirection(ICRS_TO_FK5, ra0, dec0) : [ra0, dec0];
    const at = image.projection.pixelOf(ra, dec);
    if (!at) { cols[p] = rows[p] = NaN; continue; }
    const [rb0, db0] = image.projection.skyOf(at[0], at[1]), [rb, db] = fk5 ? rotateDirection(ICRS_TO_FK5, rb0, db0, true) : [rb0, db0], back = grid.pixelOf(rb, db);
    if (!back || Math.abs(back[0] - x) > 1 || Math.abs(back[1] - y) > 1) { cols[p] = rows[p] = NaN; continue; }
    cols[p] = at[0]; rows[p] = at[1];
  }
  return { cols, rows };
}

/**
 * An image's values on the grid, as reproject_interp(order='bilinear') gives them: coordinates within half a pixel
 * outside the image moved onto its edge pixel, scipy's bilinear map_coordinates (mode 'constant', NaN outside), NaN
 * beyond half a pixel. Only the rectangle of the image the grid reaches is read. Float64 values.
 */
export async function reprojectOnGrid(image: ScienceImage, transform: (values: Float64Array) => Float64Array = values => values): Promise<Float64Array> {
  const { cols, rows } = gridToImagePixels(image), W = image.width, H = image.height, out = new Float64Array(cols.length).fill(NaN);
  // reproject's _clip_coords: a coordinate in [-0.5, 0) becomes 0; one in [n - 1, n - 0.5) becomes n - 1.
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let p = 0; p < cols.length; p++) {
    let c = cols[p]!, r = rows[p]!;
    if (c < 0 && c >= -0.5) c = 0; if (c < W - 0.5 && c >= W - 1) c = W - 1; if (r < 0 && r >= -0.5) r = 0; if (r < H - 0.5 && r >= H - 1) r = H - 1;
    cols[p] = c; rows[p] = r;
    if (c >= 0 && c <= W - 1 && r >= 0 && r <= H - 1) { x0 = Math.min(x0, c); x1 = Math.max(x1, c); y0 = Math.min(y0, r); y1 = Math.max(y1, r); }
  }
  if (!(x1 >= x0)) return out;
  // The read rectangle: every pixel a bilinear read can touch, the mirror of the last pixel included (its row/column n - 2).
  const rx0 = Math.max(0, Math.floor(x0) - 1), ry0 = Math.max(0, Math.floor(y0) - 1), rx1 = Math.min(W - 1, Math.floor(x1) + 1), ry1 = Math.min(H - 1, Math.floor(y1) + 1);
  const region = await readFitsFileRegion(image.path, image.hdu, { x0: rx0, y0: ry0, width: rx1 - rx0 + 1, height: ry1 - ry0 + 1 }, 2 ** 33);
  const values = transform(region.values), w = rx1 - rx0 + 1, h = ry1 - ry0 + 1;
  // A sample is taken in the rectangle only where its two neighbours along each axis lie inside it; at the image's own last
  // pixel scipy reads the pixel before as the mirror, which the rectangle holds when it reaches that edge.
  const inside = new Uint8Array(cols.length), rr = new Float64Array(cols.length), cc = new Float64Array(cols.length);
  for (let p = 0; p < cols.length; p++) { const c = cols[p]!, r = rows[p]!; if (c >= 0 && c <= W - 1 && r >= 0 && r <= H - 1) { inside[p] = 1; cc[p] = c - rx0; rr[p] = r - ry0; } else { cc[p] = rr[p] = -1; } }
  // The rectangle's last column/row is the image's own only when it reaches the edge; otherwise a coordinate there has its
  // right neighbour inside the rectangle by construction (floor + 1 <= rx1), so map_coordinates on the rectangle is exact.
  const sampled = mapCoordinates(values, [h, w], rr, cc, { order: 1, mode: 'constant', cval: NaN });
  for (let p = 0; p < cols.length; p++) if (inside[p]) out[p] = sampled[p]!;
  return out;
}

/** The planes `first` to `last` (inclusive, zero-based) of a three-axis float32 cube HDU, as one Float32Array [plane][row][column]. */
export async function readCubePlanes(path: string, hdu: FitsFileHdu, first: number, last: number): Promise<Float32Array> {
  const [W, H, D] = hdu.dimensions as [number, number, number];
  if (hdu.dimensions.length !== 3 || hdu.bitpix !== -32) throw new TypeError(`${path}: expected a three-axis float32 cube.`);
  if (hdu.header.BSCALE !== undefined && Number(hdu.header.BSCALE) !== 1 || hdu.header.BZERO !== undefined && Number(hdu.header.BZERO) !== 0) throw new TypeError(`${path}: a scaled cube is not read here.`);
  if (!(Number.isInteger(first) && Number.isInteger(last) && first >= 0 && last >= first && last < D)) throw new RangeError(`${path}: planes ${first} to ${last} are not in 0..${D - 1}.`);
  const plane = W * H, out = new Float32Array((last - first + 1) * plane), file = await open(path, 'r'), chunk = Buffer.alloc(plane * 4);
  try {
    for (let k = first; k <= last; k++) {
      const { bytesRead } = await file.read(chunk, 0, chunk.length, hdu.dataStart + k * plane * 4);
      if (bytesRead !== chunk.length) throw new Error(`${path}: plane ${k} is truncated.`);
      const base = (k - first) * plane; for (let i = 0; i < plane; i++) out[base + i] = chunk.readFloatBE(4 * i);
    }
  } finally { await file.close(); }
  return out;
}
