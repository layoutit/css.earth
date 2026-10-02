import { isRecord } from '@cssearth/core';
import { KNOWN_OVERVIEWS, knownObject, loadObject } from './object-directory.mts';
import { SOLAR_SYSTEM_ID } from './object-systems.mts';

/** A level of the zoom ladder that is an object (the Milky Way) is seen from inside: its scene has no body, and its camera
 * is centred on the star the zoom came out of. That star is the level's centre: the world's host on a page opened cold,
 * the star whose system the view was handed over from otherwise. Zooming back in returns to it. */
let centreId = SOLAR_SYSTEM_ID;

const isLevel = (id: string | null | undefined) => KNOWN_OVERVIEWS.some(level => level.id === id);

/** The star the view was last centred on: a level mounted next is seen around it. */
export function setLadderCentre(id: string) { centreId = id; }

/**
 * Where a selection stands on the zoom ladder: its scope (a star's own `system`, or a level's id) and the star the scope is
 * measured from. Null for a selection on a body, which is below the ladder. A star's system view and a level are rungs of
 * the same ladder; everything that follows the ladder (the world's overview scope, the readout, the opening framing, the
 * hand-over between scenes) reads this and never asks what kind of object is mounted.
 */
export function ladderOf(subject: { readonly objectId: string; readonly view: 'body' | 'moons' | 'system' }): { readonly scope: string; readonly centreId: string } | null {
  if (subject.view === 'system') return { scope: 'system', centreId: subject.objectId };
  return subject.view === 'body' && isLevel(subject.objectId) ? { scope: subject.objectId, centreId } : null;
}

/** The selection a scope of the ladder is, around `centre`: the star's system view, or the level object. */
export function subjectOfScope(scope: string, centre: string): { readonly objectId: string; readonly view: 'body' | 'system' } {
  return scope === 'system' ? { objectId: centre, view: 'system' } : { objectId: scope, view: 'body' };
}

/** Whether the level `scope` holds subjects of `classification` (the Milky Way holds the stars). */
export const scopeHolds = (scope: string, classification: string) => KNOWN_OVERVIEWS.some(level => level.id === scope
  && level.holds.some(group => group.classifications.includes(classification)));

/** The body the world selects and measures from while scene `objectId` is mounted: a level's centre, or the object itself. */
export const worldSubject = (objectId: string) => isLevel(objectId) ? centreId : objectId;

/** A level object's descriptor with its frame moved to its centre: the same sphere and axes, at the centre's place. */
export async function levelViewDescriptor(descriptor: unknown): Promise<unknown> {
  if (!isRecord(descriptor) || typeof descriptor.id !== 'string' || !isLevel(descriptor.id) || !isRecord(descriptor.properties) || !isRecord(descriptor.properties.worldFrame)) return descriptor;
  const centre = knownObject(centreId) ?? await loadObject(centreId);
  if (!centre) throw new Error(`${descriptor.id} is centred on ${centreId}, which has no prepared entry.`);
  return { ...descriptor, properties: { ...descriptor.properties, worldFrame: { ...descriptor.properties.worldFrame, originM: centre.worldFrame.originM } } };
}
