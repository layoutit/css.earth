import type { createApplicationWorldContext } from '../application-world-context.mts';
import type { BrowserWindow } from '../browser-types.mts';
import type { SceneSession } from './scene-session.mts';
import type { FocusPublication } from '../prepared-context-navigation.mts';
import type { WorldCameraPose } from '../../src/renderers/css/navigation/world-camera.js';

/** The world's code loads when the world does (`scene-router.mts`); its viewport exists from the start. */
export type WorldContextOwner = Pick<ReturnType<typeof createApplicationWorldContext>, 'mount'> & {
  createViewport(stage: HTMLElement): ReturnType<typeof import('../world-viewport.mts').createWorldViewport> };
export type WorldContextMount = Awaited<ReturnType<WorldContextOwner['mount']>>;
type WorldFramePresenter = ReturnType<NonNullable<WorldContextMount['createFramePresenter']>>;
/** A detail's frame presenter. One mounted before the world commits its own frames until `attach`. */
export type SceneFramePresenter = WorldFramePresenter & { attach?(world: WorldContextMount): void };

interface SceneWorldOptions {
  owner: WorldContextOwner;
  stage: HTMLElement;
  windowTarget: BrowserWindow;
  isCurrent(session: SceneSession): boolean;
  onMount(world: WorldContextMount): void;
  onSelectFocus(id: string): void;
  canPublishFocus(): boolean;
  readFocus(): string | null;
  onFocusChange(session: SceneSession, publication: FocusPublication): void;
  onCameraChange(session: SceneSession, world: WorldCameraPose): void;
  onError(error: unknown): void;
}

/** The world survives detail replacement; each detail owns only its connections to it. */
export function createSceneWorld({ owner, stage, windowTarget, isCurrent, onMount, onSelectFocus, canPublishFocus, onFocusChange, readFocus, onCameraChange, onError }: SceneWorldOptions) {
  let current: WorldContextMount | null = null;
  let task: Promise<WorldContextMount> | null = null;
  let pending: AbortController | null = null;
  // One viewport for the detail and the world, so a detail mounted first frames exactly as the world will.
  let viewport: ReturnType<WorldContextOwner['createViewport']> | null = null;
  const sharedViewport = () => viewport ??= owner.createViewport(stage);

  function ensure() {
    if (current) return Promise.resolve(current);
    if (!task) {
      const controller = new AbortController();
      pending = controller;
      task = Promise.resolve(owner.mount({ stage, viewport: sharedViewport()!, signal: controller.signal, windowTarget, onSelectFocus })).then(value => {
        if (controller.signal.aborted) {
          value?.destroy?.();
          throw controller.signal.reason ?? new DOMException('World context mount was cancelled.', 'AbortError');
        }
        if (!value || typeof value.createFramePresenter !== 'function' || typeof value.destroy !== 'function') {
          throw new TypeError('Persistent world context mount must provide a frame presenter and destroy.');
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

  /** The world's presenter, or, before the world has loaded, one that commits the detail's frames directly and
   * hands over to the world's presenter when `connect` attaches it. */
  function createFramePresenter(): SceneFramePresenter {
    if (current) return current.createFramePresenter();
    let inner: WorldFramePresenter | undefined, enabled = false, disposed = false;
    let last: Parameters<WorldFramePresenter['present']>[0] | null = null;
    return {
      present(request, signal) {
        if (inner) return inner.present(request, signal);
        if (disposed || signal?.aborted || !request.current()) return signal ? Promise.resolve(false) : undefined;
        last = request; request.commit();
      },
      attach(world) {
        if (inner || disposed) return;
        inner = world.createFramePresenter();
        // The world starts from the frame the detail is already showing.
        if (last?.current()) inner.present(last);
        last = null;
        if (enabled) inner?.enable();
      },
      enable() { enabled = true; inner?.enable(); },
      destroy() { disposed = true; last = null; inner?.destroy(); },
    };
  }

  function connect(session: SceneSession) {
    const world = current, navigation = session.mount?.navigation;
    if (!world || !navigation || typeof navigation.subscribe !== 'function') return;
    session.framePresenter?.attach?.(world);
    world.selectObject?.(session.objectId, navigation.frame);
    const disconnectFocus = world.connectNavigation?.(navigation, {
      readFocus,
      onFocusChange(publication) { if (isCurrent(session)) onFocusChange(session, publication); },
      canPublish: () => isCurrent(session) && canPublishFocus(),
    });
    if (disconnectFocus) session.own(disconnectFocus);
    session.own(navigation.subscribe(frame => {
      if (isCurrent(session) && current === world) onCameraChange(session, frame);
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
    viewport?.destroy();
    viewport = null;
  }

  return { get current() { return current; }, get viewport() { return sharedViewport(); }, ensure, connect, createFramePresenter, destroy };
}
