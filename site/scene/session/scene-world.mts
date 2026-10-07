import { worldSubject, worldSubjectFrame } from '../../world/systems/inside-view.mts';
import type { SceneFramePresenter, WorldContextOwner, WorldContextMount } from './scene-frame-presenter.mts';
export type { SceneFramePresenter, WorldContextOwner, WorldContextMount } from './scene-frame-presenter.mts';
import type { BrowserWindow } from '../../browser/browser-types.mts';
import type { SceneSession } from './scene-session.mts';
import type { WorldCameraPose } from '@cssearth/engine';
import { sceneDatasetVolume } from './scene-datasets.mts';

type WorldFramePresenter = ReturnType<NonNullable<WorldContextMount['createFramePresenter']>>;

interface SceneWorldOptions {
  owner: WorldContextOwner;
  stage: HTMLElement;
  windowTarget: BrowserWindow;
  isCurrent(session: SceneSession): boolean;
  onMount(world: WorldContextMount): void;
  onCameraChange(session: SceneSession, world: WorldCameraPose): void;
  onError(error: unknown): void;
}

/** The world survives detail replacement; each detail owns only its connections to it. */
export function createSceneWorld({ owner, stage, windowTarget, isCurrent, onMount, onCameraChange, onError }: SceneWorldOptions) {
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
      return owner.mount({ stage, viewport: sharedViewport(), signal: controller.signal, windowTarget });
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
      // Without a world there is nothing to plan ahead.
      warm() { return presenter.kind === 'attached' ? presenter.inner.warm() : false; },
      destroy() {
        const previous = presenter; presenter = { kind: 'disposed' };
        if (previous.kind === 'attached') previous.inner.destroy();
      },
    };
  }

  /** The world's selection for a session: the star an object seen from inside is seen around, or the body itself, with its caption's framing.
   * A cold startup selects as soon as its detail's navigation facts exist, so the world's first plan can be made behind
   * the paint gate (`SceneFramePresenter.warm`); `connect` selects again, which changes nothing when it is the same. */
  function select(session: SceneSession, navigation: NonNullable<NonNullable<SceneSession['mount']>['navigation']>) {
    const world = mounted();
    if (!world || !isCurrent(session)) return;
    // An object seen from inside is the world seen around its centre: the world selects that star, and the object is its
    // overview scope.
    world.selectObject?.(worldSubject(session.objectId), worldSubjectFrame(session.objectId, navigation.frame), navigation.framingScale, navigation.labelEdge);
  }

  function connect(session: SceneSession) {
    const world = mounted(), navigation = session.mount?.navigation;
    if (!world || !navigation || typeof navigation.subscribe !== 'function' || connectedSession === session) return;
    connectedSession = session;
    session.own(() => { if (connectedSession === session) connectedSession = null; });
    session.framePresenter?.attach?.(world);
    select(session, navigation);
    // The bank the session's dataset shows is the selected body's picture from here on. A flight selects the dataset only
    // when it delivers the scene (scene-activation.mts `restore`), and the world draws the body on the way there.
    const volume = sceneDatasetVolume(session);
    world.expectVolumeDataset?.(volume?.objectId ?? null, volume?.datasetId);
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

  return { get current() { return mounted(); }, get viewport() { return sharedViewport(); }, ensure, select, connect, createFramePresenter, destroy };
}
