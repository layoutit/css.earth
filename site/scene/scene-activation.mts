import { zoomStepOf } from '../inside-view.mts';
import { moonSystem, subjectView } from './scene-subject.mts';
import type { BrowserWindow } from '../browser/browser-types.mts';
import { errorMessage } from '../browser/browser-types.mts';
import { isRecord } from '@cssearth/core';
import { readNavigationSelection } from '../navigation/navigation-request.mts';
import { withSceneDataset } from '../model/dataset-url.mts';
import type { createPreparedWorldNavigation, WorldHandoff } from '../navigation/prepared-world-navigation.mts';
import { selectSceneDataset } from './scene-datasets.mts';
import type { SceneSession } from './scene-session.mts';
import type { SceneView } from './scene-view.mts';
import { loadSystemView } from '../system-framing.mts';
import { navigationHref } from '../navigation/navigation-history.mts';

/** Arrival restores prepared state before the session becomes ready; every binding belongs to that session. */
export function createSceneActivation({ windowTarget, navigation, view, isCurrent, getReducedMotion }: {
  windowTarget: BrowserWindow;
  getReducedMotion(): boolean;
  navigation: ReturnType<typeof createPreparedWorldNavigation>;
  view: SceneView;
  isCurrent(session: SceneSession): boolean;
}) {
  /** A page opened on an overview or a satellite system, without a saved view, frames it before the world context connects:
   * the world's first frame then plans from that camera, not from the body's default view (an overview page planned one
   * frame at the Sun's default view and fetched 40 Solar System orbit banks it never drew, 2026-09-30). False when the
   * session was superseded. */
  async function frameInitialView(session: SceneSession) {
    const { objectId, request, mount, shell } = session;
    if (!mount || !shell) return false;
    const initialSelection = !request && session.url ? readNavigationSelection(new URL(session.url), objectId) : null;
    // A page that opens on a zoom out (a star's system, an object seen from inside) opens framed as that scope says, around its centre.
    const step = initialSelection && !initialSelection.savedView ? zoomStepOf(initialSelection.subject) : null;
    if (step) {
      const target = navigation.overviewTarget({ scope: step.scope, objectId: step.centreId, fromId: objectId, mount, view: 'default' });
      if (target) {
        const framed = await session.wait(navigation.focus({ objectId, mount,
          signal: session.signal, reducedMotion: true,
          targetWorldCamera: target.world, targetFocusPositionM: target.focusPositionM }));
        if (framed.cancelled || !isCurrent(session)) return false;
      }
    }
    // A planet's system is its host seen out to its moons: framed the same way, around the host.
    if (initialSelection && moonSystem(initialSelection.subject) && !initialSelection.savedView) {
      await loadSystemView(objectId);
      const target = navigation.systemTarget({ objectId, fromId: objectId, mount, force: true });
      if (!target) throw new Error(`No prepared satellite-system target for ${objectId}.`);
      const framed = await session.wait(navigation.focus({ objectId, mount, signal: session.signal,
        reducedMotion: true, targetWorldCamera: target }));
      if (framed.cancelled || !isCurrent(session)) return false;
    }
    return true;
  }

  async function restore(session: SceneSession, handoff?: WorldHandoff) {
    const { objectId, request, mount, shell } = session;
    if (!mount || !shell) return false;
    const initialSelection = !request && session.url ? readNavigationSelection(new URL(session.url), objectId) : null;
    let interrupted = false;
    if (handoff?.afterMount) {
      try {
        const completed = await session.wait(handoff.afterMount(mount));
        if (completed.cancelled || !isCurrent(session) || request?.signal.aborted) return;
      } catch (error) {
        if ((!isRecord(error) && !(error instanceof Error)) || error.name !== 'AbortError' || !('preserveView' in error) || error.preserveView !== true || !request || !isCurrent(session) ||
            request.signal.aborted) throw error;
        // The detailed destination already owns the camera. Real input ends
        // its flight without retiring that scene or restoring the endpoint.
        interrupted = true;
        const drawnUrl = view.capture(request.url);
        if (drawnUrl) request.url = session.url = new URL(drawnUrl, navigationHref(windowTarget)).href;
      }
    }
    const datasetSignal = request ? AbortSignal.any([request.signal, session.signal]) : session.signal;
    try {
      const selected = session.url ? await selectSceneDataset(session, session.url, datasetSignal, { initial: true }) : true;
      if (!isCurrent(session) || datasetSignal.aborted) return false;
      if (!selected) throw new Error('Dataset selection was superseded.');
      if (!await frameDatasetVolume(session) || !isCurrent(session)) return false;
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
        request.url = session.url = withSceneDataset(new URL(request.url), session.objectId, current && current !== datasets?.defaultId ? current : null).href;
      }
    }
    return { interrupted, feature: request ? request.feature : initialSelection?.feature ?? null };
  }

  /** A plain body page whose dataset shows a volume opens on the whole volume when the view does not already hold it.
   * A saved view, a feature, an overview, a focus and a history restore keep their own camera. */
  async function frameDatasetVolume(session: SceneSession) {
    const { objectId, request, mount } = session;
    if (!mount || !session.url || request?.camera.kind === 'restore') return true;
    const selection = readNavigationSelection(new URL(session.url), objectId);
    if (subjectView(selection.subject) !== 'body' || selection.savedView || selection.feature) return true;
    const datasets = mount.datasets, volume = datasets?.volumeOf(datasets.current() ?? datasets.defaultId);
    const target = volume ? navigation.datasetVolumeTarget({ objectId, volumeId: volume.objectId, mount }) : null;
    if (!target) return true;
    // A cold page frames before it is ready; an arrival pulls back from the flight's endpoint.
    const framed = await session.wait(navigation.focus({ objectId, mount, signal: request?.signal ?? session.signal,
      reducedMotion: !request || getReducedMotion(), targetWorldCamera: target.world, targetFocusPositionM: target.focusPositionM }));
    return !framed.cancelled;
  }

  function connectControls(session: SceneSession) {
    const { mount, shell } = session;
    if (!mount || !shell) return;
    shell.setCamera?.(mount);
    session.own(() => { shell.setCamera?.(null); });
  }

  return { frameInitialView, restore, connectControls };
}
