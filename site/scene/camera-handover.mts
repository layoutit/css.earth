import { eyeDistanceM } from '@cssearth/engine';
import type { WorldCameraPose } from '@cssearth/engine';
import { OVERVIEW_SELECTION_POLICY } from '../browser/runtime-policy.mts';
import { markHandover, type HandoverDetail } from '../navigation/navigation-timing.mts';
import { selectionKey, subjectHost, type SceneSubject } from '../world/systems/scene-subject.mts';

type Source = HandoverDetail['source'];

/**
 * The hand-over of the view to another scene as the camera zooms across a threshold (a body's system, a planet's moons,
 * an object seen from inside). The world shows the selection the camera has crossed into at once: its scope is a few
 * policy flags. The scene, its card and its address are membership, so they wait until the camera rests
 * (docs/performance/motion-freezes-membership.md), and a zoom that passes several thresholds without resting replaces the
 * scene once, with the last. A zoom in toward a body does not wait that long: its scene is the only thing that draws it
 * once it is more than a point (`due`). Out of Earth the arriving scene put 0 to 2 of 2.8 million pixels on screen at five crossings
 * (headless Chrome), while replacing it mid-zoom cost a 150 ms run of retiring, mounting and restyling on the iPad: over
 * a zoom across four crossings and back, 81 and 84 frames over 20 ms going out and 6 and 6 coming in, against 68 and 72
 * and 3 and 3 with the scene replaced at rest (interleaved runs, 2026-10-03).
 */
export interface CameraHandover {
  /** The selection the camera frames while its scene is not the mounted one; null otherwise. */
  readonly subject: SceneSubject | null;
  /** The camera has crossed into `next`, a selection of another scene. */
  cross(next: SceneSubject, source: Source): void;
  /** The pending scene's own body has come into view: the scene is replaced now, whether the camera moves or not. Until
   * then the world draws that body as a point; closer, only its scene draws it. */
  due(): void;
  /** The camera is back in a selection of the mounted scene. */
  back(): void;
  /** Nothing is pending any more: the mounted scene changed, or a navigation the reader chose took the view. */
  clear(): void;
  destroy(): void;
}

/** Whether a body shows as more than a point from this camera: its disc is a pixel across or more, or the camera is inside it. */
export function bodyInView(world: WorldCameraPose, body: { readonly originM: readonly number[]; readonly bodyRadiusM: number }, focalPixels: number): boolean {
  const range = eyeDistanceM(world.pose, body.originM), radius = body.bodyRadiusM;
  return range <= radius || 2 * focalPixels * radius >= Math.sqrt(range * range - radius * radius);
}

export function createCameraHandover({ windowTarget, documentTarget, mountedId, canSwap, fetchAhead, onChange, swap }: {
  windowTarget: Window; documentTarget: Document;
  mountedId(): string;
  /** Whether the mounted scene can be replaced now: it is ready, and no navigation or flight owns the camera. */
  canSwap(): boolean;
  /** Request what a hand-over to the scene of object `id` reads. It is asked for as the camera comes to rest, not at the
   * crossing: a zoom that passes five scenes would fetch five to mount one, and parse each card while it moves. */
  fetchAhead(id: string): void;
  /** The pending selection changed: the world shows it. */
  onChange(): void;
  /** Replace the mounted scene with the one that shows `subject`, with the camera where it is. */
  swap(subject: SceneSubject): void;
}): CameraHandover {
  let ahead: { readonly subject: SceneSubject; readonly source: Source; readonly crossedAt: number } | null = null;
  // Whether a hand or inertia moves the camera (camera-motion-signal.ts), and the wait that follows its rest.
  let moving = false, timer: number | null = null;
  const fetched = new Set<string>();
  // The pending selection whose scene has been asked for, so it is asked for once.
  let asked: SceneSubject | null = null;
  const now = () => windowTarget.performance?.now?.() ?? 0;
  const detail = (pending: NonNullable<typeof ahead>) => ({ source: pending.source, from: mountedId(), to: pending.subject.objectId });
  const disarm = () => { if (timer !== null) windowTarget.clearTimeout(timer); timer = null; };
  const fetch = (pending: NonNullable<typeof ahead>) => {
    const id = subjectHost(pending.subject);
    if (id === mountedId() || fetched.has(id)) return;
    fetched.add(id);
    markHandover(windowTarget, 'warmed', detail(pending));
    fetchAhead(id);
  };
  const replace = (pending: NonNullable<typeof ahead>) => {
    // A navigation or a flight owns the camera: it ends with a mounted scene, which asks again from its own camera.
    if (asked === pending.subject || !canSwap()) return;
    asked = pending.subject;
    markHandover(windowTarget, 'settled', { ...detail(pending), waitedMs: now() - pending.crossedAt });
    swap(pending.subject);
  };
  const settle = () => {
    disarm();
    if (!ahead || moving) return;
    fetch(ahead);
    timer = windowTarget.setTimeout(() => {
      timer = null;
      if (ahead && !moving) replace(ahead);
    }, OVERVIEW_SELECTION_POLICY.settleMilliseconds);
  };
  const motionChanged = (event: Event) => {
    moving = event instanceof CustomEvent && (event.detail as { active?: unknown } | null)?.active === true;
    settle();
  };
  documentTarget.addEventListener('objectmotionchange', motionChanged, { capture: true });
  return {
    get subject() { return ahead?.subject ?? null; },
    cross(next, source) {
      if (ahead && selectionKey(ahead.subject) === selectionKey(next)) return;
      // One wait a zoom: a further crossing keeps the time of the first.
      ahead = { subject: next, source, crossedAt: ahead?.crossedAt ?? now() };
      markHandover(windowTarget, 'crossed', detail(ahead));
      onChange();
      settle();
    },
    due() { if (ahead) { disarm(); fetch(ahead); replace(ahead); } },
    back() {
      if (!ahead) return;
      markHandover(windowTarget, 'cancelled', { ...detail(ahead), waitedMs: now() - ahead.crossedAt });
      ahead = asked = null; disarm();
      onChange();
    },
    clear() { ahead = asked = null; disarm(); fetched.clear(); },
    destroy() { ahead = asked = null; disarm(); documentTarget.removeEventListener('objectmotionchange', motionChanged, { capture: true }); },
  };
}
