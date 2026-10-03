import { readPreparedObjects } from '@cssearth/objects/node';
import { CUBIC_SKY_CAMERA_PRESENTATION_STANDARD, prepareCubicSky, prepareDirectionalSun } from '../../presentation/index.ts';
import { prepareSolarSystemSunPresentation, type SolarGeometry } from '../scene/index.ts';

type Scene = typeof import('../../presentation/index.ts');
export type StarfieldPlan = ReturnType<Scene['prepareCubicSky']>;
export type SunPlan = ReturnType<Scene['prepareDirectionalSun']>;
import type { SolarSource } from '@cssearth/objects';
export type { SolarSource } from '@cssearth/objects';

/** The preparers with their implementation-owned signatures, bound to the solar geometry the host passes in. */
export async function loadCelestialAdapters(geometry: SolarGeometry) {
  const objects = readPreparedObjects(process.cwd());
  return { requireSceneObject: objects.requireSceneObject, prepareCubicSky, prepareDirectionalSun,
    prepareSolarSystemSunPresentation: (source: SolarSource) => prepareSolarSystemSunPresentation(geometry, source),
    cubicSkyCamera: CUBIC_SKY_CAMERA_PRESENTATION_STANDARD };
}
