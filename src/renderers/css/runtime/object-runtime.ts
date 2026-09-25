/// <reference types="vite/client" />
import type { ObjectRuntimeDefinition, ObjectMountOptions, ObjectRuntimeView } from "./object-runtime-types.js";
import type { ObjectSelectionState } from "../rendering/object-selection-runtime.js";
import type { OrbitPublication, RetainedCubicSkyOrbit } from "../navigation/object-orbit.js";
import type { SharedView } from "../navigation/view-url.js";
import type { ObjectWorldNavigation, ObjectWorldNavigationListener } from './world-navigation-types.js';
import type { WorldCameraPose } from '../navigation/world-camera.js';
import type { ObjectDatasets } from './object-scene.js';
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
import { mountPreparedPresentation } from "../rendering/prepared-presentation.js";
import { savedWorldCamera } from '../navigation/saved-world-camera.js';
import { initialObjectSelection, requireObjectRuntimeDefinition, selectedLensVolume } from "./object-contract.js";
import { formatSharedView, parseSharedView } from "../navigation/view-url.js";
import { createWorldNavigationPublicationHub } from './world-navigation-publication.js';

const nativeServices = Object.freeze({ createLifetime: createSceneLifetime, createResources: createPreparedResidency,
  createPlayback: createPreparedPlayback, createSelection: createObjectSelectionRuntime, createControls: createObjectControlBinding, createOrbit: createRetainedCubicSkyOrbit,
  waitDocument: waitForSceneDocument, waitPaint: waitForScenePaint });

// Every registry loader binds this factory. The optional services argument is
// used only by native-boundary unit tests; object clients bind one definition.
export function createObjectRuntime(definition: ObjectRuntimeDefinition, services: Partial<ObjectRuntimeServices> = {}) {
  requireObjectRuntimeDefinition(definition);
  if (!Array.isArray(definition.motion)) throw new TypeError('Object motion bindings must be prepared before mount.');
  const environment = { ...nativeServices, ...services };
  return function mountObject(stage: HTMLElement, { onError, onMotionRequest = () => {}, onFeatureSelect, datasetEffects, inputSurface, runtimePolicy, diagnostics = false, capabilities = {}, worldContext, cameraMotion, framePresenter, viewport, preparedResources, preparedTree, initialWorldCamera, initialProjection, onNavigationReady, progressiveActivation = false, arrivingByFlight = false, deferTextureRefinement = false }: ObjectMountOptions) {
    if (stage?.dataset?.objectId !== definition.id) throw new TypeError("Object runtime identity does not match the registered stage.");
    if (stage?.nodeType !== 1 || !stage.ownerDocument || typeof onError !== "function" || typeof onMotionRequest !== "function") {
      throw new TypeError("Object mount requires the registered stage and error owner.");
    }
    if (!worldContext || !viewport || !framePresenter || !cameraMotion) throw new TypeError('Object mount requires its shared world, viewport and frame presenter.');
    const worldFrame = worldContext.frame;
    const initialLens = stage.dataset.preparedDataset;
    if (stage.dataset.preparedView) {
      const saved = parseSharedView(`v=${stage.dataset.preparedView}`);
      if (!saved) throw new TypeError('A prepared view requires its shared world frame.');
      initialWorldCamera ??= savedWorldCamera(saved, worldFrame, { focalPixels: 1, principalOffsetPixels: [0, 0] });
      delete stage.dataset.preparedView;
    }
    const initialSettings: Record<string, boolean | number> = {};
    for (const control of definition.controls.settings?.controls ?? []) {
      const input = [...stage.ownerDocument.querySelectorAll<HTMLInputElement>('.object-settings input[form][name]')].find(input => input.name === control.name);
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
    // Startup mounts the prepared groups, activates them (connected and painted once), then publishes readiness after a paint.
    // `ready` settles once: resolved at readiness or by an earlier destroy, rejected by an earlier fatal error.
    let phase: 'mounting' | 'activated' | 'ready' = 'mounting';
    let resolveReady!: () => void, rejectReady!: (error: unknown) => void;
    const ready = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
    ready.catch(() => {});
    /** Camera, datasets and shared views answer only between readiness and disposal. */
    const live = () => phase === 'ready' && !lifetime.disposed;
    let mounted: ReturnType<typeof mountPreparedPresentation> | null = null, orbit: RetainedCubicSkyOrbit | null = null;
    let currentView: ObjectRuntimeView | null = null, reference: OrbitPublication | null = null, previousPublication: OrbitPublication | null = null;
    let surfaceFeatures: SurfaceFeatureLayerRuntime | null = null, featuresInFlight = arrivingByFlight;
    let allowed = false, navigatedLens: string | null = null, maximumZoom = definition.camera.maximumZoom;
    const cameraPlan = Object.freeze({ ...definition.camera, get maximumZoom() { return maximumZoom; } });
    let startupDecodedAssets = 0;
    let revision = 0, selection: ReturnType<typeof createObjectSelectionRuntime> | null = null, controls: ReturnType<typeof createObjectControlBinding> | null = null;
    const viewListeners = new Set<() => void>();
    const datasetListeners = new Set<(id: string) => void>();
    const worldPublication = createWorldNavigationPublicationHub(fatal);
    let latestWorldPublication: OrbitPublication | null = null;
    const notifyView = () => { if (phase === 'ready') for (const listener of viewListeners) listener(); };
    lifetime.onDispose(() => { viewListeners.clear(); datasetListeners.clear(); worldPublication.destroy(); });
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
      ready, lifetime,
      navigate: (camera, options) => { alignMotionFrame(); return getOrbit().flyToState(camera, { ...options, surfaceTarget: true }); },
      reset: options => getOrbit().flyToState({ controlPitch: definition.camera.defaultControlPitchDegrees,
        controlYaw: definition.camera.defaultControlYawDegrees, zoom: getOrbit().initialResponsiveZoom() }, options),
    }) : null;
    const preparedEpochJdTt = worldFrame.epochJdTt;
    let restoreVersion = 0;
    const sharedView = Object.freeze({
      capture(motionRequested = false): SharedView | null {
        if (phase !== 'ready') return null;
        const camera = getOrbit().sharedState();
        return { camera, preparedEpochJdTt,
          playback: { times: playback.captureMotion(), speed: playback.stats().speed, motionRequested } };
      },
      async restore(saved: SharedView) {
        // Validate the whole payload before any native animation or camera write.
        const view = parseSharedView(formatSharedView(saved));
        if (!view) throw new TypeError("A saved object view is required.");
        const version = ++restoreVersion;
        if (!live()) return false;
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
    const navigation: ObjectWorldNavigation = Object.freeze({ frame: worldFrame, motion: cameraMotion,
      ...(definition.camera.framingScale === undefined ? {} : { framingScale: definition.camera.framingScale }),
      setZoomOutCentering(enabled: boolean) { if (!lifetime.disposed) getOrbit().setZoomOutCentering(enabled); },
      capture() { return getOrbit().captureWorldCamera(worldFrame); },
      apply(pose: Parameters<ObjectWorldNavigation['apply']>[0], options?: { signal: AbortSignal }) {
        if (lifetime.disposed || options?.signal.aborted) return options ? Promise.resolve(false) : undefined;
        setAllowed(false);
        return getOrbit().applyWorldCamera(pose, worldFrame, options?.signal);
      },
      preparedFocus() { return getOrbit().preparedFocus(); },
      // Every prepared group is connected and painted once: an arriving flight
      // may resume before the remaining readiness bookkeeping settles.
      detailActivated() { return phase !== 'mounting' && !lifetime.disposed; },
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
        return { focalPixels: state.focal, principalOffsetPixels: [state.principalOffset[0], state.principalOffset[1]] as const,
          visibleRect: state.visibleRect ?? null,
          widthPixels: latestWorldPublication?.stageViewport.widthPixels,
          heightPixels: latestWorldPublication?.stageViewport.heightPixels,
          detailHandoffDiameterPixels: definition.camera.levelOfDetail.billboardFullDiscPixels,
          framingRadiusPixels: getOrbit().currentResponsiveZoom() / definition.camera.defaultZoom * definition.camera.logicalBodyDiameter / 2 };
      },
      subscribe(listener: ObjectWorldNavigationListener) {
        return worldPublication.subscribe(listener);
      },
    });
    const datasets: ObjectDatasets | undefined = definition.controls.lenses && definition.controls.lenses.controls.length ? Object.freeze({
      ids: Object.freeze(definition.controls.lenses.controls.map(item => item.id)),
      defaultId: definition.controls.lenses.defaultLens,
      volumes: Object.freeze(definition.controls.lenses.controls.flatMap(item => item.volume ? [item.volume] : [])),
      volumeOf: (id: string) => selectedLensVolume(definition.controls, id),
      current: () => lifetime.disposed ? null : selection?.state().committed?.lensId ?? null,
      async select(id: string, options: { signal?: AbortSignal } = {}) {
        if (!live() || options.signal?.aborted) return false;
        return getSelection().dispatch({ kind: 'lens', id }, { ...options, frameCamera: false });
      },
      subscribe(listener: (id: string) => void) {
        if (!lifetime.disposed) datasetListeners.add(listener);
        return () => { datasetListeners.delete(listener); };
      },
    }) : undefined;
    const features: import('../labels/surface-feature-types.js').SurfaceFeatureNavigationRuntime | undefined = definition.features ? Object.freeze<import('../labels/surface-feature-types.js').SurfaceFeatureNavigationRuntime>({
      catalog: () => surfaceFeatures?.catalog() ?? null,
      loaded: () => ready.then(() => { if (!surfaceFeatures) throw new Error('Surface features are not mounted.'); return surfaceFeatures.loaded(); }),
      lensIds: definition.features.lensIds,
      select: (id, options) => ready.then(() => surfaceFeatures?.select(id, options) ?? { completed: false }),
      selected: () => surfaceFeatures?.selected() ?? null,
      clear: () => surfaceFeatures?.clear(),
      setNavigationInFlight: (active: boolean, landed = true) => { featuresInFlight = active; surfaceFeatures?.setNavigationInFlight?.(active, landed); },
    }) : undefined;
    const controller = Object.freeze({ ready, sharedView, ...(destinations ? { destinations } : {}), ...(features ? { features } : {}),
      // Only the native owner knows when these capabilities can use its camera and selection.
      get navigation() { return live() ? navigation : undefined; },
      get datasets() { return live() ? datasets : undefined; },
      refineTextures() { if (!lifetime.disposed) guarded(() => selection?.refineTextures()); },
      refinesWithoutInput: definition.textureLevels !== undefined,
      pause() { if (!lifetime.disposed) guarded(() => setAllowed(false)); },
      resume() { if (!lifetime.disposed) guarded(() => setAllowed(true)); },
      destroy() {
        resolveReady();
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
    /** Surface labels follow the scene while playback is allowed at a moving speed. */
    function syncPagePlayback(speed = selection?.state().committed?.speed ?? initialSelection.speed) {
      surfaceFeatures?.setPlaying(allowed && (speed ?? 1) !== 0);
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
      if (phase === 'ready' && navigatedLens !== null) for (const listener of datasetListeners) listener(navigatedLens);
      const navigation = state.plan?.navigation;
      if (!navigation) return;
      maximumZoom = navigation.maximumZoom;
      // Camera intent belongs to the committed request, not concurrent dataset IDs. A handoff or saved view supplies
      // the startup camera: committing its initial lens must not replace that camera or cancel the shared flight.
      const intent = state.committedBy;
      if (!intent?.frameCamera || (intent.kind === 'initial' && initialWorldCamera)) return;
      if (navigation.camera) { stopMotion(); alignMotionFrame(); }
      orbit.setState({ zoom: Math.min(orbit.state().zoom, maximumZoom) });
      if (navigation.camera) orbit.flyToState(navigation.camera, { surfaceTarget: true });
    }
    function fatal(error: unknown) {
      if (lifetime.disposed) return;
      // Invalidate the session before any cleanup can trigger a native callback.
      const errors = lifetime.destroy();
      const failure = errors.length ? new AggregateError([error, ...errors], errorMessage(error), { cause: error }) : error;
      // Before readiness the failure rejects `ready`; after it, the owner hears it. (A destroyed mount returned above.)
      if (phase === 'ready') onError(failure); else rejectReady(failure);
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
      latestWorldPublication = publication;
      publishWorldSnapshot(publication);
      notifyView();
    }
    function publishWorldSnapshot(publication: OrbitPublication) {
      if (orbit === null) return;
      worldPublication.publish(publication.worldCamera, publication.stageViewport);
    }
    async function start() {
      await lifetime.wait(environment.waitDocument(lifetime, stage.ownerDocument));
      if (lifetime.disposed) return;
      controls = environment.createControls({ stage, controls: definition.controls, initialSelection,
        getState: () => selection?.state() ?? { desired: initialSelection, committed: null, committedBy: null, pending: true, plan: null, loadingMaterial: false, ready: false, error: null, viewRevision: null },
        onAction: async action => {
          const before = selection?.state().committed?.lensId;
          const committed = await (selection?.dispatch(action) ?? false);
          // Re-selecting the committed lens is still an explicit valid choice,
          // including when it replaces an invalid dataset URL.
          if (committed && action.kind === 'lens' && action.id === before && !lifetime.disposed) {
            for (const listener of datasetListeners) listener(action.id);
          }
          return committed;
        }, onError: error => datasetEffects ? datasetEffects.error(error) : console.error(error) });
      context.own(() => controls?.destroy());
      // A claimed preflight bank already completed and released default startup.
      // Re-running it would pin obsolete lighting rows beside the incoming view.
      const startup = await lifetime.wait<boolean | void | null>(preparedResources ? preparedResources.ready : Promise.resolve(true));
      if (lifetime.disposed || startup.cancelled) return;
      // Resolve any new projection before attaching the detailed scene. The
      // application-owned snapshot normally survives the handoff unchanged.
      viewport.read(cameraPlan.projection.cssPerspective);
      mounted = mountPreparedPresentation(stage, context, definition, preparedTree, initialProjection, progressiveActivation);
      if (lifetime.disposed) return;
      syncPagePlayback();
      if (inputSurface?.nodeType !== 1) throw new Error("Shared object input surface is missing.");
      selection = environment.createSelection({ definition, presentation: mounted, residency: resources, lifetime, deferTextureRefinement, initialLens, initialSettings,
        prepareSelection: datasetEffects && ((next, signal) => datasetEffects.prepare(selectedLensVolume(definition.controls, next.lensId), signal)),
        onCommit: (next, _plan, intent) => {
          if (intent.kind === 'selection') datasetEffects?.commit(selectedLensVolume(definition.controls, next.lensId));
          playback.setSelection(next);
          surfaceFeatures?.setLens({ id: next.lensId }); syncPagePlayback(next.speed ?? 1);
        }, onFatalError: fatal,
        onChange: state => publishSelection(state),
        onMaterialError: error => console.error(error) });
      context.own(() => selection?.destroy());
      if (definition.features) {
        if (!capabilities.mountSurfaceFeatures || !mounted.featureTarget) throw new TypeError("Prepared surface features require an injected runtime capability.");
        const featureOrigin = definition.assetOrigin, featurePlan = definition.features;
        surfaceFeatures = capabilities.mountSurfaceFeatures({ host: stage, plan: featurePlan, objectId: definition.id, target: mounted.featureTarget,
          scene: mounted.sceneElement, zoomRange: () => ({ minimum: definition.camera.minimumZoom, maximum: cameraPlan.maximumZoom }),
          navigation, flightLimits: () => ({ minimumDistanceM: definition.camera.dolly.minimumDistanceRadii * worldFrame.bodyRadiusM }),
          onSelect: onFeatureSelect, onFlight: () => { stopMotion(); },
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
         directionalSunPlan: definition.sun ?? null, worldContext,
        cameraPlan, viewport, cameraMotion, framePresenter, objectId: definition.id, preparedSurfaceHitTest: mounted.surfaceHitTest,
        onPublish: publication => guarded(() => publish(publication)), onError: fatal });
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
        void orbit.applyWorldCamera(initialWorldCamera, worldFrame, cameraMotion.signal);
      }
      if (!preparedResources) resources.finishStartup();
      const initialized = await lifetime.wait(selection.start());
      if (lifetime.disposed || initialized.cancelled) return;
      if (!initialized.value) throw new Error("Initial object selection did not commit.");
      if (navigation) onNavigationReady?.(navigation);
      await lifetime.wait(mounted.activate());
      if (lifetime.disposed) return;
      phase = 'activated';
      playback.setReady();
      await lifetime.wait(environment.waitPaint(lifetime, stage.ownerDocument.defaultView ?? window));
      if (lifetime.disposed) return;
      controls.setReady();
      phase = 'ready';
      if ((import.meta.env?.PROD !== true || import.meta.env?.MODE === 'performance') && diagnostics) publishObjectDiagnostics({ stage, definition, mounted, orbit, selection, controls, resources, playback, lifetime, context, initialSelection, startupDecodedAssets, surfaceFeatures, getCurrentView: () => currentView });
      resolveReady();
      // First paint owns the small prepared bank. Refinement uses the same
      // selection transaction after visibility, including direct URL loads.
      // A body with texture levels refines without waiting for input: to its fixed level, or to the level its projected
      // silhouette needs, which zoom then keeps choosing. With deferred refinement the application starts it
      // (`refinesWithoutInput`), once what it loads after the body has arrived.
      if (definition.textureLevels && !deferTextureRefinement) selection.refineTextures();
    }
  };
}
