import { sha256 } from '@cssearth/core/node';
/**
 * Georeferenced photographs: archive backplanes (OSIRIS GEO, AMICA Gaskell, PDS4 geometry cubes), archived camera closures
 * (OSIRIS reflectance, L'LORRI, New Horizons LORRI and MVIC) and cameras derived from SPICE kernels. GEO_SCHEMAS states what
 * each format adds to the lens shape every format shares (recipe.mts).
 */
import type { CameraKind, LoadContext, ObservationFrame, ObservationImage, ObservationPhotometry, SurfaceObservationFormat, SurfacePolicy } from '../contract.mts';
import type { NumericRaster, SpiceCameraDeclaration } from '../../terrestrial-layers/source-records.mts';
import { decodeProfile, parseGeoCameraClosure, parseGeometryCube, parseLevelMatching, parseLimbRefinement, parsePhasePhotometry, parseSpiceCamera, parseSurfaceGeometry, publishedOr, surfaceTransfer } from '../../terrestrial-layers/source-records.mts';
import { array, boolean, number, optional, shape, text, requireArray, requireRecord, requireString } from '@cssearth/core';
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { decodeOsirisGeo, decodeOsirisQuality, acceptOsirisQuality, osirisRadianceFactorScale } from '../../terrestrial-layers/osiris-geo.mts';
import { decodeAmicaGeo } from '../../terrestrial-layers/amica-geo.mts';
import { decodeOsirisReflectance } from '../../terrestrial-layers/archived-camera.mts';
import { decodeLlorri } from '../../terrestrial-layers/llorri-geo.mts';
import { decodeNearMsi, parseNearCameraClosure } from '../../terrestrial-layers/near-msi.mts';
import { decodeNewHorizonsLorri, decodeArrokothMvic } from '../../terrestrial-layers/new-horizons-geo.mts';
import { validPublishedPhotometryShape } from '../../terrestrial-layers/published-photometry.mts';
import { decodePds4GeometryCube, PDS4_GEOMETRY_CUBE_FORMAT } from '../../terrestrial-layers/pds4-geometry-cube.mts';
import { decodeSpiceCameraFrame, SPICE_CAMERA_FORMAT, SPICE_CAMERA_COLOR_FORMAT, ABERRATIONS } from '../../terrestrial-layers/spice-camera.mts';
import { refineCameraByLimb } from '../../terrestrial-layers/limb-refinement.mts';
import { loadKernelSet } from '@cssearth/spice/node';
import { kernelBankPaths } from '../../../kernel-banks/kernel-bank.mts';
import { bandColorDisplay, type BandColorDisplay } from '../../color-transfer.mts';
import { fittedCamera, matrixCamera } from '../cameras.mts';
import { archiveBackplanes, castSourceRays } from '../geometry.mts';
import { cameraFrame } from '../footprint.mts';
import { diskPhotometry, publishedPhotometry } from '../photometry.mts';
import { deriveLimits } from '../limits.mts';
import { LENS_KEYS, MOSAIC_KEYS, OPTIONAL_LENS_KEYS, checkKeys, displayBasis, parseDisplay, positive, safePath, validateEnvelope, validateTransfer } from '../recipe.mts';

/** What a format adds to the shared lens shape, and which of the shared choices its product supports. */
interface GeoSchema {
  camera: Extract<CameraKind, 'backplane-fit' | 'archived-closure' | 'kernels'>;
  /** Inputs a frame names beside its id, image path and start time. */
  frame: { required: readonly string[]; optional?: readonly string[] };
  /** Blocks the lens adds beside the shared keys. */
  lens: { required: readonly string[]; optional?: readonly string[] };
  /** The historical disk functions the format accepts, and whether it may name a published photometric model instead. */
  photometry: readonly string[]; published: boolean;
  display: 'percentiles' | 'displayRange'; maximumFrames: number;
  /** A colour product's bands and quantity, which its decoder checks against the native label. The recipe declares only their common range. */
  color?: { bands: readonly string[]; inputQuantity: BandColorDisplay['inputQuantity']; units: string };
}

export const GEO_SCHEMAS: Readonly<Record<string, GeoSchema>> = {
  // Archive backplanes carry each pixel's surface point; the camera is fitted to them.
  'osiris-geo': { camera: 'backplane-fit', frame: { required: ['qualityPath'] }, lens: { required: ['filter', 'allowLossy'], optional: ['radiometry'] },
    photometry: ['lommel-seeliger'], published: true, display: 'percentiles', maximumFrames: 8 },
  // AMICA admits lossy frames and counts them in the report; one flat field serves every frame.
  'amica-gaskell': { camera: 'backplane-fit', frame: { required: ['labelPath', 'originalPath'] }, lens: { required: ['filter', 'flatPath'] },
    photometry: ['lommel-seeliger'], published: true, display: 'percentiles', maximumFrames: 10 },
  [PDS4_GEOMETRY_CUBE_FORMAT]: { camera: 'backplane-fit', frame: { required: ['labelPath'] }, lens: { required: ['filter', 'cube'] },
    photometry: ['lommel-seeliger'], published: true, display: 'percentiles', maximumFrames: 8 },
  // Archived cameras close over the exact source mesh, so they may also keep the acquisition illumination.
  'osiris-camera': { camera: 'archived-closure', frame: { required: ['cameraPath'] }, lens: { required: ['filter', 'allowLossy'], optional: ['limbRefinement'] },
    photometry: ['lommel-seeliger', 'minnaert', 'retained-observation'], published: true, display: 'percentiles', maximumFrames: 8 },
  'llorri-camera': { camera: 'archived-closure', frame: { required: ['cameraPath'] }, lens: { required: ['filter'] },
    photometry: ['lommel-seeliger', 'retained-observation'], published: true, display: 'percentiles', maximumFrames: 8 },
  // Paired raw frames supply detector validity; the native decoder rejects compressed inputs.
  'near-msi-camera': { camera: 'archived-closure', frame: { required: ['cameraPath', 'originalPath'] }, lens: { required: ['filter', 'limbRefinement'] },
    photometry: ['retained-observation'], published: false, display: 'percentiles', maximumFrames: 8 },
  'nh-lorri-camera': { camera: 'archived-closure', frame: { required: ['cameraPath'] }, lens: { required: ['filter'] },
    photometry: ['lommel-seeliger', 'retained-observation'], published: true, display: 'percentiles', maximumFrames: 8 },
  // Registered enhanced colour keeps its acquisition illumination. Its decoder checks these bands and data-number units against the label.
  'nh-mvic-camera': { camera: 'archived-closure', frame: { required: ['cameraPath', 'labelPath'] }, lens: { required: ['filter'] },
    photometry: ['retained-observation'], published: false, display: 'displayRange', maximumFrames: 1,
    color: { bands: ['NIR', 'RED', 'BLUE'], inputQuantity: 'derived-band-value', units: 'archive-derived data numbers; enhanced NIR / RED / BLUE color' } },
  // A VICAR frame brings its PDS3 label; a FITS frame carries its own header.
  [SPICE_CAMERA_FORMAT]: { camera: 'kernels', frame: { required: [], optional: ['labelPath'] }, lens: { required: ['filter', 'spice'], optional: ['limbRefinement'] },
    photometry: ['lommel-seeliger', 'retained-observation'], published: true, display: 'percentiles', maximumFrames: 8 },
  // The same camera for an archive whose bands are planes of one array. The composite is a scientific visualization
  // of three calibrated bands, as every band composite here is; it is not a qualified natural-colour reconstruction.
  [SPICE_CAMERA_COLOR_FORMAT]: { camera: 'kernels', frame: { required: [], optional: ['labelPath'] }, lens: { required: ['filter', 'spice'], optional: ['limbRefinement'] },
    photometry: ['retained-observation'], published: true, display: 'displayRange', maximumFrames: 8,
    color: { bands: ['RED', 'GREEN', 'BLUE'], inputQuantity: 'radiance', units: 'calibrated radiance; the detector\'s red, green and blue bands' } },
};
export const GEO_FORMATS = Object.keys(GEO_SCHEMAS);

const CONTEXT = 'georeferenced observation recipe';
export const parseGeoLens = shape({ id: text, format: text, consumer: text, metadata: shape({ label: text, coverage: text, falseColor: optional(boolean) }),
  frames: array(shape({ id: text, path: text, startTime: text, qualityPath: optional(text), labelPath: optional(text), originalPath: optional(text), cameraPath: optional(text) })),
  filter: text, allowLossy: optional(boolean), radiometry: optional(text), flatPath: optional(text),
  cube: optional(parseGeometryCube), spice: optional(parseSpiceCamera), limbRefinement: optional(parseLimbRefinement),
  selection: optional(text), levelMatching: optional(parseLevelMatching), transfer: surfaceTransfer,
  photometry: publishedOr(shape({ model: text, phaseCorrection: optional(parsePhasePhotometry), coefficient: optional(number), phaseCoefficientPerDegree: optional(number),
    referenceIncidenceDegrees: number, referenceEmissionDegrees: number, maximumIncidenceDegrees: number, maximumEmissionDegrees: number, maximumGain: number })),
  display: parseDisplay });
type GeoLens = ReturnType<typeof parseGeoLens>;
type GeoFrame = GeoLens['frames'][number];

const schemaOf = (format: unknown) => {
  const key = String(format);
  if (!Object.hasOwn(GEO_SCHEMAS, key)) throw new TypeError(`Invalid source-bound ${CONTEXT}.`);
  return GEO_SCHEMAS[key];
};
const cubeDeclaration = (recipe: Pick<GeoLens, 'cube'>) => { if (!recipe.cube) throw new TypeError('Geometry cube recipes declare their planes and identity.'); return recipe.cube; };
const spiceDeclaration = (recipe: Pick<GeoLens, 'spice'>) => { if (!recipe.spice) throw new TypeError('SPICE camera recipes declare their kernels, bodies, instrument and pixel axes.'); return recipe.spice; };
/** A frame's own inputs, the inputs its frames share and everything one frame consumes. Kernels from a shared bank are pinned by the bank's manifest, not the body's. */
const framePaths = (frame: GeoFrame) => [frame.path, frame.qualityPath, frame.labelPath, frame.originalPath, frame.cameraPath].filter((path): path is string => path !== undefined);
const sharedPaths = (recipe: GeoLens) => [...(recipe.flatPath === undefined ? [] : [recipe.flatPath]), ...(recipe.spice && !recipe.spice.kernelSet ? recipe.spice.kernels : [])];
const consumedPaths = (recipe: GeoLens, frame: GeoFrame) => [...framePaths(frame), ...sharedPaths(recipe)];
const within = (value: number | undefined, low: number, high: number) => value !== undefined && value >= low && value <= high;
const AXES = ['X', '-X', 'Y', '-Y', 'Z', '-Z'];

function validateGeoRecipe(value: unknown, sourceGeometry: unknown): void {
  const record = requireRecord(value), schema = schemaOf(record.format);
  checkKeys(record, [...LENS_KEYS, ...schema.lens.required], [...MOSAIC_KEYS, ...OPTIONAL_LENS_KEYS, ...(schema.lens.optional ?? [])], CONTEXT);
  for (const frame of requireArray(record.frames)) checkKeys(frame, ['id', 'path', 'startTime', ...schema.frame.required], schema.frame.optional ?? [], `${CONTEXT} frame`);
  const recipe = decodeProfile(parseGeoLens, value, `Invalid source-bound ${CONTEXT}.`), geometry = parseSurfaceGeometry(sourceGeometry);
  validateEnvelope(recipe, [...recipe.frames.flatMap(framePaths), ...sharedPaths(recipe)],
    { selections: ['lowest-emission', 'recipe-order'], displays: [schema.display], maximumFrames: schema.maximumFrames, maximumLevelGain: 1.5, samplesPerTriangle: 'required' }, CONTEXT);
  validateTransfer(recipe.transfer, geometry, CONTEXT);
  if (!recipe.filter || (recipe.format === 'amica-gaskell' && recipe.filter !== 'V') || recipe.frames.some(frame => !frame.startTime)) throw new TypeError(`Invalid source-bound ${CONTEXT}.`);
  // Every band composite is a scientific visualization, not natural colour: it states so and starts its range at zero.
  if (schema.color && (recipe.display.displayRange?.[0] !== 0 || recipe.metadata.falseColor !== true))
    throw new TypeError('Band colour requires source-derived bands, false color and retained illumination.');
  if (recipe.radiometry !== undefined && recipe.radiometry !== 'radiance-factor') throw new TypeError('Invalid observation radiometry.');
  validatePhotometry(recipe, schema);
  if (recipe.spice) validateSpice(recipe.spice, recipe.frames);
  if (recipe.limbRefinement) validateLimbRefinement(recipe.limbRefinement);
}

/** A published model record, or one of the format's historical disk functions within the bounds every camera route shares. */
function validatePhotometry(recipe: GeoLens, schema: GeoSchema) {
  const photometry = recipe.photometry, emission = recipe.transfer.maximumEmissionDegrees;
  if ('referenceDegrees' in photometry) {
    if (!schema.published || !validPublishedPhotometryShape(photometry, emission)) throw new TypeError(`Invalid source-bound ${CONTEXT}.`);
    return;
  }
  const phase = photometry.phaseCorrection;
  if (phase && (recipe.format !== 'osiris-geo' || recipe.radiometry !== 'radiance-factor' || phase.model !== 'hg-shadow-hiding' ||
      !Number.isFinite(phase.asymmetry) || Math.abs(phase.asymmetry) >= 1 || !positive(phase.amplitude) || !positive(phase.width) ||
      !positive(phase.minimumDegrees) || !(phase.maximumDegrees > phase.minimumDegrees) || phase.maximumDegrees >= 90 ||
      !(phase.referenceDegrees >= phase.minimumDegrees && phase.referenceDegrees <= phase.maximumDegrees) ||
      !positive(phase.maximumGain) || phase.maximumGain < 1 || phase.maximumGain > 1.5)) throw new TypeError('Invalid observation phase correction.');
  if (!schema.photometry.includes(photometry.model) ||
      (photometry.model === 'minnaert' && !(within(photometry.coefficient, .5, 1) && within(photometry.phaseCoefficientPerDegree, 0, .01))) ||
      (photometry.model === 'retained-observation' && photometry.maximumGain !== 1) ||
      photometry.referenceIncidenceDegrees !== 0 || photometry.referenceEmissionDegrees !== 0 ||
      !positive(photometry.maximumIncidenceDegrees) || photometry.maximumIncidenceDegrees >= 90 ||
      !positive(photometry.maximumEmissionDegrees) || photometry.maximumEmissionDegrees > emission ||
      !positive(photometry.maximumGain) || photometry.maximumGain > 3) throw new TypeError(`Invalid source-bound ${CONTEXT}.`);
}

function validateSpice(spice: SpiceCameraDeclaration, frames: readonly GeoFrame[]) {
  const vicar = spice.image.format === 'vicar-pds3';
  if (spice.kernels.length < 2 || spice.kernels.length > 32 || !Number.isInteger(spice.observer) || !Number.isInteger(spice.target) || spice.observer === spice.target ||
      !Number.isInteger(spice.instrument) || !Number.isInteger(spice.clock.spacecraft) ||
      // Exactly one epoch source: a UTC card, one clock card, or the VICAR label's start and stop counts.
      [spice.clock.utcHeader, spice.clock.header, spice.clock.start].filter(value => value !== undefined).length !== 1 ||
      (spice.clock.start !== undefined) !== (spice.clock.stop !== undefined) ||
      (spice.kernelSet !== undefined && !/^[a-z][a-z0-9-]*$/u.test(spice.kernelSet)) ||
      (spice.image.format !== undefined && !['fits', 'vicar-pds3'].includes(spice.image.format)) ||
      vicar !== (spice.clock.start !== undefined) || frames.some(frame => (frame.labelPath !== undefined) !== vicar) ||
      (spice.image.colorPlanes !== undefined && (spice.image.colorPlanes.length !== 3 ||
        spice.image.colorPlanes.some(plane => !Number.isInteger(plane) || plane < 1) || new Set(spice.image.colorPlanes).size !== 3)) ||
      !spice.bodyFrame || !ABERRATIONS.includes(spice.aberration as typeof ABERRATIONS[number]) ||
      spice.pixels.focalLength.unit !== 'mm' || !['micrometre', 'mm'].includes(spice.pixels.pixelPitch.unit) || ![0, 1].includes(spice.pixels.origin) ||
      !AXES.includes(spice.pixels.column) || !AXES.includes(spice.pixels.row) || spice.pixels.column.replace('-', '') === spice.pixels.row.replace('-', '') ||
      (spice.image.plane !== undefined && (!Number.isInteger(spice.image.plane) || spice.image.plane < 1)) || !spice.image.quantity) throw new TypeError('Invalid SPICE camera declaration.');
}

function validateLimbRefinement(refinement: ReturnType<typeof parseLimbRefinement>) {
  if (refinement.method !== 'mesh-limb' ||
      !positive(refinement.maximumCorrectionDegrees) || refinement.maximumCorrectionDegrees > 2 || !positive(refinement.maximumResidualPixels) || refinement.maximumResidualPixels > 5 ||
      !Number.isInteger(refinement.minimumControls) || refinement.minimumControls < 16 || refinement.minimumControls > 5000 ||
      (refinement.threshold !== undefined && !Number.isFinite(refinement.threshold)) ||
      (refinement.searchPixels !== undefined && (!Number.isInteger(refinement.searchPixels) || refinement.searchPixels < 8 || refinement.searchPixels > 512)) ||
      (refinement.maximumControls !== undefined && (!Number.isInteger(refinement.maximumControls) || refinement.maximumControls < 2 * refinement.minimumControls || refinement.maximumControls > 20000)) ||
      (refinement.minimumSharpness !== undefined && (!Number.isFinite(refinement.minimumSharpness) || refinement.minimumSharpness < 0 || refinement.minimumSharpness > 0.9))) throw new TypeError('Invalid camera limb refinement.');
}

async function loadGeoFrame(recipe: GeoLens, frame: GeoFrame, { sourceDirectory, source, radial, config, entries }: LoadContext, photometry: ObservationPhotometry): Promise<ObservationFrame> {
  const paths = consumedPaths(recipe, frame);
  if (entries.length !== paths.length || !paths.every(path => entries.some(e => e.path === path))) throw new Error('GEO observation must consume its exact pinned image and quality companion.');
  const read = (path: string | undefined) => readFile(resolve(sourceDirectory, requireString(path)));
  const closure = schemaOf(recipe.format).camera === 'archived-closure' ? parseGeoCameraClosure(JSON.parse((await read(frame.cameraPath)).toString('utf8'))) : null;
  if (closure) {
    // The camera names the source files it was solved against; the manifest owns their identity.
    if (!Array.isArray(closure.provenance) || closure.provenance.length < 3 || !closure.provenance.some(entry => entry.path === config.geometry.radialTerrain.path)) throw new Error('Camera lacks its source-mesh closure.');
    for (const entry of closure.provenance) {
      if (entry.path === undefined) continue;
      if (!safePath(entry.path)) throw new Error('Camera source provenance path is unsafe.');
      await source.validatePath(entry.path);
    }
  }
  const identity = (decoded: { startTime?: unknown; filter?: unknown }) => {
    if (decoded.startTime !== frame.startTime || decoded.filter !== recipe.filter) throw new Error('GEO observation identity changed.');
    return { startTime: frame.startTime, filter: recipe.filter };
  };
  const common = { id: frame.id, photometry, limits: recipe.transfer, mesh: radial.grid };
  // A declared limb refinement fits one rotation of the camera to the mesh's lit limb before any geometry is derived.
  const refined = <T extends { camera: unknown; width: number; height: number; planes: Record<string, NumericRaster>; acceptPixel?(index: number): boolean; qualityReport: Record<string, unknown> }>(decoded: T): T => {
    if (!recipe.limbRefinement) return decoded;
    const result = refineCameraByLimb({ ...decoded, planes: { IMAGE: decoded.planes.IMAGE } }, radial.grid, recipe.limbRefinement);
    decoded.qualityReport.limbRefinement = result.report;
    return { ...decoded, camera: result.camera };
  };
  // Cameras without archived backplanes cast their rays onto the full source mesh.
  const rayFrame = (decoded: { width: number; height: number; planes: Record<string, NumericRaster>; startTime?: unknown; filter?: unknown; acceptPixel(index: number): boolean; isLossyPixel?(index: number): boolean; qualityReport: Record<string, unknown> },
    camera: ReturnType<typeof matrixCamera>, colorValues?: readonly ArrayLike<number>[]) => {
    const image: ObservationImage = { width: decoded.width, height: decoded.height, values: decoded.planes.IMAGE, ...(colorValues ? { colorValues } : {}), ...identity(decoded),
      reject: i => decoded.acceptPixel(i) ? null : 'quality', lossy: decoded.isLossyPixel, report: decoded.qualityReport };
    return cameraFrame({ ...common, image, camera, geometry: castSourceRays(camera, radial.grid, decoded.width, decoded.height) });
  };
  // Archive backplanes carry their own surface points; the pinhole camera is recovered from them.
  const backplaneFrame = (decoded: { width: number; height: number; planes: Record<string, NumericRaster>; startTime?: unknown; filter?: unknown; xyz(index: number): number[]; valid(index: number): boolean },
    image: Pick<ObservationImage, 'reject' | 'lossy' | 'radianceFactor' | 'report'>, shapeModel?: string) => {
    const camera = fittedCamera(decoded);
    return cameraFrame({ ...common, image: { width: decoded.width, height: decoded.height, values: decoded.planes.IMAGE, ...identity(decoded), ...image }, camera,
      geometry: archiveBackplanes(decoded, camera, shapeModel) });
  };
  const allowLossy = recipe.allowLossy === true;
  if (recipe.format === 'near-msi-camera') {
    const nativeClosure = parseNearCameraClosure(closure);
    const decoded = refined({ ...decodeNearMsi(await read(frame.path), await read(frame.originalPath), nativeClosure), camera: closure });
    return rayFrame(decoded, matrixCamera('archived-closure', decoded.camera));
  }
  if (recipe.format === 'llorri-camera') {
    const decoded = decodeLlorri(await read(frame.path), closure);
    return rayFrame(decoded, matrixCamera('archived-closure', decoded.camera, decoded));
  }
  if (recipe.format === 'nh-lorri-camera') {
    const decoded = decodeNewHorizonsLorri(await read(frame.path), closure);
    return rayFrame(decoded, matrixCamera('archived-closure', decoded.camera, decoded));
  }
  if (recipe.format === 'nh-mvic-camera') {
    const decoded = decodeArrokothMvic(await read(frame.path), closure, (await read(frame.labelPath)).toString('utf8'));
    return rayFrame(decoded, matrixCamera('archived-closure', decoded.camera, decoded), decoded.colorPlanes);
  }
  if (recipe.format === 'osiris-camera') {
    const decoded = refined(decodeOsirisReflectance(await read(frame.path), closure, allowLossy));
    return rayFrame(decoded, matrixCamera('archived-closure', decoded.camera));
  }
  if (recipe.format === SPICE_CAMERA_FORMAT || recipe.format === SPICE_CAMERA_COLOR_FORMAT) {
    const spice = spiceDeclaration(recipe);
    const kernels = await loadKernelSet(spice.kernelSet ? await kernelBankPaths(spice.kernelSet, spice.kernels) : spice.kernels.map(path => resolve(sourceDirectory, path)));
    const decoded = refined(decodeSpiceCameraFrame(await read(frame.path), kernels, spice, recipe.filter,
      spice.image.format === 'vicar-pds3' ? (await read(frame.labelPath)).toString('latin1') : undefined));
    return rayFrame(decoded, matrixCamera('kernels', decoded.camera), decoded.colorPlanes);
  }
  if (recipe.format === PDS4_GEOMETRY_CUBE_FORMAT) {
    const decoded = decodePds4GeometryCube(await read(frame.path), (await read(frame.labelPath)).toString('utf8'),
      { fileName: basename(frame.path), cube: cubeDeclaration(recipe), filter: recipe.filter });
    return backplaneFrame(decoded, { reject: i => decoded.acceptPixel(i) ? null : 'quality', report: decoded.qualityReport }, decoded.shapeKernel);
  }
  if (recipe.format === 'amica-gaskell') {
    const decoded = decodeAmicaGeo(await read(frame.path), (await read(frame.labelPath)).toString('ascii'), await read(frame.originalPath), await read(recipe.flatPath));
    return backplaneFrame(decoded, { reject: i => decoded.acceptPixel(i) ? null : 'quality', lossy: () => decoded.qualityReport.outputMode === 'LOSSY', report: decoded.qualityReport }, decoded.shapeModel);
  }
  const decoded = decodeOsirisGeo(await read(frame.path));
  identity(decoded);
  const quality = decodeOsirisQuality(await read(frame.qualityPath), decoded);
  return backplaneFrame(decoded, { reject: i => acceptOsirisQuality(quality.flags[i], allowLossy) ? null : 'quality', lossy: i => Boolean(quality.flags[i] & 8),
    ...(recipe.radiometry === 'radiance-factor' ? { radianceFactor: osirisRadianceFactorScale(decoded.history) } : {}), report: quality.report }, decoded.shapeModel);
}

function displayUnits(recipe: GeoLens, photometry: ObservationPhotometry) {
  const retained = !('referenceDegrees' in recipe.photometry) && recipe.photometry.model === 'retained-observation';
  const quantity = (name: string) => retained ? `relative ${name} with original illumination` : `relative disk-normalized ${name}`;
  return photometry.units ?? `${recipe.format === 'amica-gaskell' ? 'relative flat-fielded detector brightness with approximate disk normalization'
    : ['llorri-camera', 'nh-lorri-camera'].includes(recipe.format) ? 'relative DN/s with original illumination'
    : ['osiris-camera', 'near-msi-camera'].includes(recipe.format) ? quantity('I/F')
    : recipe.format === PDS4_GEOMETRY_CUBE_FORMAT ? quantity(cubeDeclaration(recipe).quantity)
    : recipe.format === SPICE_CAMERA_FORMAT ? quantity(spiceDeclaration(recipe).image.quantity)
    : recipe.radiometry === 'radiance-factor' ? 'relative disk- and phase-normalized I/F' : 'relative disk-normalized radiance'}; linear grayscale display`;
}

export const geoFormat: SurfaceObservationFormat = {
  validate: validateGeoRecipe,
  paths: value => { const recipe = parseGeoLens(value); return [...new Set(recipe.frames.flatMap(frame => consumedPaths(recipe, frame)))]; },
  async load(value, context) {
    const recipe = parseGeoLens(value);
    // One photometric treatment serves every frame of a mosaic.
    const photometry = 'referenceDegrees' in recipe.photometry ? await publishedPhotometry(context.sourceDirectory, context.source.manifest, recipe.photometry) : diskPhotometry(recipe.photometry);
    const frames: ObservationFrame[] = [];
    for (const frame of recipe.frames) {
      const paths = consumedPaths(recipe, frame);
      frames.push(await loadGeoFrame(recipe, frame, { ...context, entries: context.entries.filter(entry => paths.includes(entry.path)) }, photometry));
    }
    const { report: limits, exceeded } = deriveLimits(recipe.transfer, frames, context.config.geometry.radialTerrain.simplification.maximumErrorMeters);
    const range = recipe.display.displayRange, color = schemaOf(recipe.format).color;
    const policy: SurfacePolicy = { format: recipe.format,
      selection: frames.length === 1 ? 'single' : recipe.selection === 'recipe-order' ? 'recipe-order' : 'lowest-emission',
      levelMatching: recipe.levelMatching, samplesPerTriangle: recipe.levelMatching?.samplesPerTriangle ?? 8,
      // A colour product's floating bands are encoded once, after surface transfer, on the shared band display.
      display: { ...(range && color ? { range: 'stated-range', low: range[0], high: range[1], units: color.units,
          colorDisplay: bandColorDisplay(color.bands, color.inputQuantity, range) }
        : { range: 'surface-samples', percentiles: recipe.display.percentiles ?? [], units: displayUnits(recipe, photometry) }), ...displayBasis(recipe.display) }, photometry: photometry.report, retainsIllumination: photometry.retainsIllumination, limits };
    return { frames, policy, exceeded };
  },
};
