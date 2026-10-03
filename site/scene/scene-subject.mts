import { systemHostId, systemObjectId } from '../navigation/system-address.mts';
import type { PageView } from '../navigation/navigation-scope.mts';
import { knownObject } from '../object-directory.mts';
import { WORLD_OBJECTS } from '../world-objects.mts';

/** The one selection: an object, by its id. A body, a system (a planet's moons or a star's planetary system, an object with
 * its own address that shows its host's scene) and an object seen from inside are all one. */
export interface SceneSubject { readonly objectId: string }

/** The object whose scene shows `subject`: a system's host, or the subject itself. */
export const subjectHost = (subject: SceneSubject): string => systemHostId(subject.objectId) ?? subject.objectId;

/** How far out the scene of `subject` is seen, read from the object: a system is its host seen out to what is inside it;
 * anything else is itself, its body. */
export const subjectView = (subject: SceneSubject): PageView => systemHostId(subject.objectId) === null ? 'body' : 'system';

/** Whether `subject` is the system of a star (or of a black hole): the camera's zoom out of that star passes through it
 * (inside-view.mts `zoomStepOf`), and the star is then no longer the selected body. The system of a planet or a small body
 * is its host seen out to its moons: the host stays the selected body, and no star's zoom passes through it. What its host
 * is says which: a page has read the host's entry before it shows its system, and the search function, which reads no
 * entry, holds the host's row of the world; both carry the registry's classification. */
export function starSystem(subject: SceneSubject): boolean {
  const host = systemHostId(subject.objectId);
  if (host === null) return false;
  const classification = knownObject(host)?.classification ?? WORLD_OBJECTS.find(object => object.id === host)?.classification;
  if (classification === undefined) throw new TypeError(`${subject.objectId}: its host ${host} is neither an object this page has read nor a body of the world it holds, so what kind of system it is cannot be told.`);
  return classification === 'star' || classification === 'black-hole';
}
/** Whether `subject` is the system of a planet or a small body: its host seen out to its moons. */
export const moonSystem = (subject: SceneSubject): boolean => subjectView(subject) === 'system' && !starSystem(subject);

/** The subject that is `hostId` seen in `view`: the body itself, or its system. */
export const subjectOf = (hostId: string, view: PageView = 'body'): SceneSubject => ({ objectId: view === 'body' ? hostId : systemObjectId(hostId) });

/** Identity used by navigation rows, source links and per-selection reading positions: the object's. */
export const selectionKey = (subject: SceneSubject): string => `object:${subject.objectId}`;
