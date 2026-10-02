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

// One opacity pair per classification, shared by every body of it.
const opacityByClassification = new Map<string, Readonly<ReturnType<typeof contextAnnotationOpacity>>>();
const annotationOpacities = Object.fromEntries(SCENE_OBJECTS.map(object => {
  let opacity = opacityByClassification.get(object.classification);
  if (!opacity) opacityByClassification.set(object.classification, opacity = Object.freeze(contextAnnotationOpacity(object.classification)));
  return [object.id, opacity];
}));
const asteroidIds = SCENE_OBJECTS.filter(object => object.classification === 'asteroid').map(object => object.id);
// Phones get a lighter scene: no celestial sky cube.
const phone = globalThis.matchMedia?.(MOBILE_VIEWPORT_QUERY).matches === true;
const defaultFeatures: ReadonlySet<string> = new Set(prepared.defaultFeatureIds);
const orbitFeatures: ReadonlySet<string> = new Set(prepared.orbitFeatureIds);
const ordinaryAsteroidIds = SCENE_OBJECTS.filter(object => object.classification === 'asteroid' && !defaultFeatures.has(object.id)).map(object => object.id);
const ordinaryAsteroids: ReadonlySet<string> = new Set(ordinaryAsteroidIds);
// Only notable asteroids are map targets; preparation marks the rest as plain dots (site/build/prepare/prepare-spatial-context.ts),
// with no sprite, caption, hover or click. Their pages stay reachable through search.
// A system the page has not read yet lists its bodies with these flags (site/world-context-plan.mts).
const held = new Set(applicationContext.bodies.map(body => body.id));
const deferred = (applicationContext.deferred ?? []).filter(body => !held.has(body.id));
const plainDotIds = [...applicationContext.bodies, ...deferred].filter(body => body.plainDot).map(body => body.id);
const minorMoonIds = prepared.moons.minor, minorMoons: ReadonlySet<string> = new Set(minorMoonIds);
// Each body's orbit centre, and each named centre's own parent: a circumbinary planet's barycentre leads to its host star.
// A body of a system not read yet leads straight to its star.
const orbitCenters = new Map([...deferred.filter(body => body.host !== body.id).map(body => [body.id, body.host] as const), ...applicationContext.bodies.flatMap(body => 'orbit' in body && body.orbit ? [[body.id, body.orbit.centerBodyId] as const] : []),
  ...Object.entries(applicationContext.orbitCenters ?? {}).map(([id, center]) => [id, center.centerBodyId] as const)]);
const placedStarIds = new Set(SCENE_OBJECTS.filter(object => (object.classification === 'star' || object.classification === 'black-hole') && object.id !== applicationContext.focus.id).map(object => object.id));
// Each body's root and each placed star's members, walked once on the first selection that needs them.
let placedSystems: { readonly rootOf: (id: string) => string; readonly members: ReadonlyMap<string, readonly string[]> } | null = null;
/** The placed star an object belongs to, with every body orbiting that star; empty inside the Solar System. */
function placedSystemOf(id: string): ReadonlySet<string> {
  placedSystems ??= (() => {
    const roots = new Map<string, string>();
    const rootOf = (start: string) => {
      const known = roots.get(start);
      if (known !== undefined) return known;
      let current = start;
      for (let steps = 0; steps <= orbitCenters.size; steps++) { const center = orbitCenters.get(current); if (!center) break; current = center; }
      roots.set(start, current);
      return current;
    };
    const members = new Map<string, string[]>();
    for (const member of orbitCenters.keys()) {
      if (Object.hasOwn(applicationContext.orbitCenters ?? {}, member)) continue;
      const root = rootOf(member);
      if (placedStarIds.has(root)) (members.get(root) ?? members.set(root, []).get(root)!).push(member);
    }
    return { rootOf, members };
  })();
  const root = placedSystems.rootOf(id);
  if (!placedStarIds.has(root)) return new Set();
  return new Set([root, ...placedSystems.members.get(root) ?? []]);
}
const hiddenOrbitIds = prepared.hiddenOrbitIds;
// Every body that orbits another and every centre something orbits; a barycentre's own centre is its host star.
const systemMembers: ReadonlySet<string> = new Set([...orbitCenters].flat());
const annotationPriorities = Object.fromEntries([...SCENE_OBJECTS.map(object =>
  [object.id, object.discovery.illustration && !orbitFeatures.has(object.id) ? 0 : labelImportance(object.classification, defaultFeatures.has(object.id) || object.classification === 'satellite' && !minorMoons.has(object.id), object.discovery.orientationReference ?? 0, object.discovery.featured)]),
  // A body drawn from its astronomy record is a star or planet hosted by a placed star; its tier is that role in its host's
  // system, the one a catalogued planet of that system has.
  ...[...applicationContext.bodies, ...deferred].filter(body => 'unpackaged' in body && body.unpackaged === true).map(body => [body.id, labelImportance('planet')])]);

export const worldVisibilityPolicy = {
  compact: phone, annotationOpacities, annotationPriorities, asteroidIds, ordinaryAsteroidIds, plainDotIds, minorMoonIds, hiddenOrbitIds,
};

/** Visibility of retained world bodies, labels and highlights. */
export function createApplicationWorldVisibility(layer: Pick<ApplicationWorldLayer, 'setBodyVisibility'>, lifetime: SceneLifetime) {
  let illustrations = false;
  let highlighted: string | null = null;
  // A selected body that orbits the Sun draws itself and its orbit, whatever the default context hides. A moon's path
  // follows its family's rule instead.
  let selectedId: string | null = null;
  let openSystem: ReadonlySet<string> = new Set();

  function update() {
    if (lifetime.disposed) return;
    const category = highlighted === null ? undefined : prepared.categoryFrames.get(highlighted);
    const highlightedIds = category?.memberIds, hosts: ReadonlySet<string> = new Set(category?.hostIds);
    const visibility = discoveryVisibility(SCENE_OBJECTS, { illustrations, highlighted, ...(highlightedIds ? { highlightedIds } : {}), defaultFeatures, systemMembers, orbitFeatures });
    layer.setBodyVisibility({
      bodyHidden: visibility.hiddenBodies.filter(id => !openSystem.has(id) && id !== selectedId),
      labelHidden: [...visibility.hiddenLabels, ...plainDotIds].filter(id => !openSystem.has(id) && !hosts.has(id)),
      highlighted: [...visibility.highlightedBodies, ...hosts],
      // Mission targets keep circles; an ordinary asteroid drawn for its highlighted category is a bare dot.
      indicatorHidden: ordinaryAsteroidIds,
      orbitHidden: hiddenOrbitIds.filter(id => id !== selectedId),
    });
  }

  update();

  return {
    selectObject(id: string) {
      if (lifetime.disposed) return;
      // A selected host or moon reveals its satellite family even when illustration models
      // are disabled. Other stars retain their complete planetary system visibility.
      const revealed = ordinaryAsteroids.has(id) || hiddenOrbitIds.includes(id) && !minorMoons.has(id) ? id : null;
      const selectionChanged = selectedId !== revealed;
      selectedId = revealed;
      const family = satelliteSystemByHost(id) ?? satelliteSystemOfMember(id);
      const system = family ? new Set([family.hostId, ...family.memberIds]) : placedSystemOf(id);
      if (selectionChanged || system.size !== openSystem.size || [...system].some(member => !openSystem.has(member))) {
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
