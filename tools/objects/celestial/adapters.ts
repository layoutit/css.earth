import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readPreparedObjects } from '@cssearth/objects/node';

type Scene = typeof import('@cssearth/bake/presentation');
export type StarfieldPlan = ReturnType<Scene['prepareCubicSky']>;
export type SunPlan = ReturnType<Scene['prepareDirectionalSun']>;
export interface SolarSource {
  readonly bodyId: string;
  readonly displayName: string;
}

/** Load native TypeScript preparers with their implementation-owned signatures. */
export async function loadCelestialAdapters() {
  const path = (value: string): string => pathToFileURL(resolve(process.cwd(), value)).href;
  const objects = readPreparedObjects(process.cwd());
  const [scene, contract, geometry] = await Promise.all([
    import('@cssearth/bake/objects/scene'),
    import('@cssearth/bake/presentation'),
    import(path('src/platform/solar-geometry.mts')) as Promise<typeof import('../../../src/platform/solar-geometry.mts')>,
  ]);
  return { requireSceneObject: objects.requireSceneObject, prepareCubicSky: contract.prepareCubicSky, prepareDirectionalSun: contract.prepareDirectionalSun,
    prepareSolarSystemSunPresentation: (source: SolarSource) => scene.prepareSolarSystemSunPresentation(geometry, source),
    cubicSkyCamera: contract.CUBIC_SKY_CAMERA_PRESENTATION_STANDARD };
}
