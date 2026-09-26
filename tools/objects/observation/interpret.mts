import { prepareDefaultCameraAngles, prepareSkyNorthScreenAngleDegrees } from '../../../src/platform/default-camera.mts';
// One `science` adapter for the generic raster lane that dispatches by `science.kind` to the existing
// decoders. Nothing is re-implemented: `./raster.mts` keeps `observationRaster`, the terrestrial lane
// keeps `readObservation`, `loadScienceSurface`/`paintScienceSurface`, the mosaic and observed-colour
// preparers. Every branch returns finished
// RGB(A) pixels at the requested density plus the `nearest` flag the packer needs.
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { readRgba, paintMissingCoverage } from '@cssearth/bake/raster';
import type { ObservationInterpretation, InterpretedSurface, RasterRecipe } from '@cssearth/bake/raster';
import { createSolarSynopticInterpreter, type SynopticRecipe } from './solar-synoptic.mts';
import { array, literal, number, object, optional, parse, string, tuple, union, nil } from '@cssearth/core/schema';
import { createSourceManifest } from '../../../src/platform/source-manifest.mts';
import { requireArray, requireFiniteNumber, requireRecord, requireString, shape, text } from '@cssearth/core';
import { loadSurfaceObservation, type SurfaceObservation } from '../surface-observations/index.mts';
import { requireTerrainMesh, sampleRadialTriangles } from '../terrestrial-layers/radial-mesh.mts';
import { loadPdsRadiusTable } from '../terrestrial-layers/obj-shape.mts';
import { readReconstruction } from '../interferometry/beam-convolve.mts';
import { skyDisplayRaster } from '@cssearth/fits';
import { offLimbPlate } from './off-limb-plate.mts';
import { readObservation } from '../terrestrial-layers/observation-raster.mts';
import { loadScienceSurface, paintScienceSurface, prepareObservedColor, validateScienceQualityMasks } from '../terrestrial-layers/scientific-raster.mts';
import { validateGeologyProfile } from '../terrestrial-layers/categorical-geology.mts';
import { validatePds4ObservationPolicy } from '../terrestrial-layers/observed-pds4.mts';
import { preparePdsByteMosaic } from '../terrestrial-layers/pds-byte-mosaic.mts';
import { prepareControlledOrthographicMosaic } from '../terrestrial-layers/controlled-orthographic-mosaic.mts';
import { loadControlledObservationGeometry, matchObservedColorLevels } from '../terrestrial-layers/photometric-observations.mts';
import { validateCategoricalGrid } from '../terrestrial-layers/index.mts';
import { parseSolidScience, parseSurfaceSource, parseSolidObservation, parseColorPhotometry } from '../terrestrial-layers/solid-source.mts';
import { observationRaster, parseObservationLens, loadNativeObservationPoleSampler } from './raster.mts';
import { loadNativePhotograph, type NativePhotograph } from '../terrestrial-layers/native-photograph-source.mts';
import { preparePdsFloatMap, parsePdsFloatProfile } from './pds-float-map.mts';
import { prepareAkatsukiUviMap } from '../akatsuki/uvi-l3b.mts';
import { loadDiscIntegratedColor } from './disc-integrated-color.mts';
import { loadDiscBandColor } from './disc-band-color.mts';
import { prepareGlbSurface } from '../shape-model/glb-surface.mts';
import { limbDarkeningPlate, loadStellarPhotometricColor } from './stellar/stellar-photometric-color.mts';
import { addSpotOccultationToLimbPlate, parseSpotOccultation, spotDiscCentre } from './stellar/stellar-spot-occultation.mts';
import { addSpotFigureToLimbPlate, parseSpotFigureModel } from './stellar/stellar-spot-figure.mts';
import { encodeBandColor, hostLitGray } from '../color-transfer.mts';
import { prepareControlledMapMosaic, loadControlledMapPoles, matchControlledMapLevels } from './controlled-map-mosaic.mts';

/** The raster recipe facts the interpreter reads: each surface's id, pinned source and science block, plus the emission sizes. */
export interface InterpreterRecipe { readonly surfaces: readonly { id: string; source: string; science?: Record<string, unknown>; nativeSourcePoles?: boolean }[]; readonly emission?: RasterRecipe['emission']; readonly missingCoverage?: RasterRecipe['missingCoverage']; }
interface Options { readonly objectId: string; readonly displayName: string; readonly sourceDirectory: string; readonly recipe: InterpreterRecipe;
  /** Partial restores verify selected source pins and decoder groups; photographs additionally forbid scientific/model changes.
   * Full preparation (and solar synoptic preparation) verifies the entire package. */
  readonly sourceVerification?: 'complete' | 'photographs' | 'selected-surfaces'; }

const plainRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const emissionSchema = object({ offLimbSize: number, limbSize: number, bodyDiameter: number, offLimbOutput: string, limbOutput: string, metadata: plainRecord });
/** Validate a raw raster recipe down to the facts the interpreter needs; the lane validates the rest when it packs. */
export function parseInterpreterRecipe(value: unknown): InterpreterRecipe {
  const missingCoverageSchema = (value: unknown): value is 'gray' | 'dark' => value === 'gray' || value === 'dark';
  const input = parse(value, object({ surfaces: array(object({ id: string, source: string, science: optional(plainRecord), nativeSourcePoles: optional((value): value is boolean => typeof value === 'boolean') })), emission: optional(emissionSchema), missingCoverage: optional(missingCoverageSchema) }), 'raster recipe');
  return { surfaces: input.surfaces, ...(input.emission ? { emission: input.emission } : {}), ...(input.missingCoverage ? { missingCoverage: input.missingCoverage } : {}) };
}
/** Include declared decode dependencies without adding them to the surfaces a partial run packs. */
export function selectSurfaceDependencies(recipe: InterpreterRecipe, ids: readonly string[]): InterpreterRecipe {
  const dependencies = new Map<string, InterpreterRecipe['surfaces'][number]>();
  function include(id: string, ancestors = new Set<string>()) {
    if (ancestors.has(id)) throw new TypeError(`Circular photographic base: ${id}`);
    if (dependencies.has(id)) return;
    const surface = recipe.surfaces.find(candidate => candidate.id === id);
    if (!surface) throw new TypeError(`Missing photographic surface or base: ${id}`);
    const baseId = surface.science?.monochromeBase;
    if (baseId !== undefined) include(requireString(baseId), new Set([...ancestors, id]));
    dependencies.set(id, surface);
  }
  ids.forEach(id => include(id));
  return { ...recipe, surfaces: [...dependencies.values()] };
}
type Surface = Parameters<ObservationInterpretation>[0];
interface Rgb { rgb: Uint8Array; missing: Uint8Array; report?: Record<string, unknown>; }
interface SurfaceObservationScience {
  shape: { path: string; format: string; grid: Record<string, unknown>; radiusKm: number; rows: number; columns: number; flatFaceErrorMeters: number };
  lens: Record<string, unknown> & { frames: readonly unknown[] };
  /** The frame's light outside the silhouette becomes the emission off-limb plate; its turn is derived from the default camera. */
  offLimb?: Record<string, never>;
}
/** `science.shape` is the reference sphere table and its sampling; `science.lens` is one surface-observation lens without its id. */
function parseSurfaceObservationScience(value: Record<string, unknown>): SurfaceObservationScience {
  const unknown = Object.keys(value).filter(key => !['kind', 'shape', 'lens', 'offLimb'].includes(key));
  if (unknown.length) throw new TypeError(`A surface-observation science block declares only shape, lens and offLimb, not ${unknown.join(', ')}.`);
  const shape = requireRecord(value.shape, 'surface-observation shape'), lens = requireRecord(value.lens, 'surface-observation lens');
  const parsed = { path: requireString(shape.path), format: requireString(shape.format), grid: requireRecord(shape.grid, 'shape grid'), radiusKm: requireFiniteNumber(shape.radiusKm),
    rows: requireFiniteNumber(shape.rows), columns: requireFiniteNumber(shape.columns), flatFaceErrorMeters: requireFiniteNumber(shape.flatFaceErrorMeters) };
  if (parsed.format !== 'pds-radius-table' || !Number.isInteger(parsed.rows) || !Number.isInteger(parsed.columns) || parsed.rows < 4 || parsed.columns < 4 || !(parsed.radiusKm > 0)) {
    throw new TypeError('A surface-observation shape is a radius table sampled on an integer latitude and longitude grid.');
  }
  // Flat faces sit inside the sphere by the sagitta of their diagonal; the declared error must cover it.
  const sagitta = parsed.radiusKm * 1000 * (1 - Math.cos(Math.hypot(180 / parsed.rows, 360 / parsed.columns) / 2 * Math.PI / 180));
  if (!(parsed.flatFaceErrorMeters >= sagitta)) throw new TypeError(`A surface-observation shape must declare at least its flat-face error of ${sagitta.toExponential(3)} m.`);
  if (lens.id !== undefined || !Array.isArray(lens.frames)) throw new TypeError('A surface-observation lens takes its id from the surface and lists its frames.');
  const offLimb = value.offLimb === undefined ? undefined : requireRecord(value.offLimb, 'surface-observation offLimb') as Record<string, never>;
  if (offLimb && Object.keys(offLimb).length) throw new TypeError('A surface-observation offLimb block is empty: its turn is derived from the default camera, not authored.');
  return { shape: parsed, lens: lens as SurfaceObservationScience['lens'], ...(offLimb ? { offLimb } : {}) };
}
/** An opaque black disc filling a square plate, its edge antialiased over one pixel. */
function blackDisc(size: number): Uint8Array {
  const data = new Uint8Array(size * size * 4), radius = size / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const coverage = Math.max(0, Math.min(1, radius - Math.hypot(x + 0.5 - radius, y + 0.5 - radius) + 0.5));
    if (coverage > 0) data[(y * size + x) * 4 + 3] = Math.round(255 * coverage);
  }
  return data;
}
const transparentPlates = (offLimb: number, limb: number) => ({
  offLimb: { data: new Uint8Array(offLimb * offLimb * 4), size: offLimb, lossless: true }, limb: { data: new Uint8Array(limb * limb * 4), size: limb, lossless: true } });

const rgb3 = (rgb: Uint8Array, missing: Uint8Array | null, width: number, height: number, nearest: boolean,
  style: RasterRecipe['missingCoverage'] = 'gray'): InterpretedSurface =>
  ({ data: missing ? paintMissingCoverage(rgb, { width, height, channels: 3 }, missing, style) : rgb, channels: 3, nearest });

/** Build the lane's `interpret` adapter once per prepared object. Decoded grids are cached per surface so the
 * two prepared densities decode each source once (the terrestrial lane painted a single @2x atlas). */
const fits = object({ bitpix: number, width: number, height: number, latitude: literal('sine-latitude', 'equirectangular'),
  positiveOnly: optional((v): v is boolean => typeof v === 'boolean'), nearestLatitudeLimit: number,
  color: union(object({ kind: literal('signed-asinh'), palette: array(array(number)), softening: number, maximum: number }),
    object({ kind: literal('positive-log'), palette: array(array(number)), range: tuple(number, number) })) });
const record = object({ file: string, record: string });
const continuum = object({ keywords: string, frames: array(record), limbDarkening: object({ file: string, keywords: string, record: string }),
  maximumLatitudeDegrees: number, palette: object({ intensities: array(number), colors: array(array(number)) }) });
const synoptic = object({
  kind: literal('hmi-continuum-mosaic', 'fits-map'), continuum: optional(continuum), fits: optional(fits),
  polarStabilization: optional(object({ latitudeSegments: number, polarDetailSigma: number })),
  limb: object({ mode: literal('continuum-darkening', 'rim') }),
  offLimb: union(nil, object({ observedFile: string, center: tuple(number, number), radius: number })),
});
/** A synoptic solar map: the HMI continuum mosaic or a FITS synoptic map, with its polar continuation and plates. */
export function parseSynopticRecipe(value: unknown): SynopticRecipe {
  const input = parse(value, synoptic, 'synoptic surface');
  if (input.kind === 'hmi-continuum-mosaic') {
    if (!input.continuum?.frames.length) throw new TypeError('An HMI continuum mosaic names its frames, their keywords and its limb-darkening pair.');
    return { source: { kind: 'hmi-continuum-mosaic', ...input.continuum }, polarStabilization: input.polarStabilization, limb: input.limb, offLimb: input.offLimb };
  }
  if (!input.fits) throw new TypeError('A FITS synoptic map declares its FITS geometry and colour transform.');
  if (input.limb.mode === 'continuum-darkening') throw new TypeError('Continuum limb darkening needs the continuum mosaic source.');
  return { source: { kind: 'fits-map', fits: input.fits }, polarStabilization: input.polarStabilization, limb: input.limb, offLimb: input.offLimb };
}

/** Build the lane's `interpret` adapter once per prepared object: `science.synoptic` selects the solar decoders,
 * `science.kind` the terrestrial, shape-model or static decoders. Decoded grids are cached per surface so the two
 * prepared densities decode each source once. */
export async function createSurfaceInterpreter({ objectId, displayName, sourceDirectory, recipe, sourceVerification = 'complete' }: Options): Promise<ObservationInterpretation> {
  const solar = recipe.emission ? createSolarSynopticInterpreter({ sourceDirectory, emission: recipe.emission }) : null;
  const manifest = createSourceManifest({ objectId: objectId, objectName: displayName, sourceRoot: sourceDirectory }).then(async source => {
    if (sourceVerification === 'complete') await source.verify();
    else for (const surface of recipe.surfaces) {
      const kind = surface.science?.kind ?? 'static-observation';
      if (sourceVerification === 'photographs' && (!['static-observation', 'pds-float-map', 'terrestrial-observation', 'terrestrial-observed-color', 'surface-observation'].includes(String(kind)) ||
          surface.science?.scientific || surface.science?.elevation || surface.science?.synoptic))
        throw new TypeError('A photographic refresh cannot reprepare scientific, modeled or emissive views.');
      // Solar maps use multiple time samples and emission plates; keep their full-package check.
      if (sourceVerification === 'selected-surfaces' && surface.science?.synoptic)
        throw new TypeError('Synoptic surfaces require complete source verification.');
      await source.validatePath(surface.source);
      // The static scientific decoder resolves detached labels beside its primary raster.
      // Other scientific/mosaic decoders validate their declared consumer groups below.
      const scientific = surface.science?.scientific;
      if (sourceVerification === 'selected-surfaces' && plainRecord(scientific) && typeof scientific.labelPath === 'string') {
        const labelPath = surface.source.slice(0, surface.source.lastIndexOf('/') + 1) + scientific.labelPath;
        await source.validatePath(labelPath);
      }
    }
    return source;
  });
  // Surface-only runs must surface a pin failure even when a plain image needs no interpreter callback.
  await manifest;
  // Bound once: a branch below shadows `recipe` with its own science block.
  const missingCoverage = recipe.missingCoverage;
  const surfaces = new Map(recipe.surfaces.map(surface => [surface.id, surface]));
  const observations = new Map<string, Promise<Rgb>>();
  const science = new Map<string, ReturnType<typeof loadScienceSurface>>();
  const nativePhotographs = new Map<string, Promise<NativePhotograph>>();
  const surfaceObservations = new Map<string, Promise<SurfaceObservation>>();
  /** A photograph lens cast onto its reference sphere by the shared surface-observation route (the same validators, footprints,
   * photometry and report as the triangle-atlas lane), delivered as the equirectangular map the band-projected sphere consumes. */
  const surfaceObservation = (surface: Surface, plan: SurfaceObservationScience, height: number): Promise<SurfaceObservation> => {
    let pending = surfaceObservations.get(surface.id);
    if (!pending) {
      pending = (async () => {
        const source = await manifest;
        await source.validatePath(plan.shape.path);
        const grid = requireTerrainMesh(await loadPdsRadiusTable(resolve(sourceDirectory, plan.shape.path), plan.shape.grid));
        // One display unit is the sphere radius; the source mesh is sampled at the table's own step, never simplified.
        const scale = 1 / (plan.shape.radiusKm * 1000);
        const faces = sampleRadialTriangles(grid.sample, plan.shape.rows, plan.shape.columns, scale).map(face => ({ ...face, vertexNormals: [face.normal, face.normal, face.normal] }));
        const radialTerrain = { path: plan.shape.path, format: plan.shape.format, simplification: { method: 'source-mesh', maximumErrorMeters: plan.shape.flatFaceErrorMeters } };
        return loadSurfaceObservation({ sourceDirectory, source, recipe: { id: surface.id, ...plan.lens }, radial: { grid, faces },
          config: { geometry: { radius: 1, radiusKm: plan.shape.radiusKm, radialTerrain }, raster: { height, missingCoverage: recipe.missingCoverage } } });
      })();
      surfaceObservations.set(surface.id, pending);
    }
    return pending;
  };

  /** Terrestrial observation at one density; the monochrome base is filled from the same-density base decode. */
  const observation = (surface: Surface, width: number, height: number): Promise<Rgb> => {
    const key = `${surface.id}@${width}x${height}`;
    let pending = observations.get(key);
    if (!pending) {
      pending = (async () => {
        const plan = parseSolidObservation({ id: surface.id, ...surface.science });
        const source = await manifest;
        const input = source.manifest.inputs.find(entry => entry.id === surface.science.input);
        if (!input || (input as { lensId?: unknown }).lensId !== surface.id || input.path !== surface.source) throw new TypeError(`${objectId}/${surface.id}: science.input must be the pinned observation for this lens.`);
        if (plan.validity.kind === 'pds4-float-rgb') validatePds4ObservationPolicy(plan.validity);
        const entry = parseSurfaceSource(input);
        const decoded = await readObservation(sourceDirectory, entry, plan.validity, width, height);
        if (plan.monochromeBase) {
          const baseSurface = surfaces.get(plan.monochromeBase);
          if (!baseSurface?.science) throw new TypeError(`${objectId}/${surface.id}: monochrome base ${plan.monochromeBase} is not a science surface.`);
          const base = await observation({ id: baseSurface.id, source: baseSurface.source, science: baseSurface.science }, width, height);
          for (let i = 0; i < decoded.missing.length; i++) if (decoded.missing[i] && !base.missing[i]) { decoded.rgb.set(base.rgb.subarray(i * 3, i * 3 + 3), i * 3); decoded.missing[i] = 0; }
        }
        return { rgb: decoded.rgb, missing: decoded.missing, ...('colorDisplay' in decoded ? {report:{colorDisplay:decoded.colorDisplay,sourceGeoreference:decoded.sourceGeoreference}} : {}) };
      })();
      observations.set(key, pending);
    }
    return pending;
  };
  /** Direct pole sampling is an explicit photographic opt-in. It shares the pinned source and validity record
   * with the delivered bands, but never substitutes an approximate map or another lens. */
  const nativePhotograph = (surface: Surface, plan: ReturnType<typeof parseSolidObservation>): Promise<NativePhotograph> => {
    const cached = nativePhotographs.get(surface.id);
    if (cached) return cached;
    const pending = (async (): Promise<NativePhotograph> => {
        const source = await manifest;
        const input = source.manifest.inputs.find(entry => entry.id === surface.science.input);
        if (!input || (input as { lensId?: unknown }).lensId !== surface.id || input.path !== surface.source) {
          throw new TypeError(`${objectId}/${surface.id}: native photographic sampling needs its pinned observation.`);
        }
        const primary = await loadNativePhotograph(sourceDirectory, input, plan.validity);
        if (!plan.monochromeBase) return primary;
        const baseSurface = surfaces.get(plan.monochromeBase);
        if (!baseSurface?.science || typeof baseSurface.science.kind !== 'string' || baseSurface.science.kind !== 'terrestrial-observation') {
          throw new TypeError(`${objectId}/${surface.id}: monochrome base ${plan.monochromeBase} is not a terrestrial observation.`);
        }
        const basePlan = parseSolidObservation({ id: baseSurface.id, ...baseSurface.science });
        const base: NativePhotograph = await nativePhotograph({ id: baseSurface.id, source: baseSurface.source, science: baseSurface.science }, basePlan);
        return { width: primary.width, height: primary.height, sample(longitudeDegrees: number, latitudeDegrees: number, color: number[]) {
          return primary.sample(longitudeDegrees, latitudeDegrees, color) || base.sample(longitudeDegrees, latitudeDegrees, color);
        } };
      })();
    nativePhotographs.set(surface.id, pending);
    return pending;
  };

  /** A controlled mosaic at one density, cached, so a colour lens can use it as its monochrome base. */
  const mosaics = new Map<string, Promise<{ rgb: Uint8Array; missing: Uint8Array }>>();
  const mosaic = (surface: Surface, width: number, height: number) => {
    const key = `${surface.id}@${width}x${height}`;
    let pending = mosaics.get(key);
    if (!pending) {
      pending = (async () => {
        const plan = shape({ format: text, consumer: text })(surface.science);
        const source = await manifest;
        const tiles = await source.validateGroup(plan.consumer);
        const photometry = requireRecord(surface.science).photometry as { consumer?: string } | undefined;
        if (photometry?.consumer) await source.validateGroup(photometry.consumer);
        return plan.format === 'controlled-orthographic'
          ? await prepareControlledOrthographicMosaic(sourceDirectory, tiles, surface.science, width, height)
          : plan.format === 'pds3-byte-equirectangular' ? await preparePdsByteMosaic(sourceDirectory, tiles, width, height)
          : (() => { throw new TypeError(`${objectId}/${surface.id}: mosaic format ${plan.format} is a radial-terrain format.`); })();
      })();
      mosaics.set(key, pending);
    }
    return pending;
  };

  return async (surface, width, height, density = 1) => {
    if (surface.science.synoptic !== undefined) {
      if (!solar) throw new TypeError(`Surface ${surface.id} declares a synoptic map but the raster recipe has no emission block.`);
      const { data, info, plates } = await solar.interpret(parseSynopticRecipe(surface.science.synoptic), resolve(sourceDirectory, surface.source), width, height, density);
      return { data, channels: info.channels, nearest: false, plates };
    }
    const kind = typeof surface.science.kind === 'string' ? surface.science.kind : 'static-observation';
    if (surface.nativeSourcePoles && kind !== 'static-observation') throw new TypeError(`${objectId}/${surface.id}: native source poles currently require a static photographic observation.`);
    switch (kind) {
      case 'pds-float-map': {
        const profile = parsePdsFloatProfile(surface.science);
        await (await manifest).validatePath(surface.source);
        const { rgb, missing } = await preparePdsFloatMap(resolve(sourceDirectory, surface.source), profile, width, height);
        return rgb3(rgb, missing, width, height, false, recipe.missingCoverage);
      }
      case 'akatsuki-uvi-l3b': {
        const { kind: _kind, ...profile } = surface.science;
        await (await manifest).validatePath(surface.source);
        const { rgb, missing, report } = await prepareAkatsukiUviMap(resolve(sourceDirectory, surface.source), profile, width, height);
        return { ...rgb3(rgb, missing, width, height, false, recipe.missingCoverage), report };
      }
      case 'static-observation': {
        // Unchanged: the Moon/Pluto path (coverage grid, signed DEM, tonal presentation, GHRM science).
        const { kind: _kind, ...fields } = surface.science;
        const plan = parseObservationLens({ id: surface.id, input: surface.source, ...fields, ...(surface.nativeSourcePoles ? { nativeSourcePoles: true } : {}) });
        const { data, info } = await observationRaster({ input: resolve(sourceDirectory, surface.source), plan, width, height });
        if (![1, 2, 3, 4].includes(info.channels)) throw new TypeError(`Interpreted surface ${surface.id} has ${info.channels} channels.`);
        const scientific = plan.scientific;
        return { data, channels: info.channels as 1 | 2 | 3 | 4, nearest: scientific?.displaySampling === 'nearest' || Array.isArray(scientific?.categories),
          ...(plan.nativeSourcePoles ? { nativePhotograph: await loadNativeObservationPoleSampler(resolve(sourceDirectory, surface.source), plan) } : {}) };
      }
      case 'terrestrial-observation': {
        const { rgb, missing, report } = await observation(surface, width, height);
        const resampling = requireRecord(surface.science.validity).resampling;
        const plan = parseSolidObservation({ id: surface.id, ...surface.science });
        if(surface.science.detailMosaic!==undefined) {
          const detail=requireRecord(surface.science.detailMosaic);
          if(detail.format!=='controlled-geotiff'||!plan.nativePhotographicSampling)throw new TypeError('Controlled detail requires a native photographic base.');
          const tiles=await (await manifest).validateGroup(requireString(detail.consumer)),profile=requireRecord(detail.profile);
          const result=await prepareControlledMapMosaic(sourceDirectory,tiles,profile,width,height);
          const matching=matchControlledMapLevels(result,{rgb,missing},width,height,detail.levelMatching);
          const poles=await loadControlledMapPoles(sourceDirectory,tiles,profile,new Map(matching.levels.map(level=>[level.id,level.gain])));
          const base=await nativePhotograph(surface,plan);
          return {...rgb3(result.rgb,result.missing,width,height,false, recipe.missingCoverage),report:{...result.report,levelMatching:matching,baseObservation:surface.science.input,baseMeaning:'Published global display mosaic outside controlled photographic coverage.'},
            nativePhotograph:{width:base.width,height:base.height,sample(longitude:number,latitude:number,color:number[]){return poles.sample(longitude,latitude,color)||base.sample(longitude,latitude,color);}}};
        }
        const interpreted = {...rgb3(rgb, missing, width, height, resampling === 'source-georeferenced-nearest', recipe.missingCoverage),...(report?{report}:{})};
        if (plan.nativePhotographicSampling && interpreted.nearest) {
          throw new TypeError(`${objectId}/${surface.id}: native photographic polar sampling does not apply to nearest-sampled data.`);
        }
        return plan.nativePhotographicSampling
          ? { ...interpreted, nativePhotograph: await nativePhotograph(surface, plan) }
          : interpreted;
      }
      case 'terrestrial-scientific': {
        const { kind: _kind, ...lens } = surface.science;
        const parsed = parseSolidScience({ id: surface.id, ...lens });
        if (parsed.path !== surface.source) throw new TypeError(`${objectId}/${surface.id}: science.path must equal the surface source.`);
        validateScienceQualityMasks(parsed);
        if (parsed.format === 'geologic-shapefile') validateGeologyProfile(parsed);
        else validateCategoricalGrid(parsed);
        const source = await manifest;
        await source.validateGroup(parsed.consumer);
        let raster = science.get(surface.id);
        if (!raster) { raster = loadScienceSurface(sourceDirectory, parsed); science.set(surface.id, raster); }
        const { rgb, missing } = paintScienceSurface(await raster, parsed, width, height);
        const painted = rgb3(rgb, missing, width, height, Boolean(parsed.categories) || parsed.displaySampling === 'nearest', recipe.missingCoverage);
        // A self-luminous body (a thermal emission map) owes the emissive presentation its plates; nothing lies beyond its limb.
        return recipe.emission ? { ...painted, plates: transparentPlates(recipe.emission.offLimbSize * density, recipe.emission.limbSize * density) } : painted;
      }
      case 'terrestrial-mosaic': {
        const { rgb, missing } = await mosaic(surface, width, height);
        return rgb3(rgb, missing, width, height, false, recipe.missingCoverage);
      }
      case 'terrestrial-observed-color': {
        const plan = shape({ consumer: text, monochromeBase: text })(surface.science);
        const recipe = requireRecord(surface.science);
        const source = await manifest;
        const photometryRecipe = recipe.photometry === undefined ? null : parseColorPhotometry(recipe.photometry);
        const photometry = photometryRecipe ? { profile: photometryRecipe.profile, geometry: await loadControlledObservationGeometry({ sourceDirectory, entries: (await source.validateGroup(photometryRecipe.consumer)).map(shape({ path: text, id: text, imageId: text })), vectors: photometryRecipe.vectors }) } : null;
        const color = await prepareObservedColor({ sourceDirectory, entries: await source.validateGroup(plan.consumer), profile: recipe.profile, width, height, photometry });
        const baseSurface = surfaces.get(plan.monochromeBase);
        if (!baseSurface?.science) throw new TypeError(`${objectId}/${surface.id}: colour base ${plan.monochromeBase} is not a science surface.`);
        const base = baseSurface.science.kind === 'terrestrial-mosaic' ? await mosaic({ id: baseSurface.id, source: baseSurface.source, science: baseSurface.science }, width, height)
          : await observation({ id: baseSurface.id, source: baseSurface.source, science: baseSurface.science }, width, height);
        if (photometry && !('owners' in color)) throw new Error('Corrected color has no observation ownership.');
        // Observations already carried onto one calibration (band levels) take one pooled brightness gain, never one each.
        const levels = photometryRecipe && 'owners' in color ? matchObservedColorLevels(color, base, { width, height, ...photometryRecipe.levels, pooled: photometryRecipe.profile.bandLevels !== undefined }) : undefined;
        const rgb = color.rgb instanceof Uint8Array ? color.rgb : encodeBandColor(color.rgb,color.missing,color.display);
        for (let i = 0; i < color.missing.length; i++) if (color.missing[i] && !base.missing[i]) { rgb.set(base.rgb.subarray(i * 3, i * 3 + 3), i * 3); color.missing[i] = 0; }
        return {...rgb3(rgb, color.missing, width, height, false, missingCoverage),report:{colorDisplay:color.colorDisplay,sourceIds:color.sourceIds,
          ...('photometry' in color ? {photometry:color.photometry} : {}),...(levels?{levelMatching:levels}:{}),
          monochromeBase:plan.monochromeBase,monochromeMeaning:'Existing display brightness and missing-color fallback; no inferred surface color.'}};
      }
      case 'surface-observation': {
        const plan = parseSurfaceObservationScience(surface.science);
        if (!plan.lens.frames.some(frame => requireRecord(frame).path === surface.source)) throw new TypeError(`${objectId}/${surface.id}: the surface source must be one of the lens frames.`);
        const observation = await surfaceObservation(surface, plan, height);
        // East longitude grows with the column from 0 at the left edge, as the mesh places a planet atlas.
        const { rgb, missing } = observation.preview(width, height);
        if (!recipe.emission) return { ...rgb3(rgb, missing, width, height, false, recipe.missingCoverage), report: observation.report };
        const plates = transparentPlates(recipe.emission.offLimbSize * density, recipe.emission.limbSize * density);
        if (!plan.offLimb) return { ...rgb3(rgb, missing, width, height, false, recipe.missingCoverage), report: observation.report, plates };
        // The off-limb plate is the same frame's light beyond the silhouette, on the lens's stretch and palette; the sphere hides its disc.
        if (plan.lens.frames.length !== 1) throw new TypeError(`${objectId}/${surface.id}: an off-limb plate needs a single-frame lens.`);
        const frame = requireRecord(plan.lens.frames[0]);
        if (frame.encoding !== 'fits-oi-reconstruction') throw new TypeError(`${objectId}/${surface.id}: the off-limb plate reads fits-oi-reconstruction frames only.`);
        const image = readReconstruction(await readFile(resolve(sourceDirectory, requireString(frame.path))));
        // The camera route and the frame's centre use the sky as seen: north on the first row, east on the first column.
        const topDown = skyDisplayRaster(image.values, image.width, image.height, image.axes);
        const center = requireRecord(frame).center as readonly [number, number];
        const discRadiusPx = plan.shape.radiusKm / requireFiniteNumber(frame.rangeKm) / (requireFiniteNumber(frame.pixelAngleMicroradians) * 1e-6);
        const displayRange = requireRecord(observation.report.display), palette = requireRecord(plan.lens.display).palette;
        if (!Array.isArray(palette)) throw new TypeError(`${objectId}/${surface.id}: the off-limb plate needs the lens palette.`);
        const plateSize = recipe.emission.offLimbSize * density;
        // Image-up is celestial north; turn it to where the default view (a self-luminous body faces Earth) shows north.
        const rotationDegrees = prepareSkyNorthScreenAngleDegrees(objectId, prepareDefaultCameraAngles(objectId, { light: 'self' })) - 90;
        const offLimb = offLimbPlate({ width: image.width, height: image.height, values: topDown, center: [requireFiniteNumber(center[0]), requireFiniteNumber(center[1])], discRadiusPx,
          backgroundMaximum: requireFiniteNumber(frame.backgroundMaximum) },
          { low: requireFiniteNumber(displayRange.low), high: requireFiniteNumber(displayRange.high), palette: palette.map(value => requireString(value)), rotationDegrees },
          plateSize, recipe.emission.bodyDiameter * density);
        let outside = 0, total = 0;
        for (let i = 0; i < topDown.length; i++) { const v = topDown[i]!; total += v; if (Math.hypot(i % image.width - center[0], Math.floor(i / image.width) - center[1]) > discRadiusPx) outside += v; }
        return { ...rgb3(rgb, missing, width, height, false, recipe.missingCoverage), plates: { ...plates, offLimb: { data: offLimb, size: plateSize, lossless: false } },
          report: { ...observation.report, offLimb: { source: requireString(frame.path), discRadiusPx, rotationDegrees, fluxFractionOutsideDisc: outside / total,
            meaning: 'The frame\'s light outside the silhouette on the lens display stretch; alpha fades from the stretch low to the background maximum. Inside the disc the plate is hidden by the sphere.' } } };
      }
      case 'glb-base-color': {
        // An illustration: the published model's base-color texture, carried through its own UVs onto the displayed shape.
        // Nothing here is observed; the lens is listed in the object's illustration lenses and never counts as imagery.
        const model = requireString(surface.science.model);
        if (model !== surface.source) throw new TypeError(`${objectId}/${surface.id}: science.model must equal the surface source.`);
        const { pixels } = await prepareGlbSurface(resolve(sourceDirectory, model), width, height);
        return { data: pixels, channels: 4, nearest: false };
      }
      case 'equirectangular-illustration': {
        // An illustration: a published artist's global map, resized unchanged onto the sphere. Its left edge is the map's own 0°
        // column, so longitudes are arbitrary. Nothing here is observed; the lens is listed in the object's illustration lenses.
        await (await manifest).validatePath(surface.source);
        const path = resolve(sourceDirectory, surface.source), { width: sourceWidth = 0, height: sourceHeight = 0 } = await sharp(path).metadata();
        if (sourceWidth !== sourceHeight * 2) throw new RangeError(`${objectId}/${surface.id}: ${surface.source} is ${sourceWidth} × ${sourceHeight}, not a 2:1 equirectangular map.`);
        const data = await readRgba(path, width, height, true);
        if (recipe.emission) return { data, channels: 4, nearest: false, plates: transparentPlates(recipe.emission.offLimbSize * density, recipe.emission.limbSize * density) };
        return { data, channels: 4, nearest: false };
      }
      case 'neutral-shape': {
        // Shape-only display: the shared neutral gray (#808080 sRGB), a display convention rather than a measured colour.
        // The surface source names the authored record that states this, so the manifest still binds the lens.
        // Under `hostLight`, the gray keeps its brightness and takes the chromaticity of the host star's measured colour: a
        // neutral reflector under its own star's light instead of under a white lamp. The host's colour lens is the source.
        const gray = surface.science.hostLight === undefined ? [128, 128, 128] as const : hostLitGray(requireString(requireRecord(surface.science.hostLight, 'science.hostLight').srgb, 'science.hostLight.srgb'));
        const data = Buffer.alloc(width * height * 4);
        for (let offset = 0; offset < data.length; offset += 4) { data[offset] = gray[0]; data[offset + 1] = gray[1]; data[offset + 2] = gray[2]; data[offset + 3] = 255; }
        // An emissive body (a star with no observation) still owes the presentation its off-limb and limb plates: both transparent.
        if (recipe.emission) return { data, channels: 4, nearest: true, plates: transparentPlates(recipe.emission.offLimbSize * density, recipe.emission.limbSize * density) };
        return { data, channels: 4, nearest: true };
      }
      case 'black-shadow': {
        // A black hole's measured shadow, drawn as a black disc that always faces the viewer: the limb plate, which the runtime fits to
        // the silhouette. The sphere itself is not drawn; its texture is plain black for the lens thumbnail. Not a surface.
        const data = Buffer.alloc(width * height * 4);
        for (let offset = 0; offset < data.length; offset += 4) data[offset + 3] = 255;
        if (!recipe.emission) return { data, channels: 4, nearest: true };
        const plates = { ...transparentPlates(recipe.emission.offLimbSize * density, recipe.emission.limbSize * density),
          limb: { data: blackDisc(recipe.emission.limbSize * density), size: recipe.emission.limbSize * density, lossless: true } };
        if (surface.science.offLimb === undefined) return { data, channels: 4, nearest: true, plates };
        // The light around the shadow, as an interferometric image of it shows: the image's own pixels on the off-limb plate,
        // registered by the image's pixel scale to the measured shadow diameter, on the palette and stretch the interferometric
        // star lenses use. The sphere hides the plate inside the silhouette.
        const offLimbRecord = requireRecord(surface.science.offLimb, `${objectId}/${surface.id} black-shadow offLimb`);
        const unknownKeys = Object.keys(offLimbRecord).filter(key => !['path', 'encoding', 'percentiles', 'palette'].includes(key));
        if (unknownKeys.length || offLimbRecord.encoding !== 'fits-oi-reconstruction') throw new TypeError(`${objectId}/${surface.id}: a shadow's offLimb names a fits-oi-reconstruction path, percentiles and palette, not ${unknownKeys.join(', ') || String(offLimbRecord.encoding)}.`);
        const image = readReconstruction(await readFile(resolve(sourceDirectory, requireString(offLimbRecord.path))));
        const [scaleX, scaleY] = image.axes.scale;
        if ((image.axes.unit ?? 'deg') !== 'deg' || Math.abs(scaleX! - scaleY!) > 1e-9 * scaleY!) throw new TypeError(`${objectId}/${surface.id}: the shadow's image needs square pixels in degrees, not ${scaleX} by ${scaleY} ${image.axes.unit ?? 'deg'}.`);
        // The image is phased on the black hole: its reference pixel is the frame's centre, and the shadow is centred on it.
        const crpix = [Number(image.header.CRPIX1), Number(image.header.CRPIX2)];
        if (crpix[0] !== (image.width + 1) / 2 || crpix[1] !== (image.height + 1) / 2) throw new TypeError(`${objectId}/${surface.id}: the shadow's image is referenced at pixel ${crpix.join(', ')}, not its centre.`);
        const measured = requireRecord(JSON.parse(await readFile(resolve(sourceDirectory, surface.source), 'utf8')), `${objectId} measurements`);
        const discRadiusPx = requireFiniteNumber(measured.angularDiameterMas, 'angularDiameterMas') / 2 / (scaleY! * 3.6e6);
        const topDown = skyDisplayRaster(image.values, image.width, image.height, image.axes);
        const lit = Array.from(topDown).filter(value => value > 0).sort((a, b) => a - b);
        const percentiles = requireArray(offLimbRecord.percentiles, 'offLimb percentiles').map(value => requireFiniteNumber(value, 'offLimb percentile'));
        if (percentiles.length !== 2 || !(percentiles[0]! < percentiles[1]!)) throw new TypeError(`${objectId}/${surface.id}: offLimb percentiles are a rising pair, not ${percentiles.join(', ')}.`);
        const at = (percent: number) => lit[Math.min(lit.length - 1, Math.max(0, Math.round(percent / 100 * (lit.length - 1))))]!;
        const low = at(percentiles[0]!), high = at(percentiles[1]!);
        const rotationDegrees = prepareSkyNorthScreenAngleDegrees(objectId, prepareDefaultCameraAngles(objectId, { light: 'self' })) - 90;
        const plateSize = recipe.emission.offLimbSize * density;
        const offLimb = offLimbPlate({ width: image.width, height: image.height, values: topDown, center: [image.width / 2, image.height / 2], discRadiusPx, backgroundMaximum: 0 },
          // Opacity follows the light linearly to the stretch top, as a linear brightness image shows it: faint light fades to the black behind.
          // The reconstruction's light reaches its square field's edge; the outer tenth of the field fades out (presentation).
          { low, high, palette: requireArray(offLimbRecord.palette, 'offLimb palette').map(value => requireString(value)), rotationDegrees, opaqueAt: high,
            edgeFeatherPixels: image.width / 10 }, plateSize, recipe.emission.bodyDiameter * density);
        return { data, channels: 4, nearest: true, plates: { ...plates, offLimb: { data: offLimb, size: plateSize, lossless: false } },
          report: { offLimb: { source: requireString(offLimbRecord.path), discRadiusPx, rotationDegrees, stretch: { low, high, percentiles },
            meaning: 'The image\'s light around the shadow on the display stretch; alpha is the light as a fraction of the stretch top, as a linear brightness image shows it. Inside the silhouette the plate is hidden by the sphere.' } } };
      }
      case 'disc-integrated-color': {
        // An unresolved surface painted with its published whole-disc colour and geometric albedo: one measured mean, no map.
        const source = await manifest;
        const color = await loadDiscIntegratedColor(async path => { await source.validatePath(path); return readFile(resolve(sourceDirectory, path)); },
          surface.science, surface.source);
        const data = Buffer.alloc(width * height * 4);
        for (let offset = 0; offset < data.length; offset += 4) data.set([...color.srgb, 255], offset);
        return { data, channels: 4, nearest: true, report: { discIntegratedColor: { srgb: color.srgb, linearSrgb: color.linear, filterReflectance: color.reflectance,
          meaning: 'Whole-disc colour and V geometric albedo from published photometry, uniform over the body; not a resolved surface map.' } } };
      }
      case 'disc-integrated-band-color': {
        // An unresolved body painted with one false colour from its published flux densities in three infrared bands.
        const source = await manifest;
        const color = await loadDiscBandColor(async path => { await source.validatePath(path); return readFile(resolve(sourceDirectory, path)); }, surface.source);
        if (color.record.objectId !== objectId) throw new TypeError(`${objectId}/${surface.id}: ${surface.source} is the band colour of ${color.record.objectId}.`);
        const data = Buffer.alloc(width * height * 4);
        for (let offset = 0; offset < data.length; offset += 4) data.set([...color.srgb, 255], offset);
        // A self-luminous body owes the presentation its off-limb and limb plates, transparent: no light beyond the silhouette is observed.
        const plates = recipe.emission ? { plates: transparentPlates(recipe.emission.offLimbSize * density, recipe.emission.limbSize * density) } : {};
        return { data, channels: 4, nearest: true, ...plates, report: { discIntegratedBandColor: { srgb: color.srgb, linearDisplay: color.linear, bands: color.record.bands, unit: color.record.unit,
          displayRange: color.record.displayRange, displayRangeSource: color.record.displayRangeSource, source: color.record.source,
          meaning: 'Infrared false colour, uniform over the body: red, green and blue are the published flux densities in three bands, longest wavelength red, over one range shared with the bodies it names; not a natural colour and not a resolved surface map.' } } };
      }
      case 'dayside-thermal-color': {
        // A transiting planet with a measured dayside brightness temperature (secondary eclipse) and no image: the whole disc takes
        // the colour of a black body at that temperature, and the lighting bank turns the day side to its star. Reflected starlight
        // is not added: the eclipse depth at the cited wavelength is thermal, and nothing measured says how much light the planet reflects.
        const source = await manifest;
        const { temperature, color } = await loadStellarPhotometricColor(async path => { await source.validatePath(path); return readFile(resolve(sourceDirectory, path)); }, surface.science, surface.source);
        if (recipe.emission) throw new TypeError(`${objectId}/${surface.id}: a dayside thermal colour belongs to a lit body, not an emissive one.`);
        const data = Buffer.alloc(width * height * 4);
        for (let offset = 0; offset < data.length; offset += 4) data.set([...color.srgb, 255], offset);
        return { data, channels: 4, nearest: true, report: { daysideThermalColor: { srgb: color.srgb, temperature,
          meaning: 'Colour of a black body at the dayside brightness temperature measured in secondary eclipse at the cited wavelength, uniform over the disc; the planet is unresolved, and reflected starlight is not included.' } } };
      }
      case 'stellar-photometric-color': {
        // A self-luminous photosphere with no image: one colour from its measured spectrum or catalogued photometric temperature, no map.
        const source = await manifest;
        const { temperature, spectrum, color, range, limbDarkening, crossCheck } = await loadStellarPhotometricColor(async path => { await source.validatePath(path); return readFile(resolve(sourceDirectory, path)); },
          surface.science, surface.source);
        const data = Buffer.alloc(width * height * 4);
        // A published Roche-von Zeipel fit darkens the surface by latitude (gravity-darkening.mts); otherwise the colour is uniform.
        const gravity = surface.science.gravityDarkening === undefined ? null : await (async () => {
          const path = requireString(surface.science.gravityDarkening, 'science.gravityDarkening');
          await source.validatePath(path);
          const { parseGravityDarkeningRecord, gravityDarkenedRows, meanSurfaceTemperature, surfaceTemperature } = await import('./gravity-darkening.mts');
          const { parseCieTable } = await import('./disc-integrated-color.mts');
          const record = parseGravityDarkeningRecord(JSON.parse(await readFile(resolve(sourceDirectory, path), 'utf8')));
          const { readCie1931ColorMatching } = await import('../../references/reference-bank.mts');
          const colorMatching = parseCieTable((await readCie1931ColorMatching()).toString('utf8'), 3);
          return { record, rows: gravityDarkenedRows(record, color, colorMatching, height), meanK: meanSurfaceTemperature(record), equatorK: surfaceTemperature(record, Math.PI / 2) };
        })();
        for (let offset = 0; offset < data.length; offset += 4) data.set([...(gravity ? gravity.rows[Math.floor(offset / 4 / width)]! : color.srgb), 255], offset);
        if (!recipe.emission) throw new TypeError(`${objectId}/${surface.id}: a stellar colour belongs to an emissive body.`);
        if (surface.science.spotOccultation !== undefined && surface.science.spotFigure !== undefined)
          throw new TypeError(`${objectId}/${surface.id}: choose one spot interpretation per lens.`);
        const plates = transparentPlates(recipe.emission.offLimbSize * density, recipe.emission.limbSize * density);
        // A fitted or explicitly modeled limb-darkening law darkens the disc through the limb plate, fitted edge to edge.
        if (limbDarkening) plates.limb = limbDarkeningPlate(recipe.emission.limbSize * density, limbDarkening.coefficients, color);
        const spot = surface.science.spotOccultation === undefined ? null : await (async () => {
          if (!limbDarkening) throw new TypeError(`${objectId}/${surface.id}: a spot reconstruction requires a limb plate.`);
          const path = requireString(surface.science.spotOccultation, 'science.spotOccultation');
          await source.validatePath(path);
          const event = parseSpotOccultation(JSON.parse(await readFile(resolve(sourceDirectory, path), 'utf8')));
          const { HOSTED_PLANET_IDS, hostedOrbit, BODIES } = await import('@cssearth/astronomy');
          if (!(HOSTED_PLANET_IDS as readonly string[]).includes(event.planet)) throw new TypeError(`${objectId}/${surface.id}: unknown hosted planet ${event.planet}.`);
          const planet = event.planet as (typeof HOSTED_PLANET_IDS)[number];
          if (BODIES[planet].parent !== objectId) throw new TypeError(`${objectId}/${surface.id}: ${event.planet} does not transit this star.`);
          const orbit = hostedOrbit(planet);
          if (orbit.eccentricity !== 0) throw new TypeError(`${objectId}/${surface.id}: spot reconstruction currently requires a circular orbit.`);
          const centre = spotDiscCentre(event, orbit);
          plates.limb = addSpotOccultationToLimbPlate(plates.limb, event, orbit);
          return { source: event.source, transitIndex: event.transitIndex, conjunctionBjdMinus2450000: event.conjunctionBjdMinus2450000,
            minimumAngularRadiusDegrees: event.minimumAngularRadiusDegrees, contrast: event.contrast, midEventOffsetSeconds: event.midEventOffsetSeconds,
            displayCentre: { x: centre.x, y: centre.y }, basis: 'published TESS spot-occultation candidate, minimum circular cap on a fixed camera-facing plate',
            limitations: 'One transit chord, not a full map. Sky orientation and cap shape are display assumptions. TESS-band contrast is applied achromatically to Gaia colour. No rotation or evolution.' };
        })();
        const spotFigure = surface.science.spotFigure === undefined ? null : await (async () => {
          if (!limbDarkening) throw new TypeError(`${objectId}/${surface.id}: a spot figure requires a limb plate.`);
          const path = requireString(surface.science.spotFigure, 'science.spotFigure');
          await source.validatePath(path);
          const model = parseSpotFigureModel(JSON.parse(await readFile(resolve(sourceDirectory, path), 'utf8')));
          await source.validatePath(model.figure);
          const sharp = (await import('sharp')).default;
          const decoded = await sharp(await readFile(resolve(sourceDirectory, model.figure))).raw().toBuffer({ resolveWithObject: true });
          const baked = addSpotFigureToLimbPlate(plates.limb,
            { data: decoded.data, width: decoded.info.width, height: decoded.info.height, channels: decoded.info.channels }, model,
            color, limbDarkening.coefficients);
          plates.limb = baked.plate;
          return { source: model.source, figureUrl: model.figureUrl, publishedMeanCoveringFraction: model.reportedMeanCoveringFraction,
            publishedPhotosphereTemperatureK: model.reportedPhotosphereTemperatureK, publishedSpotTemperatureK: model.reportedSpotTemperatureK,
            spotToPhotosphereTessIntensityRatio: model.spotToPhotosphereTessIntensityRatio,
            projectedSpotFractionInFigure: baked.projectedSpotFraction,
            basis: 'published hypothetical dense-latitudinal-bands illustration, not an observed map',
            limitations: 'Figure 7 left-panel layout is illustrative. Its transit-guide lines are removed. TESS-band intensity is applied achromatically to Gaia colour. The plate is stationary.' };
        })();
        const modeledLimb = limbDarkening !== null && (limbDarkening.recipe.source === 'grid' ||
          ('basis' in limbDarkening.coefficients && limbDarkening.coefficients.basis === 'model-prior'));
        return { data, channels: 4, nearest: true, plates,
          report: { stellarPhotometricColor: { ...(temperature ? { temperature } : { spectrum }), srgb: color.srgb, linearSrgb: color.linear, ...(range ? { srgbAtBounds: range.map(bound => bound.srgb) } : {}),
            ...(crossCheck ? { crossCheck } : {}),
            ...(gravity ? { gravityDarkening: { poleTemperatureK: gravity.record.poleTemperatureK, equatorTemperatureK: gravity.record.equatorTemperatureK ?? null,
              modelEquatorTemperatureK: Math.round(gravity.equatorK),
              meanTemperatureK: Math.round(gravity.meanK), omega: gravity.record.omega, beta: gravity.record.beta, poleSrgb: gravity.rows[0], equatorSrgb: gravity.rows[Math.floor(height / 2)] } } : {}),
            ...(limbDarkening ? { limbDarkening: { law: 'quadratic', ...limbDarkening.coefficients, limbToCentre: 1 - limbDarkening.coefficients.u1 - limbDarkening.coefficients.u2,
              basis: modeledLimb ? 'model' : 'transit-fit',
              ...('fit' in limbDarkening && limbDarkening.fit ? { fit: { all: limbDarkening.fit.all, sectors: limbDarkening.fit.sectors } } : {}) } } : {}),
            ...(spot ? { spotOccultation: spot } : {}),
            ...(spotFigure ? { spotFigure } : {}),
            meaning: `${temperature ? 'Planck colour at the catalogued photometric temperature' : range ? 'Colour of the measured Gaia XP spectrum' : 'Colour of the measured spectrum'}${limbDarkening
              ? `, dimmed toward the limb by a ${modeledLimb ? 'theoretical atmosphere model' : 'law fitted to transits'}; not a resolved photosphere.` : ', uniform over the disc; not a resolved photosphere or limb darkening.'}` } } };
      }
      default: throw new TypeError(`${objectId}/${surface.id}: unknown science kind ${kind}.`);
    }
  };
}
