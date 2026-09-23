import { createSceneLifetime } from '@cssearth/engine';
import type { SceneFramePresenter } from './scene-world.mts';
import type { ObjectSceneLifecycle } from '../../src/renderers/css/runtime/object-scene.js';
import type { MountOptions, SceneFactory } from '../browser-types.mts';
import { errorMessage } from '../browser-types.mts';
import type { NavigationRequest } from '../navigation/navigation-lifecycle.mts';
import type { ObjectShell } from '../object-shell-types.mts';
import type { WorldHandoff } from '../prepared-world-navigation.mts';
import type { bindViewUrl } from '../view-url-runtime.mts';
import { requireSceneLifecycle } from './scene-contract.mts';

export type SceneSessionState =
  | { readonly kind: 'loading'; readonly activation: 'idle' | 'mounting' | 'restoring'; readonly mount: ObjectSceneLifecycle | null }
  | { readonly kind: 'ready'; readonly mount: ObjectSceneLifecycle }
  | { readonly kind: 'failed'; readonly error: Error }
  | { readonly kind: 'disposed' };
interface SessionOptions {
  objectId: string;
  url?: string;
  request?: NavigationRequest;
  onFailure(session: SceneSession, error: unknown): void;
  onCleanupError(error: unknown): void;
}
export type SceneSession = ReturnType<typeof createSceneSession>;
export type SceneSessions = ReturnType<typeof createSceneSessions>;

/** Holds the last terminal state for diagnostics, but admits only one live session. */
export function createSceneSessions() {
  let session: SceneSession | null = null;
  return {
    get current() { return session?.live ? session : null; },
    isCurrent(candidate: SceneSession) { return session === candidate && candidate.live; },
    get state(): SceneSessionState { return session?.state ?? { kind: 'disposed' }; },
    start(options: SessionOptions) {
      if (session?.live) throw new Error('Retire the current scene before starting another.');
      session = createSceneSession(options);
      return session;
    },
  };
}

function createSceneSession({ objectId, url, request, onFailure, onCleanupError }: SessionOptions) {
  const lifetime = createSceneLifetime(), controller = new AbortController();
  let state: SceneSessionState = { kind: 'loading', activation: 'idle', mount: null };
  let lastCommand: boolean | null = null;
  let viewUrl: ReturnType<typeof bindViewUrl> | null = null;
  lifetime.onDispose(() => controller.abort());
  lifetime.onDispose(() => { const owner = viewUrl; viewUrl = null; owner?.destroy(); });
  const session = {
    objectId, url, request,
    shell: null as ObjectShell | null,
    framePresenter: undefined as SceneFramePresenter | undefined,
    get state() { return state; },
    get live(): boolean { return state.kind === 'loading' || state.kind === 'ready'; },
    get mount(): ObjectSceneLifecycle | null { return session.live && 'mount' in state ? state.mount : null; },
    get playing(): boolean { return state.kind === 'ready' && lastCommand === true; },
    signal: controller.signal,
    wait: lifetime.wait,
    own(cleanup: () => void) { for (const error of lifetime.onDispose(cleanup)) onCleanupError(error); },
    get viewUrl() { return viewUrl; },
    setViewUrl(owner: ReturnType<typeof bindViewUrl> | null) {
      const previous = viewUrl; viewUrl = owner;
      try { previous?.destroy(); }
      finally {
        if (!session.live) { const retired = viewUrl; viewUrl = null; retired?.destroy(); }
      }
    },
    async activate(factory: SceneFactory | PromiseLike<SceneFactory>, stage: HTMLElement,
      options: Omit<MountOptions, 'onError'>, handoff?: WorldHandoff): Promise<boolean> {
      if (!session.live) return false;
      if (state.kind !== 'loading' || state.activation !== 'idle') throw new Error('A scene session can only activate once.');
      state = { kind: 'loading', activation: 'mounting', mount: null };
      const loaded = await lifetime.wait(factory);
      if (loaded.cancelled || !session.live) return false;
      handoff?.transferTo(controller.signal);
      const mount = loaded.value(stage, { ...handoff?.mountOptions, ...options,
        onError(error) { if (session.live) onFailure(session, error); },
      });
      // A factory can report failure synchronously and still return a handle.
      // Observe readiness and own cleanup even if that callback retired us.
      const ready = Promise.resolve(mount?.ready);
      ready.catch(() => {});
      session.own(() => mount?.destroy?.());
      if (!session.live) return false;
      requireSceneLifecycle(mount, objectId);
      state = { kind: 'loading', activation: 'mounting', mount };
      session.play(false);
      const result = await lifetime.wait(ready);
      if (result.cancelled || !session.live) return false;
      state = { kind: 'loading', activation: 'restoring', mount };
      return true;
    },
    commit() {
      if (state.kind !== 'loading' || state.activation !== 'restoring' || !state.mount) return false;
      state = { kind: 'ready', mount: state.mount };
      return true;
    },
    play(allowed: boolean) {
      const mount = session.mount;
      if (!mount) return session.live;
      const next = state.kind === 'ready' && allowed;
      if (lastCommand !== next) {
        if (next) mount.resume(); else mount.pause();
        if (!session.live) return false;
        lastCommand = next;
      }
      return true;
    },
    dispose(error?: unknown, { flush = true } = {}) {
      if (!session.live) return [];
      // No callback or late native promise may reanimate a retired session.
      state = error === undefined ? { kind: 'disposed' }
        : { kind: 'failed', error: error instanceof Error ? error : new Error(errorMessage(error)) };
      const errors: unknown[] = [];
      try { if (flush) viewUrl?.flush(); } catch (error) { errors.push(error); }
      return [...errors, ...lifetime.destroy()];
    },
  };
  return session;
}
