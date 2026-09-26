import type { createApplicationWorldContext } from '../application-world-context.mts';
import type { BrowserWindow } from '../browser-types.mts';
import type { SceneSession } from './scene-session.mts';
import type { FocusPublication } from '../prepared-context-navigation.mts';
import type { WorldCameraPose } from '@cssearth/renderer/navigation/world-camera.ts';

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
  type WorldState = { kind: 'idle' } | { kind: 'loading'; controller: AbortController; task: Promise<WorldContextMount> }
    | { kind: 'ready'; world: WorldContextMount };
  let state: WorldState = { kind: 'idle' };
  let connectedSession: SceneSession | null = null;
  const mounted = () => state.kind === 'ready' ? state.world : null;
  // One viewport for the detail and the world, so a detail mounted first frames exactly as the world will.
  let viewport: ReturnType<WorldContextOwner['createViewport']> | null = null;
  const sharedViewport = () => viewport ??= owner.createViewport(stage);

  function ensure(): Promise<WorldContextMount> {
    if (state.kind === 'ready') return Promise.resolve(state.world);
    if (state.kind === 'loading') return state.task;
    const controller = new AbortController();
    // Register the loading owner before invoking mount, including synchronous callbacks.
    const task = Promise.resolve().then(() => {
      if (controller.signal.aborted) throw controller.signal.reason;
      return owner.mount({ stage, viewport: sharedViewport(), signal: controller.signal, windowTarget, onSelectFocus });
    }).then(value => {
      if (controller.signal.aborted) {
        value?.destroy?.();
        throw controller.signal.reason ?? new DOMException('World context mount was cancelled.', 'AbortError');
      }
      if (!value || typeof value.createFramePresenter !== 'function' || typeof value.destroy !== 'function') {
        throw new TypeError('Persistent world context mount must provide a frame presenter and destroy.');
      }
      state = { kind: 'ready', world: value };
      onMount(value);
      return value;
    }).catch(error => {
      if (state.kind === 'loading' && state.controller === controller) state = { kind: 'idle' };
      throw error;
    });
    state = { kind: 'loading', controller, task };
    task.catch(() => {});
    return task;
  }

  /** The world's presenter, or, before the world has loaded, one that commits the detail's frames directly and
   * hands over to the world's presenter when `connect` attaches it. */
  function createFramePresenter(): SceneFramePresenter {
    const current = mounted();
    if (current) return current.createFramePresenter();
    type PresenterState = { kind: 'detached'; enabled: boolean; last: Parameters<WorldFramePresenter['present']>[0] | null }
      | { kind: 'attached'; inner: WorldFramePresenter } | { kind: 'disposed' };
    let presenter: PresenterState = { kind: 'detached', enabled: false, last: null };
    return {
      present(request, signal) {
        if (presenter.kind === 'disposed' || signal?.aborted || !request.current()) return signal ? Promise.resolve(false) : undefined;
        if (presenter.kind === 'attached') return presenter.inner.present(request, signal);
        presenter.last = request; request.commit();
      },
      attach(world) {
        if (presenter.kind !== 'detached') return;
        const { last, enabled } = presenter;
        const attached = { kind: 'attached' as const, inner: world.createFramePresenter() };
        presenter = attached;
        // The world starts from the frame the detail is already showing.
        if (last?.current()) attached.inner.present(last);
        if (presenter === attached && enabled) attached.inner.enable();
      },
      enable() {
        if (presenter.kind === 'detached') presenter.enabled = true;
        else if (presenter.kind === 'attached') presenter.inner.enable();
      },
      destroy() {
        const previous = presenter; presenter = { kind: 'disposed' };
        if (previous.kind === 'attached') previous.inner.destroy();
      },
    };
  }

  function connect(session: SceneSession) {
    const world = mounted(), navigation = session.mount?.navigation;
    if (!world || !navigation || typeof navigation.subscribe !== 'function' || connectedSession === session) return;
    connectedSession = session;
    session.own(() => { if (connectedSession === session) connectedSession = null; });
    session.framePresenter?.attach?.(world);
    world.selectObject?.(session.objectId, navigation.frame, navigation.framingScale);
    const disconnectFocus = world.connectNavigation?.(navigation, {
      readFocus,
      onFocusChange(publication) { if (isCurrent(session)) onFocusChange(session, publication); },
      canPublish: () => isCurrent(session) && canPublishFocus(),
    });
    if (disconnectFocus) session.own(disconnectFocus);
    session.own(navigation.subscribe(frame => {
      if (isCurrent(session) && mounted() === world) onCameraChange(session, frame);
    }));
    session.framePresenter?.enable();
  }

  function destroy() {
    const previous = state;
    state = { kind: 'idle' };
    if (previous.kind === 'loading') previous.controller.abort(new DOMException('World context router was destroyed.', 'AbortError'));
    if (previous.kind === 'ready') {
      try { previous.world.destroy(); } catch (error) { onError(error); }
    }
    viewport?.destroy();
    viewport = null;
  }

  return { get current() { return mounted(); }, get viewport() { return sharedViewport(); }, ensure, connect, createFramePresenter, destroy };
}
