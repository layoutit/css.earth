import { createSceneLifetime } from '@cssearth/engine';
import type { SharedView } from '../navigation/view-url.js';
import type { PreparedDestinationRuntime } from './object-runtime-types.js';
import type { ObjectWorldNavigation } from './world-navigation-types.js';

export interface ObjectSharedView {
  capture(motionRequested?: boolean): SharedView | null;
  restore(view: SharedView): Promise<boolean>;
  subscribe(listener: () => void): () => void;
}
export interface ObjectSceneLifecycle {
  readonly ready: Promise<void>;
  readonly sharedView: ObjectSharedView;
  readonly destinations?: PreparedDestinationRuntime;
  readonly navigation?: ObjectWorldNavigation;
  refineTextures?(): void;
  pause(): void;
  resume(): void;
  destroy(): void;
}
export interface DeferredMountOptions { onError(error: unknown): void; }

/** The mount owns both prepared transport and the eventual native scene. */
export function createDeferredObjectMount<T, Stage, Options extends DeferredMountOptions>(
  load: () => Promise<T>,
  bind: (definition: T) => (stage: Stage, options: Options) => ObjectSceneLifecycle,
): (stage: Stage, options: Options) => ObjectSceneLifecycle {
  return (stage, options) => {
    const lifetime = createSceneLifetime();
    let mounted: ObjectSceneLifecycle | null = null;
    let allowed = false, published = false, settled = false;
    let resolveReady!: () => void, rejectReady!: (error: unknown) => void;
    const ready = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
    ready.catch(() => {});
    const listeners = new Set<() => void>();
    lifetime.onDispose(() => listeners.clear());
    const sharedView: ObjectSharedView = Object.freeze({
      capture(motionRequested = false) {
        return published && !lifetime.disposed ? mounted?.sharedView.capture(motionRequested) ?? null : null;
      },
      async restore(view: SharedView) {
        return published && !lifetime.disposed ? mounted?.sharedView.restore(view) ?? false : false;
      },
      subscribe(listener: () => void) {
        if (!lifetime.disposed) listeners.add(listener);
        return () => { listeners.delete(listener); };
      },
    });
    const controller: ObjectSceneLifecycle = Object.freeze({
      ready, sharedView,
      get destinations() { return lifetime.disposed ? undefined : mounted?.destinations; },
      get navigation() { return published && !lifetime.disposed ? mounted?.navigation : undefined; },
      refineTextures() { forward(() => mounted?.refineTextures?.()); },
      pause() { allowed = false; forward(() => mounted?.pause()); },
      resume() { allowed = true; forward(() => mounted?.resume()); },
      destroy() {
        if (!settled) { settled = true; resolveReady(); }
        const errors = lifetime.destroy();
        if (errors.length) throw new AggregateError(errors, 'Deferred object cleanup failed.');
      },
    });
    start().catch(fail);
    return controller;

    async function start() {
      const loaded = await lifetime.wait(load());
      if (loaded.cancelled) return;
      mounted = bind(loaded.value)(stage, { ...options, onError: fail });
      // Observe readiness before registration can synchronously clean up a
      // scene whose mount reported an error to its owner before returning.
      const nativeReady = Promise.resolve(mounted.ready);
      nativeReady.catch(() => {});
      const scene = mounted;
      const errors = lifetime.onDispose(() => scene.destroy());
      if (errors.length) throw new AggregateError(errors, 'Late object cleanup failed.');
      if (lifetime.disposed) return;
      lifetime.onDispose(scene.sharedView.subscribe(() => {
        if (published && !lifetime.disposed) for (const listener of listeners) listener();
      }));
      if (allowed) scene.resume();
      else scene.pause();
      const result = await lifetime.wait(nativeReady);
      if (result.cancelled) return;
      published = true;
      settled = true;
      resolveReady();
    }
    function forward(action: () => void) {
      if (!lifetime.disposed) try { action(); } catch (error) { fail(error); }
    }
    function fail(error: unknown) {
      if (lifetime.disposed) return;
      const errors = lifetime.destroy();
      const failure = errors.length ? new AggregateError([error, ...errors], 'Deferred object failed.', { cause: error }) : error;
      if (!settled) { settled = true; rejectReady(failure); }
      else if (published) options.onError(failure);
    }
  };
}
