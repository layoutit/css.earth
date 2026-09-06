import { mountPreparedMapPages } from "./prepared-map/city-pages.mjs";
import { createPreparedDestinations } from "./prepared-destinations.mjs";
import { CANONICAL_PREPARED_IMAGE_DENSITY } from "../../site/runtime-policy.mjs";
import { createSceneLifetime, waitForSceneDocument, waitForScenePaint } from "./scene-lifetime.mjs";
import { createPreparedResidency } from "./prepared-residency.mjs";
import { createObjectSelectionRuntime } from "./object-selection-runtime.mjs";
import { createObjectControlBinding } from "./object-control-binding.mjs";
import { createPreparedPlayback } from "./prepared-playback.mjs";
import { createRetainedCubicSkyOrbit } from "./object-orbit.mjs";
import { mountRetainedCubicSky } from "./cubic-sky-runtime.mjs";
import { mountRetainedDirectionalSun } from "./directional-sun-runtime.mjs";
import { mountRetainedHeliocentricView } from "./heliocentric-view-runtime.mjs";
import { mountPreparedPresentation } from "./prepared-presentation.mjs";
import { initialObjectSelection, requireObjectRuntimeDefinition } from "./object-runtime-contract.mjs";

const DEVELOPMENT_DIAGNOSTICS = import.meta.env?.DEV === true;
const nativeServices = Object.freeze({ createLifetime: createSceneLifetime, createResources: createPreparedResidency,
  createPlayback: createPreparedPlayback, createSelection: createObjectSelectionRuntime, createControls: createObjectControlBinding, createOrbit: createRetainedCubicSkyOrbit,
  mountPages: mountPreparedMapPages,
  mountSky: mountRetainedCubicSky, mountSun: mountRetainedDirectionalSun, mountHeliocentric: mountRetainedHeliocentricView,
  waitDocument: waitForSceneDocument, waitPaint: waitForScenePaint });

// Every registry loader binds this factory. The optional services argument is
// used only by native-boundary unit tests; object clients bind one definition.
export function createObjectRuntime(definition, services = nativeServices) {
  requireObjectRuntimeDefinition(definition);
  const initialSelection = initialObjectSelection(definition.controls);
  const environment = { ...nativeServices, ...services };
  return function mountObject(stage, { onError, onMotionRequest = () => {} } = {}) {
    if (stage?.dataset?.objectId !== definition.id) throw new TypeError("Object runtime identity does not match the registered stage.");
    if (stage?.nodeType !== 1 || !stage.ownerDocument || typeof onError !== "function" || typeof onMotionRequest !== "function") {
      throw new TypeError("Object mount requires the registered stage and error owner.");
    }
    const lifetime = environment.createLifetime();
    let readyPublished = false, settled = false, resolveReady, rejectReady;
    const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
    ready.catch(() => {});
    let mounted = null, orbit = null, currentView = null, reference = null, previousPublication = null, heliocentric = null;
    const pageLayers = new Map();
    let allowed = false, navigatedLens = null, maximumZoom = definition.camera.maximumZoom;
    const cameraPlan = Object.freeze({ ...definition.camera, get maximumZoom() { return maximumZoom; } });
    let startupDecodedAssets = 0;
    let revision = 0, selection = null, controls = null, diagnostics = null;
    const playback = environment.createPlayback();
    lifetime.onDispose(() => playback.destroy());
    let resources;
    try {
      resources = environment.createResources({ assets: definition.assets,
        onReady() { guarded(() => orbit?.invalidate()); },
        onWarmError(error) { if (!lifetime.disposed) console.error(error); },
        onCleanupError: fatal,
      });
    } catch (error) {
      const errors = lifetime.destroy();
      throw errors.length ? new AggregateError([error, ...errors], error.message, { cause: error }) : error;
    }
    lifetime.onDispose(() => resources.destroy());
    const context = Object.freeze({
      density: CANONICAL_PREPARED_IMAGE_DENSITY,
      resources: resources.resources,
      own(disposer) {
        const errors = lifetime.onDispose(disposer);
        if (errors.length) throw new AggregateError(errors, "Late presentation cleanup failed.");
      },
      registerAnimation: playback.register,
      seekAnimation: playback.seek,
    });
    const destinations = definition.destinations ? createPreparedDestinations({ plan: definition.destinations,
      ready, lifetime, selectLens: id => selection.dispatch({ kind: "lens", id }),
      navigate: camera => { stopMotion(); alignMotionFrame(); return orbit.flyToState(camera); },
      reset: () => orbit?.flyToState({ controlPitch: definition.camera.defaultControlPitchDegrees,
        controlYaw: definition.camera.defaultControlYawDegrees, zoom: orbit.initialResponsiveZoom() }),
    }) : null;
    const controller = Object.freeze({ ready, ...(destinations ? { destinations } : {}),
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
    function setAllowed(value) { allowed = value; playback.setAllowed(value); syncPagePlayback(); }
    function stopMotion() { onMotionRequest(false); setAllowed(false); }
    function alignMotionFrame() {
      if (!mounted.motionFrame?.length) return;
      const window = stage.ownerDocument.defaultView;
      const frame = () => mounted.motionFrame.reduce((matrix, element) => matrix.multiply(
        new window.DOMMatrix(window.getComputedStyle(element).transform)), new window.DOMMatrix());
      const before = frame();
      playback.resetMotion();
      orbit.rebaseScene(before.multiply(frame().inverse()));
    }
    function publishSelection(state) {
      controls.publish(state);
      if (!state.committed || state.pending || !orbit || state.committed.lensId === navigatedLens) return;
      navigatedLens = state.committed.lensId;
      const navigation = state.plan?.navigation;
      if (!navigation) return;
      maximumZoom = navigation.maximumZoom;
      if (navigation.camera) { stopMotion(); alignMotionFrame(); }
      orbit.setState({ zoom: Math.min(orbit.state().zoom, maximumZoom) });
      if (navigation.camera) orbit.flyToState(navigation.camera);
    }
    function fatal(error) {
      if (lifetime.disposed) return;
      // Invalidate the session before any cleanup can trigger a native callback.
      const errors = lifetime.destroy();
      const failure = errors.length ? new AggregateError([error, ...errors], error.message, { cause: error }) : error;
      if (!settled) { settled = true; rejectReady(failure); }
      else if (readyPublished) onError(failure);
    }
    function guarded(callback) {
      if (lifetime.disposed) return;
      try { return callback(); } catch (error) { fatal(error); }
    }
    function publish(publication) {
      if (lifetime.disposed) return;
      reference ??= publication;
      currentView = Object.freeze({ ...publication, reference, previous: previousPublication, revision: ++revision });
      previousPublication = publication;
      selection?.setView(currentView);
      for (const layer of pageLayers.values()) layer.publish(currentView);
    }
    async function start() {
      await lifetime.wait(environment.waitDocument(lifetime, stage.ownerDocument));
      if (lifetime.disposed) return;
      controls = environment.createControls({ stage, controls: definition.controls, initialSelection,
        getState: () => selection?.state() ?? { desired: initialSelection, committed: null, pending: true, plan: null },
        onAction: action => selection?.dispatch(action) ?? false, onError: error => console.error(error) });
      context.own(() => controls.destroy());
      const startup = await lifetime.wait(resources.prepareStartup());
      if (lifetime.disposed || startup.cancelled) return;
      startupDecodedAssets = resources.stats().decodes;
      mounted = mountPreparedPresentation(stage, context, definition);
      if (lifetime.disposed) return;
      for (const layer of mounted.pageLayers ?? []) {
        const pages = environment.mountPages({ ...layer, stage, scene: mounted.sceneElement, camera: mounted.cameraElement,
          own: context.own, onError: fatal });
        pageLayers.set(layer.id, pages);
        pages.setLens({ id: initialSelection.lensId });
      }
      syncPagePlayback();
      // Presentation owns its roots immediately during construction, including
      // partial construction failures. Shared celestial layers join afterwards.
      const cubicSky = environment.mountSky({ host: stage, plan: definition.sky,
        imageDensity: context.density, objectId: definition.id, requireSun: false });
      context.own(() => cubicSky.destroy());
      // A heliocentric view renders the Sun as real geometry beneath the body
      // (its own perspective root before the camera root) with the orbit and
      // marker overlay; otherwise the Sun is the directional billboard.
      heliocentric = definition.heliocentricView == null ? null : environment.mountHeliocentric({ host: stage,
        before: mounted.cameraElement, plan: definition.heliocentricView.plan, objectId: definition.id,
        sunImageUrl: context.density === 2 ? definition.sun.asset.url2x : definition.sun.asset.url,
        markerSprite: definition.heliocentricView.bodyMarker, systemMarkers: definition.heliocentricView.systemMarkers ?? null,
        labels: definition.heliocentricView.labels ?? null });
      if (heliocentric) context.own(() => heliocentric.destroy());
      const directionalSun = definition.sun == null || heliocentric ? null : environment.mountSun({ host: stage, plan: definition.sun,
        imageDensity: context.density, objectId: definition.id, before: mounted.cameraElement });
      if (directionalSun) context.own(() => directionalSun.destroy());
      for (const animation of stage.getAnimations({ subtree: true })) {
        const initialTime = animation.constructor?.name === "CSSAnimation" ? 0 : undefined;
        playback.register(animation, { initialTime });
      }
      const inputSurface = stage.ownerDocument.querySelector(".planet-input-surface");
      if (inputSurface?.nodeType !== 1) throw new Error("Shared object input surface is missing.");
      selection = environment.createSelection({ definition, presentation: mounted, residency: resources, lifetime,
        onCommit: next => {
          playback.setSelection(next);
          for (const layer of pageLayers.values()) { layer.setLens({ id: next.lensId }); layer.setPlaying(allowed && (next.speed ?? 1) !== 0); }
        }, onFatalError: fatal,
        onChange: state => publishSelection(state),
        onMaterialError: error => console.error(error) });
      context.own(() => selection.destroy());
      orbit = environment.createOrbit({ stage, inputSurface, cameraElement: mounted.cameraElement, sceneElement: mounted.sceneElement,
        cubicSky, skyPlan: definition.sky, directionalSun, directionalSunPlan: definition.sun ?? null, heliocentric,
        cameraPlan, objectId: definition.id, requireSun: false,
        mobilePreviewElement: stage.ownerDocument.querySelector(".planet-sidebar"), onPublish: publication => guarded(() => publish(publication)), onError: fatal });
      context.own(() => orbit.destroy());
      if (lifetime.disposed) return;
      resources.finishStartup();
      const initialized = await lifetime.wait(selection.start());
      if (lifetime.disposed || initialized.cancelled) return;
      if (!initialized.value) throw new Error("Initial object selection did not commit.");
      playback.setReady();
      await lifetime.wait(environment.waitPaint(lifetime, stage.ownerDocument.defaultView));
      if (lifetime.disposed) return;
      controls.setReady();
      readyPublished = true;
      if (DEVELOPMENT_DIAGNOSTICS) publishDiagnostics(cubicSky);
      settled = true;
      resolveReady();
    }
    function publishDiagnostics(cubicSky) {
      const target = stage.ownerDocument.defaultView, key = `__${definition.id}`;
      const nodes = Object.freeze([...stage.querySelectorAll("*")]);
      const observe = () => mounted.observe();
      const settings = kind => () => {
        const current = selection.state().committed ?? initialSelection;
        return Object.freeze(Object.fromEntries(definition.controls.settings.controls
          .filter(control => kind == null || control.kind === kind).map(control => [control.name, current[control.name]])));
      };
      const options = Object.freeze({ state: settings("cycle") });
      const features = Object.freeze({ state: settings("toggle") });
      const parents = Object.freeze(nodes.map(node => node.parentNode));
      const lensState = () => Object.freeze({ id: selection.state().committed?.lensId ?? initialSelection.lensId,
        ready: selection.state().ready });
      const selectLens = id => selection.dispatch({ kind: "lens", id });
      diagnostics = Object.freeze({ ready: true,
        view: () => orbit.state(), setView: state => orbit.setState(state), lens: lensState, selectLens,
        camera: Object.freeze({ state: orbit.state, setState: orbit.setState, flyToState: orbit.flyToState, stats: orbit.stats }),
        // Session knobs (development diagnostics): the orbit trails' spans,
        // the caption policy and the catalogue stars' exposure; null restores
        // the prepared values, which stay what ships.
        ...(heliocentric === null ? {} : { orbitTrail: spans => {
          const applied = heliocentric.setTrailSpans(spans);
          orbit.refresh();
          return Object.freeze({ spans: heliocentric.state().trailSpans, source: heliocentric.state().trailSpansSource, applied });
        },
        labelPolicy: options => { const applied = heliocentric.setLabelPolicy(options); orbit.refresh(); return applied; } }),
        ...(typeof cubicSky.setStarExposure !== "function" || cubicSky.starGroup == null ? {}
          : { starExposure: options => cubicSky.setStarExposure(options) }),
        sky: Object.freeze({ state: () => Object.freeze({ ...orbit.skyState(),
          sunViewDirection: currentView?.sunViewDirection ?? null, skySunViewDirection: currentView?.skySunViewDirection ?? null,
          sunPresentation: currentView?.sunPresentation }),
          // The prepared registrations the sky and Sun ride, for tests that
          // project them independently.
          sceneRegistration: definition.sky.sceneRegistration ?? null,
          sunLocalDirection: definition.sun?.localDirection ?? null,
          heliocentricView: definition.heliocentricView?.plan ?? null }),
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
          retainedSkyboxFaceCount: stage.querySelectorAll(".planet-cubic-sky-face").length,
          retainedSunBillboardCount: definition.sun == null ? 0 : 1,
          retainedOrbitPieceCount: heliocentric?.retainedOrbitPieceCount ?? 0,
          retainedBodyMarkerCount: heliocentric === null ? 0 : 1,
          retainedSystemOrbitPieceCount: heliocentric?.retainedSystemOrbitPieceCount ?? 0,
          retainedSystemMarkerCount: heliocentric?.retainedSystemMarkerCount ?? 0,
          retainedSunMarkerCount: heliocentric?.retainedSunMarkerCount ?? 0,
          retainedCaptionCount: heliocentric?.retainedCaptionCount ?? 0,
          runtimeDomGrowth: false, runtimeDomGrowthPolicy: "none" }),
        runtime: Object.freeze({ lifetime: lifetime.stats, resources: resources.stats, playback: playback.stats,
          selection: selection.state, controls: controls.stats, view: () => currentView,
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
      target[key] = diagnostics;
      context.own(() => { if (target[key] === diagnostics) delete target[key]; });
    }
  };
}
