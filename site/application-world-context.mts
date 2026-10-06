import { createSceneLifetime } from '@cssearth/engine';
import { labelOcclusionFor } from '@cssearth/renderer';
import { afterStartup } from '@cssearth/renderer/rendering/startup-gate.ts';
import { prepareObjectResources, createRetainedGeometrySnapshot } from '@cssearth/renderer/universe';
import { createCameraViewport } from '@cssearth/renderer/navigation';
import type { PreparedLabelEdge } from '@cssearth/renderer/navigation/prepared-label-edge.ts';
import type { PreparedWorldCameraFrame } from '@cssearth/objects';
import { PREPARED_WORLD_PRESENTATION } from './world/prepared-world-presentation.mts';
import { APPLICATION_WORLD_CONTEXT as applicationContext } from './world-context-plan.mts';
import { createWorldApproach } from './world-approach.mts';
import { DIAGNOSTICS_ENABLED } from './browser/diagnostics-policy.mts';
import { CONTEXT_AVAILABILITY } from './world/context-availability.mts';
import { suppressMinorMoonOrbitPaint } from './world/moon-orbit-policy.mts';
import { mountCatalogueMoonLabels } from './world/catalogue-moon-labels.mts';
import { loadApplicationUniverse } from './application-world-resources.mts';
import { ancestorIds, knownAncestors } from './object-directory.mts';
import { CONTEXT_OBJECT_DESCRIPTORS } from './prepared/prepared-context-objects.mts';
import { surroundingHosts } from './world/surrounded-body.mts';

/** The world's prepared data and planner worker, which `startup-boot.mts` starts while the first body still loads. */
export { loadApplicationUniverse };
export { prestartWorldContextPlanner as prestartWorldPlanner } from '@cssearth/renderer/universe';
import { createApplicationWorldFrames } from './world/application-world-frames.mts';
import { createApplicationWorldVisibility, worldVisibilityPolicy } from './application-world-visibility.mts';
import type { ApplicationWorldLayer } from './world/application-world-types.mts';

/** The objects whose picture lies on walls around their middle (surrounded-body.mts). */
const WALLED = surroundingHosts(CONTEXT_OBJECT_DESCRIPTORS);

export function createApplicationWorldContext() {
  return {
    async mount({ stage, viewport, signal, windowTarget = stage.ownerDocument.defaultView }: { stage: HTMLElement; viewport: ReturnType<typeof createCameraViewport>; signal?: AbortSignal; windowTarget?: Window | null }) {
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
        // The body the world last selected: its holders are published again once the page has read what it is inside.
        let selectedId: string | null = null;
        // World presentation lives beside the detail stage, outside its changing object scope.
        const presentationHost = stage.closest<HTMLElement>('.object-world-stage') ?? stage;
        const layer = own(prepared.mount(stage, { presentationHost,
          requestPublication: () => refreshWorld(),
        }));
        const occlusion = labelOcclusionFor(stage.ownerDocument);
        const updateOcclusion = () => { if (!lifetime.disposed) layer.setLabelBlockers(occlusion.read()); };
        updateOcclusion();
        lifetime.onDispose(occlusion.subscribe(updateOcclusion));
        lifetime.onDispose(suppressMinorMoonOrbitPaint(presentationHost, worldVisibilityPolicy.minorMoonIds));
        const planner = own(prepared.createFramePlanner());
        // A star's holder is read when the camera comes near it (world-approach.mts); the stars' places arrive after the
        // first view (startup-gate.ts).
        const approach = createWorldApproach();
        afterStartup(target, () => { if (!lifetime.disposed) approach.start(); });
        const moonLabels = own(mountCatalogueMoonLabels(presentationHost, () => applicationContext.bodies, applicationContext.focus, layer.opacityClock, () => refreshWorld(), layer.depthBase));
        let heliosphereEnabled = false, shellsMounted = false;
        const frames = own(createApplicationWorldFrames({ layer, planner, moonLabels, lifetime,
          heliosphereEnabled: () => heliosphereEnabled, onFrame: world => approach.observe(world.pose.positionM) }));
        refreshWorld = frames.refresh;
        // An orbit centre's paths reach the planner after the frame that asked for them; plan that view again to draw them.
        lifetime.onDispose(planner.onOrbitsLoaded(() => frames.refresh()));
        const inputSurface = stage.ownerDocument.querySelector<HTMLElement>('.object-input-surface');
        // Rotation suppresses hover/picking churn; label placement is continuous.
        const rotationChanged = (event: Event) => frames.setRotationActive(
          event instanceof CustomEvent && (event.detail as { active?: unknown } | null)?.active === true);
        inputSurface?.addEventListener('objectrotationchange', rotationChanged);
        lifetime.onDispose(() => inputSurface?.removeEventListener('objectrotationchange', rotationChanged));
        // The inertia gate: while the camera coasts, the world holds its membership (motion-freezes-membership.md).
        const motionChanged = (event: Event) => frames.setCoasting(
          event instanceof CustomEvent && (event.detail as { coasting?: unknown } | null)?.coasting === true);
        inputSurface?.addEventListener('objectmotionchange', motionChanged);
        lifetime.onDispose(() => inputSurface?.removeEventListener('objectmotionchange', motionChanged));
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
          previewSelection(id?: string | null, framingScale?: number, edge?: PreparedLabelEdge) {
            if (!lifetime.disposed) layer.previewSelection(id, framingScale, edge);
          },
          selectObject(id: string, frame: PreparedWorldCameraFrame, framingScale?: number, edge?: PreparedLabelEdge) {
            if (lifetime.disposed) return;
            visibility.selectObject(id);
            layer.selectObject(id, frame, framingScale, edge);
            moonLabels.selectObject(id);
            // The objects the body is inside, by the object tree, as its own entry names them: a bank of plain-dot stars one of
            // them hosts (another galaxy's) draws around the body. No other entry is read for this. One whose picture lies on
            // walls draws those walls around the body, and is not marked among them.
            selectedId = id;
            const hold = (ids: readonly string[]) => { layer.setSelectionHolders(ids); visibility.setSurrounding(ids.filter(holder => WALLED.has(holder))); };
            hold(knownAncestors(id).map(object => object.id));
            void ancestorIds(id).then(ids => { if (!lifetime.disposed && selectedId === id) hold(ids); }, () => {});
          },
          setIllustrationModelsEnabled: visibility.setIllustrationModelsEnabled,
          setHighlightedClassification: visibility.setHighlightedClassification,
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
