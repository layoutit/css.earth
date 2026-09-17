import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { BODIES, HOSTED_PLANET_IDS, STAR_IDS, type BodyId } from '@cssearth/astronomy';
import { requireFiniteNumber, requireRecord, requireString } from '../source-values.mts';
import type { ScenePreparationAdapters } from '../../src/renderers/css/preparation/scene/index.js';

/** Validate external scene records, then call the native TypeScript owners. */
export async function loadGeometryAdapters(): Promise<ScenePreparationAdapters> {
  const path = (value: string): string => pathToFileURL(resolve(process.cwd(), value)).href;
  const [scene, geometry, skyContract] = await Promise.all([
    import(path('tools/objects/solar-system-scene.mts')) as Promise<typeof import('./solar-system-scene.mts')>,
    import(path('src/platform/solar-geometry.mts')) as Promise<typeof import('../../src/platform/solar-geometry.mts')>,
    import(path('src/platform/cubic-sky-contract.mts')) as Promise<typeof import('../../src/platform/cubic-sky-contract.mts')>,
  ]);
  const optionalNumber = (value: unknown) => value === undefined ? undefined : requireFiniteNumber(value);
  return {
    async preparePhysicalScene(input) {
      const starfield = skyContract.validatePreparedCubicSky(input.starfield);
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
      // A placed star is self-luminous: it has a presentation frame and a world frame from its astrometry, but no directional Sun.
      // A planet of another star is lit by its host, not the Sun; its prepared map is emissive, so it carries none either.
      const unlit = (STAR_IDS as readonly string[]).includes(input.bodyId) || (HOSTED_PLANET_IDS as readonly string[]).includes(input.bodyId);
      if ((input.sun === null) !== unlit) throw new TypeError(unlit ? 'A placed star or hosted planet carries no directional Sun.' : 'Physical scene requires its prepared directional Sun.');
      return scene.prepareSolarSystemScene({ bodyId: input.bodyId as BodyId,
        bodyRadiusUnits: input.bodyRadiusUnits, bodyRadiusKilometers: input.bodyRadiusKilometers,
        defaultZoom: requireFiniteNumber(input.defaultZoom), geometryScale: optionalNumber(input.geometryScale),
        initialScenePitchDegrees: optionalNumber(input.initialScenePitchDegrees), defaultControlYawDegrees: optionalNumber(input.defaultControlYawDegrees),
        starfield });
    },
    bodyFixedSunDirection(id) { const direction = geometry.requireBodyFixedSunDirection(id); return [direction[0], direction[1], direction[2]]; },
    sunReferenceViewDirection(source) { return scene.prepareSolarSystemSunPresentation(source).referenceViewDirection; },
  };
}
