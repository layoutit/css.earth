import type { SceneState } from './shell-contract-types.mts';
import type { ObjectSceneLifecycle } from '../src/renderers/css/runtime/deferred-object-mount.js';
import type { BrowserWindow, SceneFactory } from './browser-types.mts';
import { errorMessage, record } from './browser-types.mts';
import type { ObjectEntry } from './object-schema.mts';
import type { ObjectDescriptor } from '@cssearth/objects';
import type { NavigationOptions } from './navigation-history.mts';
import type { NavigationContent, ShellNavigationTransition } from './object-shell-client.mts';
import type { WorldHandoff } from './prepared-world-navigation.mts';
type Navigation = ReturnType<typeof createPreparedWorldNavigation>;
type Shell = ReturnType<typeof mountObjectShell>;
export type WorldContextOwner = ReturnType<typeof applicationWorldContext.createApplicationWorldContext>;
export type WorldContextMount = Awaited<ReturnType<WorldContextOwner['mount']>>;
export interface RouterOptions { stage: HTMLElement; objectId: string; loadObject?(id: string, descriptor?: ObjectDescriptor): Promise<SceneFactory>; documentTarget?: Document; windowTarget?: BrowserWindow; mountShell?: typeof mountObjectShell; reportError?(error: unknown): void; navigation?: Navigation | null; objects?: readonly ObjectEntry[]; loadContent?: ReturnType<typeof createNavigationContent>['load'] | null; persistentWorldContext?: WorldContextOwner | null; }
import { readObjectDiagnostics } from '../src/renderers/css/dist/index.js';
import { DIAGNOSTICS_ENABLED } from './diagnostics-policy.mts';
import { objectAdapter } from "./object-adapter.mts";
import { mountObjectShell } from "./object-shell-client.mts";
import { automaticPlaybackPolicy } from "./runtime-policy.mts";
import { bindViewUrl } from "./view-url-runtime.mts";
import { SCENE_OBJECTS } from './objects.mts';
import { createNavigationContent } from './navigation-content.mts';
import { createNavigationHistory, bindNavigationLinks } from './navigation-history.mts';
import { formatSharedView } from '../src/renderers/css/dist/navigation.js';
import { createPreparedWorldNavigation } from './prepared-world-navigation.mts';
import * as applicationWorldContext from './application-world-context.mts';
import { watchOverviewSelection } from './overview-selection.mts';
import { systemById } from './object-systems.mts';
import { SYSTEM_CENTERS } from './system-framing.mts';
import { overviewScopeFromUrl, preparedFocusFromUrl, withOverviewScope, withPreparedFocus } from './navigation-scope.mts';
import { createNavigationTiming } from './navigation-timing.mts';
import { isFocusDatasetUrl, readDatasetUrl, withDataset } from './dataset-url.mts';
import { retainInitialScene } from './initial-scene.mts';
import { createNavigationLifecycle, type NavigationRequest } from './navigation-lifecycle.mts';
import { createWorldPreferences } from './world-preferences.mts';
import { createSceneSessions, type SceneSession as Session } from './scene-session.mts';
import { readPreparedDescriptor } from './prepared-descriptor.mts';


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
  const preferences = createWorldPreferences(documentTarget);
  let hasPresented = false;
  const initialScene = retainInitialScene(stage);
  let destroyed = false;
  let shellOwner: { shell: Shell | null } | null = null, historyOwner: ReturnType<typeof createNavigationHistory> | null = null, unbindLinks: (() => void) | null = null;
  let publishedBodyState = '';
  let centeredObjectId: string | null = null;
  let overview = Boolean(overviewScopeFromUrl(windowTarget.location?.href ?? 'https://example.test'));
  const worldContextOwner = persistentWorldContext;
  let worldContextMount: WorldContextMount | null = null;
  let worldContextMountTask: Promise<WorldContextMount> | null = null;
  let worldContextAbort: AbortController | null = null;
  const contentTransport = navigation && !loadContent ? createNavigationContent({ documentTarget, windowTarget }) : null;
  const reducedMotion = windowTarget.matchMedia?.("(prefers-reduced-motion: reduce)");
  let reducedMotionActive = false;
  const requests = createNavigationLifecycle({ onError: report, onCancel(request) {
    if (scenes.current?.request === request && scenes.state.kind !== 'ready') retire(scenes.current, null, { preserveShell: true, flush: false });
  } });

  // These survive scene teardown so a persisted document can restore itself.
  windowTarget.addEventListener("pagehide", destroyActiveScene);
  windowTarget.addEventListener("pageshow", restoreCachedScene);
  if (navigation && windowTarget.location?.href) {
    // Only a settled scene belongs to the entry that history names. An unfinished navigation
    // has not committed its own entry, so snapshotting its scene would overwrite the entry it left.
    historyOwner = createNavigationHistory({ windowTarget, objects, capture: () => requests.current ? null : captureUrl(), navigate, navigating: () => requests.current !== null, embedded: 'embed' in documentTarget.documentElement.dataset, onError: report });
    unbindLinks = bindNavigationLinks({ documentTarget, windowTarget, objects,
      // During a body flight a focus link is an ordinary navigation, so the last click wins.
      selectPreparedFocus: id => requests.current ? null : worldContextMount?.selectPreparedFocus?.(id) ?? null,
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
      publishSceneState();
      const requestMotion = (next: boolean) => {
        if (!scenes.isCurrent(session)) return;
        motionEnabled = next === true;
        syncPlayback();
        session.viewUrl?.schedule();
      };
      if (!shellOwner) {
        const owner: { shell: Shell | null } = { shell: null };
        shellOwner = owner;
        owner.shell = mountShell({ objectId, documentTarget, windowTarget, motionEnabled,
          ...preferences.bind(() => shellOwner === owner && scenes.current !== null, () => worldContextMount),
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
      publishSceneState();
      if (worldContextOwner) {
        const contextual = await session.wait(ensureWorldContext());
        if (contextual.cancelled || !scenes.isCurrent(session)) return;
      }
      const framePresenter = worldContextMount?.createFramePresenter?.();
      session.framePresenter = framePresenter;
      if (framePresenter) session.own(() => framePresenter.destroy());
      if (!await session.activate(factory ?? loadObject(objectId, readPreparedDescriptor(documentTarget, objectId)), stage, {
        deferTextureRefinement: true,
        ...(worldContextMount ? { viewport: worldContextMount.viewport } : {}),
        ...(framePresenter ? { framePresenter } : {}),
        onMotionRequest: requestMotion,
      }, handoff)) return false;
      const mount = session.mount;
      if (!mount) return false;
      connectWorldContext(session, mount, objectId);
      const initialScope = !request && session.url && overviewScopeFromUrl(session.url);
      if (initialScope && session.url && !new URL(session.url).searchParams.has('v')) {
        const target = navigation?.overviewTarget?.({ scope: initialScope, objectId, fromId: objectId, mount });
        if (target) {
          const framed = await session.wait(navigation!.focus({ objectId, mount,
            signal: session.signal, reducedMotion: true,
            targetWorldCamera: target.world, targetFocusPositionM: target.focusPositionM }));
          if (framed.cancelled || !scenes.isCurrent(session)) return;
        }
      }
      let interrupted = false;
      if (handoff?.afterMount) {
        if (!request) throw new Error('A world handoff requires its navigation request.');
        try {
          const completed = await session.wait(handoff.afterMount(mount, { signal: session.signal }));
          if (completed.cancelled || !scenes.isCurrent(session) || request.signal.aborted) return;
        } catch (error) {
          if ((!record(error) && !(error instanceof Error)) || error.name !== 'AbortError' || !('preserveView' in error) || error.preserveView !== true || !scenes.isCurrent(session) ||
              request.signal.aborted) throw error;
          // The detailed destination already owns the camera. Real input ends
          // its flight without retiring that scene or restoring the endpoint.
          interrupted = true;
          const drawnUrl = captureUrl();
          if (drawnUrl) request.url = session.url = new URL(drawnUrl, windowTarget.location.href).href;
        }
      }
      const datasetSignal = request ? AbortSignal.any([request.signal, session.signal]) : session.signal;
      try {
        const selected = session.url ? await selectDataset(session, session.url, datasetSignal, { initial: true }) : true;
        if (!scenes.isCurrent(session) || datasetSignal.aborted) return false;
        if (!selected) throw new Error('Dataset selection was superseded.');
      } catch (error) {
        if (!scenes.isCurrent(session) || datasetSignal.aborted) return false;
        shell.setDatasetNotice?.(`${errorMessage(error)} Showing the default dataset.`);
        // A direct invalid link stays visible for diagnosis. A completed body
        // navigation publishes the destination's actual default selection.
        if (request) {
          const datasets = mount.datasets, current = datasets?.current();
          request.url = session.url = withDataset(new URL(request.url), current && current !== datasets?.defaultId ? current : null).href;
        }
      }
      if (request) {
        if (!requests.advance(request, 'committing') || !commitNavigation(request, session)) return false;
      }
      if (mount.sharedView && windowTarget.location?.href) {
        session.setViewUrl(bindViewUrl({ windowTarget, view: mount.sharedView,
          getMotion: () => motionEnabled,
          setMotion(next) { shell.setMotionEnabled?.(next); requestMotion(next); },
          onError(error) { console.warn(errorMessage(error)); },
          listenToPopState: !navigation,
        }));
        if (!interrupted) await session.wait(session.viewUrl!.restore());
        if (!scenes.isCurrent(session)) return;
      }
      worldContextMount?.restoreFocus?.(session.url ?? windowTarget.location.href);
      // Restore the incoming camera before arming optional texture detail. An
      // untouched page keeps its prepared coarse surface; the first real input
      // admits the 2048 refinement outside the cold-load critical path.
      if (mount.refineTextures) {
        const releaseRefinement = () => {
          removeRefinementListeners();
          if (scenes.isCurrent(session)) mount.refineTextures?.();
        };
        const removeRefinementListeners = () => {
          windowTarget.removeEventListener('pointerdown', releaseRefinement);
          windowTarget.removeEventListener('wheel', releaseRefinement);
          windowTarget.removeEventListener('keydown', releaseRefinement);
        };
        windowTarget.addEventListener('pointerdown', releaseRefinement, { once: true });
        windowTarget.addEventListener('wheel', releaseRefinement, { once: true, passive: true });
        windowTarget.addEventListener('keydown', releaseRefinement, { once: true });
        session.own(removeRefinementListeners);
      }
      if (mount.destinations) shell.setDestinations?.({
        ...mount.destinations,
        async select(place) {
          shell.setMotionEnabled?.(false);
          return mount.destinations!.select(place);
        },
      });
      shell.setFeatures?.(mount.features ?? null);
      shell.setCamera?.(mount);
      session.own(() => { shell.setCamera?.(null); shell.setFeatures?.(null); });
      // A feature named in the URL is a one-time selection: fly there, then let the view URL take over.
      const featureUrl = new URL(session.url ?? windowTarget.location?.href ?? 'https://example.test');
      const featureId = featureUrl.searchParams.get('feature');
      if (featureId !== null) {
        featureUrl.searchParams.delete('feature');
        session.url = featureUrl.href;
        const place = /^city-([0-9]+)$/u.exec(featureId);
        if (place && mount.destinations) { shell.setMotionEnabled?.(false); session.wait(shell.selectPlace?.(place[1]!) ?? Promise.resolve()).catch(error => { if (scenes.isCurrent(session)) report(error); }); }
        else if (mount.features && /^[0-9]+$/u.test(featureId)) { shell.setMotionEnabled?.(false); session.wait(mount.features.select(featureId)).catch(error => { if (scenes.isCurrent(session)) report(error); }); }
      }
      if (!session.commit()) return false;
      if (mount.datasets) {
        syncCompanionClouds(mount.datasets);
        session.own(mount.datasets.subscribe(() => {
          if (!scenes.isCurrent(session) || requests.current || scenes.state.kind !== 'ready') return;
          syncCompanionClouds(mount.datasets!);
          syncDatasetUrl(session);
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

  function captureUrl() {
    if (!windowTarget.location?.href) return null;
    const url = new URL(scenes.current?.url ?? windowTarget.location.href);
    const saved = scenes.current?.mount?.sharedView?.capture(motionEnabled);
    if (saved) url.searchParams.set('v', new URLSearchParams(formatSharedView(saved)).get('v')!);
    return url.pathname + url.search + url.hash;
  }

  /** A dataset of this body may ask for a cloud that accompanies it. Only the selected one is drawn. */
  function syncCompanionClouds(datasets: NonNullable<ObjectSceneLifecycle['datasets']>) {
    if (!datasets.volumes.length) return;
    const selected = datasets.volumeOf(datasets.current() ?? datasets.defaultId);
    // One bank carries every cloud of its object and draws one lens at a time, so each bank is
    // answered once: the selected dataset names the lens, and a bank no dataset asks for stays dark.
    for (const objectId of new Set(datasets.volumes.map(volume => volume.objectId))) {
      const enabled = selected?.objectId === objectId;
      if (enabled) worldContextMount?.selectVolumeLens?.(objectId, selected!.lensId);
      worldContextMount?.setVolumeLensEnabled?.(objectId, enabled);
    }
  }

  function syncDatasetUrl(session: Session) {
    const datasets = session.mount?.datasets;
    if (!datasets || !session.url || !scenes.isCurrent(session)) return;
    const id = datasets.current();
    if (id === null) return;
    const url = withDataset(new URL(captureUrl() ?? session.url, windowTarget.location.href), id === datasets.defaultId ? null : id);
    session.url = url.href;
    historyOwner?.commit(url.href, { history: 'replace' });
    session.shell?.setDatasetNotice?.(null);
  }

  function selectDataset(session: Session, href: string, signal: AbortSignal, { initial = false } = {}): boolean | Promise<boolean> {
    const { id, requested } = readDatasetUrl(new URL(href));
    const datasets = session.mount?.datasets;
    if (requested && (!datasets || !datasets.ids.includes(id!))) throw new RangeError(`Dataset “${id}” is unavailable on this object.`);
    if (!datasets || initial && !requested) return true;
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
    worldContextMount?.suspendFocus?.();
    scenes.current?.setViewUrl(null);
    let url = new URL(options.url ?? windowTarget.location?.href ?? object.route, windowTarget.location?.href);
    if (!options.url) {
      url.pathname = object.route; url.searchParams.delete('v');
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
      worldContextMount?.previewSelection?.(options.overview ? null : object.id);
      request.own(() => {
        if (!requests.current || requests.owns(request)) worldContextMount?.previewSelection?.();
      });
      const selectionTransition = shellOwner?.shell?.beginNavigation?.(options.overview
        ? { kind: 'overview', overview: { scope: options.overviewScope ?? 'system', systemId: object.id },
          preview: Boolean(options.recenter || options.centerSelection) }
        : { kind: 'object', object, targetWorldCamera: options.targetWorldCamera });
      if (selectionTransition) request.own(() => selectionTransition.dispose());
      if (source && objectId === object.id && scenes.state.kind === 'ready') {
        const destination = new URL(request.url);
        const datasetLink = Boolean(request.options.url) &&
          (readDatasetUrl(destination).requested || isFocusDatasetUrl(destination));
        const datasetSelection = selectDataset(source, request.url, request.signal);
        if (!(typeof datasetSelection === 'boolean' ? datasetSelection : await datasetSelection)) {
          if (!requests.owns(request)) return false;
          requests.finish(request, 'cancelled');
          syncDatasetUrl(source);
          await bindSessionView(source, { restore: false }); syncPlayback();
          return false;
        }
        if (!requests.owns(request)) return false;
        const restore = request.options.history === 'pop' ||
          (Boolean(request.options.url) && new URL(request.url).searchParams.has('v'));
        if (restore) {
          if (request.options.history === 'pop' || request.url !== windowTarget.location.href) commitNavigation(request, source);
          else source.url = request.url;
          // History within one object flies to its saved view, as history between objects does;
          // it used to jump there in one frame. The exact saved state is still restored afterwards.
          const savedWorld = request.options.history === 'pop' && !reducedMotionActive
            ? navigation.savedTarget?.({ objectId: object.id, url: request.url, mount: source.mount }) : null;
          if (savedWorld && navigation.focus) {
            requests.advance(request, 'flying');
            syncPlayback();
            const flown = await request.lifetime.wait(navigation.focus({ objectId: object.id, mount: source.mount!,
              signal: request.signal, reducedMotion: reducedMotionActive, targetWorldCamera: savedWorld, timing: request.timing }));
            if (flown.cancelled || !requests.owns(request)) return false;
          }
        } else if (!datasetLink && !request.cancelledFlight && !request.options.preserveView && navigation.focus) {
          requests.advance(request, 'flying');
          syncPlayback();
          const focused = await request.lifetime.wait(navigation.focus({ objectId: object.id,
            mount: source.mount!, signal: request.signal, reducedMotion: reducedMotionActive,
            targetWorldCamera: request.options.targetWorldCamera, targetFocusPositionM: request.options.targetFocusPositionM, centerSelection: request.options.centerSelection, timing: request.timing }));
          if (focused.cancelled || !requests.owns(request)) return false;
        }
        if (!requests.advance(request, 'committing')) return false;
        if (!restore) {
          const changesSelection = overview !== Boolean(overviewScopeFromUrl(request.url)) ||
            overviewScopeFromUrl(windowTarget.location.href) !== overviewScopeFromUrl(request.url);
          commitNavigation(request, source, { ...request.options,
            history: changesSelection || datasetLink ? request.options.history : 'replace' });
        }
        setOverview(Boolean(overviewScopeFromUrl(request.url)), selectionTransition);
        await bindSessionView(source, { restore, request });
        if (!requests.owns(request)) return false;
        requests.finish(request, 'finished'); syncPlayback();
        if (!restore) source.viewUrl?.flush();
        return true;
      }
      syncPlayback();
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
        fromId: objectId, toId: object.id, fromMount: source?.mount ?? null, toFactory: factoryTask,
        signal: request.signal, url: request.url,
        reducedMotion: reducedMotionActive,
        targetWorldCamera: request.options.targetWorldCamera,
        targetFocusPositionM: request.options.targetFocusPositionM,
        centerSelection: request.options.centerSelection,
        preserveView: request.options.preserveView,
        cameraViewport: worldContextMount?.viewport,
        timing: request.timing,
        presentWorld: worldContextMount ? (world, viewport, options) => worldContextMount?.present(world, viewport, options) : null,
      });
      const loaded = await request.lifetime.wait(Promise.all([factoryTask, contentTask, preparationTask]));
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
      publishSceneState();
      if (scenes.current === source && source) {
        source.shell?.setDatasetNotice?.(errorMessage(error));
        // Input can take over a same-owner selection flight before arrival. The
        // selected destination still owns that camera: keep only the drawn view
        // from the departed URL, otherwise its old prepared focus is restored
        // and pulls the camera back to the object the user just left.
        const captured = captureUrl();
        if (captured && interruptedSelection) {
          const drawn = new URL(captured, windowTarget.location.href);
          const selected = new URL(request.url, windowTarget.location.href);
          const view = drawn.searchParams.get('v');
          if (view) selected.searchParams.set('v', view); else selected.searchParams.delete('v');
          source.url = selected.href;
          historyOwner?.commit(selected.href, request.options);
          setOverview(Boolean(overviewScopeFromUrl(selected.href)));
        } else if (captured) {
          // The source still owns the last drawn camera when destination loading
          // fails. Rebinding its URL writer must not replay the departure pose.
          historyOwner?.commit(captured, { history: 'replace' });
        }
        await bindSessionView(source, { restore: false });
        source.viewUrl?.flush(); syncPlayback();
        if (!record(error) || error.preserveView !== true) report(error);
      }
      else if (scenes.current) fail(scenes.current, error);
      else report(error);
      return false;
    }
  }

  function commitNavigation(request: NavigationRequest, session: Session, options = request.options) {
    return requests.commit(request, () => {
      session.url = request.url;
      historyOwner?.commit(request.url, options);
    });
  }

  async function bindSessionView(session: Session, { restore = true, request }: { restore?: boolean; request?: NavigationRequest } = {}) {
    if ((request && !requests.owns(request)) || !scenes.isCurrent(session) || !session.mount?.sharedView || !windowTarget.location?.href || !session.url) return;
    // A failed history restoration keeps its incoming URL for diagnosis, like
    // Galaxio's invalid-route state. The old scene must not write into it.
    if (new URL(session.url).pathname !== windowTarget.location.pathname) return;
    worldContextMount?.suspendFocus?.();
    const owner = bindViewUrl({ windowTarget, view: session.mount.sharedView, listenToPopState: !navigation,
      getMotion: () => motionEnabled,
      setMotion(next) { session.shell?.setMotionEnabled?.(next); motionEnabled = next === true; syncPlayback(); },
      onError: report,
    });
    session.setViewUrl(owner);
    if (restore) await (request?.lifetime.wait ?? session.wait)(owner.restore());
    if ((!request || requests.owns(request)) && scenes.isCurrent(session)) worldContextMount?.restoreFocus?.(session.url);
  }

  function readPublication() {
    const state = scenes.state, session = scenes.current;
    const sceneState: SceneState = state.kind === 'failed' ? 'error' : state.kind === 'disposed' ? 'destroyed' : state.kind;
    const pending = requests.current;
    const selected = pending ? !overviewScopeFromUrl(pending.url) : !overview;
    const playback = Object.freeze({ motionRequested: motionEnabled, ...automaticPlaybackPolicy({
      sceneState: pending ? 'loading' : sceneState, motionRequested: motionEnabled,
      documentHidden: documentTarget.hidden, reducedMotion: reducedMotionActive,
    }) });
    const playing = session?.playing ?? false;
    return { sceneState, playing, playback, scene: Object.freeze({
      activeObjectId: objectId,
      selectedObjectId: selected ? pending?.id ?? objectId : null,
      overview: !selected,
      error: state.kind === 'failed' ? state.error.message : null,
      lifecycle: sceneState === 'ready' ? (playing ? 'mounted' : 'paused') : sceneState,
      mountedObjectCount: session?.mount ? 1 : 0,
      ready: sceneState === 'ready' && pending === null,
    }) };
  }
  function readPlayback() { return readPublication().playback; }
  function readSceneState() { return readPublication().scene; }

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
      const { allowed } = readPlayback();
      if (!session.play(allowed)) return;
      publishSceneState();
    } catch (error) { fail(session, error); }
  }

  function setData(element: HTMLElement, key: string, value: string | null) {
    if (value === null) { if (key in element.dataset) delete element.dataset[key]; }
    else if (element.dataset[key] !== value) element.dataset[key] = value;
  }

  function publishSceneState() {
    const inFlight = Boolean(requests.current && requests.current.options.preserveView !== true);
    worldContextMount?.setNavigationInFlight?.(inFlight);
    shellOwner?.shell?.setNavigationInFlight?.(inFlight);
    const { scene: state, sceneState, playing, playback } = readPublication();
    const root = documentTarget.documentElement;
    const body = documentTarget.body;
    // Scene state is republished at every navigation step. Only changes are written: removing
    // and re-adding an unchanged body class restyled the whole document (2,745 elements).
    setData(root, "scenePresented", String(hasPresented || initialScene?.available === true));
    setData(root, "ready", sceneState === "loading" ? "loading" : sceneState === "ready" ? "true" : sceneState === "error" ? "error" : null);
    if (sceneState === 'ready' || sceneState === 'error') delete root.dataset.shellContext;
    const bodyState = `${sceneState}:${!playing}`;
    if (bodyState !== publishedBodyState) {
      body.classList.remove("loading", "ready", "paused", "error");
      if (sceneState === "loading") body.classList.add("loading");
      else if (sceneState === "ready") { body.classList.add("ready"); if (!playing) body.classList.add("paused"); }
      else if (sceneState === "error") body.classList.add("error");
      publishedBodyState = bodyState;
    }
    const busy = sceneState === "loading" ? "true" : "false";
    if (stage.ariaBusy !== busy) stage.ariaBusy = busy;
    setData(root, "playing", sceneState === "loading" || sceneState === "ready" ? String(playing) : null);
    shellOwner?.shell?.setPlaybackState?.(playback);
    if (DIAGNOSTICS_ENABLED) {
      Reflect.set(windowTarget, '__cssEarth', createSceneDiagnostics(windowTarget, objectId, readSceneState, readPlayback));
    }
    return state;
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
        stage, signal: controller.signal, windowTarget,
      })).then(value => {
        if (controller.signal.aborted) {
          value?.destroy?.();
          throw controller.signal.reason ?? new DOMException('World context mount was cancelled.', 'AbortError');
        }
        if (!value || typeof value.publish !== 'function' || typeof value.destroy !== 'function') {
          throw new TypeError('Persistent world context mount must publish and destroy.');
        }
        worldContextMount = value;
        // The world mounts after the scene is ready, so a dataset that asks for a companion cloud asks again here.
        if (scenes.current?.mount?.datasets) syncCompanionClouds(scenes.current.mount.datasets);
        preferences.apply(value);
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
    const disconnectFocus = owner.connectNavigation?.(navigation, {
      onFocusChange(url) { if (scenes.isCurrent(session)) session.url = url; },
      onFocusContentChange(record, sources, presentation) { if (scenes.isCurrent(session)) shellOwner?.shell?.setPreparedFocus?.(record, sources, presentation); },
      onFlightStart() {
        if (!scenes.isCurrent(session)) return;
        motionEnabled = false; shellOwner?.shell?.setMotionEnabled?.(false); syncPlayback();
      },
    });
    if (disconnectFocus) session.own(disconnectFocus);
    const unsubscribe = navigation.subscribe((world, viewport) => {
      if (scenes.isCurrent(session) && worldContextMount === owner) owner.publish(world, viewport);
    });
    session.own(unsubscribe);
    session.framePresenter?.enable();
  }
  function setOverview(enabled: boolean, selectionTransition?: ShellNavigationTransition | null) {
    const entered = enabled && !overview;
    overview = enabled;
    scenes.current?.mount?.navigation?.setZoomOutCentering?.(enabled);
    if (selectionTransition) selectionTransition.arrive({ overview: enabled });
    else shellOwner?.shell?.setOverview?.(enabled);
    worldContextMount?.setOverview?.(enabled);
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
    if (!scenes.isCurrent(session)) return;
    if (session.request) requests.finish(session.request, 'failed');
    try { retire(session, error instanceof Error ? error : new Error(String(error))); }
    catch (failure) { report(failure); }
    if (initialScene?.available) {
      destroyWorldContext();
      initialScene.restore();
    }
    report(error);
  }
  function destroyActiveScene() {
    centeredObjectId = null;
    destroyWorldContext();
    hasPresented = false;
    requests.cancel();
    if (scenes.current) {
      try { retire(scenes.current); } catch (error) { report(error); }
    } else if (shellOwner) {
      const owner = shellOwner; shellOwner = null;
      try { owner.shell?.destroy(); } catch (error) { report(error); }
      publishSceneState();
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

function createSceneDiagnostics(windowTarget: Window, objectId: string,
  readSceneState: ReturnType<typeof createSceneRouter>['state'],
  readPlayback: ReturnType<typeof createSceneRouter>['playback']) {
  return Object.freeze({
        object: (id: string = objectId) => readObjectDiagnostics(windowTarget, id),
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
export type SceneDiagnostics = ReturnType<typeof createSceneDiagnostics>;
