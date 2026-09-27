import { readPreparedObjects } from '@cssearth/objects/node';
import { CUBIC_SKY_CAMERA_PRESENTATION_STANDARD, prepareCubicSky, prepareDirectionalSun } from '../../presentation/index.ts';
import type { SolarGeometry } from './solar-geometry.ts';
import { prepareSolarSystemSunPresentation } from './solar-system-scene.ts';

type Scene = typeof import('../../presentation/index.ts');
export type StarfieldPlan = ReturnType<Scene['prepareCubicSky']>;
export type SunPlan = ReturnType<Scene['prepareDirectionalSun']>;
export interface SolarSource {
  readonly bodyId: string;
  readonly displayName: string;
}

/** The preparers with their implementation-owned signatures, bound to the solar geometry the host passes in. */
export async function loadCelestialAdapters(geometry: SolarGeometry) {
  const objects = readPreparedObjects(process.cwd());
  return { requireSceneObject: objects.requireSceneObject, prepareCubicSky, prepareDirectionalSun,
    prepareSolarSystemSunPresentation: (source: SolarSource) => prepareSolarSystemSunPresentation(geometry, source),
    cubicSkyCamera: CUBIC_SKY_CAMERA_PRESENTATION_STANDARD };
}
