import { CANONICAL_PREPARED_IMAGE_DENSITY } from "../../site/runtime-policy.mjs";
import { createSceneLifetime, waitForSceneDocument, waitForScenePaint } from "./scene-lifetime.mjs";
import { createPreparedResidency } from "./prepared-residency.mjs";
import { createObjectSelectionRuntime } from "./object-selection-runtime.mjs";
import { createObjectControlBinding } from "./object-control-binding.mjs";
import { createPreparedPlayback } from "./prepared-playback.mjs";
import { createRetainedCubicSkyOrbit, mountRetainedCubicSky } from "./cubic-sky-runtime.mjs";
import { mountRetainedDirectionalSun } from "./directional-sun-runtime.mjs";
import { invokeRuntimeHook, requireObjectPresentation, requireObjectRuntimeDefinition } from "./object-runtime-contract.mjs";

const DEVELOPMENT_DIAGNOSTICS = import.meta.env?.DEV === true;
const nativeServices = Object.freeze({ createLifetime: createSceneLifetime, createResources: createPreparedResidency,
  createPlayback: createPreparedPlayback, createSelection: createObjectSelectionRuntime, createControls: createObjectControlBinding, createOrbit: createRetainedCubicSkyOrbit,
  mountSky: mountRetainedCubicSky, mountSun: mountRetainedDirectionalSun,
  waitDocument: waitForSceneDocument, waitPaint: waitForScenePaint });

// Every registry loader binds this factory. The optional services argument is
// used only by native-boundary unit tests; object clients bind one definition.
export function createObjectRuntime(definition, services = nativeServices) {
  requireObjectRuntimeDefinition(definition);
  const environment = { ...nativeServices, ...services };
  return function mountObject(stage, { onError } = {}) {
    if (stage?.dataset?.objectId !== definition.id) throw new TypeError("Object runtime identity does not match the registered stage.");
    requireObjectRuntimeDefinition(definition, { objectId: stage?.dataset?.objectId });
    if (stage?.nodeType !== 1 || !stage.ownerDocument || typeof onError !== "function") {
      throw new TypeError("Object mount requires the registered stage and error owner.");
    }
    const lifetime = environment.createLifetime();
    let readyPublished = false, settled = false, resolveReady, rejectReady;
    const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
    ready.catch(() => {});
    let mounted = null, orbit = null, currentView = null, reference = null, previousPublication = null;
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
    const controller = Object.freeze({ ready,
      pause() { if (!lifetime.disposed) guarded(() => playback.setAllowed(false)); },
      resume() { if (!lifetime.disposed) guarded(() => playback.setAllowed(true)); },
      destroy() {
        if (!settled) { settled = true; resolveReady(); }
        const errors = lifetime.destroy();
        if (errors.length) throw new AggregateError(errors, "Object cleanup failed.");
      },
    });
    start().catch(fatal);
    return controller;

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
    }
    async function start() {
      await lifetime.wait(environment.waitDocument(lifetime, stage.ownerDocument));
      if (lifetime.disposed) return;
      controls = environment.createControls({ stage, controls: definition.controls, initialSelection: definition.initialSelection,
        getState: () => selection?.state() ?? { desired: definition.initialSelection, committed: null, pending: true, plan: null },
        onAction: action => selection?.dispatch(action) ?? false, onError: error => console.error(error) });
      context.own(() => controls.destroy());
      const startup = await lifetime.wait(resources.prepareStartup());
      if (lifetime.disposed || startup.cancelled) return;
      startupDecodedAssets = resources.stats().decodes;
      mounted = requireObjectPresentation(invokeRuntimeHook(definition, "createPresentation", [stage, context]), { stage });
      if (lifetime.disposed) return;
      // Presentation owns its roots immediately during construction, including
      // partial construction failures. Shared celestial layers join afterwards.
      const cubicSky = environment.mountSky({ host: stage, plan: definition.sky,
        imageDensity: context.density, objectId: definition.id, requireSun: false });
      context.own(() => cubicSky.destroy());
      const directionalSun = definition.sun == null ? null : environment.mountSun({ host: stage, plan: definition.sun,
        imageDensity: context.density, objectId: definition.id, before: mounted.cameraElement });
      if (directionalSun) context.own(() => directionalSun.destroy());
      for (const native of mounted.nativeAnimations ?? []) {
        if (native.animation) playback.register(native.animation, native);
        else playback.register(native);
      }
      for (const animation of stage.getAnimations({ subtree: true })) {
        const initialTime = animation.constructor?.name === "CSSAnimation" ? 0 : undefined;
        playback.register(animation, { initialTime });
      }
      const inputSurface = definition.inputSelector == null ? stage : stage.ownerDocument.querySelector(definition.inputSelector);
      if (inputSurface?.nodeType !== 1) throw new Error("Declared object input surface is missing.");
      selection = environment.createSelection({ definition, presentation: mounted, residency: resources, lifetime,
        onCommit: next => playback.setSelection(next), onFatalError: fatal,
        onChange: state => controls.publish(state),
        onMaterialError: error => console.error(error) });
      context.own(() => selection.destroy());
      orbit = environment.createOrbit({ stage, inputSurface, cameraElement: mounted.cameraElement, sceneElement: mounted.sceneElement,
        cubicSky, skyPlan: definition.sky, directionalSun, directionalSunPlan: definition.sun ?? null,
        cameraPlan: definition.camera, objectId: definition.id, requireSun: false,
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
      if (DEVELOPMENT_DIAGNOSTICS) publishDiagnostics();
      settled = true;
      resolveReady();
    }
    function publishDiagnostics() {
      const target = stage.ownerDocument.defaultView, key = `__${definition.id}`;
      const nodes = Object.freeze([...stage.querySelectorAll("*")]);
      const observe = () => mounted.observe ? invokeRuntimeHook(mounted, "observe", []) : {};
      const facts = observe();
      const settings = kind => () => {
        const current = selection.state().committed ?? definition.initialSelection;
        return Object.freeze(Object.fromEntries(definition.controls.settings.controls
          .filter(control => kind == null || control.kind === kind).map(control => [control.name, current[control.name]])));
      };
      const options = Object.freeze({ state: settings("cycle") });
      const features = Object.freeze({ state: settings("toggle") });
      const parents = Object.freeze(nodes.map(node => node.parentNode));
      const lensState = () => Object.freeze({ id: selection.state().committed?.lensId ?? definition.initialSelection.lensId,
        ready: selection.state().ready });
      const selectLens = id => selection.dispatch({ kind: "lens", id });
      diagnostics = Object.freeze({ ready: true,
        view: () => orbit.state(), setView: state => orbit.setState(state), lens: lensState, selectLens,
        camera: Object.freeze({ state: orbit.state, setState: orbit.setState, stats: () => Object.freeze({ ...observe().camera, ...orbit.stats() }) }),
        sky: Object.freeze({ state: () => Object.freeze({ ...observe().sky, ...orbit.skyState(),
          sunViewDirection: currentView?.sunViewDirection ?? null, skySunViewDirection: currentView?.skySunViewDirection ?? null,
          sunPresentation: currentView?.sunPresentation }) }),
        lenses: Object.freeze({ state: lensState, select: selectLens }),
        options, settings: Object.freeze({ state: settings() }), features,
        renderStats: Object.freeze({ ...facts.renderStats,
          selectedPreparedDensity: context.density, visibleAssetsDecodedBeforeMount: startupDecodedAssets,
          textureStats: Object.freeze({ ...facts.renderStats?.textureStats,
            selectedPreparedDensity: context.density,
            get retainedInteractiveImageCount() { return resources.stats().images.entries.filter(entry => entry.ready).length; },
            get pendingInteractiveImageCount() { return resources.stats().images.entries.filter(entry => !entry.ready).length; },
          }),
        }),
        dom: Object.freeze({ ...facts.dom, retainedInitialNodeCount: nodes.length,
          retainedLeafCount: stage.querySelectorAll("b, s, u").length,
          retainedSkyboxFaceCount: stage.querySelectorAll(".planet-cubic-sky-face").length,
          runtimeDomGrowth: false, runtimeDomGrowthPolicy: "none" }),
        runtime: Object.freeze({ lifetime: lifetime.stats, resources: resources.stats, playback: playback.stats,
          selection: selection.state, controls: controls.stats, view: () => currentView }),
        stableNodes: nodes,
        assertStableDomIdentity() {
          const current = [...stage.querySelectorAll("*")];
          if (current.length !== nodes.length || current.some((node, index) => node !== nodes[index] || node.parentNode !== parents[index])) throw new Error("Retained object DOM changed.");
          return true;
        },
        material: Object.freeze({ state: () => Object.freeze({ ...observe().material }) }),
      });
      target[key] = diagnostics;
      context.own(() => { if (target[key] === diagnostics) delete target[key]; });
    }
  };
}
