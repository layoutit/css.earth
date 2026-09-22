import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

type Sky = typeof import('../../../src/platform/prepare-cubic-sky-source.mts');
type Sun = typeof import('../../../src/platform/prepare-directional-sun.mts');
export type StarfieldPlan = ReturnType<Sky['prepareCubicSky']>;
export type SunPlan = ReturnType<Sun['prepareDirectionalSun']>;
export interface SolarSource {
  readonly bodyId: string;
  readonly displayName: string;
}

/** Load native TypeScript preparers with their implementation-owned signatures. */
export async function loadCelestialAdapters() {
  const path = (value: string): string => pathToFileURL(resolve(process.cwd(), value)).href;
  const [objects, sky, sun, contract, scene] = await Promise.all([
    import(path('site/objects.mts')) as Promise<typeof import('../../../site/objects.mts')>,
    import(path('src/platform/prepare-cubic-sky-source.mts')) as Promise<Sky>,
    import(path('src/platform/prepare-directional-sun.mts')) as Promise<Sun>,
    import(path('src/platform/cubic-sky-contract.mts')) as Promise<typeof import('../../../src/platform/cubic-sky-contract.mts')>,
    import(path('tools/objects/solar-system-scene.mts')) as Promise<typeof import('../solar-system-scene.mts')>,
  ]);
  return { requireSceneObject: objects.requireSceneObject, prepareCubicSky: sky.prepareCubicSky, prepareDirectionalSun: sun.prepareDirectionalSun,
    prepareSolarSystemSunPresentation: scene.prepareSolarSystemSunPresentation, cubicSkyCamera: contract.CUBIC_SKY_CAMERA_PRESENTATION_STANDARD };
}
