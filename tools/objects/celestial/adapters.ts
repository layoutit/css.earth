export interface StarfieldPlan { readonly schema: string; }
export interface SunPlan { readonly schema: string; }
export interface MarkerPlan { readonly schema: string; }
export interface SourceObject { readonly distanceAu: number; }
export interface SolarSource {
  readonly bodyId: string;
  readonly displayName: string;
  readonly markerStrip: unknown;
}
export interface PreparedAsset { readonly url: string; readonly bytes: Uint8Array; }
export interface CelestialAdapters {
  requireObject(id: string): SourceObject;
  prepareAstrometricCubeSampling(): unknown;
  prepareCatalogueStars(options: { readonly fovDegrees: number }): Promise<unknown>;
  preparePlanetCubicSky(options: Record<string, unknown>): Promise<StarfieldPlan>;
  preparePlanetDirectionalSun(options: Record<string, unknown>): Promise<SunPlan>;
  prepareSolarSystemMarkerStrip(value: unknown): Promise<{ readonly plan: MarkerPlan; readonly assets: readonly PreparedAsset[] }>;
  prepareSolarSystemSunPresentation(source: SolarSource): unknown;
  cubicSkyCamera: { readonly horizontalFovDegrees: number };
  cubicSkyPoints: unknown;
}

type Module = Record<string, unknown>;
function record(value: unknown, at: string): Module {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${at} module is invalid.`);
  return value as Module;
}
function callable<T>(value: unknown, at: string): T {
  if (typeof value !== 'function') throw new TypeError(`${at} export is missing.`);
  return value as T;
}
async function load(path: string): Promise<Module> { return record(await import(path), path); }

/** The legacy platform stays behind this typed boundary until it is migrated. */
export async function loadCelestialAdapters(): Promise<CelestialAdapters> {
  const root = process.cwd();
  const path = (value: string): string => pathToFileURL(resolve(root, value)).href;
  const [objects, astrometry, catalogue, sky, sun, contract, markers, scene] = await Promise.all([
    load(path('site/objects.mjs')), load(path('src/platform/astrometric-sky-registration.mjs')),
    load(path('src/platform/prepare-catalogue-stars.mjs')), load(path('src/platform/prepare-cubic-sky-source.mjs')),
    load(path('src/platform/prepare-directional-sun.mjs')), load(path('src/platform/cubic-sky-contract.mjs')),
    load(path('tools/objects/solar-system-markers.mjs')), load(path('tools/objects/solar-system-scene.mjs')),
  ]);
  const camera = record(contract.CUBIC_SKY_CAMERA_PRESENTATION_STANDARD, 'cubic sky camera');
  if (typeof camera.horizontalFovDegrees !== 'number') throw new TypeError('Cubic-sky camera contract is invalid.');
  return { requireObject: callable<(id: string) => SourceObject>(objects.requireObject, 'requireObject'), prepareAstrometricCubeSampling: callable<() => unknown>(astrometry.prepareAstrometricCubeSampling, 'prepareAstrometricCubeSampling'), prepareCatalogueStars: callable<(options: { readonly fovDegrees: number }) => Promise<unknown>>(catalogue.prepareCatalogueStars, 'prepareCatalogueStars'), preparePlanetCubicSky: callable<(options: Record<string, unknown>) => Promise<StarfieldPlan>>(sky.preparePlanetCubicSky, 'preparePlanetCubicSky'), preparePlanetDirectionalSun: callable<(options: Record<string, unknown>) => Promise<SunPlan>>(sun.preparePlanetDirectionalSun, 'preparePlanetDirectionalSun'), prepareSolarSystemMarkerStrip: callable<(value: unknown) => Promise<{ readonly plan: MarkerPlan; readonly assets: readonly PreparedAsset[] }>>(markers.prepareSolarSystemMarkerStrip, 'prepareSolarSystemMarkerStrip'), prepareSolarSystemSunPresentation: callable<(source: SolarSource) => unknown>(scene.prepareSolarSystemSunPresentation, 'prepareSolarSystemSunPresentation'), cubicSkyCamera: camera as { readonly horizontalFovDegrees: number }, cubicSkyPoints: contract.CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD };
}
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
