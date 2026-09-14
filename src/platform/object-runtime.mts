/// <reference types="vite/client" />
import type { PreparedDestinationPlan } from "./prepared-destinations.mts";
import type { PreparedPagePlan } from "../renderers/css/paging/types.ts";
import type { PreparedPageLayer } from "./prepared-presentation.mts";
export type ObjectRuntimeDefinition = Omit<RendererObjectRuntimeDefinition, "destinations" | "pageLayers"> & {
  destinations?: PreparedDestinationPlan;
  pageLayers?: readonly (Omit<PreparedPageLayer, "plan"> & { plan: PreparedPagePlan })[];
};
export interface ObjectRuntimeView extends OrbitPublication { readonly reference: OrbitPublication; readonly previous: OrbitPublication | null; readonly revision: number; }
type PageLayerRuntime = ReturnType<typeof mountPreparedMapPages>;
import type { ObjectRuntimeDefinition as RendererObjectRuntimeDefinition, ObjectMountOptions } from "../renderers/css/runtime/object-runtime-types.ts";
import type { ObjectSelectionState } from "../renderers/css/rendering/object-selection-runtime.ts";
import type { OrbitPublication, RetainedCubicSkyOrbit } from "./object-orbit.mts";
import type { SharedView } from "./view-url.mts";
import type { ObjectWorldNavigation, ObjectWorldNavigationListener } from "../renderers/css/runtime/world-navigation-types.ts";
import type { WorldCameraPose, WorldCameraViewport } from "../renderers/css/navigation/world-camera.ts";
export type ObjectRuntimeServices = typeof nativeServices;
import { mountPreparedMapPages } from "./prepared-map/city-pages.mts";
import { createPreparedDestinations } from "./prepared-destinations.mts";
import { CANONICAL_PREPARED_IMAGE_DENSITY } from "../../site/runtime-policy.mts";
import { createSceneLifetime } from "@cssearth/engine";
import { waitForSceneDocument, waitForScenePaint } from "../renderers/css/dist/scene-native-waits.js";
import { createPreparedResidency } from "./prepared-residency.mts";
import { createObjectSelectionRuntime } from "./object-selection-runtime.mts";
import { createObjectControlBinding } from "./object-control-binding.mts";
import { createPreparedPlayback } from "./prepared-playback.mts";
import { createRetainedCubicSkyOrbit } from "./object-orbit.mts";
import { mountRetainedCubicSky } from "./cubic-sky-runtime.mts";
import { mountPreparedPresentation } from "./prepared-presentation.mts";
import { initialObjectSelection, requireObjectRuntimeDefinition } from "./object-runtime-contract.mts";
import { formatSharedView, parseSharedView } from "./view-url.mts";

const DEVELOPMENT_DIAGNOSTICS = import.meta.env?.DEV === true;
const nativeServices = Object.freeze({ createLifetime: createSceneLifetime, createResources: createPreparedResidency,
  createPlayback: createPreparedPlayback, createSelection: createObjectSelectionRuntime, createControls: createObjectControlBinding, createOrbit: createRetainedCubicSkyOrbit,
  mountPages: mountPreparedMapPages,
  mountSky: mountRetainedCubicSky,
  waitDocument: waitForSceneDocument, waitPaint: waitForScenePaint });

// Every registry loader binds this factory. The optional services argument is
// used only by native-boundary unit tests; object clients bind one definition.
export function createObjectRuntime(definition: ObjectRuntimeDefinition, services: Partial<ObjectRuntimeServices> = nativeServices) {
  requireObjectRuntimeDefinition(definition);
  const initialSelection = initialObjectSelection(definition.controls);
  const environment = { ...nativeServices, ...services };
  return function mountObject(stage: HTMLElement, { onError, onMotionRequest = () => {} }: Pick<ObjectMountOptions, "onError" | "onMotionRequest">) {
    if (stage?.dataset?.objectId !== definition.id) throw new TypeError("Object runtime identity does not match the registered stage.");
    if (stage?.nodeType !== 1 || !stage.ownerDocument || typeof onError !== "function" || typeof onMotionRequest !== "function") {
      throw new TypeError("Object mount requires the registered stage and error owner.");
    }
    const lifetime = environment.createLifetime();
    let readyPublished = false, settled = false, resolveReady: () => void, rejectReady: (error: unknown) => void;
    const ready = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
    ready.catch(() => {});
    let mounted: ReturnType<typeof mountPreparedPresentation> | null = null, orbit: RetainedCubicSkyOrbit | null = null, currentView: ObjectRuntimeView | null = null, reference: OrbitPublication | null = null, previousPublication: OrbitPublication | null = null;
    const pageLayers = new Map<string, PageLayerRuntime>();
    let allowed = false, navigatedLens: string | null = null, maximumZoom = definition.camera.maximumZoom;
    const cameraPlan = Object.freeze({ ...definition.camera, get maximumZoom() { return maximumZoom; } });
    let startupDecodedAssets = 0;
    let revision = 0, selection: ReturnType<typeof createObjectSelectionRuntime> | null = null, controls: ReturnType<typeof createObjectControlBinding> | null = null, diagnostics: Readonly<Record<string, unknown>> | null = null;
    const viewListeners = new Set<() => void>();
    const notifyView = () => { if (readyPublished) for (const listener of viewListeners) listener(); };
    lifetime.onDispose(() => viewListeners.clear());
    const playback = environment.createPlayback();
    lifetime.onDispose(() => playback.destroy());
    let resources: ReturnType<typeof createPreparedResidency>;
    try {
      resources = environment.createResources({ assets: definition.assets,
        onReady() { guarded(() => orbit?.invalidate()); },
        onWarmError(error: unknown) { if (!lifetime.disposed) console.error(error); },
        onCleanupError: fatal,
      });
    } catch (error) {
      const errors = lifetime.destroy();
      throw errors.length ? new AggregateError([error, ...errors], error instanceof Error ? error.message : String(error), { cause: error }) : error;
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
    const destinations = definition.destinations ? createPreparedDestinations({ plan: definition.destinations,
      ready, lifetime, selectLens: id => selection!.dispatch({ kind: "lens", id }),
      navigate: camera => { stopMotion(); alignMotionFrame(); return orbit!.flyToState(camera); },
      reset: () => orbit?.flyToState({ controlPitch: definition.camera.defaultControlPitchDegrees,
        controlYaw: definition.camera.defaultControlYawDegrees, zoom: orbit!.initialResponsiveZoom() }),
    }) : null;
    const preparedEpochJdTt: number | null = null;
    let restoreVersion = 0;
    const sharedView = Object.freeze({
      capture(motionRequested = false) {
        if (!readyPublished) return null;
        const camera = orbit!.state();
        return { camera: orbit!.sharedState?.() ?? { controlPitch: camera.controlPitch, controlYaw: camera.controlYaw,
          zoom: camera.zoom, pose: camera.pose,
          ...(camera.distanceKilometers === undefined ? {} : { distanceKilometers: camera.distanceKilometers }) }, preparedEpochJdTt,
          playback: { times: playback.captureMotion(), speed: playback.stats().speed, motionRequested } };
      },
      async restore(saved: SharedView) {
        // Validate the whole payload before any native animation or camera write.
        const view = parseSharedView(formatSharedView(saved));
        if (!view) throw new TypeError("Shared camera view is missing.");
        const version = ++restoreVersion;
        if (!readyPublished || lifetime.disposed) return false;
        if ((view.preparedEpochJdTt ?? null) !== preparedEpochJdTt) {
          throw new TypeError("This view uses a different prepared astronomical date.");
        }
        playback.validateMotion(view.playback.times);
        const speed = definition.controls!.settings?.controls!.find(control => control.name === "speed");
        if (view.playback.speed !== playback.stats().speed) {
          if (!speed || !(await selection!.dispatch({ kind: "cycle", name: "speed", value: view.playback.speed }))) {
            throw new TypeError("This view uses an unsupported playback speed.");
          }
        }
        if (lifetime.disposed || version !== restoreVersion) return false;
        playback.restoreMotion(view.playback.times);
        orbit!.setState(view.camera);
        return true;
      },
      subscribe(listener: () => void) { viewListeners.add(listener); return () => viewListeners.delete(listener); },
    });
    const controller = Object.freeze({ ready, sharedView, ...(destinations ? { destinations } : {}),
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

    function syncPagePlayback() {
      const running = allowed && (selection?.state().committed?.speed ?? initialSelection.speed ?? 1) !== 0;
      for (const layer of pageLayers.values()) layer.setPlaying(running);
    }
    function setAllowed(value: boolean) { allowed = value; playback.setAllowed(value); syncPagePlayback(); }
    function stopMotion() { onMotionRequest(false); setAllowed(false); }
    function alignMotionFrame() {
      const motionFrame = mounted?.motionFrame;
      if (!motionFrame?.length) return;
      const window = stage.ownerDocument.defaultView;
      if (!window) throw new Error("Motion framing requires a window.");
      const frame = () => motionFrame.reduce((matrix, element) => matrix.multiply(
        new window.DOMMatrix(window.getComputedStyle(element).transform)), new window.DOMMatrix());
      const before = frame();
      playback.resetMotion();
      orbit!.rebaseScene(before.multiply(frame().inverse()));
    }
    function publishSelection(state: Readonly<ObjectSelectionState>) {
      controls!.publish(state);
      if (state.committed && !state.pending) notifyView();
      if (!state.committed || state.pending || !orbit || state.committed.lensId === navigatedLens) return;
      navigatedLens = state.committed.lensId;
      const navigation = state.plan?.navigation;
      if (!navigation) return;
      maximumZoom = navigation.maximumZoom;
      if (navigation.camera) { stopMotion(); alignMotionFrame(); }
      orbit!.setState({ zoom: Math.min(orbit!.state().zoom, maximumZoom) });
      if (navigation.camera) orbit!.flyToState(navigation.camera);
    }
    function fatal(error: unknown) {
      if (lifetime.disposed) return;
      // Invalidate the session before any cleanup can trigger a native callback.
      const errors = lifetime.destroy();
      const failure = errors.length ? new AggregateError([error, ...errors], error instanceof Error ? error.message : String(error), { cause: error }) : error;
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
      notifyView();
    }
    async function start() {
      await lifetime.wait(environment.waitDocument(lifetime, stage.ownerDocument));
      if (lifetime.disposed) return;
      controls = environment.createControls({ stage, controls: definition.controls, initialSelection,
        getState: () => selection?.state() ?? { desired: initialSelection, committed: null, pending: true, plan: null, ready: false, loadingMaterial: false, error: null, viewRevision: null },
        onAction: action => selection?.dispatch(action) ?? false, onError: error => console.error(error) });
      context.own(() => controls!.destroy());
      const startup = await lifetime.wait(resources.prepareStartup());
      if (lifetime.disposed || startup.cancelled) return;
      startupDecodedAssets = resources.stats().decodes;
      mounted = mountPreparedPresentation(stage, context, definition);
      if (lifetime.disposed) return;
      for (const layer of mounted!.pageLayers ?? []) {
        // The mount echoes each layer's plan as opaque transport. The validated
        // page plan belongs to the definition this runtime already required.
        const plan = definition.pageLayers?.find(declared => declared.id === layer.id)?.plan;
        if (!plan) throw new TypeError(`Prepared page layer was not declared: ${layer.id}.`);
        const pages = environment.mountPages({ ...layer, plan, stage, scene: mounted!.sceneElement, camera: mounted!.cameraElement,
          own: context.own, onError: fatal });
        pageLayers.set(layer.id, pages);
        pages.setLens({ id: initialSelection.lensId });
      }
      syncPagePlayback();
      // Presentation owns its roots immediately during construction, including
      // partial construction failures. Shared celestial layers join afterwards.
      const cubicSky = environment.mountSky({ host: stage, plan: definition.sky, objectId: definition.id });
      context.own(() => cubicSky.destroy());
      for (const animation of stage.getAnimations({ subtree: true })) {
        const initialTime = animation.constructor?.name === "CSSAnimation" ? 0 : undefined;
        playback.register(animation, { initialTime });
      }
      const inputSurface = stage.ownerDocument.querySelector<HTMLElement>(".planet-input-surface");
      if (inputSurface?.nodeType !== 1) throw new Error("Shared object input surface is missing.");
      selection = environment.createSelection({ definition, presentation: mounted, residency: resources, lifetime,
        onCommit: next => {
          playback.setSelection(next);
          for (const layer of pageLayers.values()) { layer.setLens({ id: next.lensId }); layer.setPlaying(allowed && (next.speed ?? 1) !== 0); }
        }, onFatalError: fatal,
        onChange: state => publishSelection(state),
        onMaterialError: error => console.error(error) });
      context.own(() => selection!.destroy());
      orbit = environment.createOrbit({ stage, inputSurface, cameraElement: mounted!.cameraElement, sceneElement: mounted!.sceneElement,
        cubicSky, skyPlan: definition.sky, directionalSunPlan: definition.sun ?? null,
        cameraPlan, objectId: definition.id, requireSun: false,
        mobilePreviewElement: stage.ownerDocument.querySelector<HTMLElement>(".planet-sidebar"), onPublish: publication => guarded(() => publish(publication)), onError: fatal });
      context.own(() => orbit!.destroy());
      if (lifetime.disposed) return;
      resources.finishStartup();
      const initialized = await lifetime.wait(selection!.start());
      if (lifetime.disposed || initialized.cancelled) return;
      if (!initialized.value) throw new Error("Initial object selection did not commit.");
      playback.setReady();
      await lifetime.wait(environment.waitPaint(lifetime, stage.ownerDocument.defaultView!));
      if (lifetime.disposed) return;
      controls!.setReady();
      readyPublished = true;
      if (DEVELOPMENT_DIAGNOSTICS) publishDiagnostics();
      settled = true;
      resolveReady();
    }
    function publishDiagnostics() {
      const target = stage.ownerDocument.defaultView, key = `__${definition.id}`;
      if (!target) throw new Error("Object diagnostics require a window.");
      const nodes = Object.freeze([...stage.querySelectorAll("*")]);
      const observe = () => mounted!.observe();
      const settings = (kind?: string) => () => {
        const current = selection!.state().committed ?? initialSelection;
        return Object.freeze(Object.fromEntries((definition.controls!.settings?.controls ?? [])
          .filter(control => kind == null || control.kind === kind).map(control => [control.name, current[control.name]])));
      };
      const options = Object.freeze({ state: settings("cycle") });
      const features = Object.freeze({ state: settings("toggle") });
      const parents = Object.freeze(nodes.map(node => node.parentNode));
      const lensState = () => Object.freeze({ id: selection!.state().committed?.lensId ?? initialSelection.lensId,
        ready: selection!.state().ready });
      const selectLens = (id: string) => selection!.dispatch({ kind: "lens", id });
      diagnostics = Object.freeze({ ready: true,
        view: () => orbit!.state(), setView: (state: Parameters<RetainedCubicSkyOrbit["setState"]>[0]) => orbit!.setState(state), lens: lensState, selectLens,
        camera: Object.freeze({ state: orbit!.state, setState: orbit!.setState, flyToState: orbit!.flyToState, stats: orbit!.stats }),
        sky: Object.freeze({ state: () => Object.freeze({ ...orbit!.skyState(),
          sunViewDirection: currentView?.sunViewDirection ?? null, skySunViewDirection: currentView?.skySunViewDirection ?? null }),
          // The prepared registrations the sky and Sun ride, for tests that
          // project them independently.
          sceneRegistration: definition.sky.sceneRegistration ?? null,
          sunLocalDirection: definition.sun?.localDirection ?? null }),
        lenses: Object.freeze({ state: lensState, select: selectLens }),
        options, settings: Object.freeze({ state: settings() }), features,
        renderStats: Object.freeze({
          selectedPreparedDensity: context.density, visibleAssetsDecodedBeforeMount: startupDecodedAssets,
          textureStats: Object.freeze({
            selectedPreparedDensity: context.density,
            get retainedInteractiveImageCount() { return resources.stats().images.entries.filter(entry => entry.ready).length; },
            get pendingInteractiveImageCount() { return resources.stats().images.entries.filter(entry => !entry.ready).length; },
          }),
        }),
        dom: Object.freeze({ retainedInitialNodeCount: nodes.length,
          retainedLeafCount: stage.querySelectorAll("b, s, u").length,
          runtimeDomGrowth: false, runtimeDomGrowthPolicy: "none" }),
        runtime: Object.freeze({ lifetime: lifetime.stats, resources: resources.stats, playback: playback.stats,
          selection: selection!.state, controls: controls!.stats, view: () => currentView,
          presentation: () => Object.freeze({ ...observe().presentation }),
          pages: () => Object.freeze(Object.fromEntries([...pageLayers].map(([id, layer]) => [id, layer.stats()]))) }),
        stableNodes: nodes,
        assertStableDomIdentity() {
          const current = [...stage.querySelectorAll("*")];
          if (current.length !== nodes.length || current.some((node, index) => node !== nodes[index] || node.parentNode !== parents[index])) throw new Error("Retained object DOM changed.");
          return true;
        },
        material: Object.freeze({ state: () => Object.freeze({ ...observe().materials }) }),
      });
      Reflect.set(target, key, diagnostics);
      context.own(() => { if (Reflect.get(target, key) === diagnostics) Reflect.deleteProperty(target, key); });
    }
  };
}
