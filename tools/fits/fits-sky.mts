/** The one place a FITS sky image's orientation is read. Every route that turns a celestial image into a display raster asks
 * here which way its columns and rows run, instead of assuming the common RA-left, Dec-up layout.
 *
 * The orientation is the linear part of the WCS at the reference pixel (FITS WCS Paper I, section 2.1): the CD matrix, or
 * CDELT scaled by PC, or CDELT with the older CROTA2. Only axis-aligned images are accepted. A rotated or skewed image,
 * swapped axes, a projection whose default LONPOLE is not 180 or a reference point on a celestial pole is refused, because
 * a display raster cannot hold it without resampling. tools/oracles/fits/sky-orientation.py checks this reading against
 * Astropy's world coordinates. */
import type { FitsHeader } from './fits.mts';

export interface SkyImageAxes {
  /** Right ascension increases with column, so stored east is on the right. */
  readonly eastRight: boolean;
  /** Declination increases with row, so the first stored row is the southern edge. */
  readonly northUp: boolean;
  /** Absolute pixel increments along columns and rows, in `unit`. */
  readonly scale: readonly [number, number];
  /** CUNIT1 and CUNIT2 when both are stated; SQUEEZE-style reconstructions state none. */
  readonly unit: string | undefined;
}

/** Zenithal projections, whose default LONPOLE of 180 keeps north up at a reference point off the pole. */
const ZENITHAL = new Set(['TAN', 'SIN', 'ARC', 'STG', 'ZEA', 'AZP', 'SZP', 'ZPN', 'AIR']);
const AXIS_ALIGNED = 1e-9;

const numberOf = (header: FitsHeader, key: string, fallback?: number) => {
  const value = header[key];
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`Sky image ${key} is not a finite number.`);
  return value;
};
const text = (header: FitsHeader, key: string) => {
  const value = header[key];
  if (value !== undefined && typeof value !== 'string') throw new TypeError(`Sky image ${key} is not a string.`);
  return value?.trim();
};

/** The linear part of the WCS at the reference pixel, degrees per pixel as [x/column, x/row, y/column, y/row]: the CD matrix,
 * CDELT scaled by PC, or CDELT with CROTA2 (Paper I, section 2.1; Paper II, section 6.1). */
function linearMatrix(header: FitsHeader): [number, number, number, number] {
  const has = (pattern: RegExp) => Object.keys(header).some(key => pattern.test(key));
  const cd = has(/^CD[12]_[12]$/u), pc = has(/^PC[12]_[12]$/u), crota = has(/^CROTA[12]$/u);
  // wcslib ignores CDELT beside CD; a header stating both is ambiguous about which its writer meant.
  if (Number(cd) + Number(pc) + Number(crota) > 1 || cd && has(/^CDELT[12]$/u)) throw new TypeError('A sky image states more than one of CD, CDELT with PC, and CROTA.');
  let matrix: [number, number, number, number];
  if (cd) matrix = [numberOf(header, 'CD1_1', 0), numberOf(header, 'CD1_2', 0), numberOf(header, 'CD2_1', 0), numberOf(header, 'CD2_2', 0)];
  else {
    const [x, y] = [numberOf(header, 'CDELT1'), numberOf(header, 'CDELT2')];
    if (pc) matrix = [x * numberOf(header, 'PC1_1', 1), x * numberOf(header, 'PC1_2', 0), y * numberOf(header, 'PC2_1', 0), y * numberOf(header, 'PC2_2', 1)];
    else {
      // CROTA1 has no meaning of its own; the celestial rotation is CROTA2 (Paper II, section 6.1).
      const rotation = numberOf(header, 'CROTA2', 0) * Math.PI / 180;
      if (header.CROTA1 !== undefined && numberOf(header, 'CROTA1') !== numberOf(header, 'CROTA2', 0)) throw new TypeError('A sky image states CROTA1 unlike CROTA2.');
      matrix = [x * Math.cos(rotation), -y * Math.sin(rotation), x * Math.sin(rotation), y * Math.cos(rotation)];
    }
  }
  return matrix;
}

/** The stated column and row directions of a two-axis (or first-two-axes) celestial image. */
export function skyImageAxes(header: FitsHeader): SkyImageAxes {
  const longitude = /^RA(?:---([A-Z0-9]{3}))?$/u.exec(text(header, 'CTYPE1') ?? ''), latitude = /^DEC(?:--([A-Z0-9]{3}))?$/u.exec(text(header, 'CTYPE2') ?? '');
  if (!longitude || !latitude || longitude[1] !== latitude[1]) throw new TypeError('A sky image states RA along columns and Dec along rows, with one projection.');
  const projection = longitude[1];
  if (projection !== undefined) {
    if (!ZENITHAL.has(projection)) throw new TypeError(`Sky image projection ${projection} is not zenithal.`);
    if (numberOf(header, 'LONPOLE', 180) !== 180) throw new TypeError('A sky image with a LONPOLE other than 180 is rotated.');
    if (Math.abs(numberOf(header, 'CRVAL2')) >= 90) throw new TypeError('A sky image referenced on a celestial pole has no north.');
  }
  const matrix = linearMatrix(header);
  const [xx, xy, yx, yy] = matrix, size = Math.min(Math.abs(xx), Math.abs(yy));
  if (!(size > 0) || Math.abs(xy) > AXIS_ALIGNED * size || Math.abs(yx) > AXIS_ALIGNED * size)
    throw new TypeError('A sky image is rotated or skewed against RA and Dec; it needs resampling, not a display flip.');
  const units = [text(header, 'CUNIT1'), text(header, 'CUNIT2')];
  if (units[0] !== units[1]) throw new TypeError('A sky image states different units on its two axes.');
  return { eastRight: xx > 0, northUp: yy > 0, scale: [Math.abs(xx), Math.abs(yy)], unit: units[0] || undefined };
}

/** Row-major samples in display order: the first row is the northern edge and the first column the eastern edge, as the sky is
 * seen from Earth. The input keeps FITS order, the first stored row first. */
export function skyDisplayRaster<T extends Float32Array | Float64Array>(values: T, width: number, height: number, axes: Pick<SkyImageAxes, 'eastRight' | 'northUp'>): T {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || values.length !== width * height)
    throw new RangeError('A sky raster does not match its size.');
  const out = new (values.constructor as { new(length: number): T })(values.length);
  for (let row = 0; row < height; row++) {
    const source = axes.northUp ? height - 1 - row : row, line = values.subarray(source * width, (source + 1) * width);
    if (axes.eastRight) for (let column = 0; column < width; column++) out[row * width + column] = line[width - 1 - column]!;
    else out.set(line, row * width);
  }
  return out;
}

/** A gnomonic (TAN) or orthographic (SIN) sky image's pixel <-> ICRS mapping, rotated or not: what an archive mosaic needs to be resampled onto another
 * grid. Distortion terms (SIP, TPV, PV cards other than a plain SIN's zero PV2_1 and PV2_2) are refused, as is a LONPOLE other than 180 or a frame other than ICRS or FK5.
 * Pixels are zero-based (the centre of the first stored pixel is 0, 0). tools/oracles/fits/sky-projection.py checks both
 * directions against Astropy's all_world2pix and all_pix2world. */
export interface SkyProjection {
  /** Zero-based pixel of an ICRS direction, or undefined on the far side of the tangent plane. */
  readonly pixelOf: (raDeg: number, decDeg: number) => [number, number] | undefined;
  /** ICRS direction of a zero-based pixel. */
  readonly skyOf: (x: number, y: number) => [number, number];
  /** Square root of the pixel area, in arcseconds. */
  readonly scaleArcsec: number;
}
export function skyProjection(header: FitsHeader): SkyProjection {
  // TAN (gnomonic) or SIN (orthographic, as radio interferometers write their images): both zenithal about the reference point,
  // the standard coordinates divided by the direction's height above the tangent plane for TAN and not for SIN.
  const kind = text(header, 'CTYPE1') === 'RA---TAN' && text(header, 'CTYPE2') === 'DEC--TAN' ? 'TAN' : text(header, 'CTYPE1') === 'RA---SIN' && text(header, 'CTYPE2') === 'DEC--SIN' ? 'SIN' : undefined;
  if (!kind) throw new TypeError('A sky projection needs RA---TAN and DEC--TAN axes, or RA---SIN and DEC--SIN.');
  // A SIN header may carry PV2_1 and PV2_2 = 0, the plain orthographic projection; anything else is the slant form, not applied here.
  const pv = Object.keys(header).filter(key => /^PV\d+_\d+$/u.test(key));
  if (kind === 'SIN' && pv.some(key => !/^PV2_[12]$/u.test(key) || numberOf(header, key) !== 0)) throw new TypeError('A slant SIN projection (PV2_1 or PV2_2 not zero) is a distortion this projection does not apply.');
  if (numberOf(header, 'LONPOLE', 180) !== 180) throw new TypeError('A sky image with a LONPOLE other than 180 is not supported.');
  const frame = text(header, 'RADESYS');
  if (frame !== undefined && frame !== 'ICRS' && frame !== 'FK5') throw new TypeError(`Sky frame ${frame} is not ICRS.`);
  if (Object.keys(header).some(key => /^(?:A|B|AP|BP)_(?:ORDER|\d+_\d+)$/u.test(key) || (kind === 'TAN' && /^PV\d+_\d+$/u.test(key)) || /^(?:D2IM|DP|CPDIS|CQDIS)/u.test(key)))
    throw new TypeError('A sky image with distortion terms needs its distortion model, which this projection does not apply.');
  const units = [text(header, 'CUNIT1'), text(header, 'CUNIT2')];
  if (units.some(unit => unit !== undefined && unit !== 'deg')) throw new TypeError('A TAN sky image states its axes in degrees.');
  const [a, b, c, d] = linearMatrix(header), det = a * d - b * c;
  if (!(Math.abs(det) > 0)) throw new TypeError('A sky image matrix is singular.');
  const crpix = [numberOf(header, 'CRPIX1'), numberOf(header, 'CRPIX2')], ra0 = numberOf(header, 'CRVAL1') * DEG, dec0 = numberOf(header, 'CRVAL2') * DEG;
  if (Math.abs(dec0) >= Math.PI / 2) throw new TypeError('A sky image referenced on a celestial pole has no north.');
  const centre = [Math.cos(dec0) * Math.cos(ra0), Math.cos(dec0) * Math.sin(ra0), Math.sin(dec0)];
  const east = [-Math.sin(ra0), Math.cos(ra0), 0], north = [-Math.sin(dec0) * Math.cos(ra0), -Math.sin(dec0) * Math.sin(ra0), Math.cos(dec0)];
  const dot = (u: number[], v: number[]) => u[0]! * v[0]! + u[1]! * v[1]! + u[2]! * v[2]!;
  return {
    scaleArcsec: Math.sqrt(Math.abs(det)) * 3600,
    pixelOf(raDeg, decDeg) {
      const r = raDeg * DEG, q = decDeg * DEG, v = [Math.cos(q) * Math.cos(r), Math.cos(q) * Math.sin(r), Math.sin(q)], z = dot(v, centre);
      if (!(z > 0)) return undefined;
      // Standard coordinates on the tangent plane, degrees: intermediate world x grows toward increasing RA (east).
      const height = kind === 'TAN' ? z : 1, x = dot(v, east) / height / DEG, y = dot(v, north) / height / DEG;
      return [(d * x - b * y) / det + crpix[0]! - 1, (-c * x + a * y) / det + crpix[1]! - 1];
    },
    skyOf(px, py) {
      const u = px + 1 - crpix[0]!, w = py + 1 - crpix[1]!, x = (a * u + b * w) * DEG, y = (c * u + d * w) * DEG;
      // TAN: the point on the tangent plane, normalised. SIN: the point on the sphere straight behind the plane point.
      const lift = kind === 'TAN' ? 1 : Math.sqrt(Math.max(0, 1 - x * x - y * y));
      const v = [0, 1, 2].map(i => lift * centre[i]! + x * east[i]! + y * north[i]!), n = Math.hypot(v[0]!, v[1]!, v[2]!);
      return [((Math.atan2(v[1]!, v[0]!) / DEG) % 360 + 360) % 360, Math.asin(v[2]! / n) / DEG];
    },
  };
}
const DEG = Math.PI / 180;
