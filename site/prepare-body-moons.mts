import { PLANET_SEARCH_OBJECTS } from './planet-search-objects.mts';
import { isSceneObject } from './prepared-focus-object.mts';
import preparedWorld from '../src/objects/sun/prepared/world-context.json' with { type: 'json' };

export function prepareBodyMoons(objectId: string) {
  const children = new Set(preparedWorld.bodies
    .filter(body => body.orbit?.centerBodyId === objectId).map(body => body.id));
  return PLANET_SEARCH_OBJECTS.filter(isSceneObject).filter(object =>
    object.classification === 'satellite' && children.has(object.id));
}
