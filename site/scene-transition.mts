import type { ObjectDescriptor } from '@cssearth/objects';
import type { BrowserWindow, SceneFactory } from './browser-types.mts';
import type { NavigationContentLoader, createNavigationContent } from './navigation-content.mts';
import type { NavigationLifecycle, NavigationRequest } from './navigation-lifecycle.mts';
import type { ObjectEntry } from './object-schema.mts';
import type { ShellNavigationTransition } from './object-shell-types.mts';
import type { createPreparedWorldNavigation } from './prepared-world-navigation.mts';
import type { SceneSession } from './scene-session.mts';
import type { SceneView } from './scene-view.mts';
import type { WorldContextMount } from './scene-world.mts';
import { selectSceneDataset } from './scene-datasets.mts';

type Navigation = ReturnType<typeof createPreparedWorldNavigation>;

/** Reuse a ready session for dataset changes, saved views, and overview/detail selections. */
export async function focusExistingScene({ session, request, selectionTransition, navigation, requests, view,
  windowTarget, getReducedMotion, commitSelection, finishArrival, syncPlayback }: {
  session: SceneSession;
  request: NavigationRequest;
  selectionTransition?: ShellNavigationTransition | null;
  navigation: Navigation;
  requests: NavigationLifecycle;
  view: SceneView;
  windowTarget: BrowserWindow;
  getReducedMotion(): boolean;
  commitSelection(request: NavigationRequest, transition?: ShellNavigationTransition | null): void;
  finishArrival(session: SceneSession, request: NavigationRequest): void;
  syncPlayback(): void;
}) {
  const datasetSelection = selectSceneDataset(session, request.url, request.signal);
  if (!(typeof datasetSelection === 'boolean' ? datasetSelection : await datasetSelection)) {
    if (!requests.owns(request)) return false;
    requests.finish(request, 'cancelled');
    view.syncDataset(session);
    await view.arrive(session, { interrupted: true }); syncPlayback();
    return false;
  }
  if (!requests.owns(request)) return false;
  const { camera } = request;
  const reducedMotion = getReducedMotion();
  let fly: (() => void | Promise<void>) | undefined;
  if (camera.kind === 'focus') {
    if (!view.commit(request, session)) return false;
    fly = () => view.focus(session, request);
  } else {
    if (camera.kind === 'restore') {
      if (request.history.history === 'pop' || request.url !== windowTarget.location.href) view.commit(request, session);
      else session.url = request.url;
    }
    // Saved history can fly to its endpoint before exact restoration at arrival.
    const savedWorld = camera.kind === 'restore' && camera.animate && !reducedMotion
      ? navigation.savedTarget?.({ objectId: session.objectId, url: request.url, mount: session.mount }) : null;
    if (camera.kind === 'frame' || savedWorld) {
      fly = () => navigation.focus({ objectId: session.objectId, mount: session.mount!, signal: request.signal,
        reducedMotion, timing: request.timing,
        targetWorldCamera: camera.kind === 'frame' ? camera.world ?? undefined : savedWorld!,
        targetFocusPositionM: camera.kind === 'frame' ? camera.focusPositionM ?? undefined : undefined,
        centerSelection: camera.kind === 'frame' && camera.framing === 'center' });
    }
  }
  if (fly) {
    requests.advance(request, 'flying'); syncPlayback();
    const flown = await request.lifetime.wait(fly());
    if (flown.cancelled || !requests.owns(request)) return false;
  }
  if (camera.kind !== 'focus') commitSelection(request, selectionTransition);
  if (!await view.arrive(session, { request })) return false;
  finishArrival(session, request);
  return true;
}

/** Content, factory and flight prepare concurrently, with resources still owned by the request. */
export function prepareSceneReplacement({ fromId, source, object, request, navigation, requests, loadObject,
  loadContent, contentTransport, reducedMotion, getWorld }: {
  fromId: string;
  source: SceneSession | null;
  object: ObjectEntry;
  request: NavigationRequest;
  navigation: Navigation;
  requests: NavigationLifecycle;
  loadObject(id: string, descriptor?: ObjectDescriptor): Promise<SceneFactory>;
  loadContent: NavigationContentLoader | null;
  contentTransport: ReturnType<typeof createNavigationContent> | null;
  reducedMotion: boolean;
  getWorld(): WorldContextMount | null;
}) {
  const contentTask = (loadContent ?? contentTransport!.load)(object, { signal: request.signal })
    .then(content => {
      request.own(() => content.dispose?.());
      request.timing.mark('content-ready'); return content;
    });
  const descriptorTask = contentTransport?.descriptor(object, { signal: request.signal });
  const factoryTask = (descriptorTask ? descriptorTask.then(descriptor => loadObject(object.id, descriptor)) : loadObject(object.id))
    .then(factory => { request.timing.mark('factory-ready'); return factory; });
  // The registry already owns the physical frames. Start the camera while
  // the destination factory, content and texture bank load independently.
  requests.advance(request, 'flying');
  const preparationTask = navigation.prepare({
    fromId, toId: object.id, fromMount: source?.mount ?? null, toFactory: factoryTask,
    signal: request.signal, url: request.url,
    reducedMotion,
    targetWorldCamera: request.camera.kind === 'frame' ? request.camera.world ?? undefined : undefined,
    targetFocusPositionM: request.camera.kind === 'frame' ? request.camera.focusPositionM ?? undefined : undefined,
    centerSelection: request.camera.kind === 'frame' && request.camera.framing === 'center',
    preserveView: request.camera.kind === 'preserve',
    cameraViewport: getWorld()?.viewport,
    timing: request.timing,
    presentWorld: getWorld() ? (world, viewport, options) => getWorld()?.present(world, viewport, options) : null,
  });
  return request.lifetime.wait(Promise.all([factoryTask, contentTask, preparationTask]));
}
