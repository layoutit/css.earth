import { requireSceneLifecycle } from "./scene-contract.mjs";
import { objectAdapter } from "./object-adapter.mjs";
import { mountPlanetShell } from "./planet-shell-client.mjs";
import { automaticPlaybackPolicy } from "./runtime-policy.mjs";
import { createSceneLifetime } from "../src/platform/scene-lifetime.mjs";
import { bindViewUrl } from "./view-url-runtime.mjs";
import { OBJECTS } from './objects.mjs';
import { createNavigationContent } from './navigation-content.mjs';
import { createNavigationHistory, bindNavigationLinks } from './navigation-history.mjs';
import { formatSharedView } from '../src/renderers/css/dist/navigation.js';
import { createPreparedWorldNavigation } from './prepared-world-navigation.mjs';
import * as applicationWorldContext from './application-world-context.mjs';
import { solarSystemFocus, watchOverviewSelection } from './overview-selection.mjs';
import { createNavigationTiming } from './navigation-timing.mjs';

const DEVELOPMENT_DIAGNOSTICS = import.meta.env?.DEV === true;

export function createSceneRouter({
  stage,
  objectId,
  loadObject = objectAdapter.load,
  documentTarget = document,
  windowTarget = window,
  mountShell = mountPlanetShell,
  reportError = (error) => console.error(error),
  navigation = null,
  objects = OBJECTS,
  loadContent = null,
  persistentWorldContext = null,
}) {
  let active = null;
  let mountTask = null;
  let motionEnabled = false;
  let scenePaused = true;
  let sceneError = null;
  let sceneState = "loading";
  let hasPresented = false;
  let destroyed = false;
  let nextGeneration = 0;
  let shellOwner = null, pending = null, historyOwner = null, unbindLinks = null;
  let overview = new URL(windowTarget.location?.href ?? 'https://example.test').searchParams.get('overview') === 'solar-system';
  const worldContextOwner = persistentWorldContext;
  let worldContextMount = null;
  let worldContextMountTask = null;
  let worldContextAbort = null;
  const contentTransport = navigation && !loadContent ? createNavigationContent({ documentTarget, windowTarget }) : null;
  const reducedMotion = windowTarget.matchMedia?.("(prefers-reduced-motion: reduce)");
  let reducedMotionActive = false;

  // These survive scene teardown so a persisted document can restore itself.
  windowTarget.addEventListener("pagehide", destroyActiveScene);
  windowTarget.addEventListener("pageshow", restoreCachedScene);
  if (navigation && windowTarget.location?.href) {
    historyOwner = createNavigationHistory({ windowTarget, objects, capture: captureUrl, navigate, onError: report });
    unbindLinks = bindNavigationLinks({ documentTarget, windowTarget, objects,
      supports: id => navigation.supports(objectId, id), navigate, onError: report });
  }
  mountTask = mountApplication();

  return Object.freeze({
    get settled() { return mountTask; },
    state: readSceneState,
    playback: readPlayback,
    navigate,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      destroyActiveScene();
      destroyWorldContext();
      windowTarget.removeEventListener("pagehide", destroyActiveScene);
      windowTarget.removeEventListener("pageshow", restoreCachedScene);
      historyOwner?.destroy(); unbindLinks?.();
    },
  });

  async function mountApplication({ factory, content, handoff, request } = {}) {
    if (destroyed || active) return;
    const session = {
      generation: ++nextGeneration, lifetime: createSceneLifetime(),
      mount: null, shell: null, lastCommand: null, viewUrl: null, request,
      url: request?.url ?? windowTarget.location?.href,
    };
    active = session;
    sceneError = null;
    sceneState = "loading";
    scenePaused = true;
    try {
      documentTarget.addEventListener("visibilitychange", syncPlayback);
      session.lifetime.onDispose(() =>
        documentTarget.removeEventListener("visibilitychange", syncPlayback));
      reducedMotionActive = reducedMotion?.matches === true;
      reducedMotion?.addEventListener("change", syncReducedMotion);
      session.lifetime.onDispose(() =>
        reducedMotion?.removeEventListener("change", syncReducedMotion));
      publishSceneState();
      const requestMotion = (next) => {
        if (active !== session || session.lifetime.disposed) return;
        motionEnabled = next === true;
        syncPlayback();
        session.viewUrl?.schedule();
      };
      if (!shellOwner) {
        const owner = {};
        shellOwner = owner;
        owner.shell = mountShell({ objectId, documentTarget, windowTarget, motionEnabled,
          onMotionChange(next) { if (shellOwner === owner && active) {
            motionEnabled = next === true; syncPlayback(); active?.viewUrl?.schedule();
          } },
        });
      }
      const shell = shellOwner.shell;
      session.shell = shell;
      if (content) shell.setObject(content);
      shell.setOverview?.(request ? new URL(request.url).searchParams.get('overview') === 'solar-system' : overview);
      if (active !== session) return;
      publishSceneState();
      if (worldContextOwner) {
        const contextual = await session.lifetime.wait(ensureWorldContext());
        if (contextual.cancelled || active !== session) return;
      }
      const loaded = await session.lifetime.wait(factory ?? loadObject(objectId));
      if (loaded.cancelled || active !== session) return;
      // Keep the raw handle even if validation fails.
      let mount;
      mount = loaded.value(stage, {
        ...handoff?.mountOptions,
        ...(worldContextMount ? { externalWorldContext: true } : {}),
        onMotionRequest: requestMotion,
        onError(error) {
          if (active === session && session.mount === mount) fail(session, error);
        },
      });
      session.mount = mount;
      for (const error of session.lifetime.onDispose(() => mount?.destroy?.())) report(error);
      // Observe even a malformed handle's ready promise before validation or
      // an initial pause can fail. Cleanup must not leave its rejection unowned.
      const ready = Promise.resolve(mount?.ready);
      ready.catch(() => {});
      requireSceneLifecycle(mount, objectId);
      if (active !== session) return;
      syncPlayback();
      const result = await session.lifetime.wait(ready);
      if (result.cancelled || active !== session) return;
      connectWorldContext(session, mount, objectId);
      let interrupted = false;
      if (handoff?.afterMount) {
        try {
          const completed = await session.lifetime.wait(handoff.afterMount(mount, { signal: request.controller.signal }));
          if (completed.cancelled || active !== session || request.controller.signal.aborted) return;
        } catch (error) {
          if (error?.name !== 'AbortError' || error.preserveView !== true || active !== session ||
              session.lifetime.disposed || request.controller.signal.aborted) throw error;
          // The detailed destination already owns the camera. Real input ends
          // its flight without retiring that scene or restoring the endpoint.
          interrupted = true;
          const drawnUrl = captureUrl();
          if (drawnUrl) request.url = session.url = new URL(drawnUrl, windowTarget.location.href).href;
        }
      }
      if (request) historyOwner?.commit(request.url, request.options);
      if (mount.sharedView && windowTarget.location?.href) {
        session.viewUrl = bindViewUrl({ windowTarget, view: mount.sharedView,
          getMotion: () => motionEnabled,
          setMotion(next) { shell.setMotionEnabled?.(next); requestMotion(next); },
          onError(error) { console.warn(error.message); },
          listenToPopState: !navigation,
        });
        const viewOwner = session.viewUrl;
        session.lifetime.onDispose(() => viewOwner.destroy());
        if (!interrupted) await session.lifetime.wait(session.viewUrl.restore());
        if (active !== session || session.lifetime.disposed) return;
      }
      worldContextMount?.restoreFocus?.(session.url ?? windowTarget.location.href);
      if (mount.destinations) shell.setDestinations?.({
        ...mount.destinations,
        async select(place) {
          shell.setMotionEnabled?.(false);
          return mount.destinations.select(place);
        },
      });
      shell.setCamera?.(mount);
      session.lifetime.onDispose(() => shell.setCamera?.(null));
      sceneState = "ready";
      hasPresented = true;
      if (pending === request) pending = null;
      setOverview(new URL(session.url ?? windowTarget.location?.href ?? 'https://example.test').searchParams.get('overview') === 'solar-system');
      syncPlayback();
      connectOverviewSelection(session);
      if (request && (request.options.history !== 'pop' || interrupted)) session.viewUrl?.flush();
      return !interrupted;
    } catch (error) {
      if (active === session) fail(session, error);
    }
  }

  function captureUrl() {
    if (!windowTarget.location?.href) return null;
    const url = new URL(active?.url ?? windowTarget.location.href);
    const saved = active?.mount?.sharedView?.capture(motionEnabled);
    if (saved) url.searchParams.set('v', new URLSearchParams(formatSharedView(saved)).get('v'));
    return url.pathname + url.search + url.hash;
  }

  function navigate(id, options = {}) {
    if (destroyed || !navigation || !navigation.supports(objectId, id)) return Promise.resolve(false);
    const object = objects.find(object => object.id === id);
    if (!object) return Promise.resolve(false);
    const cancelledFlight = pending !== null;
    if (pending) {
      const previous = pending;
      pending = null; previous.controller.abort(); previous.lifetime.destroy();
      if (active?.request === previous && sceneState !== 'ready') retire(active, null, { preserveShell: true, flush: false });
    }
    const mode = options.history ?? 'push';
    if (mode === 'pop') historyOwner?.remember();
    else historyOwner?.checkpoint();
    worldContextMount?.suspendFocus?.();
    active?.viewUrl?.destroy();
    if (active) active.viewUrl = null;
    const url = new URL(options.url ?? windowTarget.location?.href ?? object.route, windowTarget.location?.href);
    if (!options.url) {
      url.pathname = object.route; url.searchParams.delete('v'); url.searchParams.delete('overview'); url.searchParams.delete('focus');
      if (options.overview) url.searchParams.set('overview', 'solar-system');
    }
    const request = { id, cancelledFlight, controller: new AbortController(), lifetime: createSceneLifetime(),
      url: url.href, options: { ...options, history: mode }, timing: createNavigationTiming(windowTarget, objectId, id) };
    request.controller.signal.addEventListener('abort', () => request.timing.mark('cancelled'), { once: true });
    pending = request;
    if (object.id !== objectId && !options.overview) {
      const restoreSelection = shellOwner?.shell?.beginObjectSelection?.(object);
      if (restoreSelection) request.lifetime.onDispose(restoreSelection);
    } else if (object.id === objectId && !options.overview) shellOwner?.shell?.setOverview?.(false);
    mountTask = transition(request, object);
    return mountTask;
  }

  async function transition(request, object) {
    const source = active;
    try {
      if (source && objectId === object.id && sceneState === 'ready') {
        const restore = request.options.history === 'pop' ||
          (Boolean(request.options.url) && new URL(request.url).searchParams.has('v'));
        if (restore) {
          if (request.options.history === 'pop' || request.url !== windowTarget.location.href) historyOwner?.commit(request.url, request.options);
          source.url = request.url;
        } else if (!request.cancelledFlight && !request.options.preserveView && navigation.focus) {
          syncPlayback();
          const focused = await request.lifetime.wait(navigation.focus({ objectId: object.id,
            mount: source.mount, signal: request.controller.signal, reducedMotion: reducedMotionActive,
            targetWorldCamera: request.options.targetWorldCamera, timing: request.timing }));
          if (focused.cancelled || pending !== request) return false;
        }
        if (!restore) {
          source.url = request.url;
          const changesSelection = overview !== (new URL(request.url).searchParams.get('overview') === 'solar-system');
          historyOwner?.commit(request.url, { ...request.options,
            history: changesSelection ? request.options.history : 'replace' });
        }
        setOverview(new URL(request.url).searchParams.get('overview') === 'solar-system');
        await bindSessionView(source, { restore });
        if (pending !== request) return false;
        pending = null; request.lifetime.destroy(); syncPlayback();
        if (!restore) source.viewUrl?.flush();
        request.timing.mark('finished');
        return true;
      }
      syncPlayback();
      const contentTask = (loadContent ?? contentTransport.load)(object, { signal: request.controller.signal })
        .then(content => {
          request.lifetime.onDispose(() => content.dispose?.());
          request.timing.mark('content-ready'); return content;
        });
      const factoryTask = loadObject(object.id).then(factory => { request.timing.mark('factory-ready'); return factory; });
      // The registry already owns the physical frames. Start the camera while
      // the destination factory, content and texture bank load independently.
      const preparationTask = navigation.prepare({
        fromId: objectId, toId: object.id, fromMount: source?.mount ?? null, toFactory: factoryTask,
        signal: request.controller.signal, history: request.options.history, url: request.url,
        motionRequested: motionEnabled, reducedMotion: reducedMotionActive,
        targetWorldCamera: request.options.targetWorldCamera,
        preserveView: request.options.preserveView,
        timing: request.timing,
      });
      const loaded = await request.lifetime.wait(Promise.all([factoryTask, contentTask, preparationTask]));
      if (loaded.cancelled || pending !== request) return false;
      const [factory, content, handoff] = loaded.value;
      request.timing.mark('handoff');
      if (active) retire(active, null, { preserveShell: true, flush: false });
      objectId = object.id;
      if (stage.dataset) stage.dataset.objectId = object.id;
      const result = await mountApplication({ factory, content, handoff, request });
      request.timing.mark(result === true ? 'finished' : sceneState === 'error' ? 'failed' : 'cancelled');
      if (pending === request) pending = null;
      request.lifetime.destroy();
      return result === true;
    } catch (error) {
      request.timing.mark(error?.name === 'AbortError' ? 'cancelled' : 'failed');
      if (pending !== request || request.controller.signal.aborted) return false;
      pending = null; request.controller.abort(); request.lifetime.destroy();
      if (active === source && source) {
        if (error?.preserveView === true) {
          const url = captureUrl();
          if (url && windowTarget.location.pathname !== new URL(source.url).pathname) historyOwner?.commit(url, { history: 'replace' });
          await bindSessionView(source, { restore: false });
          source.viewUrl?.flush(); syncPlayback();
        } else { await bindSessionView(source); syncPlayback(); report(error); }
      }
      else if (active) fail(active, error);
      else report(error);
      return false;
    }
  }

  async function bindSessionView(session, { restore = true } = {}) {
    if (active !== session || !session.mount?.sharedView || !windowTarget.location?.href) return;
    // A failed history restoration keeps its incoming URL for diagnosis, like
    // Galaxio's invalid-route state. The old scene must not write into it.
    if (new URL(session.url).pathname !== windowTarget.location.pathname) return;
    worldContextMount?.suspendFocus?.();
    const owner = bindViewUrl({ windowTarget, view: session.mount.sharedView, listenToPopState: !navigation,
      getMotion: () => motionEnabled,
      setMotion(next) { session.shell.setMotionEnabled?.(next); motionEnabled = next === true; syncPlayback(); },
      onError: report,
    });
    session.viewUrl = owner;
    session.lifetime.onDispose(() => owner.destroy());
    if (restore) await session.lifetime.wait(owner.restore());
    if (active === session && !session.lifetime.disposed) worldContextMount?.restoreFocus?.(session.url);
  }

  function readPlayback() {
    return Object.freeze({
      motionRequested: motionEnabled,
      ...automaticPlaybackPolicy({
        sceneState: pending ? 'loading' : sceneState, motionRequested: motionEnabled,
        documentHidden: documentTarget.hidden,
        reducedMotion: reducedMotionActive,
      }),
    });
  }

  function readSceneState() {
    const selected = pending ? new URL(pending.url).searchParams.get('overview') !== 'solar-system' : !overview;
    return Object.freeze({
      activeObjectId: objectId,
      selectedObjectId: selected ? pending?.id ?? objectId : null,
      overview: !selected,
      error: sceneError instanceof Error ? sceneError.message : null,
      lifecycle: sceneState === "ready" ? (scenePaused ? "paused" : "mounted") : sceneState,
      mountedObjectCount: active?.mount ? 1 : 0,
      ready: sceneState === "ready" && pending === null,
    });
  }

  function syncReducedMotion() {
    // Reading MediaQueryList.matches can update Chrome's change baseline.
    // Sample at notification boundaries, never from diagnostic getters.
    reducedMotionActive = reducedMotion?.matches === true;
    syncPlayback();
  }

  function syncPlayback() {
    const session = active;
    if (!session || session.lifetime.disposed) return;
    try {
      const { allowed } = readPlayback();
      if (session.mount && session.lastCommand !== allowed) {
        if (allowed) session.mount.resume();
        else session.mount.pause();
        if (active !== session) return;
        session.lastCommand = allowed;
      }
      scenePaused = !allowed;
      publishSceneState();
    } catch (error) { fail(session, error); }
  }

  function publishSceneState() {
    const state = readSceneState();
    const root = documentTarget.documentElement;
    const body = documentTarget.body;
    root.dataset.scenePresented = String(hasPresented);
    body.classList.remove("loading", "ready", "paused", "error");
    if (sceneState === "loading") {
      root.dataset.ready = "loading";
      body.classList.add("loading");
      stage.ariaBusy = "true";
    } else if (sceneState === "ready") {
      root.dataset.ready = "true";
      body.classList.add("ready");
      if (scenePaused) body.classList.add("paused");
      stage.ariaBusy = "false";
    } else {
      if (sceneState === "error") {
        root.dataset.ready = "error";
        body.classList.add("error");
      } else delete root.dataset.ready;
      stage.ariaBusy = "false";
    }
    if (sceneState === "loading" || sceneState === "ready") {
      root.dataset.playing = String(sceneState === "ready" && !scenePaused);
    } else delete root.dataset.playing;
    shellOwner?.shell?.setPlaybackState?.(readPlayback());
    if (DEVELOPMENT_DIAGNOSTICS) {
      windowTarget.__cssEarth = Object.freeze({
        activeObjectId: objectId,
        get selectedObjectId() { return readSceneState().selectedObjectId; },
        get overview() { return readSceneState().overview; },
        get mountedObjectCount() { return readSceneState().mountedObjectCount; },
        get ready() { return readSceneState().ready; },
        get error() { return readSceneState().error; },
        get lifecycle() { return readSceneState().lifecycle; },
        get playback() { return readPlayback(); },
      });
    }
    return state;
  }

  function retire(session, error = null, { preserveShell = false, flush = true } = {}) {
    if (active !== session) return;
    if (flush) session.viewUrl?.flush();
    // Detach and invalidate before any user cleanup or native wait can finish.
    active = null;
    scenePaused = true;
    sceneError = error;
    sceneState = error ? "error" : "destroyed";
    const cleanupErrors = session.lifetime.destroy();
    if (!preserveShell) {
      hasPresented = false;
      const owner = shellOwner; shellOwner = null;
      try { owner?.shell?.destroy(); } catch (error) { cleanupErrors.push(error); }
    }
    publishSceneState();
    for (const failure of cleanupErrors) report(failure);
  }

  function report(error) {
    try { reportError(error); } catch { /* Diagnostics cannot interrupt cleanup. */ }
  }
  function ensureWorldContext() {
    if (!worldContextOwner) return Promise.resolve(null);
    if (worldContextMount) return Promise.resolve(worldContextMount);
    if (!worldContextMountTask) {
      const controller = new AbortController();
      worldContextAbort = controller;
      worldContextMountTask = Promise.resolve(worldContextOwner.mount({
        stage, objectId, objects, documentTarget, windowTarget, signal: controller.signal,
      })).then(value => {
        if (controller.signal.aborted) {
          value?.destroy?.();
          throw controller.signal.reason ?? new DOMException('World context mount was cancelled.', 'AbortError');
        }
        if (!value || typeof value.publish !== 'function' || typeof value.destroy !== 'function') {
          throw new TypeError('Persistent world context mount must publish and destroy.');
        }
        worldContextMount = value;
        return value;
      }).catch(error => {
        if (worldContextAbort === controller) worldContextMountTask = null;
        throw error;
      }).finally(() => {
        if (worldContextAbort === controller) worldContextAbort = null;
      });
      worldContextMountTask.catch(() => {});
    }
    return worldContextMountTask;
  }
  function connectWorldContext(session, mount, mountedObjectId) {
    const owner = worldContextMount;
    const navigation = mount?.navigation;
    if (!owner || !navigation || typeof navigation.subscribe !== 'function') return;
    owner.selectObject?.(mountedObjectId, navigation.frame);
    owner.setOverview?.(overview);
    const disconnectFocus = owner.connectNavigation?.(navigation, {
      onFocusChange(url) { if (active === session) session.url = url; },
      onFocusContentChange(record, sources) { if (active === session) shellOwner?.shell?.setPreparedFocus?.(record, sources); },
      onFlightStart() {
        if (active !== session) return;
        motionEnabled = false; shellOwner?.shell?.setMotionEnabled?.(false); syncPlayback();
      },
    });
    if (disconnectFocus) session.lifetime.onDispose(disconnectFocus);
    const unsubscribe = navigation.subscribe((world, viewport) => {
      if (active === session && worldContextMount === owner) owner.publish(world, viewport);
    });
    session.lifetime.onDispose(unsubscribe);
  }
  function setOverview(enabled) {
    overview = enabled;
    active?.mount?.navigation?.setZoomOutCentering?.(enabled);
    shellOwner?.shell?.setOverview?.(enabled);
    worldContextMount?.setOverview?.(enabled);
    if (stage.dataset) stage.dataset.selection = enabled ? 'solar-system' : objectId;
  }
  function connectOverviewSelection(session) {
    const owner = session.mount?.navigation;
    const sun = solarSystemFocus(objects);
    if (!owner || !navigation || !sun?.worldFrame) return;
    session.lifetime.onDispose(watchOverviewSelection({ navigation: owner, objects, objectId,
      getOverview: () => overview,
      isAvailable: () => active === session && sceneState === 'ready' && !pending && !owner.preparedFocus?.(),
      windowTarget,
      onChange(next) {
        if (!next.overview) {
          // The overview already uses the Sun's camera and prepared detail.
          // Showing its card must not move the view or allocate another scene.
          setOverview(false);
          const url = new URL(windowTarget.location.href); url.searchParams.delete('overview');
          session.url = url.href;
          historyOwner?.commit(url.href, { history: 'replace' });
          return;
        }
        void navigate(sun.id, { overview: true, history: 'replace', preserveView: true });
      },
    }));
  }
  function destroyWorldContext() {
    worldContextAbort?.abort(new DOMException('World context router was destroyed.', 'AbortError'));
    worldContextAbort = null;
    const owner = worldContextMount;
    worldContextMount = null;
    worldContextMountTask = null;
    if (owner) {
      try { owner.destroy(); } catch (error) { report(error); }
    }
  }
  function fail(session, error) {
    if (active !== session) return;
    try { retire(session, error instanceof Error ? error : new Error(String(error))); }
    catch (failure) { report(failure); }
    report(error);
  }
  function destroyActiveScene() {
    destroyWorldContext();
    hasPresented = false;
    if (pending) { const request = pending; pending = null; request.controller.abort(); request.lifetime.destroy(); }
    if (active) {
      try { retire(active); } catch (error) { report(error); }
    } else if (shellOwner) {
      const owner = shellOwner; shellOwner = null;
      try { owner.shell?.destroy(); } catch (error) { report(error); }
      sceneState = 'destroyed'; publishSceneState();
    }
  }
  function restoreCachedScene(event) {
    if (event.persisted && !active && !destroyed) mountTask = mountApplication();
  }
}

function createWorldContextOwner({ objects, objectId, navigation, stage }) {
  if (!navigation || !objects.some(object => object.id === objectId && object.worldFrame)) return null;
  const create = applicationWorldContext.createApplicationWorldContext;
  if (typeof create !== 'function') return null;
  return create({ objects, objectId, stage });
}

if (typeof document !== "undefined") {
  const stage = document.querySelector(".planet-stage");
  if (!(stage instanceof HTMLElement)) throw new Error("Missing cssEarth planet stage.");
  const objectId = stage.dataset.objectId;
  const navigation = OBJECTS.find(object => object.id === objectId)?.worldFrame
    ? createPreparedWorldNavigation({ objects: OBJECTS }) : null;
  const persistentWorldContext = createWorldContextOwner({ objects: OBJECTS, objectId, navigation, stage });
  createSceneRouter({ stage, objectId, navigation, persistentWorldContext });
}
