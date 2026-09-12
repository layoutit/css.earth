// One `science` adapter for the generic raster lane that dispatches by `science.kind` to the existing
// decoders. Nothing is re-implemented: `./raster.mts` keeps `observationRaster`, the terrestrial lane
// keeps `readObservation`, `loadScienceSurface`/`paintScienceSurface`, the mosaic and observed-colour
// preparers, and the shape-model lane keeps `prepareGlbSurface`. Every branch returns finished
// RGB(A) pixels at the requested density plus the `nearest` flag the packer needs.
import { resolve } from 'node:path';
import type { ObservationInterpretation, InterpretedSurface } from '../../../src/preparation/raster/index.js';
import type { RasterRecipe } from '../../../src/preparation/raster/index.js';
import { createSolarSynopticInterpreter, type SynopticRecipe } from './solar-synoptic.mts';
import { array, literal, number, object, optional, parse, string, tuple, union, nil } from '../material-composition/data-schema.mts';
import { createSourceManifest } from '../../../src/platform/source-manifest.mts';
import { paintMissingCoverage } from '../../../src/platform/prepare-missing-coverage.mts';
import { requireRecord, requireString } from '../../source-values.mts';
import { readObservation } from '../terrestrial-layers/solid-raster.mts';
import { loadScienceSurface, paintScienceSurface, prepareObservedColor, validateScienceQualityMasks } from '../terrestrial-layers/scientific-raster.mts';
import { validateGeologyProfile } from '../terrestrial-layers/categorical-geology.mts';
import { validatePds4ObservationPolicy } from '../terrestrial-layers/observed-pds4.mts';
import { preparePdsByteMosaic } from '../terrestrial-layers/pds-byte-mosaic.mts';
import { prepareControlledOrthographicMosaic } from '../terrestrial-layers/controlled-orthographic-mosaic.mts';
import { loadControlledObservationGeometry, matchObservedColorLevels } from '../terrestrial-layers/photometric-observations.mts';
import { validateCategoricalGrid } from '../terrestrial-layers/index.mts';
import { parseSolidScience, parseSurfaceSource, parseSolidObservation, parseColorPhotometry } from '../terrestrial-layers/solid-source.mts';
import { shape, text } from '../terrestrial-layers/source-records.mts';
import { prepareGlbSurface } from '../shape-model/glb-surface.mts';
import { observationRaster, parseObservationLens, loadNativeObservationPoleSampler } from './raster.mts';
import { loadNativePhotograph, type NativePhotograph } from '../terrestrial-layers/native-photograph-source.mts';
import { preparePdsFloatMap, parsePdsFloatProfile } from './pds-float-map.mts';

/** The raster recipe facts the interpreter reads: each surface's id, pinned source and science block, plus the emission sizes. */
export interface InterpreterRecipe { readonly surfaces: readonly { id: string; source: string; science?: Record<string, unknown>; nativeSourcePoles?: boolean }[]; readonly emission?: RasterRecipe['emission']; }
interface Options { readonly objectId: string; readonly displayName: string; readonly sourceDirectory: string; readonly recipe: InterpreterRecipe;
  /** A photographic refresh checks its source files and each decoder's dependent groups; a full prepare verifies the whole package. */
  readonly sourceVerification?: 'complete' | 'photographs'; }

const plainRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const emissionSchema = object({ offLimbSize: number, limbSize: number, bodyDiameter: number, offLimbOutput: string, limbOutput: string, metadata: plainRecord });
/** Validate a raw raster recipe down to the facts the interpreter needs; the lane validates the rest when it packs. */
export function parseInterpreterRecipe(value: unknown): InterpreterRecipe {
  const input = parse(value, object({ surfaces: array(object({ id: string, source: string, science: optional(plainRecord), nativeSourcePoles: optional((value): value is boolean => typeof value === 'boolean') })), emission: optional(emissionSchema) }), 'raster recipe');
  return { surfaces: input.surfaces, ...(input.emission ? { emission: input.emission } : {}) };
}
type Surface = Parameters<ObservationInterpretation>[0];
interface Rgb { rgb: Uint8Array; missing: Uint8Array; }
const rgb3 = (rgb: Uint8Array, missing: Uint8Array | null, width: number, height: number, nearest: boolean): InterpretedSurface =>
  ({ data: missing ? paintMissingCoverage(rgb, { width, height, channels: 3 }, missing) : rgb, channels: 3, nearest });

/** Build the lane's `interpret` adapter once per prepared object. Decoded grids are cached per surface so the
 * two prepared densities decode each source once (the terrestrial lane painted a single @2x atlas). */
const fits = object({ bitpix: number, width: number, height: number, latitude: literal('sine-latitude', 'equirectangular'),
  reverseLongitude: optional((v): v is boolean => typeof v === 'boolean'), positiveOnly: optional((v): v is boolean => typeof v === 'boolean'), nearestLatitudeLimit: number,
  color: union(object({ kind: literal('signed-asinh'), palette: array(array(number)), softening: number, maximum: number }),
    object({ kind: literal('positive-log'), palette: array(array(number)), range: tuple(number, number) })) });
const continuum = object({ start: string, stop: string, maximumLatitudeDegrees: number, minimumDiscRadius: number, maximumDiscRadius: number, discBrightnessThreshold: number, solarPoleTiltDegrees: number });
const synoptic = object({
  kind: literal('continuum-disc-mosaic', 'fits-map'), mapFiles: optional(array(string)), continuum: optional(continuum), fits: optional(fits),
  polarStabilization: optional(object({ latitudeSegments: number, polarDetailSigma: number })),
  limb: object({ mode: literal('continuum-darkening', 'rim') }),
  offLimb: union(nil, object({ observedFile: string, center: tuple(number, number), radius: number })),
});
/** A synoptic solar map: the continuum disc mosaic or a FITS synoptic map, with its polar continuation and plates. */
export function parseSynopticRecipe(value: unknown): SynopticRecipe {
  const input = parse(value, synoptic, 'synoptic surface');
  if (input.kind === 'continuum-disc-mosaic') {
    if (!input.mapFiles?.length || !input.continuum) throw new TypeError('A continuum mosaic names its frames and interval.');
    return { source: { kind: 'continuum-disc-mosaic', mapFiles: input.mapFiles, continuum: input.continuum }, polarStabilization: input.polarStabilization, limb: input.limb, offLimb: input.offLimb };
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
  const manifest = createSourceManifest({ planetId: objectId, planetName: displayName, sourceRoot: sourceDirectory }).then(async source => {
    if (sourceVerification === 'complete') await source.verify();
    else for (const surface of recipe.surfaces) {
      const kind = surface.science?.kind ?? 'static-observation';
      if (!['static-observation', 'pds-float-map', 'terrestrial-observation', 'terrestrial-observed-color'].includes(String(kind)) ||
          surface.science?.scientific || surface.science?.elevation || surface.science?.synoptic)
        throw new TypeError('A photographic refresh cannot reprepare scientific, modeled or emissive views.');
      await source.validatePath(surface.source);
    }
    return source;
  });
  // Surface-only runs must surface a pin failure even when a plain image needs no interpreter callback.
  await manifest;
  const surfaces = new Map(recipe.surfaces.map(surface => [surface.id, surface]));
  const observations = new Map<string, Promise<Rgb>>();
  const science = new Map<string, ReturnType<typeof loadScienceSurface>>();
  const nativePhotographs = new Map<string, Promise<NativePhotograph>>();

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
        return { rgb: decoded.rgb, missing: decoded.missing };
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
        return rgb3(rgb, missing, width, height, false);
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
        const { rgb, missing } = await observation(surface, width, height);
        const resampling = requireRecord(surface.science.validity).resampling;
        const plan = parseSolidObservation({ id: surface.id, ...surface.science });
        const interpreted = rgb3(rgb, missing, width, height, resampling === 'source-georeferenced-nearest');
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
        return rgb3(rgb, missing, width, height, Boolean(parsed.categories) || parsed.displaySampling === 'nearest');
      }
      case 'terrestrial-mosaic': {
        const plan = shape({ format: text, consumer: text })(surface.science);
        const source = await manifest;
        const tiles = await source.validateGroup(plan.consumer);
        const photometry = requireRecord(surface.science).photometry as { consumer?: string } | undefined;
        if (photometry?.consumer) await source.validateGroup(photometry.consumer);
        const { rgb, missing } = plan.format === 'controlled-orthographic'
          ? await prepareControlledOrthographicMosaic(sourceDirectory, tiles, surface.science, width, height)
          : plan.format === 'pds3-byte-equirectangular' ? await preparePdsByteMosaic(sourceDirectory, tiles, width, height)
          : (() => { throw new TypeError(`${objectId}/${surface.id}: mosaic format ${plan.format} is a radial-terrain format.`); })();
        return rgb3(rgb, missing, width, height, false);
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
        const base = await observation({ id: baseSurface.id, source: baseSurface.source, science: baseSurface.science }, width, height);
        if (photometry && !('owners' in color)) throw new Error('Corrected color has no observation ownership.');
        if (photometryRecipe && 'owners' in color) matchObservedColorLevels(color, base, { width, height, ...photometryRecipe.levels });
        if (photometry && !color.rgb.every(value => Number.isFinite(value) && value >= 0 && value <= 255)) throw new Error('Corrected observation exceeds the display range.');
        const rgb = color.rgb instanceof Uint8Array ? color.rgb : Buffer.from(color.rgb);
        for (let i = 0; i < color.missing.length; i++) if (color.missing[i] && !base.missing[i]) { rgb.set(base.rgb.subarray(i * 3, i * 3 + 3), i * 3); color.missing[i] = 0; }
        return rgb3(rgb, color.missing, width, height, false);
      }
      case 'glb-base-color': {
        const model = requireString(surface.science.model);
        if (model !== surface.source) throw new TypeError(`${objectId}/${surface.id}: science.model must equal the surface source.`);
        const { pixels } = await prepareGlbSurface(resolve(sourceDirectory, model), width, height);
        return { data: pixels, channels: 4, nearest: false };
      }
      default: throw new TypeError(`${objectId}/${surface.id}: unknown science kind ${kind}.`);
    }
  };
}
