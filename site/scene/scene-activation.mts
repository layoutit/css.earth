import type { BrowserWindow } from '../browser-types.mts';
import { errorMessage, record } from '../browser-types.mts';
import { readNavigationSelection } from '../navigation/navigation-request.mts';
import { SCENE_OBJECTS } from '../objects.mts';
import { withDataset } from '../dataset-url.mts';
import type { createPreparedWorldNavigation, WorldHandoff } from '../prepared-world-navigation.mts';
import { selectSceneDataset } from './scene-datasets.mts';
import type { SceneSession } from './scene-session.mts';
import type { SceneView } from './scene-view.mts';

/** Arrival restores prepared state before the session becomes ready; every binding belongs to that session. */
export function createSceneActivation({ windowTarget, navigation, view, isCurrent }: {
  windowTarget: BrowserWindow;
  navigation: ReturnType<typeof createPreparedWorldNavigation>;
  view: SceneView;
  isCurrent(session: SceneSession): boolean;
}) {
  async function restore(session: SceneSession, handoff?: WorldHandoff) {
    const { objectId, request, mount, shell } = session;
    if (!mount || !shell) return false;
    const initialSelection = !request && session.url ? readNavigationSelection(new URL(session.url), objectId, SCENE_OBJECTS) : null;
    if (initialSelection?.subject.kind === 'overview' && !initialSelection.savedView) {
      const target = navigation.overviewTarget({ scope: initialSelection.subject.overview.scope, objectId, fromId: objectId, mount });
      if (target) {
        const framed = await session.wait(navigation.focus({ objectId, mount,
          signal: session.signal, reducedMotion: true,
          targetWorldCamera: target.world, targetFocusPositionM: target.focusPositionM }));
        if (framed.cancelled || !isCurrent(session)) return;
      }
    }
    let interrupted = false;
    if (handoff?.afterMount) {
      if (!request) throw new Error('A world handoff requires its navigation request.');
      try {
        const completed = await session.wait(handoff.afterMount(mount));
        if (completed.cancelled || !isCurrent(session) || request.signal.aborted) return;
      } catch (error) {
        if ((!record(error) && !(error instanceof Error)) || error.name !== 'AbortError' || !('preserveView' in error) || error.preserveView !== true || !isCurrent(session) ||
            request.signal.aborted) throw error;
        // The detailed destination already owns the camera. Real input ends
        // its flight without retiring that scene or restoring the endpoint.
        interrupted = true;
        const drawnUrl = view.capture(request.url);
        if (drawnUrl) request.url = session.url = new URL(drawnUrl, windowTarget.location.href).href;
      }
    }
    const datasetSignal = request ? AbortSignal.any([request.signal, session.signal]) : session.signal;
    try {
      const selected = session.url ? await selectSceneDataset(session, session.url, datasetSignal, { initial: true }) : true;
      if (!isCurrent(session) || datasetSignal.aborted) return false;
      if (!selected) throw new Error('Dataset selection was superseded.');
    } catch (error) {
      if (!isCurrent(session) || datasetSignal.aborted) return false;
      const datasets = mount.datasets;
      // An adopted server dataset may already be selected before its companion fails to load.
      if (datasets && datasets.current() !== datasets.defaultId) {
        if (!await datasets.select(datasets.defaultId, { signal: datasetSignal }) || !isCurrent(session)) return false;
      }
      shell.setDatasetNotice?.(`${errorMessage(error)} Showing the default dataset.`);
      // A direct invalid link stays visible for diagnosis. A completed body
      // navigation publishes the destination's actual default selection.
      if (request) {
        const datasets = mount.datasets, current = datasets?.current();
        request.url = session.url = withDataset(new URL(request.url), current && current !== datasets?.defaultId ? current : null).href;
      }
    }
    return { interrupted, feature: request ? request.feature : initialSelection?.feature ?? null };
  }

  function connectControls(session: SceneSession) {
    const { mount, shell } = session;
    if (!mount || !shell) return;
    // Restore the incoming camera before arming optional texture detail. An
    // untouched page keeps its prepared coarse surface; the first real input
    // admits the 2048 refinement outside the cold-load critical path.
    if (mount.refineTextures && mount.refinesWithoutInput) mount.refineTextures();
    else if (mount.refineTextures) {
      const releaseRefinement = () => {
        removeRefinementListeners();
        if (isCurrent(session)) mount.refineTextures?.();
      };
      const removeRefinementListeners = () => {
        windowTarget.removeEventListener('pointerdown', releaseRefinement);
        windowTarget.removeEventListener('wheel', releaseRefinement);
        windowTarget.removeEventListener('keydown', releaseRefinement);
      };
      windowTarget.addEventListener('pointerdown', releaseRefinement, { once: true });
      windowTarget.addEventListener('wheel', releaseRefinement, { once: true, passive: true });
      windowTarget.addEventListener('keydown', releaseRefinement, { once: true });
      session.own(removeRefinementListeners);
    }
    shell.setCamera?.(mount);
    session.own(() => { shell.setCamera?.(null); });
  }

  return { restore, connectControls };
}
