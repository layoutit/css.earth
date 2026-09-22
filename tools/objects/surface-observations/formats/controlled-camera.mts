/**
 * Controlled shape cameras: calibrated photographs whose pointing a published control network states, such as the Thomas and Stooke
 * shape releases or the Galileo SSI image catalog. The camera looks at the body origin from a stated latitude, longitude and range, and
 * its rays are cast onto the source mesh the network was controlled to. Three filters can be shown together as colour.
 */
import type { LoadContext, ObservationCamera, ObservationFrame, ObservationImage, ObservationPhotometry, PixelGeometry, SurfaceObservationFormat, SurfacePolicy } from '../contract.mts';
import { array, boolean, decodeProfile, number, optional, shape, text, parseCameraFrame, parseLevelMatching, parseSurfaceGeometry, publishedOr, surfaceTransfer } from '../../terrestrial-layers/source-records.mts';
import { requireArray, requireRecord } from '../../../sources/source-values.mts';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { checkBandAlignment, controlledShapeCamera, framePaths, insetCoverage, loadShapeCameraImage, maskBackground, resolveCatalogCamera, type CameraImage } from '../../terrestrial-layers/shape-camera-mosaic.mts';
import { validPublishedPhotometryShape } from '../../terrestrial-layers/published-photometry.mts';
import { bandColorDisplay, type BandColorDisplay } from '../../color-transfer.mts';
import { pds3Keyword, pds3Values } from '../../pds-labels.mts';
import { readFitsPrimary } from '../../observation/fits.mts';
import { pds3LabelHasReflectance } from './pds3-reflectance.mts';
import { castSourceRays } from '../geometry.mts';
import { cameraFrame } from '../footprint.mts';
import { bandSetFrame } from '../composite.mts';
import { diskPhotometry, publishedPhotometry } from '../photometry.mts';
import { deriveLimits } from '../limits.mts';
import { MAXIMUM_LEVEL_FRAMES } from '../levels.mts';
import { LENS_KEYS, MOSAIC_KEYS, OPTIONAL_LENS_KEYS, checkKeys, displayBasis, parseDisplay, positive, validateEnvelope, validateTransfer, type EnvelopeRules } from '../recipe.mts';

const CONTEXT = 'controlled camera recipe';
/** The camera a control network states for one photograph. A frame that names an image catalog takes these from the catalog instead. */
const CAMERA_FIELDS = ['observerLatitude', 'observerWestLongitude', 'sunLatitude', 'sunWestLongitude', 'rangeKm', 'northAzimuthDegrees', 'pixelAngleMicroradians', 'center'];
const FRAME_OPTIONAL = ['encoding', 'allowFiniteSigned', 'backgroundMaximum', 'backgroundOffset', 'coverageInsetPixels', 'cameraCatalog', 'quality', 'reconstruction', ...CAMERA_FIELDS];
const BANDS = ['red', 'green', 'blue'] as const;
type Band = typeof BANDS[number];
// Raw detector frames through different filters and exposures need wide levels: Amalthea's Galileo frames measure 10.3 from their reference.
// A survey night repeats the same view minutes apart, and those repeats are what set the registration stage's noise floor, so they
// are not redundant frames to be thinned: Themis contributes 30 over six nights, and a lens that casts several apparitions more.
/** The most frames one controlled-camera lens may cast: as many as one level fit compares. */
export const CONTROLLED_CAMERA_MAXIMUM_FRAMES = MAXIMUM_LEVEL_FRAMES;
const RULES: Omit<EnvelopeRules, 'displays'> = { selections: ['finest-resolution', 'lowest-emission', 'edge-weighted-average'], maximumFrames: CONTROLLED_CAMERA_MAXIMUM_FRAMES, maximumLevelGain: 16, samplesPerTriangle: 'optional' };

/**
 * A deconvolved ZIMPOL frame states no unit, and the survey's deconvolution changes scale between observing seasons:
 * Kleopatra's 2017 frames total about 3 million and its 2018 frames about 60 million, through one filter at one detector
 * gain, while one season's nights stay within about 3× of each other. Such frames share a level only within a season, and
 * frames this many days or more apart are placed by their overlaps alone.
 */
export const DECONVOLVED_SEASON_GAP_DAYS = 120;
const DECONVOLVED = 'fits-zimpol-intensity';

/** Each frame's season, counted in time order: a frame starts a new season when it follows the one before by the gap or more. */
export function observingSeasons(startTimes: readonly string[], gapDays = DECONVOLVED_SEASON_GAP_DAYS) {
  const times = startTimes.map(time => Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/u.test(time) ? time : `${time}Z`));
  if (times.some(time => !Number.isFinite(time))) throw new Error('A frame states no usable start time for its season.');
  const order = times.map((_, i) => i).sort((a, b) => times[a] - times[b]), seasons = Array<number>(times.length);
  let season = -1;
  order.forEach((frame, k) => { if (k === 0 || times[frame] - times[order[k - 1]] >= gapDays * 86_400_000) season++; seasons[frame] = season; });
  return seasons;
}

const diskBlock = shape({ model: text, weight: optional(number), referenceIncidenceDegrees: number, referenceEmissionDegrees: number,
  maximumIncidenceDegrees: number, maximumEmissionDegrees: number, maximumGain: number });
const lens = { id: text, format: text, consumer: text, metadata: shape({ label: text, coverage: text, falseColor: optional(boolean) }), transfer: surfaceTransfer,
  photometry: publishedOr(diskBlock), selection: optional(text), levelMatching: optional(parseLevelMatching), display: parseDisplay };
export const parseControlledCameraLens = shape({ ...lens, frames: array(parseCameraFrame) });
export const parseControlledColorLens = shape({ ...lens, bands: array(shape({ channel: text, filter: text })),
  frames: array(shape({ id: text, red: parseCameraFrame, green: parseCameraFrame, blue: parseCameraFrame })),
  bandAlignment: optional(shape({ references: array(parseCameraFrame), checks: array(shape({ reference: text, targets: array(text) })) })) });
type CameraLens = ReturnType<typeof parseControlledCameraLens>;
type ColorLens = ReturnType<typeof parseControlledColorLens>;
type CameraFrameRecipe = CameraLens['frames'][number];

const cameraPaths = (frames: readonly CameraFrameRecipe[]) => [...new Set(frames.flatMap(framePaths))];
const colorPaths = (recipe: ColorLens) => cameraPaths([...recipe.frames.flatMap(set => BANDS.map(band => set[band])), ...(recipe.bandAlignment?.references ?? [])]);

/** Encodings whose archive ships no detached label: the frame's own header states its identity. */
const SELF_DESCRIBING = ['fits-zimpol-intensity', 'fits-oi-reconstruction'];
/** An image reconstructed from interferometric visibilities has no exposure of its own: the recipe states the epoch and band
 * of the visibilities it was made from, and the file's own header states only its pixel scale and axis directions. */
const RECIPE_IDENTIFIED = ['fits-oi-reconstruction'];

function checkFrame(frame: unknown, context: string) {
  const record0 = requireRecord(frame), selfDescribing = SELF_DESCRIBING.includes(String(record0.encoding));
  checkKeys(frame, selfDescribing ? ['id', 'path'] : ['id', 'path', 'labelPath'], FRAME_OPTIONAL, context);
  if (selfDescribing && record0.labelPath !== undefined) throw new TypeError(`Invalid source-bound ${context}: this encoding states its identity in the frame's own header, so it names no label.`);
  if ((record0.reconstruction !== undefined) !== RECIPE_IDENTIFIED.includes(String(record0.encoding))) throw new TypeError(`Invalid source-bound ${context}: only a reconstructed image names the visibilities it was made from.`);
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
  validateEnvelope(recipe, cameraPaths(recipe.frames), { ...RULES, displays: ['percentiles', 'displayRange'], palette: true }, CONTEXT);
  // A uniformly bright body has no dark samples, so an authored range starts at zero instead of stretching between its own extremes.
  if (recipe.display.displayRange !== undefined && recipe.display.displayRange[0] !== 0) throw new TypeError(`Invalid source-bound ${CONTEXT}: a monochrome display range starts at zero.`);
  validateTransfer(recipe.transfer, parseSurfaceGeometry(sourceGeometry), CONTEXT);
  validatePhotometry(recipe.photometry, requireRecord(value).photometry, recipe.transfer.maximumEmissionDegrees, false);
}

function validateColorLens(value: unknown, sourceGeometry: unknown) {
  const record = requireRecord(value), context = `${CONTEXT} for filter colour`;
  if (requireRecord(record.display).palette !== undefined) throw new TypeError(`Invalid source-bound ${context}: a palette belongs to a monochrome lens.`);
  checkKeys(value, [...LENS_KEYS, 'bands'], [...MOSAIC_KEYS, ...OPTIONAL_LENS_KEYS, 'bandAlignment'], context);
  for (const set of requireArray(record.frames)) {
    checkKeys(set, ['id', ...BANDS], [], `${context} band set`);
    for (const band of BANDS) checkFrame(requireRecord(set)[band], `${context} frame`);
  }
  if (record.bandAlignment !== undefined) {
    checkKeys(record.bandAlignment, ['references', 'checks'], [], `${context} bandAlignment`);
    for (const frame of requireArray(requireRecord(record.bandAlignment).references)) checkFrame(frame, `${context} bandAlignment reference`);
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
  if (frame.encoding !== undefined && RECIPE_IDENTIFIED.includes(frame.encoding)) {
    if (!frame.reconstruction) throw new Error(`Controlled camera frame ${frame.id} is a reconstruction and must state the epoch and band of its visibilities.`);
    return { label: '', startTime: frame.reconstruction.startTime, filter: frame.reconstruction.filter };
  }
  if (!frame.labelPath) {
    // A deconvolved ZIMPOL frame has no detached label of any kind. Its own header states the exposure and the filter.
    const { header } = readFitsPrimary(await readFile(resolve(sourceDirectory, frame.path)));
    // Header literals keep their FITS quoting and fixed-width padding; provenance records the stated value.
    const stated = (key: string) => { const raw = header[key]; return raw === undefined ? undefined : String(raw).replace(/^'|'$/g, '').trim() || undefined; };
    const startTime = stated('DATE-OBS'), filter = stated('ESO INS3 OPTI5 NAME');
    if (!startTime || !filter) throw new Error(`Controlled camera frame ${frame.id} lacks a start time or filter in its header.`);
    return { label: '', startTime, filter };
  }
  const label = await readFile(resolve(sourceDirectory, frame.labelPath), 'latin1');
  if (frame.quality) return { label, startTime: frame.quality.startTime, filter: frame.quality.filter };
  const startTime = pds3Keyword(label, 'START_TIME') ?? pds3Keyword(label, 'IMAGE_TIME'), filters = pds3Values(label, 'FILTER_NAME');
  if (!startTime || !filters?.length) throw new Error(`Controlled camera frame ${frame.id} lacks a start time or filter in its label.`);
  return { label, startTime, filter: filters.join('+') };
}

/** A stated camera that misses the photographed body puts lit source shape on the edge-connected sky. Across the first 136 controlled
 * frames, registered ones place at most 13% of it there (a 77-pixel crescent) and the two misregistered ones 36% and 99.8%. */
export const MAXIMUM_LIT_SHAPE_ON_SKY = .25;

export function litShapeOnSky(geometry: PixelGeometry, sky: Uint8Array | undefined, quality: Uint8Array | undefined, maximumIncidenceDegrees: number, count: number) {
  const limit = maximumIncidenceDegrees * Math.PI / 180;
  let litPixels = 0, onSkyPixels = 0;
  for (let i = 0; i < count; i++) {
    if (geometry.reject(i) !== null || !(geometry.incidence(i) < limit)) continue;
    litPixels++;
    if (sky?.[i] && !quality?.[i]) onSkyPixels++;
  }
  return { litPixels, onSkyPixels, share: litPixels ? onSkyPixels / litPixels : 0, maximumShare: MAXIMUM_LIT_SHAPE_ON_SKY };
}

async function loadControlledFrame(frame: CameraFrameRecipe, photometry: ObservationPhotometry, limits: CameraLens['transfer'], maximumIncidenceDegrees: number, { sourceDirectory, radial, entries }: LoadContext) {
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
  const geometry = castSourceRays(camera, radial.grid, image.width, image.height);
  // Registration: lit shape within the photometric incidence limit must land on the photographed body, not on the sky.
  const silhouette = litShapeOnSky(geometry, background, quality, maximumIncidenceDegrees, image.width * image.height);
  if (silhouette.share > MAXIMUM_LIT_SHAPE_ON_SKY) throw new Error(`Controlled camera ${frame.id} places ${(silhouette.share * 100).toFixed(1)}% of its lit source shape on sky; its stated camera does not register to the photograph.`);
  const built = cameraFrame({ id: frame.id, image: { ...observation, report: { ...observation.report, silhouette } }, camera, geometry, photometry, limits, mesh: radial.grid });
  return { frame: built, label };
}

const lensPhotometry = (block: CameraLens['photometry'], { sourceDirectory, source }: LoadContext): Promise<ObservationPhotometry> =>
  'referenceDegrees' in block ? publishedPhotometry(sourceDirectory, source.manifest, block) : Promise.resolve(diskPhotometry(block));

function lensPolicy(recipe: CameraLens | ColorLens, frames: readonly ObservationFrame[], photometry: ObservationPhotometry, context: LoadContext, units: string, colorDisplay?: BandColorDisplay) {
  const { report: limits, exceeded } = deriveLimits(recipe.transfer, frames, context.config.geometry.radialTerrain.simplification.maximumErrorMeters);
  const range = recipe.display.displayRange;
  const policy: SurfacePolicy = { format: recipe.format,
    selection: frames.length === 1 ? 'single' : recipe.selection === 'lowest-emission' || recipe.selection === 'edge-weighted-average' ? recipe.selection : 'finest-resolution',
    levelMatching: recipe.levelMatching, samplesPerTriangle: recipe.levelMatching?.samplesPerTriangle ?? 8,
    display: { ...(range ? { range: 'stated-range', low: range[0], high: range[1], units, ...(colorDisplay ? { colorDisplay } : {}) }
      : { range: 'surface-samples', percentiles: recipe.display.percentiles ?? [], units }), ...(recipe.display.palette ? { palette: recipe.display.palette } : {}), ...displayBasis(recipe.display) },
    photometry: photometry.report, retainsIllumination: photometry.retainsIllumination, limits };
  return { frames: [...frames], policy, exceeded };
}

const retained = (block: CameraLens['photometry']) => !('referenceDegrees' in block) && block.model === 'retained-observation';
const incidenceLimit = (block: CameraLens['photometry']) => 'referenceDegrees' in block ? block.limits.maximumIncidenceDegrees : block.maximumIncidenceDegrees;

export const controlledCameraFormat: SurfaceObservationFormat = {
  validate: validateCameraLens,
  paths: value => cameraPaths(parseControlledCameraLens(value).frames),
  async load(value, context) {
    const recipe = parseControlledCameraLens(value), photometry = await lensPhotometry(recipe.photometry, context), frames: ObservationFrame[] = [];
    for (const frame of recipe.frames) frames.push((await loadControlledFrame(frame, photometry, recipe.transfer, incidenceLimit(recipe.photometry), context)).frame);
    const quantity = recipe.frames.some(frame => frame.encoding === 'vicar-byte-dn') ? 'detector brightness, DN / 255'
      : recipe.frames.some(frame => frame.encoding === DECONVOLVED) ? 'deconvolved intensity'
      : recipe.frames.some(frame => frame.encoding === 'fits-oi-reconstruction') ? 'reconstructed intensity'
      : 'I/F';
    const units = photometry.units ?? `relative ${retained(recipe.photometry) ? `${quantity} with original illumination` : `disk-normalized ${quantity}`}; linear ${recipe.display.palette ? 'palette' : 'grayscale'} display`;
    const result = lensPolicy(recipe, frames, photometry, context, units);
    // Deconvolved frames carry no calibrated level, so their level fit is told each frame's season.
    return frames.length > 1 && recipe.frames.every(frame => frame.encoding === DECONVOLVED)
      ? { ...result, policy: { ...result.policy, levelSeasons: observingSeasons(frames.map(frame => frame.startTime)) } } : result;
  },
};

export const controlledColorFormat: SurfaceObservationFormat = {
  validate: validateColorLens,
  paths: value => colorPaths(parseControlledColorLens(value)),
  async load(value, context) {
    const recipe = parseControlledColorLens(value), photometry = await lensPhotometry(recipe.photometry, context);
    // Registered cameras are measured again against their reference images before any pixel is sampled.
    const bandAlignment = recipe.bandAlignment ? await checkBandAlignment(context.sourceDirectory,
      recipe.bands.map(band => ({ channel: band.channel, filter: band.filter, frames: recipe.frames.map(set => set[band.channel as Band]) })), recipe.bandAlignment, context.radial.grid) : undefined;
    const frames: ObservationFrame[] = [];
    for (const set of recipe.frames) {
      const bands: ObservationFrame[] = [];
      for (const band of recipe.bands) {
        const source = set[band.channel as Band], { frame, label } = await loadControlledFrame(source, photometry, recipe.transfer, incidenceLimit(recipe.photometry), context);
        // Calibrated SSI states its filter in both labels, which its loader checks against each other, and is I/F by its archive's definition.
        const ssi = source.encoding === 'fits-ssi-iof';
        const reflectance = ssi || pds3LabelHasReflectance(label), stated = ssi ? frame.filter === band.filter : pds3Values(label, 'FILTER_NAME')?.includes(band.filter);
        if (!stated || !reflectance) throw new Error(`Band colour needs the actual filter and calibrated reflectance units in its native label: ${source.id}`);
        bands.push(frame);
      }
      frames.push(bandSetFrame(set.id, bands));
    }
    const units = `relative I/F in each filter${retained(recipe.photometry) ? ', with original illumination' : ', disk-normalized'}; false colour`;
    const result = lensPolicy(recipe, frames, photometry, context, units, bandColorDisplay(recipe.bands.map(band => band.filter), 'radiance-factor', recipe.display.displayRange));
    return bandAlignment ? { ...result, policy: { ...result.policy, bandAlignment } } : result;
  },
};
