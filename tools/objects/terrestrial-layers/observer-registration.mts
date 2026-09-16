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
import { requireFiniteNumber } from '../../source-values.mts';
import { rotate } from '../../spice/frames.mts';
import { multiply } from '../../spice/ck.mts';
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

export interface LimbCentre { center: [number, number]; iterations: number; movedPixels: number; limbBins: number }

/**
 * The disc centre from the limb. The brightness centroid sits toward the lit limb at any phase angle, so the mesh's
 * projected outline is aligned to the photograph's outline instead: the least-squares first harmonic of the radial
 * residual between them, over every direction, is the centre error, and a few iterations remove it. The edge is a
 * stated fraction of the frame's peak. Using every direction lets a symmetric error in the mesh outline cancel; the
 * price is the terminator side, which at phase angle α ends up to R(1 − cos α) inside the limb. For a main-belt body
 * seen from Earth α is under 25 degrees, and the bias is a fraction of a pixel on a deconvolved frame.
 */
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
  let moved = 0, done = 0, limbBins = 0;
  for (let iteration = 0; iteration < iterations; iteration++) {
    const camera = controlledShapeCamera(observerCamera({ ...sighting, center: [cx, cy] }, orientation));
    const model = new Float64Array(bins);
    for (const position of positions) {
      const projected = camera.project(position);
      if (!projected) continue;
      const bin = ((Math.round(Math.atan2(projected[1] - cy, projected[0] - cx) / (2 * Math.PI) * bins) % bins) + bins) % bins, distance = Math.hypot(projected[0] - cx, projected[1] - cy);
      if (distance > model[bin]) model[bin] = distance;
    }
    const observed = outline(width, height, lit, cx, cy, bins);
    let scc = 0, scs = 0, sss = 0, rc = 0, rs = 0; limbBins = 0;
    for (let bin = 0; bin < bins; bin++) {
      if (!(model[bin] > 0) || !(observed[bin] > 0)) continue;
      const theta = bin * 2 * Math.PI / bins, residual = observed[bin] - model[bin], c = Math.cos(theta), s = Math.sin(theta);
      scc += c * c; scs += c * s; sss += s * s; rc += residual * c; rs += residual * s; limbBins++;
    }
    const determinant = scc * sss - scs * scs;
    if (limbBins < bins / 2 || !(Math.abs(determinant) > 1e-9)) throw new Error('The frame shows too little limb to place a centre on.');
    const dx = (rc * sss - rs * scs) / determinant, dy = (rs * scc - rc * scs) / determinant;
    cx += dx; cy += dy; moved = Math.hypot(dx, dy); done = iteration + 1;
    if (moved < 0.05) break;
  }
  return { center: [cx, cy], iterations: done, movedPixels: moved, limbBins };
}

interface Cast { width: number; height: number; lit: Uint8Array; longitude: Float64Array; latitude: Float64Array; lambert: Float64Array; inner: number[] }

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

/** Cast the frame onto the mesh: the body-fixed point and the Lambert factor under every lit pixel, and the disc interior. */
function cast(image: RegistrationImage, caster: Caster, mesh: RayMesh, lowFraction: number, inset: number, shading: Shading): Cast {
  const { width, height, values } = image, count = width * height;
  const sun = caster.sunDirection, eye = Array.from(caster.positionMeters);
  const low = peakValue(image) * lowFraction;
  const lit = new Uint8Array(count), longitude = new Float64Array(count), latitude = new Float64Array(count), lambert = new Float64Array(count);
  const normals = new Map<number, number[]>();
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x;
    if (!(values[i] > low) || image.reject?.(i)) continue;
    const direction = Array.from(caster.ray(x, y)), hit = mesh.intersect(eye, direction);
    if (!hit) continue;
    const p = [0, 1, 2].map(k => eye[k] + direction[k] * hit.radius), r = Math.hypot(p[0], p[1], p[2]);
    let normal = shading === 'radial' ? [p[0] / r, p[1] / r, p[2] / r] : normals.get(hit.faceId);
    if (!normal) { normal = faceNormal(mesh, hit.faceId); normals.set(hit.faceId, normal); }
    lit[i] = 1; longitude[i] = Math.atan2(p[1], p[0]) / DEGREE; latitude[i] = Math.asin(p[2] / r) / DEGREE;
    lambert[i] = Math.max(0, normal[0] * sun[0] + normal[1] * sun[1] + normal[2] * sun[2]);
  }
  const inner: number[] = [];
  for (let y = inset; y < height - inset; y++) for (let x = inset; x < width - inset; x++) {
    let whole = true;
    for (let dy = -inset; dy <= inset && whole; dy++) for (let dx = -inset; dx <= inset; dx++) if (!lit[(y + dy) * width + x + dx]) { whole = false; break; }
    if (whole) inner.push(y * width + x);
  }
  return { width, height, lit, longitude, latitude, lambert, inner };
}

/** The frame less its local mean over the lit disc: the smooth illumination and the deconvolution's plateau go, the markings stay. */
function highpass(values: ArrayLike<number>, { width, lit, inner }: Cast, radius: number) {
  const out = new Float64Array(values.length);
  for (const i of inner) {
    const y = Math.floor(i / width), x = i % width;
    let sum = 0, count = 0;
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) { const j = (y + dy) * width + x + dx; if (lit[j]) { sum += values[j]; count++; } }
    out[i] = values[i] - sum / count;
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
  /** The best turn with the rays cast again for each trial, honouring the shape; searched around the coarse peak. */
  exact: SweepPeak;
  /** The best the reference can do with its longitudes reversed, and with its latitudes reversed: what a handedness error would score. */
  mirrorLongitude: SweepPeak;
  mirrorLatitude: SweepPeak;
  /** The exact peak over the better mirror; below one, the frame cannot tell the camera from its mirror. */
  mirrorMargin: number;
  /** The exact peak less the better mirror: the same test as a difference, which a near-perfect match makes the fairer one. */
  mirrorGap: number;
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
  /** Half-width, in degrees, of the exact search about the coarse peak; zero skips it. */
  exactHalfWidth?: number;
  /** How the prediction is lit; `face` unless the reference is itself a photograph. */
  shading?: Shading;
  /** The most lit pixels a frame is judged at; a larger frame is reduced by a whole factor first. */
  maximumPixels?: number;
}

/**
 * Judge the camera by turning the body under a photograph. The reference is sampled where the mesh puts each lit
 * pixel; the prediction is that value times the Lambert factor there; both images lose their smooth part before
 * correlating over the disc interior. The coarse sweep shifts the reference longitudes over one ray cast; the exact
 * search recasts the rays with the body turned, so the shape's asymmetry is honoured near the peak.
 *
 * A turn about the pole and a shift of the disc centre move the markings alike near the disc centre, so the offset
 * this measures is only as certain as the camera's centre: one pixel of centre is about one pixel's worth of
 * longitude at the disc centre.
 */
export function registrationSweep(source: RegistrationImage | CameraImage, camera: TurnableCaster, mesh: RayMesh, reference: SurfaceReference,
    { lowFraction = 0.2, insetPixels = 5, highpassRadius = 6, coarseStep = 3, exactHalfWidth = 8, shading = 'face', maximumPixels = 65_536 }: SweepOptions = {}): RegistrationResult {
  if (!(coarseStep > 0) || !Number.isInteger(360 / coarseStep)) throw new TypeError('The coarse step must divide 360 degrees.');
  const full = registrationImage(source);
  const reduction = reductionFor(full, lowFraction, maximumPixels);
  const { image, caster } = reduced(full, camera, reduction);
  const frame = cast(image, caster, mesh, lowFraction, insetPixels, shading);
  if (frame.inner.length < 64) throw new Error('The frame shows too little disc interior to register.');
  const observed = highpass(image.values, frame, highpassRadius);
  // Pixels the reference says nothing about are left out of the comparison rather than predicted dark.
  const predictFrom = (longitude: Float64Array, latitude: Float64Array, lambert: Float64Array, offset: number, mirrorLongitude: boolean, mirrorLatitude: boolean) => {
    const raw = new Float64Array(observed.length), known = new Uint8Array(observed.length);
    for (let i = 0; i < raw.length; i++) if (frame.lit[i]) {
      const value = reference.sample((mirrorLongitude ? -longitude[i] : longitude[i]) + offset, mirrorLatitude ? -latitude[i] : latitude[i]);
      if (value === null) continue;
      raw[i] = value * lambert[i]; known[i] = 1;
    }
    const compared = frame.inner.filter(i => known[i]);
    return correlation(observed, highpass(raw, { ...frame, lit: known, inner: compared }, highpassRadius), compared);
  };
  const sweep = (mirrorLongitude: boolean, mirrorLatitude: boolean): SweepPeak => {
    let best: SweepPeak = { offsetDegrees: 0, correlation: -2 };
    for (let offset = -180; offset < 180; offset += coarseStep) {
      const r = predictFrom(frame.longitude, frame.latitude, frame.lambert, offset, mirrorLongitude, mirrorLatitude);
      if (r > best.correlation) best = { offsetDegrees: offset, correlation: r };
    }
    return best;
  };
  const coarse = sweep(false, false), mirrorLongitude = sweep(true, false), mirrorLatitude = sweep(false, true);
  const atZero = predictFrom(frame.longitude, frame.latitude, frame.lambert, 0, false, false);
  // Sampling the reference at a shifted longitude equals turning the body the other way; the exact search turns the body.
  // The coarse sweep holds the geometry fixed, which an elongated body or a partly covered reference can mislead, so the
  // exact search looks about the coarse peak and about zero and keeps the better: the question is whether the camera
  // registers, and a gross error still shows as a coarse peak far from zero that the exact search confirms.
  let exact: SweepPeak = { offsetDegrees: -coarse.offsetDegrees, correlation: coarse.correlation };
  if (exactHalfWidth > 0) {
    const score = (turn: number) => {
      const turned = cast(image, caster.turned(turn), mesh, lowFraction, insetPixels, shading);
      return predictFrom(turned.longitude, turned.latitude, turned.lambert, 0, false, false);
    };
    exact = { offsetDegrees: NaN, correlation: -2 };
    const centres = Math.abs(coarse.offsetDegrees) > exactHalfWidth ? [-coarse.offsetDegrees, 0] : [-coarse.offsetDegrees];
    for (const centre of centres) for (let turn = centre - exactHalfWidth; turn <= centre + exactHalfWidth; turn += 1) { const r = score(turn); if (r > exact.correlation) exact = { offsetDegrees: turn, correlation: r }; }
    const around = exact.offsetDegrees;
    for (let turn = around - 0.75; turn <= around + 0.75; turn += 0.25) { const r = score(turn); if (r > exact.correlation) exact = { offsetDegrees: turn, correlation: r }; }
  }
  const mirror = Math.max(mirrorLongitude.correlation, mirrorLatitude.correlation);
  return { discPixels: frame.inner.length, reduction, atZero, coarse, exact, mirrorLongitude, mirrorLatitude, mirrorMargin: mirror > 0 ? exact.correlation / mirror : Infinity, mirrorGap: exact.correlation - mirror };
}

export interface ReferenceFrame { image: RegistrationImage | CameraImage; camera: Caster }

/**
 * A surface reference from the body's own frames: each lit pixel's brightness, divided by the Lambert factor of the
 * face under it, averaged into longitude and latitude bins. Held against a frame it does not contain, it tests the
 * pole, the period and the handedness; a constant phase error moves every frame together and is invisible to it.
 */
export function framesReference(frames: readonly ReferenceFrame[], mesh: RayMesh, { binsPerDegree = 1, lowFraction = 0.2, minimumLambert = 0.2, fillPasses = 2, maximumPixels = 65_536 } = {}): SurfaceReference {
  const columns = Math.round(360 * binsPerDegree), rows = Math.round(180 * binsPerDegree);
  const sum = new Float64Array(columns * rows), count = new Uint32Array(columns * rows);
  for (const entry of frames) {
    const full = registrationImage(entry.image);
    const turnable: TurnableCaster = { ...entry.camera, turned: () => { throw new Error('A reference frame is never turned.'); } };
    const { image, caster } = reduced(full, turnable, reductionFor(full, lowFraction, maximumPixels));
    const frame = cast(image, caster, mesh, lowFraction, 0, 'face');
    for (let i = 0; i < frame.lit.length; i++) {
      if (!frame.lit[i] || frame.lambert[i] < minimumLambert) continue;
      const column = Math.floor((((frame.longitude[i] % 360) + 360) % 360) * binsPerDegree) % columns, row = Math.min(rows - 1, Math.floor((frame.latitude[i] + 90) * binsPerDegree));
      sum[row * columns + column] += image.values[i] / frame.lambert[i]; count[row * columns + column]++;
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
