/** A published RGB figure projected approximately onto a pinned mesh. This format never claims calibrated registration. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import type { ObservationFrame, ObservationImage, PixelGeometry, SurfaceObservationFormat } from '../contract.mts';
import type { SourceMesh } from '../../terrestrial-layers/contracts.mts';
import { array, number, shape, text, parseSurfaceGeometry } from '../../terrestrial-layers/source-records.mts';
import { requireArray, requireRecord } from '../../../source-values.mts';
import { checkKeys, parseDisplay, validateEnvelope, validateTransfer } from '../recipe.mts';
import { sampleFootprint } from '../footprint.mts';
import { qualifiedFace } from '../geometry.mts';
import { dot, interpolatedNormals, polygonInteriorDistance } from '../orthographic-patch.mts';

const CONTEXT = 'published image projection';
const parseProjection = shape({
  status: text, method: text, limitations: text, shapeSha256: text, imageSha256: text,
  imageSize: array(number), crop: shape({ left: number, top: number, width: number, height: number }),
  camera: shape({ right: array(number), up: array(number), eye: array(number), pixelsPerMeter: number, center: array(number) }),
  mask: shape({ polygon: array(array(number)), insetPixels: number }),
});
const parseLens = shape({ id: text, format: text, consumer: text, metadata: shape({ label: text, coverage: text }),
  frames: array(shape({ id: text, path: text, projection: parseProjection })),
  transfer: shape({ maximumSourceDistanceMeters: number, maximumSeparationFootprints: number, visibilityToleranceMeters: number, maximumEmissionDegrees: number }),
  display: parseDisplay,
});
type Projection = ReturnType<typeof parseProjection>;
type Transfer = ReturnType<typeof parseLens>['transfer'];
const vector = (v: readonly number[], size: number) => v.length === size && v.every(Number.isFinite);
const integer = (v: number) => Number.isSafeInteger(v) && v >= 0;

function validateProjection(p: Projection) {
  const { camera: c, crop, mask } = p;
  const axes = [c.right, c.up, c.eye];
  if (p.status !== 'approximate' || !p.method || !p.limitations || !/^[a-f0-9]{64}$/.test(p.shapeSha256) || !/^[a-f0-9]{64}$/.test(p.imageSha256) ||
      !vector(p.imageSize, 2) || !p.imageSize.every(n => integer(n) && n > 0) ||
      !Object.values(crop).every(integer) || crop.width < 2 || crop.height < 2 || crop.left + crop.width > p.imageSize[0] || crop.top + crop.height > p.imageSize[1] ||
      !axes.every(axis => vector(axis, 3) && Math.abs(Math.hypot(...axis) - 1) < 1e-8) ||
      Math.abs(dot(c.right, c.up)) > 1e-8 || Math.abs(dot(c.right, c.eye)) > 1e-8 || Math.abs(dot(c.up, c.eye)) > 1e-8 ||
      !Number.isFinite(c.pixelsPerMeter) || c.pixelsPerMeter <= 0 || !vector(c.center, 2) ||
      !Number.isFinite(mask.insetPixels) || mask.insetPixels <= 0 || mask.polygon.length < 3 ||
      mask.polygon.some(point => !vector(point, 2) || point[0] < 0 || point[0] >= crop.width || point[1] < 0 || point[1] >= crop.height)) {
    throw new TypeError('Invalid approximate image projection.');
  }
}

function validate(value: unknown, sourceGeometry: unknown) {
  checkKeys(value, ['id', 'format', 'consumer', 'metadata', 'frames', 'transfer', 'display'], [], CONTEXT);
  for (const frame of requireArray(requireRecord(value).frames)) {
    checkKeys(frame, ['id', 'path', 'projection'], [], `${CONTEXT} frame`);
    const projection = requireRecord(frame).projection;
    checkKeys(projection, ['status', 'method', 'limitations', 'shapeSha256', 'imageSha256', 'imageSize', 'crop', 'camera', 'mask'], [], CONTEXT);
    const p = requireRecord(projection);
    checkKeys(p.camera, ['right', 'up', 'eye', 'pixelsPerMeter', 'center'], [], `${CONTEXT} camera`);
    checkKeys(p.crop, ['left', 'top', 'width', 'height'], [], `${CONTEXT} crop`);
    checkKeys(p.mask, ['polygon', 'insetPixels'], [], `${CONTEXT} mask`);
  }
  const recipe = parseLens(value);
  validateEnvelope(recipe, recipe.frames.map(frame => frame.path), { selections: [], displays: ['displayRange'], maximumFrames: 1, maximumLevelGain: 1, samplesPerTriangle: 'optional' }, CONTEXT);
  validateTransfer(recipe.transfer, parseSurfaceGeometry(sourceGeometry), CONTEXT);
  if (recipe.format !== 'published-image-projection' || recipe.display.displayRange?.[0] !== 0 || recipe.display.displayRange?.[1] !== 255) throw new TypeError('Published RGB must retain its display range.');
  recipe.frames.forEach(frame => validateProjection(frame.projection));
}

/** Ray casting only bounds the transfer for this assumed projection; it does not establish where the photograph belongs. */
export function publishedImageFrame(id: string, p: Projection, rgb: Uint8Array, mesh: SourceMesh, limits: Transfer): ObservationFrame {
  validateProjection(p);
  const { width, height } = p.crop, { right, up, eye, center, pixelsPerMeter: scale } = p.camera;
  if (rgb.length !== width * height * 3) throw new Error('Published crop dimensions disagree.');
  const normalAt = interpolatedNormals(mesh), count = width * height;
  const points = new Float64Array(count * 3).fill(NaN), emissions = new Float64Array(count).fill(NaN);
  const valid = new Uint8Array(count), values = new Float64Array(count), colorValues = [new Float64Array(count), new Float64Array(count), new Float64Array(count)];
  // This plane merely starts parallel numerical rays outside the model. It is not a spacecraft range.
  const rayStartMeters = Math.max(1, ...mesh.bounds.flat().map(Math.abs)) * 10;
  const towardSurface = eye.map(n => -n), rejectedPixels: Record<string, number> = {};
  let acceptedPixels = 0;
  const reject = (reason: string) => { rejectedPixels[reason] = (rejectedPixels[reason] ?? 0) + 1; };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x;
    for (let channel = 0; channel < 3; channel++) colorValues[channel][i] = rgb[i * 3 + channel];
    values[i] = (rgb[i * 3] + rgb[i * 3 + 1] + rgb[i * 3 + 2]) / 3;
    if (polygonInteriorDistance([x, y], p.mask.polygon) < p.mask.insetPixels) { reject('outside-mask'); continue; }
    const origin = eye.map((n, k) => n * rayStartMeters + right[k] * (x - center[0]) / scale + up[k] * (center[1] - y) / scale);
    const hit = mesh.intersect(origin, towardSurface);
    if (!hit) { reject('no-surface'); continue; }
    const point = origin.map((n, k) => n - eye[k] * hit.radius);
    if (!qualifiedFace(mesh, hit.faceId)) { reject('unconstrained-source-shape'); continue; }
    const emission = Math.acos(Math.max(-1, Math.min(1, dot(normalAt(point, hit.faceId), eye))));
    if (!Number.isFinite(emission) || emission > limits.maximumEmissionDegrees * Math.PI / 180) { reject('grazing'); continue; }
    points.set(point, i * 3); emissions[i] = emission; valid[i] = 1; acceptedPixels++;
  }
  if (!acceptedPixels) throw new Error('Approximate projection contains no accepted pixels.');
  const project = (point: readonly number[]) => [center[0] + scale * dot(point, right), center[1] - scale * dot(point, up), rayStartMeters - dot(point, eye)];
  const image: ObservationImage = { width, height, values, colorValues, reject: i => valid[i] ? null : 'mask-or-geometry', startTime: '', filter: '',
    report: { source: 'Published RGB figure; native detector and quality flags unavailable.' } };
  const geometry: PixelGeometry = { source: 'source-mesh-rays', reject: image.reject,
    distanceMeters: (i, point) => Math.hypot(points[i*3]-point[0], points[i*3+1]-point[1], points[i*3+2]-point[2]),
    rangeMeters: () => NaN, incidence: () => NaN, emission: i => emissions[i], phase: () => undefined,
    report: { source: 'source-mesh-rays', interpretation: 'Geometry under the assumed orthographic projection; no measured camera range or Sun direction.' } };
  const diagonal = (i: number) => Math.sqrt(1 + 1 / Math.cos(emissions[i]) ** 2) / scale;
  const footprint = { pixelAngleMicroradians: NaN, nadirMedianMeters: 1 / scale, nadirMinimumMeters: 1 / scale, sampledPixels: acceptedPixels };
  return { id, startTime: '', filter: '', positionKm: null, viewingDirection: eye, cameraKind: 'approximate-orthographic', geometrySource: geometry.source, footprint,
    sample(point, allowance = 0) {
      const [x, y] = project(point);
      if (polygonInteriorDistance([x, y], p.mask.polygon) < Math.max(0, p.mask.insetPixels - allowance * scale - 2)) return { reason: 'outside-mask' };
      const sample = sampleFootprint({ image, camera: { project }, geometry, photometry: { gain: () => 1 } }, point,
        { maximumEmissionDegrees: limits.maximumEmissionDegrees, maximumSeparationMeters: ids => allowance + limits.maximumSeparationFootprints * Math.max(...ids.map(diagonal)) });
      if (sample.reason !== undefined) return sample;
      // Apply each contributor's own footprint, rather than letting the most grazing contributor enlarge all four allowances.
      const ix = Math.floor(x), iy = Math.floor(y), ids = [iy*width+ix, iy*width+ix+1, (iy+1)*width+ix, (iy+1)*width+ix+1];
      if (ids.some(i => geometry.distanceMeters(i, point) > allowance + limits.maximumSeparationFootprints * diagonal(i))) return { reason: 'geometry-mismatch' };
      return sample;
    },
    visible(point) {
      const hit = mesh.intersect(point.map((n, k) => n + eye[k] * rayStartMeters), towardSurface, rayStartMeters + limits.visibilityToleranceMeters);
      return !!hit && Math.abs(hit.radius - rayStartMeters) <= limits.visibilityToleranceMeters;
    },
    report: { id, registration: { status: 'approximate', qualified: false, method: p.method, limitations: p.limitations },
      camera: { kind: 'approximate-orthographic', positionKm: null, ...p.camera }, crop: p.crop, mask: p.mask,
      pixels: { acceptedPixels, rejectedPixels }, geometry: geometry.report, footprint,
      footprintInterpretation: 'Size of an enlarged figure pixel under the assumed projection; not native detector resolution or registration accuracy.' },
  };
}

export const publishedImageFormat: SurfaceObservationFormat = {
  validate,
  paths: value => parseLens(value).frames.map(frame => frame.path),
  async load(value, { sourceDirectory, source, radial, config, entries }) {
    const recipe = parseLens(value), f = recipe.frames[0], p = f.projection;
    const shapeEntry = await source.validatePath(config.geometry.radialTerrain.path);
    if (shapeEntry.expectedSha256 !== p.shapeSha256 || entries.find(entry => entry.path === f.path)?.expectedSha256 !== p.imageSha256) throw new Error('Approximate projection belongs to different source bytes.');
    const bytes = await readFile(resolve(sourceDirectory, f.path)), metadata = await sharp(bytes).metadata();
    if (metadata.width !== p.imageSize[0] || metadata.height !== p.imageSize[1]) throw new Error('Published figure dimensions changed.');
    const { data, info } = await sharp(bytes).extract(p.crop).toColourspace('srgb').removeAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.channels !== 3) throw new Error('Published photograph must decode to RGB.');
    const frame = publishedImageFrame(f.id, p, data, radial.grid, recipe.transfer);
    return { frames: [frame], exceeded: [], policy: { format: recipe.format, maximumSourceDistanceMeters: recipe.transfer.maximumSourceDistanceMeters,
      precheckDisplayPoint: true, selection: 'single', samplesPerTriangle: 64,
      display: { range: 'authored', low: 0, high: 255, units: 'Published image RGB levels',
        colorDisplay: { kind: 'provider-rgb', interpolation: 'encoded', interpretation: 'Published colors and illumination retained; neither calibrated reflectance nor reconstructed natural color.' } },
      photometry: { model: 'retained-observation', maximumGain: 1 },
      limits: { ...recipe.transfer, derived: { maximumSourceDistanceMeters: config.geometry.radialTerrain.simplification.maximumErrorMeters,
        maximumSeparationFootprints: 4, projectedFigurePixelMeters: 1 / p.camera.pixelsPerMeter },
        interpretation: 'Transfer bounds on the assumed projection. They do not measure absolute image-to-shape alignment.' },
      limitations: p.limitations } };
  },
};
