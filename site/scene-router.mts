import type { SceneState } from './shell-contract-types.mts';
import type { SceneLifetime } from '@cssearth/engine';
import type { ObjectSceneLifecycle } from '../src/renderers/css/runtime/deferred-object-mount.js';
import type { BrowserWindow, SceneFactory } from './browser-types.mts';
import { errorMessage, record } from './browser-types.mts';
import type { ObjectEntry } from './object-schema.mts';
import type { NavigationOptions } from './navigation-history.mts';
import type { NavigationContent } from './planet-shell-client.mts';
import type { WorldHandoff } from './prepared-world-navigation.mts';
type Navigation = ReturnType<typeof createPreparedWorldNavigation>;
type Shell = ReturnType<typeof mountPlanetShell>;
type WorldContextOwner = ReturnType<typeof applicationWorldContext.createApplicationWorldContext>;
type WorldContextMount = Awaited<ReturnType<WorldContextOwner['mount']>>;
interface Request { id: string; cancelledFlight: boolean; controller: AbortController; lifetime: SceneLifetime; url: string; options: NavigationOptions; timing: ReturnType<typeof createNavigationTiming>; }
interface Session { framePresenter?: ReturnType<NonNullable<WorldContextMount['createFramePresenter']>>; generation: number; lifetime: SceneLifetime; mount: ObjectSceneLifecycle | null; shell: Shell | null; lastCommand: boolean | null; viewUrl: ReturnType<typeof bindViewUrl> | null; request?: Request; url?: string; }
interface RouterOptions { stage: HTMLElement; objectId: string; loadObject?(id: string): Promise<SceneFactory>; documentTarget?: Document; windowTarget?: BrowserWindow; mountShell?: typeof mountPlanetShell; reportError?(error: unknown): void; navigation?: Navigation | null; objects?: readonly ObjectEntry[]; loadContent?: ReturnType<typeof createNavigationContent>['load'] | null; persistentWorldContext?: WorldContextOwner | null; }
import { DIAGNOSTICS_ENABLED } from './diagnostics-policy.mts';
import { requireSceneLifecycle } from "./scene-contract.mts";
import { objectAdapter } from "./object-adapter.mts";
import { mountPlanetShell } from "./planet-shell-client.mts";
import { automaticPlaybackPolicy } from "./runtime-policy.mts";
import { createSceneLifetime } from "@cssearth/engine";
import { bindViewUrl } from "./view-url-runtime.mts";
import { OBJECTS } from './objects.mts';
import { createNavigationContent } from './navigation-content.mts';
import { createNavigationHistory, bindNavigationLinks } from './navigation-history.mts';
import { formatSharedView } from '../src/renderers/css/dist/navigation.js';
import { createPreparedWorldNavigation } from './prepared-world-navigation.mts';
import * as applicationWorldContext from './application-world-context.mts';
import { solarSystemFocus, watchOverviewSelection } from './overview-selection.mts';
import { overviewScopeFromUrl } from './navigation-scope.mts';
import { createNavigationTiming } from './navigation-timing.mts';
import { readDatasetUrl, withDataset } from './dataset-url.mts';


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
}: RouterOptions) {
  let active: Session | null = null;
  let mountTask: Promise<boolean | undefined> | null = null;
  let motionEnabled = false;
  let heliosphereEnabled = false;
  let highContrastSky = false;
  let asteroidOrbitsEnabled = false;
  let asteroidLabelsEnabled = false;
  let scenePaused = true;
  let sceneError: unknown = null;
  let sceneState: SceneState = "loading";
  let hasPresented = false;
  let destroyed = false;
  let nextGeneration = 0;
  let shellOwner: { shell: Shell | null } | null = null, pending: Request | null = null, historyOwner: ReturnType<typeof createNavigationHistory> | null = null, unbindLinks: (() => void) | null = null;
  let centeredObjectId: string | null = null;
  let overview = Boolean(overviewScopeFromUrl(windowTarget.location?.href ?? 'https://example.test'));
  const worldContextOwner = persistentWorldContext;
  let worldContextMount: WorldContextMount | null = null;
  let worldContextMountTask: Promise<WorldContextMount> | null = null;
  let worldContextAbort: AbortController | null = null;
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

  async function mountApplication({ factory, content, handoff, request }: { factory?: SceneFactory; content?: NavigationContent; handoff?: WorldHandoff; request?: Request } = {}): Promise<boolean | undefined> {
    if (destroyed || active) return;
    const session: Session = {
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
      const requestMotion = (next: boolean) => {
        if (active !== session || session.lifetime.disposed) return;
        motionEnabled = next === true;
        syncPlayback();
        session.viewUrl?.schedule();
      };
      if (!shellOwner) {
        const owner: { shell: Shell | null } = { shell: null };
        shellOwner = owner;
        owner.shell = mountShell({ objectId, documentTarget, windowTarget, motionEnabled, highContrastSky, heliosphereEnabled, asteroidOrbitsEnabled, asteroidLabelsEnabled,
          onMotionChange(next) { if (shellOwner === owner && active) {
            motionEnabled = next === true; syncPlayback(); active?.viewUrl?.schedule();
          } },
          onSkyContrastChange(next) { if (shellOwner === owner && active) {
            highContrastSky = next === true;
            worldContextMount?.setHighContrastSky?.(highContrastSky);
          } },
          onHeliosphereChange(next) { if (shellOwner === owner && active) {
            heliosphereEnabled = next === true;
            worldContextMount?.setHeliosphereEnabled?.(heliosphereEnabled);
          } },
          onAsteroidOrbitsChange(next) { if (shellOwner === owner && active) {
            asteroidOrbitsEnabled = next === true;
            worldContextMount?.setAsteroidOrbitsEnabled?.(asteroidOrbitsEnabled);
          } },
          onAsteroidLabelsChange(next) { if (shellOwner === owner && active) {
            asteroidLabelsEnabled = next === true;
            worldContextMount?.setAsteroidLabelsEnabled?.(asteroidLabelsEnabled);
          } },
        });
      }
      const shell = shellOwner.shell!;
      session.shell = shell;
      if (content) shell.setObject(content);
      shell.setOverview?.(request ? Boolean(overviewScopeFromUrl(request.url)) : overview);
      if (active !== session) return;
      publishSceneState();
      if (worldContextOwner) {
        const contextual = await session.lifetime.wait(ensureWorldContext());
        if (contextual.cancelled || active !== session) return;
      }
      const loaded = await session.lifetime.wait(factory ?? loadObject(objectId));
      if (loaded.cancelled || active !== session) return;
      // Keep the raw handle even if validation fails.
      let mount: ObjectSceneLifecycle;
      const framePresenter = worldContextMount?.createFramePresenter?.();
      session.framePresenter = framePresenter;
      if (framePresenter) session.lifetime.onDispose(() => framePresenter.destroy());
      mount = loaded.value(stage, {
        ...handoff?.mountOptions,
        deferTextureRefinement: true,
        ...(worldContextMount ? { externalWorldContext: true, viewport: worldContextMount.viewport } : {}),
        ...(framePresenter ? { framePresenter } : {}),
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
      const initialScope = !request && session.url && overviewScopeFromUrl(session.url);
      if (initialScope && session.url && !new URL(session.url).searchParams.has('v')) {
        const target = navigation?.overviewTarget?.({ scope: initialScope, objectId, fromId: objectId, mount });
        if (target) {
          const controller = new AbortController();
          session.lifetime.onDispose(() => controller.abort());
          const framed = await session.lifetime.wait(navigation!.focus({ objectId, mount,
            signal: controller.signal, reducedMotion: true,
            targetWorldCamera: target.world, targetFocusPositionM: target.focusPositionM }));
          if (framed.cancelled || active !== session) return;
        }
      }
      let interrupted = false;
      if (handoff?.afterMount) {
        if (!request) throw new Error('A world handoff requires its navigation request.');
        try {
          const completed = await session.lifetime.wait(handoff.afterMount(mount, { signal: request.controller.signal }));
          if (completed.cancelled || active !== session || request.controller.signal.aborted) return;
        } catch (error) {
          if ((!record(error) && !(error instanceof Error)) || error.name !== 'AbortError' || !('preserveView' in error) || error.preserveView !== true || active !== session ||
              session.lifetime.disposed || request.controller.signal.aborted) throw error;
          // The detailed destination already owns the camera. Real input ends
          // its flight without retiring that scene or restoring the endpoint.
          interrupted = true;
          const drawnUrl = captureUrl();
          if (drawnUrl) request.url = session.url = new URL(drawnUrl, windowTarget.location.href).href;
        }
      }
      const datasetController = request?.controller ?? new AbortController();
      session.lifetime.onDispose(() => datasetController.abort());
      try {
        const selected = await selectDataset(session, session.url!, datasetController.signal);
        if (active !== session || datasetController.signal.aborted) return false;
        if (!selected) throw new Error('Dataset selection was superseded.');
      } catch (error) {
        if (active !== session || datasetController.signal.aborted) return false;
        shell.setDatasetNotice?.(`${errorMessage(error)} Showing the default dataset.`);
        // A direct invalid link stays visible for diagnosis. A completed body
        // navigation publishes the destination's actual default selection.
        if (request) {
          const datasets = mount.datasets, current = datasets?.current();
          request.url = session.url = withDataset(new URL(request.url), current && current !== datasets?.defaultId ? current : null).href;
        }
      }
      if (request) historyOwner?.commit(request.url, request.options);
      if (mount.sharedView && windowTarget.location?.href) {
        session.viewUrl = bindViewUrl({ windowTarget, view: mount.sharedView,
          getMotion: () => motionEnabled,
          setMotion(next) { shell.setMotionEnabled?.(next); requestMotion(next); },
          onError(error) { console.warn(errorMessage(error)); },
          listenToPopState: !navigation,
        });
        const viewOwner = session.viewUrl;
        session.lifetime.onDispose(() => viewOwner.destroy());
        if (!interrupted) await session.lifetime.wait(session.viewUrl.restore());
        if (active !== session || session.lifetime.disposed) return;
      }
      // Restore the incoming camera before admitting optional texture detail.
      // This also keeps refinements out of the flight's critical path.
      mount.refineTextures?.();
      if (mount.destinations) shell.setDestinations?.({
        ...mount.destinations,
        async select(place) {
          shell.setMotionEnabled?.(false);
          return mount.destinations!.select(place);
        },
      });
      shell.setCamera?.(mount);
      session.lifetime.onDispose(() => shell.setCamera?.(null));
      sceneState = "ready";
      if (mount.datasets) session.lifetime.onDispose(mount.datasets.subscribe(() => {
        if (active !== session || pending || sceneState !== 'ready') return;
        syncDatasetUrl(session);
      }));
      hasPresented = true;
      if (pending === request) pending = null;
      setOverview(Boolean(overviewScopeFromUrl(session.url ?? windowTarget.location?.href ?? 'https://example.test')));
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
    if (saved) url.searchParams.set('v', new URLSearchParams(formatSharedView(saved)).get('v')!);
    return url.pathname + url.search + url.hash;
  }

  function syncDatasetUrl(session: Session) {
    const datasets = session.mount?.datasets;
    if (!datasets || !session.url || active !== session) return;
    const id = datasets.current();
    if (id === null) return;
    const url = withDataset(new URL(captureUrl() ?? session.url, windowTarget.location.href), id === datasets.defaultId ? null : id);
    session.url = url.href;
    historyOwner?.commit(url.href, { history: 'replace' });
    session.shell?.setDatasetNotice?.(null);
  }

  function selectDataset(session: Session, href: string, signal: AbortSignal): boolean | Promise<boolean> {
    const { id, requested } = readDatasetUrl(new URL(href));
    const datasets = session.mount?.datasets;
    if (requested && (!datasets || !datasets.ids.includes(id!))) throw new RangeError(`Dataset “${id}” is unavailable on this object.`);
    if (!datasets) return true;
    const selected = id ?? datasets.defaultId;
    const finish = (committed: boolean) => {
      if (!committed || signal.aborted) return false;
      session.shell?.setDatasetNotice?.(null);
      if (requested) session.shell?.showDataset?.();
      return true;
    };
    // Selecting the committed default also cancels an older, still decoding
    // manual choice. Reading current() alone cannot establish that no work is pending.
    return datasets.select(selected, { signal }).then(finish);
  }

  function navigate(id: string, options: NavigationOptions = {}): Promise<boolean | undefined> {
    if (destroyed || !navigation || !navigation.supports(objectId, id)) return Promise.resolve(false);
    const object = objects.find(object => object.id === id);
    if (!object) return Promise.resolve(false);
    // The Solar System overview is already the system-level selection for its
    // central body. Clicking that body drills in instead of fitting it again.
    const opensOverviewFocus = overview && id === objectId && id === solarSystemFocus(objects)?.id
      && overviewScopeFromUrl(active?.url ?? windowTarget.location.href) === 'solar-system';
    const overviewTarget = options.overviewScope
      ? navigation.overviewTarget?.({ scope: options.overviewScope, objectId: id, fromId: objectId, mount: active?.mount }) : null;
    const centerTarget = overviewTarget?.world ?? (options.recenter
      ? navigation.centerTarget?.({ objectId: id, fromId: objectId, mount: active?.mount, force: true })
      : options.sceneSelection && !opensOverviewFocus && id !== centeredObjectId && hasPresented
        ? (navigation.systemTarget?.({ objectId: id, fromId: objectId, mount: active?.mount })
          ?? navigation.centerTarget?.({ objectId: id, fromId: objectId, mount: active?.mount })) : null);
    // First selection frames the object's system; a repeat opens its close-up.
    centeredObjectId = centerTarget && !options.overview ? id : null;
    if (centerTarget) options = { ...options, targetWorldCamera: centerTarget,
      targetFocusPositionM: overviewTarget?.focusPositionM, centerSelection: true };
    if (centerTarget && options.sceneSelection && id === solarSystemFocus(objects)?.id) {
      options = { ...options, overview: true };
    }
    const cancelledFlight = pending !== null && !pending.options.centerSelection && !options.centerSelection;
    if (pending) {
      const previous = pending;
      pending = null; previous.controller.abort(); previous.lifetime.destroy();
      if (active?.request === previous && sceneState !== 'ready') retire(active, null, { preserveShell: true, flush: false });
    }
    const mode = options.history ?? 'push';
    if (mode === 'pop') historyOwner?.remember();
    else historyOwner?.checkpoint();
    active?.viewUrl?.destroy();
    if (active) active.viewUrl = null;
    let url = new URL(options.url ?? windowTarget.location?.href ?? object.route, windowTarget.location?.href);
    if (!options.url) {
      url.pathname = object.route; url.searchParams.delete('v'); url.searchParams.delete('overview');
      url = withDataset(url, null);
      if (options.overview) url.searchParams.set('overview', options.overviewScope ?? 'solar-system');
    }
    const request: Request = { id, cancelledFlight, controller: new AbortController(), lifetime: createSceneLifetime(),
      url: url.href, options: { ...options, history: mode }, timing: createNavigationTiming(windowTarget, objectId, id) };
    request.controller.signal.addEventListener('abort', () => request.timing.mark('cancelled'), { once: true });
    pending = request;
    worldContextMount?.previewSelection?.(options.overview ? null : id);
    request.lifetime.onDispose(() => {
      if (!pending || pending === request) worldContextMount?.previewSelection?.();
    });
    if ((options.recenter || options.centerSelection) && options.overview) {
      const restoreSelection = shellOwner?.shell?.beginOverviewSelection?.(options.overviewScope ?? 'solar-system');
      if (restoreSelection) request.lifetime.onDispose(restoreSelection);
    } else if (!options.overview) {
      const releaseCard = shellOwner?.shell?.beginCardNavigation?.(object, options.targetWorldCamera);
      const restoreSelection = shellOwner?.shell?.beginObjectSelection?.(object);
      if (restoreSelection) request.lifetime.onDispose(restoreSelection);
      if (releaseCard) request.lifetime.onDispose(releaseCard);
    }
    mountTask = transition(request, object);
    return mountTask;
  }

  async function transition(request: Request, object: ObjectEntry): Promise<boolean | undefined> {
    if (!navigation) return false;
    const source = active;
    try {
      if (source && objectId === object.id && sceneState === 'ready') {
        const datasetLink = Boolean(request.options.url) && new URL(request.url).hash.split('&').some(field => /^#?dataset=/.test(field));
        const datasetSelection = selectDataset(source, request.url, request.controller.signal);
        if (!(typeof datasetSelection === 'boolean' ? datasetSelection : await datasetSelection)) {
          if (pending !== request) return false;
          pending = null; request.lifetime.destroy();
          syncDatasetUrl(source);
          await bindSessionView(source, { restore: false }); syncPlayback();
          return false;
        }
        if (pending !== request) return false;
        const restore = request.options.history === 'pop' ||
          (Boolean(request.options.url) && new URL(request.url).searchParams.has('v'));
        if (restore) {
          if (request.options.history === 'pop' || request.url !== windowTarget.location.href) historyOwner?.commit(request.url, request.options);
          source.url = request.url;
        } else if (!datasetLink && !request.cancelledFlight && !request.options.preserveView && navigation.focus) {
          syncPlayback();
          const focused = await request.lifetime.wait(navigation.focus({ objectId: object.id,
            mount: source.mount!, signal: request.controller.signal, reducedMotion: reducedMotionActive,
            targetWorldCamera: request.options.targetWorldCamera, targetFocusPositionM: request.options.targetFocusPositionM, centerSelection: request.options.centerSelection, timing: request.timing }));
          if (focused.cancelled || pending !== request) return false;
        }
        if (!restore) {
          source.url = request.url;
          const changesSelection = overview !== Boolean(overviewScopeFromUrl(request.url)) ||
            overviewScopeFromUrl(windowTarget.location.href) !== overviewScopeFromUrl(request.url);
          historyOwner?.commit(request.url, { ...request.options,
            history: changesSelection || datasetLink ? request.options.history : 'replace' });
        }
        setOverview(Boolean(overviewScopeFromUrl(request.url)));
        await bindSessionView(source, { restore });
        if (pending !== request) return false;
        pending = null; request.lifetime.destroy(); syncPlayback();
        if (!restore) source.viewUrl?.flush();
        request.timing.mark('finished');
        return true;
      }
      syncPlayback();
      const contentTask = (loadContent ?? contentTransport!.load)(object, { signal: request.controller.signal })
        .then(content => {
          request.lifetime.onDispose(() => content.dispose?.());
          request.timing.mark('content-ready'); return content;
        });
      const factoryTask = loadObject(object.id).then(factory => { request.timing.mark('factory-ready'); return factory; });
      // The registry already owns the physical frames. Start the camera while
      // the destination factory, content and texture bank load independently.
      const preparationTask = navigation.prepare({
        fromId: objectId, toId: object.id, fromMount: source?.mount ?? null, toFactory: factoryTask,
        signal: request.controller.signal, url: request.url,
        reducedMotion: reducedMotionActive,
        targetWorldCamera: request.options.targetWorldCamera,
        targetFocusPositionM: request.options.targetFocusPositionM,
        centerSelection: request.options.centerSelection,
        preserveView: request.options.preserveView,
        cameraViewport: worldContextMount?.viewport,
        timing: request.timing,
        presentWorld: worldContextMount ? (world, viewport) => worldContextMount?.publish(world, viewport) : null,
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
      request.timing.mark(error instanceof Error && error.name === 'AbortError' ? 'cancelled' : 'failed');
      if (pending !== request || request.controller.signal.aborted) return false;
      pending = null; request.controller.abort(); request.lifetime.destroy();
      centeredObjectId = null;
      worldContextMount?.setNavigationInFlight?.(false);
      if (active === source && source) {
        source.shell?.setDatasetNotice?.(errorMessage(error));
        // The source still owns the last drawn camera when destination loading
        // fails. Rebinding its URL writer must not replay the departure pose.
        const url = captureUrl();
        if (url) historyOwner?.commit(url, { history: 'replace' });
        await bindSessionView(source, { restore: false });
        source.viewUrl?.flush(); syncPlayback();
        if (!record(error) || error.preserveView !== true) report(error);
      }
      else if (active) fail(active, error);
      else report(error);
      return false;
    }
  }

  async function bindSessionView(session: Session, { restore = true } = {}) {
    if (active !== session || !session.mount?.sharedView || !windowTarget.location?.href || !session.url) return;
    // A failed history restoration keeps its incoming URL for diagnosis, like
    // Galaxio's invalid-route state. The old scene must not write into it.
    if (new URL(session.url).pathname !== windowTarget.location.pathname) return;
    const owner = bindViewUrl({ windowTarget, view: session.mount.sharedView, listenToPopState: !navigation,
      getMotion: () => motionEnabled,
      setMotion(next) { session.shell?.setMotionEnabled?.(next); motionEnabled = next === true; syncPlayback(); },
      onError: report,
    });
    session.viewUrl = owner;
    session.lifetime.onDispose(() => owner.destroy());
    if (restore) await session.lifetime.wait(owner.restore());
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
    const selected = pending ? !overviewScopeFromUrl(pending.url) : !overview;
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
    worldContextMount?.setNavigationInFlight?.(Boolean(pending && pending.options.preserveView !== true));
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
    if (DIAGNOSTICS_ENABLED) {
      Reflect.set(windowTarget, '__cssEarth', Object.freeze({
        activeObjectId: objectId,
        get selectedObjectId() { return readSceneState().selectedObjectId; },
        get overview() { return readSceneState().overview; },
        get mountedObjectCount() { return readSceneState().mountedObjectCount; },
        get ready() { return readSceneState().ready; },
        get error() { return readSceneState().error; },
        get lifecycle() { return readSceneState().lifecycle; },
        get playback() { return readPlayback(); },
      }));
    }
    return state;
  }

  function retire(session: Session, error: unknown = null, { preserveShell = false, flush = true } = {}) {
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

  function report(error: unknown) {
    try { reportError(error); } catch { /* Diagnostics cannot interrupt cleanup. */ }
  }
  function ensureWorldContext() {
    if (!worldContextOwner) return Promise.resolve(null);
    if (worldContextMount) return Promise.resolve(worldContextMount);
    if (!worldContextMountTask) {
      const controller = new AbortController();
      worldContextAbort = controller;
      worldContextMountTask = Promise.resolve(worldContextOwner.mount({
        stage, signal: controller.signal,
      })).then(value => {
        if (controller.signal.aborted) {
          value?.destroy?.();
          throw controller.signal.reason ?? new DOMException('World context mount was cancelled.', 'AbortError');
        }
        if (!value || typeof value.publish !== 'function' || typeof value.destroy !== 'function') {
          throw new TypeError('Persistent world context mount must publish and destroy.');
        }
        worldContextMount = value;
        value.setHighContrastSky?.(highContrastSky);
        value.setHeliosphereEnabled?.(heliosphereEnabled);
        value.setAsteroidOrbitsEnabled?.(asteroidOrbitsEnabled);
        value.setAsteroidLabelsEnabled?.(asteroidLabelsEnabled);
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
  function connectWorldContext(session: Session, mount: ObjectSceneLifecycle, mountedObjectId: string) {
    const owner = worldContextMount;
    const navigation = mount?.navigation;
    if (!owner || !navigation || typeof navigation.subscribe !== 'function') return;
    owner.selectObject?.(mountedObjectId, navigation.frame);
    owner.setOverview?.(overview);
    const unsubscribe = navigation.subscribe((world, viewport) => {
      if (active === session && worldContextMount === owner) owner.publish(world, viewport);
    });
    session.lifetime.onDispose(unsubscribe);
    session.framePresenter?.enable();
  }
  function setOverview(enabled: boolean) {
    overview = enabled;
    active?.mount?.navigation?.setZoomOutCentering?.(enabled);
    shellOwner?.shell?.setOverview?.(enabled);
    worldContextMount?.setOverview?.(enabled);
    if (stage.dataset) stage.dataset.selection = enabled ? 'solar-system' : objectId;
  }
  function connectOverviewSelection(session: Session) {
    const owner = session.mount?.navigation;
    const sun = solarSystemFocus(objects);
    if (!owner || !navigation || !sun?.worldFrame) return;
    session.lifetime.onDispose(watchOverviewSelection({ navigation: owner, objects, objectId,
      getOverview: () => overview,
      // The pending flight owns the camera; repeat-click bookkeeping must not
      // suppress zoom-out deselection after that flight has finished.
      isAvailable: () => active === session && sceneState === 'ready' && !pending,
      windowTarget,
      onChange(next) {
        if (!next.overview || next.objectId === objectId) {
          // The mounted Sun and its overview share the same camera, detail and
          // subscriptions. Change their selection in place in either direction.
          setOverview(next.overview);
          const url = withDataset(new URL(windowTarget.location.href), null);
          if (next.overview) url.searchParams.set('overview', 'solar-system');
          else url.searchParams.delete('overview');
          session.url = url.href;
          historyOwner?.commit(url.href, { history: 'replace' });
          session.viewUrl?.flush();
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
  function fail(session: Session, error: unknown) {
    if (active !== session) return;
    try { retire(session, error instanceof Error ? error : new Error(String(error))); }
    catch (failure) { report(failure); }
    report(error);
  }
  function destroyActiveScene() {
    centeredObjectId = null;
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
  function restoreCachedScene(event: PageTransitionEvent) {
    if (event.persisted && !active && !destroyed) mountTask = mountApplication();
  }
}

function createWorldContextOwner({ objects, objectId, navigation }: { objects: readonly ObjectEntry[]; objectId: string; navigation: Navigation | null; stage: HTMLElement }) {
  if (!navigation || !objects.some(object => object.id === objectId && object.worldFrame)) return null;
  const create = applicationWorldContext.createApplicationWorldContext;
  if (typeof create !== 'function') return null;
  return create();
}

if (typeof document !== "undefined") {
  const stage = document.querySelector(".planet-stage");
  if (!(stage instanceof HTMLElement)) throw new Error("Missing cssEarth planet stage.");
  const objectId = stage.dataset.objectId;
  if (!objectId) throw new Error("Missing cssEarth object identity.");
  const navigation = OBJECTS.find(object => object.id === objectId)?.worldFrame
    ? createPreparedWorldNavigation({ objects: OBJECTS }) : null;
  const persistentWorldContext = createWorldContextOwner({ objects: OBJECTS, objectId, navigation, stage });
  createSceneRouter({ stage, objectId, navigation, persistentWorldContext });
}
