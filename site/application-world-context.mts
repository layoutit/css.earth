import { createSceneLifetime } from '@cssearth/engine';
import { labelOcclusionFor } from '../src/renderers/css/dist/index.js';
import { prepareObjectResources, createRetainedGeometrySnapshot } from '../src/renderers/css/dist/universe.js';
import { createCameraViewport } from '../src/renderers/css/dist/navigation.js';
import type { PreparedWorldCameraFrame } from '../src/renderers/css/navigation/world-camera.js';
import { PREPARED_WORLD_PRESENTATION } from './prepared-world-presentation.mts';
import { APPLICATION_WORLD_CONTEXT as applicationContext } from './world-context-plan.mts';
import { DIAGNOSTICS_ENABLED } from './diagnostics-policy.mts';
import { createPreparedContextNavigation } from './prepared-context-navigation.mts';
import { CONTEXT_AVAILABILITY } from './context-availability.mts';
import { suppressMinorMoonOrbitPaint } from './moon-orbit-policy.mts';
import { mountCatalogueMoonLabels } from './catalogue-moon-labels.mts';
import { loadApplicationUniverse } from './application-world-resources.mts';
import { createApplicationWorldFrames } from './application-world-frames.mts';
import { createApplicationWorldVisibility, worldVisibilityPolicy } from './application-world-visibility.mts';
import type { ApplicationWorldLayer } from './application-world-types.mts';

export function createApplicationWorldContext() {
  return {
    async mount({ stage, viewport, signal, onSelectFocus, windowTarget = stage.ownerDocument.defaultView }: { stage: HTMLElement; viewport: ReturnType<typeof createCameraViewport>; signal?: AbortSignal; onSelectFocus(id: string): void; windowTarget?: Window | null }) {
      const target = stage.ownerDocument.defaultView;
      if (!target || !windowTarget) throw new Error('World context requires a window.');
      const lifetime = createSceneLifetime();
      const reportError = (error: unknown) => target.reportError(error);
      const destroy = () => { for (const error of lifetime.destroy()) reportError(error); };
      const own = <T extends { destroy(): void }>(owner: T): T => {
        for (const error of lifetime.onDispose(() => owner.destroy())) reportError(error);
        return owner;
      };
      const cancelled = () => signal?.reason ?? new DOMException('World context mount was cancelled.', 'AbortError');
      signal?.addEventListener('abort', destroy, { once: true });
      lifetime.onDispose(() => signal?.removeEventListener('abort', destroy));
      try {
        if (signal?.aborted) throw cancelled();
        // Shared prepared data may finish loading after this mount is cancelled.
        const loaded = await lifetime.wait(loadApplicationUniverse());
        if (loaded.cancelled || lifetime.disposed) throw cancelled();
        const prepared = loaded.value;
        const resources = own(prepareObjectResources(prepared.assets, { signal }));
        if ((await lifetime.wait(resources.ready)).cancelled || lifetime.disposed) throw cancelled();
        let refreshWorld = () => false;
        // World presentation lives beside the detail stage, outside its changing object scope.
        const presentationHost = stage.closest<HTMLElement>('.object-world-stage') ?? stage;
        const layer = own(prepared.mount(stage, { presentationHost,
          requestPublication: () => refreshWorld(),
          onSelectGalaxy: object => { if (!lifetime.disposed) onSelectFocus(object.id); },
        }));
        const occlusion = labelOcclusionFor(stage.ownerDocument);
        const updateOcclusion = () => { if (!lifetime.disposed) layer.setLabelBlockers(occlusion.read()); };
        updateOcclusion();
        lifetime.onDispose(occlusion.subscribe(updateOcclusion));
        const contextNavigation = own(createPreparedContextNavigation({ layer, presentation: PREPARED_WORLD_PRESENTATION.galaxies,
          unavailableObjectIds: Object.entries(CONTEXT_AVAILABILITY).filter(([, state]) => !state.available).map(([id]) => id),
          sources: prepared.catalogSources, windowTarget }));
        lifetime.onDispose(suppressMinorMoonOrbitPaint(presentationHost, worldVisibilityPolicy.minorMoonIds));
        const planner = own(prepared.createFramePlanner());
        const moonLabels = own(mountCatalogueMoonLabels(presentationHost, applicationContext.bodies, applicationContext.focus, layer.opacityClock));
        let heliosphereEnabled = false, shellsMounted = false;
        const frames = own(createApplicationWorldFrames({ layer, planner, moonLabels, lifetime,
          heliosphereEnabled: () => heliosphereEnabled }));
        refreshWorld = frames.refresh;
        // An orbit centre's paths reach the planner after the frame that asked for them; plan that view again to draw them.
        lifetime.onDispose(planner.onOrbitsLoaded(() => frames.refresh()));
        const inputSurface = stage.ownerDocument.querySelector<HTMLElement>('.object-input-surface');
        // Rotation suppresses hover/picking churn; label placement is continuous.
        const rotationChanged = (event: Event) => frames.setRotationActive(
          event instanceof CustomEvent && (event.detail as { active?: unknown } | null)?.active === true);
        inputSurface?.addEventListener('objectrotationchange', rotationChanged);
        lifetime.onDispose(() => inputSurface?.removeEventListener('objectrotationchange', rotationChanged));
        const visibility = createApplicationWorldVisibility(layer, lifetime);
        const diagnostics = DIAGNOSTICS_ENABLED ? createWorldContextDiagnostics(layer, frames, presentationHost !== stage) : null;
        if (diagnostics) {
          Reflect.set(target, '__cssEarthUniverse', diagnostics);
          lifetime.onDispose(() => {
            if (Reflect.get(target, '__cssEarthUniverse') === diagnostics) Reflect.deleteProperty(target, '__cssEarthUniverse');
          });
        }
        // Only the frame queue can publish the retained world.
        const { publish: _publish, ...context } = layer;
        return { ...context, viewport, destroy,
          present: frames.present,
          createFramePresenter: frames.createFramePresenter,
          setNavigationInFlight: frames.setNavigationInFlight,
          connectNavigation: contextNavigation.connect,
          applyFocus: contextNavigation.apply,
          previewSelection(id?: string | null) {
            if (!lifetime.disposed) layer.previewSelection(id);
          },
          selectObject(id: string, frame: PreparedWorldCameraFrame, framingScale?: number) {
            if (lifetime.disposed) return;
            visibility.selectObject(id);
            layer.selectObject(id, frame, framingScale);
            moonLabels.selectObject(id);
          },
          setIllustrationModelsEnabled: visibility.setIllustrationModelsEnabled,
          setHighlightedClassification: visibility.setHighlightedClassification,
          setThreeDStarsEnabled(enabled: boolean) {
            if (!lifetime.disposed) layer.setStellarPointsEnabled(enabled);
          },
          setHeliosphereEnabled(enabled: boolean) {
            if (lifetime.disposed || heliosphereEnabled === (enabled === true)) return;
            heliosphereEnabled = enabled === true;
            if (heliosphereEnabled && !shellsMounted) {
              shellsMounted = true;
              void prepared.loadShells().then(shells => {
                if (lifetime.disposed) return;
                for (const shell of shells) layer.addShell(shell);
                frames.refresh();
              }).catch(reportError);
            }
            frames.refresh();
          },
        };
      } catch (error) { destroy(); throw error; }
    },
  };
}

function createWorldContextDiagnostics(layer: ApplicationWorldLayer,
  frames: ReturnType<typeof createApplicationWorldFrames>, separateGeometry: boolean) {
  // World presentation lives outside the detail stage; capture its membership once.
  const geometry = separateGeometry
    ? createRetainedGeometrySnapshot(layer.roots.flatMap(root => [root, ...root.querySelectorAll('*')])) : null;
  return Object.freeze({ inspect: layer.inspect, frames: frames.stats, ...(geometry ? { geometry } : {}) });
}

export type WorldContextDiagnostics = ReturnType<typeof createWorldContextDiagnostics>;
