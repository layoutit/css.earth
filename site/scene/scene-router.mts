import { createSceneWorld, type WorldContextOwner } from './scene-world.mts';
import { createSceneView } from './scene-view.mts';
import { selectSceneFeature } from './scene-feature.mts';
import { createSceneActivation } from './scene-activation.mts';
import { createScenePublication } from './scene-publication.mts';
import { focusExistingScene, prepareSceneReplacement } from './scene-transition.mts';
import type { BrowserWindow, SceneFactory } from '../browser-types.mts';
import { errorMessage, record } from '../browser-types.mts';
import type { ObjectEntry } from '../object-schema.mts';
import type { ObjectDescriptor } from '@cssearth/objects';
import type { WorldCameraPose } from '../../src/renderers/css/navigation/world-camera.js';
import { resolveNavigation, type NavigationIntent } from '../navigation/navigation-request.mts';
import type { NavigationContent, NavigationContentLoader } from '../navigation/navigation-content.mts';
import type { ObjectShell, ShellNavigationTransition } from '../object-shell-types.mts';
import type { WorldHandoff } from '../prepared-world-navigation.mts';
import { objectAdapter } from "../object-adapter.mts";
import { mountObjectShell } from "../object-shell-client.mts";
import { SCENE_OBJECTS } from '../objects.mts';
import { createNavigationContent } from '../navigation/navigation-content.mts';
import { createNavigationHistory, bindNavigationLinks } from '../navigation/navigation-history.mts';
import { createPreparedWorldNavigation } from '../prepared-world-navigation.mts';
import { createWorldViewport } from '../world-viewport.mts';
import { watchOverviewSelection } from '../overview-selection.mts';
import { SYSTEM_CENTERS, loadSystemViews, systemViewsLoaded } from '../system-framing.mts';
import { createSceneSelection, selectionTargetFromUrl } from './scene-selection.mts';
import { readInitialFocus } from '../focus-catalog.mts';
import { createNavigationTiming } from '../navigation/navigation-timing.mts';
import { retainInitialScene } from '../initial-scene.mts';
import { createNavigationLifecycle, type NavigationRequest } from '../navigation/navigation-lifecycle.mts';
import { createWorldPreferences } from '../world-preferences.mts';
import { createDatasetEffects } from './scene-datasets.mts';
import { createSceneSessions, type SceneSession as Session } from './scene-session.mts';
import { readPreparedDescriptor } from '../prepared-descriptor.mts';

type Navigation = ReturnType<typeof createPreparedWorldNavigation>;
export type { WorldContextOwner, WorldContextMount } from './scene-world.mts';
export interface RouterOptions {
  stage: HTMLElement;
  objectId: string;
  loadObject?(id: string, descriptor?: ObjectDescriptor, signal?: AbortSignal): Promise<SceneFactory>;
  documentTarget?: Document;
  windowTarget?: BrowserWindow;
  mountShell?: typeof mountObjectShell;
  reportError?(error: unknown): void;
  navigation: Navigation;
  objects?: readonly ObjectEntry[];
  loadContent?: NavigationContentLoader | null;
  persistentWorldContext: WorldContextOwner;
}

export function createSceneRouter({
  stage,
  objectId,
  loadObject = (id, descriptor, signal) => objectAdapter.load(id, descriptor, undefined, signal),
  documentTarget = document,
  windowTarget = window,
  mountShell = mountObjectShell,
  reportError = (error) => console.error(error),
  navigation,
  objects = SCENE_OBJECTS,
  loadContent = null,
  persistentWorldContext,
}: RouterOptions) {
  const scenes = createSceneSessions();
  let mountTask: Promise<boolean | undefined> | null = null;
  const preferences = createWorldPreferences({ getWorld: () => world.current,
    onMotionChange() { syncPlayback(); scenes.current?.viewUrl?.schedule(); },
  });
  let hasPresented = false;
  const initialScene = retainInitialScene(stage);
  let destroyed = false;
  let shellOwner: { shell: ObjectShell | null } | null = null, historyOwner: ReturnType<typeof createNavigationHistory> | null = null, unbindLinks: (() => void) | null = null;
  let centeredObjectId: string | null = null;
  const selection = createSceneSelection({ objectId,
    initial: selectionTargetFromUrl(new URL(windowTarget.location?.href ?? 'https://example.test'), objectId, objects),
    initialFocus: readInitialFocus(documentTarget), onChange: publishSelection });
  const contentTransport = !loadContent ? createNavigationContent({ documentTarget, windowTarget }) : null;
  const reducedMotion = windowTarget.matchMedia?.("(prefers-reduced-motion: reduce)");
  let reducedMotionActive = false;
  const requests = createNavigationLifecycle({ onError: report, onCancel(request) {
    if (scenes.current?.request === request && scenes.state.kind !== 'ready') retire(scenes.current, null, { preserveShell: true, flush: false });
  } });

  const world = createSceneWorld({ owner: persistentWorldContext, stage, windowTarget, isCurrent: scenes.isCurrent,
    onMount(value) {
      preferences.apply(value);
    },
    onSelectFocus(id) { void navigate(objectId, { kind: 'focus', id }).catch(report); },
    canPublishFocus: () => scenes.state.kind === 'ready' && !requests.current,
    readFocus: () => selection.current.kind === 'focus' ? selection.current.id : null,
    onFocusChange(session, focus) {
      selection.focus(focus.record, focus.sources, focus.presentation);
      if (focus.url === 'preserve') return;
      const url = new URL(windowTarget.location.href);
      if (focus.url === 'reframe') url.searchParams.delete('v');
      const selected = selection.url(url);
      if (selected !== windowTarget.location.href) view.replace(session, selected);
    },
    onCameraChange: followSelectionCamera,
    onError: report,
  });
  const view = createSceneView({ windowTarget, scenes, requests,
    getHistory: () => historyOwner, getWorld: () => world.current, getMotion: () => preferences.state.motionEnabled,
    setMotion(next) { preferences.set('motionEnabled', next); }, onError: report,
  });
  const activation = createSceneActivation({ windowTarget, navigation, view, isCurrent: scenes.isCurrent });
  const publication = createScenePublication({ stage, documentTarget, windowTarget,
    read: () => ({ state: scenes.state, pending: requests.current, objectId, subject: selection.current, motionEnabled: preferences.state.motionEnabled, reducedMotionActive,
      mountedObjectCount: scenes.current?.mount ? 1 : 0, playing: scenes.current?.playing ?? false,
      hasPresented: hasPresented || initialScene?.available === true }),
    getShell: () => shellOwner?.shell ?? null, getWorld: () => world.current,
  });

  // These survive scene teardown so a persisted document can restore itself.
  windowTarget.addEventListener("pagehide", destroyActiveScene);
  windowTarget.addEventListener("pageshow", restoreCachedScene);
  if (windowTarget.location?.href) {
    // Only a settled scene belongs to the entry that history names. An unfinished navigation
    // has not committed its own entry, so snapshotting its scene would overwrite the entry it left.
    historyOwner = createNavigationHistory({ windowTarget, objects, capture: () => requests.current ? null : view.capture(), navigate, navigating: () => requests.current !== null, embedded: 'embed' in documentTarget.documentElement.dataset, onError: report });
    unbindLinks = bindNavigationLinks({ documentTarget, windowTarget, objects,
      supports: id => navigation.supports(objectId, id), navigate, onError: report });
  }
  mountTask = mountApplication();

  return Object.freeze({
    get settled() { return mountTask; },
    state: publication.state,
    playback: publication.playback,
    navigate,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      destroyActiveScene();
      world.destroy();
      windowTarget.removeEventListener("pagehide", destroyActiveScene);
      windowTarget.removeEventListener("pageshow", restoreCachedScene);
      historyOwner?.destroy(); unbindLinks?.();
    },
  });

  async function mountApplication({ factory, content, handoff, request, selectionTransition }: {
    factory?: SceneFactory;
    content?: NavigationContent;
    handoff?: WorldHandoff;
    request?: NavigationRequest;
    selectionTransition?: ShellNavigationTransition | null;
  } = {}): Promise<boolean | undefined> {
    if (destroyed || scenes.current) return;
    const session = scenes.start({ objectId, request, url: request?.url ?? windowTarget.location?.href,
      onFailure: fail, onCleanupError: report });
    try {
      documentTarget.addEventListener("visibilitychange", syncPlayback);
      session.own(() =>
        documentTarget.removeEventListener("visibilitychange", syncPlayback));
      reducedMotionActive = reducedMotion?.matches === true;
      reducedMotion?.addEventListener("change", syncReducedMotion);
      session.own(() =>
        reducedMotion?.removeEventListener("change", syncReducedMotion));
      publication.publish();
      const requestMotion = (next: boolean) => {
        if (!scenes.isCurrent(session)) return;
        preferences.set('motionEnabled', next);
      };
      if (!shellOwner) {
        const owner: { shell: ObjectShell | null } = { shell: null };
        shellOwner = owner;
        owner.shell = mountShell({ objectId, readSelection: () => selection.current, documentTarget, windowTarget,
          preferences: preferences.bind(() => shellOwner === owner && scenes.current !== null),
          onResetDestination: () => { void navigate(objectId, { kind: 'feature', id: null }).catch(report); },
        });
      }
      const shell = shellOwner.shell!;
      session.shell = shell;
      if (request) selection.commit(request.subject, objectId);
      if (selectionTransition) selectionTransition.arrive({ content, subject: selection.current });
      else {
        if (content) shell.setObject(content);
        shell.presentSelection();
      }
      if (!scenes.isCurrent(session)) return;
      if (content && request) {
        // The prepared sidebar swap and the detail mount each restyle and lay out
        // hundreds of nodes. Let the swap render in its own frame first, so an
        // arriving flight does not drop a frame for both at once.
        const rendered = await session.wait(new Promise<void>(resolve =>
          windowTarget.requestAnimationFrame(() => windowTarget.setTimeout(resolve, 0))));
        if (rendered.cancelled || !scenes.isCurrent(session)) return;
      }
      publication.publish();
      // The body comes first: on a cold page the world's layers (sky, stars, volume, markers) load after the
      // detail mounts and connect to it. Only an arrival the world owns, a focus or overview, waits for them.
      if (handoff || worldOwnsArrival(request)) {
        const contextual = await session.wait(Promise.all([world.ensure(), loadSystemViews()]));
        if (contextual.cancelled || !scenes.isCurrent(session)) return;
      }
      const framePresenter = world.createFramePresenter();
      session.framePresenter = framePresenter;
      session.own(() => framePresenter.destroy());
      const viewport = world.viewport;
      if (!await session.activate(factory ?? loadObject(objectId, readPreparedDescriptor(documentTarget, objectId), session.signal), stage, {
        deferTextureRefinement: true,
        viewport,
        framePresenter,
        onMotionRequest: requestMotion,
        onFeatureSelect: id => { void navigate(objectId, { kind: 'feature', id }).catch(report); },
        datasetEffects: createDatasetEffects(session, () => world.current),
      }, handoff)) return false;
      const mount = session.mount;
      if (!mount) return false;
      // The world and system views load once the body is ready, so its textures have the connection to themselves.
      if (!systemViewsLoaded()) void loadSystemViews().catch(report);
      if (world.current) world.connect(session);
      else void world.ensure().then(() => {
        if (scenes.isCurrent(session)) { world.connect(session); publishSelection(); }
      }).catch(error => { if (!(error instanceof Error && error.name === 'AbortError')) report(error); });
      publishSelection();
      const arrival = await activation.restore(session, handoff);
      if (!arrival) return arrival;
      if (!scenes.isCurrent(session)) return;
      let { interrupted } = arrival;
      if (request?.feature && !interrupted) {
        const selected = await request.lifetime.wait(selectFeature(session, request));
        if (selected.cancelled || !requests.owns(request)) return false;
        interrupted = !selected.value;
      }
      if (!await view.arrive(session, { request, interrupted })) return false;
      if (!scenes.isCurrent(session)) return;
      activation.connectControls(session);
      if (!session.commit()) return false;
      if (mount.datasets) {
        session.own(mount.datasets.subscribe(() => {
          if (!scenes.isCurrent(session) || requests.current || scenes.state.kind !== 'ready') return;
          view.syncDataset(session);
        }));
      }
      hasPresented = true;
      initialScene?.commit();
      finishArrival(session, request, interrupted);
      if (!request && arrival.feature) return navigate(objectId, { kind: 'feature', id: arrival.feature });
      return !interrupted;
    } catch (error) {
      if (scenes.isCurrent(session)) fail(session, error);
    }
  }

  function navigate(id: string, intent: NavigationIntent = { kind: 'object' }): Promise<boolean | undefined> {
    // System framing reads its prepared candidates; they load after the first body, so a very early click waits for them.
    if (!destroyed && intent.kind !== 'feature' && !systemViewsLoaded()) return loadSystemViews().then(() => navigate(id, intent));
    if (intent.kind === 'focus' && scenes.current) id = objectId;
    if (destroyed || !navigation.supports(objectId, id)) return Promise.resolve(false);
    const object = objects.find(object => object.id === id);
    if (!object) return Promise.resolve(false);
    const source = scenes.current;
    const resolved = resolveNavigation(intent, { object, objects, navigation, current: {
      objectId, href: intent.kind === 'focus' ? source?.url ?? windowTarget.location.href : windowTarget.location.href, subject: selection.current,
      centeredObjectId, hasPresented, reuseScene: !!source && objectId === id && scenes.state.kind === 'ready',
      mount: source?.mount ?? null, pending: requests.current,
    } });
    centeredObjectId = resolved.centeredObjectId;
    // Snapshot the departed view before cancelling: a superseded navigation records nothing.
    if (resolved.destination.history.history === 'pop') historyOwner?.remember();
    else historyOwner?.checkpoint();
    requests.cancel();
    scenes.current?.setViewUrl(null);
    const request = requests.begin({ ...resolved.destination, timing: createNavigationTiming(windowTarget, objectId, id) });
    if (request.camera.kind === 'focus' || request.camera.kind === 'surface' || request.feature) preferences.set('motionEnabled', false);
    mountTask = transition(request, object);
    return mountTask;
  }

  async function transition(request: NavigationRequest, object: ObjectEntry): Promise<boolean | undefined> {
    const source = scenes.current;
    try {
      if (request.subject.kind !== 'focus') {
        world.current?.previewSelection?.(request.subject.kind === 'overview' ? null : object.id);
        request.own(() => {
          if (!requests.current || requests.owns(request)) world.current?.previewSelection?.();
        });
      }
      const selectionTransition = request.subject.kind === 'focus' ? null : shellOwner?.shell?.beginNavigation?.(request.subject.kind === 'overview'
        ? { kind: 'overview', overview: request.subject.overview,
          preview: request.camera.kind === 'frame' && request.camera.framing === 'center' }
        : { kind: 'object', object, targetWorldCamera: request.camera.kind === 'frame' ? request.camera.world ?? undefined : undefined });
      if (selectionTransition) request.own(() => selectionTransition.dispose());
      if (source && request.scene === 'reuse') {
        return await focusExistingScene({ session: source, request, selectionTransition, navigation, requests, view,
          windowTarget, getReducedMotion: () => reducedMotionActive,
          commitSelection, finishArrival, syncPlayback, selectFeature });
      }
      syncPlayback();
      const loaded = await prepareSceneReplacement({ fromId: objectId, source, object, request, navigation, requests,
        loadObject, loadContent, contentTransport, reducedMotion: reducedMotionActive, getWorld: () => world.current });
      if (loaded.cancelled || !requests.owns(request)) return false;
      const [factory, content, handoff] = loaded.value;
      request.timing.mark('handoff');
      if (scenes.current) retire(scenes.current, null, { preserveShell: true, flush: false });
      objectId = object.id;
      if (stage.dataset) stage.dataset.objectId = object.id;
      const result = await mountApplication({ factory, content, handoff, request, selectionTransition });
      requests.finish(request, scenes.state.kind === 'failed' ? 'failed' : 'cancelled');
      return result === true;
    } catch (error) {
      const interruptedSelection = objectId === object.id && request.origin === 'selection' && record(error) &&
        error.name === 'AbortError' && error.preserveView === true;
      if (!requests.finish(request, error instanceof Error && error.name === 'AbortError' ? 'cancelled' : 'failed')) return false;
      centeredObjectId = null;
      publication.publish();
      if (scenes.current === source && source) {
        source.shell?.setDatasetNotice?.(errorMessage(error));
        // Input can take over a same-owner selection flight before arrival. The
        // selected destination still owns that camera: keep only the drawn view
        // from the departed URL, otherwise its old prepared focus is restored
        // and pulls the camera back to the object the user just left.
        const snapshot = view.capture(interruptedSelection ? request.url : undefined);
        // A failed focus load leaves the previous native target in place. Recover
        // its identity with the drawn camera instead of retrying the failed URL.
        const captured = snapshot && request.camera.kind === 'focus'
          ? selection.url(new URL(snapshot, windowTarget.location.href)) : snapshot;
        if (captured && interruptedSelection) {
          const selected = new URL(captured, windowTarget.location.href).href;
          source.url = selected;
          historyOwner?.commit(selected, request.history);
          commitSelection(request);
        } else if (captured) {
          // The source still owns the last drawn camera when destination loading
          // fails. Rebinding its URL writer must not replay the departure pose.
          view.replace(source, new URL(captured, windowTarget.location.href).href);
        }
        await view.arrive(source, { interrupted: true });
        source.viewUrl?.flush(); syncPlayback();
        if (!record(error) || error.preserveView !== true) report(error);
      }
      else if (scenes.current) fail(scenes.current, error);
      else report(error);
      return false;
    }
  }

  function selectFeature(session: Session, request: NavigationRequest) {
    return selectSceneFeature(session, request, objects.find(object => object.id === session.objectId)?.name ?? session.objectId);
  }

  function finishArrival(session: Session, request?: NavigationRequest, interrupted = false) {
    if (request) requests.finish(request, interrupted ? 'interrupted' : 'finished');
    const mounted = !request || request.scene === 'replace';
    if (mounted) {
      if (session.mount?.navigation) followSelectionCamera(session, session.mount.navigation.capture());
      publishSelection();
      if (selection.current.kind === 'overview') aimAtSystemCenter();
    }
    syncPlayback();
    if (mounted) connectOverviewSelection(session);
    if (request && (interrupted || (request.scene === 'replace'
      ? request.history.history !== 'pop' : request.camera.kind !== 'restore'))) session.viewUrl?.flush();
  }

  function syncReducedMotion() {
    // Reading MediaQueryList.matches can update Chrome's change baseline.
    // Sample at notification boundaries, never from diagnostic getters.
    reducedMotionActive = reducedMotion?.matches === true;
    syncPlayback();
  }

  function syncPlayback() {
    const session = scenes.current;
    if (!session) return;
    try {
      if (scenes.state.kind === 'ready' && session.mount?.navigation) followSelectionCamera(session, session.mount.navigation.capture());
      const { allowed } = publication.playback();
      if (!session.play(allowed)) return;
      publication.publish();
    } catch (error) { fail(session, error); }
  }

  function retire(session: Session, error: unknown = null, { preserveShell = false, flush = true } = {}) {
    if (!scenes.isCurrent(session)) return;
    // Detach and invalidate before any user cleanup or native wait can finish.
    const cleanupErrors = session.dispose(error === null ? undefined : error, { flush });
    if (!preserveShell) {
      hasPresented = false;
      const owner = shellOwner; shellOwner = null;
      try { owner?.shell?.destroy(); } catch (error) { cleanupErrors.push(error); }
    }
    publication.publish();
    for (const failure of cleanupErrors) report(failure);
  }

  /** A focus or overview arrival is placed by the world, so it cannot start before the world has loaded. */
  function worldOwnsArrival(request?: NavigationRequest) {
    if (request) return request.subject.kind === 'focus' || request.subject.kind === 'overview';
    const params = new URL(windowTarget.location.href).searchParams;
    return ['focus', 'focusLens', 'overview'].some(name => params.has(name));
  }
  function report(error: unknown) {
    try { reportError(error); } catch { /* Diagnostics cannot interrupt cleanup. */ }
  }
  function followSelectionCamera(session: Session, frame: WorldCameraPose) {
    if (requests.current) return;
    if (selection.followCamera(frame) && scenes.state.kind === 'ready') {
      view.replace(session, selection.url(session.url ?? windowTarget.location.href));
    }
  }
  function publishSelection() {
    const overview = selection.context.kind === 'overview';
    scenes.current?.mount?.navigation?.setZoomOutCentering?.(overview);
    shellOwner?.shell?.presentSelection();
    world.current?.setOverview?.(overview, selection.current.kind === 'overview' ? selection.current.overview.scope : undefined);
    if (stage.dataset) {
      const subject = selection.current;
      stage.dataset.selection = subject.kind === 'overview' ? subject.overview.scope
        : subject.kind === 'focus' ? subject.id : subject.objectId;
    }
    publication.publish();
  }
  function commitSelection(request: NavigationRequest, transition?: ShellNavigationTransition | null) {
    const wasOverview = selection.context.kind === 'overview';
    selection.commit(request.subject, objectId);
    transition?.arrive({ subject: selection.current });
    publishSelection();
    if (!wasOverview && selection.current.kind === 'overview') aimAtSystemCenter();
  }
  /** A binary's overview is centred on the pair's centre of mass, not on the star the scene mounts. Entering the overview
   * turns the camera onto that centre at the same distance; zooming out then keeps the pair centred. */
  function aimAtSystemCenter() {
    const session = scenes.current, mount = session?.mount;
    if (!session || !mount || !SYSTEM_CENTERS.has(objectId)) return;
    const target = navigation.systemCenterTarget?.({ objectId, fromId: objectId, mount });
    if (!target) return;
    void navigation.focus({ objectId, mount, signal: session.signal, reducedMotion: reducedMotionActive,
      targetWorldCamera: target.world, targetFocusPositionM: target.focusPositionM, centerSelection: true })
      .catch((error: unknown) => { if (!session.signal.aborted) reportError(error); });
  }
  function connectOverviewSelection(session: Session) {
    const owner = session.mount?.navigation;
    if (!owner) return;
    session.own(watchOverviewSelection({ navigation: owner, objects, objectId,
      getOverview: () => selection.context.kind === 'overview',
      // The pending flight owns the camera; repeat-click bookkeeping must not
      // suppress zoom-out deselection after that flight has finished.
      // A focus the URL names is a selection from the moment it is named, before
      // its prepared bank has loaded and the runtime can report it. The camera
      // scale must not deselect it during that window.
      isAvailable: () => scenes.isCurrent(session) && scenes.state.kind === 'ready' && !requests.current
        && selection.current.kind !== 'focus',
      windowTarget,
      onChange(next) {
        if (!next.overview || next.objectId === objectId) {
          // A mounted star and its system overview share the same camera, detail and
          // subscriptions. Change their selection in place in either direction.
          selection.commit(next.overview ? { kind: 'overview', overview: { scope: 'system', systemId: objectId } }
            : { kind: 'object', objectId }, objectId);
          if (next.overview) aimAtSystemCenter();
          view.replace(session, selection.url(windowTarget.location.href));
          session.viewUrl?.flush();
          return;
        }
        void navigate(next.objectId, { kind: 'overview', scope: 'system', camera: 'preserve' });
      },
    }));
  }
  function fail(session: Session, error: unknown) {
    if (!scenes.isCurrent(session)) return;
    if (session.request) requests.finish(session.request, 'failed');
    try { retire(session, error instanceof Error ? error : new Error(String(error))); }
    catch (failure) { report(failure); }
    if (initialScene?.available) {
      world.destroy();
      initialScene.restore();
    }
    report(error);
  }
  function destroyActiveScene() {
    centeredObjectId = null;
    world.destroy();
    hasPresented = false;
    requests.cancel();
    if (scenes.current) {
      try { retire(scenes.current); } catch (error) { report(error); }
    } else if (shellOwner) {
      const owner = shellOwner; shellOwner = null;
      try { owner.shell?.destroy(); } catch (error) { report(error); }
      publication.publish();
    }
  }
  function restoreCachedScene(event: PageTransitionEvent) {
    if (event.persisted && !scenes.current && !destroyed) mountTask = mountApplication();
  }
}

function createWorldContextOwner(): WorldContextOwner {
  // The world renderer, its markers and the minimap data stay out of the startup script; they load with the world.
  let world: Promise<ReturnType<typeof import('../application-world-context.mts').createApplicationWorldContext>> | null = null;
  return {
    createViewport: createWorldViewport,
    async mount(options: Parameters<WorldContextOwner['mount']>[0]) {
      world ??= import('../application-world-context.mts').then(module => module.createApplicationWorldContext());
      return (await world).mount(options);
    },
  } satisfies WorldContextOwner;
}

if (typeof document !== "undefined") {
  const stage = document.querySelector(".object-stage");
  if (!(stage instanceof HTMLElement)) throw new Error("Missing cssEarth planet stage.");
  const objectId = stage.dataset.objectId;
  if (!objectId) throw new Error("Missing cssEarth object identity.");
  const navigation = createPreparedWorldNavigation({ objects: SCENE_OBJECTS });
  const persistentWorldContext = createWorldContextOwner();
  createSceneRouter({ stage, objectId, navigation, persistentWorldContext });
}

export type { SceneDiagnostics } from './scene-publication.mts';
