import { systemHostId, systemObjectId } from '../navigation/system-address.mts';
import type { PageView } from '../navigation/navigation-scope.mts';
import { knownObject } from '../object-directory.mts';
import { satelliteSystemByHost } from '../satellite-systems.mts';

/** The one selection: an object, by its id. A body, a system (a planet's moons or a star's planetary system, an object with
 * its own address that shows its host's scene) and an object seen from inside are all one. */
export interface SceneSubject { readonly objectId: string }

/** The object whose scene shows `subject`: a system's host, or the subject itself. */
export const subjectHost = (subject: SceneSubject): string => systemHostId(subject.objectId) ?? subject.objectId;

/** How far out the scene of `subject` is seen, read from the object: a system is its host seen out to its moons or its
 * planets; anything else is itself, its body. */
export function subjectView(subject: SceneSubject): PageView {
  const host = systemHostId(subject.objectId);
  if (host === null) return 'body';
  const members = knownObject(subject.objectId)?.system?.members ?? (satelliteSystemByHost(host) ? 'moons' : 'planets');
  return members === 'moons' ? 'moons' : 'system';
}

/** The subject that is `hostId` seen in `view`: the body itself, or its system. */
export const subjectOf = (hostId: string, view: PageView = 'body'): SceneSubject => ({ objectId: view === 'body' ? hostId : systemObjectId(hostId) });

/** Identity used by navigation rows, source links and per-selection reading positions: the object's. */
export const selectionKey = (subject: SceneSubject): string => `object:${subject.objectId}`;
