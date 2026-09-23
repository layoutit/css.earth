import { MOBILE_VIEWPORT_QUERY } from './runtime-policy.mts';
import { SCENE_OBJECTS } from './objects.mts';
import { contextAnnotationOpacity } from '../src/navigation/marker-presentation.mts';
import { discoveryVisibility, isDefaultContextFeature, showsDefaultContextOrbit } from './object-discovery.mts';
import { labelImportance } from '../src/renderers/css/labels/universe-label-policy.ts';
import { APPLICATION_WORLD_CONTEXT as applicationContext } from './world-context-plan.mts';
import { minorMoonOrbitIds } from './moon-orbit-policy.mts';
import type { SceneLifetime } from '@cssearth/engine';
import type { ApplicationWorldLayer, ApplicationWorldMinimap } from './application-world-types.mts';

const annotationOpacities = Object.fromEntries(SCENE_OBJECTS.map(object => [object.id, contextAnnotationOpacity(object.classification)]));
const asteroidIds = SCENE_OBJECTS.filter(object => object.classification === 'asteroid').map(object => object.id);
// Phones get a lighter scene: no celestial sky cube, and no ordinary asteroid markers (see discoveryVisibility).
const phone = globalThis.matchMedia?.(MOBILE_VIEWPORT_QUERY).matches === true;
const ordinaryAsteroidIds = SCENE_OBJECTS.filter(object => object.classification === 'asteroid' && !isDefaultContextFeature(object)).map(object => object.id);
const minorMoonIds = minorMoonOrbitIds(applicationContext.bodies);
const orbitCenters = new Map(applicationContext.bodies.flatMap(body => 'orbit' in body && body.orbit ? [[body.id, body.orbit.centerBodyId] as const] : []));
const placedStarIds = new Set(SCENE_OBJECTS.filter(object => (object.classification === 'star' || object.classification === 'black-hole') && object.id !== applicationContext.focus.id).map(object => object.id));
/** The placed star an object belongs to, with every body orbiting that star; empty inside the Solar System. */
function placedSystemOf(id: string): ReadonlySet<string> {
  const rootOf = (start: string) => { let current = start; for (let steps = 0; steps <= orbitCenters.size; steps++) { const center = orbitCenters.get(current); if (!center) return current; current = center; } return current; };
  const root = rootOf(id);
  if (!placedStarIds.has(root)) return new Set();
  return new Set([root, ...[...orbitCenters.keys()].filter(member => rootOf(member) === root)]);
}
const hiddenOrbitIds = [
  ...SCENE_OBJECTS.filter(object => !showsDefaultContextOrbit(object)).map(object => object.id),
  ...minorMoonIds,
];
const annotationPriorities = Object.fromEntries([...SCENE_OBJECTS.map(object =>
  [object.id, object.discovery.illustration ? 0 : labelImportance(object.classification, isDefaultContextFeature(object) || object.classification === 'satellite' && !minorMoonIds.includes(object.id), object.discovery.orientationReference ?? 0)]),
  // A body drawn from its astronomy record is a star or planet hosted by a placed star; its tier is that role in its host's
  // system, the one a catalogued planet of that system has.
  ...applicationContext.bodies.filter(body => 'unpackaged' in body && body.unpackaged === true).map(body => [body.id, labelImportance('planet')])]);

export const worldVisibilityPolicy = {
  compact: phone, annotationOpacities, annotationPriorities, asteroidIds, ordinaryAsteroidIds, minorMoonIds, hiddenOrbitIds,
};

/** One visibility policy feeds the retained world and its minimap. */
export function createApplicationWorldVisibility(layer: ApplicationWorldLayer, minimap: ApplicationWorldMinimap,
  lifetime: SceneLifetime, publishMinimap: () => void) {
  let illustrations = false;
  let highlighted: string | null = null;
  let openSystem: ReadonlySet<string> = new Set();

  function update() {
    if (lifetime.disposed) return;
    const visibility = discoveryVisibility(SCENE_OBJECTS, { illustrations, highlighted, compact: phone });
    const hiddenBodies = visibility.hiddenBodies.filter(id => !openSystem.has(id));
    layer.setHiddenBodies(hiddenBodies);
    layer.setHiddenLabels(visibility.hiddenLabels.filter(id => !openSystem.has(id)));
    layer.setHighlighted(visibility.highlightedBodies);
    minimap.setHiddenBodies(hiddenBodies);
    publishMinimap();
  }

  // Mission targets keep circles; ordinary asteroids retain a hover/pick target.
  layer.setHiddenIndicators(ordinaryAsteroidIds);
  update();
  layer.setHiddenOrbits(hiddenOrbitIds);

  return {
    selectObject(id: string) {
      if (lifetime.disposed) return;
      // Opening any member of a placed star's system reveals that whole system.
      const system = placedSystemOf(id);
      if (system.size !== openSystem.size || [...system].some(member => !openSystem.has(member))) {
        openSystem = system;
        update();
      }
    },
    setIllustrationModelsEnabled(enabled: boolean) {
      if (lifetime.disposed) return;
      illustrations = enabled === true;
      update();
    },
    setHighlightedClassification(classification: string | null) {
      if (lifetime.disposed) return;
      highlighted = classification;
      update();
    },
  };
}
