import { OBJECTS } from './objects.mts';
import { OBJECT_DESCRIPTORS } from './prepared-object-catalog.mts';
import discoveries from './prepared-object-discovery.json' with { type: 'json' };
import distances from './prepared-object-distances.json' with { type: 'json' };
import focuses from './prepared-focus-objects.json' with { type: 'json' };
import { record } from './browser-types.mts';

/** One navigable object's prepared entry, as `/objects/<id>/entry.json` serves it to the page's object directory
 * (`object-directory.mts`): a scene object's descriptor with its navigation distance and discovery, or a prepared focus.
 * The registry (`objects.mts`) builds each object from these same records. */
export function objectEntry(id: string): unknown | null {
  const object = OBJECTS.find(candidate => candidate.id === id);
  if (!object) return null;
  if (object.kind === 'prepared-focus') return { kind: 'prepared-focus', focus: focuses.find(focus => focus.id === id) };
  const descriptor = OBJECT_DESCRIPTORS.find(descriptor => record(descriptor) && descriptor.id === id);
  if (!descriptor) throw new Error(`Object ${id} has no prepared descriptor.`);
  return { kind: 'scene', descriptor, distance: Object.getOwnPropertyDescriptor(distances, id)?.value,
    discovery: Object.getOwnPropertyDescriptor(discoveries, id)?.value };
}
export const OBJECT_ENTRY_IDS = OBJECTS.map(object => object.id);
