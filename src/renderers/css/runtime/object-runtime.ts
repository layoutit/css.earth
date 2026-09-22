/// <reference types="vite/client" />
import type { ObjectRuntimeDefinition, ObjectMountOptions, ObjectRuntimeView } from "./object-runtime-types.js";
import type { ObjectSelectionState } from "../rendering/object-selection-runtime.js";
import type { OrbitPublication, RetainedCubicSkyOrbit } from "../navigation/object-orbit.js";
import type { SharedView } from "../navigation/view-url.js";
import type { ObjectWorldNavigation, ObjectWorldNavigationListener } from './world-navigation-types.js';
import type { WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import type { ObjectDatasets } from './deferred-object-mount.js';
import type { SurfaceFeatureLayerRuntime } from '../labels/surface-feature-types.js';
import { errorMessage } from "../navigation/types.js";
import { publishObjectDiagnostics } from "./object-diagnostics.js";
export type { ObjectRuntimeDefinition, ObjectMountOptions, ObjectRuntimeView } from "./object-runtime-types.js";
export type ObjectRuntimeServices = typeof nativeServices;

import { CANONICAL_PREPARED_IMAGE_DENSITY } from "../rendering/prepared-object-assets.js";
import { createSceneLifetime } from "@cssearth/engine";
import { waitForSceneDocument, waitForScenePaint } from "./scene-native-waits.js";
import { createPreparedResidency } from "../rendering/prepared-residency.js";
import { resolvePreparedAssetUrl } from "../rendering/prepared-asset-origin.js";
import { createObjectSelectionRuntime } from "../rendering/object-selection-runtime.js";
import { createObjectControlBinding } from "../rendering/object-control-binding.js";
import { createPreparedPlayback } from "../rendering/prepared-playback.js";
import { createRetainedCubicSkyOrbit } from "../navigation/object-orbit.js";
import { mountRetainedCubicSky } from "../solar-system/cubic-sky-runtime.js";
import { mountPreparedPresentation } from "../rendering/prepared-presentation.js";
import { savedWorldCamera } from '../navigation/saved-world-camera.js';
import { initialObjectSelection, requireObjectRuntimeDefinition, selectedLensVolume } from "./object-contract.js";
import { formatSharedView, parseSharedView } from "../navigation/view-url.js";
import { createWorldNavigationPublicationHub } from './world-navigation-publication.js';

const nativeServices = Object.freeze({ createLifetime: createSceneLifetime, createResources: createPreparedResidency,
  createPlayback: createPreparedPlayback, createSelection: createObjectSelectionRuntime, createControls: createObjectControlBinding, createOrbit: createRetainedCubicSkyOrbit,
  mountSky: mountRetainedCubicSky,
  waitDocument: waitForSceneDocument, waitPaint: waitForScenePaint });

// Every registry loader binds this factory. The optional services argument is
// used only by native-boundary unit tests; object clients bind one definition.
export function createObjectRuntime(definition: ObjectRuntimeDefinition, services: Partial<ObjectRuntimeServices> = {}) {
  requireObjectRuntimeDefinition(definition);
  if (!Array.isArray(definition.motion)) throw new TypeError('Object motion bindings must be prepared before mount.');
  const environment = { ...nativeServices, ...services };
  return function mountObject(stage: HTMLElement, { onError, onMotionRequest = () => {}, inputSurface, runtimePolicy, mobilePreviewElement = null, diagnostics = false, capabilities = {}, worldFrame, worldContext, framePresenter, viewport, preparedResources, preparedTree, initialWorldCamera, initialProjection, onNavigationReady, progressiveActivation = false, arrivingByFlight = false, deferTextureRefinement = false }: ObjectMountOptions) {
    if (stage?.dataset?.objectId !== definition.id) throw new TypeError("Object runtime identity does not match the registered stage.");
    if (stage?.nodeType !== 1 || !stage.ownerDocument || typeof onError !== "function" || typeof onMotionRequest !== "function") {
      throw new TypeError("Object mount requires the registered stage and error owner.");
    }
    const initialLens = stage.dataset.preparedDataset;
    if (stage.dataset.preparedView) {
      const saved = parseSharedView(`v=${stage.dataset.preparedView}`);
      if (!saved || !worldFrame) throw new TypeError('A prepared view requires its shared world frame.');
      initialWorldCamera ??= savedWorldCamera(saved, worldFrame, { focalPixels: 1, principalOffsetPixels: [0, 0] });
      delete stage.dataset.preparedView;
    }
    const initialSettings: Record<string, boolean | number> = {};
    for (const control of definition.controls.settings?.controls ?? []) {
      const input = [...stage.ownerDocument.querySelectorAll<HTMLInputElement>('.planet-settings input[form][name]')].find(input => input.name === control.name);
      if (input) initialSettings[control.name] = control.kind === 'toggle' ? input.checked : Number(input.value);
    }
    // Validate the server's transported selection even when the user has since
    // changed a native control. The current controls then own that newer intent.
    if (stage.dataset.preparedSettings) initialObjectSelection(definition.controls, initialLens, JSON.parse(stage.dataset.preparedSettings));
    const initialSelection = initialObjectSelection(definition.controls, initialLens, initialSettings);
    delete stage.dataset.preparedDataset;
    delete stage.dataset.preparedSettings;
    if (definition.destinations && !capabilities.createDestinations) throw new TypeError("Prepared destinations require an injected runtime capability.");
    if (definition.features && !capabilities.mountSurfaceFeatures) throw new TypeError("Prepared surface features require an injected runtime capability.");
    const lifetime = environment.createLifetime();
    let readyPublished = false, settled = false;
    let resolveReady!: () => void, rejectReady!: (error: unknown) => void, activated = false;
    const ready = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
    ready.catch(() => {});
    let mounted: ReturnType<typeof mountPreparedPresentation> | null = null, orbit: RetainedCubicSkyOrbit | null = null;
    let currentView: ObjectRuntimeView | null = null, reference: OrbitPublication | null = null, previousPublication: OrbitPublication | null = null;
    let surfaceFeatures: SurfaceFeatureLayerRuntime | null = null, featuresInFlight = arrivingByFlight;
    let allowed = false, navigatedLens: string | null = null, maximumZoom = definition.camera.maximumZoom;
    const cameraPlan = Object.freeze({ ...definition.camera, get maximumZoom() { return maximumZoom; } });
    let startupDecodedAssets = 0;
    let revision = 0, selection: ReturnType<typeof createObjectSelectionRuntime> | null = null, controls: ReturnType<typeof createObjectControlBinding> | null = null;
    const viewListeners = new Set<() => void>();
    const datasetListeners = new Set<(id: string) => void>();
    const datasetRequests = new Map<symbol, string>();
    const worldPublication = createWorldNavigationPublicationHub(fatal);
    let latestWorldPublication: OrbitPublication | null = null;
    const notifyView = () => { if (readyPublished) for (const listener of viewListeners) listener(); };
    lifetime.onDispose(() => { viewListeners.clear(); datasetListeners.clear(); datasetRequests.clear(); worldPublication.destroy(); });
    const playback = environment.createPlayback();
    lifetime.onDispose(() => playback.destroy());
    if (preparedTree) lifetime.onDispose(() => preparedTree.destroy());
    let resources: ReturnType<typeof createPreparedResidency>;
    try {
      const resourceOptions = { assets: definition.assets,
        onReady() { guarded(() => orbit?.invalidate()); },
        onWarmError(error: unknown) { if (!lifetime.disposed) console.error(error); },
        onCleanupError: fatal,
        ...(definition.assetOrigin ? { assetOrigin: definition.assetOrigin } : {}),
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
    const preparedEpochJdTt = worldFrame?.epochJdTt ?? null;
    let restoreVersion = 0;
    const sharedView = Object.freeze({
      capture(motionRequested = false): SharedView | null {
        if (!readyPublished) return null;
        const camera = getOrbit().sharedState();
        return { camera, preparedEpochJdTt,
          playback: { times: playback.captureMotion(), speed: playback.stats().speed, motionRequested } };
      },
      async restore(saved: SharedView) {
        // Validate the whole payload before any native animation or camera write.
        const view = parseSharedView(formatSharedView(saved));
        if (!view) throw new TypeError("A saved object view is required.");
        const version = ++restoreVersion;
        if (!readyPublished || lifetime.disposed) return false;
        if (view.preparedEpochJdTt !== preparedEpochJdTt) {
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
      apply(pose: Parameters<ObjectWorldNavigation['apply']>[0], options?: { signal: AbortSignal }) {
        if (lifetime.disposed) return options ? Promise.resolve(false) : undefined;
        setAllowed(false);
        if (options) return getOrbit().presentWorldCamera(pose, worldFrame, options.signal);
        getOrbit().applyWorldCamera(pose, worldFrame);
      },
      preparedFocus() { return getOrbit().preparedFocus(); },
      // Every prepared group is connected and painted once: an arriving flight
      // may resume before the remaining readiness bookkeeping settles.
      detailActivated() { return activated && !lifetime.disposed; },
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
          visibleRect: state.visibleRect ?? null,
          widthPixels: latestWorldPublication?.stageViewport?.widthPixels,
          heightPixels: latestWorldPublication?.stageViewport?.heightPixels,
          detailHandoffDiameterPixels: definition.camera.levelOfDetail.billboardFullDiscPixels,
          framingRadiusPixels: getOrbit().currentResponsiveZoom() / definition.camera.defaultZoom * definition.camera.logicalBodyDiameter / 2 };
      },
      subscribe(listener: ObjectWorldNavigationListener) {
        return worldPublication.subscribe(listener);
      },
    }) : undefined;
    const datasets: ObjectDatasets | undefined = definition.controls.lenses && definition.controls.lenses.controls.length ? Object.freeze({
      ids: Object.freeze(definition.controls.lenses.controls.map(item => item.id)),
      defaultId: definition.controls.lenses.defaultLens,
      volumes: Object.freeze(definition.controls.lenses.controls.flatMap(item => item.volume ? [item.volume] : [])),
      volumeOf: (id: string) => selectedLensVolume(definition.controls, id),
      current: () => lifetime.disposed ? null : selection?.state().committed?.lensId ?? null,
      async select(id: string, options: { signal?: AbortSignal } = {}) {
        if (!readyPublished || lifetime.disposed || options.signal?.aborted) return false;
        const token = Symbol();
        datasetRequests.set(token, id);
        try { return await getSelection().dispatch({ kind: 'lens', id }, options); }
        finally { datasetRequests.delete(token); }
      },
      subscribe(listener: (id: string) => void) {
        if (!lifetime.disposed) datasetListeners.add(listener);
        return () => { datasetListeners.delete(listener); };
      },
    }) : undefined;
    const features: import('../labels/surface-feature-types.js').SurfaceFeatureNavigationRuntime | undefined = definition.features ? Object.freeze({
      catalog: () => surfaceFeatures?.catalog() ?? null,
      loaded: () => ready.then(() => { if (!surfaceFeatures) throw new Error('Surface features are not mounted.'); return surfaceFeatures.loaded(); }),
      select: (id: string) => ready.then(() => surfaceFeatures?.select(id) ?? { completed: false }),
      selected: () => surfaceFeatures?.selected() ?? null,
      clear: () => surfaceFeatures?.clear(),
      setNavigationInFlight: (active: boolean, landed = true) => { featuresInFlight = active; surfaceFeatures?.setNavigationInFlight?.(active, landed); },
    }) : undefined;
    const controller = Object.freeze({ ready, sharedView, ...(datasets ? { datasets } : {}), ...(destinations ? { destinations } : {}), ...(features ? { features } : {}), ...(navigation ? { navigation } : {}),
      refineTextures() { if (!lifetime.disposed) guarded(() => selection?.refineTextures()); },
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
      surfaceFeatures?.setPlaying(running);
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
      if (readyPublished && navigatedLens !== null) for (const listener of datasetListeners) listener(navigatedLens);
      const navigation = state.plan?.navigation;
      if (!navigation) return;
      maximumZoom = navigation.maximumZoom;
      // A dataset URL changes the material while retaining the shared camera.
      // Manual controls may still use a prepared lens's framing action.
      if (navigatedLens !== null && [...datasetRequests.values()].includes(navigatedLens)) return;
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
      surfaceFeatures?.publish(currentView);
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
      const latestWorld = publication.worldCamera ?? orbit.captureWorldCamera(worldFrame);
      const latestWorldViewport = publication.stageViewport ?? stageWorldViewport(stage, mounted?.cameraElement ?? null,
        publication.focal, publication.principalOffset);
      worldPublication.publish(latestWorld, latestWorldViewport);
    }
    async function start() {
      await lifetime.wait(environment.waitDocument(lifetime, stage.ownerDocument));
      if (lifetime.disposed) return;
      controls = environment.createControls({ stage, controls: definition.controls, initialSelection,
        getState: () => selection?.state() ?? { desired: initialSelection, committed: null, pending: true, plan: null, loadingMaterial: false, ready: false, error: null, viewRevision: null },
        onAction: async action => {
          const before = selection?.state().committed?.lensId;
          const committed = await (selection?.dispatch(action) ?? false);
          // Re-selecting the committed lens is still an explicit valid choice,
          // including when it replaces an invalid dataset URL.
          if (committed && action.kind === 'lens' && action.id === before && !lifetime.disposed) {
            for (const listener of datasetListeners) listener(action.id);
          }
          return committed;
        }, onError: error => console.error(error) });
      context.own(() => controls?.destroy());
      // A claimed preflight bank already completed and released default startup.
      // Re-running it would pin obsolete lighting rows beside the incoming view.
      const startup = await lifetime.wait<boolean | void | null>(preparedResources ? preparedResources.ready : Promise.resolve(true));
      if (lifetime.disposed || startup.cancelled) return;
      // Resolve any new projection before attaching the detailed scene. The
      // application-owned snapshot normally survives the handoff unchanged.
      if (viewport && cameraPlan.projection) viewport.read(cameraPlan.projection.cssPerspective);
      mounted = mountPreparedPresentation(stage, context, definition, preparedTree, initialProjection, progressiveActivation);
      if (lifetime.disposed) return;
      syncPagePlayback();
      // Presentation owns its roots immediately during construction, including
      // partial construction failures. The application-owned universe draws the
      // visible sky and Sun; the object keeps only the sky orientation handles
      // its orbit publishes to, hidden beneath the stage.
      const cubicSky = environment.mountSky({ host: stage, plan: definition.sky, objectId: definition.id });
      context.own(() => cubicSky.destroy());
      const skyFade = stage.ownerDocument.createElement('div');
      skyFade.className = 'prepared-context-sky-fade';
      skyFade.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:0;opacity:0;visibility:hidden';
      if (cubicSky.root.parentNode === stage) stage.insertBefore(skyFade, cubicSky.root);
      else stage.appendChild(skyFade);
      skyFade.appendChild(cubicSky.root);
      context.own(() => skyFade.remove());
      if (inputSurface?.nodeType !== 1) throw new Error("Shared object input surface is missing.");
      selection = environment.createSelection({ definition, presentation: mounted, residency: resources, lifetime, deferTextureRefinement, initialLens, initialSettings,
        onCommit: next => {
          playback.setSelection(next);
          surfaceFeatures?.setLens({ id: next.lensId }); surfaceFeatures?.setPlaying(allowed && (next.speed ?? 1) !== 0);
        }, onFatalError: fatal,
        onChange: state => publishSelection(state),
        onMaterialError: error => console.error(error) });
      context.own(() => selection?.destroy());
      if (definition.features) {
        if (!capabilities.mountSurfaceFeatures || !mounted.featureTarget) throw new TypeError("Prepared surface features require an injected runtime capability.");
        const featureOrigin = definition.assetOrigin, featurePlan = definition.features;
        surfaceFeatures = capabilities.mountSurfaceFeatures({ host: stage, plan: featurePlan, objectId: definition.id, target: mounted.featureTarget,
          scene: mounted.sceneElement, zoomRange: () => ({ minimum: definition.camera.minimumZoom, maximum: cameraPlan.maximumZoom }),
          ...(navigation && worldFrame ? { navigation, flightLimits: () => ({ minimumDistanceM: (definition.camera.dolly?.minimumDistanceRadii ?? 1.2) * worldFrame.bodyRadiusM }),
            onFlight: () => { stopMotion(); } } : {}),
          ...(featureOrigin ? { transport: (url: string, init: { signal: AbortSignal }) =>
            fetch(resolvePreparedAssetUrl(url, featureOrigin, featurePlan.catalog.sha256), init) } : {}),
          lifetime, pickingHost: stage, inputSurface, onError: error => console.error(error) });
        context.own(() => surfaceFeatures?.destroy());
        if (featuresInFlight) surfaceFeatures.setNavigationInFlight?.(true);
        surfaceFeatures.setLens({ id: initialSelection.lensId });
      }
      orbit = environment.createOrbit({ stage, inputSurface, runtimePolicy, cameraElement: mounted.cameraElement, sceneElement: mounted.sceneElement,
        ...(mounted.revealGroups ? { revealGroups: mounted.revealGroups } : {}),
        // An undrawn mesh commits no textures; it stays hidden until it has them.
        canReveal: () => selection?.state().plan?.deferredTextures !== true,
        cubicSky, skyPlan: definition.sky, directionalSunPlan: definition.sun ?? null, worldContext,
        cameraPlan, viewport, framePresenter, objectId: definition.id, requireSun: false, preparedSurfaceHitTest: mounted.surfaceHitTest,
        mobilePreviewElement, onPublish: publication => guarded(() => publish(publication)), onError: fatal });
      context.own(() => orbit?.destroy());
      if (latestWorldPublication !== null) publishWorldSnapshot(latestWorldPublication);
      if (lifetime.disposed) return;
      // The selected presentation owns every decode. Its plan requires the
      // surface group exactly when the camera draws the mesh, and only warms it
      // while an opaque proxy stands for the body, so mounting a distant object
      // no longer decodes a full surface set for pixels no one sees.
      startupDecodedAssets = resources.stats().decodes;
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
      if (navigation) onNavigationReady?.(navigation);
      await lifetime.wait(mounted.activate());
      if (lifetime.disposed) return;
      activated = true;
      playback.setReady();
      await lifetime.wait(environment.waitPaint(lifetime, stage.ownerDocument.defaultView ?? window));
      if (lifetime.disposed) return;
      controls.setReady();
      readyPublished = true;
      if ((import.meta.env?.PROD !== true || import.meta.env?.MODE === 'performance') && diagnostics) publishObjectDiagnostics({ stage, definition, mounted, orbit, selection, controls, resources, playback, lifetime, context, initialSelection, startupDecodedAssets, surfaceFeatures, getCurrentView: () => currentView });
      settled = true;
      resolveReady();
      // First paint owns the small prepared bank. Refinement uses the same
      // selection transaction after visibility, including direct URL loads.
      if (definition.textureLevels && currentView) selection.setView(currentView);
    }
  };
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
