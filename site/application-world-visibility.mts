import { MOBILE_VIEWPORT_QUERY } from './runtime-policy.mts';
// Every world body's classification and discovery come with the world summary, not the object registry.
import { WORLD_OBJECTS, worldObjects, type WorldObject } from './world-objects.mts';
import { contextAnnotationOpacity } from '@cssearth/renderer/navigation/marker-presentation.ts';
import { discoveryVisibility, parseObjectDiscovery, type ObjectClassification, type PreparedContextBody, type PreparedWorldContext } from '@cssearth/objects';
import { labelImportance } from '@cssearth/renderer/labels/universe-label-policy.ts';
import { APPLICATION_WORLD_CONTEXT as applicationContext, loadWorldSystemOf, onWorldSystems } from './world-context-plan.mts';
import { PREPARED_WORLD_PRESENTATION as prepared } from './prepared-world-presentation.mts';
import { satelliteSystemByHost, satelliteSystemOfMember } from './satellite-systems.mts';
import type { SceneLifetime } from '@cssearth/engine';
import type { ApplicationWorldLayer } from './application-world-types.mts';

// Phones get a lighter scene: no celestial sky cube.
const phone = globalThis.matchMedia?.(MOBILE_VIEWPORT_QUERY).matches === true;
const defaultFeatures: ReadonlySet<string> = new Set(prepared.defaultFeatureIds);
const orbitFeatures: ReadonlySet<string> = new Set(prepared.orbitFeatureIds);
const minorMoonIds = prepared.moons.minor, minorMoons: ReadonlySet<string> = new Set(minorMoonIds);
const hiddenOrbitIds = prepared.hiddenOrbitIds;
// One opacity pair per classification, shared by every body of it.
const opacityByClassification = new Map<string, Readonly<ReturnType<typeof contextAnnotationOpacity>>>();
const annotationOpacity = (classification: string) => {
  let opacity = opacityByClassification.get(classification);
  if (!opacity) opacityByClassification.set(classification, opacity = Object.freeze(contextAnnotationOpacity(classification)));
  return opacity;
};

/** The plan a visibility policy reads: the bodies it holds. */
export type VisibilityPlan = Pick<PreparedWorldContext, 'focus' | 'bodies' | 'orbitCenters'>;
type Annotated = Pick<WorldObject, 'id' | 'classification' | 'discovery'>;

/** Each body's annotation strength (by classification) and tier (its classification, whether it is a default feature or a
 * major moon, its orientation reference and whether it is featured). A body drawn from its astronomy record (`unpackaged`)
 * is a star or planet hosted by a placed star; its tier is that role in its host's system, the one a catalogued planet of
 * that system has. */
export function bodyAnnotations(objects: readonly Annotated[], unpackagedIds: Iterable<string> = []) {
  return {
    annotationOpacities: Object.fromEntries(objects.map(object => [object.id, annotationOpacity(object.classification)])),
    annotationPriorities: Object.fromEntries([...objects.map(object =>
      [object.id, object.discovery.illustration && !orbitFeatures.has(object.id) ? 0 : labelImportance(object.classification, defaultFeatures.has(object.id) || object.classification === 'satellite' && !minorMoons.has(object.id), object.discovery.orientationReference ?? 0, object.discovery.featured)]),
      ...[...unpackagedIds].map(id => [id, labelImportance('planet')])]),
  };
}
/** The annotations of bodies another system adds to the world (`addSystems`), from their prepared rows. */
export function annotationsForBodies(bodies: readonly PreparedContextBody[]) {
  const objects = bodies.flatMap(body => body.classification === undefined ? []
    : [{ id: body.id, classification: body.classification as ObjectClassification, discovery: parseObjectDiscovery(body.discovery) }]);
  return bodyAnnotations(objects, bodies.filter(body => body.unpackaged === true).map(body => body.id));
}

/** What the world's visibility reads about a plan's bodies: every map here is by id, so a body of a holder read later
 * is in it once the policy is built from the extended plan (`createApplicationWorldVisibility`). */
export function createWorldVisibilityPolicy(objects: readonly WorldObject[], plan: VisibilityPlan) {
  const asteroidIds = objects.filter(object => object.classification === 'asteroid').map(object => object.id);
  const ordinaryAsteroidIds = objects.filter(object => object.classification === 'asteroid' && !defaultFeatures.has(object.id)).map(object => object.id);
  // Only notable asteroids are map targets; preparation marks the rest as plain dots (site/build/prepare/prepare-spatial-context.ts),
  // with no sprite, caption, hover or click. Their pages stay reachable through search.
  const plainDotIds = plan.bodies.filter(body => body.plainDot).map(body => body.id);
  // Each body's orbit centre, and each named centre's own parent: a circumbinary planet's barycentre leads to its host star.
  const orbitCenters = new Map([...plan.bodies.flatMap(body => 'orbit' in body && body.orbit ? [[body.id, body.orbit.centerBodyId] as const] : []),
    ...Object.entries(plan.orbitCenters ?? {}).map(([id, center]) => [id, center.centerBodyId] as const)]);
  const placedStarIds = new Set(objects.filter(object => (object.classification === 'star' || object.classification === 'black-hole') && object.id !== plan.focus.id).map(object => object.id));
  // Each body's root and each placed star's members, walked once on the first selection that needs them.
  let placedSystems: { readonly rootOf: (id: string) => string; readonly members: ReadonlyMap<string, readonly string[]> } | null = null;
  /** The placed star an object belongs to, with every body orbiting that star; empty inside the Solar System. */
  const placedSystemOf = (id: string): ReadonlySet<string> => {
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
        if (Object.hasOwn(plan.orbitCenters ?? {}, member)) continue;
        const root = rootOf(member);
        if (placedStarIds.has(root)) (members.get(root) ?? members.set(root, []).get(root)!).push(member);
      }
      return { rootOf, members };
    })();
    const root = placedSystems.rootOf(id);
    if (!placedStarIds.has(root)) return new Set();
    return new Set([root, ...placedSystems.members.get(root) ?? []]);
  };
  // Every body that orbits another and every centre something orbits; a barycentre's own centre is its host star.
  const systemMembers: ReadonlySet<string> = new Set([...orbitCenters].flat());
  return Object.freeze({
    compact: phone, objects, ...bodyAnnotations(objects, plan.bodies.filter(body => 'unpackaged' in body && body.unpackaged === true).map(body => body.id)),
    asteroidIds, ordinaryAsteroidIds, ordinaryAsteroids: new Set(ordinaryAsteroidIds) as ReadonlySet<string>, plainDotIds, minorMoonIds, hiddenOrbitIds, systemMembers, placedSystemOf,
  });
}

export const worldVisibilityPolicy = createWorldVisibilityPolicy(WORLD_OBJECTS, applicationContext);

/** Visibility of retained world bodies, labels and highlights. */
export function createApplicationWorldVisibility(layer: Pick<ApplicationWorldLayer, 'setBodyVisibility'>, lifetime: SceneLifetime,
  initialPolicy = worldVisibilityPolicy) {
  let policy = initialPolicy;
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
    const visibility = discoveryVisibility(policy.objects, { illustrations, highlighted, ...(highlightedIds ? { highlightedIds } : {}), defaultFeatures, systemMembers: policy.systemMembers, orbitFeatures });
    layer.setBodyVisibility({
      bodyHidden: visibility.hiddenBodies.filter(id => !openSystem.has(id) && id !== selectedId),
      labelHidden: [...visibility.hiddenLabels, ...policy.plainDotIds].filter(id => !openSystem.has(id) && !hosts.has(id)),
      highlighted: [...visibility.highlightedBodies, ...hosts],
      // Mission targets keep circles; an ordinary asteroid drawn for its highlighted category is a bare dot.
      indicatorHidden: policy.ordinaryAsteroidIds,
      orbitHidden: policy.hiddenOrbitIds.filter(id => id !== selectedId),
    });
  }

  update();
  // A system read later: the policy is built again over the extended plan, and the layer told what it adds.
  lifetime.onDispose(onWorldSystems(plan => {
    policy = createWorldVisibilityPolicy(worldObjects(plan), plan);
    update();
  }));

  return {
    selectObject(id: string) {
      if (lifetime.disposed) return;
      // A selected host or moon reveals its satellite family even when illustration models
      // are disabled. Other stars retain their complete planetary system visibility.
      const revealed = policy.ordinaryAsteroids.has(id) || policy.hiddenOrbitIds.includes(id) && !minorMoons.has(id) ? id : null;
      const selectionChanged = selectedId !== revealed;
      selectedId = revealed;
      const family = satelliteSystemByHost(id) ?? satelliteSystemOfMember(id);
      const system = family ? new Set([family.hostId, ...family.memberIds]) : policy.placedSystemOf(id);
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
      // The category's marked members may orbit stars whose holders are not read: each joins the world as it arrives, and
      // the policy built over the extended plan marks it (onWorldSystems above).
      const frame = classification === null ? undefined : prepared.categoryFrames.get(classification);
      for (const host of frame?.hostIds ?? []) void loadWorldSystemOf(host)?.catch(error => console.error(`The holder of ${host} could not be read for its category.`, error));
    },
  };
}
