import { createRetainedGeometrySnapshot } from '../rendering/retained-leaf-pool.js';
import type { ObjectRuntimeDefinition, ObjectRuntimeView } from "./object-runtime-types.js";
import type { SurfaceFeatureLayerRuntime } from "../labels/surface-feature-types.js";
import type { ObjectSelection } from "./object-contract.js";
import type { SceneLifetime } from "@cssearth/engine";
import type { RetainedCubicSkyOrbit, OrbitStateUpdate } from "../navigation/object-orbit.js";
import type { createPreparedResidency } from "../rendering/prepared-residency.js";
import type { createPreparedPlayback } from "../rendering/prepared-playback.js";
import type { createObjectSelectionRuntime } from "../rendering/object-selection-runtime.js";
import type { createObjectControlBinding } from "../rendering/object-control-binding.js";
import type { mountPreparedPresentation } from "../rendering/prepared-presentation.js";
export interface ObjectDiagnosticsOptions {
  stage: HTMLElement; definition: ObjectRuntimeDefinition; mounted: ReturnType<typeof mountPreparedPresentation>;
  orbit: RetainedCubicSkyOrbit;
  selection: ReturnType<typeof createObjectSelectionRuntime>; controls: ReturnType<typeof createObjectControlBinding>;
  resources: ReturnType<typeof createPreparedResidency>; playback: ReturnType<typeof createPreparedPlayback>; lifetime: SceneLifetime;
  context: { density: number; own(cleanup: () => void): void }; initialSelection: ObjectSelection;
  startupDecodedAssets: number; surfaceFeatures?: SurfaceFeatureLayerRuntime | null; getCurrentView(): ObjectRuntimeView | null;
}

export type ObjectRuntimeDiagnostics = ReturnType<typeof publishObjectDiagnostics>;
const publishedDiagnostics = new WeakMap<Window, Map<string, ObjectRuntimeDiagnostics>>();

/** Read only diagnostics still owned by the currently published object mount. */
export function readObjectDiagnostics(target: Window, id: string): ObjectRuntimeDiagnostics | undefined {
  const diagnostics = publishedDiagnostics.get(target)?.get(id);
  return diagnostics && Reflect.get(target, `__${id}`) === diagnostics ? diagnostics : undefined;
}

export function publishObjectDiagnostics({ stage, definition, mounted, orbit, selection, controls, resources, playback, lifetime, context, initialSelection, startupDecodedAssets, surfaceFeatures = null, getCurrentView }: ObjectDiagnosticsOptions) {
      const target = stage.ownerDocument.defaultView, key = `__${definition.id}`;
      if (!target) throw new Error("Object diagnostics require the mounted window.");
      const nodes = Object.freeze([...stage.querySelectorAll("*")]);
      let geometry: ReturnType<typeof createRetainedGeometrySnapshot> | null = null;
      const observe = () => mounted.observe();
      const settings = (kind?: "toggle" | "cycle") => () => {
        const current = selection.state().committed ?? initialSelection;
        return Object.freeze(Object.fromEntries((definition.controls.settings?.controls ?? [])
          .filter(control => kind == null || control.kind === kind).map(control => [control.name, current[control.name]])));
      };
      const options = Object.freeze({ state: settings("cycle") });
      const features = Object.freeze({ state: settings("toggle") });
      const parents = Object.freeze(nodes.map(node => node.parentNode));
      const lensState = () => Object.freeze({ id: selection.state().committed?.lensId ?? initialSelection.lensId,
        ready: selection.state().ready });
      const selectLens = (id: string) => selection.dispatch({ kind: "lens", id });
      const diagnostics = Object.freeze({ ready: true,
        view: () => orbit.state(), setView: (state: OrbitStateUpdate) => orbit.setState(state), lens: lensState, selectLens,
        camera: Object.freeze({ state: orbit.state, setState: orbit.setState, flyToState: orbit.flyToState, stats: orbit.stats,
          publication: orbit.publicationState,
          captureWorldCamera: orbit.captureWorldCamera, applyWorldCamera: orbit.applyWorldCamera }),
        sky: Object.freeze({ state: () => Object.freeze({ ...orbit.skyState(),
          sunViewDirection: getCurrentView()?.sunViewDirection ?? null, skySunViewDirection: getCurrentView()?.skySunViewDirection ?? null }),
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
        runtime: Object.freeze({ geometry: () => (geometry ??= createRetainedGeometrySnapshot(nodes))(), lifetime: lifetime.stats, resources: resources.stats, playback: playback.stats,
          selection: selection.state, controls: controls.stats, view: getCurrentView,
          presentation: () => Object.freeze({ ...observe().presentation }),
          surfaceFeatures: () => surfaceFeatures?.stats() ?? null }),
        stableNodes: nodes,
        assertStableDomIdentity() {
          const current = [...stage.querySelectorAll("*")];
          if (current.length !== nodes.length || current.some((node, index) => node !== nodes[index] || node.parentNode !== parents[index])) throw new Error("Retained object DOM changed.");
          return true;
        },
        material: Object.freeze({ state: () => Object.freeze({ ...observe().materials }) }),
      });
      Reflect.set(target, key, diagnostics);
      let entries = publishedDiagnostics.get(target);
      if (!entries) { entries = new Map(); publishedDiagnostics.set(target, entries); }
      entries.set(definition.id, diagnostics);
      context.own(() => {
        if (Reflect.get(target, key) === diagnostics) Reflect.deleteProperty(target, key);
        const current = publishedDiagnostics.get(target);
        if (current?.get(definition.id) === diagnostics) current.delete(definition.id);
        if (current?.size === 0) publishedDiagnostics.delete(target);
      });
      return diagnostics;
    }
