import { expect, test, vi } from 'vitest';
import { createDeferredObjectMount, type DeferredMountOptions, type ObjectSceneLifecycle } from './deferred-object-mount.js';
import type { SharedView } from '../navigation/view-url.js';

function pending<T>() {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const view: SharedView = {
  preparedEpochJdTt: null,
  camera: { distanceKilometers: 100, pose: { schema: 'cssearth-camera-pose@2', scene: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)' } },
  playback: { times: [123], speed: 1, motionRequested: false },
};
function fixture() {
  const data = pending<string>(), nativeReady = pending<void>();
  const listeners = new Set<() => void>();
  const scene = {
    ready: nativeReady.promise,
    datasets: {
      ids: ['normal', 'mapped'], defaultId: 'normal', current: () => 'normal',
      volumes: [], volumeOf: (_id: string) => null,
      select: vi.fn(async (_id: string, _options?: { signal?: AbortSignal }) => true),
      subscribe: (_listener: (id: string) => void) => () => {},
    },
    sharedView: {
      capture: vi.fn(() => view), restore: vi.fn(async () => true),
      subscribe: vi.fn((listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; }),
    },
    pause: vi.fn(), resume: vi.fn(), destroy: vi.fn(),
  } satisfies ObjectSceneLifecycle;
  let nativeOptions: DeferredMountOptions | undefined;
  const nativeMount = vi.fn((_stage: { id: string }, options: DeferredMountOptions) => { nativeOptions = options; return scene; });
  const bind = vi.fn((_definition: string) => nativeMount), load = vi.fn(() => data.promise);
  const mount = createDeferredObjectMount(load, bind), onError = vi.fn(), stage = { id: 'test' };
  return { data, nativeReady, scene, listeners, nativeMount, bind, load, mount, onError, stage,
    fail(error: unknown) { if (!nativeOptions) throw new Error('Native scene not mounted.'); nativeOptions.onError(error); } };
}

test('dataset selection is exposed only after native readiness and forwards cancellation', async () => {
  const f = fixture(), controller = f.mount(f.stage, { onError: f.onError });
  expect(controller.datasets).toBeUndefined();
  f.data.resolve('prepared');
  await vi.waitFor(() => expect(f.nativeMount).toHaveBeenCalledOnce());
  expect(controller.datasets).toBeUndefined();
  f.nativeReady.resolve(); await controller.ready;
  expect(controller.datasets).toBe(f.scene.datasets);
  const signal = new AbortController().signal;
  expect(await controller.datasets?.select('mapped', { signal })).toBe(true);
  expect(f.scene.datasets.select).toHaveBeenCalledExactlyOnceWith('mapped', { signal });
  controller.destroy(); expect(controller.datasets).toBeUndefined();
});

test('factory does not load; mount owns loading, native readiness, and the last playback command', async () => {
  const f = fixture();
  expect(f.load).not.toHaveBeenCalled();
  const controller = f.mount(f.stage, { onError: f.onError }), sharedView = controller.sharedView;
  controller.resume(); controller.pause(); controller.resume();
  expect(sharedView.capture()).toBeNull();
  expect(await sharedView.restore(view)).toBe(false);
  f.data.resolve('prepared');
  await vi.waitFor(() => expect(f.nativeMount).toHaveBeenCalledOnce());
  expect(f.bind).toHaveBeenCalledExactlyOnceWith('prepared');
  expect(f.nativeMount.mock.calls[0][0]).toBe(f.stage);
  expect(f.scene.resume).toHaveBeenCalledOnce();
  expect(f.scene.pause).not.toHaveBeenCalled();
  expect(sharedView.capture()).toBeNull();
  f.nativeReady.resolve();
  await controller.ready;
  expect(controller.sharedView).toBe(sharedView);
  expect(sharedView.capture(true)).toBe(view);
  expect(f.scene.sharedView.capture).toHaveBeenCalledExactlyOnceWith(true);
  expect(await sharedView.restore(view)).toBe(true);
  expect(f.scene.sharedView.restore).toHaveBeenCalledExactlyOnceWith(view);
  controller.pause(); controller.resume(); controller.destroy(); controller.destroy();
  expect(f.scene.pause).toHaveBeenCalledOnce();
  expect(f.scene.resume).toHaveBeenCalledTimes(2);
  expect(f.scene.destroy).toHaveBeenCalledOnce();
  expect(sharedView.capture()).toBeNull();
});

test('shared-view subscriptions remain stable across loading and detach on disposal', async () => {
  const f = fixture(), controller = f.mount(f.stage, { onError: f.onError });
  const listener = vi.fn(), removed = vi.fn();
  controller.sharedView.subscribe(listener);
  controller.sharedView.subscribe(removed)();
  f.data.resolve('prepared');
  await vi.waitFor(() => expect(f.listeners.size).toBe(1));
  for (const notify of f.listeners) notify();
  expect(listener).not.toHaveBeenCalled();
  f.nativeReady.resolve(); await controller.ready;
  for (const notify of f.listeners) notify();
  expect(listener).toHaveBeenCalledOnce();
  expect(removed).not.toHaveBeenCalled();
  controller.destroy();
  expect(f.listeners.size).toBe(0);
});

test('destroy before prepared data settles readiness and prevents a late native mount', async () => {
  const f = fixture(), controller = f.mount(f.stage, { onError: f.onError });
  controller.destroy(); await controller.ready;
  f.data.resolve('late prepared data');
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(f.bind).not.toHaveBeenCalled();
  expect(f.nativeMount).not.toHaveBeenCalled();
  expect(f.onError).not.toHaveBeenCalled();
});

test('a rejected decode after destruction is observed without reporting to a retired scene', async () => {
  const f = fixture(), controller = f.mount(f.stage, { onError: f.onError });
  controller.destroy(); await controller.ready;
  f.data.reject(new Error('late decode failure'));
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(f.nativeMount).not.toHaveBeenCalled();
  expect(f.onError).not.toHaveBeenCalled();
});

test('decode failure rejects readiness before binding or mounting', async () => {
  const f = fixture(), controller = f.mount(f.stage, { onError: f.onError });
  f.data.reject(new Error('invalid prepared artifact'));
  await expect(controller.ready).rejects.toThrow('invalid prepared artifact');
  expect(f.bind).not.toHaveBeenCalled();
  expect(f.onError).not.toHaveBeenCalled();
  controller.destroy();
});

test('destroy during native readiness cleans up once and observes late native rejection', async () => {
  const f = fixture(), controller = f.mount(f.stage, { onError: f.onError });
  f.data.resolve('prepared');
  await vi.waitFor(() => expect(f.nativeMount).toHaveBeenCalledOnce());
  expect(f.scene.pause).toHaveBeenCalledOnce();
  controller.destroy(); controller.destroy(); await controller.ready;
  f.nativeReady.reject(new Error('late native failure'));
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(f.scene.destroy).toHaveBeenCalledOnce();
  expect(f.onError).not.toHaveBeenCalled();
});

test('native startup failure rejects readiness and releases its retained controller', async () => {
  const f = fixture(), controller = f.mount(f.stage, { onError: f.onError });
  f.data.resolve('prepared');
  await vi.waitFor(() => expect(f.nativeMount).toHaveBeenCalledOnce());
  f.nativeReady.reject(new Error('native startup failed'));
  await expect(controller.ready).rejects.toThrow('native startup failed');
  expect(f.scene.destroy).toHaveBeenCalledOnce();
  expect(f.onError).not.toHaveBeenCalled();
});

test('post-readiness failure reports once and prevents further native operations', async () => {
  const f = fixture(), controller = f.mount(f.stage, { onError: f.onError });
  f.data.resolve('prepared'); f.nativeReady.resolve(); await controller.ready;
  const error = new Error('native operation failed');
  f.fail(error); f.fail(error); controller.resume();
  expect(f.onError).toHaveBeenCalledExactlyOnceWith(error);
  expect(f.scene.destroy).toHaveBeenCalledOnce();
  expect(f.scene.resume).not.toHaveBeenCalled();
});

test('synchronous mount failure is owned by readiness', async () => {
  const f = fixture();
  f.nativeMount.mockImplementation(() => { throw new Error('native mount failed'); });
  const controller = f.mount(f.stage, { onError: f.onError });
  f.data.resolve('prepared');
  await expect(controller.ready).rejects.toThrow('native mount failed');
  expect(f.onError).not.toHaveBeenCalled();
});
