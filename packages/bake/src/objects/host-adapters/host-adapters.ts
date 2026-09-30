import { BODIES, HOSTED_PLANET_IDS, STAR_IDS, type BodyId } from '@cssearth/astronomy';
import { requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import type { ScenePreparationAdapters } from '../../scene/index.ts';
import type { PresentationHostAdapters } from '../../presentation/index.ts';
import { prepareMaterialTracks } from '../../presentation/index.ts';
import { prepareScientificNavigation } from '../layers/terrestrial/index.ts';
import type { SolarGeometry } from '../scene/index.ts';

/** The presentation compiler's host: material tracks and dataset navigation, with the solar geometry the host loads. */
export function presentationHostAdapters(solarGeometry: SolarGeometry): PresentationHostAdapters {
  return { prepareMaterialTracks, prepareDatasetNavigation: (bodyId, focus, camera) => prepareScientificNavigation(solarGeometry, bodyId, focus, camera) };
}

/** Validate external scene records, then call the native TypeScript owners with the solar geometry the host loads. */
export async function loadGeometryAdapters(geometry: SolarGeometry): Promise<ScenePreparationAdapters> {
  const [scene, skyContract] = await Promise.all([
    import('../scene/index.ts'),
    import('../../presentation/index.ts'),
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
          starfield, star: { model: requireString(star.model), systemTransform: requireString(star.systemTransform), axialTiltDegrees: requireFiniteNumber(star.axialTiltDegrees) },
          context: input.worldContext });
      }
      if (!Object.hasOwn(BODIES, input.bodyId)) throw new TypeError('Physical scene requires a known astronomy body.');
      // A placed star is self-luminous: it has a presentation frame and a world frame from its astrometry, but no directional Sun.
      // A planet of another star is lit by its host, not the Sun; its prepared map is emissive, so it carries none either.
      // A placed star lights itself. A planet of another star may carry its own star's light or, where its dataset is a thermal
      // map of its own emission, none; every body the Sun lights must carry the Sun's.
      const unlit = (STAR_IDS as readonly string[]).includes(input.bodyId);
      const optional = (HOSTED_PLANET_IDS as readonly string[]).includes(input.bodyId);
      if (unlit && input.sun !== null) throw new TypeError('A placed star carries no directional light.');
      if (!unlit && !optional && input.sun === null) throw new TypeError('Physical scene requires its prepared directional Sun.');
      return scene.prepareSolarSystemScene(geometry, { bodyId: input.bodyId as BodyId,
        bodyRadiusUnits: input.bodyRadiusUnits, bodyRadiusKilometers: input.bodyRadiusKilometers,
        defaultZoom: requireFiniteNumber(input.defaultZoom), geometryScale: optionalNumber(input.geometryScale),
        starfield, light: (STAR_IDS as readonly string[]).includes(input.bodyId) ? 'self' : (HOSTED_PLANET_IDS as readonly string[]).includes(input.bodyId) ? 'host' : 'sun' });
    },
    bodyFixedSunDirection(id) { const direction = geometry.requireBodyFixedSunDirection(id); return [direction[0], direction[1], direction[2]]; },
    sunReferenceViewDirection(source) { return scene.prepareSolarSystemSunPresentation(geometry, source).referenceViewDirection; },
  };
}
