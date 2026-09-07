import type { ObjectRuntimeDefinition, ObjectMountOptions, ObjectRuntimeView, PageLayerRuntime } from "./object-runtime-types.js";
import type { ObjectSelectionState } from "../rendering/object-selection-runtime.js";
import type { OrbitPublication, RetainedCubicSkyOrbit } from "../navigation/object-orbit.js";
import type { SharedView } from "../navigation/view-url.js";
import type { RetainedHeliocentricView } from "../solar-system/heliocentric-view-runtime.js";
import type { ObjectWorldNavigation, ObjectWorldNavigationListener } from './world-navigation-types.js';
import type { WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import { errorMessage } from "../navigation/types.js";
import { publishObjectDiagnostics } from "./object-diagnostics.js";
export type { ObjectRuntimeDefinition, ObjectMountOptions, ObjectRuntimeView } from "./object-runtime-types.js";
export type ObjectRuntimeServices = typeof nativeServices;

import { CANONICAL_PREPARED_IMAGE_DENSITY } from "../rendering/prepared-object-assets.js";
import { createSceneLifetime } from "@cssearth/engine";
import { waitForSceneDocument, waitForScenePaint } from "./scene-native-waits.js";
import { createPreparedResidency } from "../rendering/prepared-residency.js";
import { createObjectSelectionRuntime } from "../rendering/object-selection-runtime.js";
import { createObjectControlBinding } from "../rendering/object-control-binding.js";
import { createPreparedPlayback } from "../rendering/prepared-playback.js";
import { createRetainedCubicSkyOrbit } from "../navigation/object-orbit.js";
import { mountRetainedCubicSky } from "../solar-system/cubic-sky-runtime.js";
import { mountRetainedDirectionalSun } from "../solar-system/directional-sun-runtime.js";
import { mountRetainedHeliocentricView } from "../solar-system/heliocentric-view-runtime.js";
import { mountPreparedPresentation } from "../rendering/prepared-presentation.js";
import { initialObjectSelection, requireObjectRuntimeDefinition } from "./object-contract.js";
import { formatSharedView, parseSharedView } from "../navigation/view-url.js";
import { createWorldNavigationPublicationHub } from './world-navigation-publication.js';

const nativeServices = Object.freeze({ createLifetime: createSceneLifetime, createResources: createPreparedResidency,
  createPlayback: createPreparedPlayback, createSelection: createObjectSelectionRuntime, createControls: createObjectControlBinding, createOrbit: createRetainedCubicSkyOrbit,
  mountSky: mountRetainedCubicSky, mountSun: mountRetainedDirectionalSun, mountHeliocentric: mountRetainedHeliocentricView,
  waitDocument: waitForSceneDocument, waitPaint: waitForScenePaint });

// Every registry loader binds this factory. The optional services argument is
// used only by native-boundary unit tests; object clients bind one definition.
export function createObjectRuntime(definition: ObjectRuntimeDefinition, services: Partial<ObjectRuntimeServices> = {}) {
  requireObjectRuntimeDefinition(definition);
  if (!Array.isArray(definition.motion)) throw new TypeError('Object motion bindings must be prepared before mount.');
  const initialSelection = initialObjectSelection(definition.controls);
  const environment = { ...nativeServices, ...services };
  return function mountObject(stage: HTMLElement, { onError, onMotionRequest = () => {}, inputSurface, runtimePolicy, mobilePreviewElement = null, diagnostics = false, capabilities = {}, worldFrame, worldContext, externalWorldContext = false, preparedResources, preparedTree, initialWorldCamera, initialProjection }: ObjectMountOptions) {
    if (stage?.dataset?.objectId !== definition.id) throw new TypeError("Object runtime identity does not match the registered stage.");
    if (stage?.nodeType !== 1 || !stage.ownerDocument || typeof onError !== "function" || typeof onMotionRequest !== "function") {
      throw new TypeError("Object mount requires the registered stage and error owner.");
    }
    if (definition.destinations && !capabilities.createDestinations) throw new TypeError("Prepared destinations require an injected runtime capability.");
    if (definition.pageLayers?.length && !capabilities.mountPages) throw new TypeError("Prepared pages require an injected runtime capability.");
    const lifetime = environment.createLifetime();
    let readyPublished = false, settled = false;
    let resolveReady!: () => void, rejectReady!: (error: unknown) => void;
    const ready = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
    ready.catch(() => {});
    let mounted: ReturnType<typeof mountPreparedPresentation> | null = null, orbit: RetainedCubicSkyOrbit | null = null;
    let worldLayer: import('./object-runtime-types.js').WorldContextLayer | null = null;
    let currentView: ObjectRuntimeView | null = null, reference: OrbitPublication | null = null, previousPublication: OrbitPublication | null = null;
    let heliocentric: RetainedHeliocentricView | null = null;
    const pageLayers = new Map<string, PageLayerRuntime>();
    let allowed = false, navigatedLens: string | null = null, maximumZoom = definition.camera.maximumZoom;
    const cameraPlan = Object.freeze({ ...definition.camera, get maximumZoom() { return maximumZoom; } });
    let startupDecodedAssets = 0;
    let revision = 0, selection: ReturnType<typeof createObjectSelectionRuntime> | null = null, controls: ReturnType<typeof createObjectControlBinding> | null = null;
    const viewListeners = new Set<() => void>();
    const worldPublication = createWorldNavigationPublicationHub(fatal);
    let latestWorldPublication: OrbitPublication | null = null;
    const notifyView = () => { if (readyPublished) for (const listener of viewListeners) listener(); };
    lifetime.onDispose(() => { viewListeners.clear(); worldPublication.destroy(); });
    const playback = environment.createPlayback();
    lifetime.onDispose(() => playback.destroy());
    if (preparedTree) lifetime.onDispose(() => preparedTree.destroy());
    let resources: ReturnType<typeof createPreparedResidency>;
    try {
      const resourceOptions = { assets: definition.assets,
        onReady() { guarded(() => orbit?.invalidate()); },
        onWarmError(error: unknown) { if (!lifetime.disposed) console.error(error); },
        onCleanupError: fatal,
      };
      resources = preparedResources ? preparedResources.claim(definition.assets, resourceOptions) : environment.createResources(resourceOptions);
    } catch (error) {
      const errors = lifetime.destroy();
      throw errors.length ? new AggregateError([error, ...errors], errorMessage(error), { cause: error }) : error;
    }
    lifetime.onDispose(() => resources.destroy());
    const context = Object.freeze({
      density: CANONICAL_PREPARED_IMAGE_DENSITY,
      resources: resources.resources,
      own(disposer: () => void) {
        const errors = lifetime.onDispose(disposer);
        if (errors.length) throw new AggregateError(errors, "Late presentation cleanup failed.");
      },
      registerAnimation: playback.register,
      seekAnimation: playback.seek,
    });
    const destinations = definition.destinations && capabilities.createDestinations ? capabilities.createDestinations({ plan: definition.destinations,
      ready, lifetime, selectLens: id => getSelection().dispatch({ kind: "lens", id }),
      navigate: camera => { stopMotion(); alignMotionFrame(); return getOrbit().flyToState(camera, { surfaceTarget: true }); },
      reset: () => orbit?.flyToState({ controlPitch: definition.camera.defaultControlPitchDegrees,
        controlYaw: definition.camera.defaultControlYawDegrees, zoom: getOrbit().initialResponsiveZoom() }),
    }) : null;
    const legacyPreparedEpochJdTt = definition.heliocentricView?.plan.system?.epochJdTt ?? null;
    const preparedEpochJdTt = worldFrame?.epochJdTt ?? legacyPreparedEpochJdTt;
    let restoreVersion = 0;
    const sharedView = Object.freeze({
      capture(motionRequested = false): SharedView | null {
        if (!readyPublished) return null;
        const owner = getOrbit(), state = owner.state();
        const camera = owner.sharedState?.() ?? (state.pose.schema === "cssearth-camera-pose@2"
          ? physicalFallback(state.pose, state.distanceKilometers)
          : { controlPitch: state.controlPitch, controlYaw: state.controlYaw, zoom: state.zoom, pose: state.pose,
            ...(state.distanceKilometers === undefined ? {} : { distanceKilometers: state.distanceKilometers }) });
        return { camera, preparedEpochJdTt,
          playback: { times: playback.captureMotion(), speed: playback.stats().speed, motionRequested } };
      },
      async restore(saved: SharedView) {
        // Validate the whole payload before any native animation or camera write.
        const view = parseSharedView(formatSharedView(saved));
        if (!view) throw new TypeError("A saved object view is required.");
        const version = ++restoreVersion;
        if (!readyPublished || lifetime.disposed) return false;
        // Older local views of objects without an embedded orbital layer did
        // not carry an epoch. New captures use the shared prepared world frame.
        const legacyLocalView = view.preparedEpochJdTt == null && legacyPreparedEpochJdTt === null;
        if (!legacyLocalView && (view.preparedEpochJdTt ?? null) !== preparedEpochJdTt) {
          throw new TypeError("This view uses a different prepared astronomical date.");
        }
        playback.validateMotion(view.playback.times);
        const speed = definition.controls.settings?.controls.find(control => control.name === "speed");
        if (view.playback.speed !== playback.stats().speed) {
          if (!speed || !(await getSelection().dispatch({ kind: "cycle", name: "speed", value: view.playback.speed }))) {
            throw new TypeError("This view uses an unsupported playback speed.");
          }
        }
        if (lifetime.disposed || version !== restoreVersion) return false;
        playback.restoreMotion(view.playback.times);
        getOrbit().setState(view.camera);
        return true;
      },
      subscribe(listener: () => void) { viewListeners.add(listener); return () => viewListeners.delete(listener); },
    });
    const navigation: ObjectWorldNavigation | undefined = worldFrame ? Object.freeze({ frame: worldFrame,
      setZoomOutCentering(enabled: boolean) { if (!lifetime.disposed) getOrbit().setZoomOutCentering(enabled); },
      capture() { return getOrbit().captureWorldCamera(worldFrame); },
      apply(pose: Parameters<ObjectWorldNavigation['apply']>[0]) { if (!lifetime.disposed) { setAllowed(false); getOrbit().applyWorldCamera(pose, worldFrame); } },
      preparedFocus() { return getOrbit().preparedFocus(); },
      setPreparedFocus(focus: Parameters<ObjectWorldNavigation['setPreparedFocus']>[0]) {
        if (!lifetime.disposed) getOrbit().setPreparedFocus(focus, worldFrame);
      },
      flyToPreparedFocus(focus: Parameters<ObjectWorldNavigation['flyToPreparedFocus']>[0], options?: Parameters<ObjectWorldNavigation['flyToPreparedFocus']>[1]) {
        if (lifetime.disposed) return Promise.resolve({ completed: false });
        setAllowed(false);
        return getOrbit().flyToPreparedFocus(focus, worldFrame, this.optics(), options);
      },
      optics() {
        const state = getOrbit().state();
        if (state.focal === undefined || !state.principalOffset || !definition.camera.levelOfDetail) throw new TypeError('World navigation requires a physical camera.');
        return { focalPixels: state.focal, principalOffsetPixels: [state.principalOffset[0], state.principalOffset[1]] as const,
          widthPixels: latestWorldPublication?.stageViewport?.widthPixels,
          heightPixels: latestWorldPublication?.stageViewport?.heightPixels,
          detailHandoffDiameterPixels: definition.camera.levelOfDetail.billboardFullDiscPixels,
          framingRadiusPixels: getOrbit().currentResponsiveZoom() / definition.camera.defaultZoom * definition.camera.logicalBodyDiameter / 2 };
      },
      subscribe(listener: ObjectWorldNavigationListener) {
        return worldPublication.subscribe(listener);
      },
    }) : undefined;
    const controller = Object.freeze({ ready, sharedView, ...(destinations ? { destinations } : {}), ...(navigation ? { navigation } : {}),
      pause() { if (!lifetime.disposed) guarded(() => setAllowed(false)); },
      resume() { if (!lifetime.disposed) guarded(() => setAllowed(true)); },
      destroy() {
        if (!settled) { settled = true; resolveReady(); }
        const errors = lifetime.destroy();
        if (errors.length) throw new AggregateError(errors, "Object cleanup failed.");
      },
    });
    start().catch(fatal);
    return controller;

    function getOrbit(): RetainedCubicSkyOrbit {
      if (!orbit) throw new Error("Object camera is not mounted.");
      return orbit;
    }
    function getSelection(): ReturnType<typeof createObjectSelectionRuntime> {
      if (!selection) throw new Error("Object selection is not mounted.");
      return selection;
    }
    function syncPagePlayback() {
      const running = allowed && (selection?.state().committed?.speed ?? initialSelection.speed ?? 1) !== 0;
      for (const layer of pageLayers.values()) layer.setPlaying(running);
    }
    function setAllowed(value: boolean) { allowed = value; playback.setAllowed(value); syncPagePlayback(); }
    function stopMotion() { onMotionRequest(false); setAllowed(false); }
    function alignMotionFrame() {
      const elements = mounted?.motionFrame;
      if (!elements?.length) return;
      const window = stage.ownerDocument.defaultView;
      if (!window) throw new Error("Object motion requires the mounted window.");
      const frame = () => elements.reduce((matrix, element) => matrix.multiply(
        new window.DOMMatrix(window.getComputedStyle(element).transform)), new window.DOMMatrix());
      const before = frame();
      playback.resetMotion();
      getOrbit().rebaseScene(before.multiply(frame().inverse()));
    }
    function publishSelection(state: Readonly<ObjectSelectionState>) {
      controls?.publish(state);
      if (state.committed && !state.pending) notifyView();
      if (!state.committed || state.pending || !orbit || state.committed.lensId === navigatedLens) return;
      navigatedLens = state.committed.lensId;
      const navigation = state.plan?.navigation;
      if (!navigation) return;
      maximumZoom = navigation.maximumZoom;
      if (navigation.camera) { stopMotion(); alignMotionFrame(); }
      orbit.setState({ zoom: Math.min(orbit.state().zoom, maximumZoom) });
      if (navigation.camera) orbit.flyToState(navigation.camera, { surfaceTarget: true });
    }
    function fatal(error: unknown) {
      if (lifetime.disposed) return;
      // Invalidate the session before any cleanup can trigger a native callback.
      const errors = lifetime.destroy();
      const failure = errors.length ? new AggregateError([error, ...errors], errorMessage(error), { cause: error }) : error;
      if (!settled) { settled = true; rejectReady(failure); }
      else if (readyPublished) onError(failure);
    }
    function guarded<T>(callback: () => T): T | undefined {
      if (lifetime.disposed) return;
      try { return callback(); } catch (error) { fatal(error); }
    }
    function publish(publication: OrbitPublication) {
      if (lifetime.disposed) return;
      reference ??= publication;
      currentView = Object.freeze({ ...publication, reference, previous: previousPublication, revision: ++revision });
      previousPublication = publication;
      selection?.setView(currentView);
      for (const layer of pageLayers.values()) layer.publish(currentView);
      if (worldFrame && publication.focal !== undefined && publication.principalOffset &&
          publication.principalOffset.length === 2) {
        latestWorldPublication = publication;
        publishWorldSnapshot(publication);
      }
      notifyView();
    }
    function publishWorldSnapshot(publication: OrbitPublication) {
      if (!worldFrame || orbit === null || publication.focal === undefined ||
          !publication.principalOffset || publication.principalOffset.length !== 2) return;
      const latestWorld = orbit.captureWorldCamera(worldFrame);
      const latestWorldViewport = publication.stageViewport ?? stageWorldViewport(stage, mounted?.cameraElement ?? null,
        publication.focal, publication.principalOffset);
      worldPublication.publish(latestWorld, latestWorldViewport);
    }
    async function start() {
      await lifetime.wait(environment.waitDocument(lifetime, stage.ownerDocument));
      if (lifetime.disposed) return;
      controls = environment.createControls({ stage, controls: definition.controls, initialSelection,
        getState: () => selection?.state() ?? { desired: initialSelection, committed: null, pending: true, plan: null, loadingMaterial: false, ready: false, error: null, viewRevision: null },
        onAction: action => selection?.dispatch(action) ?? false, onError: error => console.error(error) });
      context.own(() => controls?.destroy());
      // A claimed preflight bank already completed and released default startup.
      // Re-running it would pin obsolete lighting rows beside the incoming view.
      const startup = await lifetime.wait<boolean | void | null>(preparedResources ? preparedResources.ready : resources.prepareStartup());
      if (lifetime.disposed || startup.cancelled) return;
      startupDecodedAssets = resources.stats().decodes;
      mounted = mountPreparedPresentation(stage, context, definition, preparedTree, initialProjection);
      if (lifetime.disposed) return;
      for (const layer of mounted.pageLayers ?? []) {
        if (!capabilities.mountPages) throw new TypeError("Prepared pages require an injected runtime capability.");
        const pages = capabilities.mountPages({ ...layer, stage, scene: mounted.sceneElement, camera: mounted.cameraElement,
          own: context.own, onError: fatal });
        pageLayers.set(layer.id, pages);
        pages.setLens({ id: initialSelection.lensId });
      }
      syncPagePlayback();
      // Presentation owns its roots immediately during construction, including
      // partial construction failures. Shared celestial layers join afterwards.
      const cubicSky = environment.mountSky({ host: stage, plan: definition.sky,
        imageDensity: context.density, objectId: definition.id, requireSun: false, renderContent: !externalWorldContext });
      context.own(() => cubicSky.destroy());
      if (externalWorldContext) {
        // The application-owned context supplies the visible sky. Keep the
        // orientation handles mounted for the orbit contract, without the
        // unused photographic faces or catalogue star leaves.
        const skyFade = stage.ownerDocument.createElement('div');
        skyFade.className = 'prepared-context-sky-fade';
        skyFade.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:0;opacity:0;visibility:hidden';
        if (cubicSky.root.parentNode === stage) {
          stage.insertBefore(skyFade, cubicSky.root);
          skyFade.appendChild(cubicSky.root);
        } else {
          stage.appendChild(skyFade);
          skyFade.appendChild(cubicSky.root);
        }
        context.own(() => skyFade.remove());
      } else if (worldContext && capabilities.mountWorldContext) {
        worldLayer = capabilities.mountWorldContext({ stage, before: mounted.cameraElement, skyElement: cubicSky.root,
          worldContext, own: context.own, onError: fatal });
        context.own(() => worldLayer?.destroy());
      }
      const orbitWorldContext = worldContext && worldLayer
        ? Object.freeze({ ...worldContext, onWorldPublish: (world: WorldCameraPose, viewport: WorldCameraViewport) => {
            worldContext.onWorldPublish?.(world, viewport);
            worldLayer?.publish(world, viewport);
          } })
        : worldContext;
      // A heliocentric view renders the Sun as real geometry beneath the body
      // (its own perspective root before the camera root) with the orbit and
      // marker overlay; otherwise the Sun is the directional billboard.
      if (definition.heliocentricView && !definition.sun) throw new TypeError("A heliocentric view requires its prepared Sun.");
      heliocentric = externalWorldContext || definition.heliocentricView == null || !definition.sun ? null : environment.mountHeliocentric({ host: stage,
        before: mounted.cameraElement, plan: definition.heliocentricView.plan, objectId: definition.id,
        sunImageUrl: context.density === 2 ? definition.sun.asset.url2x : definition.sun.asset.url,
        markerSprite: definition.heliocentricView.bodyMarker, systemMarkers: definition.heliocentricView.systemMarkers ?? null,
        labels: definition.heliocentricView.labels ?? null });
      if (heliocentric) context.own(() => heliocentric?.destroy());
      const directionalSun = externalWorldContext || definition.sun == null || heliocentric ? null : environment.mountSun({ host: stage, plan: definition.sun,
        imageDensity: context.density, objectId: definition.id, before: mounted.cameraElement });
      if (directionalSun) context.own(() => directionalSun.destroy());
      if (inputSurface?.nodeType !== 1) throw new Error("Shared object input surface is missing.");
      selection = environment.createSelection({ definition, presentation: mounted, residency: resources, lifetime,
        onCommit: next => {
          playback.setSelection(next);
          for (const layer of pageLayers.values()) { layer.setLens({ id: next.lensId }); layer.setPlaying(allowed && (next.speed ?? 1) !== 0); }
        }, onFatalError: fatal,
        onChange: state => publishSelection(state),
        onMaterialError: error => console.error(error) });
      context.own(() => selection?.destroy());
      orbit = environment.createOrbit({ stage, inputSurface, runtimePolicy, cameraElement: mounted.cameraElement, sceneElement: mounted.sceneElement,
        cubicSky, skyPlan: definition.sky, directionalSun, directionalSunPlan: definition.sun ?? null, heliocentric, worldContext: orbitWorldContext,
        cameraPlan, objectId: definition.id, requireSun: false,
        mobilePreviewElement, onPublish: publication => guarded(() => publish(publication)), onError: fatal });
      context.own(() => orbit?.destroy());
      if (latestWorldPublication !== null) publishWorldSnapshot(latestWorldPublication);
      if (lifetime.disposed) return;
      // Seed the incoming view before an asynchronous material selection can
      // paint. The shared world remains visible throughout a scene handoff.
      if (initialWorldCamera) {
        if (!worldFrame) throw new TypeError('An initial world camera needs a prepared frame.');
        orbit.applyWorldCamera(initialWorldCamera, worldFrame);
      }
      if (!preparedResources) resources.finishStartup();
      const initialized = await lifetime.wait(selection.start());
      if (lifetime.disposed || initialized.cancelled) return;
      if (!initialized.value) throw new Error("Initial object selection did not commit.");
      playback.setReady();
      await lifetime.wait(environment.waitPaint(lifetime, stage.ownerDocument.defaultView ?? window));
      if (lifetime.disposed) return;
      controls.setReady();
      readyPublished = true;
      if (diagnostics) publishObjectDiagnostics({ stage, definition, mounted, orbit, cubicSky, heliocentric, selection, controls, resources, playback, lifetime, context, initialSelection, startupDecodedAssets, pageLayers, getCurrentView: () => currentView });
      settled = true;
      resolveReady();
    }
  };
}

function physicalFallback(pose: import("../navigation/types.js").PhysicalCameraPose, distanceKilometers: number | undefined): import("../navigation/view-url.js").PhysicalSharedCamera {
  if (distanceKilometers === undefined) throw new TypeError("A physical camera requires its published distance.");
  return { pose, distanceKilometers };
}

export function stageWorldViewport(stage: HTMLElement, camera: HTMLElement | null, focalPixels: number,
  principalOffset: readonly number[]): WorldCameraViewport {
  if (!camera || typeof camera.getBoundingClientRect !== 'function') {
    return Object.freeze({ focalPixels, principalOffsetPixels: [principalOffset[0] ?? 0, principalOffset[1] ?? 0] as const });
  }
  const stageBounds = stage.getBoundingClientRect();
  const cameraBounds = camera.getBoundingClientRect();
  const cameraCenterX = cameraBounds.left - stageBounds.left + cameraBounds.width / 2;
  const cameraCenterY = cameraBounds.top - stageBounds.top + cameraBounds.height / 2;
  return Object.freeze({ focalPixels,
    principalOffsetPixels: [
      cameraCenterX - stageBounds.width / 2 + (principalOffset[0] ?? 0),
      cameraCenterY - stageBounds.height / 2 + (principalOffset[1] ?? 0),
    ] as const,
  });
}
