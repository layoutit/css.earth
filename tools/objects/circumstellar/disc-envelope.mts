/** A circumstellar disc seen in a coronagraph image, given depth the way this repository gives every sky image depth: a
 * three-dimensional shape is fitted to what was measured and each sky column is spread along it (src/preparation/volume/
 * column-depth.ts). Nothing is extruded.
 *
 * Three steps, each measured on the image itself:
 *
 * 1. `readSkyPlane` resamples the mosaic about the star onto a square sky plane in the volume's units (astronomical units at
 *    the star's distance), x toward increasing image column (west) and y toward north, through the mosaic's own WCS
 *    (fits-sky skyProjection), so a rotated mosaic is read, not flipped. The background and noise are measured in an annulus
 *    far from the star.
 * 2. `ringGeometry` finds the ring's ridge, the radius of peak brightness in each azimuth, and fits an ellipse to it. A
 *    circular ring seen at inclination i projects to an ellipse of axis ratio cos i whose major axis is the line of nodes,
 *    so the fit gives the ring's radius, inclination and position angle, and the offset of its centre from the star.
 * 3. `fitDiscEnvelope` projects candidate envelopes through the cube and scores each against the image at its best gain over
 *    the annulus the ring occupies: an inclined ring of that geometry with free radial width and vertical thickness, a
 *    spherical shell (the shape a star's dust envelope takes), and constant depth, which is what pushing the image backwards
 *    assumes. The ring must beat both or the author refuses; every residual is recorded beside the answer.
 *
 * One image cannot say which side of an inclined ring is nearer the observer: the tilt's sign is a stated convention
 * (`nearSide`), never a measurement. */
import { readFitsFileHdus, readFitsFileRegion } from '../../fits/fits.mts';
import { skyProjection } from '../../fits/fits-sky.mts';

const DEG = Math.PI / 180;

export interface SkyPlaneRequest {
  /** The star's ICRS position at the epoch of the image, degrees. */
  readonly starRaDeg: number; readonly starDecDeg: number;
  /** Arcseconds per volume unit: 1 / distance in parsecs puts one unit at one astronomical unit. */
  readonly arcsecPerUnit: number;
  /** Half the plane's side, and the samples along it, in volume units. */
  readonly halfUnits: number; readonly size: number;
  /** Where the sky is empty: the annulus about the star, in arcseconds, whose median is the background and whose scatter is the noise. */
  readonly backgroundAnnulusArcsec: readonly [number, number];
  /** Where the image is: the SCI extension of a JWST or HST product (the default), or the primary HDU of an archive image such as an
   * ALMA pipeline product. */
  readonly imageHdu?: 'SCI' | 'primary';
}
export interface SkyPlane {
  readonly size: number; readonly halfUnits: number; readonly step: number;
  /** Background-subtracted surface brightness at each sample, x fastest; NaN where the mosaic has no data. */
  readonly plane: Float32Array;
  readonly background: number; readonly noise: number; readonly backgroundPixels: number;
  readonly mosaicArcsecPerPixel: number; readonly starPixel: readonly [number, number];
  readonly unit: string;
}

const quantile = (sorted: ArrayLike<number>, q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)))]!;

/** The mosaic about the star, on the volume's sky plane. */
export async function readSkyPlane(mosaic: string, request: SkyPlaneRequest): Promise<SkyPlane> {
  const { size, halfUnits, arcsecPerUnit } = request;
  if (!(size >= 16 && Number.isInteger(size)) || !(halfUnits > 0) || !(arcsecPerUnit > 0)) throw new RangeError('Invalid sky plane request.');
  const hdus = await readFitsFileHdus(mosaic), sci = request.imageHdu === 'primary' ? hdus[0] : hdus.find(hdu => hdu.header.EXTNAME === 'SCI');
  if (!sci) throw new Error(`${mosaic} has no ${request.imageHdu === 'primary' ? 'primary HDU' : 'SCI extension'}.`);
  const [width, height] = sci.dimensions as [number, number];
  const { values } = await readFitsFileRegion(mosaic, sci, { x0: 0, y0: 0, width, height }, 1024 ** 3);
  const projection = skyProjection(sci.header), star = projection.pixelOf(request.starRaDeg, request.starDecDeg);
  if (!star) throw new Error('The star is on the far side of the tangent plane.');
  const arcsecPerPixel = projection.scaleArcsec;
  // Background and noise in the empty annulus, on the mosaic's own pixels.
  const samples: number[] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const r = Math.hypot(x - star[0], y - star[1]) * arcsecPerPixel, v = values[y * width + x]!;
    if (r >= request.backgroundAnnulusArcsec[0] && r < request.backgroundAnnulusArcsec[1] && Number.isFinite(v)) samples.push(v);
  }
  if (samples.length < 100) throw new Error(`Only ${samples.length} mosaic pixels lie in the background annulus.`);
  samples.sort((a, b) => a - b);
  const background = quantile(samples, 0.5);
  const deviations = samples.map(v => Math.abs(v - background)).sort((a, b) => a - b), noise = 1.4826 * quantile(deviations, 0.5);
  const bilinear = (x: number, y: number) => {
    const ix = Math.floor(x), iy = Math.floor(y);
    if (ix < 0 || iy < 0 || ix + 1 >= width || iy + 1 >= height) return NaN;
    const a = x - ix, b = y - iy, o = iy * width + ix;
    return (1 - a) * (1 - b) * values[o]! + a * (1 - b) * values[o + 1]! + (1 - a) * b * values[o + width]! + a * b * values[o + width + 1]!;
  };
  const plane = new Float32Array(size * size), step = 2 * halfUnits / size, cosDec = Math.cos(request.starDecDeg * DEG);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    // x grows toward increasing image column, which is west; the nebula frame reflects it into east. y grows north.
    const xUnits = -halfUnits + (i + 0.5) * step, yUnits = -halfUnits + (j + 0.5) * step;
    const ra = request.starRaDeg - xUnits * arcsecPerUnit / 3600 / cosDec, dec = request.starDecDeg + yUnits * arcsecPerUnit / 3600;
    const at = projection.pixelOf(ra, dec);
    plane[j * size + i] = at ? bilinear(at[0], at[1]) - background : NaN;
  }
  const unit = typeof sci.header.BUNIT === 'string' ? sci.header.BUNIT : '';
  return { size, halfUnits, step, plane, background, noise, backgroundPixels: samples.length, mosaicArcsecPerPixel: arcsecPerPixel, starPixel: [star[0], star[1]], unit };
}

/** A deposited image with no sky coordinates, read about its star onto the same sky plane as `readSkyPlane`: an author's
 * reduced array whose README states the star's pixel, the plate scale and the orientation. `north-up-east-left` means row
 * index grows north and column index grows west, as a sky image shown with north up and east left. */
export interface ArrayPlaneRequest {
  readonly pixelArcsec: number; readonly orientation: 'north-up-east-left' | 'north-down-east-left' | 'north-up-east-right' | 'north-down-east-right';
  /** The star's pixel, zero-based (x column, y row); an array centre is ((width - 1) / 2, (height - 1) / 2). */
  readonly starPixel: readonly [number, number] | 'array-centre';
  readonly arcsecPerUnit: number; readonly halfUnits: number; readonly size: number; readonly backgroundAnnulusArcsec: readonly [number, number];
}
export async function readArrayPlane(path: string, request: ArrayPlaneRequest): Promise<SkyPlane> {
  const { size, halfUnits, arcsecPerUnit, pixelArcsec } = request;
  if (!(size >= 16 && Number.isInteger(size)) || !(halfUnits > 0) || !(arcsecPerUnit > 0) || !(pixelArcsec > 0)) throw new RangeError('Invalid array plane request.');
  const hdus = await readFitsFileHdus(path), image = hdus.find(hdu => hdu.dimensions.length === 2);
  if (!image) throw new Error(`${path} has no two-dimensional image.`);
  const [width, height] = image.dimensions as [number, number];
  const { values } = await readFitsFileRegion(path, image, { x0: 0, y0: 0, width, height }, 1024 ** 3);
  const star = request.starPixel === 'array-centre' ? [(width - 1) / 2, (height - 1) / 2] as const : request.starPixel;
  // Sky plane x grows west, y north; the orientation says which way the array's axes run on the sky.
  const westSign = request.orientation.endsWith('east-left') ? 1 : -1, northSign = request.orientation.startsWith('north-up') ? 1 : -1;
  const pixelOf = (xArcsecWest: number, yArcsecNorth: number) => [star[0] + westSign * xArcsecWest / pixelArcsec, star[1] + northSign * yArcsecNorth / pixelArcsec] as const;
  const samples: number[] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const r = Math.hypot(x - star[0], y - star[1]) * pixelArcsec, v = values[y * width + x]!;
    if (r >= request.backgroundAnnulusArcsec[0] && r < request.backgroundAnnulusArcsec[1] && Number.isFinite(v)) samples.push(v);
  }
  if (samples.length < 100) throw new Error(`Only ${samples.length} pixels lie in the background annulus.`);
  samples.sort((a, b) => a - b);
  const background = quantile(samples, 0.5);
  const deviations = samples.map(v => Math.abs(v - background)).sort((a, b) => a - b), noise = 1.4826 * quantile(deviations, 0.5);
  const bilinear = (x: number, y: number) => {
    const ix = Math.floor(x), iy = Math.floor(y);
    if (ix < 0 || iy < 0 || ix + 1 >= width || iy + 1 >= height) return NaN;
    const a = x - ix, b = y - iy, o = iy * width + ix;
    return (1 - a) * (1 - b) * values[o]! + a * (1 - b) * values[o + 1]! + (1 - a) * b * values[o + width]! + a * b * values[o + width + 1]!;
  };
  const plane = new Float32Array(size * size), step = 2 * halfUnits / size;
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const [px, py] = pixelOf((-halfUnits + (i + 0.5) * step) * arcsecPerUnit, (-halfUnits + (j + 0.5) * step) * arcsecPerUnit);
    plane[j * size + i] = bilinear(px, py) - background;
  }
  const unit = typeof image.header.BUNIT === 'string' ? image.header.BUNIT : '';
  return { size, halfUnits, step, plane, background, noise, backgroundPixels: samples.length, mosaicArcsecPerPixel: pixelArcsec, starPixel: [star[0], star[1]], unit };
}

export interface RingGeometry {
  /** Ridge samples: azimuth (degrees east of north), radius of peak brightness (units) and that peak over the noise. */
  readonly ridge: readonly { readonly azimuthDeg: number; readonly radiusUnits: number; readonly peakOverNoise: number }[];
  /** The ellipse the ridge traces: its centre's offset from the star, semi-axes, and the major axis's position angle. */
  readonly centreUnits: readonly [number, number];
  readonly semiMajorUnits: number; readonly semiMinorUnits: number;
  /** Position angle of the line of nodes, degrees east of north, in [0, 180). */
  readonly positionAngleDeg: number;
  /** Inclination from face-on, degrees: acos of the axis ratio. */
  readonly inclinationDeg: number;
  /** Root-mean-square distance of the ridge samples from the ellipse, in units. */
  readonly ridgeResidualUnits: number;
  /** Root-mean-square departure of the single-binning fits from this one: what the choice of bins moves. */
  readonly binningSpread: { readonly semiMajorUnits: number; readonly inclinationDeg: number; readonly positionAngleDeg: number };
}

/** Position angle east of north of a sky-plane vector (x west, y north). */
const positionAngle = (x: number, y: number) => ((Math.atan2(-x, y) / DEG) % 360 + 360) % 360;

/** The ring's ridge and the ellipse through it, over an ensemble of binnings. One binning quantises the ridge to the grid, and
 * at a low inclination the direction of the major axis is sensitive to it: measured on HD 181327, azimuth bins of 24 to 48 and
 * radial bin edges moved by a fraction of a sample shift the position angle by up to five degrees. So the ridge is found under
 * every combination of three azimuth binnings and three radial phases, one ellipse is fitted through all of those samples, and
 * the scatter of the single-binning fits is reported as the measurement's own spread. */
export function ringGeometry(sky: SkyPlane, options: { innerMaskUnits: number; outerUnits: number; minimumPeakOverNoise?: number }): RingGeometry {
  const single: RingGeometry[] = [];
  for (const azimuthBins of [24, 36, 48]) for (const phase of [0, 1 / 3, 2 / 3])
    single.push(ridgeEllipse(sky, { ...options, azimuthBins, innerMaskUnits: options.innerMaskUnits + phase * sky.step }));
  const ridge = single.flatMap(one => one.ridge);
  const union = fitEllipse(ridge);
  const spread = (pick: (one: RingGeometry) => number, circular = false) => {
    const values = single.map(pick), reference = pick({ ...union, ridge, binningSpread: { semiMajorUnits: 0, inclinationDeg: 0, positionAngleDeg: 0 } });
    return Math.sqrt(values.reduce((total, value) => total + (circular ? ((value - reference) % 180 + 270) % 180 - 90 : value - reference) ** 2, 0) / values.length);
  };
  return { ...union, ridge, binningSpread: { semiMajorUnits: spread(one => one.semiMajorUnits), inclinationDeg: spread(one => one.inclinationDeg), positionAngleDeg: spread(one => one.positionAngleDeg, true) } };
}

/** The ridge under one binning and the ellipse through it. */
function ridgeEllipse(sky: SkyPlane, options: { innerMaskUnits: number; outerUnits: number; azimuthBins: number; minimumPeakOverNoise?: number }): RingGeometry {
  const { size, halfUnits, step, plane, noise } = sky, bins = options.azimuthBins, minimum = options.minimumPeakOverNoise ?? 5;
  const radialBins = Math.round((options.outerUnits - options.innerMaskUnits) / step);
  if (radialBins < 4) throw new RangeError('The ring annulus spans fewer than four samples.');
  const sums = Array.from({ length: bins }, () => ({ total: new Float64Array(radialBins), count: new Float64Array(radialBins) }));
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const x = -halfUnits + (i + 0.5) * step, y = -halfUnits + (j + 0.5) * step, r = Math.hypot(x, y), v = plane[j * size + i]!;
    if (!Number.isFinite(v) || r < options.innerMaskUnits || r >= options.outerUnits) continue;
    const a = Math.floor(positionAngle(x, y) / 360 * bins) % bins, k = Math.min(radialBins - 1, Math.floor((r - options.innerMaskUnits) / step));
    sums[a]!.total[k]! += v; sums[a]!.count[k]! += 1;
  }
  const ridge: { azimuthDeg: number; radiusUnits: number; peakOverNoise: number }[] = [];
  for (const [a, { total, count }] of sums.entries()) {
    let best = -1, peak = -Infinity;
    for (let k = 0; k < radialBins; k++) {
      if (count[k]! < 2) continue;
      const mean = total[k]! / count[k]!;
      if (mean > peak) { peak = mean; best = k; }
    }
    if (best < 0 || !(peak / noise >= minimum)) continue;
    // The peak between samples: the vertex of the parabola through the brightest radial bin and its two neighbours.
    let offset = 0;
    if (best > 0 && best < radialBins - 1 && count[best - 1]! >= 2 && count[best + 1]! >= 2) {
      const before = total[best - 1]! / count[best - 1]!, after = total[best + 1]! / count[best + 1]!, curvature = before - 2 * peak + after;
      if (curvature < 0) offset = Math.max(-0.5, Math.min(0.5, (before - after) / (2 * curvature)));
    }
    ridge.push({ azimuthDeg: (a + 0.5) * 360 / bins, radiusUnits: options.innerMaskUnits + (best + 0.5 + offset) * step, peakOverNoise: peak / noise });
  }
  if (ridge.length < bins / 2) throw new Error(`The ring's ridge is found in only ${ridge.length} of ${bins} azimuths above ${minimum} times the noise.`);
  return { ...fitEllipse(ridge), ridge, binningSpread: { semiMajorUnits: 0, inclinationDeg: 0, positionAngleDeg: 0 } };
}

/** The ellipse through ridge samples: the conic A x^2 + B x y + C y^2 + D x + E y = 1 by least squares. */
function fitEllipse(ridge: RingGeometry['ridge']): Omit<RingGeometry, 'ridge' | 'binningSpread'> {
  const rows = ridge.map(({ azimuthDeg, radiusUnits }) => {
    const x = -radiusUnits * Math.sin(azimuthDeg * DEG), y = radiusUnits * Math.cos(azimuthDeg * DEG);
    return { x, y, row: [x * x, x * y, y * y, x, y] };
  });
  const coefficients = leastSquares(rows.map(({ row }) => row), rows.map(() => 1));
  const [A, B, C, D, E] = coefficients as [number, number, number, number, number];
  const discriminant = 4 * A * C - B * B;
  if (!(discriminant > 0)) throw new Error('The ridge does not trace an ellipse.');
  const cx = (B * E - 2 * C * D) / discriminant, cy = (B * D - 2 * A * E) / discriminant;
  const F = 1 + A * cx * cx + B * cx * cy + C * cy * cy + D * cx + E * cy;
  const trace = A + C, det = A * C - B * B / 4, root = Math.sqrt(Math.max(0, trace * trace / 4 - det));
  const lambdaMinor = trace / 2 + root, lambdaMajor = trace / 2 - root;
  if (!(lambdaMajor > 0 && F > 0)) throw new Error('The ridge ellipse is degenerate.');
  const semiMajor = Math.sqrt(F / lambdaMajor), semiMinor = Math.sqrt(F / lambdaMinor);
  // Eigenvector of the major axis (smaller eigenvalue).
  const vx = Math.abs(B) > 1e-12 ? B / 2 : (A <= C ? 1 : 0), vy = Math.abs(B) > 1e-12 ? lambdaMajor - A : (A <= C ? 0 : 1);
  const pa = positionAngle(vx, vy) % 180;
  const residual = Math.sqrt(rows.reduce((total, { x, y }) => {
    const u = x - cx, w = y - cy, value = A * u * u + B * u * w + C * w * w;
    // Distance to the ellipse along the ray from its centre.
    const scale = Math.sqrt(F / value);
    return total + (Math.hypot(u, w) * (1 - scale)) ** 2;
  }, 0) / rows.length);
  return { centreUnits: [cx, cy], semiMajorUnits: semiMajor, semiMinorUnits: semiMinor, positionAngleDeg: pa,
    inclinationDeg: Math.acos(Math.min(1, semiMinor / semiMajor)) / DEG, ridgeResidualUnits: residual };
}

function leastSquares(rows: readonly (readonly number[])[], rhs: readonly number[]): number[] {
  const n = rows[0]!.length, ata = Array.from({ length: n }, () => new Float64Array(n)), atb = new Float64Array(n);
  for (const [k, row] of rows.entries()) for (let i = 0; i < n; i++) { atb[i]! += row[i]! * rhs[k]!; for (let j = 0; j < n; j++) ata[i]![j]! += row[i]! * row[j]!; }
  // Gaussian elimination with partial pivoting.
  const m = ata.map((row, i) => [...row, atb[i]!]);
  for (let c = 0; c < n; c++) {
    let pivot = c; for (let r = c + 1; r < n; r++) if (Math.abs(m[r]![c]!) > Math.abs(m[pivot]![c]!)) pivot = r;
    [m[c], m[pivot]] = [m[pivot]!, m[c]!];
    if (!(Math.abs(m[c]![c]!) > 1e-300)) throw new Error('The ridge fit is singular.');
    for (let r = 0; r < n; r++) if (r !== c) { const f = m[r]![c]! / m[c]![c]!; for (let k = c; k <= n; k++) m[r]![k]! -= f * m[c]![k]!; }
  }
  return m.map((row, i) => row[n]! / row[i]!);
}

export interface DiscModel {
  readonly radiusUnits: number; readonly gaussianWidthUnits: number; readonly gaussianHeightUnits: number;
  readonly inclinationDeg: number; readonly positionAngleDeg: number; readonly centreUnits: readonly [number, number];
  /** Which end of the minor axis is nearer the observer: its position angle, degrees east of north. A convention. */
  readonly nearSidePositionAngleDeg: number;
}
/** Density of the ring model at a sky-plane point, z toward the observer. */
export function discDensity(model: DiscModel): (x: number, y: number, z: number) => number {
  const phi = model.positionAngleDeg * DEG, i = model.inclinationDeg * DEG;
  // Sky basis in (east, north, toward observer); x is west.
  const nodes = [Math.sin(phi), Math.cos(phi), 0], minor = [Math.cos(phi), -Math.sin(phi), 0];
  // The minor axis end that is nearer the observer tilts toward +z.
  const nearAlongMinor = Math.cos((model.nearSidePositionAngleDeg - (model.positionAngleDeg + 90)) * DEG) >= 0 ? 1 : -1;
  const inPlaneMinor = [minor[0]! * Math.cos(i), minor[1]! * Math.cos(i), nearAlongMinor * Math.sin(i)];
  const normal = [-nearAlongMinor * minor[0]! * Math.sin(i), -nearAlongMinor * minor[1]! * Math.sin(i), Math.cos(i)];
  const { radiusUnits: R, gaussianWidthUnits: w, gaussianHeightUnits: h } = model, [cx, cy] = model.centreUnits;
  return (x, y, z) => {
    const e = -(x - cx), n = y - cy;
    const a = e * nodes[0]! + n * nodes[1]!, b = e * inPlaneMinor[0]! + n * inPlaneMinor[1]! + z * inPlaneMinor[2]!;
    const zd = e * normal[0]! + n * normal[1]! + z * normal[2]!, rd = Math.hypot(a, b);
    return Math.exp(-(((rd - R) / w) ** 2) / 2 - ((zd / h) ** 2) / 2);
  };
}

/** Density of a disc whose surface density in its own plane follows a measured radial profile: the image's median brightness
 * in rings of the disc plane, deprojected with the ring's geometry. Every line of sight then crosses the plane where the image
 * says the light is, halo included. A narrow gaussian ring cannot do that for sight lines through the halo: its density along
 * them never peaks inside the cube, so their light lands on the cube's faces. A small floor keeps every column on the plane. */
export function profileDiscDensity(model: DiscModel, profile: readonly { readonly radiusUnits: number; readonly value: number }[]): (x: number, y: number, z: number) => number {
  if (profile.length < 2) throw new RangeError('A profile disc needs at least two rings.');
  const phi = model.positionAngleDeg * DEG, i = model.inclinationDeg * DEG;
  const nodes = [Math.sin(phi), Math.cos(phi), 0], minor = [Math.cos(phi), -Math.sin(phi), 0];
  const nearAlongMinor = Math.cos((model.nearSidePositionAngleDeg - (model.positionAngleDeg + 90)) * DEG) >= 0 ? 1 : -1;
  const inPlaneMinor = [minor[0]! * Math.cos(i), minor[1]! * Math.cos(i), nearAlongMinor * Math.sin(i)];
  const normal = [-nearAlongMinor * minor[0]! * Math.sin(i), -nearAlongMinor * minor[1]! * Math.sin(i), Math.cos(i)];
  const h = model.gaussianHeightUnits, [cx, cy] = model.centreUnits, peak = Math.max(...profile.map(ring => ring.value));
  const floor = 1e-6 * peak, radii = profile.map(ring => ring.radiusUnits), values = profile.map(ring => Math.max(floor, ring.value));
  const surface = (r: number) => {
    if (r <= radii[0]!) return values[0]!;
    if (r >= radii.at(-1)!) return floor;
    let k = 1; while (radii[k]! < r) k++;
    const t = (r - radii[k - 1]!) / (radii[k]! - radii[k - 1]!);
    return values[k - 1]! * (1 - t) + values[k]! * t;
  };
  return (x, y, z) => {
    const e = -(x - cx), n = y - cy;
    const a = e * nodes[0]! + n * nodes[1]!, b = e * inPlaneMinor[0]! + n * inPlaneMinor[1]! + z * inPlaneMinor[2]!;
    const zd = e * normal[0]! + n * normal[1]! + z * normal[2]!;
    return surface(Math.hypot(a, b)) * Math.exp(-((zd / h) ** 2) / 2);
  };
}

/** Score any envelope against the image at its best gain over the annulus the ring occupies: the projection's residual. */
export function scoreEnvelope(sky: SkyPlane, density: (x: number, y: number, z: number) => number, options: { innerMaskUnits: number; outerUnits: number; depthSamples?: number }) {
  const { size, halfUnits, step, plane } = sky, depth = options.depthSamples ?? size;
  const zs = Array.from({ length: depth }, (_, k) => -halfUnits + (k + 0.5) * 2 * halfUnits / depth), dz = 2 * halfUnits / depth;
  let num = 0, den = 0; const pairs: [number, number][] = [];
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const x = -halfUnits + (i + 0.5) * step, y = -halfUnits + (j + 0.5) * step, r = Math.hypot(x, y), v = plane[j * size + i]!;
    if (!Number.isFinite(v) || r < options.innerMaskUnits || r >= options.outerUnits) continue;
    let column = 0; for (const z of zs) column += density(x, y, z) * dz;
    pairs.push([v, column]); num += v * column; den += column * column;
  }
  const gain = den > 0 ? num / den : 0;
  return { residualRms: Math.sqrt(pairs.reduce((total, [v, column]) => total + (v - gain * column) ** 2, 0) / pairs.length), gain };
}

export interface EnvelopeSearch {
  /** Radial gaussian width of the ring as a fraction of its radius: from, to, step. */
  readonly widthOfRadius: readonly [number, number, number];
  /** Vertical gaussian heights, as fractions of the radius, scored for the record: a ring seen at moderate inclination
   * projects almost alike at every thickness, so the height is a stated convention, and these residuals show how little
   * the image says about it. */
  readonly heightOfRadius: readonly number[];
  /** Spherical shell: radius as a fraction of the ring's mean ridge radius, and width as a fraction of that radius. */
  readonly shellRadiusOfRidge: readonly [number, number, number]; readonly shellWidthOfRadius: readonly [number, number, number];
}
export const DEFAULT_SEARCH: EnvelopeSearch = Object.freeze<EnvelopeSearch>({ widthOfRadius: [0.04, 0.6, 0.02], heightOfRadius: [0.02, 0.05, 0.1, 0.2],
  shellRadiusOfRidge: [0.6, 1.4, 0.05], shellWidthOfRadius: [0.05, 0.8, 0.05] });

export interface EnvelopeFit {
  readonly shape: 'inclined-ring';
  /** The ring at the stated height, with its best radial width. */
  readonly ring: DiscModel & { readonly residualRms: number; readonly gain: number };
  readonly shell: { readonly radiusUnits: number; readonly gaussianWidthUnits: number; readonly residualRms: number };
  readonly constantDepthResidualRms: number; readonly signalRms: number; readonly scoredPixels: number;
  /** The ring's residual at its best width for every height tried, the stated one included. */
  readonly heightResiduals: readonly { readonly heightOfRadius: number; readonly residualRms: number }[];
}

/** Score the candidate envelopes against the image and keep the ring, or refuse. */
export function fitDiscEnvelope(sky: SkyPlane, geometry: RingGeometry, options: { innerMaskUnits: number; outerUnits: number; nearSidePositionAngleDeg: number; heightOfRadius: number; search?: EnvelopeSearch; depthSamples?: number }): EnvelopeFit {
  const { size, halfUnits, step, plane } = sky, search = options.search ?? DEFAULT_SEARCH, depth = options.depthSamples ?? size;
  const scored: number[] = [];
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const x = -halfUnits + (i + 0.5) * step, y = -halfUnits + (j + 0.5) * step, r = Math.hypot(x, y);
    if (Number.isFinite(plane[j * size + i]!) && r >= options.innerMaskUnits && r < options.outerUnits) scored.push(j * size + i);
  }
  if (scored.length < 100) throw new Error('Fewer than a hundred samples to score the envelope on.');
  const zs = Array.from({ length: depth }, (_, k) => -halfUnits + (k + 0.5) * 2 * halfUnits / depth), dz = 2 * halfUnits / depth;
  const model = new Float64Array(scored.length);
  const score = (density: (x: number, y: number, z: number) => number) => {
    let num = 0, den = 0;
    for (const [s, p] of scored.entries()) {
      const x = -halfUnits + (p % size + 0.5) * step, y = -halfUnits + (Math.floor(p / size) + 0.5) * step;
      let column = 0; for (const z of zs) column += density(x, y, z) * dz;
      model[s] = column; num += plane[p]! * column; den += column * column;
    }
    const gain = den > 0 ? num / den : 0;
    let residual = 0; for (const [s, p] of scored.entries()) residual += (plane[p]! - gain * model[s]!) ** 2;
    return { residualRms: Math.sqrt(residual / scored.length), gain };
  };
  let signal = 0; for (const p of scored) signal += plane[p]! ** 2;
  const signalRms = Math.sqrt(signal / scored.length);
  const R = geometry.semiMajorUnits;
  const range = ([from, to, by]: readonly [number, number, number]) => Array.from({ length: Math.round((to - from) / by) + 1 }, (_, k) => from + k * by);
  const base = { radiusUnits: R, inclinationDeg: geometry.inclinationDeg, positionAngleDeg: geometry.positionAngleDeg, centreUnits: geometry.centreUnits, nearSidePositionAngleDeg: options.nearSidePositionAngleDeg };
  if (!(options.heightOfRadius > 0)) throw new RangeError('The ring needs a stated vertical height.');
  let ring: EnvelopeFit['ring'] | undefined;
  const heightResiduals: { heightOfRadius: number; residualRms: number }[] = [];
  const widths = range(search.widthOfRadius);
  for (const heightOfRadius of [...new Set([options.heightOfRadius, ...search.heightOfRadius])].sort((a, b) => a - b)) {
    let bestForHeight: EnvelopeFit['ring'] | undefined;
    for (const widthOfRadius of widths) {
      const candidate = { ...base, gaussianWidthUnits: widthOfRadius * R, gaussianHeightUnits: heightOfRadius * R };
      const { residualRms, gain } = score(discDensity(candidate));
      if (!bestForHeight || residualRms < bestForHeight.residualRms) bestForHeight = { ...candidate, residualRms, gain };
    }
    heightResiduals.push({ heightOfRadius, residualRms: bestForHeight!.residualRms });
    if (heightOfRadius === options.heightOfRadius) ring = bestForHeight;
  }
  const ridgeMean = geometry.ridge.reduce((total, point) => total + point.radiusUnits, 0) / geometry.ridge.length;
  let shell = { radiusUnits: 0, gaussianWidthUnits: 0, residualRms: Infinity };
  for (const radiusOfRidge of range(search.shellRadiusOfRidge)) for (const widthOfRadius of range(search.shellWidthOfRadius)) {
    const radius = radiusOfRidge * ridgeMean, width = widthOfRadius * radius;
    const { residualRms } = score((x, y, z) => Math.exp(-(((Math.hypot(x, y, z) - radius) / width) ** 2) / 2));
    if (residualRms < shell.residualRms) shell = { radiusUnits: radius, gaussianWidthUnits: width, residualRms };
  }
  const flat = score(() => 1).residualRms;
  const widthOfRadius = ring!.gaussianWidthUnits / R;
  if (widthOfRadius <= search.widthOfRadius[0] || widthOfRadius >= search.widthOfRadius[1])
    throw new Error(`The ring's best width sits on the edge of the search (${widthOfRadius.toFixed(3)} of the radius), so it is not a fit.`);
  if (!(ring!.residualRms < shell.residualRms && ring!.residualRms < flat))
    throw new Error(`No inclined ring beats the alternatives (ring ${ring!.residualRms.toExponential(3)}, shell ${shell.residualRms.toExponential(3)}, constant depth ${flat.toExponential(3)}).`);
  return { shape: 'inclined-ring', ring: ring!, shell, constantDepthResidualRms: flat, signalRms, scoredPixels: scored.length, heightResiduals };
}
