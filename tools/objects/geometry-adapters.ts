import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { BODIES, type BodyId } from '@cssearth/astronomy';
import { requireFiniteNumber, requireRecord, requireString } from '../source-values.mts';
import type { ScenePreparationAdapters } from '../../src/renderers/css/preparation/scene/index.js';

/** Validate external scene records, then call the native TypeScript owners. */
export async function loadGeometryAdapters(): Promise<ScenePreparationAdapters> {
  const path = (value: string): string => pathToFileURL(resolve(process.cwd(), value)).href;
  const [scene, geometry, skyContract, sunContract] = await Promise.all([
    import(path('tools/objects/solar-system-scene.mts')) as Promise<typeof import('./solar-system-scene.mts')>,
    import(path('src/platform/solar-geometry.mts')) as Promise<typeof import('../../src/platform/solar-geometry.mts')>,
    import(path('src/platform/cubic-sky-contract.mts')) as Promise<typeof import('../../src/platform/cubic-sky-contract.mts')>,
    import(path('src/platform/directional-sun-contract.mts')) as Promise<typeof import('../../src/platform/directional-sun-contract.mts')>,
  ]);
  const optionalNumber = (value: unknown) => value === undefined ? undefined : requireFiniteNumber(value);
  return {
    async preparePhysicalScene(input) {
      const starfield = skyContract.validatePreparedCubicSky(input.starfield, { requireSun: false });
      if (input.worldContext !== undefined) {
        // A body the ephemeris tables do not place (the Sun) carries an authored world context and star axis.
        const star = requireRecord(requireRecord(input).star, 'star presentation');
        if (input.sun !== null) throw new TypeError('A star-centred scene carries no directional Sun.');
        return scene.prepareStarCentredScene({ bodyId: input.bodyId,
          bodyRadiusUnits: input.bodyRadiusUnits, bodyRadiusKilometers: input.bodyRadiusKilometers,
          defaultZoom: requireFiniteNumber(input.defaultZoom), geometryScale: optionalNumber(input.geometryScale),
          initialScenePitchDegrees: optionalNumber(input.initialScenePitchDegrees), defaultControlYawDegrees: optionalNumber(input.defaultControlYawDegrees),
          starfield, star: { model: requireString(star.model), systemTransform: requireString(star.systemTransform), axialTiltDegrees: requireFiniteNumber(star.axialTiltDegrees) },
          context: input.worldContext });
      }
      if (!Object.hasOwn(BODIES, input.bodyId)) throw new TypeError('Physical scene requires a known astronomy body.');
      if (input.sun === null) throw new TypeError('Physical scene requires its prepared directional Sun.');
      const registration = requireRecord(input.starfield.astrometricRegistration);
      return scene.prepareSolarSystemScene({ bodyId: input.bodyId as BodyId,
        bodyRadiusUnits: input.bodyRadiusUnits, bodyRadiusKilometers: input.bodyRadiusKilometers,
        defaultZoom: requireFiniteNumber(input.defaultZoom), geometryScale: optionalNumber(input.geometryScale),
        initialScenePitchDegrees: optionalNumber(input.initialScenePitchDegrees), defaultControlYawDegrees: optionalNumber(input.defaultControlYawDegrees),
        starfield: { ...starfield, astrometricRegistration: { ...registration, cubeFrame: requireString(registration.cubeFrame) } },
        sun: sunContract.validateDirectionalSunPlan(input.sun) });
    },
    bodyFixedSunDirection(id) { const direction = geometry.requireBodyFixedSunDirection(id); return [direction[0], direction[1], direction[2]]; },
    sunReferenceViewDirection(source) { return scene.prepareSolarSystemSunPresentation(source).referenceViewDirection; },
  };
}
