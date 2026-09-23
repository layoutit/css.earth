import type { createApplicationWorldContext } from './application-world-context.mts';
import type { BrowserWindow } from './browser-types.mts';
import type { SceneSession } from './scene-session.mts';
import type { FocusCallbacks } from './prepared-context-navigation.mts';
import type { WorldCameraPose } from '../src/renderers/css/navigation/world-camera.js';

export type WorldContextOwner = ReturnType<typeof createApplicationWorldContext>;
export type WorldContextMount = Awaited<ReturnType<WorldContextOwner['mount']>>;

interface SceneWorldOptions {
  owner: WorldContextOwner | null;
  stage: HTMLElement;
  windowTarget: BrowserWindow;
  isCurrent(session: SceneSession): boolean;
  onMount(world: WorldContextMount): void;
  onFlightStart(): void;
  onFocusChange(session: SceneSession, url: string): void;
  onFocusContentChange: NonNullable<FocusCallbacks['onFocusContentChange']>;
  onCameraChange(session: SceneSession, world: WorldCameraPose): void;
  onError(error: unknown): void;
}

/** The world survives detail replacement; each detail owns only its connections to it. */
export function createSceneWorld({ owner, stage, windowTarget, isCurrent, onMount, onFlightStart, onFocusChange, onFocusContentChange, onCameraChange, onError }: SceneWorldOptions) {
  let current: WorldContextMount | null = null;
  let task: Promise<WorldContextMount> | null = null;
  let pending: AbortController | null = null;

  function ensure() {
    if (!owner) return Promise.resolve(null);
    if (current) return Promise.resolve(current);
    if (!task) {
      const controller = new AbortController();
      pending = controller;
      task = Promise.resolve(owner.mount({ stage, signal: controller.signal, windowTarget })).then(value => {
        if (controller.signal.aborted) {
          value?.destroy?.();
          throw controller.signal.reason ?? new DOMException('World context mount was cancelled.', 'AbortError');
        }
        if (!value || typeof value.publish !== 'function' || typeof value.destroy !== 'function') {
          throw new TypeError('Persistent world context mount must publish and destroy.');
        }
        current = value;
        onMount(value);
        return value;
      }).catch(error => {
        if (pending === controller) task = null;
        throw error;
      }).finally(() => {
        if (pending === controller) pending = null;
      });
      task.catch(() => {});
    }
    return task;
  }

  function connect(session: SceneSession) {
    const world = current, navigation = session.mount?.navigation;
    if (!world || !navigation || typeof navigation.subscribe !== 'function') return;
    world.selectObject?.(session.objectId, navigation.frame);
    const disconnectFocus = world.connectNavigation?.(navigation, {
      onFocusChange(url) { if (isCurrent(session)) onFocusChange(session, url); },
      onFocusContentChange(record, sources, presentation) {
        if (isCurrent(session)) onFocusContentChange(record, sources, presentation);
      },
      onFlightStart() { if (isCurrent(session)) onFlightStart(); },
    });
    if (disconnectFocus) session.own(disconnectFocus);
    session.own(navigation.subscribe((frame, viewport) => {
      if (isCurrent(session) && current === world) { onCameraChange(session, frame); world.publish(frame, viewport); }
    }));
    session.framePresenter?.enable();
  }

  function destroy() {
    pending?.abort(new DOMException('World context router was destroyed.', 'AbortError'));
    pending = null;
    const world = current;
    current = null;
    task = null;
    if (world) {
      try { world.destroy(); } catch (error) { onError(error); }
    }
  }

  return { get current() { return current; }, ensure, connect, destroy };
}
