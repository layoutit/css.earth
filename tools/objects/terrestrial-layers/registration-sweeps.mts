/**
 * Registration of a photograph's camera against something that already knows the surface.
 *
 * A camera arrives from a label, a control network, a kernel set or an observer computation, and nothing in any of
 * those looks at the pixels. Two measurements close the loop. The disc centre can be read from the photograph's own
 * limb, by aligning the outline the mesh projects to the outline the frame shows. The rotation is judged by
 * predicting the frame from a surface reference through the mesh and correlating prediction with photograph while the
 * body is turned about its pole: a correct camera peaks at zero, a mirrored one does not, and the peak's offset is the
 * measured longitude error. The reference is a published map in the body frame where one exists, and otherwise the
 * body's other frames, which cannot know a constant phase error but do know the pole, the period and the handedness.
 *
 * Silhouettes are invariant under a longitude mirror; this comparison is not. That is why it exists. Every camera
 * kind enters through one small interface, a caster that can be turned about the body's pole, so the same
 * measurement serves a computed observer camera and a spacecraft kernel camera alike.
 */
import { requireFiniteNumber } from '@cssearth/core';
import { rotate } from '../../spice/frames.mts';
import { multiply } from '@cssearth/spice';
import { createIndexedShape } from './obj-shape.mts';
import type { SourceMesh } from './contracts.mts';
import type { CameraImage } from './shape-camera-mosaic.mts';
import { controlledShapeCamera } from './shape-camera-mosaic.mts';
import { observerCamera, type BodyOrientation, type ObserverSighting } from './observer-camera.mts';

const DEGREE = Math.PI / 180;

/** The part of a source mesh a ray cast and its shading need. */
export type RayMesh = Pick<SourceMesh, 'intersect' | 'positions' | 'indices'>;
/** A surface value by body-fixed east longitude and latitude, or null where the reference says nothing. */
export interface SurfaceReference { sample(eastLongitudeDegrees: number, latitudeDegrees: number): number | null }
export type Sighting = Omit<ObserverSighting, 'center'>;

/** A photograph as the registration reads it: samples in detector order, rows top-down, and which pixels the archive withholds. */
export interface RegistrationImage { width: number; height: number; values: ArrayLike<number>; reject?(index: number): string | null }
/** A camera image as the registration image it is. */
export const registrationImage = (image: CameraImage | RegistrationImage): RegistrationImage => 'data' in image ? { width: image.width, height: image.height, values: image.data } : image;

/** What a ray cast needs of a camera, in body-fixed metres, with the direction to the Sun in the same frame. */
export interface Caster { positionMeters: readonly number[]; sunDirection: readonly number[]; ray(x: number, y: number): readonly number[]; project(point: readonly number[]): readonly number[] | null }
/** A caster that can be turned about the body's pole: the operation every sweep below performs. */
export interface TurnableCaster extends Caster { turned(degrees: number): TurnableCaster }

/** The orientation with the body turned by a constant angle about its pole: the offset the sweep measures. */
export function turnedOrientation(base: BodyOrientation, degrees: number): BodyOrientation {
  const turn = rotate(requireFiniteNumber(degrees, 'turn') * DEGREE, 3);
  return { rotation: jd => multiply(turn, base.rotation(jd)), phaseDegrees: jd => base.phaseDegrees(jd) + degrees };
}

/** The observer-computed camera as a caster; turning it turns the orientation it was computed from. */
export function observerCaster(sighting: ObserverSighting, orientation: BodyOrientation): TurnableCaster {
  const camera = controlledShapeCamera(observerCamera(sighting, orientation));
  return { positionMeters: Array.from(camera.position), sunDirection: Array.from(camera.sun), ray: (x, y) => Array.from(camera.ray(x, y)), project: point => camera.project(point),
    turned: degrees => observerCaster(sighting, turnedOrientation(orientation, degrees)) };
}

/**
 * Any observation camera as a caster. Turning the body by an angle about its pole is the same sight as turning the
 * camera the other way about the same axis, so the position, the Sun and every ray are rotated and the projection
 * takes its points through the inverse turn. The camera itself is never touched.
 */
export function observationCaster(camera: { positionMeters: readonly number[]; sunDirection?: readonly number[]; ray(x: number, y: number): readonly number[]; project(point: readonly number[]): readonly number[] | null }, degrees = 0): TurnableCaster {
  if (!camera.sunDirection) throw new Error('A caster needs the camera\'s Sun direction.');
  const sun = camera.sunDirection;
  const a = -degrees * DEGREE, c = Math.cos(a), s = Math.sin(a);
  const turn = (v: readonly number[]) => [c * v[0] - s * v[1], s * v[0] + c * v[1], v[2]];
  const back = (v: readonly number[]) => [c * v[0] + s * v[1], -s * v[0] + c * v[1], v[2]];
  return { positionMeters: turn(camera.positionMeters), sunDirection: turn(sun), ray: (x, y) => turn(camera.ray(x, y)), project: point => camera.project(back(point)),
    turned: more => observationCaster(camera, degrees + more) };
}

/**
 * A terrain model that ships as a radius field, as a mesh rays can be cast into. Vertices sit on a regular grid that
 * stops short of the poles, so no face degenerates; the two polar caps are open by half a step.
 */
export function radiusFieldMesh(sample: (eastLongitudeDegrees: number, latitudeDegrees: number) => number | null, degreesPerVertex: number): SourceMesh {
  const step = requireFiniteNumber(degreesPerVertex, 'vertex step');
  if (!(step > 0) || !Number.isInteger(360 / step) || !Number.isInteger(180 / step)) throw new TypeError('The vertex step must divide 360 and 180 degrees.');
  const columns = 360 / step, rows = 180 / step, vertices: number[][] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) {
    const latitude = -90 + (r + 0.5) * step, longitude = c * step, radius = sample(longitude, latitude);
    if (radius === null || !(radius > 0)) throw new Error(`The radius field has no radius at ${longitude}, ${latitude}.`);
    vertices.push([radius * Math.cos(latitude * DEGREE) * Math.cos(longitude * DEGREE), radius * Math.cos(latitude * DEGREE) * Math.sin(longitude * DEGREE), radius * Math.sin(latitude * DEGREE)]);
  }
  const indices: number[][] = [];
  for (let r = 0; r < rows - 1; r++) for (let c = 0; c < columns; c++) {
    const a = r * columns + c, b = r * columns + (c + 1) % columns, d = (r + 1) * columns + c, e = (r + 1) * columns + (c + 1) % columns;
    indices.push([a, b, e], [a, e, d]);
  }
  return createIndexedShape(vertices, indices, { metersPerUnit: 1, expectedVertices: vertices.length, expectedFaces: indices.length });
}

/** The peak sample of a photograph, over the pixels the archive keeps. */
export function peakValue({ values, reject }: RegistrationImage) {
  let peak = -Infinity;
  for (let i = 0; i < values.length; i++) if (!reject?.(i) && values[i] > peak) peak = values[i];
  return peak;
}

/** The outline radius in each angular bin about a centre, for the points a predicate admits. */
export function outline(width: number, height: number, admits: (x: number, y: number) => boolean, cx: number, cy: number, bins: number) {
  const radii = new Float64Array(bins);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (admits(x, y)) {
    const bin = ((Math.round(Math.atan2(y - cy, x - cx) / (2 * Math.PI) * bins) % bins) + bins) % bins, distance = Math.hypot(x - cx, y - cy);
    if (distance > radii[bin]) radii[bin] = distance;
  }
  return radii;
}

export interface LimbCentre {
  center: [number, number]; iterations: number; movedPixels: number; limbBins: number;
  /** The radial residual left between the photographed and projected outlines once the centre is fitted, root mean square over the limb bins, in pixels: the contour residual the survey papers report. */
  residualPixels: number;
}

/**
 * The disc centre from the limb. The brightness centroid sits toward the lit limb at any phase angle, so the mesh's
 * projected outline is aligned to the photograph's outline instead: the least-squares first harmonic of the radial
 * residual between them, over every direction, is the centre error, and a few iterations remove it. The edge is a
 * stated fraction of the frame's peak. Using every direction lets a symmetric error in the mesh outline cancel; the
 * price is the terminator side, which at phase angle α ends up to R(1 − cos α) inside the limb. For a main-belt body
 * seen from Earth α is under 25 degrees, and the bias is a fraction of a pixel on a deconvolved frame.
 */
/** Half-step iterations a limb fit may take after its plain ones, when it has not settled. */
export const DAMPED_LIMB_ITERATIONS = 16;

export function limbCentre(source: CameraImage | RegistrationImage, sighting: Sighting, orientation: BodyOrientation, positions: readonly (readonly number[])[],
    { edgeFraction = 0.25, bins = 72, iterations = 8 } = {}): LimbCentre {
  const image = registrationImage(source), { width, height, values } = image;
  const peak = peakValue(image);
  if (!(peak > 0)) throw new Error('The frame has no positive sample to place a limb on.');
  const edge = peak * edgeFraction, lit = (x: number, y: number) => !image.reject?.(y * width + x) && values[y * width + x] > edge;
  let cx = 0, cy = 0, count = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (lit(x, y)) { cx += x; cy += y; count++; }
  if (count < bins) throw new Error('The frame shows too little disc to place a limb on.');
  cx /= count; cy /= count;
  let moved = 0, done = 0, limbBins = 0, residualPixels = NaN;
  // A fit still moving after its plain iterations takes half steps: on an elongated outline the full step can bounce
  // the centre between two positions for ever (Kleopatra's frames flip 0.52 px each way), and half steps settle between
  // them. A fit that settles within the plain iterations never reaches this and is unchanged.
  for (let iteration = 0; iteration < iterations + DAMPED_LIMB_ITERATIONS; iteration++) {
    const camera = controlledShapeCamera(observerCamera({ ...sighting, center: [cx, cy] }, orientation));
    const model = new Float64Array(bins);
    for (const position of positions) {
      const projected = camera.project(position);
      if (!projected) continue;
      const bin = ((Math.round(Math.atan2(projected[1] - cy, projected[0] - cx) / (2 * Math.PI) * bins) % bins) + bins) % bins, distance = Math.hypot(projected[0] - cx, projected[1] - cy);
      if (distance > model[bin]) model[bin] = distance;
    }
    const observed = outline(width, height, lit, cx, cy, bins);
    let scc = 0, scs = 0, sss = 0, rc = 0, rs = 0, squared = 0; limbBins = 0;
    for (let bin = 0; bin < bins; bin++) {
      if (!(model[bin] > 0) || !(observed[bin] > 0)) continue;
      const theta = bin * 2 * Math.PI / bins, residual = observed[bin] - model[bin], c = Math.cos(theta), s = Math.sin(theta);
      scc += c * c; scs += c * s; sss += s * s; rc += residual * c; rs += residual * s; squared += residual * residual; limbBins++;
    }
    residualPixels = Math.sqrt(squared / limbBins);
    const determinant = scc * sss - scs * scs;
    if (limbBins < bins / 2 || !(Math.abs(determinant) > 1e-9)) throw new Error('The frame shows too little limb to place a centre on.');
    const dx = (rc * sss - rs * scs) / determinant, dy = (rs * scc - rc * scs) / determinant;
    const step = iteration < iterations ? 1 : 0.5;
    cx += step * dx; cy += step * dy; moved = step * Math.hypot(dx, dy); done = iteration + 1;
    if (moved < 0.05) break;
  }
  return { center: [cx, cy], iterations: done, movedPixels: moved, limbBins, residualPixels };
}

/** One frame cast once: the body-fixed point, both shadings and the disc interior under every lit pixel. */
export interface Cast {
  width: number; height: number; lit: Uint8Array; longitude: Float64Array; latitude: Float64Array;
  /** Lambert factor by the face normal, and by the radial direction; the sweep picks one by its shading option. */
  faceLambert: Float64Array; radialLambert: Float64Array; inner: number[];
}

/** The outward unit normal of a mesh face. */
function faceNormal(mesh: RayMesh, faceId: number) {
  const [a, b, c] = mesh.indices[faceId].map(index => mesh.positions[index]);
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], length = Math.hypot(n[0], n[1], n[2]);
  const outward = n[0] * a[0] + n[1] * a[1] + n[2] * a[2] >= 0 ? 1 : -1;
  return [outward * n[0] / length, outward * n[1] / length, outward * n[2] / length];
}

/**
 * How a prediction is lit. `face` shades by the normal of the mesh face under the pixel, so an elongated body's own
 * relief is explained by the mesh and does not pass for markings; it is the model for a reference built from frames,
 * which hold albedo once their own shading is divided out. `radial` shades by the direction from the body centre, a
 * smooth disc function; it is the model for a reference that is itself a photograph, such as a spacecraft mosaic,
 * whose relief shading is already in it and would otherwise be applied twice.
 */
export type Shading = 'face' | 'radial';

/** Cast the frame onto the mesh once; every sweep below reads this and casts again only for a turned body. */
export function castFrame(image: RegistrationImage, caster: Caster, mesh: RayMesh, { lowFraction = 0.2, insetPixels = 5 } = {}): Cast {
  const { width, height, values } = image, count = width * height;
  const sun = caster.sunDirection, eye = Array.from(caster.positionMeters);
  const low = peakValue(image) * lowFraction;
  const lit = new Uint8Array(count), longitude = new Float64Array(count), latitude = new Float64Array(count), faceLambert = new Float64Array(count), radialLambert = new Float64Array(count);
  const normals = new Map<number, number[]>();
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x;
    if (!(values[i] > low) || image.reject?.(i)) continue;
    const direction = Array.from(caster.ray(x, y)), hit = mesh.intersect(eye, direction);
    if (!hit) continue;
    const p = [0, 1, 2].map(k => eye[k] + direction[k] * hit.radius), r = Math.hypot(p[0], p[1], p[2]);
    let normal = normals.get(hit.faceId);
    if (!normal) { normal = faceNormal(mesh, hit.faceId); normals.set(hit.faceId, normal); }
    lit[i] = 1; longitude[i] = Math.atan2(p[1], p[0]) / DEGREE; latitude[i] = Math.asin(p[2] / r) / DEGREE;
    faceLambert[i] = Math.max(0, normal[0] * sun[0] + normal[1] * sun[1] + normal[2] * sun[2]);
    radialLambert[i] = Math.max(0, (p[0] * sun[0] + p[1] * sun[1] + p[2] * sun[2]) / r);
  }
  const inner: number[] = [];
  for (let y = insetPixels; y < height - insetPixels; y++) for (let x = insetPixels; x < width - insetPixels; x++) {
    let whole = true;
    for (let dy = -insetPixels; dy <= insetPixels && whole; dy++) for (let dx = -insetPixels; dx <= insetPixels; dx++) if (!lit[(y + dy) * width + x + dx]) { whole = false; break; }
    if (whole) inner.push(y * width + x);
  }
  return { width, height, lit, longitude, latitude, faceLambert, radialLambert, inner };
}

/**
 * The frame less its local mean over the lit disc, through two summed-area tables, so the cost is the image and not
 * the image times the window: the smooth illumination and the deconvolution's plateau go, the markings stay.
 */
function highpass(values: ArrayLike<number>, width: number, height: number, lit: Uint8Array, inner: readonly number[], radius: number) {
  const stride = width + 1, sums = new Float64Array((width + 1) * (height + 1)), counts = new Float64Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y++) {
    let rowSum = 0, rowCount = 0;
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (lit[i]) { rowSum += values[i]; rowCount++; }
      sums[(y + 1) * stride + x + 1] = sums[y * stride + x + 1] + rowSum;
      counts[(y + 1) * stride + x + 1] = counts[y * stride + x + 1] + rowCount;
    }
  }
  const out = new Float64Array(values.length);
  for (const i of inner) {
    const y = Math.floor(i / width), x = i % width;
    const x0 = Math.max(0, x - radius), y0 = Math.max(0, y - radius), x1 = Math.min(width - 1, x + radius) + 1, y1 = Math.min(height - 1, y + radius) + 1;
    const box = (table: Float64Array) => table[y1 * stride + x1] - table[y0 * stride + x1] - table[y1 * stride + x0] + table[y0 * stride + x0];
    out[i] = values[i] - box(sums) / box(counts);
  }
  return out;
}

function correlation(a: Float64Array, b: Float64Array, inner: readonly number[]) {
  const n = inner.length;
  if (n < 64) return 0;
  let sa = 0, sb = 0;
  for (const i of inner) { sa += a[i]; sb += b[i]; }
  const ma = sa / n, mb = sb / n;
  let saa = 0, sbb = 0, sab = 0;
  for (const i of inner) { const da = a[i] - ma, db = b[i] - mb; saa += da * da; sbb += db * db; sab += da * db; }
  return saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : 0;
}

/**
 * The photograph and its caster reduced by a whole factor: each new pixel is the mean of a block, withheld if any of
 * the block was withheld, and the caster reads rays at block centres. A large detector is judged at the scale a
 * bounded number of rays allows; the registration is a measurement of degrees, not of pixels.
 */
export function reduced(image: RegistrationImage, caster: TurnableCaster, factor: number): { image: RegistrationImage; caster: TurnableCaster } {
  if (!Number.isInteger(factor) || factor < 1) throw new TypeError('The reduction factor is a whole number.');
  if (factor === 1) return { image, caster };
  const width = Math.floor(image.width / factor), height = Math.floor(image.height / factor), values = new Float64Array(width * height), withheld = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let dy = 0; dy < factor; dy++) for (let dx = 0; dx < factor; dx++) {
      const j = (y * factor + dy) * image.width + x * factor + dx;
      if (image.reject?.(j)) withheld[y * width + x] = 1;
      sum += image.values[j];
    }
    values[y * width + x] = sum / (factor * factor);
  }
  const shrink = (base: TurnableCaster): TurnableCaster => ({
    positionMeters: base.positionMeters, sunDirection: base.sunDirection,
    ray: (x, y) => base.ray((x + 0.5) * factor - 0.5, (y + 0.5) * factor - 0.5),
    project: point => { const p = base.project(point); return p ? [(p[0] + 0.5) / factor - 0.5, (p[1] + 0.5) / factor - 0.5, ...p.slice(2)] : null; },
    turned: degrees => shrink(base.turned(degrees)) });
  return { image: { width, height, values, reject: i => withheld[i] ? 'reduced-block-withheld' : null }, caster: shrink(caster) };
}

/** The reduction factor that brings a photograph's lit area under a ray budget. */
export function reductionFor(image: RegistrationImage, lowFraction: number, maximumPixels: number) {
  const low = peakValue(image) * lowFraction;
  let lit = 0;
  for (let i = 0; i < image.values.length; i++) if (image.values[i] > low && !image.reject?.(i)) lit++;
  return Math.max(1, Math.ceil(Math.sqrt(lit / maximumPixels)));
}

export interface SweepOptions {
  /** Pixels below this fraction of the frame's peak are sky. */
  lowFraction?: number;
  /** Pixels within this many of the disc edge are left out of the comparison. */
  insetPixels?: number;
  /** The local-mean radius removed from both images before comparing. */
  highpassRadius?: number;
  /** Coarse sweep step, in degrees, over the whole turn. */
  coarseStep?: number;
  /** Half-width, in degrees, of the exact search about each candidate; zero skips it. */
  exactHalfWidth?: number;
  /** How the prediction is lit; `face` unless the reference is itself a photograph. */
  shading?: Shading;
  /** The most lit pixels a frame is judged at; a larger frame is reduced by a whole factor first. */
  maximumPixels?: number;
}
const DEFAULTS = { lowFraction: 0.2, insetPixels: 5, highpassRadius: 6, coarseStep: 3, exactHalfWidth: 8, maximumPixels: 16_384 } as const;

/** A frame reduced to the ray budget and cast once: what every sweep reads. */
export interface PreparedFrame { image: RegistrationImage; caster: TurnableCaster; cast: Cast; reduction: number; observed: Float64Array }

export function prepareFrame(source: RegistrationImage | CameraImage, camera: TurnableCaster, mesh: RayMesh, options: SweepOptions = {}): PreparedFrame {
  const { lowFraction, insetPixels, highpassRadius, maximumPixels } = { ...DEFAULTS, ...options };
  const full = registrationImage(source), reduction = reductionFor(full, lowFraction, maximumPixels);
  const { image, caster } = reduced(full, camera, reduction);
  const cast = castFrame(image, caster, mesh, { lowFraction, insetPixels });
  return { image, caster, cast, reduction, observed: highpass(image.values, image.width, image.height, cast.lit, cast.inner, highpassRadius) };
}

export interface SweepPeak { offsetDegrees: number; correlation: number }
export interface RegistrationResult {
  /** Interior disc pixels compared, at the reduction the ray budget imposed. */
  discPixels: number;
  /** The reduction factor applied to the photograph before comparing; one means none. */
  reduction: number;
  /** Correlation with the reference as the camera stands. */
  atZero: number;
  /** The best turn about the pole, from a coarse sweep that samples the reference at shifted longitudes over fixed geometry. */
  coarse: SweepPeak;
  /** The best turn with the rays cast again, searched about the coarse peak and about zero and refined through the peak. */
  exact: SweepPeak;
  /** The best the reference can do with its longitudes reversed, and with its latitudes reversed: what a handedness error would score. */
  mirrorLongitude: SweepPeak;
  mirrorLatitude: SweepPeak;
  /** The exact peak over the better mirror; below one, the frame cannot tell the camera from its mirror. */
  mirrorMargin: number;
  /** The exact peak less the better mirror: the same test as a difference, which a near-perfect match makes the fairer one. */
  mirrorGap: number;
}

/** The prediction of a cast from a reference, less its smooth part, and its correlation with the prepared frame. */
function score(frame: PreparedFrame, cast: Cast, reference: SurfaceReference, shading: Shading, offset: number, mirrorLongitude: boolean, mirrorLatitude: boolean, highpassRadius: number) {
  const { width, height } = frame.image, lambert = shading === 'face' ? cast.faceLambert : cast.radialLambert;
  const raw = new Float64Array(width * height), known = new Uint8Array(width * height);
  for (let i = 0; i < raw.length; i++) if (cast.lit[i]) {
    const value = reference.sample((mirrorLongitude ? -cast.longitude[i] : cast.longitude[i]) + offset, mirrorLatitude ? -cast.latitude[i] : cast.latitude[i]);
    if (value === null) continue;
    raw[i] = value * lambert[i]; known[i] = 1;
  }
  const compared = cast.inner.filter(i => known[i]);
  return correlation(frame.observed, highpass(raw, width, height, known, compared, highpassRadius), compared);
}

/**
 * The peak of a score about a centre: samples a degree apart across the window, then a parabola through the best
 * three and one sample at its vertex, twice, the second time half a degree either side. The peak can be a degree wide
 * on a frame whose markings are fine, so the sampling is not coarser than that.
 */
function refinedPeak(scoreAt: (turn: number) => number, centre: number, halfWidth: number): SweepPeak {
  const seen = new Map<number, number>(), at = (turn: number) => { const key = Math.round(turn * 4) / 4; let r = seen.get(key); if (r === undefined) { r = scoreAt(key); seen.set(key, r); } return r; };
  const best = () => { let peak: SweepPeak = { offsetDegrees: NaN, correlation: -2 }; for (const [turn, r] of seen) if (r > peak.correlation) peak = { offsetDegrees: turn, correlation: r }; return peak; };
  for (let turn = centre - halfWidth; turn <= centre + halfWidth; turn += 1) at(turn);
  for (const step of [1, 0.5]) {
    const top = best(), left = at(top.offsetDegrees - step), right = at(top.offsetDegrees + step);
    at(parabolaPeak(top.offsetDegrees - step, step, left, top.correlation, right));
  }
  return best();
}

/** The vertex of the parabola through three equally spaced samples, held within the outer two. */
function parabolaPeak(x0: number, step: number, y0: number, y1: number, y2: number) {
  const denominator = y0 - 2 * y1 + y2;
  if (!(Math.abs(denominator) > 1e-12)) return x0 + step;
  return x0 + step * Math.max(0, Math.min(2, 1 + 0.5 * (y0 - y2) / denominator));
}

/**
 * Judge the camera by turning the body under a photograph. The reference is sampled where the mesh puts each lit
 * pixel; the prediction is that value times the Lambert factor there; both images lose their smooth part before
 * correlating over the disc interior. The coarse sweep shifts the reference longitudes over the one cast; the exact
 * search recasts the rays with the body turned, about the coarse peak and about zero, three casts each and a parabola
 * through the best, then one cast at its vertex.
 *
 * A turn about the pole and a shift of the disc centre move the markings alike near the disc centre, so the offset
 * this measures is only as certain as the camera's centre: one pixel of centre is about one pixel's worth of
 * longitude at the disc centre.
 */
export function registrationSweep(source: RegistrationImage | CameraImage | PreparedFrame, camera: TurnableCaster | RayMesh, meshOrReference: RayMesh | SurfaceReference, referenceOrOptions?: SurfaceReference | SweepOptions, maybeOptions: SweepOptions = {}): RegistrationResult {
  // Two call shapes: (image, caster, mesh, reference, options) and (prepared, mesh, reference, options).
  const prepared = 'cast' in source;
  const mesh = (prepared ? camera : meshOrReference) as RayMesh, reference = (prepared ? meshOrReference : referenceOrOptions) as SurfaceReference;
  const options = { ...DEFAULTS, shading: 'face' as Shading, ...((prepared ? referenceOrOptions : maybeOptions) as SweepOptions) };
  const { coarseStep, exactHalfWidth, shading, highpassRadius } = options;
  if (!(coarseStep > 0) || !Number.isInteger(360 / coarseStep)) throw new TypeError('The coarse step must divide 360 degrees.');
  const frame = prepared ? source as PreparedFrame : prepareFrame(source as RegistrationImage | CameraImage, camera as TurnableCaster, mesh, options);
  if (frame.cast.inner.length < 64) throw new Error('The frame shows too little disc interior to register.');
  const at = (offset: number, mirrorLongitude = false, mirrorLatitude = false) => score(frame, frame.cast, reference, shading, offset, mirrorLongitude, mirrorLatitude, highpassRadius);
  const sweep = (mirrorLongitude: boolean, mirrorLatitude: boolean): SweepPeak => {
    let best: SweepPeak = { offsetDegrees: 0, correlation: -2 };
    for (let offset = -180; offset < 180; offset += coarseStep) { const r = at(offset, mirrorLongitude, mirrorLatitude); if (r > best.correlation) best = { offsetDegrees: offset, correlation: r }; }
    return best;
  };
  const coarse = sweep(false, false), mirrorLongitude = sweep(true, false), mirrorLatitude = sweep(false, true), atZero = at(0);
  // Sampling the reference at a shifted longitude equals turning the body the other way; the exact search turns the body.
  let exact: SweepPeak = { offsetDegrees: -coarse.offsetDegrees, correlation: coarse.correlation };
  if (exactHalfWidth > 0) {
    const turnedScore = (turn: number) => {
      const cast = castFrame(frame.image, frame.caster.turned(turn), mesh, options);
      return score(frame, cast, reference, shading, 0, false, false, highpassRadius);
    };
    exact = { offsetDegrees: NaN, correlation: -2 };
    const centres = Math.abs(coarse.offsetDegrees) > exactHalfWidth ? [-coarse.offsetDegrees, 0] : [-coarse.offsetDegrees];
    for (const centre of centres) {
      const peak = refinedPeak(turn => turn === 0 ? atZero : turnedScore(turn), centre, exactHalfWidth);
      if (peak.correlation > exact.correlation) exact = peak;
    }
  }
  const mirror = Math.max(mirrorLongitude.correlation, mirrorLatitude.correlation);
  return { discPixels: frame.cast.inner.length, reduction: frame.reduction, atZero, coarse, exact, mirrorLongitude, mirrorLatitude, mirrorMargin: mirror > 0 ? exact.correlation / mirror : Infinity, mirrorGap: exact.correlation - mirror };
}

export interface ReliefResult { discPixels: number; reduction: number; atZero: number; exact: SweepPeak; /** The mean correlation at the edges of the search, what a turn the size of the window scores. */ edge: number; prominence: number }

/**
 * The body's own relief as the reference: a uniform surface lit by the mesh's face normals predicts the frame with no
 * map and no other frame. Shifting a uniform reference changes nothing, so there is no coarse sweep and no mirror;
 * the turn is searched by recasting, and the peak is judged against what the edges of the window score.
 */
export function reliefSweep(frame: PreparedFrame, mesh: RayMesh, options: SweepOptions = {}): ReliefResult {
  const { exactHalfWidth, highpassRadius } = { ...DEFAULTS, ...options }, uniform: SurfaceReference = { sample: () => 1 };
  if (frame.cast.inner.length < 64) throw new Error('The frame shows too little disc interior to register.');
  const turnedScore = (turn: number) => score(frame, turn === 0 ? frame.cast : castFrame(frame.image, frame.caster.turned(turn), mesh, options), uniform, 'face', 0, false, false, highpassRadius);
  const exact = refinedPeak(turnedScore, 0, exactHalfWidth), atZero = turnedScore(0);
  const edge = (turnedScore(-exactHalfWidth) + turnedScore(exactHalfWidth)) / 2;
  return { discPixels: frame.cast.inner.length, reduction: frame.reduction, atZero, exact, edge, prominence: exact.correlation - edge };
}

/**
 * A surface reference from prepared frames: each lit pixel's brightness, divided by the Lambert factor of the face
 * under it, averaged into longitude and latitude bins. Built from casts already made, so a leave-one-out reference
 * costs no new rays. Held against a frame it does not contain, it tests the pole, the period and the handedness; a
 * constant phase error moves every frame together and is invisible to it.
 */
export function framesReference(frames: readonly PreparedFrame[], { binsPerDegree = 1, minimumLambert = 0.2, fillPasses = 2 } = {}): SurfaceReference {
  const columns = Math.round(360 * binsPerDegree), rows = Math.round(180 * binsPerDegree);
  const sum = new Float64Array(columns * rows), count = new Uint32Array(columns * rows);
  for (const { image, cast } of frames) {
    for (let i = 0; i < cast.lit.length; i++) {
      if (!cast.lit[i] || cast.faceLambert[i] < minimumLambert) continue;
      const column = Math.floor((((cast.longitude[i] % 360) + 360) % 360) * binsPerDegree) % columns, row = Math.min(rows - 1, Math.floor((cast.latitude[i] + 90) * binsPerDegree));
      sum[row * columns + column] += image.values[i] / cast.faceLambert[i]; count[row * columns + column]++;
    }
  }
  // A frame's pixels are sparser than the bins toward the limb and at any distance; bins no pixel reached take the
  // mean of their filled neighbours, a few times over, so the reference has no holes inside its coverage.
  const value = new Float64Array(columns * rows), filled = new Uint8Array(columns * rows);
  for (let i = 0; i < value.length; i++) if (count[i]) { value[i] = sum[i] / count[i]; filled[i] = 1; }
  for (let pass = 0; pass < fillPasses; pass++) {
    const next = value.slice(), nextFilled = filled.slice();
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      const i = row * columns + column;
      if (filled[i]) continue;
      let total = 0, n = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const r = row + dr; if (r < 0 || r >= rows) continue;
        const j = r * columns + (column + dc + columns) % columns;
        if (filled[j]) { total += value[j]; n++; }
      }
      if (n) { next[i] = total / n; nextFilled[i] = 1; }
    }
    value.set(next); filled.set(nextFilled);
  }
  return { sample(eastLongitudeDegrees, latitudeDegrees) {
    const column = Math.floor((((eastLongitudeDegrees % 360) + 360) % 360) * binsPerDegree) % columns, row = Math.min(rows - 1, Math.max(0, Math.floor((latitudeDegrees + 90) * binsPerDegree)));
    const i = row * columns + column;
    return filled[i] ? value[i] : null;
  } };
}
