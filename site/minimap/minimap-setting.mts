import type { PreparedWorldCameraFrame, WorldCameraPose, WorldCameraViewport } from '../../src/renderers/css/navigation/world-camera.js';

type SpaceMinimap = ReturnType<typeof import('./minimap.mts')['mountSpaceMinimap']>;
type SpaceMinimapModule = { mountSpaceMinimap(documentTarget: Document): SpaceMinimap };

// The Minimap setting starts off. The module, its prepared points and its
// markers load the first time the setting turns on; while it is off nothing is
// projected. Once mounted the DOM is retained, and the shell's CSS hides it.
export function createSpaceMinimapSetting(documentTarget: Document, reportError: (error: unknown) => void,
  load: () => Promise<SpaceMinimapModule> = () => import('./minimap.mts')) {
  let minimap: SpaceMinimap | null = null, requested = false, enabled = false, destroyed = false;
  let focus: PreparedWorldCameraFrame | null = null, hiddenBodies: readonly string[] = [];
  let world: WorldCameraPose | null = null, viewport: WorldCameraViewport | null = null;
  const draw = () => { if (enabled && minimap && world && viewport) minimap.publish(world, viewport); };
  return {
    setEnabled(next: boolean) {
      if (destroyed || enabled === (next === true)) return;
      enabled = next === true;
      if (enabled && !requested) {
        requested = true;
        // A failed download may be retried by switching the setting on again.
        void load().catch(error => { requested = false; throw error; }).then(({ mountSpaceMinimap }) => {
          if (destroyed) return;
          minimap = mountSpaceMinimap(documentTarget);
          if (focus) minimap.selectObject(focus);
          minimap.setHiddenBodies(hiddenBodies);
          draw();
        }).catch(reportError);
      }
      draw();
    },
    selectObject(frame: PreparedWorldCameraFrame) { focus = frame; minimap?.selectObject(frame); },
    setHiddenBodies(ids: readonly string[]) { hiddenBodies = ids; minimap?.setHiddenBodies(ids); },
    // The latest camera is kept while off, so turning the setting on draws the current view.
    publish(nextWorld: WorldCameraPose, nextViewport: WorldCameraViewport) {
      if (destroyed) return;
      world = nextWorld; viewport = nextViewport;
      draw();
    },
    destroy() { destroyed = true; world = viewport = null; minimap?.destroy(); minimap = null; },
  };
}
