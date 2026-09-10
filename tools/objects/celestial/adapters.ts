import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

type Sky = typeof import('../../../src/platform/prepare-cubic-sky-source.mts');
type Sun = typeof import('../../../src/platform/prepare-directional-sun.mts');
type Markers = typeof import('../solar-system-markers.mts');
export type StarfieldPlan = Awaited<ReturnType<Sky['preparePlanetCubicSky']>>;
export type SunPlan = Awaited<ReturnType<Sun['preparePlanetDirectionalSun']>>;
export type MarkerPlan = Awaited<ReturnType<Markers['prepareSolarSystemMarkerStrip']>>['plan'];
export interface SolarSource {
  readonly bodyId: string;
  readonly displayName: string;
  readonly markerStrip: Parameters<Markers['prepareSolarSystemMarkerStrip']>[0];
}

/** Load native TypeScript preparers with their implementation-owned signatures. */
export async function loadCelestialAdapters() {
  const path = (value: string): string => pathToFileURL(resolve(process.cwd(), value)).href;
  const [objects, astrometry, catalogue, sky, sun, contract, markers, scene] = await Promise.all([
    import(path('site/objects.mts')) as Promise<typeof import('../../../site/objects.mts')>,
    import(path('src/platform/astrometric-sky-registration.mts')) as Promise<typeof import('../../../src/platform/astrometric-sky-registration.mts')>,
    import(path('src/platform/prepare-catalogue-stars.mts')) as Promise<typeof import('../../../src/platform/prepare-catalogue-stars.mts')>,
    import(path('src/platform/prepare-cubic-sky-source.mts')) as Promise<Sky>,
    import(path('src/platform/prepare-directional-sun.mts')) as Promise<Sun>,
    import(path('src/platform/cubic-sky-contract.mts')) as Promise<typeof import('../../../src/platform/cubic-sky-contract.mts')>,
    import(path('tools/objects/solar-system-markers.mts')) as Promise<Markers>,
    import(path('tools/objects/solar-system-scene.mts')) as Promise<typeof import('../solar-system-scene.mts')>,
  ]);
  return { requireObject: objects.requireObject, prepareAstrometricCubeSampling: astrometry.prepareAstrometricCubeSampling,
    prepareCatalogueStars: catalogue.prepareCatalogueStars, preparePlanetCubicSky: sky.preparePlanetCubicSky,
    preparePlanetDirectionalSun: sun.preparePlanetDirectionalSun, prepareSolarSystemMarkerStrip: markers.prepareSolarSystemMarkerStrip,
    prepareSolarSystemSunPresentation: scene.prepareSolarSystemSunPresentation,
    cubicSkyCamera: contract.CUBIC_SKY_CAMERA_PRESENTATION_STANDARD, cubicSkyPoints: contract.CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD };
}
