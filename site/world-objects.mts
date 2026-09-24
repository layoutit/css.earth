import type { ObjectClassification } from './object-schema.mts';
import { parseObjectDiscovery } from './object-discovery.mts';
import { APPLICATION_WORLD_CONTEXT as context } from './world-context-plan.mts';

/** Every packaged body the world draws, in the shape the system helpers (site/object-systems.mts) and world visibility
 * (site/application-world-visibility.mts) read, from the world summary the page already holds: classification, system name
 * and discovery are prepared there, so a page knows every system and every body's visibility without the object registry. */
export const WORLD_OBJECTS = Object.freeze([context.focus, ...context.bodies].flatMap(body => body.classification && body.systemName
  ? [Object.freeze({ id: body.id, name: body.name, systemName: body.systemName, classification: body.classification as ObjectClassification,
      route: `/${body.id}/`, worldFrame: Object.freeze({ originM: body.positionM }), discovery: parseObjectDiscovery(body.discovery) })] : []));
