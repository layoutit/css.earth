/**
 * The lab's controller: one nebula on the website's own scene (features/site-scene). The picker chooses the subject, the
 * page draws it, and the step panels drive the page and the lab layers over it through the controller's commands.
 */
import { subjects } from '../features/legacy-viewer/subject-catalogue';
import { labObjectId } from '../features/legacy-viewer/lab-routing';
import { workspaceObjects } from '../state/workspace-objects';
import { createSiteSceneController, type SiteSceneState } from '../features/site-scene/site-scene-controller';
import type { LabShellState } from '../state/lab-shell';

export const labObjects = workspaceObjects(subjects).filter(item => item.app).map(item => ({ id: item.id, name: item.menuLabel ?? item.name }));

/** The picker entry a subject is shown under: its own, or the entry of the subject it derives from. */
export function pickerEntry(id: string | null): string {
  const item = subjects.find(value => value.id === id);
  const source = labObjects.some(value => value.id === id) ? id! : item?.sourceSubjectId ?? id ?? '';
  return labObjects.find(value => value.id === source)?.id ?? labObjects[0]!.id;
}

export function mountSiteLab({ host, onShellState }: { host: HTMLElement; onShellState(state: LabShellState): void }) {
  let requested = pickerEntry(labObjectId(new URL(location.href)));
  const shellOf = (state: SiteSceneState | null): LabShellState => {
    const ready = Boolean(state?.ready), message = state?.error || (ready ? '' : 'Loading the website view…');
    return { objectId: requested, subjectId: state?.subjectId ?? requested, view: 'reconstruction', busy: !ready, alignmentAvailable: false, pose: 'front',
      ...(state ? { originalOverlay: state.originalOverlay, differenceOverlay: state.differenceOverlay, site: state } : {}),
      presentation: { viewerHidden: false, cameraDisabled: !ready, referenceDisabled: !ready, toneDisabled: true, densityCamera: true,
        densityAdjustments: false, imageAdjustments: false, reconstructionImages: false, cloudAdjustments: false, cloudDensity: false, sourceCredit: '',
        status: { message, hidden: !message, error: Boolean(state?.error) } } };
  };
  // The page's dataset is kept in the lab's link (`dataset=`), so a reload opens the page on it.
  const follow = (state: SiteSceneState) => {
    const url = new URL(location.href), dataset = state.ready ? state.dataset : null;
    if (dataset && url.searchParams.get('dataset') !== dataset) { url.searchParams.set('dataset', dataset); history.replaceState(history.state, '', url); }
    onShellState(shellOf(state));
  };
  const scene = createSiteSceneController({ host, subjectId: requested, onState: follow });
  onShellState(shellOf(null));
  const followHistory = () => {
    const url = new URL(location.href), next = pickerEntry(labObjectId(url));
    if (next !== requested) { requested = next; scene.changeSubject(next); }
    else if (url.searchParams.get('dataset')) void scene.selectDataset(url.searchParams.get('dataset')!).catch(() => {});
  };
  window.addEventListener('popstate', followHistory);
  const destroyScene = scene.destroy;
  return Object.assign(scene, {
    destroy() { window.removeEventListener('popstate', followHistory); destroyScene(); },
    /** Another nebula from the picker: its page replaces this one (site-scene-view.tsx keys the frame by object). */
    changeObject(id: string) {
      const next = pickerEntry(id);
      if (next === requested) return;
      requested = next;
      const url = new URL(location.href);
      url.searchParams.set('subject', next); url.searchParams.delete('object'); url.searchParams.delete('dataset'); url.searchParams.delete('view');
      history.pushState(history.state, '', url);
      scene.changeSubject(next);
    },
  });
}
export type SiteLab = ReturnType<typeof mountSiteLab>;
