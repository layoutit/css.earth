import { isRecord } from '@cssearth/core';
import { knownAncestors, knownObject, loadAncestors, loadObject } from '../directory/object-directory.mts';
import { SOLAR_SYSTEM_ID } from './object-systems.mts';
import { starSystem, subjectHost, subjectView, type SceneSubject } from './scene-subject.mts';
import { systemHostId } from '../model/system-address.mts';
import type { ZoomStep } from './zoom-scope.mts';

/** An object the view hands over to as the camera backs out of something inside it (the Milky Way) is seen from inside: its
 * scene has no body, and its camera is centred on the star the zoom came out of. That star is the zoom's centre: the world's
 * host on a page opened cold, the star whose system the view was handed over from otherwise. Zooming back in returns to it. */
let centreId = SOLAR_SYSTEM_ID;
// A page reads the objects the world's host is inside as it starts; the build and tests know every object already.
if (typeof window !== 'undefined') void loadAncestors(centreId).catch(error => console.error(`The objects ${centreId} is inside could not be read; zooming out stops at its system.`, error));

/** Whether `id` is seen from inside: its object authors zoom facts (`properties.zoom`). */
const seenFromInside = (id: string | null | undefined) => id !== null && id !== undefined && knownObject(id)?.zoom !== undefined;

/** The star the view was last centred on: an object seen from inside mounted next is seen around it. The objects it is
 * inside, which the zoom hands over to, are read now. */
export function setZoomCentre(id: string) {
  centreId = id;
  void loadAncestors(id).catch(error => console.error(`The objects ${id} is inside could not be read; zooming out stops at its system.`, error));
}

/**
 * Where a selection stands as the camera backs out: its scope (the id of the star's own system, or of an object seen from
 * inside) and the star the scope is measured from. Null for a selection on a body. A star's system view and an object seen
 * from inside are steps of the same zoom out of the centre; everything that follows it (the world's overview scope, the
 * readout, the opening framing, the hand-over between scenes) reads this and never asks what kind of object is mounted.
 */
export function zoomStepOf(subject: SceneSubject): { readonly scope: string; readonly centreId: string } | null {
  // A planet's own system is its host seen out to its moons, not a step of the zoom out of a star.
  if (subjectView(subject) === 'system') return starSystem(subject) ? { scope: subject.objectId, centreId: subjectHost(subject) } : null;
  return seenFromInside(subject.objectId) ? { scope: subject.objectId, centreId } : null;
}

const PARSEC_M = 3.085677581491367e16;
/** How far from a body at `originM` the camera is outside the object it is inside, whichever way it backs out: the distance
 * to that object's centre and its radius. */
export const leaveDistanceM = (originM: readonly number[], inside: { readonly originM: readonly number[]; readonly radiusM: number }) =>
  Math.hypot(...originM.map((value, axis) => value - inside.originM[axis]!)) + inside.radiusM;
/** The share of its entering distance below which a scene of its own gives the view back: the Nearby and the Observable
 * Universe author the same margin (4 of 5 Mpc, 0.8 of 1 Gpc), so the view does not flicker at the edge. */
const RETURN_SHARE = .8;

/** The object `id` is inside when that object has a scene of its own (another galaxy, a cluster of galaxies), as far as the
 * page has read it: zooming out of `id` hands the view to that scene. Null inside a system, or inside an object seen from
 * inside. */
export function insideBody(id: string) {
  const parent = knownObject(id)?.parent, object = parent === undefined ? undefined : knownObject(parent);
  return object && !object.system && object.zoom === undefined && object.worldFrame ? object : null;
}

/** The objects the view hands over to as the camera backs out of `centre`, nearest first, as far as the page has read them:
 * the objects it is inside, each with the distances it is entered and left again at. Its own system is the zoom's first
 * scope, not a step. An object seen from inside authors its distances. An object with a scene of its own takes the view
 * as its body once the camera is outside it (overview-selection.mts `leaveDistanceM`), and ends the chain: its scene is
 * left the way any body's is. A system the centre's own is inside (Epsilon Indi A's, around Epsilon Indi B) is such an
 * object: it shows its host's scene out to what is inside it. */
export function zoomChain(centre: string = centreId): readonly ZoomStep[] {
  const chain: ZoomStep[] = [];
  for (const object of knownAncestors(centre)) {
    if (object.system?.host === centre) continue;
    if (object.zoom === undefined) {
      // Without both frames the camera cannot be told to be outside it: the zoom stops at the centre's system.
      const from = knownObject(centre)?.worldFrame, frame = object.worldFrame;
      if (from && frame) {
        const enterPc = leaveDistanceM(from.originM, { originM: frame.originM, radiusM: frame.bodyRadiusM }) / PARSEC_M;
        chain.push({ id: object.id, body: true, zoom: { enter: { distancePc: enterPc }, returnBelow: { distancePc: enterPc * RETURN_SHARE } } });
      }
      break;
    }
    chain.push({ id: object.id, zoom: object.zoom });
  }
  return chain;
}

/** Whether the scope is past the galaxy the centre is inside, where that galaxy's stars retire: a galaxy lies between the
 * centre and the scope (the Local Group is past the Milky Way; the Milky Way is not). */
export function pastCentreGalaxy(scope: string, centre: string = centreId): boolean {
  // The centre's own system is inside that galaxy, whether the page has read the system's entry or not.
  if (systemHostId(scope) === centre) return false;
  for (const object of knownAncestors(centre)) {
    if (object.id === scope) return false;
    if (object.classification === 'galaxy') return true;
  }
  return false;
}

/** The body the world selects and measures from while scene `objectId` is mounted: the centre of an object seen from
 * inside, or the object itself. */
export const worldSubject = (objectId: string) => seenFromInside(objectId) ? centreId : objectId;

/** The frame the world checks its selection against while scene `objectId` is mounted: the centre's own frame for an object
 * seen from inside, not the object's. It keeps its own sphere at the centre's place (`insideViewDescriptor`), which is the
 * Sun's radius: around any other star the world refused it and the page went black (ε Eridani's system, then the Galaxies
 * pill, 2026-10-02). */
export const worldSubjectFrame = <Frame,>(objectId: string, frame: Frame): Frame =>
  seenFromInside(objectId) ? (knownObject(centreId)?.worldFrame as Frame | undefined) ?? frame : frame;

/** The descriptor of an object seen from inside with its frame moved to its centre: the same sphere and axes, at the
 * centre's place. */
export async function insideViewDescriptor(descriptor: unknown): Promise<unknown> {
  if (!isRecord(descriptor) || typeof descriptor.id !== 'string' || !seenFromInside(descriptor.id) || !isRecord(descriptor.properties) || !isRecord(descriptor.properties.worldFrame)) return descriptor;
  const centre = knownObject(centreId) ?? await loadObject(centreId);
  if (!centre) throw new Error(`${descriptor.id} is centred on ${centreId}, which has no prepared entry.`);
  return { ...descriptor, properties: { ...descriptor.properties, worldFrame: { ...descriptor.properties.worldFrame, originM: centre.worldFrame.originM } } };
}
