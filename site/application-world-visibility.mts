import { MOBILE_VIEWPORT_QUERY } from './runtime-policy.mts';
// Every world body's classification and discovery come with the world summary, not the object registry.
import { WORLD_OBJECTS as SCENE_OBJECTS } from './world-objects.mts';
import { contextAnnotationOpacity } from '@cssearth/renderer/navigation/marker-presentation.ts';
import { discoveryVisibility } from '@cssearth/objects';
import { labelImportance } from '@cssearth/renderer/labels/universe-label-policy.ts';
import { APPLICATION_WORLD_CONTEXT as applicationContext } from './world-context-plan.mts';
import { PREPARED_WORLD_PRESENTATION as prepared } from './prepared-world-presentation.mts';
import { satelliteSystemByHost, satelliteSystemOfMember } from './satellite-systems.mts';
import type { SceneLifetime } from '@cssearth/engine';
import type { ApplicationWorldLayer } from './application-world-types.mts';

const annotationOpacities = Object.fromEntries(SCENE_OBJECTS.map(object => [object.id, contextAnnotationOpacity(object.classification)]));
const asteroidIds = SCENE_OBJECTS.filter(object => object.classification === 'asteroid').map(object => object.id);
// Phones get a lighter scene: no celestial sky cube, and no ordinary asteroid markers (see discoveryVisibility).
const phone = globalThis.matchMedia?.(MOBILE_VIEWPORT_QUERY).matches === true;
const defaultFeatures: ReadonlySet<string> = new Set(prepared.defaultFeatureIds);
const orbitFeatures: ReadonlySet<string> = new Set(prepared.orbitFeatureIds);
const ordinaryAsteroidIds = SCENE_OBJECTS.filter(object => object.classification === 'asteroid' && !defaultFeatures.has(object.id)).map(object => object.id);
// Only notable asteroids are map targets; preparation marks the rest as plain dots (site/build/prepare/prepare-spatial-context.ts),
// with no sprite, caption, hover or click. Their pages stay reachable through search.
const plainDotIds = applicationContext.bodies.filter(body => body.plainDot).map(body => body.id);
const minorMoonIds = prepared.moons.minor;
// Each body's orbit centre, and each named centre's own parent: a circumbinary planet's barycentre leads to its host star.
const orbitCenters = new Map([...applicationContext.bodies.flatMap(body => 'orbit' in body && body.orbit ? [[body.id, body.orbit.centerBodyId] as const] : []),
  ...Object.entries(applicationContext.orbitCenters ?? {}).map(([id, center]) => [id, center.centerBodyId] as const)]);
const placedStarIds = new Set(SCENE_OBJECTS.filter(object => (object.classification === 'star' || object.classification === 'black-hole') && object.id !== applicationContext.focus.id).map(object => object.id));
/** The placed star an object belongs to, with every body orbiting that star; empty inside the Solar System. */
function placedSystemOf(id: string): ReadonlySet<string> {
  const rootOf = (start: string) => { let current = start; for (let steps = 0; steps <= orbitCenters.size; steps++) { const center = orbitCenters.get(current); if (!center) return current; current = center; } return current; };
  const root = rootOf(id);
  if (!placedStarIds.has(root)) return new Set();
  return new Set([root, ...[...orbitCenters.keys()].filter(member => !Object.hasOwn(applicationContext.orbitCenters ?? {}, member) && rootOf(member) === root)]);
}
const hiddenOrbitIds = prepared.hiddenOrbitIds;
// Every body that orbits another and every centre something orbits; a barycentre's own centre is its host star.
const systemMembers: ReadonlySet<string> = new Set([...orbitCenters].flat());
const annotationPriorities = Object.fromEntries([...SCENE_OBJECTS.map(object =>
  [object.id, object.discovery.illustration && !orbitFeatures.has(object.id) ? 0 : labelImportance(object.classification, defaultFeatures.has(object.id) || object.classification === 'satellite' && !minorMoonIds.includes(object.id), object.discovery.orientationReference ?? 0, object.discovery.featured)]),
  // A body drawn from its astronomy record is a star or planet hosted by a placed star; its tier is that role in its host's
  // system, the one a catalogued planet of that system has.
  ...applicationContext.bodies.filter(body => 'unpackaged' in body && body.unpackaged === true).map(body => [body.id, labelImportance('planet')])]);

export const worldVisibilityPolicy = {
  compact: phone, annotationOpacities, annotationPriorities, asteroidIds, ordinaryAsteroidIds, plainDotIds, minorMoonIds, hiddenOrbitIds,
};

/** Visibility of retained world bodies, labels and highlights. */
export function createApplicationWorldVisibility(layer: Pick<ApplicationWorldLayer, 'setBodyVisibility'>, lifetime: SceneLifetime) {
  let illustrations = false;
  let highlighted: string | null = null;
  let openSystem: ReadonlySet<string> = new Set();

  function update() {
    if (lifetime.disposed) return;
    const visibility = discoveryVisibility(SCENE_OBJECTS, { illustrations, highlighted, compact: phone, defaultFeatures, systemMembers, orbitFeatures });
    layer.setBodyVisibility({
      bodyHidden: visibility.hiddenBodies.filter(id => !openSystem.has(id)),
      labelHidden: [...visibility.hiddenLabels, ...plainDotIds].filter(id => !openSystem.has(id)),
      highlighted: visibility.highlightedBodies,
      // Mission targets keep circles; ordinary asteroids retain a hover/pick target.
      indicatorHidden: ordinaryAsteroidIds,
      orbitHidden: hiddenOrbitIds,
    });
  }

  update();

  return {
    selectObject(id: string) {
      if (lifetime.disposed) return;
      // A selected host or moon reveals its satellite family even when illustration models
      // are disabled. Other stars retain their complete planetary system visibility.
      const family = satelliteSystemByHost(id) ?? satelliteSystemOfMember(id);
      const system = family ? new Set([family.hostId, ...family.memberIds]) : placedSystemOf(id);
      if (system.size !== openSystem.size || [...system].some(member => !openSystem.has(member))) {
        openSystem = system;
        update();
      }
    },
    setIllustrationModelsEnabled(enabled: boolean) {
      if (lifetime.disposed || illustrations === (enabled === true)) return;
      illustrations = enabled === true;
      update();
    },
    setHighlightedClassification(classification: string | null) {
      if (lifetime.disposed || highlighted === classification) return;
      highlighted = classification;
      update();
    },
  };
}
