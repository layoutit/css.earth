import { createSceneWorld, type WorldContextOwner } from './scene-world.mts';
import { createSceneView } from './scene-view.mts';
import { createSceneActivation } from './scene-activation.mts';
import { createScenePublication } from './scene-publication.mts';
import { focusExistingScene, prepareSceneReplacement } from './scene-transition.mts';
import { withDataset } from './dataset-url.mts';
import type { BrowserWindow, SceneFactory } from './browser-types.mts';
import { errorMessage, record } from './browser-types.mts';
import type { ObjectEntry } from './object-schema.mts';
import type { ObjectDescriptor } from '@cssearth/objects';
import type { NavigationOptions } from './navigation-history.mts';
import type { NavigationContent, NavigationContentLoader } from './navigation-content.mts';
import type { ObjectShell, ShellNavigationTransition } from './object-shell-types.mts';
import type { WorldHandoff } from './prepared-world-navigation.mts';
import { objectAdapter } from "./object-adapter.mts";
import { mountObjectShell } from "./object-shell-client.mts";
import { SCENE_OBJECTS } from './objects.mts';
import { createNavigationContent } from './navigation-content.mts';
import { createNavigationHistory, bindNavigationLinks } from './navigation-history.mts';
import { createPreparedWorldNavigation } from './prepared-world-navigation.mts';
import * as applicationWorldContext from './application-world-context.mts';
import { watchOverviewSelection } from './overview-selection.mts';
import { systemById } from './object-systems.mts';
import { SYSTEM_CENTERS } from './system-framing.mts';
import { overviewScopeFromUrl, preparedFocusFromUrl, withOverviewScope, withPreparedFocus } from './navigation-scope.mts';
import { createNavigationTiming } from './navigation-timing.mts';
import { retainInitialScene } from './initial-scene.mts';
import { createNavigationLifecycle, type NavigationRequest } from './navigation-lifecycle.mts';
import { createWorldPreferences } from './world-preferences.mts';
import { syncCompanionClouds } from './scene-datasets.mts';
import { createSceneSessions, type SceneSession as Session } from './scene-session.mts';
import { readPreparedDescriptor } from './prepared-descriptor.mts';

type Navigation = ReturnType<typeof createPreparedWorldNavigation>;
export type { WorldContextOwner, WorldContextMount } from './scene-world.mts';
export interface RouterOptions {
  stage: HTMLElement;
  objectId: string;
  loadObject?(id: string, descriptor?: ObjectDescriptor): Promise<SceneFactory>;
  documentTarget?: Document;
  windowTarget?: BrowserWindow;
  mountShell?: typeof mountObjectShell;
  reportError?(error: unknown): void;
  navigation?: Navigation | null;
  objects?: readonly ObjectEntry[];
  loadContent?: NavigationContentLoader | null;
  persistentWorldContext?: WorldContextOwner | null;
}

export function createSceneRouter({
  stage,
  objectId,
  loadObject = objectAdapter.load,
  documentTarget = document,
  windowTarget = window,
  mountShell = mountObjectShell,
  reportError = (error) => console.error(error),
  navigation = null,
  objects = SCENE_OBJECTS,
  loadContent = null,
  persistentWorldContext = null,
}: RouterOptions) {
  const scenes = createSceneSessions();
  let mountTask: Promise<boolean | undefined> | null = null;
  let motionEnabled = false;
  const preferences = createWorldPreferences();
  let hasPresented = false;
  const initialScene = retainInitialScene(stage);
  let destroyed = false;
  let shellOwner: { shell: ObjectShell | null } | null = null, historyOwner: ReturnType<typeof createNavigationHistory> | null = null, unbindLinks: (() => void) | null = null;
  let centeredObjectId: string | null = null;
  let overview = Boolean(overviewScopeFromUrl(windowTarget.location?.href ?? 'https://example.test'));
  const contentTransport = navigation && !loadContent ? createNavigationContent({ documentTarget, windowTarget }) : null;
  const reducedMotion = windowTarget.matchMedia?.("(prefers-reduced-motion: reduce)");
  let reducedMotionActive = false;
  const requests = createNavigationLifecycle({ onError: report, onCancel(request) {
    if (scenes.current?.request === request && scenes.state.kind !== 'ready') retire(scenes.current, null, { preserveShell: true, flush: false });
  } });

  const world = createSceneWorld({ owner: persistentWorldContext, stage, windowTarget, isCurrent: scenes.isCurrent,
    onMount(value) {
      // Replay display intent and any dataset cloud selected before the world was ready.
      if (scenes.current?.mount?.datasets) syncCompanionClouds(scenes.current.mount.datasets, value);
      preferences.apply(value);
    },
    onFlightStart() { motionEnabled = false; shellOwner?.shell?.setMotionEnabled?.(false); syncPlayback(); },
    onError: report,
  });
  const view = createSceneView({ windowTarget, scenes, requests, listenToPopState: !navigation,
    getHistory: () => historyOwner, getWorld: () => world.current, getMotion: () => motionEnabled,
    setMotion(next) { motionEnabled = next === true; syncPlayback(); }, onError: report,
  });
  const activation = createSceneActivation({ windowTarget, navigation, view, isCurrent: scenes.isCurrent, onError: report });
  const publication = createScenePublication({ stage, documentTarget, windowTarget,
    read: () => ({ state: scenes.state, pending: requests.current, objectId, overview, motionEnabled, reducedMotionActive,
      mountedObjectCount: scenes.current?.mount ? 1 : 0, playing: scenes.current?.playing ?? false,
      hasPresented: hasPresented || initialScene?.available === true }),
    getShell: () => shellOwner?.shell ?? null, getWorld: () => world.current,
  });

  // These survive scene teardown so a persisted document can restore itself.
  windowTarget.addEventListener("pagehide", destroyActiveScene);
  windowTarget.addEventListener("pageshow", restoreCachedScene);
  if (navigation && windowTarget.location?.href) {
    // Only a settled scene belongs to the entry that history names. An unfinished navigation
    // has not committed its own entry, so snapshotting its scene would overwrite the entry it left.
    historyOwner = createNavigationHistory({ windowTarget, objects, capture: () => requests.current ? null : view.capture(), navigate, navigating: () => requests.current !== null, embedded: 'embed' in documentTarget.documentElement.dataset, onError: report });
    unbindLinks = bindNavigationLinks({ documentTarget, windowTarget, objects,
      // During a body flight a focus link is an ordinary navigation, so the last click wins.
      selectPreparedFocus: id => requests.current ? null : world.current?.selectPreparedFocus?.(id) ?? null,
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
        motionEnabled = next === true;
        syncPlayback();
        session.viewUrl?.schedule();
      };
      if (!shellOwner) {
        const owner: { shell: ObjectShell | null } = { shell: null };
        shellOwner = owner;
        owner.shell = mountShell({ objectId, documentTarget, windowTarget, motionEnabled,
          ...preferences.bind(() => shellOwner === owner && scenes.current !== null, () => world.current),
          onMotionChange(next) { if (shellOwner === owner && scenes.current) {
            motionEnabled = next === true; syncPlayback(); scenes.current?.viewUrl?.schedule();
          } },
        });
      }
      const shell = shellOwner.shell!;
      session.shell = shell;
      const incomingOverview = request ? Boolean(overviewScopeFromUrl(request.url)) : overview;
      if (selectionTransition) selectionTransition.arrive({ content, overview: incomingOverview });
      else {
        if (content) shell.setObject(content);
        shell.setOverview?.(incomingOverview);
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
      if (persistentWorldContext) {
        const contextual = await session.wait(world.ensure());
        if (contextual.cancelled || !scenes.isCurrent(session)) return;
      }
      const framePresenter = world.current?.createFramePresenter?.();
      session.framePresenter = framePresenter;
      if (framePresenter) session.own(() => framePresenter.destroy());
      if (!await session.activate(factory ?? loadObject(objectId, readPreparedDescriptor(documentTarget, objectId)), stage, {
        deferTextureRefinement: true,
        ...(world.current ? { viewport: world.current.viewport } : {}),
        ...(framePresenter ? { framePresenter } : {}),
        onMotionRequest: requestMotion,
      }, handoff)) return false;
      const mount = session.mount;
      if (!mount) return false;
      world.connect(session, overview);
      const arrival = await activation.restore(session, handoff);
      if (!arrival) return arrival;
      if (!scenes.isCurrent(session)) return;
      const { interrupted } = arrival;
      if (request) {
        if (!requests.advance(request, 'committing') || !view.commit(request, session)) return false;
      }
      await view.bindInitial(session, { restore: !interrupted });
      if (!scenes.isCurrent(session)) return;
      activation.connectControls(session);
      if (!session.commit()) return false;
      if (mount.datasets) {
        syncCompanionClouds(mount.datasets, world.current);
        session.own(mount.datasets.subscribe(() => {
          if (!scenes.isCurrent(session) || requests.current || scenes.state.kind !== 'ready') return;
          syncCompanionClouds(mount.datasets!, world.current);
          view.syncDataset(session);
        }));
      }
      hasPresented = true;
      initialScene?.commit();
      if (request) requests.finish(request, interrupted ? 'interrupted' : 'finished');
      setOverview(Boolean(overviewScopeFromUrl(session.url ?? windowTarget.location?.href ?? 'https://example.test')));
      syncPlayback();
      connectOverviewSelection(session);
      if (request && (request.options.history !== 'pop' || interrupted)) session.viewUrl?.flush();
      return !interrupted;
    } catch (error) {
      if (scenes.isCurrent(session)) fail(session, error);
    }
  }

  function navigate(id: string, options: NavigationOptions = {}): Promise<boolean | undefined> {
    if (destroyed || !navigation || !navigation.supports(objectId, id)) return Promise.resolve(false);
    const object = objects.find(object => object.id === id);
    if (!object) return Promise.resolve(false);
    // A system overview is already the system-level selection for its star.
    // Clicking that star drills in instead of fitting it again.
    const opensOverviewFocus = overview && id === objectId && systemById(objects, id) !== null
      && overviewScopeFromUrl(scenes.current?.url ?? windowTarget.location.href) === 'system';
    const overviewTarget = options.overviewScope
      ? navigation.overviewTarget?.({ scope: options.overviewScope, objectId: id, fromId: objectId, mount: scenes.current?.mount })
      : null;
    const centerTarget = overviewTarget?.world ?? (options.recenter
      ? navigation.centerTarget?.({ objectId: id, fromId: objectId, mount: scenes.current?.mount, force: true })
      : options.sceneSelection && !opensOverviewFocus && id !== centeredObjectId && hasPresented
        ? (navigation.systemTarget?.({ objectId: id, fromId: objectId, mount: scenes.current?.mount })
          ?? navigation.centerTarget?.({ objectId: id, fromId: objectId, mount: scenes.current?.mount })) : null);
    // First selection frames the object's system; a repeat opens its close-up.
    centeredObjectId = centerTarget && !options.overview ? id : null;
    if (centerTarget) options = { ...options, targetWorldCamera: centerTarget,
      targetFocusPositionM: overviewTarget?.focusPositionM, centerSelection: true };
    if (centerTarget && options.sceneSelection && systemById(objects, id)) {
      options = { ...options, overview: true };
    }
    const cancelledFlight = requests.current !== null && !requests.current.options.centerSelection && !options.centerSelection;
    // Snapshot the departed view before cancelling: a superseded navigation records nothing.
    const mode = options.history ?? 'push';
    if (mode === 'pop') historyOwner?.remember();
    else historyOwner?.checkpoint();
    requests.cancel();
    world.current?.suspendFocus?.();
    scenes.current?.setViewUrl(null);
    let url = new URL(options.url ?? windowTarget.location?.href ?? object.route, windowTarget.location?.href);
    if (!options.url) {
      // A feature belongs to the page that named it; the next object starts without one.
      url.pathname = object.route; url.searchParams.delete('v'); url.searchParams.delete('feature');
      url = withDataset(withPreparedFocus(url, null, null), null);
      withOverviewScope(url, options.overview ? options.overviewScope ?? 'system' : null);
      if (options.feature) url.searchParams.set('feature', options.feature);
    }
    const request = requests.begin({ id, cancelledFlight,
      url: url.href, options: { ...options, history: mode }, timing: createNavigationTiming(windowTarget, objectId, id) });
    mountTask = transition(request, object);
    return mountTask;
  }

  async function transition(request: NavigationRequest, object: ObjectEntry): Promise<boolean | undefined> {
    if (!navigation) return false;
    const source = scenes.current;
    try {
      const options = request.options;
      world.current?.previewSelection?.(options.overview ? null : object.id);
      request.own(() => {
        if (!requests.current || requests.owns(request)) world.current?.previewSelection?.();
      });
      const selectionTransition = shellOwner?.shell?.beginNavigation?.(options.overview
        ? { kind: 'overview', overview: { scope: options.overviewScope ?? 'system', systemId: object.id },
          preview: Boolean(options.recenter || options.centerSelection) }
        : { kind: 'object', object, targetWorldCamera: options.targetWorldCamera });
      if (selectionTransition) request.own(() => selectionTransition.dispose());
      if (source && objectId === object.id && scenes.state.kind === 'ready') {
        return await focusExistingScene({ session: source, request, selectionTransition, navigation, requests, view,
          windowTarget, getOverview: () => overview, getReducedMotion: () => reducedMotionActive,
          setOverview, syncPlayback });
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
      const interruptedSelection = objectId === object.id && !request.options.url && record(error) &&
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
        const captured = view.capture();
        if (captured && interruptedSelection) {
          const drawn = new URL(captured, windowTarget.location.href);
          const selected = new URL(request.url, windowTarget.location.href);
          const token = drawn.searchParams.get('v');
          if (token) selected.searchParams.set('v', token); else selected.searchParams.delete('v');
          source.url = selected.href;
          historyOwner?.commit(selected.href, request.options);
          setOverview(Boolean(overviewScopeFromUrl(selected.href)));
        } else if (captured) {
          // The source still owns the last drawn camera when destination loading
          // fails. Rebinding its URL writer must not replay the departure pose.
          historyOwner?.commit(captured, { history: 'replace' });
        }
        await view.bind(source, { restore: false });
        source.viewUrl?.flush(); syncPlayback();
        if (!record(error) || error.preserveView !== true) report(error);
      }
      else if (scenes.current) fail(scenes.current, error);
      else report(error);
      return false;
    }
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

  function report(error: unknown) {
    try { reportError(error); } catch { /* Diagnostics cannot interrupt cleanup. */ }
  }
  function setOverview(enabled: boolean, selectionTransition?: ShellNavigationTransition | null) {
    const entered = enabled && !overview;
    overview = enabled;
    scenes.current?.mount?.navigation?.setZoomOutCentering?.(enabled);
    if (selectionTransition) selectionTransition.arrive({ overview: enabled });
    else shellOwner?.shell?.setOverview?.(enabled);
    world.current?.setOverview?.(enabled);
    if (stage.dataset) stage.dataset.selection = enabled ? 'system' : objectId;
    if (entered) aimAtSystemCenter();
  }
  /** A binary's overview is centred on the pair's centre of mass, not on the star the scene mounts. Entering the overview
   * turns the camera onto that centre at the same distance; zooming out then keeps the pair centred. */
  function aimAtSystemCenter() {
    const session = scenes.current, mount = session?.mount;
    if (!session || !mount || !navigation || !SYSTEM_CENTERS.has(objectId)) return;
    const target = navigation.systemCenterTarget?.({ objectId, fromId: objectId, mount });
    if (!target) return;
    void navigation.focus({ objectId, mount, signal: session.signal, reducedMotion: reducedMotionActive,
      targetWorldCamera: target.world, targetFocusPositionM: target.focusPositionM, centerSelection: true })
      .catch((error: unknown) => { if (!session.signal.aborted) reportError(error); });
  }
  function connectOverviewSelection(session: Session) {
    const owner = session.mount?.navigation;
    if (!owner || !navigation) return;
    session.own(watchOverviewSelection({ navigation: owner, objects, objectId,
      getOverview: () => overview,
      // The pending flight owns the camera; repeat-click bookkeeping must not
      // suppress zoom-out deselection after that flight has finished.
      // A focus the URL names is a selection from the moment it is named, before
      // its prepared bank has loaded and the runtime can report it. The camera
      // scale must not deselect it during that window.
      isAvailable: () => scenes.isCurrent(session) && scenes.state.kind === 'ready' && !requests.current
        && !owner.preparedFocus?.() && !preparedFocusFromUrl(windowTarget.location.href),
      windowTarget,
      onChange(next) {
        if (!next.overview || next.objectId === objectId) {
          // A mounted star and its system overview share the same camera, detail and
          // subscriptions. Change their selection in place in either direction.
          setOverview(next.overview);
          const url = withOverviewScope(withDataset(new URL(windowTarget.location.href), null), next.overview ? 'system' : null);
          session.url = url.href;
          historyOwner?.commit(url.href, { history: 'replace' });
          session.viewUrl?.flush();
          return;
        }
        void navigate(next.objectId, { overview: true, history: 'replace', preserveView: true });
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

function createWorldContextOwner({ objects, objectId, navigation }: { objects: readonly ObjectEntry[]; objectId: string; navigation: Navigation | null; stage: HTMLElement }) {
  if (!navigation || !objects.some(object => object.id === objectId && object.worldFrame)) return null;
  const create = applicationWorldContext.createApplicationWorldContext;
  if (typeof create !== 'function') return null;
  return create();
}

if (typeof document !== "undefined") {
  const stage = document.querySelector(".object-stage");
  if (!(stage instanceof HTMLElement)) throw new Error("Missing cssEarth planet stage.");
  const objectId = stage.dataset.objectId;
  if (!objectId) throw new Error("Missing cssEarth object identity.");
  const navigation = SCENE_OBJECTS.find(object => object.id === objectId)?.worldFrame
    ? createPreparedWorldNavigation({ objects: SCENE_OBJECTS }) : null;
  const persistentWorldContext = createWorldContextOwner({ objects: SCENE_OBJECTS, objectId, navigation, stage });
  createSceneRouter({ stage, objectId, navigation, persistentWorldContext });
}

export type { SceneDiagnostics } from './scene-publication.mts';
