/**
 * Georeferenced photographs named by one recipe shape: archive backplanes (OSIRIS GEO, AMICA Gaskell, PDS4 geometry cubes),
 * archived camera closures (OSIRIS reflectance, L'LORRI) and cameras derived from SPICE kernels.
 */
import type { LoadContext, ObservationFrame, ObservationImage, ObservationPhotometry, SurfaceObservationFormat, SurfacePolicy } from '../contract.mts';
import type { NumericRaster } from '../../terrestrial-layers/source-records.mts';
import { parseGeoRecipe, parseSurfaceGeometry, parseGeoCameraClosure, decodeProfile } from '../../terrestrial-layers/source-records.mts';
import { requireString } from '../../../source-values.mts';
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { decodeOsirisGeo, decodeOsirisQuality, acceptOsirisQuality, osirisRadianceFactorScale } from '../../terrestrial-layers/osiris-geo.mts';
import { decodeAmicaGeo } from '../../terrestrial-layers/amica-geo.mts';
import { decodeOsirisReflectance } from '../../terrestrial-layers/archived-camera.mts';
import { decodeLlorri } from '../../terrestrial-layers/llorri-geo.mts';
import { decodeNewHorizonsLorri, decodeArrokothMvic } from '../../terrestrial-layers/new-horizons-geo.mts';
import { validPublishedPhotometryShape } from '../../terrestrial-layers/published-photometry.mts';
import { decodePds4GeometryCube, PDS4_GEOMETRY_CUBE_FORMAT } from '../../terrestrial-layers/pds4-geometry-cube.mts';
import { decodeSpiceCameraFrame, SPICE_CAMERA_FORMAT, ABERRATIONS } from '../../terrestrial-layers/spice-camera.mts';
import { refineCameraByLimb } from '../../terrestrial-layers/limb-refinement.mts';
import { loadKernelSet } from '../../../spice/kernel-set.mts';
import { kernelBankPaths } from '../../../spice/kernel-bank.mts';
import { fittedCamera, matrixCamera } from '../cameras.mts';
import { archiveBackplanes, castSourceRays } from '../geometry.mts';
import { cameraFrame } from '../footprint.mts';
import { diskPhotometry, publishedPhotometry } from '../photometry.mts';
import { deriveLimits, MAXIMUM_SEPARATION_FOOTPRINTS } from '../limits.mts';
import { parseBandColorDisplay } from '../../color-transfer.mts';

type GeoRecipe = ReturnType<typeof parseGeoRecipe>;
export const GEO_FORMATS = ['osiris-geo', 'amica-gaskell', 'osiris-camera', 'llorri-camera', 'nh-lorri-camera', 'nh-mvic-camera', PDS4_GEOMETRY_CUBE_FORMAT, SPICE_CAMERA_FORMAT];
const safePath = (path: unknown) => typeof path === 'string' && path.length > 0 && !path.startsWith('/') && !path.split(/[\\/]/).includes('..');
const positive = (value: number | undefined): value is number => value !== undefined && Number.isFinite(value) && value > 0;
const archivedCamera = (recipe: { format: string }) => ['osiris-camera', 'llorri-camera', 'nh-lorri-camera', 'nh-mvic-camera'].includes(recipe.format);
const kernelCamera = (recipe: { format: string }) => recipe.format === SPICE_CAMERA_FORMAT;
const cubeDeclaration = (recipe: Pick<GeoRecipe, 'cube'>) => { if (!recipe.cube) throw new TypeError('Geometry cube recipes declare their planes and identity.'); return recipe.cube; };
const spiceDeclaration = (recipe: Pick<GeoRecipe, 'spice'>) => { if (!recipe.spice) throw new TypeError('SPICE camera recipes declare their kernels, bodies, instrument and pixel axes.'); return recipe.spice; };
const framePaths = (recipe: Pick<GeoRecipe, 'format' | 'path' | 'labelPath' | 'originalPath' | 'flatPath' | 'cameraPath' | 'qualityPath' | 'spice'>): string[] => (recipe.format === 'amica-gaskell'
  ? [recipe.path, recipe.labelPath, recipe.originalPath, recipe.flatPath]
  : recipe.format === PDS4_GEOMETRY_CUBE_FORMAT ? [recipe.path, recipe.labelPath]
  // Kernels from a shared bank are pinned by the bank's manifest, not the body's; a VICAR frame brings its PDS3 label.
  : kernelCamera(recipe) ? [recipe.path, ...(spiceDeclaration(recipe).image.format === 'vicar-pds3' ? [recipe.labelPath] : []), ...(spiceDeclaration(recipe).kernelSet ? [] : spiceDeclaration(recipe).kernels)]
  : archivedCamera(recipe) ? [recipe.path, recipe.cameraPath, ...(recipe.format === 'nh-mvic-camera' ? [recipe.labelPath] : [])] : [recipe.path, recipe.qualityPath]).map(path => requireString(path, 'source-bound observation path'));
/** One recipe per frame: a mosaic's frame entries override the shared recipe. */
const frameRecipes = (recipe: GeoRecipe) => recipe.frames === undefined ? [{ id: recipe.id, recipe }]
  : recipe.frames.map(frame => ({ id: frame.id, recipe: parseGeoRecipe({ ...recipe, ...frame, id: recipe.id, frames: undefined, selection: undefined, levelMatching: undefined }) }));

function validateGeoRecipe(value: unknown, sourceGeometry: unknown): void {
  const recipe = decodeProfile(parseGeoRecipe, value, 'Invalid source-bound georeferenced observation recipe.'), geometry = parseSurfaceGeometry(sourceGeometry);
  if (recipe.frames !== undefined) {
    const frames = recipe.frames, levels = recipe.levelMatching;
    const ownedPaths = Array.isArray(frames) ? frames.flatMap(frame => framePaths({ ...recipe, ...frame })
      .filter(path => recipe.format !== 'amica-gaskell' || path !== recipe.flatPath)) : [];
    if (!Array.isArray(frames) || frames.length < 2 || frames.length > 8 || recipe.path !== undefined ||
        recipe.qualityPath !== undefined || recipe.labelPath !== undefined || recipe.originalPath !== undefined || recipe.cameraPath !== undefined || recipe.startTime !== undefined ||
        recipe.selection === undefined || !['lowest-emission', 'recipe-order'].includes(recipe.selection) ||
        !levels || !Number.isInteger(levels.samplesPerTriangle) || levels.samplesPerTriangle === undefined || levels.samplesPerTriangle < 4 || levels.samplesPerTriangle > 64 ||
        !Number.isInteger(levels.minimumPairs) || levels.minimumPairs < 64 || levels.minimumPairs > 10000 ||
        !positive(levels.maximumLogMad) || levels.maximumLogMad > .3 || !positive(levels.maximumGain) || levels.maximumGain < 1 || levels.maximumGain > 1.5 ||
        (levels.maximumAngleDegrees !== undefined && (!positive(levels.maximumAngleDegrees) || levels.maximumAngleDegrees >= 90)) ||
        frames.some(frame => !frame || !/^[a-z][a-z0-9-]*$/.test(frame.id) || Object.keys(frame).some(key => !['id', 'path', 'qualityPath', 'labelPath', 'originalPath', 'cameraPath', 'startTime'].includes(key))) ||
        new Set(frames.map(frame => frame.id)).size !== frames.length || new Set(ownedPaths).size !== ownedPaths.length) {
      throw new TypeError('Invalid source-bound georeferenced observation mosaic.');
    }
    for (const frame of frames) validateGeoRecipe({ ...recipe, ...frame, id: recipe.id, frames: undefined, selection: undefined, levelMatching: undefined }, geometry);
    return;
  }
  if (recipe.selection !== undefined || recipe.levelMatching !== undefined) throw new TypeError('Invalid source-bound observation selection.');
  const policy = recipe.transfer, published = 'referenceDegrees' in recipe.photometry ? recipe.photometry : null, photometry = 'referenceDegrees' in recipe.photometry ? null : recipe.photometry;
  const phase = photometry?.phaseCorrection;
  if (recipe.format === 'nh-mvic-camera') {
    const display = parseBandColorDisplay(recipe.colorDisplay,['NIR','RED','BLUE']);
    if (display.inputQuantity !== 'derived-band-value' || display.displayRange[0] !== 0 || recipe.metadata.falseColor !== true ||
        photometry?.model !== 'retained-observation' || recipe.frames !== undefined) throw new TypeError('MVIC color requires source-derived bands, false color and retained illumination.');
  } else if (recipe.colorDisplay !== undefined) throw new TypeError('Only a registered color product declares a band display.');
  if (recipe.radiometry !== undefined && (recipe.format !== 'osiris-geo' || recipe.radiometry !== 'radiance-factor')) throw new TypeError('Invalid observation radiometry.');
  if (phase && (recipe.format !== 'osiris-geo' || recipe.radiometry !== 'radiance-factor' || phase.model !== 'hg-shadow-hiding' ||
      !Number.isFinite(phase.asymmetry) || Math.abs(phase.asymmetry) >= 1 || !positive(phase.amplitude) || !positive(phase.width) ||
      !positive(phase.minimumDegrees) || !(phase.maximumDegrees > phase.minimumDegrees) || phase.maximumDegrees >= 90 ||
      !(phase.referenceDegrees >= phase.minimumDegrees && phase.referenceDegrees <= phase.maximumDegrees) ||
      !positive(phase.maximumGain) || phase.maximumGain < 1 || phase.maximumGain > 1.5)) throw new TypeError('Invalid observation phase correction.');
  const paths = framePaths(recipe), amica = recipe.format === 'amica-gaskell', cube = recipe.format === PDS4_GEOMETRY_CUBE_FORMAT, controlled = archivedCamera(recipe), kernels = kernelCamera(recipe);
  const spice = recipe.spice;
  if (kernels !== (spice !== undefined)) throw new TypeError('Only SPICE camera recipes declare a spice block.');
  if (spice && (spice.kernels.length < 2 || spice.kernels.length > 32 || !Number.isInteger(spice.observer) || !Number.isInteger(spice.target) || spice.observer === spice.target ||
      !Number.isInteger(spice.instrument) || !Number.isInteger(spice.clock.spacecraft) ||
      !(spice.clock.header ? spice.clock.start === undefined && spice.clock.stop === undefined : spice.clock.start && spice.clock.stop) ||
      (spice.kernelSet !== undefined && !/^[a-z][a-z0-9-]*$/u.test(spice.kernelSet)) ||
      (spice.image.format !== undefined && !['fits', 'vicar-pds3'].includes(spice.image.format)) ||
      ((spice.image.format === 'vicar-pds3') !== (spice.clock.start !== undefined) || (spice.image.format === 'vicar-pds3' && !safePath(recipe.labelPath))) || !spice.bodyFrame || !ABERRATIONS.includes(spice.aberration as typeof ABERRATIONS[number]) ||
      spice.pixels.focalLength.unit !== 'mm' || !['micrometre', 'mm'].includes(spice.pixels.pixelPitch.unit) || ![0, 1].includes(spice.pixels.origin) ||
      !['X', '-X', 'Y', '-Y', 'Z', '-Z'].includes(spice.pixels.column) || !['X', '-X', 'Y', '-Y', 'Z', '-Z'].includes(spice.pixels.row) || spice.pixels.column.replace('-', '') === spice.pixels.row.replace('-', '') ||
      (spice.image.plane !== undefined && (!Number.isInteger(spice.image.plane) || spice.image.plane < 1)) || !spice.image.quantity)) throw new TypeError('Invalid SPICE camera declaration.');
  const refinement = recipe.refinement;
  if (refinement !== undefined && (!(kernels || recipe.format === 'osiris-camera') || refinement.method !== 'mesh-limb' ||
      !positive(refinement.maximumCorrectionDegrees) || refinement.maximumCorrectionDegrees > 2 || !positive(refinement.maximumResidualPixels) || refinement.maximumResidualPixels > 5 ||
      !Number.isInteger(refinement.minimumControls) || refinement.minimumControls < 16 || refinement.minimumControls > 5000 ||
      (refinement.threshold !== undefined && !Number.isFinite(refinement.threshold)) ||
      (refinement.searchPixels !== undefined && (!Number.isInteger(refinement.searchPixels) || refinement.searchPixels < 8 || refinement.searchPixels > 512)) ||
      (refinement.maximumControls !== undefined && (!Number.isInteger(refinement.maximumControls) || refinement.maximumControls < 2 * refinement.minimumControls || refinement.maximumControls > 20000)) ||
      (refinement.minimumSharpness !== undefined && (!Number.isFinite(refinement.minimumSharpness) || refinement.minimumSharpness < 0 || refinement.minimumSharpness > 0.9)))) throw new TypeError('Invalid camera limb refinement.');
  const validPhotometry = photometry && (photometry.model === 'lommel-seeliger' ||
    (recipe.format === 'osiris-camera' && photometry.model === 'minnaert' &&
      Number.isFinite(photometry.coefficient) && photometry.coefficient !== undefined && photometry.coefficient >= .5 && photometry.coefficient <= 1 &&
      Number.isFinite(photometry.phaseCoefficientPerDegree) && photometry.phaseCoefficientPerDegree !== undefined && photometry.phaseCoefficientPerDegree >= 0 && photometry.phaseCoefficientPerDegree <= .01) ||
    ((controlled || kernels) && photometry.model === 'retained-observation' && photometry.maximumGain === 1));
  if (!GEO_FORMATS.includes(recipe.format) || !/^[a-z][a-z0-9-]*$/.test(recipe.id) || !/^[a-z][a-z0-9-]*$/.test(recipe.consumer) ||
      !paths.every(safePath) || new Set(paths).size !== paths.length ||
      (amica ? recipe.qualityPath !== undefined || recipe.allowLossy !== true || recipe.filter !== 'V'
        : cube ? recipe.cube === undefined || recipe.qualityPath !== undefined || recipe.originalPath !== undefined || recipe.flatPath !== undefined || recipe.allowLossy !== false
        : kernels ? recipe.qualityPath !== undefined || (recipe.labelPath !== undefined) !== (recipe.spice?.image.format === 'vicar-pds3') || recipe.originalPath !== undefined || recipe.flatPath !== undefined || recipe.cameraPath !== undefined || recipe.allowLossy !== false
        : (recipe.format === 'nh-mvic-camera' ? !safePath(recipe.labelPath) : recipe.labelPath !== undefined) || recipe.originalPath !== undefined || recipe.flatPath !== undefined) ||
      (!cube && recipe.cube !== undefined) ||
      (controlled ? recipe.qualityPath !== undefined : recipe.cameraPath !== undefined) ||
      !recipe.startTime || !recipe.filter || typeof recipe.allowLossy !== 'boolean' ||
      typeof recipe.metadata?.label !== 'string' || !recipe.metadata?.coverage ||
      !geometry || geometry.simplification?.method !== 'source-meshoptimizer' ||
      !positive(policy?.maximumSourceDistanceMeters) || policy.maximumSourceDistanceMeters > geometry.simplification.maximumErrorMeters ||
      // Separation is a fixed distance checked against the frames' measured footprint on load, or a multiple of each sample's own footprint.
      !(policy.maximumSeparationFootprints === undefined ? positive(policy.maximumSeparationMeters)
        : policy.maximumSeparationMeters === undefined && positive(policy.maximumSeparationFootprints) && policy.maximumSeparationFootprints <= MAXIMUM_SEPARATION_FOOTPRINTS) ||
      !positive(policy?.visibilityToleranceMeters) || policy.visibilityToleranceMeters > 1 ||
      !positive(policy?.maximumEmissionDegrees) || policy.maximumEmissionDegrees >= 90 ||
      (published ? !validPublishedPhotometryShape(published, policy.maximumEmissionDegrees) :
      !validPhotometry || !photometry || photometry.referenceIncidenceDegrees !== 0 || photometry.referenceEmissionDegrees !== 0 ||
      !positive(photometry.maximumIncidenceDegrees) || photometry.maximumIncidenceDegrees >= 90 ||
      !positive(photometry.maximumEmissionDegrees) || photometry.maximumEmissionDegrees > policy.maximumEmissionDegrees ||
      !positive(photometry.maximumGain) || photometry.maximumGain > 3) ||
      !Array.isArray(recipe.displayPercentiles) || recipe.displayPercentiles.length !== 2 ||
      !recipe.displayPercentiles.every(Number.isFinite) || recipe.displayPercentiles[0] < 0 || recipe.displayPercentiles[1] > 100 ||
      recipe.displayPercentiles[0] >= recipe.displayPercentiles[1]) throw new TypeError('Invalid source-bound georeferenced observation recipe.');
}

async function loadGeoFrame(recipe: GeoRecipe, id: string, { sourceDirectory, source, radial, config, entries }: LoadContext, photometry: ObservationPhotometry): Promise<ObservationFrame> {
  const paths = framePaths(recipe);
  if (entries.length !== paths.length || !paths.every(path => entries.some(e => e.path === path))) throw new Error('GEO observation must consume its exact pinned image and quality companion.');
  const read = (path: string | undefined) => readFile(resolve(sourceDirectory, requireString(path)));
  const closure = archivedCamera(recipe) ? parseGeoCameraClosure(JSON.parse((await read(recipe.cameraPath)).toString('utf8'))) : null;
  if (closure) {
    const pins = source.manifest?.inputs;
    if (!pins || closure.meshSha256 !== pins.find(e => e.path === config.geometry.radialTerrain.path)?.expectedSha256 ||
        !Array.isArray(closure.provenance) || closure.provenance.length < 3) throw new Error('Camera lacks its exact source-mesh closure.');
    for (const entry of closure.provenance) {
      if (!safePath(entry.path) || !pins.some(e => e.path === entry.path && e.expectedSha256 === entry.sha256)) throw new Error('Camera source provenance changed.');
      await source.validatePath(entry.path);
    }
  }
  const identity = (frame: { startTime?: unknown; filter?: unknown }) => {
    if (frame.startTime !== recipe.startTime || frame.filter !== recipe.filter) throw new Error('GEO observation identity changed.');
    return { startTime: requireString(recipe.startTime), filter: recipe.filter };
  };
  // Registered colour keeps its authored common scale, so its frame computes no pixel percentiles.
  const common = { id, photometry, limits: recipe.transfer, mesh: radial.grid, displayPercentiles: recipe.colorDisplay ? undefined : recipe.displayPercentiles };
  // A declared refinement fits one rotation of the camera to the mesh's lit limb before any geometry is derived.
  const refined = <T extends { camera: unknown; width: number; height: number; planes: Record<string, NumericRaster>; acceptPixel?(index: number): boolean; qualityReport: Record<string, unknown> }>(decoded: T): T => {
    if (!recipe.refinement) return decoded;
    const result = refineCameraByLimb({ ...decoded, planes: { IMAGE: decoded.planes.IMAGE } }, radial.grid, recipe.refinement);
    decoded.qualityReport.refinement = result.report;
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
  if (recipe.format === 'llorri-camera') {
    const decoded = decodeLlorri(await read(recipe.path), closure);
    return rayFrame(decoded, matrixCamera('archived-closure', decoded.camera, decoded));
  }
  if (recipe.format === 'nh-lorri-camera') {
    const decoded = decodeNewHorizonsLorri(await read(recipe.path), closure);
    return rayFrame(decoded, matrixCamera('archived-closure', decoded.camera, decoded));
  }
  if (recipe.format === 'nh-mvic-camera') {
    const decoded = decodeArrokothMvic(await read(recipe.path), closure, (await read(recipe.labelPath)).toString('utf8'));
    return rayFrame(decoded, matrixCamera('archived-closure', decoded.camera, decoded), decoded.colorPlanes);
  }
  if (recipe.format === 'osiris-camera') {
    const decoded = refined(decodeOsirisReflectance(await read(recipe.path), closure, recipe.allowLossy));
    return rayFrame(decoded, matrixCamera('archived-closure', decoded.camera));
  }
  if (kernelCamera(recipe)) {
    const spice = spiceDeclaration(recipe);
    const kernels = await loadKernelSet(spice.kernelSet ? await kernelBankPaths(spice.kernelSet, spice.kernels) : spice.kernels.map(path => resolve(sourceDirectory, path)));
    const decoded = refined(decodeSpiceCameraFrame(await read(recipe.path), kernels, spice, recipe.filter,
      spice.image.format === 'vicar-pds3' ? (await read(recipe.labelPath)).toString('latin1') : undefined));
    return rayFrame(decoded, matrixCamera('kernels', decoded.camera));
  }
  if (recipe.format === PDS4_GEOMETRY_CUBE_FORMAT) {
    const decoded = decodePds4GeometryCube(await read(recipe.path), (await read(recipe.labelPath)).toString('utf8'),
      { fileName: basename(requireString(recipe.path)), cube: cubeDeclaration(recipe), filter: recipe.filter });
    return backplaneFrame(decoded, { reject: i => decoded.acceptPixel(i) ? null : 'quality', report: decoded.qualityReport }, decoded.shapeKernel);
  }
  if (recipe.format === 'amica-gaskell') {
    const decoded = decodeAmicaGeo(await read(recipe.path), (await read(recipe.labelPath)).toString('ascii'), await read(recipe.originalPath), await read(recipe.flatPath));
    return backplaneFrame(decoded, { reject: i => decoded.acceptPixel(i) ? null : 'quality', lossy: () => decoded.qualityReport.outputMode === 'LOSSY', report: decoded.qualityReport }, decoded.shapeModel);
  }
  const decoded = decodeOsirisGeo(await read(recipe.path));
  identity(decoded);
  const quality = decodeOsirisQuality(await read(recipe.qualityPath), decoded);
  return backplaneFrame(decoded, { reject: i => acceptOsirisQuality(quality.flags[i], recipe.allowLossy) ? null : 'quality', lossy: i => Boolean(quality.flags[i] & 8),
    ...(recipe.radiometry === 'radiance-factor' ? { radianceFactor: osirisRadianceFactorScale(decoded.history) } : {}), report: quality.report }, decoded.shapeModel);
}

function displayUnits(recipe: GeoRecipe, photometry: ObservationPhotometry) {
  const retained = !('referenceDegrees' in recipe.photometry) && recipe.photometry.model === 'retained-observation';
  const quantity = (name: string) => retained ? `relative ${name} with original illumination` : `relative disk-normalized ${name}`;
  return photometry.units ?? `${recipe.format === 'amica-gaskell' ? 'relative flat-fielded detector brightness with approximate disk normalization'
    : ['llorri-camera', 'nh-lorri-camera'].includes(recipe.format) ? 'relative DN/s with original illumination'
    : recipe.format === 'osiris-camera' ? quantity('I/F')
    : recipe.format === PDS4_GEOMETRY_CUBE_FORMAT ? quantity(cubeDeclaration(recipe).quantity)
    : kernelCamera(recipe) ? quantity(spiceDeclaration(recipe).image.quantity)
    : recipe.radiometry === 'radiance-factor' ? 'relative disk- and phase-normalized I/F' : 'relative disk-normalized radiance'}; linear grayscale display`;
}

export const geoFormat: SurfaceObservationFormat = {
  validate: validateGeoRecipe,
  paths: value => [...new Set(frameRecipes(parseGeoRecipe(value)).flatMap(frame => framePaths(frame.recipe)))],
  async load(value, context) {
    const recipe = parseGeoRecipe(value);
    // One photometric treatment serves every frame of a mosaic.
    const photometry = 'referenceDegrees' in recipe.photometry ? await publishedPhotometry(context.sourceDirectory, context.source.manifest, recipe.photometry) : diskPhotometry(recipe.photometry);
    const frames: ObservationFrame[] = [];
    for (const frame of frameRecipes(recipe)) {
      const paths = framePaths(frame.recipe);
      frames.push(await loadGeoFrame(frame.recipe, frame.id, { ...context, entries: context.entries.filter(entry => paths.includes(entry.path)) }, photometry));
    }
    const { report: limits, exceeded } = deriveLimits(recipe.transfer, frames, context.config.geometry.radialTerrain.simplification.maximumErrorMeters);
    const colorDisplay = recipe.colorDisplay === undefined ? undefined : parseBandColorDisplay(recipe.colorDisplay,['NIR','RED','BLUE']);
    const policy: SurfacePolicy = { format: recipe.format, maximumSourceDistanceMeters: recipe.transfer.maximumSourceDistanceMeters, precheckDisplayPoint: true,
      selection: recipe.frames === undefined ? 'single' : recipe.selection === 'recipe-order' ? 'recipe-order' : 'lowest-emission',
      levelMatching: recipe.levelMatching, samplesPerTriangle: recipe.levelMatching?.samplesPerTriangle ?? 8,
      display: colorDisplay ? { range: 'authored', low: colorDisplay.displayRange[0], high: colorDisplay.displayRange[1], units: 'archive-derived data numbers; enhanced NIR / RED / BLUE color', colorDisplay }
        : { range: 'reference-pixels', percentiles: recipe.displayPercentiles, units: displayUnits(recipe, photometry) }, photometry: photometry.report, limits };
    return { frames, policy, exceeded };
  },
};
