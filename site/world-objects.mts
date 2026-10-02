import { parseObjectDiscovery, type ObjectClassification, type PreparedWorldContext } from '@cssearth/objects';
import { APPLICATION_WORLD_CONTEXT as context, onWorldSystems } from './world-context-plan.mts';

/** Every packaged body a world plan holds, in the shape the system helpers (site/object-systems.mts) and world visibility
 * (site/application-world-visibility.mts) read: classification, system name and discovery are prepared in the plan, so a
 * page knows the systems and visibility of the bodies it holds without the object registry. A body of a holder the page
 * has not read is not here: it is found through its own entry (site/world-context-plan.mts). */
export function worldObjects(plan: Pick<PreparedWorldContext, 'focus' | 'bodies'>) {
  return Object.freeze([plan.focus, ...plan.bodies].flatMap(body =>
    body.classification && body.systemName ? [Object.freeze({ id: body.id, name: body.name, systemName: body.systemName,
      classification: body.classification as ObjectClassification, route: `/${body.id}/`,
      worldFrame: Object.freeze({ originM: body.positionM }), discovery: parseObjectDiscovery(body.discovery) })] : []));
}
export type WorldObject = ReturnType<typeof worldObjects>[number];

/** The application's world objects: the bodies its plan holds now. It follows the plan, so a holder read later brings
 * its bodies; read it when it is used, never keep a copy. */
export let WORLD_OBJECTS = worldObjects(context);
onWorldSystems(plan => { WORLD_OBJECTS = worldObjects(plan); });
