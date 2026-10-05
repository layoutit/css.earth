import type { MountOptions } from '../browser/browser-types.mts';
import type { ObjectSceneLifecycle } from '@cssearth/renderer/runtime/object-scene.ts';
import type { ObjectWorldNavigation } from '@cssearth/renderer/runtime/world-navigation-types.ts';
import type { SceneSubject } from '../scene/scene-subject.mts';
import type { PageView } from './navigation-scope.mts';

/** How far out an object's scene is seen: on the body, or out to its system. */
export type SceneView = PageView;
export type SelectionTarget = SceneSubject;

export interface WorldHandoff {transferTo(signal: AbortSignal): void; mountOptions: Partial<MountOptions>; afterMount(mount: ObjectSceneLifecycle): Promise<void>;
  /** Called with the departing scene's navigation just before that scene is retired: the camera's last word from it. */
  beforeRetire?(departing: ObjectWorldNavigation): void;}

export type NavigationHistory = { history: 'push' | 'replace' } | { history: 'pop'; entry: string };
export type NavigationIntent =
  /** Go to an object. `view` asks for the system it hosts instead of the body itself; `camera: 'frame'` flies
   * to that view's framing, and `preserve` keeps the camera where it is (the zoom hands the view over to the object's scene).
   * `departed`: the view a header pill's flight left: the hand-over it lands on is a new entry, and Back returns to it.
   * `history: 'replace'` lands on the entry it left (a Slideshow hop after the tour's first). */
  | { kind: 'object'; view?: SceneView; camera?: 'frame' | 'preserve'; departed?: string; history?: 'replace' }
  | { kind: 'feature'; id: string | null }
  | { kind: 'link'; url: string }
  | { kind: 'history'; url: string; history: NavigationHistory };
