/**
 * JunoCam colour photographs. One recipe frame is one calibrated image: a stack of strips through the detector's red,
 * green and blue filters, every strip with its own camera from the Juno kernels (../../terrestrial-layers/junocam.mts).
 * The image's two epochs are first fitted to the lit limb of the body's mesh (strip-refinement.mts). Each band then
 * becomes one frame made of its strips, and the three bands one colour photograph, so everything after the frame is the
 * shared route: footprints, photometry, selection between photographs, level matching, display and the report.
 */
import type { LoadContext, ObservationFrame, ObservationImage, ObservationPhotometry, SurfaceObservationFormat, SurfacePolicy } from '../contract.mts';
import { decodeProfile, parseLevelMatching, parseSurfaceGeometry, surfaceTransfer } from '../../terrestrial-layers/source-records.mts';
import { array, boolean, number, optional, shape, text, requireArray, requireRecord } from '@cssearth/core';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadKernelSet, type KernelSet } from '../../../spice/kernel-set.mts';
import { kernelBankPaths } from '../../../spice/kernel-bank.mts';
import { etToUtc } from '../../../spice/lsk.mts';
import { ABERRATIONS } from '../../terrestrial-layers/spice-camera.mts';
import { project } from '../../terrestrial-layers/osiris-geo.mts';
import { CROP_MARGIN_PIXELS, FRAMELET_HEIGHT, FRAMELET_WIDTH, JUNOCAM_FORMAT, decodeJunocam, frameletCamera, junocamPixelMapping, limbCamera, litStrips, refinableStrips, stripPixels, type JunocamGeometry } from '../../terrestrial-layers/junocam.mts';
import { refineStripEpochs, validateStripRefinement } from '../../terrestrial-layers/strip-refinement.mts';
import { bandColorDisplay } from '../../color-transfer.mts';
import { matrixCamera, type PixelDistortion } from '../cameras.mts';
import { castSourceRays } from '../geometry.mts';
import { cameraFrame } from '../footprint.mts';
import { bandSetFrame, stripFrame, type Strip } from '../composite.mts';
import { diskPhotometry } from '../photometry.mts';
import { deriveLimits } from '../limits.mts';
import { LENS_KEYS, MOSAIC_KEYS, OPTIONAL_LENS_KEYS, checkKeys, displayBasis, parseDisplay, positive, validateEnvelope, validateTransfer } from '../recipe.mts';

const CONTEXT = 'JunoCam observation recipe';
/** The bands of the colour photograph, in display order. */
const BANDS = ['RED', 'GREEN', 'BLUE'] as const;
const MAXIMUM_FRAMES = 8;

const parseJunocamLens = shape({ id: text, format: text, consumer: text, metadata: shape({ label: text, coverage: text, falseColor: optional(boolean) }),
  frames: array(shape({ id: text, path: text, labelPath: text, startTime: text })),
  spice: shape({ kernelSet: text, kernels: array(text), observer: number, target: number, targetName: text, bodyFrame: text, aberration: text }),
  epochRefinement: shape({ method: text, maximumPointingSeconds: number, maximumEphemerisSeconds: number, maximumResidualPixels: number, minimumControls: number,
    maximumControls: optional(number), searchPixels: optional(number), minimumSharpness: optional(number) }),
  selection: optional(text), levelMatching: optional(parseLevelMatching), transfer: surfaceTransfer,
  photometry: shape({ model: text, weight: optional(number), referenceIncidenceDegrees: number, referenceEmissionDegrees: number, maximumIncidenceDegrees: number, maximumEmissionDegrees: number, maximumGain: number }),
  display: parseDisplay });
type JunocamLens = ReturnType<typeof parseJunocamLens>;

const framePaths = (recipe: JunocamLens) => recipe.frames.flatMap(frame => [frame.path, frame.labelPath]);

function validateJunocamLens(value: unknown, sourceGeometry: unknown) {
  const record = requireRecord(value);
  checkKeys(record, [...LENS_KEYS, 'spice', 'epochRefinement'], [...MOSAIC_KEYS, ...OPTIONAL_LENS_KEYS], CONTEXT);
  for (const frame of requireArray(record.frames)) checkKeys(frame, ['id', 'path', 'labelPath', 'startTime'], [], `${CONTEXT} frame`);
  checkKeys(record.spice, ['kernelSet', 'kernels', 'observer', 'target', 'targetName', 'bodyFrame', 'aberration'], [], `${CONTEXT} spice block`);
  const recipe = decodeProfile(parseJunocamLens, value, `Invalid source-bound ${CONTEXT}.`), geometry = parseSurfaceGeometry(sourceGeometry);
  if (recipe.format !== JUNOCAM_FORMAT) throw new TypeError(`Invalid source-bound ${CONTEXT}.`);
  validateEnvelope(recipe, framePaths(recipe), { selections: ['lowest-emission', 'recipe-order', 'finest-resolution'], displays: ['displayRange'], maximumFrames: MAXIMUM_FRAMES, maximumLevelGain: 1.5, samplesPerTriangle: 'required' }, CONTEXT);
  validateTransfer(recipe.transfer, geometry, CONTEXT);
  // Every band composite is a scientific visualization of calibrated bands: it says so and starts its range at zero.
  if (recipe.display.displayRange?.[0] !== 0 || recipe.metadata.falseColor !== true) throw new TypeError('Band colour states false colour and starts its display range at zero.');
  const { spice, photometry } = recipe;
  if (!/^[a-z][a-z0-9-]*$/u.test(spice.kernelSet) || spice.kernels.length < 2 || spice.kernels.length > 32 || !Number.isInteger(spice.observer) || !Number.isInteger(spice.target) || spice.observer === spice.target ||
      !spice.targetName || !spice.bodyFrame || !ABERRATIONS.includes(spice.aberration as typeof ABERRATIONS[number]) || recipe.frames.some(frame => !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u.test(frame.startTime)))
    throw new TypeError('Invalid JunoCam SPICE declaration.');
  validateStripRefinement({ ...recipe.epochRefinement, method: recipe.epochRefinement.method as 'mesh-limb-epochs' });
  const lunarLambert = photometry.model === 'lunar-lambert';
  if (!['retained-observation', 'lommel-seeliger', 'lunar-lambert'].includes(photometry.model) || lunarLambert !== (photometry.weight !== undefined) ||
      (lunarLambert && !(photometry.weight! >= 0 && photometry.weight! <= 1)) || (photometry.model === 'retained-observation' && photometry.maximumGain !== 1) ||
      photometry.referenceIncidenceDegrees !== 0 || photometry.referenceEmissionDegrees !== 0 || !positive(photometry.maximumIncidenceDegrees) || photometry.maximumIncidenceDegrees >= 90 ||
      !positive(photometry.maximumEmissionDegrees) || photometry.maximumEmissionDegrees > recipe.transfer.maximumEmissionDegrees || !positive(photometry.maximumGain) || photometry.maximumGain > 3)
    throw new TypeError(`Invalid source-bound ${CONTEXT}.`);
}

async function loadJunocamImage(recipe: JunocamLens, frame: JunocamLens['frames'][number], set: KernelSet, photometry: ObservationPhotometry, { sourceDirectory, radial }: LoadContext): Promise<ObservationFrame> {
  const image = decodeJunocam(await readFile(resolve(sourceDirectory, frame.path)), await readFile(resolve(sourceDirectory, frame.labelPath), 'latin1')), { label } = image;
  if (label.startTime !== frame.startTime || label.target !== recipe.spice.targetName || BANDS.some(band => !label.filters.includes(band)))
    throw new Error(`JunoCam image ${frame.id} is ${label.target} at ${label.startTime} through ${label.filters.join(', ')}; the recipe states ${recipe.spice.targetName} at ${frame.startTime} through ${BANDS.join(', ')}.`);
  const geometry: JunocamGeometry = { observer: recipe.spice.observer, target: recipe.spice.target, bodyFrame: recipe.spice.bodyFrame, aberration: recipe.spice.aberration as JunocamGeometry['aberration'] };
  const mesh = radial.grid, verticesKm = mesh.positions.map(p => [p[0] / 1000, p[1] / 1000, p[2] / 1000]);
  // The two epochs are fitted once for the image, on every strip of every band that can see the body.
  const refinable = refinableStrips(set, geometry, image, BANDS, verticesKm);
  const refinement = refineStripEpochs(refinable, mesh, { ...recipe.epochRefinement, method: 'mesh-limb-epochs' });
  const bands = BANDS.map(band => {
    const strips: Strip[] = [];
    for (const { index, strip, bounds } of litStrips(set, geometry, image.label, [band], verticesKm, refinement.offsets, CROP_MARGIN_PIXELS)) {
      const { x0, x1 } = bounds, width = x1 - x0, source = stripPixels(image, index, band), values = new Float32Array(width * FRAMELET_HEIGHT);
      for (let y = 0; y < FRAMELET_HEIGHT; y++) values.set(source.subarray(y * FRAMELET_WIDTH + x0, y * FRAMELET_WIDTH + x1), y * width);
      const solved = frameletCamera(set, geometry, label, strip, index, refinement.offsets, x0), mapping = junocamPixelMapping(strip, x0);
      const distortion: PixelDistortion = { projectPoint: km => { const p = project(solved.matrix, km), [x, y] = mapping.fromPinhole(p[0], p[1]); return [x, y, p[2]]; }, rayPixel: (x, y) => [...mapping.toPinhole(x, y)] };
      const camera = matrixCamera('kernels', limbCamera(solved), distortion);
      const pixels = castSourceRays(camera, mesh, width, FRAMELET_HEIGHT);
      if (!requireRecord(pixels.report).geometryPixels) continue;
      const observation: ObservationImage = { width, height: FRAMELET_HEIGHT, values, startTime: etToUtc(set.leapSeconds, solved.et), filter: band, reject: i => Number.isFinite(values[i]) ? null : 'invalid-value',
        report: { units: 'reflectance: RDR samples over 10000, a white Lambertian surface at normal incidence', frame: index, columns: [x0, x1], exposureMilliseconds: label.exposureMilliseconds, tdiStages: label.tdiStages, camera: solved.report } };
      strips.push({ frame: cameraFrame({ id: `${frame.id}-${band.toLowerCase()}-${index}`, image: observation, camera, geometry: pixels, photometry, limits: recipe.transfer, mesh }), camera, width, height: FRAMELET_HEIGHT });
    }
    return stripFrame(`${frame.id}-${band.toLowerCase()}`, strips, 'kernels');
  });
  const set3 = bandSetFrame(frame.id, bands, 'kernels');
  return { ...set3, startTime: frame.startTime, report: { ...set3.report, product: label.productId, startTime: frame.startTime, interframeDelaySeconds: label.interframeDelaySeconds, frames: label.frames, epochRefinement: refinement.report } };
}

export const junocamFormat: SurfaceObservationFormat = {
  validate: validateJunocamLens,
  paths: value => framePaths(parseJunocamLens(value)),
  async load(value, context) {
    const recipe = parseJunocamLens(value), photometry = diskPhotometry(recipe.photometry);
    const set = await loadKernelSet(await kernelBankPaths(recipe.spice.kernelSet, recipe.spice.kernels));
    const frames: ObservationFrame[] = [];
    for (const frame of recipe.frames) frames.push(await loadJunocamImage(recipe, frame, set, photometry, context));
    const { report: limits, exceeded } = deriveLimits(recipe.transfer, frames, context.config.geometry.radialTerrain.simplification.maximumErrorMeters);
    const range = recipe.display.displayRange!, retained = recipe.photometry.model === 'retained-observation';
    const policy: SurfacePolicy = { format: recipe.format,
      selection: frames.length === 1 ? 'single' : recipe.selection === 'recipe-order' || recipe.selection === 'finest-resolution' ? recipe.selection : 'lowest-emission',
      levelMatching: recipe.levelMatching, samplesPerTriangle: recipe.levelMatching?.samplesPerTriangle ?? 8,
      display: { range: 'stated-range', low: range[0], high: range[1], units: `reflectance in each filter${retained ? ', with original illumination' : ', disk-normalized'}; false colour`,
        colorDisplay: bandColorDisplay(BANDS, 'radiance-factor', range), ...displayBasis(recipe.display) },
      photometry: photometry.report, retainsIllumination: photometry.retainsIllumination, limits };
    return { frames, policy, exceeded };
  },
};
