/**
 * JunoCam calibrated images (PDS3 RDR products of the Juno mission).
 *
 * JunoCam is a push-frame camera on a spinning spacecraft. One image is a stack of framelets, each 1648 x 128 pixels,
 * read through the detector's fixed filter strips one frame after another while the spin carries the scene across
 * them. Every framelet has its own epoch, so its own spacecraft position and pointing; inside a framelet the geometry
 * is an ordinary camera with the radial distortion the instrument kernel states. A framelet is therefore one camera,
 * and an image is as many cameras as it has framelets.
 *
 * Everything about the camera comes from the instrument kernel (juno_junocam_v0x.ti): focal length, pixel pitch, each
 * strip's optical centre, the distortion coefficients, the start-time bias and the interframe delta. Everything about
 * the exposure comes from the product's own PDS3 label: START_TIME, INTERFRAME_DELAY, the filter order and the size.
 */
import { pds3Keyword, pds3Values } from '@cssearth/telescope';
import type { KernelSet } from '@cssearth/spice/node';
import { number as kernelNumber, string as kernelString, utcToEt, spiceCamera, type Aberration, type PixelModel } from '@cssearth/spice';
import { project } from './osiris-geo.mts';
import type { LimbCamera, LimbPixelMapping } from './limb-refinement.mts';
import type { EpochOffsets, RefinableStrip } from './strip-refinement.mts';

export const JUNOCAM_FORMAT = 'junocam-camera';
export const FRAMELET_WIDTH = 1648, FRAMELET_HEIGHT = 128;
/** The strips' NAIF instrument ids, as the instrument kernel assigns them. */
export const JUNOCAM_FILTERS: Readonly<Record<string, number>> = { BLUE: -61501, GREEN: -61502, RED: -61503, METHANE: -61504 };
/** Each line starts with 23 dark pixels; 1608 photoactive pixels follow, then dark, isolation and overscan pixels (instrument kernel, "Apparent FOV Layout"). */
export const FIRST_ACTIVE_COLUMN = 23, ACTIVE_COLUMNS = 1608;
/** An RDR sample of 10000 is a white Lambertian surface lit at normal incidence at the target's solar distance (product SIS, SAMPLE_BITS). */
export const RDR_UNIT_REFLECTANCE = 10000;

export interface JunocamLabel {
  productId: string; target: string; startTime: string; interframeDelaySeconds: number; filters: string[];
  lines: number; frames: number; exposureMilliseconds: number; tdiStages: number;
}

const numberWithUnit = (text: string | undefined, unit: string, name: string) => {
  const match = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)\s*<([^<>]+)>$/u.exec(text ?? '');
  if (!match || match[2].trim().toLowerCase() !== unit) throw new Error(`JunoCam label ${name} is ${text ?? 'absent'}, expected a value in ${unit}.`);
  return Number(match[1]);
};

/** The label of one calibrated image, held to the product the decoder understands: a full-resolution 16-bit RDR. */
export function readJunocamLabel(label: string): JunocamLabel {
  const required = (key: string) => { const value = pds3Keyword(label, key); if (value === undefined) throw new Error(`JunoCam label lacks ${key}.`); return value; };
  const expected: Record<string, readonly string[]> = { INSTRUMENT_ID: ['JNC'], STANDARD_DATA_PRODUCT_ID: ['JUNOCAM-RDR'], SAMPLE_BITS: ['16'],
    SAMPLE_TYPE: ['UNSIGNED_INTEGER', 'MSB_UNSIGNED_INTEGER'], LINE_SAMPLES: [String(FRAMELET_WIDTH)], SAMPLING_FACTOR: ['1'], LINE_PREFIX_BYTES: ['0'], LINE_SUFFIX_BYTES: ['0'] };
  for (const [key, values] of Object.entries(expected)) if (!values.includes(required(key))) throw new Error(`JunoCam label ${key} is ${required(key)}, expected ${values.join(' or ')}.`);
  const filters = pds3Values(label, 'FILTER_NAME') ?? [], lines = Number(required('LINES'));
  if (!filters.length || filters.some(name => !Object.hasOwn(JUNOCAM_FILTERS, name)) || new Set(filters).size !== filters.length) throw new Error(`JunoCam label names unsupported filters: ${filters.join(', ')}.`);
  if (!Number.isInteger(lines) || lines <= 0 || lines % (FRAMELET_HEIGHT * filters.length) !== 0) throw new Error(`JunoCam image has ${lines} lines, not whole frames of ${filters.length} framelets.`);
  const startTime = required('START_TIME');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/u.test(startTime)) throw new Error(`JunoCam label START_TIME is not a UTC instant: ${startTime}.`);
  return { productId: required('PRODUCT_ID'), target: required('TARGET_NAME'), startTime: `${startTime}Z`, interframeDelaySeconds: numberWithUnit(pds3Keyword(label, 'INTERFRAME_DELAY'), 's', 'INTERFRAME_DELAY'),
    filters, lines, frames: lines / FRAMELET_HEIGHT / filters.length, exposureMilliseconds: numberWithUnit(pds3Keyword(label, 'EXPOSURE_DURATION'), 'ms', 'EXPOSURE_DURATION'),
    tdiStages: Number(required('JNO:TDI_STAGES_COUNT')) };
}

export interface JunocamImage { label: JunocamLabel; width: number; height: number; /** Reflectance: the product's samples over RDR_UNIT_REFLECTANCE. */ values: Float32Array }

/** The image array as reflectance. Samples are most-significant-byte-first unsigned 16-bit integers, one framelet after another. */
export function decodeJunocam(bytes: Buffer, labelText: string): JunocamImage {
  const label = readJunocamLabel(labelText), count = FRAMELET_WIDTH * label.lines;
  if (bytes.length !== count * 2) throw new Error(`JunoCam image holds ${bytes.length} bytes; its label describes ${count * 2}.`);
  const values = new Float32Array(count);
  for (let i = 0; i < count; i++) values[i] = bytes.readUInt16BE(i * 2) / RDR_UNIT_REFLECTANCE;
  return { label, width: FRAMELET_WIDTH, height: label.lines, values };
}

/** The framelet of one frame and one filter, in the order the label lists the filters. */
export const frameletIndex = (label: JunocamLabel, frame: number, filter: string) => frame * label.filters.length + label.filters.indexOf(filter);

/** One strip's optics and timing from the instrument kernel. Pixel coordinates count from the centre of the first pixel, so the kernel's centre, which counts from its edge, moves by half a pixel. */
export function junocamStrip(set: Pick<KernelSet, 'pool'>, filter: string) {
  const id = JUNOCAM_FILTERS[filter];
  if (id === undefined) throw new Error(`Unknown JunoCam filter: ${filter}.`);
  const read = (suffix: string) => kernelNumber(set.pool, `INS${id}_${suffix}`);
  const focalLengthMm = read('FOCAL_LENGTH'), pixelPitchMm = read('PIXEL_SIZE'), frame = kernelString(set.pool, `INS${id}_FOV_FRAME`);
  const model: PixelModel = { focalLengthMm, pixelPitchMm, focalLengthPixels: focalLengthMm / pixelPitchMm, center: [read('DISTORTION_X') - 0.5, read('DISTORTION_Y') - 0.5],
    boresight: [0, 0, 1], width: FRAMELET_WIDTH, height: FRAMELET_HEIGHT, frame, column: [1, 0, 0], row: [0, 1, 0] };
  return { id, filter, model, k1: read('DISTORTION_K1'), k2: read('DISTORTION_K2'), startTimeBiasSeconds: read('START_TIME_BIAS'), interframeDeltaSeconds: read('INTERFRAME_DELTA') };
}
export type JunocamStrip = ReturnType<typeof junocamStrip>;

/** The kernel's radial distortion about the strip's optical centre: a pinhole pixel is scaled by 1 + k1 r² + k2 r⁴, and the inverse is iterated to convergence. */
export function junocamPixelMapping(strip: Pick<JunocamStrip, 'model' | 'k1' | 'k2'>, columnOffset = 0): LimbPixelMapping {
  const [cx, cy] = [strip.model.center[0] - columnOffset, strip.model.center[1]], { k1, k2 } = strip;
  return {
    fromPinhole(x, y) { const u = x - cx, v = y - cy, r2 = u * u + v * v, scale = 1 + k1 * r2 + k2 * r2 * r2; return [cx + u * scale, cy + v * scale]; },
    toPinhole(x, y) {
      const u = x - cx, v = y - cy; let pu = u, pv = v;
      for (let i = 0; i < 32; i++) { const r2 = pu * pu + pv * pv, scale = 1 + k1 * r2 + k2 * r2 * r2, nu = u / scale, nv = v / scale, moved = Math.abs(nu - pu) + Math.abs(nv - pv); pu = nu; pv = nv; if (moved < 1e-10) break; }
      return [cx + pu, cy + pv];
    } };
}

export const NO_OFFSETS: EpochOffsets = { pointingSeconds: 0, ephemerisSeconds: 0 };

export interface JunocamGeometry { observer: number; target: number; bodyFrame: string; aberration: Aberration }

/** The epoch of a frame: the label's start time, the kernel's start-time bias, and one interframe delay (with the kernel's delta) per frame. */
export function frameEpoch(set: Pick<KernelSet, 'leapSeconds'>, label: JunocamLabel, strip: JunocamStrip, frame: number) {
  return utcToEt(set.leapSeconds, label.startTime) + strip.startTimeBiasSeconds + frame * (label.interframeDelaySeconds + strip.interframeDeltaSeconds);
}

/** The pinhole camera of one framelet from the kernel set, its columns counted from `columnOffset`; the strip's distortion applies on top of it. */
export function frameletCamera(set: KernelSet, geometry: JunocamGeometry, label: JunocamLabel, strip: JunocamStrip, frame: number, offsets: EpochOffsets = NO_OFFSETS, columnOffset = 0) {
  const et = frameEpoch(set, label, strip, frame) + offsets.pointingSeconds;
  const model: PixelModel = { ...strip.model, center: [strip.model.center[0] - columnOffset, strip.model.center[1]] };
  const camera = spiceCamera({ pool: set.pool, ephemeris: set.ephemeris, rotation: set.rotation, observer: geometry.observer, target: geometry.target, bodyFrame: geometry.bodyFrame,
    instrument: strip.id, et, ephemerisEt: et + offsets.ephemerisSeconds, aberration: geometry.aberration, pixels: model });
  return { ...camera, et };
}

/** The archived-camera fields a limb fit and a matrix camera read. */
export const limbCamera = ({ schema, matrix, rayMatrix, positionKm, sunDirection }: ReturnType<typeof frameletCamera>): LimbCamera => ({ schema, matrix, rayMatrix, positionKm, sunDirection });

/** Columns kept beside the lit surface a strip can hold: a few for the cast, where a mesh's vertices can lie a degree or two apart, and the limb fit's search reach before the epochs are fitted. */
export const CROP_MARGIN_PIXELS = 24, SEARCH_MARGIN_PIXELS = 96;

/** The columns of one strip that can hold lit surface the camera faces, from the mesh's own vertices; null when the strip holds none. Dark and
 * far-side surface is never sampled, so its columns are not cast. A radial body's outward direction stands in for the vertex normal, and the margin covers it. */
export function litColumns(camera: ReturnType<typeof frameletCamera>, mapping: LimbPixelMapping, verticesKm: readonly (readonly number[])[], margin: number) {
  const eye = camera.positionKm, sun = camera.sunDirection;
  let minimumX = Infinity, maximumX = -Infinity;
  for (const v of verticesKm) {
    const radius = Math.hypot(v[0], v[1], v[2]);
    if ((v[0] * sun[0] + v[1] * sun[1] + v[2] * sun[2]) / radius < -0.05 || v[0] * (eye[0] - v[0]) + v[1] * (eye[1] - v[1]) + v[2] * (eye[2] - v[2]) < 0) continue;
    const p = project(camera.matrix, v);
    if (!(p[2] > 0)) continue;
    const [x, y] = mapping.fromPinhole(p[0], p[1]);
    if (y < -margin || y > FRAMELET_HEIGHT - 1 + margin) continue;
    minimumX = Math.min(minimumX, x); maximumX = Math.max(maximumX, x);
  }
  const x0 = Math.max(FIRST_ACTIVE_COLUMN, Math.floor(minimumX) - margin), x1 = Math.min(FIRST_ACTIVE_COLUMN + ACTIVE_COLUMNS, Math.ceil(maximumX) + margin + 1);
  return x1 - x0 < 2 ? null : { x0, x1 };
}

/** Every strip of the named bands that can hold lit surface under the offsets, with its columns. */
export function litStrips(set: KernelSet, geometry: JunocamGeometry, label: JunocamLabel, bands: readonly string[], verticesKm: readonly (readonly number[])[], offsets: EpochOffsets, margin: number) {
  return bands.flatMap(band => { const strip = junocamStrip(set, band), mapping = junocamPixelMapping(strip);
    return Array.from({ length: label.frames }, (_, index) => ({ band, index, strip, bounds: litColumns(frameletCamera(set, geometry, label, strip, index, offsets), mapping, verticesKm, margin) }))
      .filter((entry): entry is typeof entry & { bounds: { x0: number; x1: number } } => entry.bounds !== null); });
}

const activeColumn = (index: number) => { const x = index % FRAMELET_WIDTH; return x >= FIRST_ACTIVE_COLUMN && x < FIRST_ACTIVE_COLUMN + ACTIVE_COLUMNS; };
/** The pixels of one framelet, as a view on the image. */
export const stripPixels = (image: JunocamImage, frame: number, filter: string) => { const row = frameletIndex(image.label, frame, filter) * FRAMELET_HEIGHT; return image.values.subarray(row * FRAMELET_WIDTH, (row + FRAMELET_HEIGHT) * FRAMELET_WIDTH); };

/** What the epoch fit reads: every strip of the named bands that can see the body before any offset, with its camera as a function of the offsets. */
export function refinableStrips(set: KernelSet, geometry: JunocamGeometry, image: JunocamImage, bands: readonly string[], verticesKm: readonly (readonly number[])[]): RefinableStrip[] {
  return litStrips(set, geometry, image.label, bands, verticesKm, NO_OFFSETS, SEARCH_MARGIN_PIXELS).map(({ band, index, strip }) => ({ id: `${band}-${index}`,
    image: { width: FRAMELET_WIDTH, height: FRAMELET_HEIGHT, planes: { IMAGE: stripPixels(image, index, band) }, acceptPixel: activeColumn }, pixelMapping: junocamPixelMapping(strip),
    camera: offsets => limbCamera(frameletCamera(set, geometry, image.label, strip, index, offsets)) }));
}
