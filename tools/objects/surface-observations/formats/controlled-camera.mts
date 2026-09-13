/**
 * Controlled shape cameras: calibrated photographs whose pointing a published control network states, such as the Thomas and Stooke
 * shape releases or the Galileo SSI image catalog. The camera looks at the body origin from a stated latitude, longitude and range, and
 * its rays are cast onto the source mesh the network was controlled to. Three filters can be shown together as colour.
 */
import type { LoadContext, ObservationCamera, ObservationFrame, ObservationImage, ObservationPhotometry, SurfaceObservationFormat, SurfacePolicy } from '../contract.mts';
import { array, boolean, decodeProfile, number, optional, shape, text, parseCameraFrame, parseLevelMatching, parseSurfaceGeometry, publishedOr, surfaceTransfer } from '../../terrestrial-layers/source-records.mts';
import { requireArray, requireRecord } from '../../../source-values.mts';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { checkBandRegistration, controlledShapeCamera, framePaths, insetCoverage, loadShapeCameraImage, maskBackground, resolveCatalogCamera, type CameraImage } from '../../terrestrial-layers/shape-camera-mosaic.mts';
import { validPublishedPhotometryShape } from '../../terrestrial-layers/published-photometry.mts';
import { bandColorDisplay, type BandColorDisplay } from '../../color-transfer.mts';
import { pds3Keyword, pds3Values } from '../../pds-labels.mts';
import { castSourceRays } from '../geometry.mts';
import { cameraFrame } from '../footprint.mts';
import { diskPhotometry, publishedPhotometry } from '../photometry.mts';
import { deriveLimits } from '../limits.mts';
import { LENS_KEYS, MOSAIC_KEYS, OPTIONAL_LENS_KEYS, checkKeys, parseDisplay, positive, validateEnvelope, validateTransfer, type EnvelopeRules } from '../recipe.mts';

const CONTEXT = 'controlled camera recipe';
/** The camera a control network states for one photograph. A frame that names an image catalog takes these from the catalog instead. */
const CAMERA_FIELDS = ['observerLatitude', 'observerWestLongitude', 'sunLatitude', 'sunWestLongitude', 'rangeKm', 'northAzimuthDegrees', 'pixelAngleMicroradians', 'center'];
const FRAME_OPTIONAL = ['encoding', 'allowFiniteSigned', 'backgroundMaximum', 'backgroundOffset', 'coverageInsetPixels', 'cameraCatalog', 'quality', ...CAMERA_FIELDS];
const BANDS = ['red', 'green', 'blue'] as const;
type Band = typeof BANDS[number];
const RULES: Omit<EnvelopeRules, 'displays'> = { selections: ['finest-resolution', 'lowest-emission'], maximumFrames: 16, maximumLevelGain: 5, maximumLogMad: .5, samplesPerTriangle: 'optional' };

const diskBlock = shape({ model: text, weight: optional(number), referenceIncidenceDegrees: number, referenceEmissionDegrees: number,
  maximumIncidenceDegrees: number, maximumEmissionDegrees: number, maximumGain: number });
const lens = { id: text, format: text, consumer: text, metadata: shape({ label: text, coverage: text, falseColor: optional(boolean) }), transfer: surfaceTransfer,
  photometry: publishedOr(diskBlock), selection: optional(text), levelMatching: optional(parseLevelMatching), display: parseDisplay };
export const parseControlledCameraLens = shape({ ...lens, frames: array(parseCameraFrame) });
export const parseControlledColorLens = shape({ ...lens, bands: array(shape({ channel: text, filter: text })),
  frames: array(shape({ id: text, red: parseCameraFrame, green: parseCameraFrame, blue: parseCameraFrame })),
  registration: optional(shape({ references: array(parseCameraFrame), checks: array(shape({ reference: text, targets: array(text) })) })) });
type CameraLens = ReturnType<typeof parseControlledCameraLens>;
type ColorLens = ReturnType<typeof parseControlledColorLens>;
type CameraFrameRecipe = CameraLens['frames'][number];

const cameraPaths = (frames: readonly CameraFrameRecipe[]) => [...new Set(frames.flatMap(framePaths))];
const colorPaths = (recipe: ColorLens) => cameraPaths([...recipe.frames.flatMap(set => BANDS.map(band => set[band])), ...(recipe.registration?.references ?? [])]);

function checkFrame(frame: unknown, context: string) {
  checkKeys(frame, ['id', 'path', 'labelPath'], FRAME_OPTIONAL, context);
  const record = requireRecord(frame), catalog = record.cameraCatalog !== undefined;
  // A frame states its whole controlled camera, or names the catalog that states it; never a mix.
  if (CAMERA_FIELDS.some(key => (record[key] === undefined) !== catalog)) throw new TypeError(`Invalid source-bound ${context}: state every controlled camera field or name a camera catalog.`);
}

/** A published model record, the Lunar-Lambert disk function within its limits, or the acquisition illumination. */
function validatePhotometry(photometry: CameraLens['photometry'], value: unknown, emission: number, color: boolean) {
  if ('referenceDegrees' in photometry) {
    // A published model is fitted to one filter; three filters shown together keep their observed brightness instead.
    if (color || !validPublishedPhotometryShape(photometry, emission)) throw new TypeError(`Invalid source-bound ${CONTEXT} photometry.`);
    return;
  }
  checkKeys(value, ['model', 'referenceIncidenceDegrees', 'referenceEmissionDegrees', 'maximumIncidenceDegrees', 'maximumEmissionDegrees', 'maximumGain'], ['weight'], `${CONTEXT} photometry`);
  const lunarLambert = photometry.model === 'lunar-lambert';
  if (!(lunarLambert ? photometry.weight !== undefined && photometry.weight >= 0 && photometry.weight <= 1 && photometry.maximumGain <= 3
      : photometry.model === 'retained-observation' && photometry.weight === undefined && photometry.maximumGain === 1) ||
      photometry.referenceIncidenceDegrees !== 0 || photometry.referenceEmissionDegrees !== 0 || !(photometry.maximumGain >= 1) ||
      !positive(photometry.maximumIncidenceDegrees) || photometry.maximumIncidenceDegrees >= 90 ||
      !positive(photometry.maximumEmissionDegrees) || photometry.maximumEmissionDegrees > emission) throw new TypeError(`Invalid source-bound ${CONTEXT} photometry.`);
}

function validateCameraLens(value: unknown, sourceGeometry: unknown) {
  checkKeys(value, [...LENS_KEYS], [...MOSAIC_KEYS, ...OPTIONAL_LENS_KEYS], CONTEXT);
  for (const frame of requireArray(requireRecord(value).frames)) checkFrame(frame, `${CONTEXT} frame`);
  const recipe = decodeProfile(parseControlledCameraLens, value, `Invalid source-bound ${CONTEXT}.`);
  if (recipe.format !== 'controlled-shape-camera') throw new TypeError(`Invalid source-bound ${CONTEXT}.`);
  validateEnvelope(recipe, cameraPaths(recipe.frames), { ...RULES, displays: ['percentiles'] }, CONTEXT);
  validateTransfer(recipe.transfer, parseSurfaceGeometry(sourceGeometry), CONTEXT);
  validatePhotometry(recipe.photometry, requireRecord(value).photometry, recipe.transfer.maximumEmissionDegrees, false);
}

function validateColorLens(value: unknown, sourceGeometry: unknown) {
  const record = requireRecord(value), context = `${CONTEXT} for filter colour`;
  checkKeys(value, [...LENS_KEYS, 'bands'], [...MOSAIC_KEYS, ...OPTIONAL_LENS_KEYS, 'registration'], context);
  for (const set of requireArray(record.frames)) {
    checkKeys(set, ['id', ...BANDS], [], `${context} band set`);
    for (const band of BANDS) checkFrame(requireRecord(set)[band], `${context} frame`);
  }
  if (record.registration !== undefined) {
    checkKeys(record.registration, ['references', 'checks'], [], `${context} registration`);
    for (const frame of requireArray(requireRecord(record.registration).references)) checkFrame(frame, `${context} registration reference`);
  }
  const recipe = decodeProfile(parseControlledColorLens, value, `Invalid source-bound ${context}.`), filters = recipe.bands.map(band => band.filter);
  if (recipe.format !== 'controlled-shape-color' || recipe.bands.length !== 3 || recipe.bands.some((band, i) => band.channel !== BANDS[i] || !band.filter) ||
      new Set(filters).size !== 3 || recipe.metadata.falseColor !== true || recipe.display.displayRange?.[0] !== 0) {
    throw new TypeError('Filter colour names three distinct filters in red, green and blue order, is false colour, and shows every band on one display range from 0.');
  }
  validateEnvelope(recipe, colorPaths(recipe), { ...RULES, displays: ['displayRange'] }, context);
  validateTransfer(recipe.transfer, parseSurfaceGeometry(sourceGeometry), context);
  validatePhotometry(recipe.photometry, record.photometry, recipe.transfer.maximumEmissionDegrees, true);
}

const invalidValue = (image: CameraImage, value: number) =>
  !Number.isFinite(value) || Math.abs(value) > 1e10 || (!image.allowFiniteSigned && (value < 0 || (!image.allowZero && value === 0)));

/** The controlled camera in body-fixed metres. It looks at the body origin, so a point's depth is the range less its distance along the line of sight. */
function controlNetworkCamera(frame: Awaited<ReturnType<typeof resolveCatalogCamera>>, catalog?: Record<string, unknown>): ObservationCamera {
  const camera = controlledShapeCamera(frame), rangeMeters = frame.rangeKm * 1000, [ox, oy, oz] = camera.observer, position = Array.from(camera.position);
  return { kind: 'control-network', positionMeters: position, positionKm: position.map(n => n / 1000), sunDirection: Array.from(camera.sun), pinhole: true,
    nominalPixelScaleMeters: rangeMeters * frame.pixelAngleMicroradians * 1e-6,
    project: point => { const pixel = camera.project(point); return pixel ? [pixel[0], pixel[1], rangeMeters - point[0] * ox - point[1] * oy - point[2] * oz] : null; },
    ray: (x, y) => Array.from(camera.ray(x, y)),
    report: { observerLatitude: frame.observerLatitude, observerWestLongitude: frame.observerWestLongitude, sunLatitude: frame.sunLatitude, sunWestLongitude: frame.sunWestLongitude,
      rangeKm: frame.rangeKm, northAzimuthDegrees: frame.northAzimuthDegrees, pixelAngleMicroradians: frame.pixelAngleMicroradians, center: frame.center, ...(catalog ? { catalog } : {}) } };
}

/** The photograph's start time and filter from its native label. SSI companions state and check both. */
async function frameIdentity(sourceDirectory: string, frame: CameraFrameRecipe) {
  const label = await readFile(resolve(sourceDirectory, frame.labelPath), 'latin1');
  if (frame.quality) return { label, startTime: frame.quality.startTime, filter: frame.quality.filter };
  const startTime = pds3Keyword(label, 'START_TIME') ?? pds3Keyword(label, 'IMAGE_TIME'), filters = pds3Values(label, 'FILTER_NAME');
  if (!startTime || !filters?.length) throw new Error(`Controlled camera frame ${frame.id} lacks a start time or filter in its label.`);
  return { label, startTime, filter: filters.join('+') };
}

async function loadControlledFrame(frame: CameraFrameRecipe, photometry: ObservationPhotometry, limits: CameraLens['transfer'], { sourceDirectory, radial, entries }: LoadContext) {
  const [resolved, { label, startTime, filter }, image] = await Promise.all([resolveCatalogCamera(sourceDirectory, frame), frameIdentity(sourceDirectory, frame), loadShapeCameraImage(sourceDirectory, frame)]);
  const entry = requireRecord(entries.find(input => input.path === frame.path) ?? {});
  if (entry.width !== image.width || entry.height !== image.height) throw new Error(`Camera dimensions differ from pinned metadata: ${frame.id}`);
  // The archive's quality data, the edge-connected sky and any authored inset around invalid boundaries withhold pixels, in that order.
  const quality = image.missing?.slice();
  maskBackground(image, frame.backgroundMaximum);
  const background = image.missing?.slice();
  insetCoverage(image, frame.coverageInsetPixels);
  const withheld = image.missing, total = (mask?: Uint8Array) => mask ? mask.reduce((sum, v) => sum + v, 0) : 0;
  const observation: ObservationImage = { width: image.width, height: image.height, values: image.data, startTime, filter,
    reject: i => quality?.[i] ? 'quality' : background?.[i] ? 'background' : withheld?.[i] ? 'coverage-inset' : invalidValue(image, image.data[i]) ? 'invalid-value' : null,
    report: { encoding: image.encoding ?? 'calibrated', ...(image.sampleFormat ? { sampleFormat: image.sampleFormat } : {}), rasterOffset: image.offset,
      ...(image.quality ? { quality: image.quality } : {}), ...(image.allowFiniteSigned ? { allowFiniteSigned: true } : {}),
      background: { offset: frame.backgroundOffset ?? 0, maximum: frame.backgroundMaximum ?? null }, coverageInsetPixels: frame.coverageInsetPixels ?? 0,
      withheldPixels: { quality: total(quality), background: total(background) - total(quality), coverageInset: total(withheld) - total(background) } } };
  const camera = controlNetworkCamera(resolved, frame.cameraCatalog ? { path: frame.cameraCatalog.path, imageNumber: frame.cameraCatalog.imageNumber } : undefined);
  const built = cameraFrame({ id: frame.id, image: observation, camera, geometry: castSourceRays(camera, radial.grid, image.width, image.height), photometry, limits, mesh: radial.grid });
  return { frame: built, label };
}

/** Three filter photographs shown together. Every band must qualify at a point, and the bands stay separate floats until display. */
function bandSetFrame(id: string, bands: readonly ObservationFrame[]): ObservationFrame {
  const coarsest = bands.reduce((a, b) => b.footprint.nadirMedianMeters > a.footprint.nadirMedianMeters ? b : a);
  return { id, startTime: bands[0].startTime, filter: bands.map(frame => frame.filter).join(' / '), positionKm: coarsest.positionKm,
    cameraKind: 'control-network', geometrySource: 'source-mesh-rays', nominalPixelScaleMeters: coarsest.nominalPixelScaleMeters, footprint: coarsest.footprint,
    sample(point) {
      const color: number[] = [];
      let separationMeters = 0, gain = 0, maximumEmissionDegrees = 0, maximumIncidenceDegrees = 0;
      for (const frame of bands) {
        const sample = frame.sample(point);
        if (sample.reason !== undefined) return sample;
        color.push(sample.radiance); separationMeters = Math.max(separationMeters, sample.separationMeters); gain = Math.max(gain, sample.gain);
        maximumEmissionDegrees = Math.max(maximumEmissionDegrees, sample.maximumEmissionDegrees); maximumIncidenceDegrees = Math.max(maximumIncidenceDegrees, sample.maximumIncidenceDegrees);
      }
      // Level matching and coverage use the bands' mean; one gain then scales all three bands, so their measured ratios stay.
      return { radiance: (color[0] + color[1] + color[2]) / 3, color, gain, separationMeters, maximumEmissionDegrees, maximumIncidenceDegrees };
    },
    visible: point => bands.every(frame => frame.visible(point)),
    report: { id, bands: bands.map(frame => frame.report) } };
}

const lensPhotometry = (block: CameraLens['photometry'], { sourceDirectory, source }: LoadContext): Promise<ObservationPhotometry> =>
  'referenceDegrees' in block ? publishedPhotometry(sourceDirectory, source.manifest, block) : Promise.resolve(diskPhotometry(block));

function lensPolicy(recipe: CameraLens | ColorLens, frames: readonly ObservationFrame[], photometry: ObservationPhotometry, context: LoadContext, units: string, colorDisplay?: BandColorDisplay) {
  const { report: limits, exceeded } = deriveLimits(recipe.transfer, frames, context.config.geometry.radialTerrain.simplification.maximumErrorMeters);
  const range = recipe.display.displayRange;
  const policy: SurfacePolicy = { format: recipe.format,
    selection: frames.length === 1 ? 'single' : recipe.selection === 'lowest-emission' ? 'lowest-emission' : 'finest-resolution',
    levelMatching: recipe.levelMatching, samplesPerTriangle: recipe.levelMatching?.samplesPerTriangle ?? 8,
    display: range ? { range: 'authored', low: range[0], high: range[1], units, ...(colorDisplay ? { colorDisplay } : {}) }
      : { range: 'surface-samples', percentiles: recipe.display.percentiles ?? [], units },
    photometry: photometry.report, limits };
  return { frames: [...frames], policy, exceeded };
}

const retained = (block: CameraLens['photometry']) => !('referenceDegrees' in block) && block.model === 'retained-observation';

export const controlledCameraFormat: SurfaceObservationFormat = {
  validate: validateCameraLens,
  paths: value => cameraPaths(parseControlledCameraLens(value).frames),
  async load(value, context) {
    const recipe = parseControlledCameraLens(value), photometry = await lensPhotometry(recipe.photometry, context), frames: ObservationFrame[] = [];
    for (const frame of recipe.frames) frames.push((await loadControlledFrame(frame, photometry, recipe.transfer, context)).frame);
    const quantity = recipe.frames.some(frame => frame.encoding === 'vicar-byte-dn') ? 'detector brightness, DN / 255' : 'I/F';
    const units = photometry.units ?? `relative ${retained(recipe.photometry) ? `${quantity} with original illumination` : `disk-normalized ${quantity}`}; linear grayscale display`;
    return lensPolicy(recipe, frames, photometry, context, units);
  },
};

export const controlledColorFormat: SurfaceObservationFormat = {
  validate: validateColorLens,
  paths: value => colorPaths(parseControlledColorLens(value)),
  async load(value, context) {
    const recipe = parseControlledColorLens(value), photometry = await lensPhotometry(recipe.photometry, context);
    // Registered cameras are measured again against their reference images before any pixel is sampled.
    const registration = recipe.registration ? await checkBandRegistration(context.sourceDirectory,
      recipe.bands.map(band => ({ channel: band.channel, filter: band.filter, frames: recipe.frames.map(set => set[band.channel as Band]) })), recipe.registration, context.radial.grid) : undefined;
    const frames: ObservationFrame[] = [];
    for (const set of recipe.frames) {
      const bands: ObservationFrame[] = [];
      for (const band of recipe.bands) {
        const source = set[band.channel as Band], { frame, label } = await loadControlledFrame(source, photometry, recipe.transfer, context);
        // Cassini labels state UNITS = 'I/F'; Voyager labels give I/F as DN times a 1.0E-4 reflectance scaling factor.
        const reflectance = pds3Keyword(label, 'UNITS') === 'I/F' || /^1\.0+E-0?4$/i.test(pds3Keyword(label, 'REFLECTANCE_SCALING_FACTOR') ?? '');
        if (!pds3Values(label, 'FILTER_NAME')?.includes(band.filter) || !reflectance) throw new Error(`Band colour needs the actual filter and calibrated reflectance units in its native label: ${source.id}`);
        bands.push(frame);
      }
      frames.push(bandSetFrame(set.id, bands));
    }
    const units = `relative I/F in each filter${retained(recipe.photometry) ? ', with original illumination' : ', disk-normalized'}; false colour`;
    const result = lensPolicy(recipe, frames, photometry, context, units, bandColorDisplay(recipe.bands.map(band => band.filter), 'radiance-factor', recipe.display.displayRange));
    return registration ? { ...result, policy: { ...result.policy, registration } } : result;
  },
};
