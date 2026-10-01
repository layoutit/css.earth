import { prepareStartupBillboard } from '../startup-billboard.mts';
import { afterSceneFrame } from './scene-frame.mts';
import { retainInputSurface } from '@cssearth/renderer';
import { holdStartup, releaseStartup } from '@cssearth/renderer/rendering/startup-gate.ts';
import { createSceneWorld, type WorldContextOwner } from './scene-world.mts';
import { createSceneView } from './scene-view.mts';
import { selectSceneFeature } from './scene-feature.mts';
import { createScenePublication } from './scene-publication.mts';
import { focusExistingScene, prepareSceneReplacement } from './scene-transition.mts';
import type { BrowserWindow, SceneFactory } from '../browser/browser-types.mts';
import { errorMessage } from '../browser/browser-types.mts';
import { isRecord } from '@cssearth/core';
import type { ObjectEntry } from '../objects.mts';
import type { ObjectDescriptor } from '@cssearth/objects';
import type { WorldCameraPose } from '@cssearth/renderer/navigation/world-camera.ts';
import type { NavigationIntent } from '../navigation/navigation-request.mts';
import type { NavigationContent } from '../navigation/navigation-content.mts';
import type { ObjectShell, ShellNavigationTransition } from '../shell/object-shell-types.mts';
import type { WorldHandoff } from '../prepared-world-navigation.mts';
import { objectAdapter } from "../object-adapter.mts";
import { createNavigationContent } from '../navigation/navigation-content.mts';
import { createNavigationHistory, bindNavigationLinks, navigationHref } from '../navigation/navigation-history.mts';
import type { createPreparedWorldNavigation } from '../prepared-world-navigation.mts';
import { createWorldViewport } from '../world-viewport.mts';
import type { createSceneSelection, SceneSubject } from './scene-selection.mts';
import type { createSceneActivation } from './scene-activation.mts';
import { createCameraMotion } from '@cssearth/renderer/navigation';
import { drawnPageFromUrl, isOverviewPage, WORLD_HOST_ID } from '../navigation/navigation-scope.mts';
import { createNavigationTiming } from '../navigation/navigation-timing.mts';
import { retainInitialScene } from '../initial-scene.mts';
import { createNavigationLifecycle, type NavigationRequest } from '../navigation/navigation-lifecycle.mts';
import { createNavigationReadiness } from '../navigation/navigation-readiness.mts';
import { createWorldPreferences } from '../world-preferences.mts';
import { createDatasetEffects } from './scene-datasets.mts';
import { createSceneSessions, type SceneSession as Session } from './scene-session.mts';
import { readPreparedDescriptor } from '../prepared-descriptor.mts';
import { watchSatelliteSelection } from '../satellite-selection.mts';
import { satelliteSystemByHost, satelliteSystemOfMember } from '../satellite-systems.mts';
import { DIAGNOSTICS_ENABLED } from '../diagnostics-policy.mts';
import { observeSceneRetirement } from './scene-memory.mts';
import { releaseStartupRequests, startFlightRequest } from '../startup-requests.mts';
import { navigationFragments } from '../navigation/navigation-fragments.mts';
import { preparedObjectUrl } from '../prepared-object-path.mts';

type Navigation = ReturnType<typeof createPreparedWorldNavigation>;
type Registry = typeof import('./scene-registry.mts');
interface RouterContext {
  registry: Registry;
  /** Every body of the world, with its system and frame origin, from the world summary. */
  objects: Registry['WORLD_OBJECTS'];
  navigation: Navigation;
  selection: ReturnType<typeof createSceneSelection>;
  activation: ReturnType<typeof createSceneActivation>;
}
interface SceneReplacement {
  context: RouterContext;
  factory: SceneFactory;
  content: NavigationContent;
  handoff: WorldHandoff;
  request: NavigationRequest;
  selectionTransition: ShellNavigationTransition | null | undefined;
}
export type { WorldContextOwner, WorldContextMount } from './scene-world.mts';
export interface RouterOptions {
  stage: HTMLElement;
  objectId: string;
  loadObject?(id: string, descriptor?: ObjectDescriptor, signal?: AbortSignal): Promise<SceneFactory>;
  documentTarget?: Document;
  windowTarget?: BrowserWindow;
  reportError?(error: unknown): void;
  persistentWorldContext: WorldContextOwner;
}

export function createSceneRouter({
  stage,
  objectId,
  loadObject = (id, descriptor, signal) => objectAdapter.load(id, descriptor, undefined, signal),
  documentTarget = document,
  windowTarget = window,
  reportError = (error) => console.error(error),
  persistentWorldContext,
}: RouterOptions) {
  const sharedInput = documentTarget.querySelector<HTMLElement>('.object-input-surface');
  const releaseInput = sharedInput ? retainInputSurface(sharedInput) : () => {};
  const scenes = createSceneSessions();
  let mountTask: Promise<boolean | undefined> | null = null;
  const preferences = createWorldPreferences({ getWorld: () => world.current,
    onMotionChange() { syncPlayback(); scenes.current?.viewUrl?.schedule(); },
  });
  let hasPresented = false;
  const initialScene = retainInitialScene(stage);
  const initialBillboard = documentTarget.querySelector<HTMLImageElement>('img[data-startup-billboard]');
  let destroyed = false;
  // Whether a link flies in place; set once the router's modules have loaded (`ensureContext`).
  let navigable = (_id: string) => false;
  let shellOwner: { shell: ObjectShell | null } | null = null, historyOwner: ReturnType<typeof createNavigationHistory> | null = null, unbindLinks: (() => void) | null = null;
  let centeredObjectId: string | null = null;
  // The registry and what the router builds from it (navigation, selection, activation, history and the shell) arrive
  // after a cold page's first body has mounted. Publish them together once ready.
  let context: RouterContext | null = null, contextTask: Promise<RouterContext> | null = null;
  const cameraMotion = createCameraMotion();
  const subject = (): SceneSubject => context?.selection.current ?? { kind: 'object', objectId };
  const contentTransport = createNavigationContent({ documentTarget, windowTarget });
  const reducedMotion = windowTarget.matchMedia?.("(prefers-reduced-motion: reduce)");
  let reducedMotionActive = reducedMotion?.matches === true;
  // A header pill's flight holds the overview hand-over off until it lands, then settles it once.
  let categoryFlight = false, refreshOverviewSelection: (() => void) | null = null;
  const requests = createNavigationLifecycle({ onError: report, onCancel(request) {
    if (scenes.current?.request === request && scenes.state.kind !== 'ready') retire(scenes.current, null, { preserveShell: true, flush: false });
  } });
  const readiness = createNavigationReadiness<RouterContext>({
    context: ensureContext,
    knownObject: (ready, id) => ready.registry.knownObject(id) !== undefined,
    loadObject: async (ready, id) => (await ready.registry.loadObject(id)) !== null,
    systemViewLoaded: (ready, id) => ready.registry.systemViewLoaded(id),
    loadSystemView: (ready, id) => ready.registry.loadSystemView(id),
  });

  const world = createSceneWorld({ owner: persistentWorldContext, stage, windowTarget, isCurrent: scenes.isCurrent,
    onMount(value) {
      preferences.apply(value);
    },
    onCameraChange: followSelectionCamera,
    onError: report,
  });
  const view = createSceneView({ windowTarget, scenes, requests,
    getHistory: () => historyOwner, getWorld: () => world.current, getMotion: () => preferences.state.motionEnabled,
    setMotion(next) { preferences.set('motionEnabled', next); }, onError: report,
  });
  const publication = createScenePublication({ stage, documentTarget, windowTarget,
    read: () => ({ state: scenes.state, pending: requests.current, objectId, subject: subject(), motionEnabled: preferences.state.motionEnabled, lightCurvesEnabled: preferences.state.lightCurvesEnabled, reducedMotionActive,
      mountedObjectCount: scenes.current?.mount ? 1 : 0, playing: scenes.current?.playing ?? false,
      hasPresented: hasPresented || initialScene?.available === true || initialBillboard?.isConnected === true }),
    getShell: () => shellOwner?.shell ?? null, getWorld: () => world.current,
  });

  // These survive scene teardown so a persisted document can restore itself.
  windowTarget.addEventListener("pagehide", destroyActiveScene);
  windowTarget.addEventListener("pageshow", restoreCachedScene);
  documentTarget.addEventListener("visibilitychange", syncPlayback);
  reducedMotion?.addEventListener("change", syncReducedMotion);
  const firstMount = mountApplication();
  mountTask = firstMount;
  // Requests the head started for the first view and no reader took are dropped once it settles.
  void firstMount.finally(releaseStartupRequests).catch(() => {});
  // The iPad trace harness drives this same navigation path as the shell. Keep
  // the control out of ordinary builds; a performance build opts in explicitly.
  const control = DIAGNOSTICS_ENABLED ? Object.freeze({
    async fly(id: string) {
      if (documentTarget.visibilityState !== 'visible') throw new Error('The app is not the visible Safari tab.');
      if (typeof id !== 'string' || !/^[a-z0-9-]+$/u.test(id)) throw new TypeError('Invalid destination object id.');
      if (await navigate(id) !== true) throw new Error(`Navigation to ${id} did not complete.`);
      return { source: 'scene-router' as const, action: 'fly' as const, objectId: id, url: navigationHref(windowTarget) };
    },
  }) : null;
  if (control) windowTarget.__cssEarthControl = control;

  return Object.freeze({
    get settled() { return mountTask; },
    state: publication.state,
    playback: publication.playback,
    navigate,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      destroyActiveScene();
      releaseInput();
      documentTarget.removeEventListener("visibilitychange", syncPlayback);
      reducedMotion?.removeEventListener("change", syncReducedMotion);
      cameraMotion.cancel();
      context?.navigation.destroy();
      world.destroy();
      if (control && windowTarget.__cssEarthControl === control) delete windowTarget.__cssEarthControl;
      windowTarget.removeEventListener("pagehide", destroyActiveScene);
      windowTarget.removeEventListener("pageshow", restoreCachedScene);
      historyOwner?.destroy(); unbindLinks?.();
    },
  });

  async function mountApplication(replacement?: SceneReplacement): Promise<boolean | undefined> {
    if (destroyed || scenes.current) return;
    const request = replacement?.request;
    let handoff = replacement?.handoff;
    const session = scenes.start({ objectId, request, url: request?.url ?? windowTarget.location?.href,
      onFailure: fail, onCleanupError: report });
    try {
      publication.publish();
      const requestMotion = (next: boolean) => {
        if (!scenes.isCurrent(session)) return;
        preferences.set('motionEnabled', next);
      };
      // A plain cold page can present its prepared cover before downloading the
      // registry. Every path still prepares the world before mounting detail.
      const bodyFirst = !context && !replacement && !worldOwnsArrival();
      // A body's first view holds the world's background banks until its detail is interactive (startup-gate.ts). A
      // focus or overview arrival shows the world itself first, and loads them at once.
      if (!replacement && !worldOwnsArrival()) holdStartup(windowTarget);
      let ready = replacement?.context;
      if (!bodyFirst) {
        const loaded = await session.wait(ensureContext());
        if (loaded.cancelled || !scenes.isCurrent(session)) return;
        ready = loaded.value;
        attachShell(session, ready, replacement);
        request?.timing.mark('shell-attached');
        if (!scenes.isCurrent(session)) return;
        if (replacement) {
          // The prepared sidebar swap and the detail mount each restyle and lay out
          // hundreds of nodes. Let the swap render in its own frame first, so an
          // arriving flight does not drop a frame for both at once.
          const rendered = await session.wait(afterSceneFrame(windowTarget, session.signal));
          if (rendered.cancelled || !scenes.isCurrent(session)) return;
          request?.timing.mark('shell-rendered');
        }
        publication.publish();
        request?.timing.mark('world-published');
        // The body comes first: on a cold page the world's layers (sky, stars, volume, markers) load after the
        // detail mounts and connect to it. Only an arrival the world owns, a focus or overview, waits for them.
        if (replacement || worldOwnsArrival()) {
          const contextual = await session.wait(Promise.all([world.ensure(), ready.registry.loadSystemView(objectId)]));
          if (contextual.cancelled || !scenes.isCurrent(session)) return;
        }
      }
      const viewport = world.viewport;
      const factory = await (replacement?.factory ?? loadObject(objectId, readPreparedDescriptor(documentTarget, objectId), session.signal));
      if (!scenes.isCurrent(session)) return;
      const startup = !replacement ? await prepareStartupBillboard(stage, factory, viewport, session.url ?? navigationHref(windowTarget), session.objectId, session.signal) : null;
      handoff ??= startup ?? undefined;
      publication.publish();
      if (!scenes.isCurrent(session)) return;
      // Every initial URL prepares its world before detail, including restored
      // cameras that cannot use the default arrival photograph. Attaching world
      // styles and layers afterward invalidates the already-presented surface.
      if (!replacement) {
        const loaded = await session.wait(ensureContext());
        if (loaded.cancelled || !scenes.isCurrent(session)) return;
        ready = loaded.value;
        if (!session.shell) attachShell(session, ready);
        const contextual = await session.wait(Promise.all([world.ensure(), ready.registry.loadSystemView(objectId)]));
        if (contextual.cancelled || !scenes.isCurrent(session)) return;
      }
      const framePresenter = world.createFramePresenter();
      session.framePresenter = framePresenter;
      session.own(() => framePresenter.destroy());
      request?.timing.mark('activating');
      if (!await session.activate(factory, stage, {
        viewport,
        framePresenter,
        cameraMotion,
        onMotionRequest: requestMotion,
        onFeatureSelect: id => { void navigate(objectId, { kind: 'feature', id }).catch(report); },
        datasetEffects: createDatasetEffects(session, () => world.current, () => world.ensure()),
      }, handoff)) return false;
      const mount = session.mount;
      if (!mount) return false;
      if ('bodyPending' in documentTarget.documentElement.dataset) delete documentTarget.documentElement.dataset.bodyPending;
      if (!ready) {
        windowTarget.performance?.mark?.('cssearth:body-ready');
        const loaded = await session.wait(ensureContext());
        if (loaded.cancelled || !scenes.isCurrent(session)) return;
        ready = loaded.value;
        attachShell(session, ready);
        if (!scenes.isCurrent(session)) return;
        publication.publish();
      }
      const { registry: { loadSystemView, systemViewLoaded }, activation } = ready;
      // The world and this system's view load once the body is ready, so its textures have the connection to themselves.
      if (!systemViewLoaded(objectId)) void loadSystemView(objectId).catch(report);
      if (!await activation.frameInitialView(session) || !scenes.isCurrent(session)) return; // its camera before the world's first frame
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
        const selected = await request.lifetime.wait(selectFeature(ready, session, request));
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
      documentTarget.querySelector('.startup-loading')?.remove();
      initialScene?.commit();
      finishArrival(ready, session, request, interrupted);
      if (!request && arrival.feature) return navigate(objectId, { kind: 'feature', id: arrival.feature });
      return !interrupted;
    } catch (error) {
      if (scenes.isCurrent(session)) fail(session, error);
    } finally {
      // The startup arrival releases the gate as its detail reveals (startup-billboard.mts); an initial view without one
      // releases it once it has arrived, and a cancelled or failed one still lets the background load.
      if (!replacement) releaseStartup(windowTarget);
    }
  }

  /** Load the router's modules and this page's object entry once, and build what the router reads from them. */
  function ensureContext(): Promise<RouterContext> {
    if (contextTask) return contextTask;
    const task = import('./scene-registry.mts').then(async registry => {
      // The page's own object enters the live directory the navigation reads; other objects join as the page navigates.
      if (!await registry.loadObject(objectId)) throw new Error(`Object ${objectId} has no prepared entry.`);
      const objects = registry.WORLD_OBJECTS, worldIds = new Set(objects.map(object => object.id));
      const navigation = registry.createPreparedWorldNavigation({ objects: registry.SCENE_OBJECTS, motion: cameraMotion, windowTarget, documentTarget });
      const selection = registry.createSceneSelection({ objectId, systems: objects,
        initial: registry.selectionTargetFromUrl(new URL(windowTarget.location?.href ?? 'https://example.test'), objectId, objects), onChange: publishSelection });
      const activation = registry.createSceneActivation({ windowTarget, navigation, view, isCurrent: scenes.isCurrent, getReducedMotion: () => reducedMotionActive });
      if (windowTarget.location?.href && !destroyed) {
        // Only a settled scene belongs to the entry that history names. An unfinished navigation
        // has not committed its own entry, so snapshotting its scene would overwrite the entry it left.
        historyOwner = createNavigationHistory({ windowTarget, capture: () => requests.current ? null : view.capture(), navigate, navigating: () => requests.current !== null, embedded: 'embed' in documentTarget.documentElement.dataset, onError: report });
        // A link flies in place to any body the world draws; one whose entry has loaded must also share this frame.
        unbindLinks = bindNavigationLinks({ documentTarget, windowTarget, navigable: id => navigable(id), navigate, onError: report });
      }
      navigable = id => isOverviewPage(id) || worldIds.has(id) && (!registry.knownObject(id) || navigation.supports(objectId, id));
      if (destroyed) navigation.destroy();
      return context = { registry, objects, navigation, selection, activation };
    });
    contextTask = task;
    void task.catch(() => { if (contextTask === task) contextTask = null; });
    return task;
  }
  function attachShell(session: Session, { registry, selection: current }: RouterContext, replacement?: SceneReplacement) {
    if (!shellOwner) {
      const owner: { shell: ObjectShell | null } = { shell: null };
      shellOwner = owner;
      owner.shell = registry.mountObjectShell({ objectId, readSelection: () => current.current, documentTarget, windowTarget,
        preferences: preferences.bind(() => shellOwner === owner && scenes.current !== null),
        onResetDestination: () => { void navigate(objectId, { kind: 'feature', id: null }).catch(report); },
        // A header pill flies to its category, keeping the selection; a navigation already in flight keeps the camera. The
        // overview hand-over waits for the landing: swapping scenes on the way out would cancel the flight.
        onFrameCategory: classification => {
          const session = scenes.current;
          if (!session?.mount || !context || requests.current || !scenes.isCurrent(session)) return;
          categoryFlight = true;
          void context.navigation.frameCategory({ classification, objectId, mount: session.mount, signal: session.signal, reducedMotion: reducedMotionActive })
            .catch((error: unknown) => { if (!session.signal.aborted) reportError(error); })
            .finally(() => { categoryFlight = false; if (scenes.isCurrent(session)) refreshOverviewSelection?.(); });
        },
        navigable: id => navigable(id),
        // A failed prefetch is not an error yet: the navigation that needs it asks again and reports.
        prefetch: id => { void registry.loadObject(id).catch(() => {}); void registry.loadSystemView(id).catch(() => {}); },
      });
    }
    const shell = shellOwner.shell!;
    session.shell = shell;
    if (replacement) current.commit(replacement.request.subject, objectId, false);
    if (replacement?.selectionTransition) replacement.selectionTransition.arrive({ content: replacement.content, subject: current.current });
    else {
      if (replacement) shell.setObject(replacement.content);
    }
    publishSelection();
  }

  async function navigate(id: string, intent: NavigationIntent = { kind: 'object' }): Promise<boolean | undefined> {
    if (destroyed) return false;
    // A selection made while the first view is still mounting leaves from it once it is drawn: until then there is no
    // drawn camera to fly from. The latest selection still wins (readiness.prepare).
    if (mountTask === firstMount && scenes.state.kind !== 'ready') {
      await firstMount.catch(() => undefined);
      if (destroyed) return false;
    }
    if (id !== objectId) {
      // A level's page (a link or history entry) opens on the world's host, as zooming out reaches it (navigation-scope.mts).
      const { registry, objects } = await ensureContext();
      if (destroyed) return false;
      // A flight to another body reads its entry, system view, card and object transport. All four start now, together:
      // otherwise the system view waits for the entry, and the transport for the card (scene-transition.mts).
      if (objects.some(object => object.id === id)) {
        navigationFragments(windowTarget).prefetch(id);
        startFlightRequest(preparedObjectUrl(id, 'prepared/object.json'));
        if (intent.kind !== 'feature') void registry.loadSystemView(id).catch(() => {});
      }
      if (isOverviewPage(id)) id = WORLD_HOST_ID;
    }
    // Entry and system-view reads may finish in any order. Only the latest selection can start a flight.
    const ready = await readiness.prepare(id, intent.kind !== 'feature');
    if (!ready || destroyed) return false;
    const { registry: { resolveNavigation }, navigation: routes, selection: current, objects } = ready;
    if (!routes.supports(objectId, id)) return false;
    const object = ready.registry.SCENE_OBJECTS.find(object => object.id === id);
    if (!object) return false;
    const source = scenes.current;
    const resolved = resolveNavigation(intent, { object, objects, navigation: routes, current: {
      objectId, href: navigationHref(windowTarget), subject: current.current,
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
    if (request.camera.kind === 'surface' || request.feature) preferences.set('motionEnabled', false);
    mountTask = transition(ready, request, object);
    return mountTask;
  }

  async function transition(ready: RouterContext, request: NavigationRequest, object: ObjectEntry): Promise<boolean | undefined> {
    const { navigation, selection } = ready;
    const source = scenes.current;
    try {
      if (request.scene === 'replace') {
        const release = source?.mount?.navigation?.holdPresentation?.();
        if (release) request.own(release);
      }
      world.current?.previewSelection?.(request.subject.kind === 'overview' ? null : object.id);
      request.own(() => {
        if (!requests.current || requests.owns(request)) world.current?.previewSelection?.();
      });
      const selectionTransition = shellOwner?.shell?.beginNavigation?.(request.subject.kind === 'overview'
        ? { kind: 'overview', overview: request.subject.overview,
          preview: request.camera.kind === 'frame' && request.camera.framing === 'center' }
        : { kind: request.subject.kind === 'satellite-system' ? 'satellite-system' : 'object', object,
          targetWorldCamera: request.camera.kind === 'frame' ? request.camera.world ?? undefined : undefined });
      if (selectionTransition) request.own(() => selectionTransition.dispose());
      if (source && request.scene === 'reuse') {
        return await focusExistingScene({ session: source, request, selectionTransition, navigation, requests, view,
          windowTarget, getReducedMotion: () => reducedMotionActive,
          commitSelection: (request, transition) => commitSelection(ready, request, transition),
          finishArrival: (session, request, interrupted) => finishArrival(ready, session, request, interrupted),
          selectFeature: (session, request) => selectFeature(ready, session, request), syncPlayback });
      }
      syncPlayback();
      const loaded = await prepareSceneReplacement({ fromId: objectId, source, object, request, navigation, requests,
        loadObject, contentTransport, reducedMotion: reducedMotionActive, getWorld: () => world.current, stage });
      if (loaded.cancelled || !requests.owns(request)) return false;
      const [factory, content, handoff] = loaded.value;
      // The camera acknowledgement resolves inside its RAF. Keep scene teardown
      // and shell publication out of that rendering turn; the resident billboard
      // continues to cover the arrival. Cancellation keeps the old scene intact.
      const presented = await request.lifetime.wait(afterSceneFrame(windowTarget, request.signal));
      if (presented.cancelled || !requests.owns(request)) return false;
      request.timing.mark('handoff');
      if (scenes.current) retire(scenes.current, null, { preserveShell: true, flush: false, publish: false });
      objectId = object.id;
      if (stage.dataset) stage.dataset.objectId = object.id;
      const result = await mountApplication({ context: ready, factory, content, handoff, request, selectionTransition });
      requests.finish(request, scenes.state.kind === 'failed' ? 'failed' : 'cancelled');
      return result === true;
    } catch (error) {
      const interruptedSelection = objectId === object.id && request.origin === 'selection' && isRecord(error) &&
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
        const captured = snapshot;
        if (captured && interruptedSelection) {
          const selected = new URL(captured, navigationHref(windowTarget)).href;
          source.url = selected;
          historyOwner?.commit(selected, request.history);
          commitSelection(ready, request);
        } else if (captured) {
          // The source still owns the last drawn camera when destination loading
          // fails. Rebinding its URL writer must not replay the departure pose.
          view.replace(source, new URL(captured, navigationHref(windowTarget)).href);
        }
        await view.arrive(source, { interrupted: true });
        source.viewUrl?.flush(); syncPlayback();
        if (!isRecord(error) || error.preserveView !== true) report(error);
      }
      else if (scenes.current) fail(scenes.current, error);
      else report(error);
      return false;
    }
  }

  function selectFeature({ registry }: RouterContext, session: Session, request: NavigationRequest) {
    return selectSceneFeature(session, request, registry.knownObject(session.objectId)?.name ?? session.objectId);
  }

  function finishArrival(ready: RouterContext, session: Session, request?: NavigationRequest, interrupted = false) {
    if (request) requests.finish(request, interrupted ? 'interrupted' : 'finished');
    const mounted = !request || request.scene === 'replace';
    if (mounted && session.mount?.navigation) followSelectionCamera(session, session.mount.navigation.capture());
    // Retained arrivals commit their URL after selection; page datasets must follow that committed address too.
    publishSelection();
    if (mounted && ready.selection.current.kind === 'overview') aimAtSystemCenter(ready);
    syncPlayback();
    if (mounted) {
      connectOverviewSelection(ready, session);
      connectSatelliteSelection(ready, session);
    }
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
      const { allowed, lightCurves } = publication.playback();
      if (!session.play(allowed, lightCurves)) return;
      publication.publish();
    } catch (error) { fail(session, error); }
  }

  function retire(session: Session, error: unknown = null, { preserveShell = false, flush = true, publish = true } = {}) {
    if (!scenes.isCurrent(session)) return;
    const retired = DIAGNOSTICS_ENABLED ? observeSceneRetirement(windowTarget, session.objectId) : null;
    // Detach and invalidate before any user cleanup or native wait can finish.
    const cleanupErrors = session.dispose(error === null ? undefined : error, { flush, preserveControls: preserveShell });
    retired?.();
    if (!preserveShell) {
      hasPresented = false;
      const owner = shellOwner; shellOwner = null;
      try { owner?.shell?.destroy(); } catch (error) { cleanupErrors.push(error); }
    }
    // A replacement starts its loading session synchronously after retirement.
    // Do not project the intermediate absence of a scene onto the retained shell.
    if (publish) publication.publish();
    for (const failure of cleanupErrors) report(failure);
  }

  /** A focus or overview arrival is placed by the world, so it cannot start before the world has loaded. */
  function worldOwnsArrival() {
    const url = new URL(navigationHref(windowTarget));
    return drawnPageFromUrl(url, objectId) !== null || ['overview', 'view'].some(name => url.searchParams.has(name));
  }
  function report(error: unknown) {
    try { reportError(error); } catch { /* Diagnostics cannot interrupt cleanup. */ }
  }
  function followSelectionCamera(session: Session, frame: WorldCameraPose) {
    // Until the arrival is ready the camera still shows the mounted object's default view, not the page's: following it
    // selected the Solar System for a moment on every overview page (and fetched its body list for nobody).
    if (requests.current || scenes.state.kind !== 'ready') return;
    const selection = context?.selection;
    if (selection?.followCamera(frame)) {
      view.replace(session, selection.url(session.url ?? navigationHref(windowTarget)));
      // An overview's page carries no scene dataset; the scene's page gets its dataset back on the way in.
      view.syncDataset(session);
    }
  }
  function publishSelection() {
    const selection = context?.selection;
    const overview = selection?.context.kind === 'overview';
    scenes.current?.mount?.navigation?.setZoomOutCentering?.(overview);
    shellOwner?.shell?.presentSelection();
    const subject = selection?.current;
    // The system has its own shell selection, but its world paths use the shared overview policy.
    world.current?.setOverview?.(overview || selection?.context.kind === 'satellite-system',
      subject?.kind === 'overview' ? subject.overview.scope : undefined, subject?.kind === 'satellite-system');
    if (stage.dataset) {
      const current = subject ?? { kind: 'object' as const, objectId };
      const value = current.kind === 'overview' ? current.overview.scope
        : current.kind === 'satellite-system' ? current.hostId : current.objectId;
      if (stage.dataset.selection !== value) stage.dataset.selection = value;
    }
    publication.publish();
  }
  function commitSelection(ready: RouterContext, request: NavigationRequest, transition?: ShellNavigationTransition | null) {
    const current = ready.selection, wasOverview = current.context.kind === 'overview';
    current.commit(request.subject, objectId, false);
    transition?.arrive({ subject: current.current });
    publishSelection();
    if (!wasOverview && current.current.kind === 'overview') aimAtSystemCenter(ready);
  }
  /** A binary's overview is centred on the pair's centre of mass, not on the star the scene mounts. Entering the overview
   * turns the camera onto that centre at the same distance; zooming out then keeps the pair centred. */
  function aimAtSystemCenter({ registry, navigation: routes }: RouterContext) {
    const session = scenes.current, mount = session?.mount;
    if (!session || !mount || !registry.SYSTEM_CENTERS.has(objectId)) return;
    const target = routes.systemCenterTarget?.({ objectId, fromId: objectId, mount });
    if (!target) return;
    void routes.focus({ objectId, mount, signal: session.signal, reducedMotion: reducedMotionActive,
      targetWorldCamera: target.world, targetFocusPositionM: target.focusPositionM, centerSelection: true })
      .catch((error: unknown) => { if (!session.signal.aborted) reportError(error); });
  }
  function connectOverviewSelection(ready: RouterContext, session: Session) {
    const owner = session.mount?.navigation;
    if (!owner) return;
    const { selection: current, objects, registry } = ready;
    const watch = registry.watchOverviewSelection({ navigation: owner, objects: registry.SCENE_OBJECTS, systems: objects, objectId,
      getOverview: () => current.context.kind === 'overview',
      // The pending flight owns the camera; repeat-click bookkeeping must not
      // suppress zoom-out deselection after that flight has finished.
      isAvailable: () => scenes.isCurrent(session) && scenes.state.kind === 'ready' && !requests.current && !categoryFlight,
      windowTarget,
      onChange(next) {
        if (!next.overview || next.objectId === objectId) {
          // A mounted star and its system overview share the same camera, detail and
          // subscriptions. Change their selection in place in either direction.
          current.commit(next.overview ? { kind: 'overview', overview: { scope: 'system', systemId: objectId } }
            : { kind: 'object', objectId }, objectId);
          if (next.overview) aimAtSystemCenter(ready);
          view.replace(session, current.url(navigationHref(windowTarget)));
          view.syncDataset(session);
          session.viewUrl?.flush();
          return;
        }
        void navigate(next.objectId, { kind: 'overview', scope: 'system', camera: 'preserve' });
      },
    });
    session.own(watch);
    refreshOverviewSelection = watch.refresh;
    session.own(() => { if (refreshOverviewSelection === watch.refresh) refreshOverviewSelection = null; });
  }
  function connectSatelliteSelection(ready: RouterContext, session: Session) {
    if (!satelliteSystemByHost(objectId) && !satelliteSystemOfMember(objectId)) return;
    const owner = session.mount?.navigation;
    if (!owner) return;
    const current = ready.selection;
    session.own(watchSatelliteSelection({ navigation: owner, objects: ready.registry.SCENE_OBJECTS,
      getSelection: () => current.context,
      isAvailable: () => scenes.isCurrent(session) && scenes.state.kind === 'ready' && !requests.current,
      documentTarget, windowTarget,
      onChange(next) {
        if (next.kind === 'satellite-system' && next.hostId !== objectId) {
          void navigate(next.hostId, { kind: 'satellite-system', camera: 'preserve' }).catch(report);
          return;
        }
        current.commit(next, objectId);
        view.replace(session, current.url(navigationHref(windowTarget)));
        session.viewUrl?.flush();
      },
    }));
  }
  function fail(session: Session, error: unknown) {
    if (!scenes.isCurrent(session)) return;
    delete documentTarget.documentElement.dataset.bodyPending;
    documentTarget.querySelector('.startup-loading')?.remove();
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
    readiness.invalidate();
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
  // The world renderer and its markers stay out of the startup script; they load with the world.
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
  const persistentWorldContext = createWorldContextOwner();
  createSceneRouter({ stage, objectId, persistentWorldContext });
}

export type { SceneDiagnostics } from './scene-publication.mts';
