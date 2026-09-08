import type { ObjectRuntimeDefinition, ObjectRuntimeView, PageLayerRuntime } from "./object-runtime-types.js";
import type { ObjectSelection } from "./object-contract.js";
import type { SceneLifetime } from "@cssearth/engine";
import type { RetainedCubicSkyOrbit, OrbitStateUpdate } from "../navigation/object-orbit.js";
import type { RetainedCubicSky } from "../solar-system/cubic-sky-runtime.js";
import type { RetainedHeliocentricView } from "../solar-system/heliocentric-view-runtime.js";
import type { createPreparedResidency } from "../rendering/prepared-residency.js";
import type { createPreparedPlayback } from "../rendering/prepared-playback.js";
import type { createObjectSelectionRuntime } from "../rendering/object-selection-runtime.js";
import type { createObjectControlBinding } from "../rendering/object-control-binding.js";
import type { mountPreparedPresentation } from "../rendering/prepared-presentation.js";
interface ExplorationDiagnostics {
  lens(): {id: string | null; ready: boolean}; selectLens(id: string): Promise<boolean>;
  destinationStats(): unknown; destination(): unknown; destinationCatalog(): unknown;
  geographicLens(): unknown; geographicSurface(): unknown; geographicImages(): unknown;
}
export interface ObjectDiagnosticsOptions {
  exploration?: ExplorationDiagnostics;
  stage: HTMLElement; definition: ObjectRuntimeDefinition; mounted: ReturnType<typeof mountPreparedPresentation>;
  orbit: RetainedCubicSkyOrbit; cubicSky: RetainedCubicSky; heliocentric: RetainedHeliocentricView | null;
  selection: ReturnType<typeof createObjectSelectionRuntime>; controls: ReturnType<typeof createObjectControlBinding>;
  resources: ReturnType<typeof createPreparedResidency>; playback: ReturnType<typeof createPreparedPlayback>; lifetime: SceneLifetime;
  context: { density: number; own(cleanup: () => void): void }; initialSelection: ObjectSelection;
  startupDecodedAssets: number; pageLayers: ReadonlyMap<string, PageLayerRuntime>; getCurrentView(): ObjectRuntimeView | null;
}

export function publishObjectDiagnostics({ stage, definition, mounted, orbit, cubicSky, heliocentric, selection, controls, resources, playback, lifetime, context, initialSelection, startupDecodedAssets, pageLayers, getCurrentView, exploration }: ObjectDiagnosticsOptions) {
      const target = stage.ownerDocument.defaultView, key = `__${definition.id}`;
      if (!target) throw new Error("Object diagnostics require the mounted window.");
      const nodes = Object.freeze([...stage.querySelectorAll("*")]);
      const observe = () => mounted.observe();
      const settings = (kind?: "toggle" | "cycle") => () => {
        const current = selection.state().committed ?? initialSelection;
        return Object.freeze(Object.fromEntries((definition.controls.settings?.controls ?? [])
          .filter(control => kind == null || control.kind === kind).map(control => [control.name, current[control.name]])));
      };
      const options = Object.freeze({ state: settings("cycle") });
      const features = Object.freeze({ state: settings("toggle") });
      const parents = Object.freeze(nodes.map(node => node.parentNode));
      const defaultLens = () => Object.freeze({ id: selection.state().committed?.lensId ?? initialSelection.lensId,
        ready: selection.state().ready });
      const {lens: lensState = defaultLens, selectLens = (id: string) => selection.dispatch({kind: 'lens', id}),
        ...explorationStats} = exploration ?? {};
      const diagnostics = Object.freeze({ ready: true,
        view: () => orbit.state(), setView: (state: OrbitStateUpdate) => orbit.setState(state), lens: lensState, selectLens,
        camera: Object.freeze({ state: orbit.state, setState: orbit.setState, flyToState: orbit.flyToState, stats: orbit.stats,
          captureWorldCamera: orbit.captureWorldCamera, applyWorldCamera: orbit.applyWorldCamera,
          surfaceMetrics: orbit.surfaceMetrics }),
        // Session knobs (development diagnostics): the orbit trails' spans,
        // the caption policy and the catalogue stars' exposure; null restores
        // the prepared values, which stay what ships.
        ...(heliocentric === null ? {} : { orbitTrail: (spans: Parameters<RetainedHeliocentricView["setTrailSpans"]>[0]) => {
          const applied = heliocentric.setTrailSpans(spans);
          orbit.refresh();
          return Object.freeze({ spans: heliocentric.state().trailSpans, source: heliocentric.state().trailSpansSource, applied });
        },
        labelPolicy: (options: Parameters<RetainedHeliocentricView["setLabelPolicy"]>[0]) => { const applied = heliocentric.setLabelPolicy(options); orbit.refresh(); return applied; } }),
        ...(typeof cubicSky.setStarExposure !== "function" || cubicSky.starGroup == null ? {}
          : { starExposure: (options: Parameters<RetainedCubicSky["setStarExposure"]>[0]) => { const applied = cubicSky.setStarExposure(options); orbit.refresh(); return applied; } }),
        sky: Object.freeze({ state: () => Object.freeze({ ...orbit.skyState(),
          sunViewDirection: getCurrentView()?.sunViewDirection ?? null, skySunViewDirection: getCurrentView()?.skySunViewDirection ?? null,
          sunPresentation: getCurrentView()?.sunPresentation }),
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
        runtime: Object.freeze({ ...explorationStats, lifetime: lifetime.stats, resources: resources.stats, playback: playback.stats,
          selection: selection.state, controls: controls.stats, view: getCurrentView,
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
      return diagnostics;
    }
