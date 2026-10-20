import { isRecord } from '@cssearth/core';
/**
 * The lab's workspace on the website's own scene. The page (site-scene-view.tsx) draws the object; this owns only lab
 * layers stacked over it in `#viewer` (the registered photograph, the difference map, candidate models, field stars) and
 * publishes each with the camera the page reports, through the renderer's own projection, so they land on the page's
 * pixels. Camera actions, datasets and layers are commands to the page; nothing here draws the object.
 */
import type { PreparedCataloguePoints, PreparedCssImageLayers, PreparedCssVolume } from '@cssearth/objects';
import { mountPreparedCataloguePoints } from '@cssearth/renderer/stars/prepared-catalogue-points.ts';
import type { VolumeCameraPublication } from '@cssearth/renderer/volume/types.ts';
import type { WorldLayer } from '@cssearth/renderer/universe/world-layers.ts';
import { loadPlateOverlay, loadVolumeOverlay, mountReconstructionOverlay } from '../../adapters/viewer/reconstruction-overlay';
import { createDifferencePlane, differenceSourceOf } from '../legacy-viewer/difference-plane';
import { createCandidateModels, type CandidateModelState } from '../plates/candidate-models';
import { loadSelectedBank } from '../legacy-viewer/bank-selection';
import { localFile, subjects } from '../legacy-viewer/subject-catalogue';

/** The picture the original-image plane shows: the photograph as published, a plate dataset's star-free copy, or a lab
 * candidate (`candidate:<id>`). */
export type OriginalPicture = 'original' | 'starless' | `candidate:${string}`;
import type { SiteBridge } from './site-bridge.ts';
import { siteSubjectFor } from './site-subjects.ts';
import { sameOrientation } from './site-camera.ts';
import { mountSitePick, type SitePick } from './site-pick.ts';
import type { SiteClick } from './site-bridge.ts';

type Subject = (typeof subjects)[number];
export interface SiteSceneState {
  subjectId: string; ready: boolean; error: string; dataset: string | null; datasets: readonly string[]; hidden: readonly WorldLayer[];
  earthFacing: boolean; bank: { object: string; dataset: string | null } | null;
  originalOverlay: { available: boolean; enabled: boolean; opacity: number; loading: boolean; picture: OriginalPicture };
  differenceOverlay: { available: boolean; enabled: boolean; earthFacing: boolean; opacity: number; loading: boolean };
}

export function createSiteSceneController({ host, subjectId, onState }: { host: HTMLElement; subjectId: string; onState(state: SiteSceneState): void }) {
  const document = host.ownerDocument, end = document.createElement('span');
  end.hidden = true; host.append(end);
  let subject: Subject = subjects.find(item => item.id === subjectId) ?? subjects[0]!;
  let bridge: SiteBridge | null = null, unsubscribe = () => {}, disposed = false, version = 0, error = '';
  let payload: PreparedCssVolume | PreparedCssImageLayers | null = null, bankKey = '', last: VolumeCameraPublication | null = null;
  let earthPose: readonly number[] | null = null;
  let original: ReturnType<typeof mountReconstructionOverlay> | null = null, originalPending: Promise<void> | null = null;
  let originalEnabled = false, originalOpacity = .5, originalPicture: OriginalPicture = 'original';
  let fieldStars: ReturnType<typeof mountPreparedCataloguePoints> | null = null, models: CandidateModelState = { ids: [], shock: false, texture: 'auto' };
  const difference = createDifferencePlane(), candidates = createCandidateModels();
  // Annotate's pick layer (site-pick.ts), while Annotate is on.
  let picking = false, pick: SitePick | null = null;
  const clickListeners = new Set<(click: SiteClick) => void>();
  const bankDirectory = () => subject.plates?.object ?? subject.siteVolume?.object ?? '';
  function syncPick() {
    const want = picking && payload ? payload : null;
    if (pick && (!want || pick.root.dataset.sitePick !== want.id)) { pick.destroy(); pick = null; }
    if (want && !pick) {
      const directory = bankDirectory();
      pick = mountSitePick({ host, payload: want, resolve: path => localFile(`${directory}/prepared/${path}`) });
      if (last) pick.publish(last);
    }
  }
  const hasOriginal = () => Boolean(subject.plates || subject.siteVolume);
  const earthFacing = () => Boolean(earthPose && last && sameOrientation(earthPose, last.world.pose.orientationXyzw));
  function report() {
    const state = bridge?.state;
    onState({ subjectId: subject.id, ready: Boolean(state?.ready), error, dataset: state?.dataset ?? null, datasets: state?.datasets ?? [],
      hidden: state?.hidden ?? [], earthFacing: earthFacing(), bank: state?.volume ? { object: state.volume.objectId, dataset: state.volume.datasetId } : null,
      originalOverlay: { available: hasOriginal() && Boolean(payload), enabled: originalEnabled && hasOriginal(), opacity: originalOpacity, loading: Boolean(originalPending), picture: originalPicture },
      differenceOverlay: { available: hasOriginal() && Boolean(payload), enabled: difference.enabled, earthFacing: earthFacing(), opacity: difference.opacity, loading: difference.loading } });
  }
  /** Every lab layer follows the page's camera: the same world pose and viewport its renderer drew with. */
  function publish() {
    if (!last || disposed) return;
    original?.publish(last); fieldStars?.publish(last); candidates.publish(last); pick?.publish(last);
    difference.publish(last, earthFacing());
  }
  const dataset = () => bridge?.state?.volume?.datasetId ?? '';
  /** The page now shows another bank: the lab subject follows it, and its layers are made again in its frame. */
  async function followBank() {
    const state = bridge?.state;
    if (!state?.ready) { report(); return; }
    const next = siteSubjectFor(subjects, state.objectId, state.volume?.objectId ?? null, subject);
    const key = `${next.id}:${state.volume?.datasetId ?? ''}`;
    if (key === bankKey) return;
    bankKey = key; const request = ++version;
    subject = next; payload = null; error = '';
    original?.destroy(); original = null; originalPending = null; difference.clear(); candidates.clear(); syncPick();
    if (originalPicture !== 'original' && !subject.plates) originalPicture = 'original';
    report();
    try {
      const directory = subject.plates?.object ?? subject.siteVolume?.object;
      if (!directory) return;
      const fetchBytes = async (path: string) => {
        const response = await fetch(localFile(`${directory}/${path}`));
        if (!response.ok) throw new Error(`Missing prepared file: ${path} (${response.status})`);
        return response.arrayBuffer();
      };
      const descriptor: unknown = JSON.parse(new TextDecoder().decode(await fetchBytes('object.json')));
      if (!isRecord(descriptor)) throw new TypeError('Invalid site bank descriptor.');
      const { loaded } = await loadSelectedBank(descriptor, fetchBytes, { directory, ...(state.volume?.datasetId && subject.siteVolume ? { dataset: state.volume.datasetId } : {}) });
      if (disposed || request !== version) return;
      payload = loaded; syncPick();
      if (originalEnabled) await setOriginal(true);
      if (difference.enabled) await setDifference(true, difference.opacity);
      if (models.ids.length || models.shock) await setCandidateModels(models);
    } catch (failure) {
      if (!disposed && request === version) error = failure instanceof Error ? failure.message : String(failure);
    } finally { if (!disposed && request === version) { publish(); report(); } }
  }
  async function setOriginal(enabled: boolean, opacity = originalOpacity, picture: OriginalPicture = originalPicture) {
    if (!(Number.isFinite(opacity) && opacity >= 0 && opacity <= 1)) throw new TypeError('Original image opacity must be between zero and one.');
    if (picture !== 'original' && picture !== 'starless' && !/^candidate:[a-z0-9-]+$/.test(picture)) throw new TypeError('Unknown original picture.');
    if (picture !== originalPicture) {
      if (picture !== 'original' && !subject.plates) throw new Error('Only a plate dataset names its star-free or candidate pictures.');
      if (originalPending) await originalPending;
      originalPicture = picture; original?.destroy(); original = null;
    }
    originalEnabled = enabled; originalOpacity = opacity;
    if (!enabled) { original?.setVisible(false, opacity); report(); return; }
    if (!payload || !hasOriginal()) throw new Error('This dataset has no registered photograph in the lab.');
    const request = version, frame = payload.frame, current = () => !disposed && request === version;
    if (!original && !originalPending) {
      const plates = subject.plates, volume = subject.siteVolume;
      const pending = (async () => {
        const { overlay, textureUrl: url } = plates ? await loadPlateOverlay(plates.object, originalPicture, localFile, frame)
          : await loadVolumeOverlay(volume!.object, dataset(), localFile, frame);
        const image = new Image(); image.src = url; await image.decode();
        if (image.naturalWidth !== overlay.widthPx || image.naturalHeight !== overlay.heightPx) throw new TypeError('Original image decoded at the wrong prepared size.');
        if (current()) original = mountReconstructionOverlay({ host, before: end, frame, overlay, url });
      })();
      originalPending = pending; report();
      try { await pending; } catch (failure) {
        if (current()) { originalEnabled = false; error = `The photograph could not load: ${failure instanceof Error ? failure.message : String(failure)}`; }
        throw failure;
      } finally { if (originalPending === pending) originalPending = null; if (current()) report(); }
    } else if (originalPending) await originalPending;
    if (current()) { original?.setVisible(originalEnabled, originalOpacity); publish(); report(); }
  }
  async function setDifference(enabled: boolean, opacity: number) {
    const request = version, current = () => !disposed && request === version;
    const loading = difference.set(enabled, opacity, payload ? { host, before: end, frame: payload.frame, current,
      source: differenceSourceOf(subject, { dataset: dataset(), picture: originalPicture, frame: payload.frame, distanceUnits: subject.referenceDistanceUnits, url: localFile }) } : undefined);
    report();
    try { await loading; } finally { if (current()) { publish(); report(); } }
  }
  /** A chosen published model replaces the page's own subject while it is shown (the page's `subject` layer). */
  async function setCandidateModels(state: CandidateModelState) {
    if (!payload || !subject.plates) throw new Error('Published 3D models are shown on a plate dataset.');
    models = state;
    const request = version, current = () => !disposed && request === version;
    await candidates.set(state, { host, before: end, frame: payload.frame, object: subject.plates.object, current });
    const hidden = new Set(bridge?.state?.hidden ?? []), replace = state.ids.length > 0;
    if (replace !== hidden.has('subject')) {
      if (replace) hidden.add('subject'); else hidden.delete('subject');
      await bridge?.send({ type: 'set-layers', hidden: [...hidden] });
    }
    if (current()) publish();
  }
  function setFieldStars(points: PreparedCataloguePoints | null) {
    fieldStars?.destroy(); fieldStars = null; delete host.dataset.fieldStars;
    if (!points) { publish(); return; }
    if (!payload) throw new Error('The prepared object is still loading.');
    if (points.frame.referenceFrame !== payload.frame.referenceFrame || points.frame.epochJdTt !== payload.frame.epochJdTt)
      throw new TypeError('The stars were placed in another frame than the shown bank.');
    fieldStars = mountPreparedCataloguePoints({ host, before: end, payload: points });
    host.dataset.fieldStars = String(points.points.length); publish();
  }
  const command = async (send: () => Promise<unknown>) => {
    if (!bridge) throw new Error('The website view is not open.');
    try { await send(); error = ''; } catch (failure) { error = failure instanceof Error ? failure.message : String(failure); report(); throw failure; }
  };
  return {
    /** The page's bridge, when its frame mounts; null when it unmounts. */
    attach(next: SiteBridge | null) {
      if (next === bridge) return;
      unsubscribe(); bridge = next; last = null; earthPose = null; bankKey = '';
      if (!next) { report(); return; }
      const clicks = next.onClick(click => { for (const listener of clickListeners) listener(click); });
      const changes = next.subscribe(change => {
        if (change === 'state') { void followBank(); report(); return; }
        const camera = next.camera;
        if (!camera) return;
        const wasFacing = earthFacing();
        last = { world: camera.world, viewport: camera.viewport }; publish();
        if (wasFacing !== earthFacing()) report();
      });
      unsubscribe = () => { clicks(); changes(); };
      void next.send({ type: 'sync' }).catch((failure: unknown) => {
        if (!disposed && bridge === next && !next.state?.ready) {
          error = failure instanceof Error ? failure.message : String(failure); report();
        }
      });
    },
    /** Another subject from the picker: its page is about to replace this one, and its bank is followed when it reports. */
    changeSubject(id: string) {
      const next = subjects.find(item => item.id === id);
      if (!next || next === subject) return;
      version++; subject = next; payload = null; bankKey = ''; error = ''; earthPose = null;
      original?.destroy(); original = null; originalPending = null; originalPicture = 'original'; difference.clear(); candidates.clear();
      models = { ids: [], shock: false, texture: 'auto' }; setFieldStars(null); syncPick();
      report();
    },
    /** Annotate is on: the shown bank's pick layer follows the page's camera until it is off. */
    setPicking(on: boolean) { picking = on; syncPick(); },
    /** What Annotate reads: the shown bank, its pick layer's leaves and where they are. */
    annotationContext() {
      return pick && payload ? { payload, banks: pick.banks, host: pick.root, directory: bankDirectory(), subjectId: subject.id, dataset: dataset() || 'default' } : null;
    },
    /** Hears each click on the page's scene, in the lab layers' pixels. */
    onClick(listener: (click: SiteClick) => void) { clickListeners.add(listener); return () => { clickListeners.delete(listener); }; },
    /** The page's dataset, as it last reported it. */
    get siteDataset() { return bridge?.state?.dataset ?? null; },
    get subject() { return subject; },
    get payload() { return payload; },
    get camera() { return last; },
    showOriginal: (enabled: boolean) => setOriginal(enabled),
    showOriginalPicture: (enabled: boolean, picture: OriginalPicture) => setOriginal(enabled, originalOpacity, picture),
    setOriginalOpacity: (opacity: number) => setOriginal(originalEnabled, opacity),
    setDifference, setCandidateModels, setFieldStars,
    selectDataset: (id: string) => command(() => bridge!.send({ type: 'select-dataset', id })),
    setLayers: (hidden: readonly WorldLayer[]) => command(() => bridge!.send({ type: 'set-layers', hidden: [...hidden] })),
    resetCamera: () => command(() => bridge!.send({ type: 'reset' })),
    fitCloud: () => command(() => bridge!.send({ type: 'fit' })),
    // The page posts the camera a sync asks for before it answers it: the Earth view is the camera then.
    referenceView: () => command(async () => {
      await bridge!.send({ type: 'earth-view' }); await bridge!.send({ type: 'sync' });
      earthPose = bridge!.camera?.world.pose.orientationXyzw ?? null; publish(); report();
    }),
    setPose: (_pose: 'x-plus-60') => command(() => bridge!.send({ type: 'turn', degrees: 60 })),
    async captureView(): Promise<string> {
      if (!bridge) throw new Error('The website view is not open.');
      const { view } = await bridge.send({ type: 'capture-view' });
      if (!view) throw new Error('The page returned no view.');
      return view;
    },
    restoreView: (view: string) => command(() => bridge!.send({ type: 'restore-view', view })),
    destroy() {
      if (disposed) return;
      disposed = true; version++; unsubscribe(); original?.destroy(); fieldStars?.destroy(); difference.clear(); candidates.clear(); pick?.destroy(); end.remove();
    },
  };
}
export type SiteSceneController = ReturnType<typeof createSiteSceneController>;
