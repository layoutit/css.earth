import { isRecord } from '@cssearth/core';
import { KNOWN_OVERVIEWS, knownObject, loadObject } from './object-directory.mts';
import { SOLAR_SYSTEM_ID } from './object-systems.mts';

/** A level of the zoom ladder that is an object (the Milky Way) is seen from inside: its scene has no body, and its camera
 * is centred on the star the zoom came out of. That star is the level's centre: the world's host on a page opened cold,
 * the star whose system the view was handed over from otherwise. Zooming back in returns to it. */
let centreId = SOLAR_SYSTEM_ID;

/** The level object with `id`, when `id` names one. */
export const levelObject = (id: string | null | undefined) => KNOWN_OVERVIEWS.find(level => level.id === id);
export const isLevelObject = (id: string | null | undefined) => levelObject(id) !== undefined;

/** The star the mounted level is centred on. */
export const levelCentre = () => centreId;
export function setLevelCentre(id: string) { centreId = id; }

/** The body the world selects and measures from while scene `objectId` is mounted: the level's centre, or the object itself. */
export const worldSubject = (objectId: string) => isLevelObject(objectId) ? centreId : objectId;

/** A level object's descriptor with its frame moved to its centre: the same sphere and axes, at the centre's place. */
export async function levelViewDescriptor(descriptor: unknown): Promise<unknown> {
  if (!isRecord(descriptor) || typeof descriptor.id !== 'string' || !isLevelObject(descriptor.id) || !isRecord(descriptor.properties) || !isRecord(descriptor.properties.worldFrame)) return descriptor;
  const centre = knownObject(centreId) ?? await loadObject(centreId);
  if (!centre) throw new Error(`${descriptor.id} is centred on ${centreId}, which has no prepared entry.`);
  return { ...descriptor, properties: { ...descriptor.properties, worldFrame: { ...descriptor.properties.worldFrame, originM: centre.worldFrame.originM } } };
}
